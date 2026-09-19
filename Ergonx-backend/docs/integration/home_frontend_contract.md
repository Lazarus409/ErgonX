# Home frontend contract

Base path: `/api/v1/home/` (`GET`). Send the normal bearer token and `X-Institution-ID` when required.

Requires `home.view` and an active tenant membership. The response is a personalized, permission- and module-filtered workspace, not a persisted dashboard copy:

```json
{
  "greeting_context": {"greeting": "Good morning, Ada", "institution_timezone": "Africa/Accra"},
  "quick_actions": [{"code": "leave.request", "label": "Request leave", "route_hint": "/leave/requests/new", "is_pinned": true}],
  "recent_work": [],
  "attention_items": [],
  "notifications_summary": {"unread_count": 0, "latest": []},
  "optional_personal_snapshot": null
}
```

Render only returned action and route hints. `recent_work` contains at most two items. Attention is actionable work and must not be merged into notifications. Use the supplied local-time context; never infer the institution timezone from the browser.

`GET /api/v1/auth/bootstrap/` establishes the active institution, active membership, effective permissions, enabled modules, onboarding status, controlled `default_landing`, and eligible dashboard identifiers. Home is distinct from the executive and module dashboard endpoints.
