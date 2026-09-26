from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.conf import settings
from django.core.mail import BadHeaderError
from smtplib import SMTPException
from django.utils import timezone
from datetime import timedelta
import base64
import secrets
from django.utils.crypto import salted_hmac
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.db import transaction
from django.utils.text import slugify
from urllib.parse import quote
from uuid import uuid4
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import OpenApiTypes, extend_schema

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
    MFASetupSerializer,
    EmailOTPDeliveryError,
    consume_email_otp,
    issue_email_otp,
)
from apps.institutions.services import create_membership, effective_permission_codes
from apps.institutions.models import Institution, InstitutionInvitation, InstitutionMembership, InstitutionModule, Role
from apps.accounts.models import InstitutionAdminInvitation, User, UserMFA
from apps.employees.models import Employee
from apps.documents.models import ImageAsset
from apps.accounts.emails import send_institution_admin_invitation, send_password_reset
from apps.audit.services import record_audit_event
from common.scoping import data_scope
from common.permissions import READ_ONLY_ROLES, TenantContextPermission


class LoginView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


class MFAConflict(APIException):
    status_code = 409
    default_code = "invalid_state_transition"

    def __init__(self, detail, api_code="invalid_state_transition"):
        super().__init__(detail)
        self.api_code = api_code


class MFASettingsView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MFASetupSerializer

    def get(self, request):
        mfa = UserMFA.objects.filter(user=request.user).first()
        return Response({"enabled": bool(mfa and mfa.is_enabled), "pending": bool(mfa and not mfa.is_enabled), "method": mfa.method if mfa else None})

    def post(self, request):
        mfa, _ = UserMFA.objects.get_or_create(user=request.user, defaults={"secret": base32_secret()})
        if mfa.is_enabled:
            raise MFAConflict("MFA is already enabled.")
        if mfa.method != UserMFA.Method.AUTHENTICATOR_APP:
            mfa.method = UserMFA.Method.AUTHENTICATOR_APP
            mfa.save(update_fields=("method", "updated_at"))
        record_audit_event(actor=request.user, institution=getattr(request, "institution", None), entity=mfa, action="account.mfa.setup_started", metadata={"method": mfa.method})
        label = quote(f"ErgonX:{request.user.email}")
        otpauth_uri = f"otpauth://totp/{label}?secret={mfa.secret}&issuer=ErgonX&algorithm=SHA1&digits=6&period=30"
        return Response({"enabled": False, "pending": True, "method": mfa.method, "secret": mfa.secret, "otpauth_uri": otpauth_uri})

    def put(self, request):
        serializer = MFASetupSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        mfa = UserMFA.objects.get(user=request.user)
        mfa.is_enabled = True
        mfa.confirmed_at = timezone.now()
        mfa.save(update_fields=("is_enabled", "confirmed_at", "updated_at"))
        record_audit_event(actor=request.user, institution=getattr(request, "institution", None), entity=mfa, action="account.mfa.enabled", metadata={"method": mfa.method})
        return Response({"enabled": True, "pending": False, "method": mfa.method})

    def patch(self, request):
        """Switch to email OTP: without `code` a code is emailed; with `code` it is confirmed."""
        if request.data.get("method") != UserMFA.Method.EMAIL_OTP:
            raise ValidationError({"method": "Use the authenticator setup flow to enable an authenticator app."})
        code = str(request.data.get("code") or "").strip()
        if not code:
            try:
                challenge = issue_email_otp(request.user)
            except EmailOTPDeliveryError as exc:
                raise MFAConflict(str(exc), api_code="email_otp_unavailable")
            current = UserMFA.objects.filter(user=request.user).first()
            return Response({
                "enabled": bool(current and current.is_enabled),
                "pending": bool(current and not current.is_enabled),
                "method": current.method if current else None,
                "email_code_sent": True,
                "email": request.user.email,
                "expires_at": challenge.expires_at,
            })
        if not consume_email_otp(request.user, code):
            raise ValidationError({"code": "The email verification code is invalid or expired."})
        mfa, _ = UserMFA.objects.get_or_create(user=request.user, defaults={"secret": base32_secret()})
        mfa.method = UserMFA.Method.EMAIL_OTP
        mfa.is_enabled = True
        mfa.confirmed_at = timezone.now()
        mfa.save(update_fields=("method", "is_enabled", "confirmed_at", "updated_at"))
        record_audit_event(actor=request.user, institution=getattr(request, "institution", None), entity=mfa, action="account.mfa.method_changed", metadata={"method": mfa.method})
        return Response({"enabled": True, "pending": False, "method": mfa.method})

    def delete(self, request):
        mfa = UserMFA.objects.filter(user=request.user).first()
        if mfa:
            record_audit_event(actor=request.user, institution=getattr(request, "institution", None), entity=mfa, action="account.mfa.disabled", metadata={"method": mfa.method})
            mfa.delete()
        return Response({"enabled": False, "pending": False})


def base32_secret():
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


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

    @extend_schema(request=InstitutionAdminInvitationCreateSerializer, responses={201: OpenApiTypes.OBJECT})
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


@extend_schema(responses={200: OpenApiTypes.OBJECT, 201: OpenApiTypes.OBJECT})
class InstitutionAdminInvitationAcceptanceView(APIView):
    permission_classes = [AllowAny]
    serializer_class = InstitutionAdminInvitationAcceptanceSerializer

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

    @extend_schema(operation_id="auth_institution_admin_invitation_accept")
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

    @extend_schema(request=PasswordChangeSerializer, responses={200: OpenApiTypes.OBJECT})
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=("password", "updated_at"))
        return Response({"changed": True})


class PasswordResetRequestView(APIView):
    """Always returns the same response to avoid account-enumeration leaks."""

    permission_classes = [AllowAny]

    @extend_schema(request=PasswordResetRequestSerializer, responses={202: OpenApiTypes.OBJECT})
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

    @extend_schema(request=PasswordResetConfirmSerializer, responses={200: OpenApiTypes.OBJECT})
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


def _active_institution_logo_id(institution):
    """The institution's current logo image, if one has been uploaded."""
    logo_id = (
        ImageAsset.objects.filter(
            institution=institution,
            owner_type=ImageAsset.OwnerType.INSTITUTION,
            owner_id=institution.id,
            is_active=True,
        )
        .values_list("id", flat=True)
        .first()
    )
    return str(logo_id) if logo_id else None


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
        # Home is the canonical post-login workspace for every institutional
        # membership. Dashboards stay discoverable analytical destinations;
        # role titles must not choose a user's landing route.
        landing = "HOME"
        payload = {
            "user": request.user,
            "active_institution": {
                "id": str(request.institution.id),
                "code": request.institution.code,
                "name": request.institution.name,
                "timezone": request.institution.timezone,
                "logo_image_id": _active_institution_logo_id(request.institution),
            },
            "active_membership": {
                "id": str(request.membership.id),
                "role_code": request.membership.role.code,
                "role_name": request.membership.role.name,
                "status": request.membership.status,
                # INSTITUTION, DEPARTMENT or SELF: whose records this member works with.
                "data_scope": data_scope(request),
                # Read-only roles may view what they are granted but not change it.
                "read_only": request.membership.role.code in READ_ONLY_ROLES,
            },
            "effective_permissions": list(permission_codes),
            "enabled_modules": enabled_modules,
            "onboarding_ready": onboarding_ready,
            "onboarding_status": onboarding.status if onboarding else "NOT_STARTED",
            "default_landing": landing,
            "available_dashboards": sorted(dashboards),
        }
        return Response(AuthBootstrapSerializer(payload).data)


@extend_schema(responses={200: OpenApiTypes.OBJECT, 201: OpenApiTypes.OBJECT})
class InvitationAcceptanceView(APIView):
    permission_classes = [AllowAny]
    serializer_class = InstitutionAdminInvitationAcceptanceSerializer

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

    @extend_schema(operation_id="auth_institution_invitation_accept")
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
