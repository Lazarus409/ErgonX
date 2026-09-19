# ErgonX Frontend Platform Contract

Contract version: 1.0  
API version: v1  
Implementation baseline: 2026-09-13

## Scope

This contract governs the shared frontend surfaces that sit across ErgonX modules:

- browser/PWA shell behavior;
- shared response, authentication, tenant, module, permission, pagination, and error rules;
- dashboards and reports;
- shared documents;
- generalized approvals;
- import/export and background-job foundations.

Module-specific workflow contracts remain in the neighboring `docs/integration/*_frontend_contract.md` files. This document does not replace those files; it defines the shared assumptions they rely on.

## Base URL

All API paths below are relative to:

```text
/api/v1/
```

Authenticated tenant requests must send:

```text
Authorization: Bearer <access-token>
X-Institution-ID: <institution-uuid>
```

If the user has exactly one active institution context, the backend may infer it. If the user has multiple active institution memberships, the frontend must send `X-Institution-ID` explicitly.

## Response Envelope

JSON API responses use the shared envelope:

```json
{
  "success": true,
  "data": {},
  "message": "",
  "errors": null
}
```

Paginated list responses wrap the page inside `data`:

```json
{
  "success": true,
  "data": {
    "count": 1,
    "next": null,
    "previous": null,
    "results": []
  },
  "message": "",
  "errors": null
}
```

Errors include a stable top-level `code` when raised through the shared API exception layer:

```json
{
  "success": false,
  "data": null,
  "message": "Only validated import jobs can be confirmed.",
  "code": "invalid_state_transition",
  "errors": {
    "status": ["Only validated import jobs can be confirmed."]
  }
}
```

Frontend behavior:

- Branch on stable `code` values where present.
- Display `message` as the user-facing summary.
- Map `errors` field keys to form inputs when possible.
- Treat non-envelope CSV report responses as file downloads.

## Shared Access Rules

Every operational screen must satisfy all applicable checks:

```text
valid JWT
+ active institution context
+ required module flag
+ required permission
```

Permissions do not bypass disabled modules. Tenant-scoped API results must never be merged across institution contexts in the browser.

Default list pagination uses page-number pagination:

- `page`;
- `page_size`;
- default page size 25;
- maximum page size 100.

## PWA Shell

The frontend is installable through:

- `frontend/public/manifest.webmanifest`;
- `frontend/public/sw.js`;
- `frontend/app/offline/page.tsx`;
- `frontend/app/register-sw.tsx`.

Current PWA contract:

- Cache only app-shell/static frontend assets.
- Do not cache authenticated API responses.
- Do not cache report export files.
- Do not queue offline HR, payroll, attendance, leave, accounting, approval, import, export, or document writes.
- Show the offline fallback page when navigation cannot reach the app shell.

Security note: the current browser implementation stores JWT access/refresh tokens and the selected institution UUID in local storage. This is tracked as `PWA-002` in `DEVELOPMENT_DISCREPANCIES_AND_LIMITATIONS.md`; production launch should either move to an HttpOnly-cookie/BFF design or explicitly harden and accept the local-storage token model.

## Dashboard Contract

Required module/permission:

```text
dashboard.<dashboard-name>.view
```

Routes:

| Method | Path | Purpose | Response data |
|---|---|---|---|
| GET | `/dashboards/executive/` | Institution-level executive rollup | employee counts, pending leave, pending journals, finalized payroll cost |
| GET | `/dashboards/hr/` | HR workforce rollup | employee counts, status mix, hire-year distribution |
| GET | `/dashboards/leave/` | Leave rollup | pending, currently-on-leave, upcoming counts |
| GET | `/dashboards/attendance/` | Today's attendance rollup | present, late, absent, overtime minutes |
| GET | `/dashboards/payroll/` | Payroll operations rollup | latest run, pending runs, finalized gross pay |
| GET | `/dashboards/finance/` | Finance operations rollup | pending journals, open AP, open AR, posted expenses |

Frontend behavior:

- Treat all numeric totals as tenant-scoped summaries, not ledger-grade financial statements.
- Render missing latest payroll run fields as an empty state when `latest_run_id` is `null`.
- Refresh dashboards after workflow actions that can change counts or totals.

## Reports Contract

Required permission:

```text
report.view
```

Routes:

| Method | Path | Purpose | Optional query | Response |
|---|---|---|---|---|
| GET | `/reports/workforce-cost/` | Employee count by status plus payroll totals | `export=csv` | JSON rows or CSV download |
| GET | `/reports/leave/` | Leave requests by status | `export=csv` | JSON rows or CSV download |
| GET | `/reports/attendance/` | Attendance records by status | `export=csv` | JSON rows or CSV download |
| GET | `/reports/payroll/` | Payroll records by run status | `export=csv` | JSON rows or CSV download |
| GET | `/reports/accounting/` | Journal count by source/status | `export=csv` | JSON rows or CSV download |
| GET | `/reports/ap-ar/` | Open AP and AR amounts | `export=csv` | JSON rows or CSV download |
| GET | `/reports/expenses/` | Expense count and amount by status | `export=csv` | JSON rows or CSV download |

JSON shape:

```json
{
  "success": true,
  "data": {
    "report": "workforce-cost",
    "rows": []
  },
  "message": "",
  "errors": null
}
```

Frontend behavior:

- Use `export=csv` for spreadsheet-ready downloads.
- Treat CSV responses as file downloads, not JSON.
- Native XLSX/PDF rendering and scheduled/generated report artifacts are not part of the current MVP contract; see `REPORT-001`.

## Documents Contract

Required permissions:

- `document.view`;
- `document.create`;
- `document.update`;
- `document.delete`.

Routes:

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/documents/` | List tenant documents | `document.view` |
| POST | `/documents/` | Create document metadata record | `document.create` |
| GET | `/documents/{id}/` | Read document metadata | `document.view` |
| PATCH | `/documents/{id}/` | Update document metadata | `document.update` |
| DELETE | `/documents/{id}/` | Delete document metadata record | `document.delete` |

Supported filters:

- `category`;
- `classification`;
- `entity_type`;
- `entity_id`;
- `is_active`;
- search by `original_filename`, `category`, or `entity_type`.

Fields:

```json
{
  "id": "document-uuid",
  "institution": "institution-uuid",
  "uploaded_by": "user-uuid",
  "file_reference": "storage/key/or/url",
  "original_filename": "contract.pdf",
  "content_type": "application/pdf",
  "size_bytes": 12345,
  "category": "employee-document",
  "classification": "CONFIDENTIAL",
  "checksum": "optional-checksum",
  "entity_type": "employee.Employee",
  "entity_id": "entity-uuid",
  "is_active": true,
  "created_at": "2026-09-13T00:00:00Z",
  "updated_at": "2026-09-13T00:00:00Z"
}
```

Classification values:

- `INTERNAL`;
- `CONFIDENTIAL`;
- `RESTRICTED`.

Frontend behavior:

- This API stores document metadata and storage references; it is not a binary upload endpoint.
- `institution`, `uploaded_by`, `created_at`, and `updated_at` are server-managed.
- `file_reference` is required and must not be blank.
- Use `entity_type` plus `entity_id` to attach a document to a domain record.
- Use `is_active=false` for soft hiding where product policy prefers retention.

## Approval Contract

Required permissions:

- `approval_workflow.view`;
- `approval_workflow.create`;
- `approval_workflow.update`;
- `approval_workflow.delete`;
- `approval_request.view`;
- `approval_request.create`.

Routes:

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET/POST | `/approval-workflows/` | List/create workflow definitions | `approval_workflow.view/create` |
| GET/PATCH/DELETE | `/approval-workflows/{id}/` | Read/update/delete workflow definition | `approval_workflow.view/update/delete` |
| GET/POST | `/approval-workflow-steps/` | List/create workflow steps | `approval_workflow.view/create` |
| GET/PATCH/DELETE | `/approval-workflow-steps/{id}/` | Read/update/delete workflow step | `approval_workflow.view/update/delete` |
| GET/POST | `/approval-requests/` | List/create approval requests | `approval_request.view/create` |
| GET | `/approval-requests/{id}/` | Read approval request | `approval_request.view` |
| POST | `/approval-requests/{id}/approve/` | Approve current step | tenant context plus assigned approver/role service gate |
| POST | `/approval-requests/{id}/reject/` | Reject current request | tenant context plus assigned approver/role service gate |
| POST | `/approval-requests/{id}/cancel/` | Cancel own pending request | tenant context plus requester service gate |
| GET | `/approval-actions/` | List read-only action history | `approval_request.view` |
| GET | `/approval-actions/{id}/` | Read action history item | `approval_request.view` |

Workflow definition fields:

```json
{
  "code": "EXPENSE_APPROVAL",
  "name": "Expense approval",
  "workflow_type": "EXPENSE",
  "entity_type": "accounting.Expense",
  "is_active": true
}
```

Workflow step fields:

```json
{
  "workflow": "workflow-uuid",
  "order": 1,
  "name": "Finance review",
  "approver_role": "role-uuid",
  "approver_user": null,
  "due_after_hours": 24
}
```

Approval request create payload:

```json
{
  "workflow": "workflow-uuid",
  "entity_type": "accounting.Expense",
  "entity_id": "entity-uuid",
  "metadata": {
    "display_label": "Expense EXP-001"
  }
}
```

Decision payload:

```json
{
  "comments": "Approved for posting."
}
```

Request status values:

- `PENDING`;
- `APPROVED`;
- `REJECTED`;
- `CANCELLED`.

Action values:

- `APPROVE`;
- `REJECT`;
- `RETURN`;
- `CANCEL`.

Current transition behavior:

```text
PENDING -> APPROVED
PENDING -> REJECTED
PENDING -> CANCELLED
```

For multi-step workflows, approval advances to the next configured step until the final step approves the request.

Frontend behavior:

- Do not PATCH `status`, `current_step`, `requested_by`, `due_at`, or `completed_at`.
- Render action buttons from request `status`, current user assignment/role, and tenant context. Decision endpoints are currently guarded by the approval service's assignment checks, not by separate `approval_request.approve` or `approval_request.reject` permission codes.
- Treat approval actions as immutable audit history.
- A workflow step must have either `approver_role` or `approver_user`.
- Same-tenant role/user validation is enforced by the backend.
- Current generalized approval requests do not automatically mutate the domain entity. Domain modules must still perform their own state transition or call their own workflow action.

## Import, Export, And Background Jobs Contract

Required permissions:

- `import_job.view`;
- `import_job.create`;
- `export_job.view`;
- `export_job.create`;
- `background_job.view`.

Import routes:

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET/POST | `/import-jobs/` | List/create import job records | `import_job.view/create` |
| GET | `/import-jobs/{id}/` | Read import job | `import_job.view` |
| POST | `/import-jobs/{id}/confirm/` | Confirm a validated import for commit | `import_job.create` |
| GET | `/import-row-results/` | List row validation/import results | `import_job.view` |
| GET | `/import-row-results/{id}/` | Read row result | `import_job.view` |

Import create payload:

```json
{
  "import_type": "EMPLOYEE",
  "file_reference": "imports/employees-2026-09.csv",
  "metadata": {
    "schema_version": "employee-import-v1"
  }
}
```

Import status values:

- `UPLOADED`;
- `VALIDATING`;
- `READY`;
- `COMMITTING`;
- `COMPLETED`;
- `FAILED`;
- `CANCELLED`.

Row result status values:

- `VALID`;
- `INVALID`;
- `IMPORTED`;
- `SKIPPED`.

Export routes:

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET/POST | `/export-jobs/` | List/create export job records | `export_job.view/create` |
| GET | `/export-jobs/{id}/` | Read export job | `export_job.view` |

Export create payload:

```json
{
  "export_type": "REPORT_WORKFORCE_COST",
  "metadata": {
    "format": "csv"
  }
}
```

Export status values:

- `QUEUED`;
- `RUNNING`;
- `COMPLETED`;
- `FAILED`;
- `CANCELLED`.

Background job routes:

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/background-jobs/` | List tenant-visible background jobs | `background_job.view` |
| GET | `/background-jobs/{id}/` | Read tenant-visible background job | `background_job.view` |

Background job status values:

- `QUEUED`;
- `RUNNING`;
- `SUCCEEDED`;
- `FAILED`;
- `CANCELLED`.

Frontend behavior:

- Create an import job only after the file has a durable `file_reference`.
- Enable import confirmation only when `status` is `READY` and `invalid_rows` is zero or policy accepts warnings.
- `confirm` returns HTTP 409 when the job is not `READY`.
- Poll the import/export/background-job record for completion status; do not assume create means the work has finished.
- Display `error_summary` for failed jobs.
- The only committed import handler currently documented as implemented is `EMPLOYEE`.
- Export job creation currently records and queues the request; generated file artifacts require type-specific handlers. See `OPS-001` and `REPORT-001`.

## Current Frontend Limitations

The following limitations are intentionally part of the current contract and are tracked in `DEVELOPMENT_DISCREPANCIES_AND_LIMITATIONS.md`:

- `PWA-001`: offline support is application-shell only.
- `PWA-002`: browser session tokens are stored in local storage pending production security decision.
- `PWA-003`: initial operational module screens are read-oriented.
- `REPORT-001`: MVP report exports are CSV only.
- `OPS-001`: import/export infrastructure requires type-specific handlers.

## Existing Module Contracts

Use these module contracts for domain-specific workflows:

- `docs/integration/payroll_frontend_contract.md`;
- `docs/integration/ghana_payroll_frontend_contract.md`;
- `docs/integration/accounting_frontend_contract.md`;
- `docs/integration/accounting_presets_frontend_contract.md`;
- `docs/integration/ghana_accounting_localization_frontend_contract.md`;
- `docs/integration/payroll_accounting_frontend_contract.md`;
- `docs/integration/accounts_payable_frontend_contract.md`;
- `docs/integration/accounts_receivable_frontend_contract.md`;
- `docs/integration/cash_bank_frontend_contract.md`;
- `docs/integration/bank_reconciliation_frontend_contract.md`;
- `docs/integration/expenses_frontend_contract.md`.
