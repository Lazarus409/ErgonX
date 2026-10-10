"""Uploaded-file storage: S3-compatible bucket or folder, and restoring lost demo files."""

from io import StringIO
from pathlib import Path

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management import call_command
from django.test import override_settings

from apps.documents.models import Document
from config.settings.storage import media_storage_settings


def test_folder_storage_by_default_and_on_a_persistent_disk():
    storages, root, kind = media_storage_settings({}, Path("/app"))
    assert kind == "filesystem" and storages["default"]["BACKEND"].endswith("FileSystemStorage") and root.endswith("media")
    _, root, _ = media_storage_settings({"MEDIA_ROOT": "/var/data/media"}, Path("/app"))
    assert root == "/var/data/media"


def test_s3_compatible_bucket_for_cloudflare_r2():
    environ = {
        "MEDIA_STORAGE": "s3", "MEDIA_S3_BUCKET": "ergonx-media", "MEDIA_S3_ACCESS_KEY_ID": "key", "MEDIA_S3_SECRET_ACCESS_KEY": "secret",
        "MEDIA_S3_ENDPOINT_URL": "https://account.r2.cloudflarestorage.com", "MEDIA_S3_REGION": "auto",
    }
    storages, _, kind = media_storage_settings(environ, Path("/app"))
    options = storages["default"]["OPTIONS"]
    assert kind == "s3" and storages["default"]["BACKEND"] == "storages.backends.s3.S3Storage"
    assert options["bucket_name"] == "ergonx-media" and options["endpoint_url"].endswith("r2.cloudflarestorage.com")
    assert options["default_acl"] is None and options["file_overwrite"] is False and options["location"] == "media"
    from storages.backends.s3 import S3Storage

    storage = S3Storage(**options)  # Builds without contacting the bucket.
    assert storage.bucket_name == "ergonx-media"


def test_s3_without_credentials_fails_at_startup():
    with pytest.raises(ImproperlyConfigured, match="MEDIA_S3_ACCESS_KEY_ID"):
        media_storage_settings({"MEDIA_STORAGE": "s3", "MEDIA_S3_BUCKET": "b"}, Path("/app"))


@pytest.mark.django_db
def test_restore_demo_files_reports_and_restores_only_the_demo(institution_factory, settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    demo = institution_factory(code="APEX-DEMO")
    other = institution_factory(code="REAL-ORG")
    rows = []
    for institution in (demo, other):
        document = Document(institution=institution, original_filename="contract.pdf", content_type="application/pdf", size_bytes=13, category="CONTRACT", is_active=True)
        document.stored_file.save("documents/2026/10/contract.pdf", ContentFile(b"%PDF original"), save=False)
        document.save()
        rows.append(document)
    for document in rows:
        default_storage.delete(document.stored_file.name)  # Lost in a redeploy.

    report = StringIO()
    call_command("restore_demo_files", stdout=report)
    assert "APEX-DEMO: 1 file(s) missing" in report.getvalue() and "REAL-ORG: 1 file(s) missing" in report.getvalue()
    assert not default_storage.exists(rows[0].stored_file.name)

    with override_settings(DEBUG=True):
        output = StringIO()
        call_command("restore_demo_files", restore=True, stdout=output)
    rows[0].refresh_from_db()
    assert default_storage.exists(rows[0].stored_file.name)
    assert default_storage.open(rows[0].stored_file.name).read().startswith(b"%PDF")
    assert not default_storage.exists(rows[1].stored_file.name)
    assert "cannot be recreated" in output.getvalue()


@pytest.mark.django_db
def test_uploads_round_trip_through_an_s3_bucket(api_client, institution_factory, user_factory, membership_factory, employee_factory):
    """A complaint file goes into the bucket on upload and comes back on download through the API."""
    moto = pytest.importorskip("moto")
    import boto3

    environ = {"MEDIA_STORAGE": "s3", "MEDIA_S3_BUCKET": "ergonx-test-media", "MEDIA_S3_ACCESS_KEY_ID": "testing", "MEDIA_S3_SECRET_ACCESS_KEY": "testing", "MEDIA_S3_REGION": "us-east-1"}
    storages, _, _ = media_storage_settings(environ, Path("/app"))
    with moto.mock_aws(), override_settings(STORAGES=storages):
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket="ergonx-test-media")
        institution = institution_factory()
        user = user_factory(email="s3.staff@example.com")
        membership_factory(user=user, institution=institution, role_code="EMPLOYEE")
        employee_factory(institution, user=user)
        api_client.force_authenticate(user)
        complaint = api_client.post("/api/v1/complaints/", {"category": "OTHER", "subject": "Bucket test", "description": "Checking storage."}, format="json").data
        from django.core.files.uploadedfile import SimpleUploadedFile

        uploaded = api_client.post(f"/api/v1/complaints/{complaint['id']}/attachments/", {"file": SimpleUploadedFile("photo.png", b"PNG-bytes", content_type="image/png")}, format="multipart")
        assert uploaded.status_code == 200, uploaded.data
        keys = [item["Key"] for item in s3.list_objects_v2(Bucket="ergonx-test-media")["Contents"]]
        assert len(keys) == 1 and keys[0].startswith("media/complaints/")
        attachment = uploaded.data["attachments"][0]
        download = api_client.get(f"/api/v1/complaints/{complaint['id']}/attachments/{attachment['id']}/download/")
        assert download.status_code == 200 and b"".join(download.streaming_content) == b"PNG-bytes"


DATABASE_STORAGES = media_storage_settings({"MEDIA_STORAGE": "database"}, Path("/app"))[0]


def test_database_storage_is_selectable():
    storages, _, kind = media_storage_settings({"MEDIA_STORAGE": "database"}, Path("/app"))
    assert kind == "database" and storages["default"]["BACKEND"] == "apps.filestore.storage.DatabaseStorage"


@pytest.mark.django_db
def test_database_storage_saves_reads_and_never_overwrites():
    from apps.filestore.models import StoredFile
    from apps.filestore.storage import DatabaseStorage

    storage = DatabaseStorage()
    name = storage.save("documents/2026/10/contract.pdf", ContentFile(b"%PDF one"))
    assert name == "documents/2026/10/contract.pdf" and storage.exists(name) and storage.size(name) == 8
    assert storage.open(name).read() == b"%PDF one"
    second = storage.save("documents/2026/10/contract.pdf", ContentFile(b"%PDF two"))
    assert second != name and storage.open(second).read() == b"%PDF two"
    assert storage.listdir("documents/2026/10") == ([], sorted([name.rsplit("/", 1)[1], second.rsplit("/", 1)[1]]))
    storage.delete(name)
    assert not storage.exists(name) and StoredFile.objects.count() == 1
    with pytest.raises(FileNotFoundError):
        storage.open(name)


@pytest.mark.django_db
def test_uploads_round_trip_through_the_database(api_client, institution_factory, user_factory, membership_factory, employee_factory):
    """A complaint file is stored as a database row and downloads through the API."""
    from django.core.files.uploadedfile import SimpleUploadedFile

    from apps.filestore.models import StoredFile

    with override_settings(STORAGES=DATABASE_STORAGES):
        institution = institution_factory()
        user = user_factory(email="db.staff@example.com")
        membership_factory(user=user, institution=institution, role_code="EMPLOYEE")
        employee_factory(institution, user=user)
        api_client.force_authenticate(user)
        complaint = api_client.post("/api/v1/complaints/", {"category": "OTHER", "subject": "Database test", "description": "Checking storage."}, format="json").data
        uploaded = api_client.post(f"/api/v1/complaints/{complaint['id']}/attachments/", {"file": SimpleUploadedFile("photo.png", b"PNG-bytes", content_type="image/png")}, format="multipart")
        assert uploaded.status_code == 200, uploaded.data
        row = StoredFile.objects.get()
        assert row.name.startswith("complaints/") and bytes(row.content) == b"PNG-bytes"
        attachment = uploaded.data["attachments"][0]
        download = api_client.get(f"/api/v1/complaints/{complaint['id']}/attachments/{attachment['id']}/download/")
        assert download.status_code == 200 and b"".join(download.streaming_content) == b"PNG-bytes"


@pytest.mark.django_db
def test_restore_demo_files_writes_into_the_database(institution_factory):
    from apps.filestore.models import StoredFile

    demo = institution_factory(code="APEX-DEMO")
    # A row whose file was lost with the old container disk.
    Document.objects.create(institution=demo, original_filename="ssnit.pdf", content_type="application/pdf", size_bytes=10, category="SSNIT", stored_file="apex-demo/EMP-000101-ssnit.pdf", is_active=True)
    with override_settings(STORAGES=DATABASE_STORAGES, DEBUG=True):
        call_command("restore_demo_files", restore=True, stdout=StringIO())
    assert bytes(StoredFile.objects.get(name="apex-demo/EMP-000101-ssnit.pdf").content).startswith(b"%PDF")
