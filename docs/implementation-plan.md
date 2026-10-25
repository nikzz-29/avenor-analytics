# Implementation plan

1. Foundation: reproducible Python/Node dependencies, PostgreSQL, migrations, CI and containers.
2. Identity: Argon2id, expiring cookie sessions, CSRF, roles, isolated workspaces and deterministic demo.
3. Data: bounded CSV/XLSX preview/mapping/validation, atomic imports, SQL analytics, saved dashboards and reports.
4. Product: restrained green/neutral design system, responsive navigation, overview, explorer, sales/customers/products, sources, dashboards, reports and settings.
5. Evidence: PostgreSQL integration tests, frontend unit tests, actual browser workflows, production build, screenshots, documented limitations and local commits.

Money uses USD within each workspace in the initial release. Order facts have one row per order/product line; duplicate import keys are (dataset, order_id, product_name). Order-level counts use distinct order IDs. All analytics share the same net-sales expressions.
