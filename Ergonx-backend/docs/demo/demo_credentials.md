# Development-only demo credentials

Institution: **Apex Energy Ghana Ltd** (`APEX-DEMO`), a petroleum supply and
distribution company with a head office in Accra and depots in Tema, Kumasi
and Takoradi.

Staff addresses use `@apexenergy.com` (one constant, `DEMO_EMAIL_DOMAIN` in
`seed_ergonx_demo.py`). Candidates, suppliers and customers use reserved
`example.com` addresses, which can never receive email. Before seeding a
server that sends email, make sure `apexenergy.com` is a domain you control.

The seed command assigns its development password only when it creates a new
demo account. Use the command's `--password` option when initializing a fresh
demo database. Do not use these synthetic accounts or credentials in
production.

The default APEX-DEMO password is `ErgonxDemo!2026` for all personas below.
For an existing development database, run the reset command below to apply it.

For a previously seeded development database, use
`python manage.py seed_ergonx_demo --reset-passwords` to reset only the
synthetic APEX-DEMO users to the command's `--password` value.

Key personas:

- `kwame.mensah@apexenergy.com` — Institution Admin
- `ama.owusu@apexenergy.com` — HR Admin
- `abena.asare@apexenergy.com` — Recruitment Officer
- `yaw.osei@apexenergy.com` — Finance Manager
- `akosua.acheampong@apexenergy.com` — Accountant
- `kojo.addo@apexenergy.com` — Payroll Officer
- `efua.agyeman@apexenergy.com` — Department Head
- `nana.nyarko@apexenergy.com` — Employee self-service
- `sandra.appiah@apexenergy.com` — Auditor
- `evelyn.darko@apexenergy.com` — Director
- `kwesi.ampofo@apexenergy.com` — HSSE Manager (Department Head, joined October 2026)
- `gifty.ofosu@apexenergy.com` — Supply Chain Manager (Department Head, joined October 2026)
- `issah.mohammed@apexenergy.com` — Tanker driver (Employee self-service, new hire)

What to look at:

- Ama (HR Admin): Performance (closed 2025 cycle, 2026 mid-year in progress),
  Training (certificates expired / expiring), Document Checklist, Complaints.
- Nana or Issah: My Performance, My Training, My Complaints, My Documents.
- Efua (Department Head, IT): manager reviews waiting in the 2026 mid-year cycle.

Who decides what (Phase 2 rules; the API enforces them):

- Nobody approves their own work: a payroll run is approved by someone other
  than its preparer, a manual journal by someone other than its creator, and an
  expense by someone other than its claimant or creator. Use
  `yaw.osei@apexenergy.com` (Finance Manager) to approve what `kwame.mensah@apexenergy.com`
  prepared, and the reverse.
- Expense claims: staff claim under My expenses; the line manager or department
  head approves first, then a Finance Manager reviews, posts and records the
  settlement.
- Requisitions are published only after another approver has approved them.
- Landing after sign-in: Institution Admin and Director open the Executive
  dashboard, operational roles (HR, Finance, Auditor) open Insights, and
  employees open Employee Home.
