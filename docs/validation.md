# Validation evidence

Checks run in the actual cloud execution environment; no external deployment is implied.

| Check | Observed result |
| --- | --- |
| Backend pytest with PostgreSQL + local SMTP | 50 passed after audit |
| Backend Ruff lint and format | passed |
| Backend mypy | passed (all app modules) |
| Frontend Vitest / Testing Library | 16 passed after audit |
| Strict TypeScript | passed |
| ESLint | exits 0; one informational TanStack Table/React Compiler compatibility warning |
| Next.js production build | passed |
| Alembic from empty database | upgrade → downgrade base → upgrade passed |
| Docker API and web image builds | passed, TLS and checksums enabled |
| Docker Compose runtime | PostgreSQL, Mailpit, API and web healthy; production browser validation described below |
| Dependency audit | npm: 0 known findings including dev dependencies; pip-audit: 56 installed Python packages, 0 known findings at execution time |
| Installer | frozen uv/npm installs, service readiness and migrations executed successfully; native dev runner verified web → proxy → session → PostgreSQL analytics and clean shutdown |
| Performance | 10,000/100,000-row imports and exact expected revenue verified; actual timings in benchmark.json |

## Backend scenarios

Session cookies, invalid credentials, CSRF/Origin denial, logout, viewer permissions, known foreign workspace/dashboard IDs, Decimal revenue with discounts/refunds/cancellations, distinct multi-line order counts, null empty-window AOV and growth, filters, grouped totals versus sum-of-averages, exact raw exports including customer search, CSV/XLSX mapping, duplicate files/lines/overlapping orders, atomic failed imports, replace, order consistency, malformed numeric filters, oversized chunked requests, optimistic dashboard conflicts, deterministic demo reset, one-time reset mail and session revocation.

A dedicated ASGI response-boundary regression opens an independent DB connection while response headers are being sent and verifies that the new user already exists. This protects against immediate browser refetches observing an uncommitted transaction.

## Browser scenarios

Ten Playwright workflows exercise real UI + API + PostgreSQL: demo/exploration/dashboard persistence/import/report CSV; registration/workspace/demo/preferences/logout; themes/responsive navigation and screenshots. The suite checks no page overflow at 360/390/768/1024/1440/1920 px. Axe runs on light and dark Overview. Runtime page exceptions are asserted absent during the main functional journey. Screenshots are captured from the live app with reduced motion; no fixed mock API datasets are injected.

Development-server runs passed. Production-container runs exposed a transaction timing race; the DB dependency was changed to function scope so commit completes before the response is sent, and a regression test was added. A run interrupted by concurrent npm reinstallation is not counted as a pass. The initial production-container run passed three workflows. The expanded audit suite and final production outcome are recorded below.

## Reproducibility

Use the exact commands in README. Unit/integration tests are independent from UI evidence. Backend tests operate only on a database whose name ends in `_test`; fixtures reset that dedicated database between cases. Browser tests create fresh independent users/workspaces. Historical browser failures and traces remain ignored under `apps/web/test-results`, not in committed evidence. Browser tests are functional and accessibility checks, not screenshot pixel-baseline tests.

## Audit follow-up

See [bug-audit.md](bug-audit.md) for the reproduced issues and corrections. The expanded backend suite has 50 cases, including date/numeric/text boundaries, sparse/partial period comparisons, full daily coverage, shared-read consistency during imports, source replacement metadata, malformed files, cross-workspace child IDs and role escalation. The frontend suite has 16 tests. Browser coverage adds slow saves, cancelled navigation/workspace changes, rename cancellation, nested filter forms, repeated Explorer additions, XLSX mapping with exact cents, latest-data period, device-theme persistence, default dashboard deletion and demo-reset navigation. Every journey checks for unhandled JavaScript exceptions and HTTP 5xx. A further responsive journey checks all nine workspace sections at 360/768/1440 px. Encrypted XLSX and active chartsheets now have explicit parser regressions.

OpenAPI and generated TypeScript were regenerated and hash-checked with no drift. Alembic upgrade and schema drift check passed. npm and Python dependency audits were repeated with no known findings. No external deployment or remote Actions result is inferred.

Final audit production-container run: **10 Playwright tests passed in 30.0 seconds** against the rebuilt API and standalone Next.js images. PostgreSQL, Mailpit, API and web were healthy. The application source was unchanged after this run.
