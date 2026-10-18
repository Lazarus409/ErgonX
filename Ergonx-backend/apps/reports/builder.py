"""Custom report builder: allowlisted datasets, columns, filters and one grouping.

A definition is plain data, so it can be saved and re-run:

    {"columns": ["employee_number", "department", "status"],
     "filters": [{"field": "status", "op": "eq", "value": "ACTIVE"}],
     "group_by": "department", "aggregate": {"op": "count"},
     "sort": {"field": "department", "desc": false}, "limit": 500}

Each dataset names the permission and module that guard it and applies the
same employee scoping as its module, so the builder never shows anything its
user could not already open. Payroll amounts and personal identifiers (date
of birth, phone, personal email, national ids) are deliberately not offered.
"""

from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db.models import Avg, CharField, Count, F, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Concat, TruncDate
from django.utils.dateparse import parse_date

from common.scoping import ATTENDANCE_BROAD, LEAVE_BROAD, scope_to_employees

MAX_LIMIT = 1000
OPS = {"eq": "exact", "ne": None, "contains": "icontains", "gt": "gt", "gte": "gte", "lt": "lt", "lte": "lte", "in": "in"}


def _current(field, employee_path):
    from apps.employees.models import Employment

    return Subquery(Employment.objects.filter(employee=OuterRef(employee_path), is_current=True).values(field)[:1], output_field=CharField())


def _employee_fields(prefix):
    """Common columns about the employee a row belongs to (prefix is the path to the Employee, '' for employees)."""
    path = f"{prefix}__" if prefix else ""
    employee_ref = prefix or "pk"
    return {
        "employee_number": ("Employee no.", "text", F(f"{path}employee_number")),
        "employee_name": ("Employee", "text", Concat(F(f"{path}first_name"), Value(" "), F(f"{path}last_name"), output_field=CharField())),
        "department": ("Department", "text", _current("department__name", employee_ref)),
        "position": ("Position", "text", _current("position__title", employee_ref)),
        "location": ("Location", "text", _current("location__name", employee_ref)),
        "employment_type": ("Employment type", "choice", _current("employment_type", employee_ref)),
    }


def _datasets():
    from apps.attendance.models import AttendanceRecord
    from apps.employees.models import Employee
    from apps.leave.models import LeaveRequest
    from apps.recruitment.models import Application
    from apps.training.models import TrainingEnrollment

    return {
        "employees": {
            "label": "Employees", "module": "CORE_HR", "permission": "employee.view",
            "queryset": lambda institution: Employee.objects.for_institution(institution), "scope": ("", None),
            "fields": {
                **_employee_fields(""),
                "status": ("Status", "choice", F("status")),
                "gender": ("Gender", "choice", F("gender")),
                "hire_date": ("Hire date", "date", F("hire_date")),
                "work_email": ("Work email", "text", F("work_email")),
            },
        },
        "leave_requests": {
            "label": "Leave requests", "module": "LEAVE", "permission": "leave.view",
            "queryset": lambda institution: LeaveRequest.objects.for_institution(institution), "scope": ("employee", LEAVE_BROAD),
            "fields": {
                **_employee_fields("employee"),
                "leave_type": ("Leave type", "text", F("leave_type__name")),
                "status": ("Status", "choice", F("status")),
                "start_date": ("Start", "date", F("start_date")),
                "end_date": ("End", "date", F("end_date")),
                "days": ("Days", "number", F("requested_days")),
            },
        },
        "attendance": {
            "label": "Attendance records", "module": "ATTENDANCE", "permission": "attendance.view",
            "queryset": lambda institution: AttendanceRecord.objects.for_institution(institution), "scope": ("employee", ATTENDANCE_BROAD),
            "fields": {
                **_employee_fields("employee"),
                "date": ("Date", "date", F("attendance_date")),
                "status": ("Status", "choice", F("status")),
                "worked_minutes": ("Worked (min)", "number", F("worked_minutes")),
                "late_minutes": ("Late (min)", "number", F("late_minutes")),
                "overtime_minutes": ("Overtime (min)", "number", F("overtime_minutes")),
                "source": ("Source", "choice", F("source")),
            },
        },
        "training": {
            "label": "Training enrolments", "module": "CORE_HR", "permission": "training.view",
            "queryset": lambda institution: TrainingEnrollment.objects.for_institution(institution), "scope": ("employee", None),
            "fields": {
                **_employee_fields("employee"),
                "course": ("Course", "text", F("course__title")),
                "status": ("Status", "choice", F("status")),
                "planned_end": ("Due", "date", F("planned_end")),
                "completed_on": ("Completed", "date", F("completed_on")),
                "score": ("Score", "number", F("score")),
                "certificate_expires_on": ("Certificate expires", "date", F("certificate_expires_on")),
            },
        },
        "applications": {
            "label": "Job applications", "module": "RECRUITMENT", "permission": "candidate.view",
            "queryset": lambda institution: Application.objects.for_institution(institution), "scope": None,
            "fields": {
                "job": ("Job", "text", F("job_posting__title")),
                "department": ("Department", "text", F("job_posting__department__name")),
                "status": ("Status", "choice", F("status")),
                "stage": ("Stage", "text", F("current_stage__name")),
                "source": ("Source", "choice", F("source")),
                "applied_at": ("Applied", "date", TruncDate("applied_at")),
            },
        },
    }


def available_datasets(permissions, enabled_modules):
    result = []
    for key, dataset in _datasets().items():
        if dataset["permission"] in permissions and (dataset["module"] == "CORE_HR" or dataset["module"] in enabled_modules):
            result.append({"key": key, "label": dataset["label"], "fields": [{"key": name, "label": label, "type": kind} for name, (label, kind, _) in dataset["fields"].items()]})
    return result


def _value(kind, raw):
    if kind == "date":
        parsed = parse_date(str(raw))
        if parsed is None:
            raise ValidationError({"filters": f"Use YYYY-MM-DD for dates, not {raw!r}."})
        return parsed
    if kind == "number":
        try:
            return Decimal(str(raw))
        except Exception as exc:  # noqa: BLE001 - any bad number is a user error here
            raise ValidationError({"filters": f"{raw!r} is not a number."}) from exc
    return str(raw)[:200]


def validate(dataset_key, definition, *, permissions, enabled_modules):
    datasets = _datasets()
    dataset = datasets.get(dataset_key)
    if dataset is None or dataset_key not in {row["key"] for row in available_datasets(permissions, enabled_modules)}:
        raise ValidationError({"dataset": "Choose a dataset you have access to."})
    fields = dataset["fields"]
    columns = [column for column in definition.get("columns") or [] if column in fields]
    if not columns or len(columns) != len(definition.get("columns") or []):
        raise ValidationError({"columns": "Choose one or more columns from this dataset."})
    filters = []
    for row in definition.get("filters") or []:
        field, op = row.get("field"), row.get("op")
        if field not in fields or op not in OPS:
            raise ValidationError({"filters": "Each filter needs a field from this dataset and a valid comparison."})
        kind = fields[field][1]
        if op in ("gt", "gte", "lt", "lte") and kind not in ("date", "number"):
            raise ValidationError({"filters": f"{fields[field][0]} can't be compared with greater/less than."})
        value = [_value(kind, item) for item in row.get("value", [])][:50] if op == "in" else _value(kind, row.get("value", ""))
        filters.append((field, op, value))
    group_by = definition.get("group_by") or None
    if group_by and group_by not in fields:
        raise ValidationError({"group_by": "Group by a field from this dataset."})
    aggregate = definition.get("aggregate") or {"op": "count"}
    if group_by:
        if aggregate.get("op") not in ("count", "sum", "avg"):
            raise ValidationError({"aggregate": "Use count, sum or average."})
        if aggregate.get("op") != "count" and fields.get(aggregate.get("field"), (None, None))[1] != "number":
            raise ValidationError({"aggregate": "Sum and average need a number field."})
    sort = definition.get("sort") or {}
    if sort.get("field") and sort["field"] not in fields and sort["field"] != "value":
        raise ValidationError({"sort": "Sort by a column in the report."})
    limit = min(int(definition.get("limit") or 500), MAX_LIMIT)
    return {"columns": columns, "filters": filters, "group_by": group_by, "aggregate": aggregate, "sort": sort, "limit": limit}


def run(request, dataset_key, definition):
    from apps.institutions.services import effective_permission_codes

    permissions = set(effective_permission_codes(request.membership))
    enabled = set(request.institution.modules.filter(is_enabled=True).values_list("module_code", flat=True))
    clean = validate(dataset_key, definition, permissions=permissions, enabled_modules=enabled)
    dataset = _datasets()[dataset_key]
    fields = dataset["fields"]
    queryset = dataset["queryset"](request.institution)
    if dataset["scope"] is not None:
        path, broad = dataset["scope"]
        queryset = scope_to_employees(queryset, request, path, broad=broad)
    needed = set(clean["columns"]) | {field for field, _, _ in clean["filters"]} | ({clean["group_by"]} if clean["group_by"] else set())
    if clean["group_by"] and clean["aggregate"].get("field"):
        needed.add(clean["aggregate"]["field"])
    queryset = queryset.annotate(**{f"r_{name}": fields[name][2] for name in needed})
    for field, op, value in clean["filters"]:
        if op == "ne":
            queryset = queryset.exclude(**{f"r_{field}": value})
        else:
            queryset = queryset.filter(**{f"r_{field}__{OPS[op]}": value})
    if clean["group_by"]:
        group = f"r_{clean['group_by']}"
        aggregate = clean["aggregate"]
        measure = {"count": Count("pk"), "sum": Sum(f"r_{aggregate.get('field')}"), "avg": Avg(f"r_{aggregate.get('field')}")}[aggregate["op"]]
        rows = queryset.values(group).annotate(value=measure)
        descending = clean["sort"].get("desc", True)
        order = "value" if clean["sort"].get("field") in (None, "", "value") else group
        rows = rows.order_by(f"-{order}" if descending else order)
        total = rows.count()
        rows = list(rows[: clean["limit"]])
        label = {"count": "Count", "sum": f"Total {fields[aggregate.get('field')][0].lower()}" if aggregate.get("field") else "Total", "avg": f"Average {fields[aggregate.get('field')][0].lower()}" if aggregate.get("field") else "Average"}[aggregate["op"]]
        columns = [{"key": clean["group_by"], "label": fields[clean["group_by"]][0], "type": fields[clean["group_by"]][1]}, {"key": "value", "label": label, "type": "number"}]
        data = [{clean["group_by"]: _plain(row[group]), "value": _plain(row["value"])} for row in rows]
    else:
        sort = clean["sort"]
        if sort.get("field") in fields:
            queryset = queryset.order_by(f"-r_{sort['field']}" if sort.get("desc") else f"r_{sort['field']}")
        else:
            queryset = queryset.order_by("pk")
        total = queryset.count()
        rows = list(queryset.values(*[f"r_{name}" for name in clean["columns"]])[: clean["limit"]])
        columns = [{"key": name, "label": fields[name][0], "type": fields[name][1]} for name in clean["columns"]]
        data = [{name: _plain(row[f"r_{name}"]) for name in clean["columns"]} for row in rows]
    return {"dataset": dataset_key, "columns": columns, "rows": data, "total": total, "truncated": total > len(data)}


def _plain(value):
    if isinstance(value, Decimal):
        return float(round(value, 2))
    if isinstance(value, date):
        return value.isoformat()
    return value
