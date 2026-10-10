# ErgonX integrated demo dataset

Run the development-only seed from `Ergonx-backend`:

```powershell
python manage.py seed_ergonx_demo
python manage.py seed_ergonx_activity
python manage.py seed_ergonx_people
python manage.py seed_ergonx_demo --validate-only
```

The commands own only the reserved `APEX-DEMO` institution (Apex Energy Ghana
Ltd). They are idempotent and refuse to run with `DEBUG=False`. Migration
`institutions.0044` renames an existing `CSA-DEMO` tenant in place.

- `seed_ergonx_demo`: the fixed foundation below.
- `seed_ergonx_activity`: rolling, date-relative activity (attendance, leave,
  invoices, bills, expenses, interviews) so dashboards show current data.
- `seed_ergonx_people`: HSSE and Supply & Logistics departments, Kumasi and
  Takoradi depots, twelve October 2026 hires with onboarding, emergency
  contacts, offboardings, tax-relief claims, performance cycles, training and
  certificates, the document checklist, complaints, expense claims, energy
  suppliers and customers, and two depot vacancies with candidates.

## Current seeded scope

- 30 users, employees, current employments, compensation records, and payroll profiles.
- Organization, RBAC personas, Ghana payroll preset, and Ghana commercial accounting preset.
- Recruitment: three postings, eight applications, four interviews, two offers, and one linked employee handoff.
- Leave: annual and sick policies plus pending, approved, and draft requests.
- Attendance: four schedules, 30 assignments, present/late/night/on-leave scenarios, and approved/pending overtime.
- Payroll: September 2026 finalized run, 30 records, and 30 payslips.
- Accounting: FY2026, September period, a posted payroll journal, vendor bill/payment, customer invoice/partial receipt, bank account, and pending expense.

## Deliberate limitations

- Recruitment requisitions are not seeded because the live Recruitment model begins with job postings.
- Ghana casual-worker withholding is mapped by the Ghana accounting preset to
  debit `NET_PAY_PAYABLE` and credit `PAYE_PAYABLE`; payroll-to-GL is created
  and posted through the normal journal workflow.
