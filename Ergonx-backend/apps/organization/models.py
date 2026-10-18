from django.core.exceptions import ValidationError
from django.db import models

from apps.institutions.models import Institution
from common.codes import AutoCodeMixin
from common.models import TenantOwnedModel


class Department(AutoCodeMixin, TenantOwnedModel):
    auto_code_prefix = "DPT"
    auto_code_width = 3

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="departments"
    )
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)
    parent = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="children",
    )
    head = models.ForeignKey(
        "employees.Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="headed_departments",
        help_text="Department Head: approves team leave and sees this department's people.",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "code"),
                name="uniq_department_code_per_institution",
            )
        ]
        indexes = [models.Index(fields=("institution", "is_active"))]

    def clean(self):
        self.code = self.code.strip().upper()
        if self.parent_id and self.parent.institution_id != self.institution_id:
            raise ValidationError({"parent": "Parent department must be in the same institution."})
        if self.parent_id and self.parent_id == self.id:
            raise ValidationError({"parent": "A department cannot be its own parent."})
        if self.head_id and self.head.institution_id != self.institution_id:
            raise ValidationError({"head": "Department head must be an employee of the same institution."})

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.institution.code}: {self.name}"


class Position(AutoCodeMixin, TenantOwnedModel):
    auto_code_prefix = "POS"
    auto_code_width = 3

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="positions"
    )
    department = models.ForeignKey(
        Department, on_delete=models.PROTECT, related_name="positions"
    )
    title = models.CharField(max_length=150)
    code = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("title",)
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "code"),
                name="uniq_position_code_per_institution",
            )
        ]
        indexes = [
            models.Index(fields=("institution", "department")),
            models.Index(fields=("institution", "is_active")),
        ]

    def clean(self):
        self.code = self.code.strip().upper()
        if self.department_id and self.department.institution_id != self.institution_id:
            raise ValidationError({"department": "Department must be in the same institution."})

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.institution.code}: {self.title}"


class Grade(AutoCodeMixin, TenantOwnedModel):
    auto_code_prefix = "GRD"
    auto_code_width = 2

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="grades"
    )
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, blank=True)
    level = models.PositiveIntegerField(null=True, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("level", "name")
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "code"),
                name="uniq_grade_code_per_institution",
            )
        ]
        indexes = [models.Index(fields=("institution", "is_active"))]

    def clean(self):
        self.code = self.code.strip().upper()

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.institution.code}: {self.name}"


class Location(AutoCodeMixin, TenantOwnedModel):
    auto_code_prefix = "LOC"
    auto_code_width = 3

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="locations"
    )
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=2, blank=True)
    timezone = models.CharField(max_length=64, blank=True)
    is_remote = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class ClockLocationRule(models.TextChoices):
        OFF = "OFF", "Don't check location"
        RECORD = "RECORD", "Record location and flag off-site clocks"
        REQUIRE = "REQUIRE", "Only allow clocking on site"

    # Site position for location-checked clocking (self-service clocks only).
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    geofence_radius_m = models.PositiveIntegerField(default=200)
    clock_location_rule = models.CharField(max_length=8, choices=ClockLocationRule.choices, default=ClockLocationRule.OFF)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "code"),
                name="uniq_location_code_per_institution",
            )
        ]
        indexes = [models.Index(fields=("institution", "is_active"))]

    def clean(self):
        self.code = self.code.strip().upper()
        self.country = self.country.strip().upper()
        errors = {}
        if (self.latitude is None) != (self.longitude is None):
            errors["latitude"] = "Enter both latitude and longitude, or neither."
        if self.latitude is not None and not -90 <= self.latitude <= 90:
            errors["latitude"] = "Latitude must be between -90 and 90."
        if self.longitude is not None and not -180 <= self.longitude <= 180:
            errors["longitude"] = "Longitude must be between -180 and 180."
        if not 25 <= self.geofence_radius_m <= 20_000:
            errors["geofence_radius_m"] = "Use a radius between 25 m and 20 km."
        if self.clock_location_rule != self.ClockLocationRule.OFF and (self.latitude is None or self.is_remote):
            errors["clock_location_rule"] = "Set the site's position first. Remote locations can't check where people clock in."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        self.country = self.country.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.institution.code}: {self.name}"
