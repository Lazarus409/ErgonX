# ErgonX production deployment

## Render

This repository is a monorepo: the Django API and Next.js application are
separate Render web services. Do not deploy the repository root as a single
Docker service: there is intentionally no root `Dockerfile`.

The included [`render.yaml`](render.yaml) creates the required API service,
frontend service, and managed PostgreSQL database. In Render, choose **New +**
then **Blueprint**, select this repository and branch, and provide these values
when Render prompts for them:

- `DJANGO_ALLOWED_HOSTS`: the API hostname only, for example
  `ergonx-api.onrender.com` (no `https://`).
- `CORS_ALLOWED_ORIGINS`: the frontend origin, for example
  `https://ergonx-web.onrender.com`.
- `FRONTEND_PUBLIC_URL`: the same frontend origin.
- `NEXT_PUBLIC_API_BASE_URL`: the complete API URL, for example
  `https://ergonx-api.onrender.com/api/v1`.

After deployment, update the three URL values if you attach custom domains and
redeploy both web services. Configure SMTP variables in the API service only;
keep `EMAIL_DELIVERY_ENABLED=false` until those values are ready.

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

## Uploaded files

Documents, expense receipts, complaint files and profile images are stored in
the PostgreSQL database in production (table `filestore_storedfile`), so they
survive deploys and are part of every database backup. Nothing needs to be
configured. Files are limited to `DOCUMENT_UPLOAD_MAX_MB` (25 MB) each; keep an
eye on the database's disk usage as uploads grow.

Downloads always go through the API, which checks access first.

Other options, if the database ever grows too large:

- an S3-compatible bucket: `MEDIA_STORAGE=s3` with `MEDIA_S3_BUCKET`,
  `MEDIA_S3_ACCESS_KEY_ID`, `MEDIA_S3_SECRET_ACCESS_KEY` and, for Cloudflare
  R2 or similar, `MEDIA_S3_ENDPOINT_URL` and `MEDIA_S3_REGION=auto`;
- a persistent disk: `MEDIA_ROOT=/var/data/media` on a mounted disk.

Files uploaded before database storage was introduced were written to the
container disk and are gone. List them with
`python manage.py restore_demo_files` (read-only); with
`ERGONX_ALLOW_DEMO_SEED=true`, `python manage.py restore_demo_files --restore`
recreates the Apex Energy demo's placeholder files. Real organisations' missing
files have to be uploaded again.

### Hosted demo only: populating the Apex Energy demo

A server that hosts the sales demo can be filled with the Apex Energy Ghana Ltd
data (`APEX-DEMO`). The three seeds below write only to that institution, but
they create accounts with the published demo password, so never do this on a
server that holds real customers' data unless you accept that.

1. Back up the database.
2. Keep `EMAIL_DELIVERY_ENABLED=false` (demo staff addresses use `@apexenergy.com`).
3. Add `ERGONX_ALLOW_DEMO_SEED=true` to the API service and open its shell.
4. Run, in order:

   ```
   python manage.py seed_ergonx_demo
   python manage.py seed_ergonx_activity
   python manage.py seed_ergonx_people
   ```

5. Remove `ERGONX_ALLOW_DEMO_SEED` again. Re-run `seed_ergonx_activity` (with the
   variable set) whenever the demo's dashboards should catch up to today.

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
- Confirm production logs contain no development seed execution (except a deliberate hosted-demo run) and that no PostgreSQL or pgAdmin port is publicly exposed.
- Rotate application/database credentials on the organization’s security schedule.
## Email delivery

Institution Admin invitations and forgotten-password links can be delivered by
Gmail or Google Workspace SMTP. Enable two-step verification for the sender
mailbox, create a Google App Password, and add the SMTP values to the
uncommitted `.env.production` file. Set `EMAIL_DELIVERY_ENABLED=true`, then
restart the backend container. Never use the mailbox's normal password. If
delivery is disabled or fails, the Super Admin workspace clearly requires
manual secure-link sharing.
