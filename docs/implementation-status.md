# Implementation status and deliberate limits

## Delivered

A real locally runnable commerce analytics workflow: authenticated users and isolated workspaces; permission roles; deterministic isolated demo; PostgreSQL facts and migrations; consistent SQL metrics; CSV/XLSX preview/mapping/validation/create/replace; bounded imports and duplicate prevention; Overview/Sales/Customers/Products; query explorer; dashboards with persistent widgets/layout and revision conflicts; saved reports and CSV exports; themes and persistent profile/number/date preferences; responsive UI; health checks, containers, tests, screenshots and local Git history.

This is an initial implementation of the master specification, not a declaration that all phases or every acceptance criterion are complete.

## Limits

- Commerce schema only, USD only, UTC calendar dates. No arbitrary dataset schemas, currency conversion, translated Russian UI or configurable analytics timezone. Products and customers are analytical fact dimensions rather than editable catalogs.
- Imports are synchronous/atomic, capped at 10 MiB / 100,000 rows. There is no durable background queue, pending-job polling, append/upsert into existing orders, retained raw upload archive or automatic retries. UI processing reflects the actual HTTP operation; no simulated progress.
- Grouped results are limited to 500 points; generic explorer queries omit missing date buckets; Overview fills and aligns revenue buckets. One primary metric/series per query; stacked mode is a single stacked series, not a multi-metric pivot. No advanced retention/LTV, forecasting or profit metrics.
- Dashboard layout supports sortable order and half/full width, standard/tall height presets. It is not a free-form arbitrary-pixel grid with resize handles. Persistence is explicit, with conflict detection; no collaborative merge. The unsaved-change guard covers app links and workspace selection, not browser Back/Forward.
- Member access is assigned to existing accounts. No email invitation flow, owner transfer, session-management screen, email change or automatic demo-account cleanup.
- Reports export CSV; no PDF/XLSX export, scheduled delivery, public report links, external integrations or P2 features. Column visibility is a current table preference, not a saved per-account table layout.
- Sensitive-endpoint rate limits are in-memory and assume one API process. Production ingress controls, shared rate limits, SMTP delivery, backup/restore, monitoring, retention policy and TLS termination need deployment-specific configuration. The Compose password is local-development configuration.
- Automated browser evidence is Chromium/Linux only. Firefox/WebKit and full visual-regression baselines are not claimed. Axe coverage is Overview in light/dark, not a complete WCAG certification. Manual visual inspection covers captured landing/desktop/mobile views.
- CI is supplied; the status of the remote GitHub Actions run has not been inspected. The initial implementation was pushed to main on the user’s request; audit fixes are local until a further push is authorized. No remote deployment was performed. Local commits cannot be assumed to restore in a fresh cloud task merely because an environment draft was saved.

These limits are reflected in the available UI. Unsupported external integrations, scheduling and collaboration have no inactive navigation or fake controls.
