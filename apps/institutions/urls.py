from django.urls import path

from apps.institutions.views import CurrentInstitutionView, MyMembershipsView

urlpatterns = [
    path("current/", CurrentInstitutionView.as_view(), name="current"),
    path("memberships/", MyMembershipsView.as_view(), name="memberships"),
]
