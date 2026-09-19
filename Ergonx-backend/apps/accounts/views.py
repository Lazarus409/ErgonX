from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.conf import settings
from django.core.mail import BadHeaderError
from smtplib import SMTPException
from django.utils import timezone
from datetime import timedelta
from django.utils.crypto import salted_hmac
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.db import transaction
from django.utils.text import slugify
from uuid import uuid4
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema

from apps.accounts.serializers import (
    AuthBootstrapSerializer,
    EmailTokenObtainPairSerializer,
    UserSerializer,
    SelfServiceRegistrationSerializer,
    InstitutionAdminInvitationCreateSerializer,
    InstitutionAdminInvitationAcceptanceSerializer,
    InstitutionAdminInvitationSerializer,
    AccountProfileSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
)
from apps.institutions.services import create_membership, effective_permission_codes
from apps.institutions.models import Institution, InstitutionInvitation, InstitutionMembership, InstitutionModule, Role
from apps.accounts.models import InstitutionAdminInvitation, User
from apps.employees.models import Employee
from apps.accounts.emails import send_institution_admin_invitation, send_password_reset
from common.permissions import TenantContextPermission


class LoginView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


class SelfServiceRegistrationView(APIView):
    """Legacy endpoint retained only to give public users a clear response."""

    permission_classes = [AllowAny]

    @staticmethod
    def _institution_code(name):
        stem = slugify(name).upper().replace("_", "-")[:42] or "INSTITUTION"
        return f"{stem}-{uuid4().hex[:6].upper()}"

    @transaction.atomic
    @extend_schema(request=SelfServiceRegistrationSerializer, responses={201: UserSerializer})
    def post(self, request):
        raise PermissionDenied("Organization creation is available only through an Institution Admin invitation.")


class InstitutionAdminInvitationView(APIView):
    """Platform-only issuance and public acceptance of new-tenant invitations."""

    permission_classes = [IsAuthenticated]

    def _assert_platform_admin(self, request):
        if not (request.user.is_platform_admin or request.user.is_superuser):
            raise PermissionDenied("Only a platform administrator can manage Institution Admin invitations.")

    @extend_schema(responses=InstitutionAdminInvitationSerializer(many=True))
    def get(self, request):
        self._assert_platform_admin(request)
        invitations = InstitutionAdminInvitation.objects.select_related("invited_by").order_by("-created_at")
        return Response(InstitutionAdminInvitationSerializer(invitations, many=True).data)

    @extend_schema(request=InstitutionAdminInvitationCreateSerializer)
    def post(self, request):
        self._assert_platform_admin(request)
        serializer = InstitutionAdminInvitationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = uuid4().hex + uuid4().hex
        invitation = InstitutionAdminInvitation.objects.create(
            email=serializer.validated_data["email"],
            token_hash=salted_hmac("institution-admin-invitation", token).hexdigest(),
            expires_at=timezone.now() + timedelta(hours=serializer.validated_data["expires_in_hours"]),
            invited_by=request.user,
        )
        delivery_status = "MANUAL_DELIVERY_REQUIRED"
        if settings.EMAIL_DELIVERY_ENABLED:
            try:
                send_institution_admin_invitation(
                    recipient_email=invitation.email,
                    acceptance_token=token,
                    expires_at=invitation.expires_at,
                )
                delivery_status = "SENT"
            except (BadHeaderError, OSError, SMTPException):
                delivery_status = "FAILED"
        return Response({"id": str(invitation.id), "email": invitation.email, "expires_at": invitation.expires_at, "acceptance_token": token, "email_delivery_status": delivery_status}, status=201)


class InstitutionAdminInvitationAcceptanceView(APIView):
    permission_classes = [AllowAny]

    @staticmethod
    def _institution_code(name):
        stem = slugify(name).upper().replace("_", "-")[:42] or "INSTITUTION"
        return f"{stem}-{uuid4().hex[:6].upper()}"

    def _invitation(self, token):
        digest = salted_hmac("institution-admin-invitation", token).hexdigest()
        invitation = InstitutionAdminInvitation.objects.filter(token_hash=digest, status="PENDING").first()
        if invitation is None or invitation.expires_at <= timezone.now():
            if invitation is not None:
                invitation.status = InstitutionAdminInvitation.Status.EXPIRED
                invitation.save(update_fields=("status", "updated_at"))
            return None
        return invitation

    def get(self, request, token):
        invitation = self._invitation(token)
        if invitation is None:
            return Response({"detail": "Invitation is invalid or expired."}, status=404)
        return Response({"email": invitation.email, "expires_at": invitation.expires_at})

    @transaction.atomic
    def post(self, request, token):
        invitation = self._invitation(token)
        if invitation is None:
            return Response({"detail": "Invitation is invalid or expired."}, status=404)
        payload = request.data.copy()
        payload["email"] = invitation.email
        serializer = InstitutionAdminInvitationAcceptanceSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        if User.objects.filter(email=invitation.email).exists():
            return Response({"detail": "An account already exists for this email. Sign in or ask the platform administrator to issue a new invitation."}, status=409)
        user = User.objects.create_user(email=invitation.email, password=values["password"], first_name=values["first_name"].strip(), last_name=values["last_name"].strip())
        institution = Institution.objects.create(name=values["institution_name"], code=self._institution_code(values["institution_name"]), country_code=values["country_code"].upper(), default_currency=values["default_currency"].upper(), timezone=values["timezone"], email=invitation.email)
        role = Role.objects.get(institution=institution, code="INSTITUTION_ADMIN")
        create_membership(user=user, institution=institution, role=role, status=InstitutionMembership.Status.ACTIVE, is_primary=True, joined_at=timezone.now())
        invitation.status = InstitutionAdminInvitation.Status.ACCEPTED
        invitation.accepted_at = timezone.now()
        invitation.save(update_fields=("status", "accepted_at", "updated_at"))
        refresh = RefreshToken.for_user(user)
        return Response({"access": str(refresh.access_token), "refresh": str(refresh), "user": UserSerializer(user).data, "institution": {"id": str(institution.id), "name": institution.name, "code": institution.code}}, status=201)


class RefreshView(TokenRefreshView):
    pass


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=UserSerializer)
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class AccountProfileView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=AccountProfileSerializer)
    def get(self, request):
        return Response(AccountProfileSerializer(request.user).data)

    @extend_schema(request=AccountProfileSerializer, responses=AccountProfileSerializer)
    def patch(self, request):
        serializer = AccountProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=PasswordChangeSerializer)
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=("password", "updated_at"))
        return Response({"changed": True})


class PasswordResetRequestView(APIView):
    """Always returns the same response to avoid account-enumeration leaks."""

    permission_classes = [AllowAny]

    @extend_schema(request=PasswordResetRequestSerializer)
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email=serializer.validated_data["email"], is_active=True).first()
        if user and settings.EMAIL_DELIVERY_ENABLED:
            try:
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                token = PasswordResetTokenGenerator().make_token(user)
                send_password_reset(recipient_email=user.email, uid=uid, token=token)
            except (BadHeaderError, OSError, SMTPException):
                pass
        return Response({"requested": True}, status=202)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=PasswordResetConfirmSerializer)
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user_id = force_str(urlsafe_base64_decode(serializer.validated_data["uid"]))
            user = User.objects.get(pk=user_id, is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({"detail": "This password reset link is invalid or has expired."}, status=400)
        if not PasswordResetTokenGenerator().check_token(user, serializer.validated_data["token"]):
            return Response({"detail": "This password reset link is invalid or has expired."}, status=400)
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=("password", "updated_at"))
        return Response({"reset": True})


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


class InvitationAcceptanceView(APIView):
    permission_classes = [AllowAny]

    @staticmethod
    def _access_preview(invitation):
        enabled_modules = set(
            invitation.institution.modules.filter(is_enabled=True).values_list(
                "module_code", flat=True
            )
        )
        permitted_modules = set(
            invitation.role.permissions.values_list("module_code", flat=True)
        )
        modules = [
            {"code": code, "name": label}
            for code, label in InstitutionModule.ModuleCode.choices
            if code in enabled_modules and code in permitted_modules
        ]
        return {
            "role_code": invitation.role.code,
            "role_name": invitation.role.name,
            "modules": modules,
        }

    def _invitation(self, token):
        digest = salted_hmac("institution-invitation", token).hexdigest()
        invitation = InstitutionInvitation.objects.select_related("institution", "role", "employee").filter(token_hash=digest, status="PENDING").first()
        if invitation is None or invitation.expires_at <= timezone.now():
            if invitation is not None:
                invitation.status = "EXPIRED"; invitation.save(update_fields=("status", "updated_at"))
            return None
        return invitation

    def get(self, request, token):
        invitation = self._invitation(token)
        if invitation is None:
            return Response({"detail": "Invitation is invalid or expired."}, status=404)
        return Response({
            "email": invitation.email,
            "institution_name": invitation.institution.name,
            "role_name": invitation.role.name,
            "expires_at": invitation.expires_at,
            "existing_account": User.objects.filter(email=invitation.email).exists(),
            "access_preview": self._access_preview(invitation),
        })

    @transaction.atomic
    def post(self, request, token):
        invitation = self._invitation(token)
        if invitation is None:
            return Response({"detail": "Invitation is invalid or expired."}, status=404)
        password = request.data.get("password", "")
        first_name = request.data.get("first_name", "")
        last_name = request.data.get("last_name", "")
        user = User.objects.filter(email=invitation.email).first()
        created = user is None
        if user and user.has_usable_password():
            # A recipient can be invited into another institution or role. The
            # invitation token plus their current password proves ownership of
            # the existing account without creating a duplicate identity.
            if not user.check_password(password):
                return Response(
                    {"detail": "Enter your current ErgonX password to accept this invitation."},
                    status=400,
                )
        else:
            if len(password) < 8:
                return Response({"detail": "Password must contain at least 8 characters."}, status=400)
            if user is None:
                user = User.objects.create_user(
                    email=invitation.email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                )
            else:
                user.set_password(password)
                user.save(update_fields=("password", "updated_at"))
        membership, _ = InstitutionMembership.objects.get_or_create(institution=invitation.institution, user=user, defaults={"role": invitation.role, "status": "ACTIVE"})
        membership.role = invitation.role; membership.status = "ACTIVE"; membership.save()
        if invitation.employee_id:
            employee = invitation.employee
            if employee.user_id and employee.user_id != user.id:
                return Response({"detail": "This employee record is already linked to another account."}, status=409)
            employee.user = user
            employee.save(update_fields=("user", "updated_at"))
        elif invitation.role.code == "EMPLOYEE":
            # New employee invitations deliberately start without an HR record.
            # Acceptance creates the minimum linked profile; the employee can
            # complete personal details in Self-Service and HR can assign work
            # information afterwards.
            Employee.objects.get_or_create(
                institution=invitation.institution,
                user=user,
                defaults={
                    "employee_number": f"NEW-{user.id.hex[:8].upper()}",
                    "first_name": user.first_name or "New",
                    "last_name": user.last_name or "Employee",
                    "personal_email": invitation.email,
                    "work_email": invitation.email,
                    "hire_date": timezone.localdate(),
                },
            )
        invitation.status = "ACCEPTED"; invitation.accepted_at = timezone.now(); invitation.save(update_fields=("status", "accepted_at", "updated_at"))
        return Response(
            {
                "accepted": True,
                "existing_account": not created,
                "access_preview": self._access_preview(invitation),
            },
            status=200 if not created else 201,
        )
