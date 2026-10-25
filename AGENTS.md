# Avenor engineering guide

This task already runs in an isolated checkout. Use the existing repository; do not create a worktree unless requested.

Avenor is a Next.js App Router + FastAPI + PostgreSQL monorepo. UI language is English. Product specification is in docs/product-specification.md. Implement real persisted functionality; no mock API or decorative inactive controls.

- API: apps/api. Use uv, SQLAlchemy async sessions, Alembic migrations and Pydantic v2 schemas. Every resource must be workspace scoped; check membership and mutation roles on the server. Cookie sessions require CSRF headers for mutations. Never persist credentials in source.
- Web: apps/web. Strict TypeScript, generated OpenAPI contracts, TanStack Query, ECharts. Small feature components, design tokens, keyboard support, reduced motion and mobile usability.
- Analytics: money is Decimal/NUMERIC. Centralize metric definitions. Do not double count line items. UTC date boundaries, bounded queries, currency isolation, safe CSV export.
- Test against PostgreSQL. Run uv run pytest, uv run ruff check ., uv run mypy app in apps/api; npm run typecheck, npm test, npm run lint, npm run build in apps/web. Browser tests require both services.
- Keep README and docs/implementation-status.md accurate. Never claim checks that were not run. Keep secret values, generated databases, caches, and screenshots from failed tests out of Git.
- Make logical Conventional Commits after relevant checks. All commits remain local. Never push without an explicit new request.
