# ErgonX disaster recovery

How ErgonX's data is backed up, how to bring the service back after losing it, and how
often to prove that works. Written for whoever operates the platform.

## Targets

| Target | Default | Meaning | Setting |
|---|---|---|---|
| Recovery time objective (RTO) | 4 hours | Longest acceptable time from detecting an outage to the service working again | `DR_RECOVERY_TIME_OBJECTIVE_HOURS` |
| Recovery point objective (RPO) | 24 hours | Most recent data that may be lost; the backup interval | `DR_RECOVERY_POINT_OBJECTIVE_HOURS` |

The incident register (Super Admin → Incidents) measures every incident's recovery time
against the RTO. Change the targets only together with the backup schedule that supports them.

## What must be backed up

Everything lives in one PostgreSQL database: records, the audit trail, and uploaded files
(stored in the `filestore_storedfile` table in production). A database backup is a complete
backup. Secrets live outside the database, in the hosting environment: `DJANGO_SECRET_KEY`,
`BFF_PROXY_SECRET`, SMTP and storage credentials. Keep a copy of them in a password manager;
a restored database is not usable without the same `DJANGO_SECRET_KEY`.

## Backups

**Render (current production).** Render backs up paid PostgreSQL databases itself (daily, with
point-in-time recovery on higher plans). Check the database's *Recovery* tab to confirm the plan
includes it. In addition, keep your own off-site copy at least weekly:

```powershell
.\scripts\backup-render-db.ps1
```

It writes `backups\ergonx-render-<time>.dump` and checks the file reads back. Copy it off the
computer (an external disk or a cloud drive you control). The live database is PostgreSQL 18,
so the script uses the `postgres:18` image.

**Self-hosted (`compose.production.yaml`).** The `backup` service writes a dump to `./backups`
every day and keeps `BACKUP_KEEP_DAYS` (14) days. Copy that folder off the server daily; a
backup on the same machine is lost with the machine.

**One organisation.** An Institution Admin can download everything their organisation holds
(Settings → organisation → Export all data), and a Super Admin can export any organisation
(`/api/v1/platform/institutions/<id>/export/` or `python manage.py export_organisation <CODE>`).
This is for handover or leaving ErgonX, not a substitute for database backups.

## Restore testing (every 90 days)

A backup is only proven by restoring it. At least every 90 days:

```powershell
.\scripts\restore-test.ps1 -DumpFile backups\<latest>.dump
```

It restores into a throwaway database, times it, and checks organisations, users, employees,
payroll, ledger, audit trail and stored files. Record the result as Super Admin under
**Restore tests**; the security overview warns every organisation's administrators when the
last test is older than 90 days or failed.

## Recovering production on Render

1. **Declare an incident** (Super Admin → Incidents, severity SEV1) and note the time. Name a lead.
2. **Decide the restore point.** For corruption or a bad change, use point-in-time recovery to
   just before it; for loss of the database, the latest backup.
3. **Restore.** Either Render's *Recovery* tab (creates a new database from a backup or point in
   time), or create an empty PostgreSQL 18 database and load your own dump:
   `pg_restore --no-owner --no-privileges --dbname "<new database URL>" ergonx-render-<time>.dump`
4. **Point the API at it.** Update `DATABASE_URL` on `ergonx-api` and every cron job in
   `render.yaml` (they share the database), then redeploy. The start command runs `migrate`.
5. **Check.** `/api/v1/health/ready/` returns 200; sign in as a Super Admin and an organisation
   admin; open an employee, a payslip and a recent journal; download an uploaded document.
6. **Reconcile the gap.** Work done between the restore point and the outage is lost. Tell the
   affected organisations what time their data now runs to, so they can re-enter it.
7. **Close out.** Add timeline updates, mark the incident *Recovered*, then record the root cause
   and lessons learned and close it. If personal data was lost or exposed, each affected
   organisation records it in its own breach register (Privacy → Breaches).

## Recovering a self-hosted server

Provision a new server, install Docker, restore the secrets into `.env.production`, then:

```bash
docker compose --env-file .env.production -f compose.production.yaml up -d postgres
docker compose --env-file .env.production -f compose.production.yaml exec -T postgres \
  pg_restore --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB" < backups/ergonx-<time>.dump
docker compose --env-file .env.production -f compose.production.yaml up -d --build
```

Then follow steps 5 to 7 above.
