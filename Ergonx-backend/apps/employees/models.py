from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.institutions.models import Institution
from apps.organization.models import Department, Grade, Location, Position
from common.models import TenantOwnedModel


class Employee(TenantOwnedModel):
    class Gender(models.TextChoices):
        MALE = "MALE", "Male"
        FEMALE = "FEMALE", "Female"
        OTHER = "OTHER", "Other"
        PREFER_NOT_TO_SAY = "PREFER_NOT_TO_SAY", "Prefer not to say"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"
        SUSPENDED = "SUSPENDED", "Suspended"
        TERMINATED = "TERMINATED", "Terminated"

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="employees"
    )
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="employee_profile",
    )
    employee_number = models.CharField(max_length=50)
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100)
    personal_email = models.EmailField(blank=True)
    work_email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(
        max_length=20,
        choices=Gender.choices,
        default=Gender.PREFER_NOT_TO_SAY,
    )
    hire_date = models.DateField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        ordering = ("last_name", "first_name", "employee_number")
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "employee_number"),
                name="uniq_employee_number_per_institution",
            )
        ]
        indexes = [
            models.Index(fields=("institution", "status")),
            models.Index(fields=("institution", "employee_number")),
            models.Index(fields=("institution", "created_at")),
            models.Index(fields=("institution", "last_name")),
        ]

    def clean(self):
        self.employee_number = self.employee_number.strip().upper()
        if self.user_id and self.institution_id:
            if not self.user.memberships.filter(institution_id=self.institution_id).exists():
                raise ValidationError(
                    {"user": "Linked user must have a membership in the same institution."}
                )

    def save(self, *args, **kwargs):
        self.employee_number = self.employee_number.strip().upper()
        super().save(*args, **kwargs)

    @property
    def full_name(self):
        return " ".join(
            part for part in (self.first_name, self.middle_name, self.last_name) if part
        )

    def __str__(self):
        return f"{self.employee_number} - {self.full_name}"


class Employment(TenantOwnedModel):
    class EmploymentType(models.TextChoices):
        PERMANENT = "PERMANENT", "Permanent"
        CONTRACT = "CONTRACT", "Contract"
        TEMPORARY = "TEMPORARY", "Temporary"
        INTERN = "INTERN", "Intern"
        CASUAL = "CASUAL", "Casual"

    class StaffCategory(models.TextChoices):
        JUNIOR = "JUNIOR", "Junior"
        SENIOR = "SENIOR", "Senior"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        ENDED = "ENDED", "Ended"
        SUSPENDED = "SUSPENDED", "Suspended"

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="employments"
    )
    employee = models.ForeignKey(
        Employee, on_delete=models.PROTECT, related_name="employments"
    )
    department = models.ForeignKey(
        Department, on_delete=models.PROTECT, related_name="employments"
    )
    position = models.ForeignKey(
        Position, on_delete=models.PROTECT, related_name="employments"
    )
    grade = models.ForeignKey(
        Grade,
        on_delete=models.PROTECT,
        related_name="employments",
    )
    location = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        related_name="employments",
    )
    reports_to = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="direct_reports",
    )
    employment_type = models.CharField(max_length=12, choices=EmploymentType.choices)
    staff_category = models.CharField(
        max_length=10, choices=StaffCategory.choices, default=StaffCategory.OTHER
    )
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    is_current = models.BooleanField(default=True)

    class Meta:
        ordering = ("-start_date", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("employee",),
                condition=models.Q(is_current=True),
                name="uniq_current_employment_per_employee",
            ),
            models.CheckConstraint(
                condition=models.Q(is_current=False) | models.Q(end_date__isnull=True),
                name="current_employment_has_no_end_date",
            ),
        ]
        indexes = [
            models.Index(fields=("institution", "status")),
            models.Index(fields=("institution", "is_current")),
            models.Index(fields=("employee", "is_current")),
        ]

    def clean(self):
        errors = {}
        tenant_relations = {
            "employee": self.employee if self.employee_id else None,
            "department": self.department if self.department_id else None,
            "position": self.position if self.position_id else None,
            "grade": self.grade if self.grade_id else None,
            "location": self.location if self.location_id else None,
            "reports_to": self.reports_to if self.reports_to_id else None,
        }
        for field, related in tenant_relations.items():
            if related and related.institution_id != self.institution_id:
                errors[field] = "Referenced record must belong to the same institution."
        if self.position_id and self.department_id:
            if self.position.department_id != self.department_id:
                errors["position"] = "Position must belong to the selected department."
        if self.reports_to_id and self.reports_to_id == self.id:
            errors["reports_to"] = "An employment cannot report to itself."
        if self.end_date and self.end_date < self.start_date:
            errors["end_date"] = "End date cannot precede start date."
        if self.is_current and self.end_date:
            errors["end_date"] = "A current employment cannot have an end date."
        if self.is_current and self.status == self.Status.ENDED:
            errors["status"] = "An ended employment cannot be current."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.employee} - {self.position}"


class EmergencyContact(TenantOwnedModel):
    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="emergency_contacts"
    )
    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="emergency_contacts"
    )
    full_name = models.CharField(max_length=200)
    relationship = models.CharField(max_length=100)
    phone = models.CharField(max_length=30)
    alternate_phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=300, blank=True)
    is_primary = models.BooleanField(default=False)

    class Meta:
        ordering = ("employee", "-is_primary", "full_name")
        constraints = [
            models.UniqueConstraint(
                fields=("employee",),
                condition=models.Q(is_primary=True),
                name="uniq_primary_emergency_contact_per_employee",
            )
        ]
        indexes = [models.Index(fields=("institution", "employee"))]

    def clean(self):
        if self.employee_id and self.employee.institution_id != self.institution_id:
            raise ValidationError(
                {"employee": "Employee must belong to the same institution."}
            )

class EmployeeOnboarding(TenantOwnedModel):
    class Status(models.TextChoices):
        NOT_STARTED = "NOT_STARTED", "Not started"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        BLOCKED = "BLOCKED", "Blocked"
        READY_FOR_ACTIVATION = "READY_FOR_ACTIVATION", "Ready for activation"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="employee_onboarding_records"
    )
    employee = models.ForeignKey(
        Employee, on_delete=models.PROTECT, related_name="onboarding_records"
    )
    status = models.CharField(
        max_length=24, choices=Status.choices, default=Status.NOT_STARTED
    )
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("institution", "status"))]

    def clean(self):
        if self.employee_id and self.employee.institution_id != self.institution_id:
            raise ValidationError(
                {"employee": "Employee must belong to the same institution."}
            )

class EmployeeOffboarding(TenantOwnedModel):
    class Status(models.TextChoices):
        NOT_STARTED = "NOT_STARTED", "Not started"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        BLOCKED = "BLOCKED", "Blocked"
        READY_TO_TERMINATE = "READY_TO_TERMINATE", "Ready to terminate"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="employee_offboarding_records"
    )
    employee = models.ForeignKey(
        Employee, on_delete=models.PROTECT, related_name="offboarding_records"
    )
    status = models.CharField(
        max_length=24, choices=Status.choices, default=Status.NOT_STARTED
    )
    initiated_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    last_working_day = models.DateField(null=True, blank=True)
    reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("institution", "status"))]

    def clean(self):
        if self.employee_id and self.employee.institution_id != self.institution_id:
            raise ValidationError(
                {"employee": "Employee must belong to the same institution."}
            )
