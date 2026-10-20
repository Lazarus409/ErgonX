from .base import *  # noqa: F403

DEBUG = False
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / ".test.sqlite3",  # noqa: F405
    }
}

# The whole suite runs as a handful of reused user ids and one address; the limits
# themselves are exercised in tests/test_rate_limits.py.
API_USER_RATE = "1000000/min"
API_ANON_RATE = "1000000/min"
