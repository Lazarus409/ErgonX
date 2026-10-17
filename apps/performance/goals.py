"""Goals (OKRs): who may see and change them, check-ins and progress.

Who does what:

* company goals - HR (``performance.manage``) sets them; everyone sees them once active;
* department goals - HR or the department's head; everyone sees them once active;
* individual goals - the employee drafts them, their manager (line manager or
  department head) or HR agrees them, which makes them active. The employee,
  their manager, and anyone with ``performance.view`` can see them.

Once a goal is active its title and key-result targets change only by the
manager or HR; the owner moves it forward with check-ins.
"""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event
from apps.employees.models import Employee, Employment
from apps.performance.models import Goal, GoalCheckIn, KeyResult
from apps.performance.services import default_reviewer
from common.scoping import headed_department_ids


class GoalAccess:
    """Per-request answers to "may this user see / change / check in on this goal?"."""

    def __init__(self, user, institution, permissions):
        self.user = user
        self.institution = institution
        self.is_hr_manager = "performance.manage" in permissions
        self.is_hr_viewer = self.is_hr_manager or "performance.view" in permissions
        self.headed = set(headed_department_ids(user, institution))
        self.employee = Employee.objects.for_institution(institution).filter(user=user).first()
        self._departments = {}

    def _department_of(self, employee_id):
        if employee_id not in self._departments:
            self._departments[employee_id] = Employment.objects.filter(employee_id=employee_id, is_current=True).values_list("department_id", flat=True).first()
        return self._departments[employee_id]

    def manages(self, employee):
        if employee is None or employee.user_id == self.user.id:
            return False
        if self._department_of(employee.id) in self.headed:
            return True
        reviewer = default_reviewer(employee)
        return reviewer is not None and reviewer.id == self.user.id

    def owns(self, goal):
        if goal.level == Goal.Level.INDIVIDUAL:
            return goal.employee is not None and goal.employee.user_id == self.user.id
        if goal.level == Goal.Level.DEPARTMENT:
            return goal.department_id in self.headed
        return self.is_hr_manager

    def can_view(self, goal):
        if goal.level != Goal.Level.INDIVIDUAL:
            return goal.status != Goal.Status.DRAFT or self.can_manage(goal)
        return self.is_hr_viewer or self.owns(goal) or self.manages(goal.employee)

    def can_manage(self, goal):
        """Change title, targets and status (agree, complete, cancel)."""
        if self.is_hr_manager:
            return True
        if goal.level == Goal.Level.DEPARTMENT:
            return goal.department_id in self.headed
        if goal.level == Goal.Level.INDIVIDUAL:
            return self.manages(goal.employee)
        return False

    def can_edit(self, goal):
        """Edit content: managers any time it is open, the owner while it is a draft."""
        if goal.status in (Goal.Status.COMPLETED, Goal.Status.CANCELLED):
            return False
        return self.can_manage(goal) or (goal.status == Goal.Status.DRAFT and self.owns(goal))

    def can_check_in(self, goal):
        return goal.status == Goal.Status.ACTIVE and (self.owns(goal) or self.can_manage(goal))

    def can_create(self, level, *, employee=None, department_id=None):
        if self.is_hr_manager:
            return True
        if level == Goal.Level.DEPARTMENT:
            return department_id in self.headed
        if level == Goal.Level.INDIVIDUAL:
            return employee is not None and (employee.user_id == self.user.id or self.manages(employee))
        return False


def recalculate(goal):
    results = list(goal.key_results.all())
    if results:
        goal.progress = round(sum(result.progress for result in results) / len(results))
    return goal.progress


def _save_key_results(goal, key_results):
    """Replaces the goal's key results with ``key_results`` (dicts; an ``id`` keeps an existing one)."""
    existing = {str(result.id): result for result in goal.key_results.all()}
    keep = set()
    for order, values in enumerate(key_results, start=1):
        result = existing.get(str(values.get("id") or "")) or KeyResult(institution=goal.institution, goal=goal)
        result.title = values["title"].strip()
        result.unit = (values.get("unit") or "").strip()
        result.start_value = values.get("start_value", 0) or 0
        result.target_value = values["target_value"]
        if result.pk is None:
            result.current_value = values.get("current_value", result.start_value)
        result.sort_order = order
        result.save()
        keep.add(str(result.id))
    for key, result in existing.items():
        if key not in keep:
            result.delete()


@transaction.atomic
def create_goal(*, access, institution, actor, key_results, **values):
    level = values["level"]
    if not access.can_create(level, employee=values.get("employee"), department_id=getattr(values.get("department"), "id", None)):
        raise ValidationError({"level": "You can't set goals at this level for this person or department."})
    goal = Goal(institution=institution, created_by=actor, **values)
    # A manager or HR setting someone's goal agrees it at once; one's own goal starts as a draft.
    # Company and department goals start as drafts until their owner activates them.
    owner = values.get("employee")
    if level == Goal.Level.INDIVIDUAL and owner is not None and owner.user_id != actor.id and (access.manages(owner) or access.is_hr_manager):
        goal.status, goal.agreed_by, goal.agreed_at = Goal.Status.ACTIVE, actor, timezone.now()
    goal.save()
    _save_key_results(goal, key_results)
    recalculate(goal)
    goal.save(update_fields=("progress", "updated_at"))
    record_audit_event(actor=actor, institution=institution, entity=goal, action="performance.goal.created", metadata={"title": goal.title, "level": goal.level})
    return goal


@transaction.atomic
def update_goal(*, access, goal, actor, key_results=None, **values):
    goal = Goal.objects.select_for_update().get(pk=goal.pk)
    if not access.can_edit(goal):
        raise ValidationError({"goal": "You can't edit this goal."})
    for field in ("title", "description", "period_start", "period_end", "parent"):
        if field in values:
            setattr(goal, field, values[field])
    goal.save()
    if key_results is not None:
        _save_key_results(goal, key_results)
    recalculate(goal)
    goal.save(update_fields=("progress", "updated_at"))
    record_audit_event(actor=actor, institution=goal.institution, entity=goal, action="performance.goal.updated", metadata={"title": goal.title})
    return goal


@transaction.atomic
def set_status(*, access, goal, actor, status):
    goal = Goal.objects.select_for_update().get(pk=goal.pk)
    allowed = {
        Goal.Status.ACTIVE: (Goal.Status.DRAFT,),
        Goal.Status.COMPLETED: (Goal.Status.ACTIVE,),
        Goal.Status.CANCELLED: (Goal.Status.DRAFT, Goal.Status.ACTIVE),
    }
    if goal.status not in allowed[status]:
        raise ValidationError({"status": f"A {goal.get_status_display().lower()} goal can't become {Goal.Status(status).label.lower()}."})
    if status == Goal.Status.ACTIVE and not access.can_manage(goal):
        raise ValidationError({"status": "Your manager or HR agrees your goals."})
    if status == Goal.Status.COMPLETED and not (access.can_manage(goal) or access.owns(goal)):
        raise ValidationError({"status": "You can't complete this goal."})
    if status == Goal.Status.CANCELLED and not (access.can_manage(goal) or (goal.status == Goal.Status.DRAFT and access.owns(goal))):
        raise ValidationError({"status": "Only a manager or HR can cancel an agreed goal."})
    previous = goal.status
    goal.status = status
    if status == Goal.Status.ACTIVE:
        goal.agreed_by, goal.agreed_at = actor, timezone.now()
    goal.save()
    record_audit_event(actor=actor, institution=goal.institution, entity=goal, action="performance.goal.status_changed", metadata={"title": goal.title, "changes": {"status": [previous, status]}})
    return goal


@transaction.atomic
def check_in(*, access, goal, actor, health, note="", values=None, progress=None):
    goal = Goal.objects.select_for_update().get(pk=goal.pk)
    if not access.can_check_in(goal):
        raise ValidationError({"goal": "Check-ins are for active goals, by the goal's owner or manager."})
    results = {str(result.id): result for result in goal.key_results.all()}
    for key, value in (values or {}).items():
        result = results.get(str(key))
        if result is None:
            raise ValidationError({"values": "Unknown key result."})
        result.current_value = value
        result.save(update_fields=("current_value", "updated_at"))
    if results:
        recalculate(goal)
    elif progress is not None:
        goal.progress = max(0, min(100, int(progress)))
    goal.health = health
    goal.last_check_in_at = timezone.now()
    goal.save()
    entry = GoalCheckIn(
        institution=goal.institution, goal=goal, author=actor, health=health, progress=goal.progress, note=(note or "").strip(),
        values={key: str(result.current_value) for key, result in results.items()},
    )
    entry.save()
    record_audit_event(actor=actor, institution=goal.institution, entity=goal, action="performance.goal.checked_in", metadata={"title": goal.title, "health": health, "progress": goal.progress})
    return goal
