"""Bank statement files as banks actually export them (W7).

``parse_statement`` turns a CSV export into rows of ``date``, ``description``,
``reference``, ``amount`` (positive = money in) and ``external_id``. Besides the
plain ``date,description,reference,amount`` layout it accepts what Ghanaian and
other bank portals produce:

* title rows (bank name, account, period) above the column header;
* header names such as "Transaction Date", "Narration", "Cheque No";
* separate Debit/Credit (or Withdrawals/Deposits) columns instead of one amount,
  or one amount with a DR/CR indicator column;
* day-first dates (31/01/2026, 31-01-26, 31-Jan-2026) as well as ISO dates;
* amounts with currency marks, thousands separators, "(40.00)", "40.00 DR";
* comma, semicolon or tab separators;
* opening/closing balance rows, which are skipped.

The file must still decode as UTF-8 text; spreadsheets are saved as CSV first.
"""

import csv
import io
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation

# Header aliases, checked in order: the first alias present wins for each field.
FIELD_ALIASES = {
    "date": ("date", "transaction date", "txn date", "trans date", "tran date", "posting date", "post date", "booking date", "value date"),
    "description": ("description", "narration", "narrative", "details", "transaction details", "particulars", "remarks", "memo", "transaction description"),
    "reference": ("reference", "ref", "ref no", "reference no", "reference number", "cheque no", "cheque number", "chq no", "document no", "instrument no"),
    "amount": ("amount", "transaction amount", "amount (ghs)", "amount ghs"),
    "debit": ("debit", "debits", "debit amount", "withdrawal", "withdrawals", "dr", "money out", "paid out"),
    "credit": ("credit", "credits", "credit amount", "deposit", "deposits", "lodgement", "lodgements", "cr", "money in", "paid in"),
    # An "amount" column whose sign is given separately ("DR"/"CR", "D"/"C", "Debit"/"Credit").
    "direction": ("dr/cr", "cr/dr", "d/c", "debit/credit", "type", "transaction type", "dr cr", "indicator"),
    "external_id": ("external_id", "external id", "transaction id", "transaction reference", "txn id", "trn id"),
}
DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%d/%m/%y", "%d-%m-%y", "%d-%b-%Y", "%d-%b-%y", "%d %b %Y", "%d %B %Y", "%d/%b/%Y", "%Y/%m/%d")
BALANCE_ROW = re.compile(r"^(opening|closing|brought forward|carried forward|balance b/?f|balance c/?f|b/?f|c/?f)\b", re.IGNORECASE)
HEADER_SCAN_ROWS = 25


def _key(name):
    return re.sub(r"\s+", " ", (name or "").replace("_", " ").replace("﻿", "")).strip().lower().rstrip(".:")


def _columns(header):
    """``{field: column index}`` for a candidate header row, or None if it is not one."""
    keys = [_key(cell) for cell in header]
    columns = {}
    for field, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            alias_key = _key(alias)
            if alias_key in keys:
                columns[field] = keys.index(alias_key)
                break
    if "date" not in columns or not ("amount" in columns or "debit" in columns or "credit" in columns):
        return None
    return columns


def parse_date(value):
    text = re.sub(r"\s+", " ", (value or "").strip())
    text = text.split("T")[0] if re.match(r"^\d{4}-\d{2}-\d{2}T", text) else text
    text = re.sub(r" \d{1,2}:\d{2}(:\d{2})?( ?[AP]M)?$", "", text, flags=re.IGNORECASE)
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise ValueError(text)


def parse_amount(value):
    """A signed Decimal, or None for an empty cell."""
    text = (value or "").strip()
    if not text or text in {"-", "--"}:
        return None
    negative = False
    upper = text.upper()
    if upper.endswith("DR"):
        negative, text = True, text[:-2]
    elif upper.endswith("CR"):
        text = text[:-2]
    text = text.strip()
    if text.startswith("(") and text.endswith(")"):
        negative, text = True, text[1:-1]
    text = re.sub(r"(?i)ghs|gh₵|₵|usd|\$|eur|€|gbp|£", "", text).replace(",", "").replace(" ", "").replace(" ", "")
    if text.startswith("-"):
        negative, text = not negative, text[1:]
    try:
        amount = Decimal(text)
    except InvalidOperation:
        raise ValueError(value)
    return -amount if negative else amount


def _dialect(content):
    sample = content[:4096]
    try:
        return csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        return csv.excel


def parse_statement(content):
    """``(rows, errors, columns)``; raises ValueError when no header row is found."""
    reader = list(csv.reader(io.StringIO(content), _dialect(content)))
    header_index, columns = None, None
    for index, row in enumerate(reader[:HEADER_SCAN_ROWS]):
        columns = _columns(row)
        if columns:
            header_index = index
            break
    if columns is None:
        raise ValueError("no header")

    def cell(row, field):
        position = columns.get(field)
        return row[position].strip() if position is not None and position < len(row) else ""

    rows, errors = [], []
    for offset, raw in enumerate(reader[header_index + 1:], start=header_index + 2):
        if not any((value or "").strip() for value in raw):
            continue
        description = cell(raw, "description")
        if BALANCE_ROW.match(description) or BALANCE_ROW.match(cell(raw, "date")):
            continue
        try:
            statement_date = parse_date(cell(raw, "date"))
        except ValueError:
            errors.append(f"Row {offset}: the date '{cell(raw, 'date')}' is not recognised (use YYYY-MM-DD or DD/MM/YYYY).")
            continue
        try:
            if "amount" in columns:
                amount = parse_amount(cell(raw, "amount"))
                if amount is not None and cell(raw, "direction").upper().startswith("D"):
                    amount = -abs(amount)
            else:
                debit, credit = parse_amount(cell(raw, "debit")), parse_amount(cell(raw, "credit"))
                amount = None if debit is None and credit is None else (credit or Decimal("0")) - abs(debit or Decimal("0"))
        except ValueError:
            errors.append(f"Row {offset}: the amount is not a number.")
            continue
        if amount is None or amount == 0:
            errors.append(f"Row {offset}: amount cannot be empty or zero.")
            continue
        rows.append({
            "row": offset,
            "date": statement_date,
            "description": description,
            "reference": cell(raw, "reference"),
            "amount": amount,
            "external_id": cell(raw, "external_id"),
        })
    return rows, errors, columns
