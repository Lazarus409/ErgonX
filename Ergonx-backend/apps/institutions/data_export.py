"""A complete export of one organisation's data, for handover, leaving ErgonX or moving server.

The ZIP holds one JSON file per table (every model that belongs to an organisation, in
Django's serialisation format), the organisation's members, the uploaded files themselves,
and a manifest with record counts and the schema version. Secrets are blanked: invitation
and access-token hashes, API key hashes and webhook signing secrets. Passwords and
two-step sign-in secrets are never included.

There is no automatic import: the files are for reading, archiving, or loading into another
ErgonX server by an operator with the same schema version.
"""

import json
import re
import tempfile
import zipfile

from django.apps import apps
from django.core import serializers
from django.db import models
from django.db.migrations.recorder import MigrationRecorder
from django.utils import timezone

from apps.audit.services import record_audit_event
from apps.institutions.models import Institution

SECRET_FIELD = re.compile(r"(secret|password|token_hash|key_hash)", re.I)


def organisation_models():
    """Every model with an ``institution`` foreign key, sorted by label."""
    found = []
    for model in apps.get_models():
        try:
            field = model._meta.get_field("institution")
        except Exception:  # noqa: BLE001 - models without the field are skipped
            continue
        if field.is_relation and field.related_model is Institution:
            found.append(model)
    return sorted(found, key=lambda model: model._meta.label)


def _rows(model, institution):
    queryset = model._default_manager.filter(institution=institution).order_by("pk")
    data = json.loads(serializers.serialize("json", queryset))
    secret_fields = [field.name for field in model._meta.concrete_fields if SECRET_FIELD.search(field.name)]
    for row in data:
        for name in secret_fields:
            if name in row["fields"]:
                row["fields"][name] = "" if row["fields"][name] is not None else None
    return data


def _members(institution):
    rows = []
    for membership in institution.memberships.select_related("user", "role").order_by("created_at"):
        user = membership.user
        rows.append({
            "user_id": str(user.id), "email": user.email, "first_name": user.first_name, "last_name": user.last_name,
            "role": membership.role.code, "status": membership.status, "is_primary": membership.is_primary,
            "joined_at": membership.created_at.isoformat(), "last_login": user.last_login.isoformat() if user.last_login else None,
        })
    return rows


def _file_fields(model):
    return [field for field in model._meta.concrete_fields if isinstance(field, models.FileField)]


def build_organisation_export(institution, *, actor, include_files=True):
    """Write the export to a temporary file and return ``(file, filename)``; the caller streams and closes it."""
    handle = tempfile.TemporaryFile()
    counts, files_written, missing = {}, 0, []
    with zipfile.ZipFile(handle, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("organisation.json", serializers.serialize("json", [institution], indent=2))
        archive.writestr("members.json", json.dumps(_members(institution), indent=2))
        for model in organisation_models():
            rows = _rows(model, institution)
            if not rows:
                continue
            counts[model._meta.label] = len(rows)
            archive.writestr(f"data/{model._meta.label}.json", json.dumps(rows, indent=1, default=str))
            if not include_files:
                continue
            for field in _file_fields(model):
                for record in model._default_manager.filter(institution=institution).exclude(**{field.name: ""}).exclude(**{f"{field.name}__isnull": True}):
                    stored = getattr(record, field.name)
                    try:
                        with stored.open("rb") as source:
                            archive.writestr(f"files/{stored.name}", source.read())
                        files_written += 1
                    except Exception:  # noqa: BLE001 - a lost file is listed, not fatal
                        missing.append(stored.name)
        latest = {}
        for app_label, name in MigrationRecorder.Migration.objects.order_by("applied").values_list("app", "name"):
            latest[app_label] = name
        archive.writestr("manifest.json", json.dumps({
            "format": "ergonx-organisation-export/1",
            "generated_at": timezone.now().isoformat(),
            "organisation": {"id": str(institution.id), "code": institution.code, "name": institution.name},
            "record_counts": counts,
            "records_total": sum(counts.values()),
            "files_included": files_written,
            "files_missing": missing,
            "secrets_removed": "Invitation and access-token hashes, API key hashes and webhook secrets are blank. Passwords and two-step sign-in secrets are not exported.",
            "schema": latest,
        }, indent=2))
    handle.seek(0)
    record_audit_event(
        actor=actor, institution=institution, entity=institution, action="institution.data_exported",
        metadata={"records": sum(counts.values()), "tables": len(counts), "files": files_written, "include_files": include_files},
    )
    stamp = timezone.localtime().strftime("%Y%m%d-%H%M")
    return handle, f"ergonx-{institution.code.lower()}-export-{stamp}.zip"
