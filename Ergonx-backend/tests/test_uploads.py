"""Every upload passes common.uploads.inspect_upload."""
import io
import socket
import struct
import threading
import zipfile

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from common.exceptions import CodedValidationError
from common.uploads import inspect_upload

PE = b"MZ" + b"\0" * 58 + (64).to_bytes(4, "little") + b"PE\0\0" + b"\0" * 64


def _docx(extra=()):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr("word/document.xml", "<w:document/>")
        for name in extra:
            archive.writestr(name, b"\0")
    return buffer.getvalue()


def _message(exc):
    return next(iter(exc.message_dict.values()))[0]


@pytest.mark.parametrize("name, content, expected_type", [
    ("contract.pdf", b"%PDF-1.7\n...", "application/pdf"),
    ("photo.JPG", b"\xff\xd8\xff\xe0rest", "image/jpeg"),
    ("minutes.docx", _docx(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ("notes.txt", b"plain text", "text/plain"),
    ("staff.csv", b"MZ,Mensah\n", "text/csv"),  # starts with MZ but is not a program
    ("no-extension", b"some bytes", "application/octet-stream"),
])
def test_accepts_ordinary_files_and_types_them_from_their_contents(name, content, expected_type):
    # The browser's claimed type is ignored.
    upload = SimpleUploadedFile(name, content, content_type="application/x-msdownload")
    assert inspect_upload(upload) == (name, expected_type)
    assert upload.read() == content  # the file is rewound for storage


@pytest.mark.parametrize("name, content, message", [
    ("setup.exe", b"anything", "Programs, scripts and macro-enabled files (.exe)"),
    ("invoice.pdf.js", b"alert(1)", "(.js)"),
    ("budget.xlsm", _docx(), "(.xlsm)"),
    ("report.pdf", PE, "program or script"),
    ("notes.txt", b"#!/bin/sh\nrm -rf /", "program or script"),
    ("linux.dat", b"\x7fELF\x02\x01", "program or script"),
    ("scan.pdf", b"<html>not a pdf</html>", "don't match its .pdf extension"),
    ("photo.png", b"\xff\xd8\xff\xe0jpeg", "don't match its .png extension"),
    ("letter.docx", _docx(["word/vbaProject.bin"]), "contain"),
    ("empty.pdf", b"", "empty"),
])
def test_refuses_programs_disguised_and_macro_files(name, content, message):
    with pytest.raises(CodedValidationError) as caught:
        inspect_upload(SimpleUploadedFile(name, content), field="uploaded_file")
    assert caught.value.api_code == "upload_rejected"
    assert message in _message(caught.value)
    assert "uploaded_file" in caught.value.message_dict


def test_size_limit_and_allowed_types(settings):
    settings.DOCUMENT_UPLOAD_MAX_BYTES = 10
    with pytest.raises(CodedValidationError, match="0 MB or smaller"):
        inspect_upload(SimpleUploadedFile("big.txt", b"x" * 11))
    with pytest.raises(CodedValidationError, match="PDF only"):
        inspect_upload(SimpleUploadedFile("a.txt", b"x"), allowed_types={"application/pdf"}, allowed_message="PDF only")
    # A file renamed to look acceptable is judged by its contents.
    with pytest.raises(CodedValidationError):
        inspect_upload(SimpleUploadedFile("cv.pdf", b"PK\x03\x04"), allowed_types={"application/pdf"})


def test_html_is_labelled_as_html_whatever_its_name():
    assert inspect_upload(SimpleUploadedFile("page.txt", b"<!DOCTYPE html><script>x</script>"))[1] == "text/html"
    assert inspect_upload(SimpleUploadedFile("logo.svg", b"<svg onload='x'/>"))[1] == "image/svg+xml"


class _FakeClamd:
    """A clamd stand-in that answers INSTREAM with FOUND for EICAR-like content."""

    def __init__(self):
        self.server = socket.socket()
        self.server.bind(("127.0.0.1", 0))
        self.server.listen(1)
        self.port = self.server.getsockname()[1]
        threading.Thread(target=self._serve, daemon=True).start()

    def _serve(self):
        connection, _ = self.server.accept()
        with connection:
            data = b""
            while not data.startswith(b"zINSTREAM\0"):
                data += connection.recv(4096)
            data = data[len(b"zINSTREAM\0"):]
            body = b""
            while True:
                while len(data) < 4:
                    data += connection.recv(4096)
                size = struct.unpack("!L", data[:4])[0]
                data = data[4:]
                if size == 0:
                    break
                while len(data) < size:
                    data += connection.recv(4096)
                body += data[:size]
                data = data[size:]
            reply = b"stream: Eicar-Signature FOUND\0" if b"EICAR" in body else b"stream: OK\0"
            connection.sendall(reply)
        self.server.close()


def test_clamav_blocks_infected_files_and_fails_closed(settings):
    settings.UPLOAD_SCANNER = "clamav"
    settings.CLAMAV_HOST = "127.0.0.1"
    settings.CLAMAV_TIMEOUT_SECONDS = 5
    clamd = _FakeClamd()
    settings.CLAMAV_PORT = clamd.port
    with pytest.raises(CodedValidationError, match="flagged as unsafe"):
        inspect_upload(SimpleUploadedFile("note.txt", b"X5O!P%@AP EICAR-STANDARD-ANTIVIRUS-TEST-FILE"))
    clean = _FakeClamd()
    settings.CLAMAV_PORT = clean.port
    assert inspect_upload(SimpleUploadedFile("note.txt", b"hello")) == ("note.txt", "text/plain")
    # Nothing listening: refused unless fail-open is configured.
    closed = socket.socket()
    closed.bind(("127.0.0.1", 0))
    settings.CLAMAV_PORT = closed.getsockname()[1]
    closed.close()
    with pytest.raises(CodedValidationError, match="scanner is unavailable"):
        inspect_upload(SimpleUploadedFile("note.txt", b"hello"))
    settings.UPLOAD_SCAN_FAIL_OPEN = True
    assert inspect_upload(SimpleUploadedFile("note.txt", b"hello"))[0] == "note.txt"


@pytest.mark.django_db
def test_document_api_returns_upload_rejected(api_client, institution_factory, user_factory, membership_factory):
    institution = institution_factory(code="UPL")
    user = user_factory()
    membership_factory(user=user, institution=institution, role_code="HR_ADMIN", is_primary=True)
    api_client.force_authenticate(user)
    api_client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))
    response = api_client.post("/api/v1/documents/", {"uploaded_file": SimpleUploadedFile("payslip.pdf", PE), "category": "HR", "classification": "CONFIDENTIAL"}, format="multipart")
    assert response.status_code == 400
    assert "program or script" in response.data["message"]
