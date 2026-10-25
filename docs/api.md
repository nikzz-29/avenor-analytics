# API conventions

Base path: `/api/v1`. Interactive OpenAPI documentation: API `/docs`. The generated schema is committed under `packages/api-contracts`.

- JSON responses; decimal financial values are strings, ISO dates/timestamps, opaque UUID resource IDs.
- Auth: `avenor_session` HttpOnly cookie. Authenticated non-GET requests require `x-csrf-token` matching the readable `avenor_csrf` cookie and session hash. An Origin header, when supplied, must match APP_ORIGIN.
- Resource paths are `/workspaces/{workspace_id}/...`. Unknown/foreign resources return 404. Insufficient mutation roles return 403.
- `/auth`: register, login, logout, me, password, forgot-password, reset-password, demo.
- Workspace list/create/update, members list/PUT/delete, demo population/reset, activity. Workspace PATCH changes only supplied fields; name cannot be null, while default_dashboard_id can explicitly be cleared.
- Datasets list, multipart preview/import, preview records, delete; import history and errors CSV.
- `/analytics/period` (recommended initial calendar year), `/analytics/overview`, `/analytics/query`, `/analytics/sales`, `/analytics/entities/{customers|products}`, grouped `/analytics/export`, filtered raw `/analytics/sales/export`.
- Dashboards list/create/get/patch/delete. A dashboard patch is an atomic name/widgets/revision update, including layout. Reports list/create/patch/delete; export uses the same analytics query contract.
- Errors use a human-readable `detail`, with field `errors` for request validation. Statuses: 401 unauthenticated, 403 forbidden/CSRF, 404 missing/scoped resource, 409 duplicate/conflict, 413 oversized, 422 invalid input, 429 limited, 503 unavailable local mail.
- Request IDs and structured timing/status logs avoid query strings, body contents and credential values. API responses are no-store. Production stack traces are not enabled.
- Sales pagination: page starts at 1, page_size 1–100. Entity pagination is also bounded. Query limit is 1–500, maximum 10 typed filters with up to 50 values each. Raw sales CSV export requires ≤100,000 matching lines; narrow filters otherwise.

Grouped point values can be null for undefined averages/AOV; CSV exports encode these as empty values, not fabricated zeros. Numeric filters are bounded to ±1 trillion and at most 12 decimal places. Invalid/reversed/unrepresentable date ranges, excessive pages and NUL characters are rejected as 422 before database operations.
