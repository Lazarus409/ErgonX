"""Printable PDF rendering of a finalized payslip.

The PDF is drawn from the same immutable payload the payslip checksum covers, so a
download always matches what the employee sees on screen.
"""

from decimal import Decimal
from io import BytesIO

from django.db.models import Q
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from xml.sax.saxutils import escape

from apps.documents.models import ImageAsset
from apps.employees.models import Employment
from apps.payroll.models import EmployeePayrollProfile
from apps.payroll.services import payslip_payload

NAVY = colors.HexColor("#0b192c")
MUTED = colors.HexColor("#64748b")
LINE = colors.HexColor("#e2e8f0")
SOFT = colors.HexColor("#f8fafc")

GROUPS = (
    ("Earnings", ("EARNING",)),
    ("Deductions", ("DEDUCTION", "EMPLOYEE_CONTRIBUTION")),
    ("Employer contributions (not deducted from pay)", ("EMPLOYER_CONTRIBUTION",)),
)


def money(value, currency):
    return f"{currency} {Decimal(value):,.2f}"


def payslip_filename(payslip):
    record = payslip.payroll_record
    number = record.employee.employee_number or "employee"
    period = record.payroll_run.payroll_period.name
    slug = "".join(ch if ch.isalnum() else "-" for ch in f"{number}-{period}").strip("-")
    return f"payslip-{slug}.pdf".lower()


def _employment_for_period(employee, period):
    """The employment that covered the pay period, falling back to the current one."""
    covering = (
        Employment.objects.filter(employee=employee, start_date__lte=period.end_date)
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=period.start_date))
        .select_related("department", "position")
        .order_by("-start_date")
        .first()
    )
    if covering:
        return covering
    return (
        Employment.objects.filter(employee=employee, is_current=True)
        .select_related("department", "position")
        .first()
    )


def _logo(institution):
    """The institution logo as a flowable, or None when absent or not a PNG/JPEG."""
    image = ImageAsset.objects.filter(
        institution=institution,
        owner_type=ImageAsset.OwnerType.INSTITUTION,
        owner_id=institution.id,
        is_active=True,
    ).first()
    if image is None or image.content_type not in ("image/png", "image/jpeg"):
        return None
    try:
        with image.stored_file.open("rb") as handle:
            data = BytesIO(handle.read())
        logo = Image(data)
        scale = min(40 * mm / logo.imageWidth, 16 * mm / logo.imageHeight)
        logo.drawWidth = logo.imageWidth * scale
        logo.drawHeight = logo.imageHeight * scale
        logo.hAlign = "LEFT"
        return logo
    except Exception:  # noqa: BLE001 - a broken logo must never block a payslip download
        return None


def render_payslip_pdf(payslip):
    record = payslip.payroll_record
    run = record.payroll_run
    period = run.payroll_period
    institution = payslip.institution
    employee = record.employee
    payload = payslip_payload(record)
    currency = payload["currency"]
    employment = _employment_for_period(employee, period)

    styles = getSampleStyleSheet()
    base = ParagraphStyle("base", parent=styles["Normal"], fontName="Helvetica", fontSize=9.5, leading=13)
    small = ParagraphStyle("small", parent=base, fontSize=8, leading=11, textColor=MUTED)
    label = ParagraphStyle("label", parent=small, fontName="Helvetica-Bold")
    title = ParagraphStyle("title", parent=base, fontName="Helvetica-Bold", fontSize=16, leading=20, textColor=NAVY)
    heading = ParagraphStyle("heading", parent=base, fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=NAVY)
    right = ParagraphStyle("right", parent=base, alignment=TA_RIGHT)

    def p(text, style=base):
        return Paragraph(escape(str(text)), style)

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"Payslip - {period.name}",
        author=institution.name,
        subject=f"Payslip for {employee.full_name}",
    )
    width = doc.width
    story = []

    org_lines = [Paragraph(f"<b>{escape(institution.name)}</b>", heading)]
    for line in (institution.address, " · ".join(filter(None, (institution.phone, institution.email)))):
        if line:
            org_lines.append(p(line.replace("\n", ", "), small))
    logo = _logo(institution)
    header_left = [logo, Spacer(1, 3 * mm), *org_lines] if logo else org_lines
    header_right = [
        Paragraph("PAYSLIP", ParagraphStyle("tag", parent=title, alignment=TA_RIGHT)),
        p(period.name, right),
        p(f"Pay date: {period.pay_date:%d %b %Y}", ParagraphStyle("r2", parent=small, alignment=TA_RIGHT)),
    ]
    header = Table([[header_left, header_right]], colWidths=[width * 0.6, width * 0.4])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, 0), 1.2, NAVY),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story += [header, Spacer(1, 6 * mm)]

    details = [
        ("Employee", employee.full_name),
        ("Employee number", employee.employee_number or "—"),
        ("Department", employment.department.name if employment else "—"),
        ("Position", employment.position.title if employment else "—"),
        ("Pay period", f"{period.start_date:%d %b %Y} – {period.end_date:%d %b %Y}"),
        ("Currency", currency),
    ]
    profile = EmployeePayrollProfile.objects.filter(employee=employee).first()
    if profile and profile.tax_identification_number:
        details.append(("Tax ID (TIN)", profile.tax_identification_number))
    detail_rows = []
    for index in range(0, len(details), 2):
        row = []
        for key, value in details[index:index + 2]:
            row += [p(key.upper(), label), p(value)]
        detail_rows.append(row + [""] * (4 - len(row)))
    detail_table = Table(detail_rows, colWidths=[width * 0.2, width * 0.3] * 2)
    detail_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story += [detail_table, Spacer(1, 6 * mm)]

    for group_title, effects in GROUPS:
        items = [item for item in payload["items"] if (item["metadata"] or {}).get("effect") in effects]
        if not items and effects == ("EMPLOYER_CONTRIBUTION",):
            continue
        rows = [[p(group_title, heading), ""]]
        rows += [[p(item["name"]), p(money(item["amount"], currency), right)] for item in items]
        if not items:
            rows.append([p(f"No {group_title.lower()}.", small), ""])
        if effects == ("EARNING",):
            rows.append([Paragraph("<b>Gross pay</b>", base), Paragraph(f"<b>{money(payload['gross_pay'], currency)}</b>", right)])
        elif effects == ("EMPLOYER_CONTRIBUTION",):
            rows.append([Paragraph("<b>Total employer contributions</b>", base), Paragraph(f"<b>{money(payload['employer_contributions'], currency)}</b>", right)])
        else:
            # Employee contributions (e.g. pension) are listed with deductions, so they belong in the total.
            withheld = Decimal(payload["total_deductions"]) + Decimal(payload["employee_contributions"])
            rows.append([Paragraph("<b>Total deductions</b>", base), Paragraph(f"<b>{money(withheld, currency)}</b>", right)])
        table = Table(rows, colWidths=[width * 0.7, width * 0.3])
        table.setStyle(TableStyle([
            ("LINEBELOW", (0, 0), (-1, 0), 0.6, LINE),
            ("LINEABOVE", (0, -1), (-1, -1), 0.6, NAVY),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        story += [table, Spacer(1, 5 * mm)]

    net_style = ParagraphStyle("net", parent=heading, textColor=colors.white, fontSize=13)
    net = Table(
        [[Paragraph("Net pay", net_style), Paragraph(money(payload["net_pay"], currency), ParagraphStyle("netr", parent=net_style, alignment=TA_RIGHT))]],
        colWidths=[width * 0.5, width * 0.5],
    )
    net.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story += [net, Spacer(1, 8 * mm)]

    story.append(p(
        f"Generated from a finalized payroll record on {payslip.generated_at:%d %b %Y %H:%M} UTC. "
        f"Verification checksum: {payslip.checksum[:16] or '—'}. This is a computer-generated document and needs no signature.",
        small,
    ))
    doc.build(story)
    return buffer.getvalue()
