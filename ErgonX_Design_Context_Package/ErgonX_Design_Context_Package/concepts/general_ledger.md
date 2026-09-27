# General Ledger

**Approved direction:** Option 2

## Purpose
This screen follows the approved ErgonX visual language and role-aware product model. It should preserve the established shell, spacing rhythm, semantic color usage, and governed data states.

## Design components
- Page header with clear title, context, and one primary action.
- Reusable ErgonX surfaces, status badges, tabs, tables/lists, drawers, dialogs, timelines, and empty/loading/error states as appropriate.
- Primary headings and key section icons use the approved blue hierarchy; secondary content remains neutral navy/slate.
- Tenant identity may appear in institution-facing areas while ErgonX remains visible in the global shell.

## Responsive behavior
- Desktop: preserve the approved sidebar/top-bar shell and spacious multi-column layout.
- Tablet: collapse secondary columns, retain primary data and action hierarchy, and convert drawers to wider panels.
- Mobile: use the compact shell/navigation drawer, full-width controls, 48px touch targets, bottom sheets for dialogs/drawers, and readable record cards instead of dense tables.
- Respect safe areas, keyboard avoidance, reduced motion, focus order, and locale-aware dates/numbers.

## Frontend implementation notes
- Build from shared layout and UI primitives rather than page-specific one-off styling.
- Derive visible navigation and actions from effective permissions, institution membership, enabled modules, and record state.
- Keep loading, empty, error, permission-denied, disabled, success, and partial-success states explicit.
- Preserve route state, filters, selections, and scroll position when moving between related views.

## Backend and contract expectations
- Treat posted/finalized/paid records as immutable. Corrections must create linked adjustments, reversals, or void records and preserve the source and audit trail.
- Return stable identifiers, status/state enums, timestamps, actor information, relationship/lineage references, and permission-aware action availability.
- Mutations must be idempotent where practical and produce audit events with actor, reason, timestamp, before/after or linked-record references.

## Acceptance checks
- No hard-coded demo data in production paths.
- No action is exposed if the user lacks permission or the record state blocks it.
- Destructive or high-consequence actions explain impact, require appropriate confirmation, and provide a recovery/correction path.
- The screen remains usable at mobile, tablet, and desktop widths without horizontal overflow.
