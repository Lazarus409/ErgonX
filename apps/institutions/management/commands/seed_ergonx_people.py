"""Fill the rest of the APEX-DEMO tenant: energy-company structure, October hires,
and the HR records the other demo seeds leave empty.

``seed_ergonx_demo`` builds the fixed foundation and ``seed_ergonx_activity``
the rolling operational data. This command adds what an HR demo still lacks:

* organisation: an HSSE and a Supply & Logistics department, Kumasi and
  Takoradi depots and their positions;
* twelve October 2026 hires (with pay, payroll profiles, schedules, onboarding);
* emergency contacts, two offboardings, tax-relief claims;
* performance (a closed 2025 annual cycle, an active 2026 mid-year cycle);
* training (courses, completions and certificates: valid, expiring, expired);
* the document checklist (requirements, extra documents, waivers);
* complaints in every state; expense claims; energy suppliers, customers and
  two depot vacancies with candidates.

* Development-only (refuses to run when DEBUG=False) and APEX-DEMO only.
* Idempotent: every record has a stable key and is skipped when present.
* Domain services are used throughout, so notifications, audit events,
  balances and ledgers stay consistent.

Run after the other two seeds:

    python manage.py seed_ergonx_demo
    python manage.py seed_ergonx_activity
    python manage.py seed_ergonx_people
"""

import random
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError as ApiValidationError

from apps.accounting.expenses import create_expense, decide_expense_step, submit_expense
from apps.accounting.models import Account, Customer, Expense, ExpenseCategory, Invoice, Vendor, VendorBill
from apps.accounting.services import approve_vendor_bill, create_customer, create_invoice, create_vendor, create_vendor_bill, issue_invoice, post_vendor_bill, submit_vendor_bill
from apps.accounts.models import User
from apps.complaints.models import Complaint
from apps.complaints.services import add_note, assign_complaint, close_complaint, file_complaint, resolve_complaint, set_priority, start_investigation, withdraw_complaint
from apps.compensation.models import EmployeeCompensation
from apps.compensation.services import change_current_compensation
from apps.documents.models import EMPLOYEE_ENTITY_TYPE, Document, DocumentRequirement, DocumentRequirementWaiver
from apps.employees.models import EmergencyContact, Employee, EmployeeOffboarding, EmployeeOnboarding, Employment
from apps.employees.services import complete_employee_onboarding, create_employment, initiate_employee_offboarding, save_emergency_contact, start_employee_onboarding
from apps.institutions.management.commands.seed_ergonx_demo import DEFAULT_DEMO_PASSWORD, DEMO_ADMIN_EMAIL, DEMO_EMAIL_DOMAIN, DEMO_INSTITUTION_CODE, DEMO_SEED_REFUSAL, EMPLOYEES, demo_seed_allowed
from apps.institutions.models import Institution, InstitutionMembership
from apps.institutions.services import create_membership
from apps.organization.models import Department, Location, Position
from apps.organization.services import create_position
from apps.payroll.models import EmployeePayrollProfile, EmployeeTaxReliefClaim, TaxReliefDefinition
from apps.payroll.services import configure_employee_payroll_profile, create_tax_relief_claim, decide_tax_relief_claim, submit_tax_relief_claim
from apps.performance.models import Competency, PerformanceReview, ReviewCycle
from apps.performance.services import close_cycle, launch_cycle, reassign_reviewer, save_manager_review, save_self_assessment, sign_off
from apps.recruitment.models import Application, Candidate, JobPosting, RecruitmentStage
from apps.recruitment.services import move_application_stage, publish_job_posting, reject_application, submit_application
from apps.scheduling.models import ScheduleAssignment, WorkSchedule
from apps.scheduling.services import create_schedule_assignment
from apps.training.models import TrainingCourse, TrainingEnrollment
from apps.training.services import complete_enrollment, enroll_employees, start_enrollment

SERVICE_ERRORS = (DjangoValidationError, ApiValidationError)
MINIMAL_PDF = (
    b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"
)
SEED = "seed:people"  # Marks seeded rows whose natural key is free text.

DEPARTMENTS = (
    ("DPT-007", "Health, Safety & Environment"),
    ("DPT-008", "Supply & Logistics"),
)
LOCATIONS = (
    ("LOC-KSI-01", "Kumasi Fuel Depot", "Kumasi"),
    ("LOC-TKD-01", "Takoradi Terminal", "Takoradi"),
)
POSITIONS = (
    ("POS-017", "HSSE Manager", "DPT-007"),
    ("POS-018", "HSSE Officer", "DPT-007"),
    ("POS-019", "Depot Supervisor", "DPT-005"),
    ("POS-020", "Tanker Driver", "DPT-008"),
    ("POS-021", "Logistics Coordinator", "DPT-008"),
    ("POS-022", "Supply Chain Manager", "DPT-008"),
)
HIRE_DATE = date(2026, 10, 1)
HIRES = (
    # number, first, last, gender, birth, department, position, grade, location, manager, type, category, salary, role
    ("EMP-000201", "Kwesi", "Ampofo", "MALE", date(1984, 3, 14), "DPT-007", "POS-017", "GRD-02", "LOC-TEM-01", "EMP-000101", "PERMANENT", "SENIOR", "13000", "DEPARTMENT_HEAD"),
    ("EMP-000202", "Comfort", "Adomako", "FEMALE", date(1992, 7, 2), "DPT-007", "POS-018", "GRD-04", "LOC-TEM-01", "EMP-000201", "PERMANENT", "SENIOR", "7000", "EMPLOYEE"),
    ("EMP-000203", "Ebenezer", "Owusu-Ansah", "MALE", date(1990, 11, 23), "DPT-007", "POS-018", "GRD-04", "LOC-KSI-01", "EMP-000201", "PERMANENT", "SENIOR", "6800", "EMPLOYEE"),
    ("EMP-000204", "Yaa", "Asantewaa", "FEMALE", date(1987, 5, 9), "DPT-005", "POS-019", "GRD-03", "LOC-KSI-01", "EMP-000112", "PERMANENT", "SENIOR", "8000", "EMPLOYEE"),
    ("EMP-000205", "Kobina", "Essel", "MALE", date(1986, 9, 30), "DPT-005", "POS-019", "GRD-03", "LOC-TKD-01", "EMP-000112", "PERMANENT", "SENIOR", "7900", "EMPLOYEE"),
    ("EMP-000206", "Gifty", "Ofosu", "FEMALE", date(1983, 1, 18), "DPT-008", "POS-022", "GRD-02", "LOC-ACC-HQ", "EMP-000101", "PERMANENT", "SENIOR", "12500", "DEPARTMENT_HEAD"),
    ("EMP-000207", "Bernard", "Quartey", "MALE", date(1993, 4, 6), "DPT-008", "POS-021", "GRD-04", "LOC-TEM-01", "EMP-000206", "PERMANENT", "JUNIOR", "6200", "EMPLOYEE"),
    ("EMP-000208", "Issah", "Mohammed", "MALE", date(1988, 12, 11), "DPT-008", "POS-020", "GRD-05", "LOC-TEM-01", "EMP-000207", "CONTRACT", "JUNIOR", "3800", "EMPLOYEE"),
    ("EMP-000209", "Akwasi", "Bekoe", "MALE", date(1991, 8, 20), "DPT-008", "POS-020", "GRD-05", "LOC-KSI-01", "EMP-000207", "CONTRACT", "JUNIOR", "3700", "EMPLOYEE"),
    ("EMP-000210", "Felix", "Agbenyega", "MALE", date(1989, 2, 27), "DPT-008", "POS-020", "GRD-05", "LOC-TKD-01", "EMP-000207", "CONTRACT", "JUNIOR", "3700", "EMPLOYEE"),
    ("EMP-000211", "Naa", "Okailey", "FEMALE", date(1995, 6, 15), "DPT-005", "POS-012", "GRD-04", "LOC-KSI-01", "EMP-000204", "PERMANENT", "JUNIOR", "5500", "EMPLOYEE"),
    ("EMP-000212", "Selasi", "Dzikunu", "FEMALE", date(1996, 10, 3), "DPT-005", "POS-012", "GRD-04", "LOC-TKD-01", "EMP-000205", "PERMANENT", "JUNIOR", "5400", "EMPLOYEE"),
)
NEW_HEADS = {"DPT-007": "EMP-000201", "DPT-008": "EMP-000206"}

CONTACT_FIRST = ("Akua", "Kofi", "Abena", "Kwame", "Esi", "Yaw", "Ama", "Kojo", "Afia", "Kwabena", "Efua", "Nii", "Adjoa", "Fiifi", "Akosua", "Kweku")
CONTACT_LAST = ("Mensah", "Owusu", "Asante", "Boateng", "Addo", "Appiah", "Darko", "Ofori", "Amponsah", "Tetteh", "Agyei", "Sarpong")
RELATIONSHIPS = ("Spouse", "Mother", "Father", "Brother", "Sister", "Spouse", "Uncle", "Aunt")
CONTACT_TOWNS = ("East Legon, Accra", "Dansoman, Accra", "Community 9, Tema", "Ahodwo, Kumasi", "Anaji, Takoradi", "Madina, Accra", "Kasoa", "Adenta, Accra")

COMPETENCIES = (
    ("Job knowledge", "Understands the role, products and procedures."),
    ("Quality of work", "Accurate, thorough and reliable output."),
    ("Safety compliance", "Follows HSSE rules and reports hazards."),
    ("Teamwork", "Works well with colleagues and other departments."),
    ("Customer focus", "Serves internal and external customers well."),
    ("Initiative", "Improves how work is done without being asked."),
)
STRENGTHS = ("Consistently meets deadlines.", "Strong grasp of depot procedures.", "Very dependable under pressure.", "Builds good relationships with customers.", "Helps new colleagues settle in.")
DEVELOPMENT = ("Take the Leadership Essentials course.", "Shadow the depot supervisor for two weeks.", "Complete the advanced Excel course.", "Lead one process-improvement project this year.", "Improve documentation of daily checks.")

COURSES = (
    # title, category, mode, provider, hours, validity months, mandatory
    ("Fire Safety & Emergency Response", "SAFETY", "CLASSROOM", "Ghana National Fire Service (Tema)", "8", 12, True),
    ("Defensive Driving for Tanker Drivers", "SAFETY", "ON_THE_JOB", "Apex HSSE team", "16", 24, True),
    ("Hazardous Materials Handling", "SAFETY", "BLENDED", "Apex HSSE team", "12", 24, True),
    ("First Aid at Work", "SAFETY", "CLASSROOM", "Ghana Red Cross Society", "6", 36, False),
    ("Anti-Money Laundering & Business Ethics", "COMPLIANCE", "ONLINE", "Apex Compliance", "3", 12, True),
    ("Petroleum Product Quality Control", "TECHNICAL", "CLASSROOM", "Apex Quality Laboratory", "10", None, False),
    ("Leadership Essentials", "LEADERSHIP", "BLENDED", "GIMPA Executive Education", "24", None, False),
    ("New Staff Induction", "INDUCTION", "CLASSROOM", "Apex Human Resources", "8", None, True),
    ("Advanced Excel for Finance", "TECHNICAL", "ONLINE", "Apex Finance", "6", None, False),
)

REQUIREMENTS = (
    # name, category, description, employment types, validity months, mandatory
    ("Signed employment contract", "CONTRACT", "The signed contract or appointment letter.", [], None, True),
    ("Ghana Card", "IDENTITY", "A copy of the National Identification (Ghana) Card.", [], None, True),
    ("Academic certificate", "QUALIFICATION", "Highest qualification relevant to the role.", ["PERMANENT", "CONTRACT"], None, True),
    ("SSNIT registration", "SSNIT", "SSNIT biometric card or registration slip.", ["PERMANENT", "CONTRACT", "TEMPORARY"], None, True),
    ("Medical fitness certificate", "MEDICAL", "Annual fitness-to-work certificate for depot and field staff.", [], 12, True),
    ("Driver's licence (Class F)", "DRIVING_LICENCE", "Required for tanker drivers; optional for others.", ["CONTRACT"], 36, False),
)

COMPLAINTS = (
    # complainant, category, subject, description, respondent, days ago, location, final state, priority
    ("EMP-000113", "HEALTH_SAFETY", "Faulty fire extinguishers at loading bay 3", "Two of the extinguishers at loading bay 3 at Tema have expired inspection tags and one has lost pressure.", None, 34, "Tema Fuel Depot, loading bay 3", "CLOSED", "HIGH"),
    ("EMP-000120", "HARASSMENT", "Unwelcome comments from a colleague", "A colleague repeatedly makes comments about my appearance during sales meetings, even after I asked him to stop.", "EMP-000119", 12, "Head office, sales floor", "INVESTIGATING", "HIGH"),
    ("EMP-000116", "PAY_BENEFITS", "September overtime not paid", "I worked four extra night shifts in September but they are not on my payslip.", None, 8, "Tema Fuel Depot", "UNDER_REVIEW", "NORMAL"),
    ("EMP-000110", "WORKING_CONDITIONS", "Air conditioning broken in the IT office", "The air conditioning in the IT office has not worked for three weeks; the room gets very hot after midday.", None, 3, "Head office, 2nd floor", "SUBMITTED", "NORMAL"),
    ("EMP-000128", "MANAGEMENT", "Shift changes announced with no notice", "Night-shift changes are posted the evening before, which makes childcare impossible to arrange.", "EMP-000112", 26, "Tema Fuel Depot", "RESOLVED", "NORMAL"),
    ("EMP-000130", "DISCRIMINATION", "Passed over for field assignment", "I believe I was not considered for the Kumasi field assignment because I am a woman.", None, 40, "Head office", "WITHDRAWN", "NORMAL"),
    ("EMP-000208", "HEALTH_SAFETY", "Brakes on tanker TK-14 feel soft", "During my run to Akosombo the brakes on tanker TK-14 needed far more pressure than normal. I parked it and reported it to the yard.", None, 1, "Tema Fuel Depot, tanker yard", "INVESTIGATING", "URGENT"),
)


class Command(BaseCommand):
    help = "Seed energy-company structure, October hires and HR module data for APEX-DEMO (development only)."

    def handle(self, *args, **options):
        if not demo_seed_allowed():
            raise CommandError(DEMO_SEED_REFUSAL.format("seed_ergonx_people"))
        institution = Institution.objects.filter(code=DEMO_INSTITUTION_CODE).first()
        if institution is None:
            raise CommandError("APEX-DEMO does not exist. Run `python manage.py seed_ergonx_demo` first.")
        self.institution = institution
        self.admin = User.objects.get(email=DEMO_ADMIN_EMAIL)
        self.hr = User.objects.get(email=f"ama.owusu@{DEMO_EMAIL_DOMAIN}")
        self.today = timezone.localdate()
        self.summary = {}
        steps = (
            ("organisation", self._organisation),
            ("october hires", self._hires),
            ("emergency contacts", self._emergency_contacts),
            ("offboarding", self._offboarding),
            ("tax relief", self._tax_relief),
            ("performance", self._performance),
            ("training", self._training),
            ("document checklist", self._documents),
            ("complaints", self._complaints),
            ("expense claims", self._expense_claims),
            ("suppliers and customers", self._suppliers_and_customers),
            ("depot vacancies", self._vacancies),
        )
        failures = []
        for label, step in steps:
            try:
                with transaction.atomic():
                    step()
                self.stdout.write(f"  ok      {label}: {self.summary.get(label, 'up to date')}")
            except Exception as exc:  # noqa: BLE001 - report and continue with independent sections
                failures.append(label)
                self.stdout.write(self.style.ERROR(f"  FAILED  {label}: {exc}"))
        if failures:
            raise CommandError(f"Seeding failed for: {', '.join(failures)}")
        self.stdout.write(self.style.SUCCESS("APEX-DEMO people and HR records are in place."))

    # ------------------------------------------------------------------ helpers

    def _count(self, label, amount=1):
        if amount:
            self.summary[label] = self.summary.get(label, 0) + amount

    def _employee(self, number):
        return self.institution.employees.select_related("user").get(employee_number=number)

    def _people(self):
        """The fixed personas and the October hires (not ad-hoc test records)."""
        numbers = [row[0] for row in EMPLOYEES] + [row[0] for row in HIRES]
        return list(self.institution.employees.filter(employee_number__in=numbers).select_related("user").order_by("employee_number"))

    def _employment(self, employee):
        return employee.employments.filter(is_current=True).select_related("department", "location").first()

    def _hr_for(self, employee):
        """HR never acts on their own record: Kwame handles Ama's."""
        return self.admin if employee.user_id == self.hr.id else self.hr

    def _stamp(self, day, hour=10, minute=0):
        return timezone.make_aware(datetime.combine(day, time(hour, minute)), timezone.get_current_timezone())

    def _pdf(self, employee, title, category, uploaded_on=None):
        filename = f"{employee.employee_number} {title}.pdf"
        if Document.objects.filter(institution=self.institution, entity_type=EMPLOYEE_ENTITY_TYPE, entity_id=employee.id, original_filename=filename).exists():
            return None
        document = Document(institution=self.institution, uploaded_by=self.hr, original_filename=filename, content_type="application/pdf", size_bytes=len(MINIMAL_PDF), category=category, classification=Document.Classification.CONFIDENTIAL, entity_type=EMPLOYEE_ENTITY_TYPE, entity_id=employee.id, is_active=True)
        document.stored_file.save(f"apex-demo/{employee.employee_number}-{category.lower()}.pdf", ContentFile(MINIMAL_PDF), save=False)
        document.save()
        if uploaded_on:
            Document.objects.filter(pk=document.pk).update(created_at=self._stamp(uploaded_on))
        return document

    # -------------------------------------------------------------- organisation

    def _organisation(self):
        institution = self.institution
        executive = institution.departments.get(code="DPT-001")
        for code, name in DEPARTMENTS:
            _, created = Department.objects.get_or_create(institution=institution, code=code, defaults={"name": name, "parent": executive, "is_active": True})
            if created:
                self._count("organisation")
        for code, name, city in LOCATIONS:
            _, created = Location.objects.get_or_create(institution=institution, code=code, defaults={"name": name, "city": city, "country": "GH", "timezone": "Africa/Accra", "is_remote": False, "is_active": True})
            if created:
                self._count("organisation")
        for code, title, department in POSITIONS:
            if not Position.objects.filter(institution=institution, code=code).exists():
                create_position(institution=institution, department=institution.departments.get(code=department), title=title, code=code, is_active=True)
                self._count("organisation")

    # ------------------------------------------------------------- october hires

    def _hires(self):
        institution, admin = self.institution, self.admin
        structure = institution.salary_structures.get(code="APEX-MONTHLY")
        schedules = {schedule.code: schedule for schedule in WorkSchedule.objects.filter(institution=institution)}
        employments = {}
        for index, (number, first, last, gender, born, department, position, grade, location, _, kind, category, salary, role) in enumerate(HIRES):
            email = f"{first}.{last}@{DEMO_EMAIL_DOMAIN}".lower()
            user, created = User.objects.get_or_create(email=email, defaults={"first_name": first, "last_name": last, "is_active": True})
            if created:
                user.set_password(DEFAULT_DEMO_PASSWORD)
                user.save(update_fields=("password", "updated_at"))
            if not InstitutionMembership.objects.filter(user=user, institution=institution).exists():
                create_membership(user=user, institution=institution, role=institution.roles.get(code=role), status=InstitutionMembership.Status.ACTIVE, is_primary=False, joined_at=timezone.now())
            employee = Employee.objects.filter(institution=institution, employee_number=number).first()
            if employee is None:
                employee = Employee(institution=institution, employee_number=number, user=user, first_name=first, last_name=last, work_email=email, personal_email=email, phone=f"+23324{5550100 + index:07d}", date_of_birth=born, gender=gender, hire_date=HIRE_DATE, status=Employee.Status.ACTIVE, preferred_name=first)
                employee.full_clean()
                employee.save()
                self._count("october hires")
            employment = Employment.objects.filter(employee=employee, is_current=True).first()
            if employment is None:
                employment = create_employment(
                    institution=institution, employee=employee, department=institution.departments.get(code=department), position=institution.positions.get(code=position),
                    grade=institution.grades.get(code=grade), location=institution.locations.get(code=location), employment_type=kind, staff_category=category,
                    start_date=HIRE_DATE, status=Employment.Status.ACTIVE, is_current=True,
                )
                employment.working_pattern = Employment.WorkingPattern.FULL_TIME
                employment.work_arrangement = Employment.WorkArrangement.ON_SITE
                employment.office_days = ["MON", "TUE", "WED", "THU", "FRI"]
                employment.time_zone = "Africa/Accra"
                employment.team = f"{employment.department.name} team"
                employment.cost_centre = f"{department}-01"
                employment.probation_end_date = HIRE_DATE + timedelta(days=182)
                employment.probation_status = Employment.ProbationStatus.IN_PROGRESS
                employment.notice_period_weeks = 4 if kind == "PERMANENT" else 2
                employment.full_clean()
                employment.save()
            employee.office_location = employment.location.name
            employee.save(update_fields=("office_location", "updated_at"))
            employments[number] = employment
            if not EmployeeCompensation.objects.filter(employee=employee, is_current=True).exists():
                change_current_compensation(institution=institution, employee=employee, salary_structure=structure, base_salary=Decimal(salary), currency="GHS", effective_from=HIRE_DATE, actor=admin)
            if not EmployeePayrollProfile.objects.filter(employee=employee).exists():
                configure_employee_payroll_profile(institution=institution, employee=employee, actor=admin, tax_residency=EmployeePayrollProfile.TaxResidency.RESIDENT, tax_identification_number=f"TIN-DEMO-{2000 + index}")
            if not ScheduleAssignment.objects.filter(employee=employee, is_current=True).exists():
                schedule = schedules["SCH-000021"] if location == "LOC-ACC-HQ" else schedules["SCH-000022"]
                create_schedule_assignment(institution=institution, employee=employee, work_schedule=schedule, effective_from=HIRE_DATE, is_current=True, assigned_by=admin)
            if not EmployeeOnboarding.objects.filter(employee=employee).exists():
                # Managers and office staff are fully onboarded; depot staff are still finishing.
                if index < 6:
                    complete_employee_onboarding(institution=institution, employee=employee, actor=self.hr)
                else:
                    onboarding = start_employee_onboarding(institution=institution, employee=employee, actor=self.hr)
                    onboarding.notes = "Waiting for medical fitness certificate and SSNIT registration."
                    onboarding.save(update_fields=("notes", "updated_at"))
        for row in HIRES:
            number, manager = row[0], row[9]
            employment = employments[number]
            manager_employment = employments.get(manager) or Employment.objects.filter(employee__institution=institution, employee__employee_number=manager, is_current=True).first()
            if employment.reports_to_id != manager_employment.id:
                employment.reports_to = manager_employment
                employment.save(update_fields=("reports_to", "updated_at"))
        for department_code, head_number in NEW_HEADS.items():
            department = institution.departments.get(code=department_code)
            head = employments[head_number].employee
            if department.head_id != head.id:
                department.head = head
                department.save(update_fields=("head", "updated_at"))

    # ------------------------------------------------------- emergency contacts

    def _emergency_contacts(self):
        for employee in self._people():
            if EmergencyContact.objects.filter(employee=employee).exists():
                continue
            rng = random.Random(f"apex-contact-{employee.employee_number}")
            count = 2 if rng.random() < 0.55 else 1
            for position in range(count):
                first, last = rng.choice(CONTACT_FIRST), employee.last_name if position == 0 and rng.random() < 0.6 else rng.choice(CONTACT_LAST)
                save_emergency_contact(
                    institution=self.institution, employee=employee, full_name=f"{first} {last}", relationship=rng.choice(RELATIONSHIPS),
                    phone=f"+23324{rng.randint(1000000, 9999999)}", alternate_phone=f"+23320{rng.randint(1000000, 9999999)}" if rng.random() < 0.4 else "",
                    email="", address=rng.choice(CONTACT_TOWNS), is_primary=position == 0,
                )
                self._count("emergency contacts")

    # ---------------------------------------------------------------- offboarding

    def _offboarding(self):
        for number, last_day, reason, notes in (
            ("EMP-000126", date(2026, 10, 31), "End of internship", "Return laptop and access card; exit interview booked for 29 October."),
            ("EMP-000128", date(2026, 11, 15), "Fixed-term contract ends", "Handover of night-shift logs to the depot supervisor."),
        ):
            employee = self._employee(number)
            if EmployeeOffboarding.objects.filter(employee=employee).exists():
                continue
            initiate_employee_offboarding(institution=self.institution, employee=employee, actor=self.hr, last_working_day=last_day, reason=reason, notes=notes)
            self._count("offboarding")

    # ----------------------------------------------------------------- tax relief

    def _tax_relief(self):
        institution = self.institution
        version = institution.payroll_configuration.selected_payroll_preset_version
        definitions = {item.code: item for item in TaxReliefDefinition.objects.filter(preset_version=version)}
        for number, code, target in (("EMP-000109", "MARRIAGE_RESPONSIBILITY", "PENDING"), ("EMP-000114", "CHILD_EDUCATION", "APPROVED"), ("EMP-000121", "AGED_DEPENDENT_RELATIVE", "PENDING"), ("EMP-000111", "EDUCATIONAL_TRAINING", "DRAFT")):
            employee = self._employee(number)
            definition = definitions.get(code)
            if definition is None or EmployeeTaxReliefClaim.objects.filter(employee=employee, relief_definition=definition, tax_year=2026).exists():
                continue
            limit = definition.default_amount * (definition.max_count or 1) if definition.default_amount else Decimal("1200")
            evidence = self._pdf(employee, f"{definition.name} evidence", "TAX_RELIEF", self.today - timedelta(days=20)) if definition.requires_evidence else None
            claim = create_tax_relief_claim(institution=institution, actor=employee.user, employee=employee, relief_definition=definition, tax_year=2026, claimed_amount=min(limit, Decimal("1200")), evidence=evidence)
            if target in ("PENDING", "APPROVED"):
                claim = submit_tax_relief_claim(claim=claim, actor=employee.user)
            if target == "APPROVED":
                decide_tax_relief_claim(claim=claim, actor=self.hr, approve=True)
            self._count("tax relief")

    # --------------------------------------------------------------- performance

    def _rate(self, review, rng, actor_kind):
        return {str(row.competency_id): {"rating": max(1, min(5, round(rng.gauss(3.6, 0.8)))), "comment": rng.choice(STRENGTHS) if actor_kind == "manager" else ""} for row in review.ratings.all()}

    def _run_review(self, review, rng, target):
        """Move a review to ``target`` (SELF_ASSESSMENT, MANAGER_REVIEW, HR_REVIEW or COMPLETED)."""
        employee = review.employee
        hr = self._hr_for(employee)
        if review.reviewer_id is None:
            reassign_reviewer(review=review, actor=hr, reviewer=User.objects.get(email=f"evelyn.darko@{DEMO_EMAIL_DOMAIN}"))
            review.refresh_from_db()
        if target == "SELF_ASSESSMENT":
            if rng.random() < 0.5:  # A draft in progress.
                save_self_assessment(review=review, actor=employee.user, ratings=self._rate(review, rng, "self"), summary="")
            return
        save_self_assessment(review=review, actor=employee.user, ratings=self._rate(review, rng, "self"), summary="I met my main targets this period and supported the team during peak demand.", submit=True)
        if target == "MANAGER_REVIEW":
            return
        review.refresh_from_db()
        overall = max(1, min(5, round(rng.gauss(3.6, 0.7))))
        save_manager_review(review=review, actor=review.reviewer, ratings=self._rate(review, rng, "manager"), summary=rng.choice(STRENGTHS), development_plan=rng.choice(DEVELOPMENT), overall_rating=overall, submit=True)
        if target == "HR_REVIEW":
            return
        sign_off(review=review, actor=hr, comment="Agreed.")

    def _performance(self):
        institution = self.institution
        competencies = []
        for order, (name, description) in enumerate(COMPETENCIES):
            competency, _ = Competency.objects.get_or_create(institution=institution, name=name, defaults={"description": description, "sort_order": order})
            competencies.append(competency)
        personas = [employee for employee in self._people() if employee.employee_number in {row[0] for row in EMPLOYEES}]

        annual = ReviewCycle.objects.filter(institution=institution, name="2025 Annual Review").first()
        if annual is None:
            annual = ReviewCycle.objects.create(institution=institution, name="2025 Annual Review", description="Year-end review of 2025 performance.", period_start=date(2025, 1, 1), period_end=date(2025, 12, 31), self_assessment_due=date(2026, 1, 16), manager_review_due=date(2026, 1, 30))
            annual.competencies.set(competencies)
            eligible = [employee for employee in personas if employee.hire_date and employee.hire_date <= date(2025, 9, 30)]
            launch_cycle(cycle=annual, actor=self.hr, employees=eligible)
            for review in annual.reviews.select_related("employee__user", "reviewer").order_by("employee__employee_number"):
                self._run_review(review, random.Random(f"apex-annual-{review.employee.employee_number}"), "COMPLETED")
                self._count("performance")
            close_cycle(cycle=annual, actor=self.hr)
            # Recorded history: the cycle ran in January 2026, not today.
            ReviewCycle.objects.filter(pk=annual.pk).update(launched_at=self._stamp(date(2026, 1, 5)), closed_at=self._stamp(date(2026, 2, 6)))
            for index, review in enumerate(annual.reviews.order_by("employee__employee_number")):
                PerformanceReview.objects.filter(pk=review.pk).update(self_submitted_at=self._stamp(date(2026, 1, 8) + timedelta(days=index % 8)), manager_submitted_at=self._stamp(date(2026, 1, 20) + timedelta(days=index % 9)), signed_off_at=self._stamp(date(2026, 2, 2) + timedelta(days=index % 4)))

        midyear = ReviewCycle.objects.filter(institution=institution, name="2026 Mid-Year Review").first()
        if midyear is None:
            midyear = ReviewCycle.objects.create(institution=institution, name="2026 Mid-Year Review", description="Progress against 2026 objectives.", period_start=date(2026, 1, 1), period_end=date(2026, 6, 30), self_assessment_due=self.today + timedelta(days=7), manager_review_due=self.today + timedelta(days=21))
            midyear.competencies.set(competencies)
            launch_cycle(cycle=midyear, actor=self.hr, employees=personas)
            targets = ("COMPLETED", "COMPLETED", "HR_REVIEW", "MANAGER_REVIEW", "MANAGER_REVIEW", "SELF_ASSESSMENT")
            for index, review in enumerate(midyear.reviews.select_related("employee__user", "reviewer").order_by("employee__employee_number")):
                self._run_review(review, random.Random(f"apex-midyear-{review.employee.employee_number}"), targets[index % len(targets)])
                self._count("performance")

    # ------------------------------------------------------------------ training

    def _course(self, title, category, mode, provider, hours, validity, mandatory):
        course = TrainingCourse.objects.filter(institution=self.institution, title=title).first()
        if course is None:
            course = TrainingCourse.objects.create(institution=self.institution, title=title, category=category, delivery_mode=mode, provider=provider, duration_hours=Decimal(hours), certificate_validity_months=validity, is_mandatory=mandatory, description=f"{title} ({provider}).")
        return course

    def _enrol(self, course, employee, *, outcome, on, score=None):
        """outcome: COMPLETED, NOT_PASSED, IN_PROGRESS or PLANNED; ``on`` is the completion or start date."""
        marker = f"{SEED} {course.title}"
        if TrainingEnrollment.objects.filter(course=course, employee=employee, notes__startswith=SEED).exists():
            return
        planned_start = on - timedelta(days=2) if outcome in ("COMPLETED", "NOT_PASSED") else on
        created, _ = enroll_employees(course=course, employees=[employee], actor=self.hr, planned_start=planned_start, planned_end=planned_start + timedelta(days=1), notes=marker)
        if not created:
            return
        enrollment = created[0]
        if outcome == "IN_PROGRESS":
            start_enrollment(enrollment=enrollment, actor=self.hr)
        elif outcome in ("COMPLETED", "NOT_PASSED"):
            complete_enrollment(enrollment=enrollment, actor=self.hr, completed_on=on, passed=outcome == "COMPLETED", score=score, certificate_number=f"APX-{course.code}-{employee.employee_number[-3:]}" if outcome == "COMPLETED" else "")
        self._count("training")

    def _training(self):
        courses = {row[0]: self._course(*row) for row in COURSES}
        people = self._people()
        by_department = {}
        for employee in people:
            employment = self._employment(employee)
            by_department.setdefault(employment.department.code if employment else "", []).append(employee)
        field_staff = by_department.get("DPT-005", []) + by_department.get("DPT-007", []) + by_department.get("DPT-008", [])
        hires = [employee for employee in people if employee.employee_number in {row[0] for row in HIRES}]

        fire = courses["Fire Safety & Emergency Response"]
        # Completion dates spread over 15 months: some certificates expired, some expire within 60 days, most valid.
        for index, employee in enumerate([item for item in field_staff if item not in hires]):
            completed = date(2025, 7, 10) + timedelta(days=index * 31)
            if completed < self.today:
                self._enrol(fire, employee, outcome="COMPLETED", on=completed, score=Decimal(70 + index * 3 % 28))
        for employee in hires:
            self._enrol(courses["New Staff Induction"], employee, outcome="COMPLETED" if employee.employee_number <= "EMP-000206" else "IN_PROGRESS", on=HIRE_DATE + timedelta(days=2) if employee.employee_number <= "EMP-000206" else HIRE_DATE)
            if employee.employee_number in ("EMP-000208", "EMP-000209", "EMP-000210"):
                self._enrol(courses["Defensive Driving for Tanker Drivers"], employee, outcome="PLANNED", on=self.today + timedelta(days=10))
                self._enrol(fire, employee, outcome="PLANNED", on=self.today + timedelta(days=17))
        for index, number in enumerate(("EMP-000113", "EMP-000114", "EMP-000115", "EMP-000201", "EMP-000204")):
            self._enrol(courses["Hazardous Materials Handling"], self._employee(number), outcome="COMPLETED" if index < 3 else "PLANNED", on=date(2024, 11, 4) + timedelta(days=index * 40) if index < 3 else self.today + timedelta(days=24))
        for index, number in enumerate(("EMP-000102", "EMP-000112", "EMP-000115", "EMP-000122", "EMP-000129", "EMP-000202")):
            self._enrol(courses["First Aid at Work"], self._employee(number), outcome="COMPLETED", on=date(2023, 11, 20) + timedelta(days=index * 120))
        finance = by_department.get("DPT-003", [])
        for index, employee in enumerate(finance):
            self._enrol(courses["Anti-Money Laundering & Business Ethics"], employee, outcome="NOT_PASSED" if index == 2 else "COMPLETED", on=date(2025, 10, 28) + timedelta(days=index * 5), score=Decimal("58") if index == 2 else Decimal(82 + index))
            self._enrol(courses["Advanced Excel for Finance"], employee, outcome="IN_PROGRESS" if index % 2 else "PLANNED", on=self.today - timedelta(days=3) if index % 2 else self.today + timedelta(days=12))
        for index, number in enumerate(("EMP-000113", "EMP-000114", "EMP-000116", "EMP-000211", "EMP-000212")):
            self._enrol(courses["Petroleum Product Quality Control"], self._employee(number), outcome=("COMPLETED", "IN_PROGRESS", "PLANNED")[index % 3], on=date(2026, 8, 18) if index % 3 == 0 else self.today - timedelta(days=2) if index % 3 == 1 else self.today + timedelta(days=30), score=Decimal("88") if index % 3 == 0 else None)
        for number in ("EMP-000108", "EMP-000112", "EMP-000118", "EMP-000201", "EMP-000206"):
            self._enrol(courses["Leadership Essentials"], self._employee(number), outcome="PLANNED", on=date(2026, 11, 9))

    # --------------------------------------------------------- document checklist

    def _documents(self):
        institution = self.institution
        requirements = {}
        for order, (name, category, description, kinds, validity, mandatory) in enumerate(REQUIREMENTS):
            requirement = DocumentRequirement.objects.filter(institution=institution, name=name).first()
            if requirement is None:
                requirement = DocumentRequirement.objects.create(institution=institution, name=name, document_category=category, description=description, employment_types=kinds, validity_months=validity, is_mandatory=mandatory, sort_order=order)
                self._count("document checklist")
            requirements[category] = requirement
        for index, employee in enumerate(self._people()):
            rng = random.Random(f"apex-docs-{employee.employee_number}")
            hire = employee.hire_date or date(2024, 1, 1)
            new_hire = employee.employee_number >= "EMP-000201"
            if new_hire:
                for title, category in (("Employment contract", "CONTRACT"), ("Ghana Card copy", "IDENTITY")):
                    self._count("document checklist", int(self._pdf(employee, title, category, HIRE_DATE) is not None))
                if employee.employee_number <= "EMP-000206":
                    self._count("document checklist", int(self._pdf(employee, "Academic certificate", "QUALIFICATION", HIRE_DATE) is not None))
                    self._count("document checklist", int(self._pdf(employee, "SSNIT registration", "SSNIT", HIRE_DATE) is not None))
                continue
            if rng.random() < 0.75:
                self._count("document checklist", int(self._pdf(employee, "SSNIT registration", "SSNIT", max(hire, date(2024, 1, 15))) is not None))
            if rng.random() < 0.7:
                # Uploaded between 8 and 15 months ago: some current, some lapsed.
                uploaded = self.today - timedelta(days=240 + (index * 17) % 220)
                self._count("document checklist", int(self._pdf(employee, "Medical fitness certificate", "MEDICAL", uploaded) is not None))
        for number in ("EMP-000208", "EMP-000209"):
            self._count("document checklist", int(self._pdf(self._employee(number), "Driver's licence", "DRIVING_LICENCE", HIRE_DATE) is not None))
        for number, category, reason in (
            ("EMP-000123", "SSNIT", "Foreign national contributing to the home-country scheme under the bilateral agreement."),
            ("EMP-000117", "MEDICAL", "Medical renewal booked at the Tema clinic; certificate expected by month end."),
            ("EMP-000101", "QUALIFICATION", "Managing Director appointed by the board on professional record."),
        ):
            employee = self._employee(number)
            requirement = requirements[category]
            if not DocumentRequirementWaiver.objects.filter(requirement=requirement, employee=employee).exists():
                DocumentRequirementWaiver.objects.create(institution=institution, requirement=requirement, employee=employee, reason=reason, waived_by=self.hr if employee.user_id != self.hr.id else self.admin)
                self._count("document checklist")

    # ------------------------------------------------------------------ complaints

    def _complaints(self):
        institution = self.institution
        for number, category, subject, description, respondent, days_ago, place, final, priority in COMPLAINTS:
            complainant = self._employee(number)
            if Complaint.objects.filter(institution=institution, complainant=complainant, subject=subject).exists():
                continue
            filed_on = self.today - timedelta(days=days_ago)
            complaint = file_complaint(
                institution=institution, actor=complainant.user, category=category, subject=subject, description=description,
                incident_date=filed_on - timedelta(days=1), incident_location=place, respondent=self._employee(respondent) if respondent else None,
            )
            hr = self.hr
            if final == "WITHDRAWN":
                withdraw_complaint(complaint=complaint, actor=complainant.user, reason="I spoke with my manager and it has been sorted out.")
            elif final != "SUBMITTED":
                assign_complaint(complaint=complaint, actor=hr, assignee=hr)
                if priority != "NORMAL":
                    set_priority(complaint=complaint, actor=hr, priority=priority)
                add_note(complaint=complaint, actor=hr, body="Thank you for raising this. I am looking into it and will keep you updated here.", internal=False)
                if final in ("INVESTIGATING", "RESOLVED", "CLOSED"):
                    start_investigation(complaint=complaint, actor=hr)
                    add_note(complaint=complaint, actor=hr, body="Spoke with the depot manager and two witnesses; statements filed.", internal=True)
                    add_note(complaint=complaint, actor=complainant.user, body="Thank you. I can share photos if that helps.", internal=False)
                if final in ("RESOLVED", "CLOSED"):
                    outcome = {
                        "Faulty fire extinguishers at loading bay 3": "All extinguishers at loading bays 1-4 were replaced and a monthly inspection rota was added to the HSSE checklist.",
                        "Shift changes announced with no notice": "Shift rosters are now published two weeks ahead; changes need 72 hours' notice except emergencies.",
                    }.get(subject, "Resolved with the team concerned.")
                    resolve_complaint(complaint=complaint, actor=hr, resolution=outcome)
                if final == "CLOSED":
                    close_complaint(complaint=complaint, actor=hr)
            Complaint.objects.filter(pk=complaint.pk).update(created_at=self._stamp(filed_on, 9, 30))
            complaint.notes.update(created_at=self._stamp(min(filed_on + timedelta(days=1), self.today), 11))
            if final in ("RESOLVED", "CLOSED"):
                Complaint.objects.filter(pk=complaint.pk).update(resolved_at=self._stamp(min(filed_on + timedelta(days=9), self.today), 15))
            self._count("complaints")

    # -------------------------------------------------------------- expense claims

    def _expense_claims(self):
        institution = self.institution
        accounts = {account.code: account for account in Account.objects.filter(institution=institution, code__in=("5000", "5310", "5400", "5500", "5600"))}
        categories = {}
        for code, name, account, cap, receipt_over in (
            ("FUEL", "Fuel and mileage", "5400", "3000", "200"),
            ("MEALS", "Meals while travelling", "5000", "400", "150"),
            ("LODGING", "Accommodation", "5400", "1500", "0"),
            ("COMMS", "Phone and data", "5310", "500", "100"),
            ("TRAINING", "Training and conferences", "5600", "5000", "0"),
            ("SUPPLIES", "Office and depot supplies", "5500", "1000", "100"),
        ):
            category = ExpenseCategory.objects.filter(institution=institution, code=code).first()
            if category is None:
                category = ExpenseCategory.objects.create(institution=institution, code=code, name=name, expense_account=accounts[account], max_amount=Decimal(cap), receipt_required_over=Decimal(receipt_over), is_active=True)
                self._count("expense claims")
            categories[code] = category
        claims = (
            ("EMP-000204", "Kumasi depot setup trip", (("FUEL", "Accra to Kumasi, own vehicle", "640"), ("LODGING", "Two nights, Golden Tulip Kumasi", "1380"), ("MEALS", "Meals, 3 days", "330")), "approve"),
            ("EMP-000113", "Night-shift data bundle", (("COMMS", "Mobile data for depot reporting", "150"),), None),
            ("EMP-000119", "Customer visit, Takoradi", (("FUEL", "Accra to Takoradi return", "720"), ("MEALS", "Lunch with customer", "260")), None),
            ("EMP-000202", "HSSE conference registration", (("TRAINING", "Ghana HSE Summit 2026 registration", "1800"),), "approve"),
            ("EMP-000110", "Network cabling supplies", (("SUPPLIES", "Patch cables and connectors", "420"),), None),
        )
        for number, label, lines, decision in claims:
            employee = self._employee(number)
            description = f"{label} ({SEED})"
            if Expense.objects.filter(institution=institution, description=description).exists():
                continue
            spend_day = self.today - timedelta(days=6)
            rows = []
            for line_index, (code, text, amount) in enumerate(lines):
                # Claimants attach a receipt to every line, as the claim form asks.
                receipt = Document(institution=institution, uploaded_by=employee.user, original_filename=f"Receipt {line_index + 1} - {text}.pdf"[:255], content_type="application/pdf", size_bytes=len(MINIMAL_PDF), category="EXPENSE_RECEIPT", classification=Document.Classification.CONFIDENTIAL, is_active=True)
                receipt.stored_file.save(f"apex-demo/receipt-{employee.employee_number}-{line_index + 1}.pdf", ContentFile(MINIMAL_PDF), save=False)
                receipt.save()
                rows.append({"category": categories[code], "description": text, "amount": Decimal(amount), "expense_date": spend_day, "receipts": [receipt]})
            expense = create_expense(institution=institution, actor=employee.user, description=description, lines=rows)
            expense = submit_expense(expense=expense, actor=employee.user)
            if decision:
                step = expense.approvals.filter(status="PENDING").order_by("sequence").select_related("approver").first()
                if step is not None:
                    decide_expense_step(expense=expense, actor=step.approver, decision=decision)
            self._count("expense claims")

    # -------------------------------------------------- suppliers and customers

    def _suppliers_and_customers(self):
        institution, admin = self.institution, self.admin
        for code, name, email in (
            ("VND-APEX-007", "Volta Petroleum Supply Ltd", "orders@voltapetroleum.example.com"),
            ("VND-APEX-008", "Coastal Tanker Services", "billing@coastaltankers.example.com"),
            ("VND-APEX-009", "Ridge Safety Equipment Ltd", "sales@ridgesafety.example.com"),
        ):
            if not Vendor.objects.filter(institution=institution, vendor_code=code).exists():
                create_vendor(institution=institution, actor=admin, vendor_code=code, name=name, email=email, country_code="GH", is_active=True)
                self._count("suppliers and customers")
        for code, name, email in (
            ("CUS-APEX-005", "Kumasi Fuel Stations Ltd", "accounts@kumasifuel.example.com"),
            ("CUS-APEX-006", "Western Gold Mining Co.", "payables@westerngold.example.com"),
            ("CUS-APEX-007", "Akosombo Transport Union", "finance@akosombotransport.example.com"),
        ):
            if not Customer.objects.filter(institution=institution, customer_code=code).exists():
                create_customer(institution=institution, actor=admin, customer_code=code, name=name, email=email, country_code="GH", is_active=True)
                self._count("suppliers and customers")
        period = institution.accounting_periods.filter(start_date__lte=self.today, end_date__gte=self.today).first()
        if period is None:
            return
        revenue = institution.accounts.get(code="4100")
        for number, customer_code, text, amount in (
            ("INV-APX-0201", "CUS-APEX-005", "Premium petrol supply, 25,000 litres", "412500"),
            ("INV-APX-0202", "CUS-APEX-006", "Diesel supply to mine site, 60,000 litres", "936000"),
        ):
            if Invoice.objects.filter(institution=institution, invoice_number=number).exists():
                continue
            invoice = create_invoice(institution=institution, actor=admin, customer=Customer.objects.get(institution=institution, customer_code=customer_code), invoice_number=number, invoice_date=self.today - timedelta(days=5), due_date=self.today + timedelta(days=25), currency="GHS", accounting_period=period, lines=[{"description": text, "income_account": revenue, "quantity": Decimal("1"), "unit_price": Decimal(amount)}])
            issue_invoice(invoice=invoice, actor=admin)
            self._count("suppliers and customers")
        for number, vendor_code, account, text, amount in (
            ("BILL-APX-0301", "VND-APEX-008", "5400", "Tanker haulage Tema-Kumasi, 12 trips", "54000"),
            ("BILL-APX-0302", "VND-APEX-009", "5500", "Fire extinguishers and PPE for loading bays", "18750"),
        ):
            if VendorBill.objects.filter(institution=institution, bill_number=number).exists():
                continue
            bill = create_vendor_bill(institution=institution, actor=admin, vendor=Vendor.objects.get(institution=institution, vendor_code=vendor_code), bill_number=number, bill_date=self.today - timedelta(days=4), due_date=self.today + timedelta(days=26), currency="GHS", accounting_period=period, lines=[{"description": text, "expense_account": institution.accounts.get(code=account), "quantity": Decimal("1"), "unit_price": Decimal(amount)}])
            bill = submit_vendor_bill(bill=bill, actor=admin)
            if number.endswith("01"):
                # The Finance Manager approves; posting stays with finance.
                approver = institution.memberships.select_related("user").get(role__code="FINANCE_MANAGER", status="ACTIVE").user
                bill = approve_vendor_bill(bill=bill, actor=approver)
                post_vendor_bill(bill=bill, actor=admin)
            self._count("suppliers and customers")

    # ---------------------------------------------------------- depot vacancies

    def _vacancies(self):
        institution, admin = self.institution, self.admin
        stages = {stage.name: stage for stage in RecruitmentStage.objects.filter(institution=institution, is_active=True)}
        postings = (
            ("JOB-2026-00031", "HSSE Officer (Takoradi)", "DPT-007", "POS-018", "LOC-TKD-01", "Lead daily safety inspections and permit-to-work checks at the Takoradi terminal."),
            ("JOB-2026-00032", "Tanker Driver (Kumasi)", "DPT-008", "POS-020", "LOC-KSI-01", "Deliver petroleum products safely from the Kumasi depot to stations across Ashanti. Class F licence required."),
        )
        candidates = (
            ("JOB-2026-00031", "Esther", "Nkansah", "Interview"),
            ("JOB-2026-00031", "Prince", "Aidoo", "Shortlisted"),
            ("JOB-2026-00031", "Mavis", "Kumi", "Screening"),
            ("JOB-2026-00031", "Godfred", "Osei-Bonsu", "Applied"),
            ("JOB-2026-00032", "Alhassan", "Iddrisu", "Final Review"),
            ("JOB-2026-00032", "Emmanuel", "Asiedu", "Interview"),
            ("JOB-2026-00032", "Joseph", "Nyarko", "Screening"),
            ("JOB-2026-00032", "Samuel", "Akoto", "REJECTED"),
        )
        created_postings = {}
        for code, title, department, position, location, description in postings:
            posting = JobPosting.objects.filter(institution=institution, code=code).first()
            if posting is None:
                posting = JobPosting.objects.create(institution=institution, code=code, title=title, department=institution.departments.get(code=department), position=institution.positions.get(code=position), location=institution.locations.get(code=location), hiring_manager=admin, employment_type="PERMANENT" if position == "POS-018" else "CONTRACT", description=description)
                JobPosting.objects.filter(pk=posting.pk).update(status=JobPosting.Status.APPROVED, approved_by=admin, approved_at=timezone.now())
                posting.refresh_from_db()
                publish_job_posting(job_posting=posting, actor=admin)
                self._count("depot vacancies")
            created_postings[code] = posting
        for index, (job, first, last, stage) in enumerate(candidates):
            email = f"{first}.{last}@example.com".lower()
            if Candidate.objects.filter(institution=institution, email=email).exists():
                continue
            candidate = Candidate.objects.create(institution=institution, email=email, first_name=first, last_name=last, source=("LinkedIn", "Referral", "Company website", "Jobberman")[index % 4], location=("Takoradi, Ghana", "Kumasi, Ghana", "Tema, Ghana")[index % 3], years_experience=2 + index % 6)
            application = Application.objects.create(institution=institution, job_posting=created_postings[job], candidate=candidate, notes=f"{SEED} {job}")
            application = submit_application(application=application, actor=admin)
            if stage == "REJECTED":
                reject_application(application=application, actor=admin, reason="No Class F licence.")
            elif stage in stages and application.current_stage_id != stages[stage].id:
                move_application_stage(application=application, stage=stages[stage], actor=admin, comment="Progressed")
            self._count("depot vacancies")
