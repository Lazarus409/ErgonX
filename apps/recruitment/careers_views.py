"""Public careers endpoints (no sign-in) and HR's careers-site settings.

Public endpoints are rate limited per client address and answer only with
public data: open public postings, and for a tracking link the one application
it was issued for.
"""

from smtplib import SMTPException

from django.conf import settings
from django.core.mail import BadHeaderError, EmailMultiAlternatives
from django.shortcuts import get_object_or_404
from django.utils.html import escape
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.accounts.security import client_ip
from apps.recruitment import careers
from apps.recruitment.models import Candidate, CareersSite, JobPosting
from common.permissions import TenantContextPermission, TenantRBACPermission
from common.serializers import call_validated_service


class CareersThrottle(AnonRateThrottle):
    """Applications and uploads per client address; browsing is limited more loosely."""

    def get_ident(self, request):
        ip, _trusted = client_ip(request)
        return ip or super().get_ident(request)


class CareersWriteThrottle(CareersThrottle):
    scope = "careers_write"

    def get_rate(self):
        return getattr(settings, "CAREERS_WRITE_RATE", "10/hour")


class CareersReadThrottle(CareersThrottle):
    scope = "careers_read"

    def get_rate(self):
        return getattr(settings, "CAREERS_READ_RATE", "300/hour")


class PublicView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def get_throttles(self):
        return [CareersReadThrottle()] if self.request.method == "GET" else [CareersWriteThrottle()]

    def site(self, slug):
        site = careers.site_for_slug(slug)
        if site is None:
            raise NotFound("This careers page doesn't exist.")
        return site


def _job_summary(job):
    return {
        "id": str(job.id), "code": job.code, "title": job.title,
        "department": job.department.name if job.department_id else "", "location": job.location.name if job.location_id else "",
        "employment_type": job.get_employment_type_display(), "closes_on": job.closes_on, "openings": job.openings,
    }


def _job_detail(job):
    salary = None
    if job.salary_min and job.salary_max:
        salary = {"currency": job.salary_currency, "min": str(job.salary_min), "max": str(job.salary_max)}
    return {
        **_job_summary(job), "description": job.description, "responsibilities": job.responsibilities,
        "qualifications_essential": job.qualifications_essential, "qualifications_desirable": job.qualifications_desirable, "salary": salary,
    }


class CareersSiteView(PublicView):
    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request, slug):
        site = self.site(slug)
        return Response({
            "organisation": site.institution.name, "slug": site.slug, "headline": site.headline or f"Careers at {site.institution.name}",
            "introduction": site.introduction, "privacy_notice": site.privacy_notice,
            "jobs": [_job_summary(job) for job in careers.public_jobs(site)],
        })


class CareersJobView(PublicView):
    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request, slug, job_id):
        site = self.site(slug)
        job = careers.public_jobs(site).filter(pk=job_id).first()
        if job is None:
            raise NotFound("This job is no longer advertised.")
        return Response({"organisation": site.institution.name, "privacy_notice": site.privacy_notice, "job": _job_detail(job)})


class PublicApplicationSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    email = serializers.EmailField(max_length=254)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    location = serializers.CharField(max_length=150, required=False, allow_blank=True)
    linkedin_url = serializers.URLField(required=False, allow_blank=True)
    current_title = serializers.CharField(max_length=200, required=False, allow_blank=True)
    current_employer = serializers.CharField(max_length=200, required=False, allow_blank=True)
    years_experience = serializers.IntegerField(min_value=0, max_value=60, required=False, allow_null=True)
    highest_qualification = serializers.ChoiceField(choices=Candidate.Qualification.choices, required=False, allow_blank=True)
    cover_letter = serializers.CharField(max_length=6000, required=False, allow_blank=True)
    consent = serializers.BooleanField()
    cv = serializers.FileField()
    # Honeypot: hidden from people, filled in by bots.
    website = serializers.CharField(required=False, allow_blank=True)

    def validate_consent(self, value):
        if not value:
            raise serializers.ValidationError("Agree to how your data will be used to apply.")
        return value


def _send_tracking_email(application, token):
    if not getattr(settings, "EMAIL_DELIVERY_ENABLED", False):
        return "not_configured"
    link = f"{settings.FRONTEND_PUBLIC_URL}/careers/track/{token}"
    organisation, title = application.institution.name, application.job_posting.title
    text = (
        f"Thank you for applying for {title} at {organisation}.\n\n"
        f"Follow your application, confirm interviews and send documents here: {link}\n\n"
        "Keep this link private: anyone with it can see this application."
    )
    html = f'''<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.55;max-width:620px">
      <h1 style="font-size:22px">Application received</h1>
      <p>Thank you for applying for <strong>{escape(title)}</strong> at <strong>{escape(organisation)}</strong>.</p>
      <p><a href="{escape(link)}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Track your application</a></p>
      <p style="color:#475569">Keep this link private: anyone with it can see this application.</p>
    </div>'''
    try:
        message = EmailMultiAlternatives(subject=f"Your application: {title}", body=text, from_email=settings.DEFAULT_FROM_EMAIL, to=[application.candidate.email])
        message.attach_alternative(html, "text/html")
        message.send(fail_silently=False)
        return "sent"
    except (BadHeaderError, OSError, SMTPException):
        return "failed"


class CareersApplyView(PublicView):
    parser_classes = (MultiPartParser, FormParser)

    @extend_schema(request=PublicApplicationSerializer, responses={201: OpenApiTypes.OBJECT})
    def post(self, request, slug, job_id):
        site = self.site(slug)
        job = get_object_or_404(JobPosting.objects.for_institution(site.institution), pk=job_id, is_public=True)
        payload = PublicApplicationSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        values = dict(payload.validated_data)
        if values.pop("website", ""):
            # Look successful to the bot; store nothing.
            return Response({"received": True, "tracking_token": None, "email_delivery_status": "not_configured"}, status=201)
        cv = values.pop("cv")
        values.pop("consent")
        ip, _trusted = client_ip(request)
        application, token = call_validated_service(careers.apply, site=site, job=job, values=values, cv=cv, client_ip=ip or "")
        # The tracking link opens only this application, so it is safe to hand back to whoever submitted it.
        return Response({"received": True, "tracking_token": token, "email_delivery_status": _send_tracking_email(application, token)}, status=201)


class TrackingView(PublicView):
    parser_classes = (JSONParser, MultiPartParser, FormParser)

    def application(self, token):
        application = careers.application_for_token(token)
        if application is None:
            raise NotFound("This tracking link is invalid or has expired.")
        return application

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request, token):
        return Response(careers.tracking_view(self.application(token)))


class TrackingDocumentsView(TrackingView):
    @extend_schema(request=OpenApiTypes.OBJECT, responses={200: OpenApiTypes.OBJECT})
    def post(self, request, token):
        application = self.application(token)
        call_validated_service(careers.candidate_upload, application=application, uploaded_file=request.FILES.get("file"), category=str(request.data.get("category") or "OTHER"))
        return Response(careers.tracking_view(application))


class TrackingWithdrawView(TrackingView):
    @extend_schema(request=None, responses={200: OpenApiTypes.OBJECT})
    def post(self, request, token):
        application = self.application(token)
        call_validated_service(careers.candidate_withdraw, application=application)
        application.refresh_from_db()
        return Response(careers.tracking_view(application))


class TrackingInterviewView(TrackingView):
    @extend_schema(request=OpenApiTypes.OBJECT, responses={200: OpenApiTypes.OBJECT})
    def post(self, request, token, interview_id):
        application = self.application(token)
        response = str(request.data.get("response") or "").upper()
        if response not in ("ACCEPT", "DECLINE"):
            raise serializers.ValidationError({"response": "Answer ACCEPT or DECLINE."})
        call_validated_service(careers.candidate_respond_to_interview, application=application, interview_id=interview_id, accept=response == "ACCEPT", note=str(request.data.get("note") or "")[:500])
        return Response(careers.tracking_view(application))


class CareersSiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CareersSite
        fields = ("slug", "is_enabled", "headline", "introduction", "privacy_notice", "updated_at")
        read_only_fields = ("updated_at",)

    def validate_slug(self, value):
        value = value.strip().lower()
        clash = CareersSite.objects.filter(slug=value)
        if self.instance is not None:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("This address is taken.")
        return value


class CareersSiteSettingsView(APIView):
    """HR's careers-site settings for the active institution."""

    permission_classes = (TenantContextPermission, TenantRBACPermission)
    required_module = "RECRUITMENT"

    def get_required_permission(self):
        return "job_posting.view" if self.request.method == "GET" else "job_posting.update"

    def _site(self, request):
        return CareersSite.objects.filter(institution=request.institution).first()

    @extend_schema(responses=CareersSiteSettingsSerializer)
    def get(self, request):
        site = self._site(request)
        if site is None:
            return Response({"slug": request.institution.code.lower(), "is_enabled": False, "headline": "", "introduction": "", "privacy_notice": "", "updated_at": None, "exists": False})
        return Response({**CareersSiteSettingsSerializer(site).data, "exists": True})

    @extend_schema(request=CareersSiteSettingsSerializer, responses=CareersSiteSettingsSerializer)
    def put(self, request):
        from apps.audit.services import record_audit_event

        site = self._site(request)
        serializer = CareersSiteSettingsSerializer(site, data=request.data)
        serializer.is_valid(raise_exception=True)
        site = call_validated_service(lambda: _save_site(serializer, request))
        record_audit_event(actor=request.user, institution=request.institution, entity=site, action="recruitment.careers_site.updated", metadata={"slug": site.slug, "is_enabled": site.is_enabled})
        return Response({**CareersSiteSettingsSerializer(site).data, "exists": True})


def _save_site(serializer, request):
    site = serializer.instance or CareersSite(institution=request.institution)
    for field, value in serializer.validated_data.items():
        setattr(site, field, value)
    site.save()
    return site
