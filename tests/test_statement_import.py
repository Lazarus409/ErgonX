"""Bank statement import (W7): the layouts banks actually export."""
from datetime import date
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.accounting.statement_import import parse_amount, parse_date, parse_statement
from tests.test_bank_reconciliation_sessions import banking  # noqa: F401 - fixture


def test_plain_layout_is_unchanged():
    rows, errors, _ = parse_statement("date,description,reference,amount\n2026-01-20,Supplier payment,PAY-WS,-40.00\nbad,row,,x\n")
    assert [(row["date"], row["amount"], row["reference"]) for row in rows] == [(date(2026, 1, 20), Decimal("-40.00"), "PAY-WS")]
    assert len(errors) == 1 and "Row 3" in errors[0]


def test_bank_portal_export_with_title_rows_and_debit_credit_columns():
    content = (
        "﻿Example Bank Ghana PLC,,,,,\n"
        "Account Statement,,,,,\n"
        "Account No: ****5678,,Period: 01/01/2026 - 31/01/2026,,,\n"
        ",,,,,\n"
        "Transaction Date,Value Date,Narration,Cheque No,Debit,Credit,Balance\n"
        "01/01/2026,01/01/2026,Opening Balance,,,,\"1,000.00\"\n"
        "20/01/2026,20/01/2026,TRF TO SUPPLIER,PAY-WS,40.00,,960.00\n"
        "22-Jan-2026,22-Jan-2026,CUSTOMER DEPOSIT,DEP-1,,\"1,250.50\",\"2,210.50\"\n"
        "25/01/2026,25/01/2026,SMS ALERT CHARGES,,GHS 5.00,,\"2,205.50\"\n"
        "31/01/2026,31/01/2026,Closing Balance,,,,\"2,205.50\"\n"
    )
    rows, errors, columns = parse_statement(content)
    assert errors == []
    assert columns["date"] == 0  # Transaction Date wins over Value Date.
    assert [(row["date"], row["amount"]) for row in rows] == [
        (date(2026, 1, 20), Decimal("-40.00")),
        (date(2026, 1, 22), Decimal("1250.50")),
        (date(2026, 1, 25), Decimal("-5.00")),
    ]
    assert rows[0]["description"] == "TRF TO SUPPLIER" and rows[0]["reference"] == "PAY-WS"


def test_semicolon_file_with_dr_cr_indicator():
    content = "Date;Details;Reference;Amount;Dr/Cr\n05.02.2026;POS PURCHASE;R1;120,00;D\n06.02.2026;REFUND;R2;20.00;C\n"
    rows, errors, _ = parse_statement(content.replace("120,00", "120.00"))
    assert errors == []
    assert [row["amount"] for row in rows] == [Decimal("-120.00"), Decimal("20.00")]


@pytest.mark.parametrize("value, expected", [
    ("2026-01-31", date(2026, 1, 31)), ("31/01/2026", date(2026, 1, 31)), ("31-01-26", date(2026, 1, 31)),
    ("31-Jan-2026", date(2026, 1, 31)), ("31 January 2026", date(2026, 1, 31)), ("31/01/2026 14:05", date(2026, 1, 31)),
    ("2026-01-31T09:00:00", date(2026, 1, 31)),
])
def test_dates(value, expected):
    assert parse_date(value) == expected


@pytest.mark.parametrize("value, expected", [
    ("1,250.50", Decimal("1250.50")), ("(40.00)", Decimal("-40.00")), ("40.00 DR", Decimal("-40.00")), ("40.00CR", Decimal("40.00")),
    ("GH₵ 5.00", Decimal("5.00")), ("-5", Decimal("-5")), ("", None),
])
def test_amounts(value, expected):
    assert parse_amount(value) == expected


def test_file_without_a_header_is_rejected():
    with pytest.raises(ValueError):
        parse_statement("hello,world\n1,2\n")


@pytest.mark.django_db
def test_import_api_accepts_a_bank_export_and_skips_reimports(api_client, banking):  # noqa: F811
    api_client.force_authenticate(banking["actor"])
    api_client.credentials(HTTP_X_INSTITUTION_ID=str(banking["institution"].id))
    created = api_client.post("/api/v1/bank-reconciliations/", {"bank_account": str(banking["bank"].id), "period_start": "2026-01-01", "period_end": "2026-01-31"}, format="json")
    base = f"/api/v1/bank-reconciliations/{created.json()['data']['session']['id']}/"
    content = (
        "Example Bank Ghana PLC\n\nTransaction Date,Narration,Cheque No,Debit,Credit,Balance\n"
        "20/01/2026,TRF TO SUPPLIER,PAY-WS,40.00,,960.00\n25/01/2026,SMS ALERT CHARGES,CHG,5.00,,955.00\n"
    ).encode("utf-8-sig")

    def upload():
        return api_client.post(base + "import/", {"file": SimpleUploadedFile("statement.csv", content, content_type="text/csv")}, format="multipart")

    first = upload().json()["data"]
    assert first["import_result"] == {"created": 2, "skipped": 0, "errors": []}
    payment_line = next(row for row in first["lines"] if row["reference"] == "PAY-WS")
    assert payment_line["suggestion_count"] == 1  # The -40.00 line still finds the supplier payment.
    assert upload().json()["data"]["import_result"]["skipped"] == 2

    bad = api_client.post(base + "import/", {"file": SimpleUploadedFile("statement.csv", b"hello,world\n", content_type="text/csv")}, format="multipart")
    assert bad.status_code == 400
