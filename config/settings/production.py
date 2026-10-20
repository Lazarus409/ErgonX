import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403
from .storage import media_storage_settings


if SECRET_KEY == "unsafe-development-only-key-change-before-production":  # noqa: F405
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set in production")
if not os.environ.get("DJANGO_ALLOWED_HOSTS"):
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must be set in production")
if not os.environ.get("CORS_ALLOWED_ORIGINS"):
    raise ImproperlyConfigured("CORS_ALLOWED_ORIGINS must be set in production")
if os.environ.get("EMAIL_DELIVERY_ENABLED", "false").lower() == "true":
    required_email_settings = ("EMAIL_HOST", "EMAIL_HOST_USER", "EMAIL_HOST_PASSWORD", "DEFAULT_FROM_EMAIL", "FRONTEND_PUBLIC_URL")
    missing_email_settings = [name for name in required_email_settings if not os.environ.get(name)]
    if missing_email_settings:
        raise ImproperlyConfigured(
            f"Email delivery is enabled but missing: {', '.join(missing_email_settings)}"
        )

if MEDIA_STORAGE_KIND == "filesystem" and not os.environ.get("MEDIA_STORAGE") and not os.environ.get("MEDIA_ROOT"):  # noqa: F405
    # A hosted container's own disk is wiped on every deploy, so uploads go to
    # the database unless a bucket (MEDIA_STORAGE=s3) or a persistent-disk folder
    # (MEDIA_ROOT) is configured.
    STORAGES, MEDIA_ROOT, MEDIA_STORAGE_KIND = media_storage_settings({"MEDIA_STORAGE": "database"}, BASE_DIR)  # noqa: F405

DEBUG = False
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
# Platform health probes call the container over plain HTTP.
SECURE_REDIRECT_EXEMPT = [r"^api/v1/health/"]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_SECURE_HSTS_SECONDS", "31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True

# Rate limits (password-reset emails, Get Started submissions) live in the
# cache. Gunicorn runs several workers, so the cache must be shared between
# them; the database is the one store every worker already has. The table is
# created at container start (manage.py createcachetable, idempotent).
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "ergonx_cache",
    },
    "throttle": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "ergonx-throttle"},
}

# Logs go to stdout for the platform log stream; failed requests keep their traceback.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "plain"}},
    "root": {"handlers": ["console"], "level": os.environ.get("LOG_LEVEL", "INFO")},
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "ERROR", "propagate": False},
        "django.security": {"handlers": ["console"], "level": "WARNING", "propagate": False},
    },
}

# Error tracking is opt-in: set SENTRY_DSN (Sentry's free tier is enough) to receive
# unhandled errors with stack traces. Personal data is not sent.
if os.environ.get("SENTRY_DSN"):
    import sentry_sdk

    sentry_sdk.init(
        dsn=os.environ["SENTRY_DSN"],
        environment=os.environ.get("SENTRY_ENVIRONMENT", "production"),
        release=os.environ.get("RENDER_GIT_COMMIT") or None,
        send_default_pii=False,
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0")),
    )
