import csv
import io
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import Workbook

from apps.audit.models import AuditLog
from apps.compensation.models import EmployeeCompensation, SalaryStructure
from apps.employees.models import Employee, Employment
from apps.operations.employee_import import COLUMN_NAMES
from apps.operations.models import ImportJob, ImportRowResult
from apps.organization.models import Department, Grade, Location, Position
from apps.payroll.models import EmployeePayrollProfile

pytestmark = pytest.mark.django_db

UPLOAD = "/api/v1/import-jobs/employee-upload/"


@pytest.fixture
def setup(api_client, institution_factory, user_factory, membership_factory):
    institution = institution_factory()
    hr = user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN", is_primary=True)
    finance = Department.objects.create(institution=institution, name="Finance", code="FIN")
    operations = Department.objects.create(institution=institution, name="Operations", code="OPS")
    Position.objects.create(institution=institution, department=finance, title="Accountant", code="ACC")
    Position.objects.create(institution=institution, department=operations, title="Driver", code="DRV")
    Grade.objects.create(institution=institution, name="Grade 5", code="G5")
    Location.objects.create(institution=institution, name="Head Office", code="HQ")
    SalaryStructure.objects.create(institution=institution, name="Standard", code="STD")
    api_client.force_authenticate(hr)
    return {"institution": institution, "hr": hr, "client": api_client}


def _csv(*rows, columns=COLUMN_NAMES):
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columns)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return SimpleUploadedFile("staff.csv", buffer.getvalue().encode("utf-8"), content_type="text/csv")


def _row(**overrides):
    row = {
        "first_name": "Kofi", "last_name": "Boateng", "work_email": "kofi@example.org", "gender": "male",
        "hire_date": "02/11/2026", "department": "finance", "position": "Accountant", "grade": "G5",
        "location": "Head Office", "base_salary": "4,500.00", "tax_identification_number": "P0001112223",
    }
    row.update(overrides)
    return row


def test_template_lists_every_column(setup):
    response = setup["client"].get("/api/v1/import-jobs/employee-template/")

    assert response.status_code == 200
    header = response.content.decode("utf-8-sig").splitlines()[0]
    assert header.split(",") == list(COLUMN_NAMES)


def test_upload_validates_then_confirm_creates_employee_employment_pay_and_tin(setup):
    client = setup["client"]

    upload = client.post(UPLOAD, {"file": _csv(_row(), _row(first_name="Abena", last_name="Owusu", work_email="abena@example.org", employee_number="ap-77"))}, format="multipart")

    assert upload.status_code == 201, upload.data
    job = ImportJob.objects.get(pk=upload.data["id"])
    assert (job.status, job.total_rows, job.valid_rows, job.invalid_rows) == ("READY", 2, 2, 0)
    assert not Employee.objects.filter(institution=setup["institution"]).exists()

    confirm = client.post(f"/api/v1/import-jobs/{job.id}/confirm/")

    assert confirm.status_code == 200, confirm.data
    assert confirm.data["status"] == "COMPLETED"
    kofi = Employee.objects.get(institution=setup["institution"], work_email="kofi@example.org")
    assert kofi.employee_number  # generated
    assert kofi.gender == "MALE"
    assert str(kofi.hire_date) == "2026-11-02"  # DD/MM/YYYY
    employment = Employment.objects.get(employee=kofi)
    assert (employment.department.code, employment.position.code, employment.is_current) == ("FIN", "ACC", True)
    compensation = EmployeeCompensation.objects.get(employee=kofi)
    assert (compensation.base_salary, compensation.salary_structure.code, str(compensation.effective_from)) == (Decimal("4500.00"), "STD", "2026-11-02")
    assert EmployeePayrollProfile.objects.get(employee=kofi).tax_identification_number == "P0001112223"
    assert Employee.objects.filter(institution=setup["institution"], employee_number="AP-77").exists()
    assert AuditLog.objects.filter(action="employee.created", metadata__source="import").count() == 2
    assert AuditLog.objects.filter(action="import_job.committed", entity_id=job.id).exists()


def test_row_errors_are_reported_and_invalid_rows_are_skipped(setup, employee_factory):
    employee_factory(setup["institution"], employee_number="EMP-1", work_email="taken@example.org")
    rows = [
        _row(),
        _row(first_name="", work_email="nofirst@example.org"),
        _row(work_email="taken@example.org"),
        _row(work_email="kofi@example.org"),  # duplicate inside the file
        _row(work_email="x@example.org", position="Driver"),  # Driver is in Operations
        _row(work_email="y@example.org", hire_date="2026-13-40", grade="Nope"),
        _row(work_email="z@example.org", base_salary="-5"),
    ]

    upload = setup["client"].post(UPLOAD, {"file": _csv(*rows)}, format="multipart")

    assert upload.status_code == 201
    results = {row.row_number: row for row in ImportRowResult.objects.filter(import_job_id=upload.data["id"])}
    assert results[2].status == "VALID"
    assert results[3].errors == ["first_name is required."]
    assert results[4].errors == ["An employee with work email taken@example.org already exists."]
    assert results[5].errors == ["Work email kofi@example.org appears more than once in the file."]
    assert results[6].errors == ["Position 'Driver' is not in the Finance department."]
    assert results[7].errors == ["hire_date '2026-13-40' is not a date; use YYYY-MM-DD or DD/MM/YYYY.", "No grade called 'Nope'."]
    assert results[8].errors == ["base_salary '-5' must be a positive amount."]
    assert upload.data["valid_rows"] == 1 and upload.data["invalid_rows"] == 6

    confirm = setup["client"].post(f"/api/v1/import-jobs/{upload.data['id']}/confirm/")

    assert confirm.data["valid_rows"] == 1
    assert Employee.objects.filter(institution=setup["institution"]).count() == 2


def test_xlsx_upload_with_date_cells(setup):
    from datetime import datetime

    book = Workbook()
    sheet = book.active
    sheet.append(list(COLUMN_NAMES))
    row = _row(hire_date=None)
    sheet.append([datetime(2026, 11, 2) if name == "hire_date" else row.get(name, "") for name in COLUMN_NAMES])
    buffer = io.BytesIO()
    book.save(buffer)
    upload_file = SimpleUploadedFile("staff.xlsx", buffer.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    upload = setup["client"].post(UPLOAD, {"file": upload_file}, format="multipart")

    assert upload.status_code == 201, upload.data
    assert upload.data["valid_rows"] == 1
    row_result = ImportRowResult.objects.get(import_job_id=upload.data["id"])
    assert row_result.normalized_data["hire_date"] == "2026-11-02"


def test_template_example_row_is_rejected(setup):
    example = {"first_name": "Ama", "last_name": "Mensah", "work_email": "ama.mensah@example.com", "hire_date": "2026-11-02",
               "department": "Finance", "position": "Accountant", "grade": "G5", "location": "HQ"}

    upload = setup["client"].post(UPLOAD, {"file": _csv(example)}, format="multipart")

    assert upload.data["status"] == "FAILED"
    assert ImportRowResult.objects.get(import_job_id=upload.data["id"]).errors == ["This is the template's example row. Delete it before importing."]


def test_missing_required_column_is_rejected_before_any_job(setup):
    upload = setup["client"].post(UPLOAD, {"file": _csv({"first_name": "A"}, columns=("first_name",))}, format="multipart")

    assert upload.status_code == 400
    assert "Missing required column(s): last_name, hire_date" in str(upload.data)
    assert not ImportJob.objects.exists()


def test_employee_created_between_upload_and_confirm_is_skipped(setup, employee_factory):
    upload = setup["client"].post(UPLOAD, {"file": _csv(_row())}, format="multipart")
    employee_factory(setup["institution"], employee_number="EMP-9", work_email="kofi@example.org")

    confirm = setup["client"].post(f"/api/v1/import-jobs/{upload.data['id']}/confirm/")

    assert confirm.data["status"] == "COMPLETED"
    assert confirm.data["valid_rows"] == 0
    assert ImportRowResult.objects.get(import_job_id=upload.data["id"]).status == "SKIPPED"


def test_roles_without_import_permission_cannot_upload(api_client, setup, user_factory, membership_factory):
    auditor = user_factory()
    membership_factory(user=auditor, institution=setup["institution"], role_code="AUDITOR", is_primary=True)
    api_client.force_authenticate(auditor)

    response = api_client.post(UPLOAD, {"file": _csv(_row())}, format="multipart")

    assert response.status_code == 403
    assert not ImportJob.objects.exists()
