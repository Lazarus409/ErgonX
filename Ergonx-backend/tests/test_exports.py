"""CSV, Excel and PDF downloads share one renderer (common/exports.py)."""
import io
from datetime import date
from decimal import Decimal

import pytest
from openpyxl import load_workbook

from common.exports import columns_from_rows, render_csv, render_pdf, render_xlsx
from tests.test_report_builder import setup  # noqa: F401  (shared fixture)

pytestmark = pytest.mark.django_db

ROWS = [
    {"name": "=HYPERLINK(\"http://evil\")", "amount": Decimal("-12.50"), "joined": date(2026, 1, 5), "note": "@SUM(A1)"},
    {"name": "Kwame Mensah", "amount": "1200.00", "joined": None, "note": "-1+2"},
]


def test_csv_neutralizes_formulas_but_keeps_negative_numbers():
    text = render_csv(columns_from_rows(ROWS), ROWS).decode("utf-8-sig")
    lines = text.splitlines()
    assert lines[0] == "Name,Amount,Joined,Note"
    assert lines[1].startswith("\"'=HYPERLINK")
    assert ",-12.50,2026-01-05,'@SUM(A1)" in lines[1]
    assert lines[2].endswith(",'-1+2")


def test_xlsx_stores_text_never_formulas_and_numbers_as_numbers():
    workbook = load_workbook(io.BytesIO(render_xlsx(columns_from_rows(ROWS), ROWS, title="Payroll: Nov/2026")))
    sheet = workbook.active
    assert sheet.title == "Payroll- Nov-2026"
    assert [cell.value for cell in sheet[1]] == ["Name", "Amount", "Joined", "Note"]
    assert sheet["A2"].data_type == "s" and sheet["A2"].value.startswith("=HYPERLINK")
    assert sheet["B2"].value == -12.5 and sheet["B3"].value == 1200
    assert sheet["C2"].value.date() == date(2026, 1, 5)


def test_pdf_renders_rows_and_empty_tables():
    pdf = render_pdf(columns_from_rows(ROWS), ROWS, title="Payroll", institution_name="Apex")
    assert pdf.startswith(b"%PDF") and len(pdf) > 1000
    assert render_pdf([], [], title="Empty").startswith(b"%PDF")
    assert render_pdf([("a", "A")], [], title="No rows").startswith(b"%PDF")


@pytest.mark.parametrize("fmt, content_type, magic", [
    ("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", b"PK"),
    ("pdf", "application/pdf", b"%PDF"),
])
def test_builder_and_saved_reports_export_every_format(setup, fmt, content_type, magic):  # noqa: F811
    client = setup["client"]
    response = client.post("/api/v1/report-builder/run/", {"dataset": "employees", "definition": {"columns": ["employee_number", "department"]}, "format": fmt}, format="json")
    assert response.status_code == 200
    assert response["Content-Type"] == content_type and response.content.startswith(magic)
    assert response["Content-Disposition"] == f'attachment; filename="Employees.{fmt}"'
    saved = client.post("/api/v1/custom-reports/", {"name": "Team / list", "description": "", "dataset": "employees", "definition": {"columns": ["employee_name"]}, "visibility": "PRIVATE"}, format="json")
    assert saved.status_code == 201, saved.data
    run = client.get(f"/api/v1/custom-reports/{saved.data['id']}/run/?export={fmt}")
    assert run.status_code == 200 and run.content.startswith(magic)
    assert run["Content-Disposition"] == f'attachment; filename="Team - list.{fmt}"'


@pytest.mark.parametrize("fmt, magic", [("csv", b"\xef\xbb\xbf"), ("xlsx", b"PK"), ("pdf", b"%PDF")])
def test_standard_report_exports_every_format(setup, fmt, magic):  # noqa: F811
    from apps.institutions.models import InstitutionModule

    InstitutionModule.objects.filter(institution=setup["institution"], module_code="REPORTS").update(is_enabled=True)
    response = setup["client"].get(f"/api/v1/reports/leave/?export={fmt}&status=APPROVED")
    assert response.status_code == 200, getattr(response, "data", None)
    assert response.content.startswith(magic)
    assert response["Content-Disposition"] == f'attachment; filename="leave.{fmt}"'
