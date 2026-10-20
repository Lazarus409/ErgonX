import pytest
from django.core.files.base import ContentFile
from django.core.management import CommandError, call_command

from apps.accounts.platform import file_storage_usage
from apps.filestore.models import StoredFile
from apps.filestore.storage import DatabaseStorage

pytestmark = pytest.mark.django_db


def test_moves_database_files_to_a_disk_keeping_names(tmp_path):
    storage = DatabaseStorage()
    storage.save("documents/2026/10/contract.pdf", ContentFile(b"%PDF-1 contract"))
    storage.save("images/logo.png", ContentFile(b"\x89PNG logo"))

    call_command("move_media", to="filesystem", media_root=str(tmp_path), dry_run=True)
    assert not (tmp_path / "documents").exists()

    call_command("move_media", to="filesystem", media_root=str(tmp_path))
    assert (tmp_path / "documents/2026/10/contract.pdf").read_bytes() == b"%PDF-1 contract"
    assert (tmp_path / "images/logo.png").read_bytes() == b"\x89PNG logo"
    assert StoredFile.objects.count() == 2  # kept unless asked

    # Re-running skips what is already there, and can then clear the database copies.
    call_command("move_media", to="filesystem", media_root=str(tmp_path), delete_copied=True)
    assert StoredFile.objects.count() == 0


def test_a_different_file_at_the_destination_is_a_conflict(tmp_path):
    DatabaseStorage().save("documents/a.txt", ContentFile(b"database version"))
    (tmp_path / "documents").mkdir()
    (tmp_path / "documents/a.txt").write_bytes(b"other")

    with pytest.raises(CommandError, match="1 file"):
        call_command("move_media", to="filesystem", media_root=str(tmp_path), delete_copied=True)
    assert StoredFile.objects.count() == 1


def test_platform_overview_reports_database_file_usage():
    DatabaseStorage().save("documents/b.txt", ContentFile(b"12345"))

    usage = file_storage_usage()

    assert (usage["database_files"], usage["database_bytes"], usage["warning"]) == (1, 5, False)
