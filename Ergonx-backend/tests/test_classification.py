"""Data classification: the catalogue, Restricted documents and labelled exports."""
import pytest
from django.apps import apps
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.documents.models import Document
from apps.institutions.models import InstitutionModule, Permission
from apps.institutions.services import PERMISSIONS, PRIVILEGED_PERMISSIONS, ROLE_PERMISSION_CODES
from common.classification import DATA_CATALOGUE, RANK, RESTRICTED, highest

PDF = b"%PDF-1.4 test"


def test_catalogue_names_real_fields_permissions_and_levels():
    keys = [category.key for category in DATA_CATALOGUE]
    assert len(keys) == len(set(keys))
    for category in DATA_CATALOGUE:
        assert category.level in RANK, category.key
        for field in category.fields:
            app_label, model, name = field.split(".")
            apps.get_model(app_label, model)._meta.get_field(name)  # raises if renamed or removed
        for code in category.access:
            assert code in PERMISSIONS, (category.key, code)
    # The most sensitive data stays Restricted.
    levels = {category.key: category.level for category in DATA_CATALOGUE}
    for key in ("tax_and_bank", "salaries", "payroll_results", "complaints", "talent_potential", "credentials"):
        assert levels[key] == RESTRICTED


def test_highest_level():
    assert highest("INTERNAL", "RESTRICTED", "CONFIDENTIAL") == "RESTRICTED"
    assert highest() == "INTERNAL" and highest("", None) == "INTERNAL"


def test_view_restricted_is_privileged_and_held_by_admins_only():
    assert "document.view_restricted" in PRIVILEGED_PERMISSIONS
    holders = {role for role, codes in ROLE_PERMISSION_CODES.items() if "document.view_restricted" in codes}
    assert holders == {"INSTITUTION_ADMIN", "HR_ADMIN"}


@pytest.fixture
def people(api_client, institution_factory, user_factory, membership_factory):
    institution = institution_factory(code="CLS")
    admin = user_factory()
    membership_factory(user=admin, institution=institution, role_code="INSTITUTION_ADMIN", is_primary=True)
    clerk = user_factory()
    clerk_membership = membership_factory(user=clerk, institution=institution, role_code="HR_ADMIN", is_primary=True)
    # A records clerk: document access, but not Restricted documents.
    clerk_membership.role.permissions.remove(Permission.objects.get(code="document.view_restricted"))
    return {"client": api_client, "institution": institution, "admin": admin, "clerk": clerk}


def _as(client, user, institution):
    client.force_authenticate(user)
    client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))


def _upload(client, name, classification):
    return client.post("/api/v1/documents/", {"uploaded_file": SimpleUploadedFile(name, PDF), "category": "HR", "classification": classification}, format="multipart")


@pytest.mark.django_db
def test_restricted_documents_are_hidden_without_the_permission(people):
    client, institution = people["client"], people["institution"]
    _as(client, people["admin"], institution)
    secret = _upload(client, "investigation.pdf", "RESTRICTED")
    assert secret.status_code == 201, secret.data
    ordinary = _upload(client, "handbook.pdf", "CONFIDENTIAL").data

    _as(client, people["clerk"], institution)
    listed = {row["id"] for row in client.get("/api/v1/documents/").data["results"]}
    assert listed == {ordinary["id"]}
    assert client.get(f"/api/v1/documents/{secret.data['id']}/").status_code == 404
    assert client.get(f"/api/v1/documents/{secret.data['id']}/download/").status_code == 404
    # The clerk can neither create Restricted documents nor reclassify into or out of Restricted.
    assert _upload(client, "mine.pdf", "RESTRICTED").status_code == 400
    raised = client.patch(f"/api/v1/documents/{ordinary['id']}/", {"classification": "RESTRICTED"}, format="json")
    assert raised.status_code == 400 and "Restricted" in raised.data["message"]
    assert client.patch(f"/api/v1/documents/{ordinary['id']}/", {"classification": "INTERNAL"}, format="json").status_code == 200

    _as(client, people["admin"], institution)
    lowered = client.patch(f"/api/v1/documents/{secret.data['id']}/", {"classification": "CONFIDENTIAL"}, format="json")
    assert lowered.status_code == 200
    from apps.audit.models import AuditLog

    event = AuditLog.objects.filter(action="document.classification_changed", entity_id=secret.data["id"]).get()
    assert event.metadata["changes"]["classification"] == ["RESTRICTED", "CONFIDENTIAL"]


@pytest.mark.django_db
def test_restricted_documents_never_appear_in_search(people):
    from apps.institutions.search import _document_results

    institution = people["institution"]
    for name, level in (("payroll-letter.pdf", "RESTRICTED"), ("payroll-guide.pdf", "INTERNAL")):
        Document.objects.create(institution=institution, original_filename=name, content_type="application/pdf", size_bytes=1, classification=level, is_active=True)
    assert [row["title"] for row in _document_results(institution, "payroll", 10)] == ["payroll-guide.pdf"]


@pytest.mark.django_db
def test_catalogue_endpoint_and_labelled_exports(people):
    client, institution = people["client"], people["institution"]
    _as(client, people["admin"], institution)
    catalogue = client.get("/api/v1/privacy/data-catalogue/")
    assert catalogue.status_code == 200
    rows = {row["key"]: row for row in catalogue.data["categories"]}
    assert rows["salaries"]["level"] == "RESTRICTED" and rows["credentials"]["access"] == []
    assert rows["employee_directory"]["records"] == 0
    assert [level["code"] for level in catalogue.data["levels"]] == ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]

    InstitutionModule.objects.filter(institution=institution, module_code__in=("REPORTS", "PAYROLL", "LEAVE")).update(is_enabled=True)
    pdf = client.get("/api/v1/reports/payroll/?export=pdf")
    assert pdf.status_code == 200 and pdf["X-Data-Classification"] == "RESTRICTED"
    xlsx = client.get("/api/v1/reports/leave/?export=xlsx")
    assert xlsx["X-Data-Classification"] == "CONFIDENTIAL"
    from io import BytesIO

    from openpyxl import load_workbook

    workbook = load_workbook(BytesIO(xlsx.content))
    assert workbook.properties.keywords == "Classification: CONFIDENTIAL"
