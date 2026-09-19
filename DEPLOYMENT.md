# ErgonX production deployment

The development Compose file and demo seed commands are not production deployment tools. Use `compose.production.yaml` together with a secret `.env.production` file.

## Before first deployment

1. Provision DNS and TLS for separate application and API origins, for example `https://app.example.com` and `https://api.example.com`.
2. Copy `.env.production.example` to `.env.production`, generate unique PostgreSQL and Django secret values, and set the real host and CORS origins. Do not reuse local development credentials.
3. Put a TLS-terminating reverse proxy in front of the two loopback-bound services. The API must be reachable at the exact `NEXT_PUBLIC_API_BASE_URL` built into the frontend image.
4. Back up PostgreSQL before every release and test restoration independently.

## Build and start

```powershell
docker compose --env-file .env.production -f compose.production.yaml up -d --build
docker compose --env-file .env.production -f compose.production.yaml ps
```

The backend runs migrations and collects static files before Gunicorn starts. Do not run any `seed_*_demo` command in this environment; each one refuses production settings.

## First institution and real users

1. Create the first Django superuser from the backend container:

```powershell
docker compose --env-file .env.production -f compose.production.yaml exec backend python manage.py createsuperuser
```

2. Sign in, create/configure the institution, enable only the required modules, configure the organization and module prerequisites, then validate `/onboarding`.
3. In **Settings → Users & Memberships**, invite each real user and assign the least-privilege tenant role. The backend returns an acceptance link when requested.
4. Send the acceptance link through your approved email channel. The recipient sets their own password at `/accept-invitation/{token}` and then signs in normally.
5. Confirm onboarding readiness from the server-provided bootstrap response. Never mark onboarding complete client-side.

## Release checks

- Verify `/api/v1/schema/` through the public API origin and the application login through the public application origin.
- Confirm `NEXT_PUBLIC_ENABLE_DEV_AUTH_BYPASS=false` in the built frontend environment.
- Confirm production logs contain no development seed execution and that no PostgreSQL or pgAdmin port is publicly exposed.
- Rotate application/database credentials on the organization’s security schedule.
## Email delivery

Institution Admin invitations and forgotten-password links can be delivered by
Gmail or Google Workspace SMTP. Enable two-step verification for the sender
mailbox, create a Google App Password, and add the SMTP values to the
uncommitted `.env.production` file. Set `EMAIL_DELIVERY_ENABLED=true`, then
restart the backend container. Never use the mailbox's normal password. If
delivery is disabled or fails, the Super Admin workspace clearly requires
manual secure-link sharing.
