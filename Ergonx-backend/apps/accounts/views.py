from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.utils import extend_schema

from apps.accounts.serializers import (
    AuthBootstrapSerializer,
    EmailTokenObtainPairSerializer,
    UserSerializer,
)
from apps.institutions.services import effective_permission_codes
from common.permissions import TenantContextPermission


class LoginView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


class RefreshView(TokenRefreshView):
    pass


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=UserSerializer)
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class AuthBootstrapView(APIView):
    permission_classes = [TenantContextPermission]

    @extend_schema(responses=AuthBootstrapSerializer)
    def get(self, request):
        permission_codes = effective_permission_codes(request.membership)
        enabled_modules = list(
            request.institution.modules.filter(is_enabled=True)
            .order_by("module_code")
            .values_list("module_code", flat=True)
        )
        onboarding = getattr(request.institution, "onboarding", None)
        onboarding_ready = bool(onboarding and onboarding.status == "READY")
        dashboards = [
            code.removeprefix("dashboard.").removesuffix(".view")
            for code in permission_codes
            if code.startswith("dashboard.") and code.endswith(".view")
        ]
        if "employee.view" in permission_codes:
            landing = "HOME"
        elif dashboards:
            landing = "DASHBOARD"
        else:
            landing = "HOME"
        payload = {
            "user": request.user,
            "active_institution": {
                "id": str(request.institution.id),
                "code": request.institution.code,
                "name": request.institution.name,
                "timezone": request.institution.timezone,
            },
            "active_membership": {
                "id": str(request.membership.id),
                "role_code": request.membership.role.code,
                "role_name": request.membership.role.name,
                "status": request.membership.status,
            },
            "effective_permissions": list(permission_codes),
            "enabled_modules": enabled_modules,
            "onboarding_ready": onboarding_ready,
            "onboarding_status": onboarding.status if onboarding else "NOT_STARTED",
            "default_landing": landing,
            "available_dashboards": sorted(dashboards),
        }
        return Response(AuthBootstrapSerializer(payload).data)
