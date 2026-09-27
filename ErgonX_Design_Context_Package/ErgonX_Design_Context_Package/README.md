# ErgonX Approved Design Context Package

This package contains the approved ErgonX screen concepts and implementation briefs for use by a parallel design/implementation agent.

## Governing product rules
- Preserve the approved ErgonX shell: navy structural sidebar, light top bar, role-aware navigation, and tenant-aware identity areas.
- Use original supplied raster logo assets in the appropriate product surfaces; do not invent substitute logo artwork.
- Standard Employees land on Self-Service Home; managers, HR, Finance, Directors, and administrators land on the general workspace according to effective permissions.
- Insights is permission/module scoped; Executive Dashboard is organization-wide for Institution Admin and Director roles.
- Never fabricate production KPI/chart data. Use governed empty states when authoritative data is unavailable.
- Maximum two uses of the same visualization type per dashboard is a hard acceptance criterion.
- Draft/unreferenced configuration records may be hard-deleted only after dependency checks.
- Referenced master data must be deactivated/archived; finalized, posted, paid, approved, completed, audit, and security records must not be hard-deleted through normal UI.
- Corrections use linked adjustment, reversal, void, cancellation, or replacement records while retaining the original.

## Package structure
- `images/`: approved concept image references where generated assets were available.
- `concepts/`: one implementation brief per concept, including UI components, responsive behavior, frontend integration, backend expectations, and acceptance checks.
- Concepts without an image file are still documented; their approved visual was previously shown in the design thread but its generated file reference was not retained in the current index.

## Explicitly excluded duplicates
Later duplicate Approvals workspace and Audit Trail workspace explorations are intentionally excluded because their canonical designs were already approved earlier.
