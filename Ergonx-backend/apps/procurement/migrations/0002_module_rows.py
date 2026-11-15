from django.db import migrations


def add_module_rows(apps, schema_editor):
    """Every organisation gets a Procurement module row, switched off until an administrator enables it."""
    Institution = apps.get_model("institutions", "Institution")
    InstitutionModule = apps.get_model("institutions", "InstitutionModule")
    for institution_id in Institution.objects.values_list("id", flat=True):
        InstitutionModule.objects.get_or_create(
            institution_id=institution_id, module_code="PROCUREMENT",
            defaults={"is_enabled": False, "configuration_status": "NOT_CONFIGURED"},
        )


class Migration(migrations.Migration):
    dependencies = [
        ("procurement", "0001_initial"),
        ("institutions", "0045_procurement_module"),
    ]

    operations = [migrations.RunPython(add_module_rows, migrations.RunPython.noop)]
