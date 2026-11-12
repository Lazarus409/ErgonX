"""Render a table of rows as a downloadable CSV, Excel or PDF file.

Every tabular download in ErgonX goes through ``table_response`` so the three formats
always hold the same columns and rows, and every file is protected the same way.
"""

import csv
import io
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from xml.sax.saxutils import escape

from django.http import HttpResponse
from django.utils import timezone

FORMATS = ("csv", "xlsx", "pdf")
CONTENT_TYPES = {
    "csv": "text/csv; charset=utf-8",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}

# A spreadsheet treats a cell starting with one of these as a formula, so a value
# typed by a user (a name, a description) could run when the file is opened.
_FORMULA_START = ("=", "+", "-", "@", "\t", "\r")
_NUMBER = re.compile(r"^-?\d+(\.\d+)?$")


def humanize(key):
    return str(key).replace("_", " ").strip().capitalize()


def columns_from_rows(rows):
    """``[(key, label)]`` for every key that appears in ``rows``, in first-seen order."""
    keys = list(dict.fromkeys(key for row in rows for key in row))
    return [(key, humanize(key)) for key in keys]


def safe_filename(name, default="export"):
    slug = re.sub(r"[^A-Za-z0-9._ -]+", "-", str(name or "")).strip(" .-")[:80]
    return slug or default


def _text(value):
    if value is None:
        return ""
    if isinstance(value, datetime):
        return timezone.localtime(value).strftime("%Y-%m-%d %H:%M") if timezone.is_aware(value) else value.strftime("%Y-%m-%d %H:%M")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, bool):
        return "Yes" if value else "No"
    return str(value)


def _neutralize(text):
    """Stop spreadsheet formula injection, but leave plain negative numbers alone."""
    if text and text.startswith(_FORMULA_START) and not _NUMBER.match(text):
        return "'" + text
    return text


def _is_number_or_blank(value):
    if value is None or value == "":
        return True
    if isinstance(value, bool):
        return False
    return isinstance(value, (int, float, Decimal)) or bool(_NUMBER.match(str(value)))


def render_csv(columns, rows):
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    # A report with no rows still gets a header line, so the file is never blank.
    writer.writerow([label for _, label in columns] or ["empty"])
    for row in rows:
        writer.writerow([_neutralize(_text(row.get(key))) for key, _ in columns])
    # The byte-order mark lets Excel open UTF-8 names (e.g. "Ɔ", "é") correctly.
    return ("﻿" + buffer.getvalue()).encode("utf-8")


def _xlsx_value(value):
    if value is None:
        return None
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return timezone.localtime(value).replace(tzinfo=None) if timezone.is_aware(value) else value
    if isinstance(value, date):
        return value
    text = str(value)
    if _NUMBER.match(text) and len(text) < 16:
        try:
            return float(Decimal(text)) if "." in text else int(text)
        except (InvalidOperation, ValueError):
            return text
    return text


def render_xlsx(columns, rows, *, title, classification=""):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    from openpyxl.utils import get_column_letter

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = re.sub(r"[\[\]:*?/\\]", "-", title)[:31] or "Report"
    sheet.append([label for _, label in columns])
    for cell in sheet[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="0B192C")
    widths = [len(label) for _, label in columns]
    for row in rows:
        values = [_xlsx_value(row.get(key)) for key, _ in columns]
        sheet.append(values)
        cells = sheet[sheet.max_row]
        for index, (cell, value) in enumerate(zip(cells, values)):
            if isinstance(value, str):
                # Strings are always stored as text, never as formulas.
                cell.data_type = "s"
            elif isinstance(value, datetime):
                cell.number_format = "yyyy-mm-dd hh:mm"
            elif isinstance(value, date):
                cell.number_format = "yyyy-mm-dd"
            widths[index] = max(widths[index], len(_text(value)))
    for index, width in enumerate(widths, start=1):
        sheet.column_dimensions[get_column_letter(index)].width = min(max(width + 2, 10), 60)
    sheet.freeze_panes = "A2"
    if classification:
        # Printed on every page, and visible in the file's properties.
        label = classification.upper()
        sheet.oddHeader.right.text = label
        sheet.oddFooter.right.text = label
        workbook.properties.keywords = f"Classification: {label}"
        workbook.properties.subject = f"{title} ({label})"
    if columns:
        sheet.auto_filter.ref = sheet.dimensions
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def render_pdf(columns, rows, *, title, institution_name="", subtitle="", classification=""):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import LongTable, Paragraph, SimpleDocTemplate, Spacer, TableStyle

    navy = colors.HexColor("#0b192c")
    muted = colors.HexColor("#64748b")
    line = colors.HexColor("#e2e8f0")
    soft = colors.HexColor("#f8fafc")

    pagesize = landscape(A4) if len(columns) > 5 else A4
    buffer = io.BytesIO()
    margin = 14 * mm
    generated = timezone.localtime().strftime("%d %b %Y, %H:%M")

    label = classification.upper()

    def footer(canvas, document):
        canvas.saveState()
        if label:
            canvas.setFont("Helvetica-Bold", 8)
            canvas.setFillColor(colors.HexColor("#b91c1c") if label == "RESTRICTED" else navy)
            canvas.drawRightString(pagesize[0] - margin, pagesize[1] - 9 * mm, label)
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(muted)
        left = f"{institution_name} · {title}" if institution_name else title
        canvas.drawString(margin, 8 * mm, f"{left} · Generated {generated}"[:150])
        canvas.drawRightString(pagesize[0] - margin, 8 * mm, f"Page {document.page}")
        canvas.restoreState()

    document = SimpleDocTemplate(
        buffer, pagesize=pagesize, leftMargin=margin, rightMargin=margin, topMargin=margin, bottomMargin=16 * mm,
        title=title, author=institution_name or "ErgonX", creator="ErgonX", subject=label or "",
    )
    styles = getSampleStyleSheet()
    heading = ParagraphStyle("ExportTitle", parent=styles["Title"], alignment=0, fontSize=15, leading=19, textColor=navy, spaceAfter=2)
    meta = ParagraphStyle("ExportMeta", parent=styles["Normal"], fontSize=8.5, leading=11, textColor=muted)
    cell_style = ParagraphStyle("ExportCell", parent=styles["Normal"], fontSize=7.5, leading=9.5)
    head_style = ParagraphStyle("ExportHead", parent=cell_style, fontName="Helvetica-Bold", textColor=colors.white)
    number_style = ParagraphStyle("ExportNumber", parent=cell_style, alignment=2)

    numeric = [bool(rows) and all(_is_number_or_blank(row.get(key)) for row in rows) for key, _ in columns]
    story = []
    if institution_name:
        story.append(Paragraph(escape(institution_name), meta))
    story.append(Paragraph(escape(title), heading))
    details = [f"{len(rows)} row{'' if len(rows) == 1 else 's'}", f"Generated {generated}"]
    if subtitle:
        details.insert(0, subtitle)
    story.append(Paragraph(escape(" · ".join(details)), meta))
    story.append(Spacer(1, 5 * mm))

    if not columns:
        story.append(Paragraph("No records match this report.", meta))
    else:
        data = [[Paragraph(escape(label), head_style) for _, label in columns]]
        for row in rows:
            data.append([
                Paragraph(escape(_text(row.get(key))), number_style if numeric[index] else cell_style)
                for index, (key, _) in enumerate(columns)
            ])
        if not rows:
            data.append([Paragraph("No records match this report.", meta)] + [""] * (len(columns) - 1))
        width = pagesize[0] - 2 * margin
        table = LongTable(data, colWidths=[width / len(columns)] * len(columns), repeatRows=1)
        style = [
            ("BACKGROUND", (0, 0), (-1, 0), navy),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, line),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]
        style += [("BACKGROUND", (0, index), (-1, index), soft) for index in range(2, len(data), 2)]
        if not rows:
            style.append(("SPAN", (0, 1), (-1, 1)))
        table.setStyle(TableStyle(style))
        story.append(table)
    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()


def render_table(fmt, *, title, columns, rows, institution_name="", subtitle="", classification=""):
    """Return the file bytes for ``rows`` in ``fmt`` (csv, xlsx or pdf)."""
    if fmt == "xlsx":
        return render_xlsx(columns, rows, title=title, classification=classification)
    if fmt == "pdf":
        return render_pdf(columns, rows, title=title, institution_name=institution_name, subtitle=subtitle, classification=classification)
    return render_csv(columns, rows)


def table_response(fmt, *, filename, title, columns, rows, institution=None, subtitle="", classification=""):
    """An attachment response holding ``rows`` as CSV, Excel or PDF, labelled with ``classification``."""
    if fmt not in FORMATS:
        fmt = "csv"
    content = render_table(
        fmt, title=title, columns=columns, rows=rows,
        institution_name=getattr(institution, "name", "") or "", subtitle=subtitle, classification=classification,
    )
    response = HttpResponse(content, content_type=CONTENT_TYPES[fmt])
    response["Content-Disposition"] = f'attachment; filename="{safe_filename(filename)}.{fmt}"'
    if classification:
        response["X-Data-Classification"] = classification.upper()
    return response
