from django.urls import path

from apps.accounts.views import AccountProfileView, AuthBootstrapView, InstitutionAdminInvitationAcceptanceView, InstitutionAdminInvitationView, InvitationAcceptanceView, LoginView, MeView, PasswordChangeView, PasswordResetConfirmView, PasswordResetRequestView, RefreshView, SelfServiceRegistrationView

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("register/", SelfServiceRegistrationView.as_view(), name="register"),
    path("institution-admin-invitations/", InstitutionAdminInvitationView.as_view(), name="institution-admin-invitation"),
    path("institution-admin-invitations/<str:token>/", InstitutionAdminInvitationAcceptanceView.as_view(), name="institution-admin-invitation-acceptance"),
    path("refresh/", RefreshView.as_view(), name="refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("profile/", AccountProfileView.as_view(), name="account-profile"),
    path("profile/password/", PasswordChangeView.as_view(), name="account-password-change"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("bootstrap/", AuthBootstrapView.as_view(), name="auth-bootstrap"),
    path("invitations/<str:token>/", InvitationAcceptanceView.as_view(), name="invitation-acceptance"),
]
