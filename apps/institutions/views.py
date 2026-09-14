from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.institutions.serializers import (
    CurrentInstitutionSerializer,
    MembershipSerializer,
)
from common.permissions import TenantContextPermission, TenantRBACPermission


class CurrentInstitutionView(APIView):
    permission_classes = [TenantContextPermission, TenantRBACPermission]
    required_module = None

    def get_required_permission(self):
        return "institution.view"

    @extend_schema(responses=CurrentInstitutionSerializer)
    def get(self, request):
        capabilities = list(
            request.institution.modules.filter(is_enabled=True)
            .order_by("module_code")
            .values_list("module_code", flat=True)
        )
        serializer = CurrentInstitutionSerializer(
            {
                "institution": request.institution,
                "membership": request.membership,
                "active_capabilities": capabilities,
            }
        )
        return Response(serializer.data)


class MyMembershipsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=MembershipSerializer(many=True))
    def get(self, request):
        memberships = request.user.memberships.select_related(
            "institution", "role"
        ).prefetch_related("role__permissions")
        return Response(MembershipSerializer(memberships, many=True).data)
