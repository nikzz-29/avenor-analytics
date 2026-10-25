# Architecture decisions

## Boundaries

- Next.js routes/layouts are server components; interactive features are client boundaries. Query state uses TanStack Query; no extra global state library is needed. Workspace context holds only authenticated user, selected workspace and formatting preferences. Changing workspace remounts the feature tree so an unsaved import/form cannot accidentally carry across workspaces.
- Browser requests remain same-origin. The Next proxy forwards cookies to the API. Pydantic generates OpenAPI and `openapi-typescript` generates frontend contracts. Financial values cross the API as decimal strings.
- FastAPI routers handle HTTP and permission dependencies. Query/import/demo modules hold domain operations. SQLAlchemy statements remain explicit and parameterized; no generic repository framework. Request-scoped async sessions commit once or roll back on failure.
- PostgreSQL stores durable state. Imports are synchronous, bounded, validated off the event loop, and inserted in batches of 1,000 within one transaction. For the measured 100,000-row ceiling this avoids a worker/Redis deployment. Above this ceiling, add a durable queue and private staging before raising limits.

## Identity and access

Random 256-bit session and CSRF tokens are hashed in the DB. Sessions last seven days. HttpOnly session cookie, SameSite=Lax, optional Secure, exact configured Origin validation, and a session-bound CSRF header on all authenticated mutations. Login/register/demo/reset endpoints enforce Origin and IP/path limits. Sensitive rate limits are in-process (single API process); distributed deployments need a shared store and trusted ingress rate limits.

Argon2id hashes passwords in a threadpool. Reset tokens expire in 30 minutes, are single-use and revoke sessions on use. Password changes revoke other sessions and outstanding resets. Mailpit delivers development mail locally; this is not a production email provider.

Every protected resource requires a workspace membership. Owner/Admin manage members and settings; Editor edits content; Viewer reads and exports only. Known foreign IDs yield 404. An Admin cannot remove/promote another Admin or modify the Owner. One Owner is created with a workspace; ownership transfer is not implemented.

## Data model

- `users`, `sessions`, `password_resets`: identity and preferences.
- `workspaces`, `workspace_members`: tenancy and roles.
- `datasets`: normalized schema, fingerprint, row count, import metadata.
- `sales`: indexed workspace/date/customer facts; one order/product line per dataset.
- `import_jobs`: completed/failed outcomes and bounded errors; original files are not retained.
- `dashboards`: typed widget query/configuration/layout JSON plus revision and updated time.
- `reports`: saved validated query JSON.
- `audit_logs`: actual workspace actions, not generated business events.

Product/category/customer/channel dimensions live in the imported facts. They are not independent editable catalog entities, so separate unused dimension tables are deliberately omitted. Money uses NUMERIC(14,2), quantities are positive integers, roles/statuses have checks, and FK cascades delete dependent sales. Indexes cover tenancy/date/customer access. A composite unique key rejects duplicate dataset/order/product lines; exclusive workspace mutation locks prevent overlapping order IDs across sources during concurrent imports and serialize population/reset/deletion. Analytics acquires shared locks on the same row to prevent a response mixing old KPI totals with newly imported chart data.

## Layout persistence

Widget order, half/full width, standard/tall height, title, type, notes and query are persisted together. The API updates a dashboard only if the submitted revision matches. A conflicting tab receives 409 and must reload. Saving is explicit, so rapid UI rearrangements coalesce into one atomic write. Dnd-kit provides mouse/keyboard sorting; arrows provide accessible mobile ordering. Width/height use preset grid choices, not arbitrary pixel resizing. Rename uses a separate draft until Apply; mutations are disabled during a pending save. Discard confirmation covers workspace selection and in-app links; save before using browser Back/Forward, which are not intercepted by App Router.

## Cloud builds

This cloud host can run Docker but build containers initially could not resolve the platform egress proxy. Validation supplied the existing proxy as Docker predefined proxy build arguments, added its resolved hostname mapping to the ephemeral build configuration, used host build networking, and mounted the host's public CA bundle through BuildKit's optional `cloud_ca` secret. TLS and artifact hashes stayed enabled. No proxy credentials, CA bundle contents or cloud-specific host mapping are committed. The Dockerfiles also work without the optional CA mount on ordinary networks. Runtime containers do not require package downloads.

Cloud snapshots and named Docker volumes have distinct lifecycles. Do not assume a running process, session, database volume or local-only commit has been restored in a fresh task. Start services, run migrations and exercise the health endpoints; demo datasets can always be regenerated.
