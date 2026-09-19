from django.urls import path

from apps.accounts.views import AuthBootstrapView, LoginView, MeView, RefreshView

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", RefreshView.as_view(), name="refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("bootstrap/", AuthBootstrapView.as_view(), name="auth-bootstrap"),
]
