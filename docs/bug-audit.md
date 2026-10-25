# Bug audit — 25 October 2026

Scope: every application module, API inputs/authorization, SQL analytics and concurrency, CSV/XLSX parsing and replacement, UI forms/navigation/cache/persistence, generated contracts, dependencies, migrations and Docker production runtime. Existing baseline: 20 backend tests and 11 frontend tests passed, demonstrating that a green baseline alone did not cover these edge cases.

## Fixed findings

| Area | Reproduced behavior | Correction / regression evidence |
| --- | --- | --- |
| Date validation | Reversed GET ranges and a previous-period underflow raised server errors | 422 responses; three list routes and Overview tested |
| Database input bounds | Extreme numeric filters, NUL text and oversized entity pages could reach PostgreSQL and fail | Validation before DB operations; additive/undefined metric cases tested |
| AOV | A category/status with no eligible orders displayed zero AOV | Nullable points, null-aware charts/tables and blank export cells |
| Overview truncation | Daily views stopped after the default 100 groups while KPI covered the full year | Full bounded calendar buckets; 365-day test and explicit >500 error |
| Period comparison | Sparse/partial previous months were paired by array index | Previous dates are shifted into current-period buckets and aligned, including a January/February → March regression |
| Analytics consistency | An import between KPI and trend queries produced old KPI + new chart totals | Shared read / exclusive mutation workspace locks; a gated concurrent request test failed before the fix and now passes |
| Default period | New 2026 data initially appeared empty behind the fixed 2025 filter | API-backed recommended year; real XLSX browser import verified |
| Replacement schema | Facts changed while dataset column metadata stayed old | Replace updates schema and facts together; failed replace preserves both |
| File parsing | Numeric dates became Unix timestamps; blank lines shifted error rows; malformed CSV and missing XLSX dimensions weakened checks | Strict ISO dates/CSV, physical source rows, actual row/column limits, workbook cleanup, explicit rejection of encrypted archives and active chartsheets |
| Source preview | A missing/foreign dataset looked like an empty dataset | Explicit workspace-scoped 404 |
| Workspace PATCH | Renaming cleared an omitted default; coupled updates could overwrite another setting | Independently patch only explicitly supplied fields; name-only/default-only/null behavior tested |
| Form buttons | Add/remove filter submitted the surrounding report/widget form | Explicit non-submit buttons, unit and real browser form checks |
| Filter values | Equals split product names containing commas into multiple values | Split only IN/Between; exact-match imported “Lamp, large” verified |
| Dashboard drafts | Closing Rename changed the draft; navigation silently discarded changes; edits during slow save could be overwritten | Separate rename draft, app-link/workspace discard confirmation, disabled pending-save controls and browser regressions |
| Stale caches | Explorer report saves/chart additions and deletion/reset of a default dashboard reused stale state | Invalidate related query and workspace caches; repeated additions and default navigation tested |
| Table formatting | Financial detail rounded cents away; chart tables ignored number locale | Explicit two-decimal detail formatting and locale propagation; $20.50 verified from XLSX to UI |
| Smaller UI state | Custom dates retained a preset label; returning to an earlier period restored an old page; saved account theme overrode a new device selection | Controlled preset, reset pagination state, device-theme precedence, tests |
| Notifications | An older timer could dismiss a newer toast | Cancel the previous timer and clean up on unmount |

## Authorization and integrity checks

- Foreign datasets, dashboards and reports remain inaccessible through another workspace even when the same user belongs to **both** workspaces.
- Editor/Admin cannot escalate to Owner or remove Owner; Viewer mutation restrictions remain covered.
- Concurrent demo population/imports do not duplicate facts. Failed replacements leave original data and schema intact.
- Existing session/CSRF/Origin/reset-token, transaction-before-response and CSV formula defenses remain covered.

## Verification

Final observed results: 50 backend tests, 16 frontend tests, 10 production-container E2E tests passed; type checking, Ruff, production build, migration drift and generated contracts passed. Details are recorded in docs/validation.md. The expanded browser suite also fails on any unhandled page exception or HTTP 5xx during each journey. This is a functional and security-oriented review, not a formal penetration test or proof of absence of all bugs.

Known scope remains in docs/implementation-status.md: bounded synchronous imports, USD/UTC, a single API process for in-memory rate limits, preset widget sizes, no PDF/scheduling/integrations, and Chromium-only browser automation. Browser Back/Forward is not intercepted by the unsaved-link guard; save before using history navigation. GitHub Actions status and external deployment are not asserted from local checks.
