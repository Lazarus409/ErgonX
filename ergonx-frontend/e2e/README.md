# Release smoke tests (Playwright)

They sign in as each seeded role and open the main pages on a desktop and a phone viewport.

1. Backend, from `Ergonx-backend/`, using the throwaway SQLite test database:

   ```bash
   export DJANGO_SETTINGS_MODULE=config.settings.test
   python manage.py migrate --noinput
   python manage.py shell -c "from django.conf import settings; settings.DEBUG = True; from django.core.management import call_command; call_command('seed_ergonx_demo', password='ErgonxDemo!2026')"
   python manage.py runserver 127.0.0.1:8000
   ```

2. Frontend, from `ergonx-frontend/`: `npm run dev -- --hostname 127.0.0.1`
3. Tests: `npx playwright install chromium` once, then `npm run test:e2e`.
   Set `E2E_BROWSER_CHANNEL=msedge` to use an installed Edge instead.

Accounts default to the seeded `@apexenergy.com` users with the password above; override with
`E2E_EMAIL_DOMAIN`, `E2E_PASSWORD` or `E2E_<ROLE>_EMAIL` / `E2E_<ROLE>_PASSWORD`.
