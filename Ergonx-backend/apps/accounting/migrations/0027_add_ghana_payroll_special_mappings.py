from django.db import migrations


PRESET_CODES = ("GH-COMMERCIAL", "GH-SME", "GH-PUBLIC", "GH-NONPROFIT")
TEMPLATES = (
    # Unpaid leave reverses part of the base-pay accrual.
    ("UNPAID_LEAVE", "NET_PAY_PAYABLE", "SALARIES_EXPENSE", "Unpaid leave reduces the base-pay accrual."),
    ("GH_BONUS_TAX", "NET_PAY_PAYABLE", "PAYE_PAYABLE", "Ghana bonus tax payable."),
    ("GH_OVERTIME_TAX", "NET_PAY_PAYABLE", "PAYE_PAYABLE", "Ghana overtime tax payable."),
    ("GH_NON_RESIDENT_BONUS_TAX", "NET_PAY_PAYABLE", "PAYE_PAYABLE", "Ghana non-resident bonus tax payable."),
    ("GH_NON_RESIDENT_OVERTIME_TAX", "NET_PAY_PAYABLE", "PAYE_PAYABLE", "Ghana non-resident overtime tax payable."),
)


def add_mappings(apps, schema_editor):
    Version = apps.get_model("accounting", "AccountingPresetVersion")
    Template = apps.get_model("accounting", "PayrollAccountMappingTemplate")

    for version in Version.objects.filter(accounting_preset__code__in=PRESET_CODES):
        for code, debit, credit, description in TEMPLATES:
            Template.objects.get_or_create(
                accounting_preset_version=version,
                payroll_component_code=code,
                defaults={
                    "debit_account_mapping_code": debit,
                    "credit_account_mapping_code": credit,
                    "description": description,
                },
            )


class Migration(migrations.Migration):
    dependencies = [("accounting", "0026_backfill_account_provenance")]

    operations = [migrations.RunPython(add_mappings, migrations.RunPython.noop)]
