"""Bulk employee import: a template, CSV/XLSX upload with row-by-row validation, then commit.

Upload validates every row and stores the outcome as ImportRowResults on a READY job, so
HR can review errors before anything is created. Confirming commits the valid rows in the
request (production runs no background worker) through the same services the New
employee form uses: employee, current employment, and optional compensation and tax ID.
"""

import csv
import io
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.audit.services import record_audit_event
from apps.compensation.models import SalaryStructure
from apps.compensation.services import change_current_compensation
from apps.employees.models import Employee, Employment
from apps.employees.services import create_employment
from apps.institutions.models import InstitutionMembership
from apps.institutions.services import effective_permission_codes
from apps.operations.models import ImportJob, ImportRowResult
from apps.organization.models import Department, Grade, Location, Position
from apps.payroll.models import EmployeePayrollProfile
from common.exceptions import CodedValidationError

FORMAT = "EMPLOYEE_V2"
MAX_ROWS = 1000
MAX_FILE_BYTES = 2 * 1024 * 1024

# (column, required, help shown in the template's second row)
COLUMNS = (
    ("employee_number", False, "Leave blank to generate one"),
    ("first_name", True, "Required"),
    ("middle_name", False, ""),
    ("last_name", True, "Required"),
    ("work_email", False, "Also used for the self-service invitation"),
    ("personal_email", False, ""),
    ("phone", False, ""),
    ("gender", False, "Male, Female, Other or blank"),
    ("date_of_birth", False, "YYYY-MM-DD or DD/MM/YYYY"),
    ("hire_date", True, "Required. YYYY-MM-DD or DD/MM/YYYY"),
    ("department", True, "Required. Name or code of an existing department"),
    ("position", True, "Required. Title or code of a position in that department"),
    ("grade", True, "Required. Name or code of an existing grade"),
    ("location", True, "Required. Name or code of an existing location"),
    ("employment_type", False, "Permanent (default), Contract, Temporary, Intern or Casual"),
    ("base_salary", False, "Pay per payroll period, e.g. 4500.00"),
    ("salary_structure", False, "Name or code; optional when only one structure exists"),
    ("tax_identification_number", False, "TIN / Ghana Card number"),
    ("tax_residency", False, "Resident (default) or Non-resident"),
)
COLUMN_NAMES = tuple(name for name, _, _ in COLUMNS)
EXAMPLE = {
    "first_name": "Ama", "last_name": "Mensah", "work_email": "ama.mensah@example.com", "phone": "+233200000000",
    "gender": "Female", "date_of_birth": "1992-04-18", "hire_date": "2026-11-02", "department": "Finance",
    "position": "Accountant", "grade": "G5", "location": "Head Office", "employment_type": "Permanent",
    "base_salary": "4500.00", "tax_identification_number": "GHA-123456789-0",
}
GENDERS = {"male": "MALE", "m": "MALE", "female": "FEMALE", "f": "FEMALE", "other": "OTHER", "": "PREFER_NOT_TO_SAY",
           "prefer not to say": "PREFER_NOT_TO_SAY"}
RESIDENCY = {"": "RESIDENT", "resident": "RESIDENT", "non-resident": "NON_RESIDENT", "non resident": "NON_RESIDENT",
             "nonresident": "NON_RESIDENT", "non_resident": "NON_RESIDENT"}
DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%d %b %Y", "%d %B %Y")


def template_csv():
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(COLUMN_NAMES)
    writer.writerow([EXAMPLE.get(name, "") for name in COLUMN_NAMES])
    return "﻿" + buffer.getvalue()  # BOM so Excel opens it as UTF-8


def _key(value):
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower()).strip("_")


def _cell_text(value):
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def read_rows(filename, content):
    """(header, rows) as lists of strings, from a CSV or XLSX upload."""
    if len(content) > MAX_FILE_BYTES:
        raise ValidationError({"file": "The file is larger than 2 MB. Split it into smaller files."})
    if filename.lower().endswith(".xlsx"):
        from openpyxl import load_workbook

        try:
            sheet = load_workbook(io.BytesIO(content), read_only=True, data_only=True).worksheets[0]
        except Exception as exc:  # noqa: BLE001 - any unreadable workbook is a user error
            raise ValidationError({"file": "The Excel file could not be read. Save it again as .xlsx or CSV."}) from exc
        table = [[_cell_text(value) for value in row] for row in sheet.iter_rows(values_only=True)]
    elif filename.lower().endswith((".csv", ".txt")):
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = content.decode("cp1252")  # Excel's default "CSV" encoding on Windows
        try:
            dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t")
        except csv.Error:
            dialect = csv.excel
        table = [[cell.strip() for cell in row] for row in csv.reader(io.StringIO(text), dialect)]
    else:
        raise ValidationError({"file": "Upload a .csv or .xlsx file."})
    table = [row for row in table if any(cell for cell in row)]
    if not table:
        raise ValidationError({"file": "The file is empty."})
    header = [_key(cell) for cell in table[0]]
    missing = [name for name, required, _ in COLUMNS if required and name not in header]
    if missing:
        raise ValidationError({"file": f"Missing required column(s): {', '.join(missing)}. Start from the template."})
    rows = table[1:]
    if not rows:
        raise ValidationError({"file": "The file has a header but no employee rows."})
    if len(rows) > MAX_ROWS:
        raise ValidationError({"file": f"The file has {len(rows)} rows; import at most {MAX_ROWS} at a time."})
    return header, rows


def parse_date(text):
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise ValueError(text)


class _Lookups:
    """Case-insensitive name/code lookups for one institution, loaded once per file."""

    def __init__(self, institution):
        def index(rows, *fields):
            found = {}
            for row in rows:
                for field in fields:
                    value = (getattr(row, field) or "").strip().lower()
                    if value:
                        found.setdefault(value, []).append(row)
            return found

        self.departments = index(Department.objects.for_institution(institution), "name", "code")
        self.positions = list(Position.objects.for_institution(institution).filter(is_active=True))
        self.grades = index(Grade.objects.for_institution(institution).filter(is_active=True), "name", "code")
        self.locations = index(Location.objects.for_institution(institution).filter(is_active=True), "name", "code")
        self.structures = list(SalaryStructure.objects.for_institution(institution).filter(is_active=True))
        self.structure_index = index(self.structures, "name", "code")
        self.numbers = set(Employee.objects.for_institution(institution).values_list("employee_number", flat=True))
        self.emails = {
            email.lower()
            for email in Employee.objects.for_institution(institution).exclude(work_email="").values_list("work_email", flat=True)
        }

    @staticmethod
    def one(index, value, label):
        matches = index.get(value.strip().lower(), [])
        if not matches:
            raise ValueError(f"No {label} called '{value}'.")
        if len(matches) > 1 and len({match.pk for match in matches}) > 1:
            raise ValueError(f"More than one {label} matches '{value}'; use its code.")
        return matches[0]

    def position(self, value, department):
        wanted = value.strip().lower()
        matches = [row for row in self.positions if wanted in ((row.title or "").lower(), (row.code or "").lower())]
        in_department = [row for row in matches if row.department_id == department.id]
        if in_department:
            return in_department[0]
        if matches:
            raise ValueError(f"Position '{value}' is not in the {department.name} department.")
        raise ValueError(f"No position called '{value}'.")


def _validate_row(values, lookups, seen_numbers, seen_emails, currency):
    errors = []
    data = {}
    if all(values.get(name, "").strip() == EXAMPLE[name] for name in ("first_name", "last_name", "work_email")):
        return {}, ["This is the template's example row. Delete it before importing."]

    def text(name, limit=None):
        value = values.get(name, "").strip()
        if limit and len(value) > limit:
            errors.append(f"{name} is longer than {limit} characters.")
        return value

    for name in ("first_name", "last_name"):
        data[name] = text(name, 100)
        if not data[name]:
            errors.append(f"{name} is required.")
    data["middle_name"] = text("middle_name", 100)
    data["phone"] = text("phone", 30)

    number = text("employee_number", 50).upper()
    if number:
        if number in lookups.numbers:
            errors.append(f"Employee number {number} already exists.")
        elif number in seen_numbers:
            errors.append(f"Employee number {number} appears more than once in the file.")
        seen_numbers.add(number)
    data["employee_number"] = number

    for name in ("work_email", "personal_email"):
        email = text(name, 254).lower()
        if email:
            try:
                validate_email(email)
            except ValidationError:
                errors.append(f"{name} '{email}' is not a valid email address.")
        data[name] = email
    if data["work_email"]:
        if data["work_email"] in lookups.emails:
            errors.append(f"An employee with work email {data['work_email']} already exists.")
        elif data["work_email"] in seen_emails:
            errors.append(f"Work email {data['work_email']} appears more than once in the file.")
        seen_emails.add(data["work_email"])

    gender = GENDERS.get(text("gender").lower())
    if gender is None:
        errors.append("gender must be Male, Female, Other or blank.")
    data["gender"] = gender or "PREFER_NOT_TO_SAY"

    for name, required in (("date_of_birth", False), ("hire_date", True)):
        raw = text(name)
        data[name] = None
        if not raw:
            if required:
                errors.append(f"{name} is required.")
            continue
        try:
            data[name] = parse_date(raw).isoformat()
        except ValueError:
            errors.append(f"{name} '{raw}' is not a date; use YYYY-MM-DD or DD/MM/YYYY.")
    if data["date_of_birth"] and data["hire_date"] and data["date_of_birth"] >= data["hire_date"]:
        errors.append("date_of_birth must be before hire_date.")

    department = None
    for name, label, index in (("department", "department", lookups.departments), ("grade", "grade", lookups.grades), ("location", "location", lookups.locations)):
        raw = text(name)
        if not raw:
            errors.append(f"{name} is required.")
            continue
        try:
            row = lookups.one(index, raw, label)
        except ValueError as exc:
            errors.append(str(exc))
            continue
        data[f"{name}_id"] = str(row.pk)
        if name == "department":
            department = row
    raw_position = text("position")
    if not raw_position:
        errors.append("position is required.")
    elif department is not None:
        try:
            data["position_id"] = str(lookups.position(raw_position, department).pk)
        except ValueError as exc:
            errors.append(str(exc))

    employment_type = text("employment_type").upper().replace(" ", "_") or Employment.EmploymentType.PERMANENT
    if employment_type not in Employment.EmploymentType.values:
        errors.append("employment_type must be Permanent, Contract, Temporary, Intern or Casual.")
    data["employment_type"] = employment_type

    raw_salary = text("base_salary").replace(",", "")
    raw_structure = text("salary_structure")
    data["base_salary"] = None
    if raw_salary:
        try:
            salary = Decimal(raw_salary)
            if not salary.is_finite() or salary <= 0:
                raise InvalidOperation
            data["base_salary"] = str(salary.quantize(Decimal("0.01")))
            data["currency"] = currency
        except InvalidOperation:
            errors.append(f"base_salary '{raw_salary}' must be a positive amount.")
        if raw_structure:
            try:
                data["salary_structure_id"] = str(lookups.one(lookups.structure_index, raw_structure, "salary structure").pk)
            except ValueError as exc:
                errors.append(str(exc))
        elif len(lookups.structures) == 1:
            data["salary_structure_id"] = str(lookups.structures[0].pk)
        else:
            errors.append("salary_structure is required when base_salary is given" + (
                " (there are several salary structures)." if lookups.structures else "; create a salary structure first."
            ))
    elif raw_structure:
        errors.append("salary_structure was given without a base_salary.")

    data["tax_identification_number"] = text("tax_identification_number", 80)
    residency = RESIDENCY.get(text("tax_residency").lower())
    if residency is None:
        errors.append("tax_residency must be Resident or Non-resident.")
    data["tax_residency"] = residency or "RESIDENT"
    return data, errors


def _require(actor, institution, codes):
    membership = InstitutionMembership.objects.filter(user=actor, institution=institution).select_related("role").first()
    granted = set(effective_permission_codes(membership))
    missing = [code for code in codes if code not in granted]
    if missing:
        raise CodedValidationError(
            {"permission": f"Importing employees needs the {', '.join(missing)} permission."},
            api_code="permission_denied",
        )


@transaction.atomic
def validate_employee_import(*, institution, actor, filename, content):
    _require(actor, institution, ("import_job.create", "employee.create"))
    header, rows = read_rows(filename, content)
    configuration = getattr(institution, "payroll_configuration", None)
    currency = configuration.currency if configuration else institution.default_currency
    lookups = _Lookups(institution)
    seen_numbers, seen_emails = set(), set()
    job = ImportJob(
        institution=institution,
        import_type="EMPLOYEE",
        file_reference=filename[:500],
        initiated_by=actor,
        status=ImportJob.Status.VALIDATING,
        metadata={"format": FORMAT, "filename": filename, "ignored_columns": [name for name in header if name and name not in COLUMN_NAMES]},
    )
    job.full_clean()
    job.save()
    results = []
    for offset, row in enumerate(rows):
        values = {name: (row[position] if position < len(row) else "") for position, name in enumerate(header) if name in COLUMN_NAMES}
        data, errors = _validate_row(values, lookups, seen_numbers, seen_emails, currency)
        results.append(ImportRowResult(
            institution=institution,
            import_job=job,
            row_number=offset + 2,  # spreadsheet row, after the header
            status=ImportRowResult.Status.INVALID if errors else ImportRowResult.Status.VALID,
            raw_data=values,
            normalized_data=data,
            errors=errors,
        ))
    ImportRowResult.objects.bulk_create(results)
    job.total_rows = len(results)
    job.invalid_rows = sum(1 for result in results if result.errors)
    job.valid_rows = job.total_rows - job.invalid_rows
    if any(result.normalized_data.get("base_salary") for result in results) and "compensation.manage" not in set(
        effective_permission_codes(InstitutionMembership.objects.filter(user=actor, institution=institution).first())
    ):
        job.metadata["salary_warning"] = "You cannot set pay; salaries in this file will be ignored."
    job.status = ImportJob.Status.READY if job.valid_rows else ImportJob.Status.FAILED
    if not job.valid_rows:
        job.error_summary = "No row is valid. Fix the errors and upload the file again."
    elif job.invalid_rows:
        job.error_summary = f"{job.invalid_rows} row(s) have errors and will be skipped."
    job.save(update_fields=("total_rows", "valid_rows", "invalid_rows", "status", "error_summary", "metadata", "updated_at"))
    record_audit_event(
        actor=actor, institution=institution, entity=job, action="import_job.validated",
        metadata={"import_type": "EMPLOYEE", "total_rows": job.total_rows, "valid_rows": job.valid_rows},
    )
    return job


def _create_employee(institution, actor, data, can_set_pay):
    employee = Employee(
        institution=institution,
        employee_number=data["employee_number"],
        first_name=data["first_name"],
        middle_name=data["middle_name"],
        last_name=data["last_name"],
        work_email=data["work_email"],
        personal_email=data["personal_email"],
        phone=data["phone"],
        gender=data["gender"],
        date_of_birth=date.fromisoformat(data["date_of_birth"]) if data["date_of_birth"] else None,
        hire_date=date.fromisoformat(data["hire_date"]),
    )
    employee.full_clean()
    employee.save()
    create_employment(
        institution=institution,
        employee=employee,
        department=Department.objects.for_institution(institution).get(pk=data["department_id"]),
        position=Position.objects.for_institution(institution).get(pk=data["position_id"]),
        grade=Grade.objects.for_institution(institution).get(pk=data["grade_id"]),
        location=Location.objects.for_institution(institution).get(pk=data["location_id"]),
        employment_type=data["employment_type"],
        start_date=employee.hire_date,
        is_current=True,
    )
    if data["base_salary"] and can_set_pay:
        change_current_compensation(
            institution=institution,
            employee=employee,
            salary_structure=SalaryStructure.objects.for_institution(institution).get(pk=data["salary_structure_id"]),
            base_salary=Decimal(data["base_salary"]),
            currency=data["currency"],
            effective_from=employee.hire_date,
            actor=actor,
        )
    if data["tax_identification_number"]:
        EmployeePayrollProfile.objects.create(
            institution=institution,
            employee=employee,
            tax_residency=data["tax_residency"],
            tax_identification_number=data["tax_identification_number"],
        )
    return employee


@transaction.atomic
def commit_employee_rows(*, import_job, actor):
    job = ImportJob.objects.select_for_update().get(pk=import_job.pk)
    if job.import_type != "EMPLOYEE" or job.metadata.get("format") != FORMAT:
        raise CodedValidationError({"import_job": "This import was not created by an employee file upload."}, api_code="invalid_state_transition")
    if job.status != ImportJob.Status.READY:
        raise CodedValidationError({"status": "Only validated import jobs can be confirmed."}, api_code="invalid_state_transition")
    _require(actor, job.institution, ("import_job.create", "employee.create"))
    membership = InstitutionMembership.objects.filter(user=actor, institution=job.institution).first()
    can_set_pay = "compensation.manage" in set(effective_permission_codes(membership))
    job.status = ImportJob.Status.COMMITTING
    job.confirmed_at = timezone.now()
    job.save(update_fields=("status", "confirmed_at", "updated_at"))
    # Re-check uniqueness at commit: another upload or a manual hire may have landed since.
    lookups = _Lookups(job.institution)
    imported = skipped = 0
    for row in job.row_results.select_for_update().filter(status=ImportRowResult.Status.VALID).order_by("row_number"):
        data = row.normalized_data
        conflict = None
        if data["employee_number"] and data["employee_number"] in lookups.numbers:
            conflict = f"Employee number {data['employee_number']} already exists."
        elif data["work_email"] and data["work_email"] in lookups.emails:
            conflict = f"An employee with work email {data['work_email']} already exists."
        if conflict is None:
            try:
                with transaction.atomic():
                    employee = _create_employee(job.institution, actor, data, can_set_pay)
            except (ValidationError, Department.DoesNotExist, Position.DoesNotExist, Grade.DoesNotExist,
                    Location.DoesNotExist, SalaryStructure.DoesNotExist) as exc:
                conflict = "; ".join(exc.messages) if isinstance(exc, ValidationError) else "A referenced record no longer exists."
        if conflict:
            row.status = ImportRowResult.Status.SKIPPED
            row.errors = [conflict]
            row.save(update_fields=("status", "errors", "updated_at"))
            skipped += 1
            continue
        lookups.numbers.add(employee.employee_number)
        if employee.work_email:
            lookups.emails.add(employee.work_email.lower())
        record_audit_event(
            actor=actor, institution=job.institution, entity=employee, action="employee.created",
            metadata={"source": "import", "import_job_id": str(job.id), "row_number": row.row_number},
        )
        row.status = ImportRowResult.Status.IMPORTED
        row.normalized_data = {**data, "employee_id": str(employee.id), "employee_number": employee.employee_number}
        row.save(update_fields=("status", "normalized_data", "updated_at"))
        imported += 1
    job.status = ImportJob.Status.COMPLETED
    job.completed_at = timezone.now()
    job.valid_rows = imported
    job.invalid_rows = skipped + job.row_results.filter(status=ImportRowResult.Status.INVALID).count()
    job.error_summary = f"{job.invalid_rows} row(s) were not imported." if job.invalid_rows else ""
    job.save(update_fields=("status", "completed_at", "valid_rows", "invalid_rows", "error_summary", "updated_at"))
    record_audit_event(
        actor=actor, institution=job.institution, entity=job, action="import_job.committed",
        metadata={"import_type": "EMPLOYEE", "imported": imported, "skipped": skipped},
    )
    return job
