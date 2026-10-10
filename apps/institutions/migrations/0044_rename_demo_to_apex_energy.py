from django.db import migrations

OLD_CODE = "CSA-DEMO"
NEW_CODE = "APEX-DEMO"
NEW_NAME = "Apex Energy Ghana Ltd"
STAFF_DOMAIN = "apexenergy.com"
# Outside people and companies get reserved example domains: they read like
# normal addresses but can never deliver, so a demo email cannot reach a stranger.
PERSON_DOMAIN = "example.com"


def staff_email(email):
    if email and email.lower().endswith("@csa.test"):
        return f"{email[: -len('@csa.test')]}@{STAFF_DOMAIN}"
    return email


FAKE_SUFFIXES = (".test", ".example")


def person_email(email):
    """Candidates: ``linda.bonsu.candidate@csa.test`` -> ``linda.bonsu@example.com``."""
    if email and email.lower().endswith(FAKE_SUFFIXES):
        local = email.split("@", 1)[0]
        if local.endswith(".candidate"):
            local = local[: -len(".candidate")]
        return f"{local}@{PERSON_DOMAIN}"
    return email


def company_email(email):
    """Suppliers and customers: ``billing@ecg.test`` -> ``billing@ecg.example.com``."""
    if email and email.lower().endswith(FAKE_SUFFIXES):
        local, domain = email.split("@", 1)
        name = domain.rsplit(".", 1)[0]
        if name in ("csa", "apexdemo"):
            name = "apexofficesupplies"
        return f"{local}@{name}.{PERSON_DOMAIN}"
    return email


def rename(apps, schema_editor):
    """Rename the synthetic demo tenant to Apex Energy Ghana Ltd and drop the .test addresses."""
    Institution = apps.get_model("institutions", "Institution")
    Role = apps.get_model("institutions", "Role")
    User = apps.get_model("accounts", "User")
    Employee = apps.get_model("employees", "Employee")
    Candidate = apps.get_model("recruitment", "Candidate")
    JobPosting = apps.get_model("recruitment", "JobPosting")
    Interview = apps.get_model("recruitment", "Interview")
    Vendor = apps.get_model("accounting", "Vendor")
    Customer = apps.get_model("accounting", "Customer")

    institution = Institution.objects.filter(code=OLD_CODE).first()
    if institution is None:
        return
    if not Institution.objects.exclude(pk=institution.pk).filter(code=NEW_CODE).exists():
        institution.code = NEW_CODE
    institution.name = NEW_NAME
    institution.email = staff_email(institution.email)
    institution.phone = institution.phone or "+233 30 254 1100"
    institution.address = institution.address or "12 Independence Avenue, Ridge, Accra"
    institution.website = institution.website or f"https://www.{STAFF_DOMAIN}"
    institution.employee_size = institution.employee_size or "51-200"
    institution.executive_title = "Managing Director"
    institution.save(update_fields=("code", "name", "email", "phone", "address", "website", "employee_size", "executive_title", "updated_at"))

    for user in User.objects.filter(memberships__institution=institution, email__iendswith="@csa.test").distinct():
        email = staff_email(user.email)
        if not User.objects.exclude(pk=user.pk).filter(email__iexact=email).exists():
            user.email = email
            user.save(update_fields=("email", "updated_at"))

    for employee in Employee.objects.filter(institution=institution):
        changed = []
        for field in ("work_email", "personal_email"):
            value = staff_email(getattr(employee, field))
            if value != getattr(employee, field):
                setattr(employee, field, value)
                changed.append(field)
        if changed:
            employee.save(update_fields=(*changed, "updated_at"))

    for candidate in Candidate.objects.filter(institution=institution):
        changed = []
        email = person_email(candidate.email)
        if email != candidate.email and not Candidate.objects.filter(institution=institution, email__iexact=email).exclude(pk=candidate.pk).exists():
            candidate.email = email
            changed.append("email")
        if candidate.source == OLD_CODE:
            candidate.source = "Company website"
            changed.append("source")
        if candidate.current_employer == "CSA-DEMO previous employer":
            candidate.current_employer = "Previous employer"
            changed.append("current_employer")
        if changed:
            candidate.save(update_fields=(*changed, "updated_at"))

    for model in (Vendor, Customer):
        for party in model.objects.filter(institution=institution).exclude(email=""):
            if not party.email.lower().endswith(FAKE_SUFFIXES):
                continue
            party.email = company_email(party.email)
            party.save(update_fields=("email", "updated_at"))

    JobPosting.objects.filter(institution=institution, description="CSA-DEMO recruitment scenario.").update(description="Join Apex Energy Ghana Ltd. Full role profile available from HR.")
    Interview.objects.filter(institution=institution, location_or_link="CSA-DEMO").update(location_or_link="Accra Head Office, Board Room")
    Role.objects.filter(institution=institution, description="CSA-DEMO role for persona demonstrations.").update(description="Apex Energy role.")


class Migration(migrations.Migration):
    dependencies = [
        ("institutions", "0043_institution_website_employee_size"),
        ("accounts", "0009_access_request_type_website_terms"),
        ("employees", "0009_concept_profile_fields"),
        ("recruitment", "0005_interview_scheduling_offer_lifecycle"),
        ("accounting", "0026_backfill_account_provenance"),
    ]

    operations = [migrations.RunPython(rename, migrations.RunPython.noop)]
