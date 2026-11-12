"""One gate every uploaded file passes before it is stored.

``inspect_upload`` checks the size, refuses programs and scripts, makes sure a file's
contents match its extension (a ``.pdf`` must really be a PDF), works out the content type
from the file itself rather than trusting the browser, and, when configured, asks a ClamAV
virus scanner to check it. It returns the clean file name and the content type to store.
"""

import logging
import mimetypes
import socket
import struct

from django.conf import settings

from common.exceptions import CodedValidationError

logger = logging.getLogger("ergonx.security")

HEAD_BYTES = 8192

# Programs, scripts, installers and shortcuts: never useful as a record, and dangerous when
# a colleague downloads and opens one.
BLOCKED_EXTENSIONS = frozenset({
    "exe", "dll", "com", "scr", "pif", "cpl", "msi", "msp", "mst", "msc", "sys", "drv", "ocx",
    "bat", "cmd", "ps1", "psm1", "psd1", "vbs", "vbe", "js", "jse", "wsf", "wsh", "wsc", "hta",
    "lnk", "url", "scf", "inf", "reg", "jar", "class", "apk", "app", "dmg", "pkg", "deb", "rpm",
    "sh", "bash", "zsh", "csh", "ksh", "command", "run", "bin", "elf", "so", "dylib",
    "iso", "img", "vhd", "vhdx", "appx", "msix", "xll", "gadget", "application", "chm",
    "docm", "dotm", "xlsm", "xltm", "xlam", "pptm", "potm", "ppam", "ppsm", "sldm",
})

# Signatures of native executables, whatever the file is called.
_EXECUTABLE_MAGIC = (
    b"\x7fELF",               # Linux
    b"\xfe\xed\xfa\xce", b"\xfe\xed\xfa\xcf", b"\xce\xfa\xed\xfe", b"\xcf\xfa\xed\xfe",  # macOS Mach-O
    b"\xca\xfe\xba\xbe",      # macOS universal binary / Java class
    b"#!",                    # Unix script
)

_ZIP = b"PK\x03\x04"
_OLE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"

# Extension -> the signature its contents must start with.
_SIGNATURES = {
    "pdf": (b"%PDF-",),
    "png": (b"\x89PNG\r\n\x1a\n",),
    "jpg": (b"\xff\xd8\xff",), "jpeg": (b"\xff\xd8\xff",),
    "gif": (b"GIF87a", b"GIF89a"),
    "docx": (_ZIP,), "xlsx": (_ZIP,), "pptx": (_ZIP,), "odt": (_ZIP,), "ods": (_ZIP,), "odp": (_ZIP,), "zip": (_ZIP,),
    "doc": (_OLE,), "xls": (_OLE,), "ppt": (_OLE,), "msg": (_OLE,),
}

_OFFICE_TYPES = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "msg": "application/vnd.ms-outlook",
}


def _reject(field, message):
    raise CodedValidationError({field: message}, api_code="upload_rejected")


def clean_filename(uploaded_file, default="document"):
    name = (getattr(uploaded_file, "name", "") or default).replace("\\", "/").rsplit("/", 1)[-1]
    name = "".join(ch for ch in name if ch.isprintable()).strip()[:255]
    return name or default


def _extension(name):
    return name.rsplit(".", 1)[-1].lower() if "." in name else ""


def _read_head(uploaded_file):
    uploaded_file.seek(0)
    head = uploaded_file.read(HEAD_BYTES) or b""
    uploaded_file.seek(0)
    return head


def _is_windows_program(head):
    if not head.startswith(b"MZ") or len(head) < 64:
        return False
    offset = int.from_bytes(head[60:64], "little")
    return head[offset:offset + 4] == b"PE\0\0" or b"DOS mode" in head[:512]


def _zip_holds_macros(uploaded_file):
    import zipfile

    try:
        uploaded_file.seek(0)
        with zipfile.ZipFile(uploaded_file) as archive:
            names = archive.namelist()
    except (zipfile.BadZipFile, OSError, ValueError):
        return False
    finally:
        uploaded_file.seek(0)
    return any(name.rsplit("/", 1)[-1].lower().startswith("vbaproject") for name in names)


def _detected_type(head, extension):
    """The content type the bytes prove, or "" when the bytes prove nothing specific."""
    if head.startswith(b"%PDF-"):
        return "application/pdf"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if head.startswith(b"RIFF") and head[8:12] == b"WEBP":
        return "image/webp"
    if head.startswith(_ZIP):
        return _OFFICE_TYPES.get(extension) or mimetypes.guess_type(f"x.{extension}")[0] or "application/zip"
    if head.startswith(_OLE):
        return _OFFICE_TYPES.get(extension) or mimetypes.guess_type(f"x.{extension}")[0] or "application/x-ole-storage"
    return ""


def _looks_like_markup(head):
    sample = head[:1024].lstrip(b"\xef\xbb\xbf \t\r\n").lower()
    return sample.startswith((b"<!doctype html", b"<html", b"<svg", b"<script", b"<?xml")) or b"<script" in sample


def scan_with_clamav(uploaded_file):
    """Return the ClamAV signature name when the file is infected, "" when clean.

    Speaks clamd's INSTREAM protocol directly, so no extra package is needed. Raises
    OSError when the scanner cannot be reached.
    """
    host = getattr(settings, "CLAMAV_HOST", "") or "127.0.0.1"
    port = int(getattr(settings, "CLAMAV_PORT", 3310))
    timeout = float(getattr(settings, "CLAMAV_TIMEOUT_SECONDS", 30))
    uploaded_file.seek(0)
    with socket.create_connection((host, port), timeout=timeout) as connection:
        connection.sendall(b"zINSTREAM\0")
        while True:
            chunk = uploaded_file.read(64 * 1024)
            if not chunk:
                break
            connection.sendall(struct.pack("!L", len(chunk)) + chunk)
        connection.sendall(struct.pack("!L", 0))
        reply = b""
        while not reply.endswith(b"\0"):
            data = connection.recv(4096)
            if not data:
                break
            reply += data
    uploaded_file.seek(0)
    text = reply.rstrip(b"\0").decode("utf-8", "replace")
    if text.endswith("FOUND"):
        return text.split(":", 1)[-1].rsplit(" ", 1)[0].strip() or "malware"
    if text.endswith("OK"):
        return ""
    raise OSError(f"Unexpected virus scanner reply: {text[:120]}")


def _scan(uploaded_file, field, name):
    scanner = (getattr(settings, "UPLOAD_SCANNER", "") or "").lower()
    if scanner != "clamav":
        return
    try:
        signature = scan_with_clamav(uploaded_file)
    except OSError:
        logger.exception("Upload virus scan failed for %r", name)
        if getattr(settings, "UPLOAD_SCAN_FAIL_OPEN", False):
            return
        _reject(field, "The virus scanner is unavailable, so the file was not accepted. Try again shortly.")
    if signature:
        logger.warning("Upload blocked by virus scanner: %r matched %s", name, signature)
        _reject(field, "This file was flagged as unsafe by the virus scanner and was not uploaded.")


def inspect_upload(uploaded_file, *, field="file", max_bytes=None, default_name="document", allowed_types=None, allowed_message=""):
    """Validate ``uploaded_file`` and return ``(file_name, content_type)`` to store.

    ``allowed_types`` limits the accepted content types (judged from the file's contents
    where possible); ``allowed_message`` is shown when a file falls outside them.
    """
    if uploaded_file is None:
        _reject(field, "Choose a file to upload.")
    limit = max_bytes or settings.DOCUMENT_UPLOAD_MAX_BYTES
    if uploaded_file.size > limit:
        _reject(field, f"Files must be {limit // (1024 * 1024)} MB or smaller.")
    if not uploaded_file.size:
        _reject(field, "The file is empty.")
    name = clean_filename(uploaded_file, default_name)
    extension = _extension(name)
    if extension in BLOCKED_EXTENSIONS:
        _reject(field, f"Programs, scripts and macro-enabled files (.{extension}) can't be uploaded.")
    head = _read_head(uploaded_file)
    if head.startswith(_EXECUTABLE_MAGIC) or _is_windows_program(head):
        _reject(field, "This file is a program or script, which can't be uploaded.")
    expected = _SIGNATURES.get(extension)
    if expected and not head.startswith(expected):
        _reject(field, f"This file's contents don't match its .{extension} extension.")
    if head.startswith(_ZIP) and _zip_holds_macros(uploaded_file):
        _reject(field, "Files containing macros can't be uploaded. Save it without macros and try again.")

    content_type = _detected_type(head, extension)
    if not content_type:
        # Pinned where the OS registry disagrees (Windows maps .csv to Excel).
        guessed = {"csv": "text/csv", "txt": "text/plain"}.get(extension) or mimetypes.guess_type(name)[0] or ""
        # Markup can carry scripts, so it is only ever labelled as what it is.
        if _looks_like_markup(head):
            content_type = "image/svg+xml" if extension == "svg" else ("text/xml" if head.lstrip().startswith(b"<?xml") and extension == "xml" else "text/html")
        elif guessed and not guessed.startswith(("application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp")):
            content_type = guessed
        else:
            content_type = "application/octet-stream"
    if allowed_types is not None and content_type not in allowed_types:
        _reject(field, allowed_message or "This type of file isn't accepted here.")
    _scan(uploaded_file, field, name)
    return name, content_type[:150]
