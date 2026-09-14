from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.employees.models import Employee, Employment


@transaction.atomic
def create_employment(*, institution, employee, **values):
    if employee.institution_id != institution.id:
        raise ValidationError(
            {"employee": "Employee must belong to the selected institution."}
        )
    employment = Employment(
        institution=institution,
        employee=employee,
        **values,
    )
    employment.full_clean()
    employment.save()
    return employment


@transaction.atomic
def change_current_employment(*, institution, employee, start_date, **values):
    locked_employee = Employee.objects.select_for_update().get(pk=employee.pk)
    if locked_employee.institution_id != institution.id:
        raise ValidationError(
            {"employee": "Employee must belong to the selected institution."}
        )

    current = (
        Employment.objects.select_for_update()
        .filter(employee=locked_employee, is_current=True)
        .first()
    )
    if current:
        if start_date <= current.start_date:
            raise ValidationError(
                {"start_date": "A new current employment must start after the current record."}
            )
        current.is_current = False
        current.status = Employment.Status.ENDED
        current.end_date = start_date - timedelta(days=1)
        current.save(update_fields=("is_current", "status", "end_date", "updated_at"))

    employment = Employment(
        institution=institution,
        employee=locked_employee,
        start_date=start_date,
        is_current=True,
        **values,
    )
    employment.full_clean()
    employment.save()
    return employment
