"""Who may see documents classified Restricted.

A Restricted document is visible only to holders of ``document.view_restricted`` and to the
person who uploaded it. Every staff-facing list or download of documents goes through
``hide_restricted``; self-service views of a person's own records do not, because people may
always see documents about themselves.
"""

from django.db.models import Q

from apps.documents.models import Document

VIEW_RESTRICTED = "document.view_restricted"


def can_view_restricted(request):
    from apps.institutions.services import effective_permission_codes

    membership = getattr(request, "membership", None)
    return membership is not None and VIEW_RESTRICTED in set(effective_permission_codes(membership))


def hide_restricted(queryset, request):
    if can_view_restricted(request):
        return queryset
    return queryset.filter(~Q(classification=Document.Classification.RESTRICTED) | Q(uploaded_by=request.user))
