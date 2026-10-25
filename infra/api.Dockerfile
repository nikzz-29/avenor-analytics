FROM ghcr.io/astral-sh/uv:0.12.23 AS uv
FROM python:3.12-slim
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN --mount=type=secret,id=cloud_ca \
    if [ -f /run/secrets/cloud_ca ]; then SSL_CERT_FILE=/run/secrets/cloud_ca uv --system-certs sync --frozen --no-dev; else uv sync --frozen --no-dev; fi
COPY apps/api/ ./
RUN useradd --uid 10001 --create-home app && chmod -R a+rX /app
USER app
EXPOSE 8000
CMD ["sh", "-c", "uv run --no-sync alembic upgrade head && exec /app/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000"]
