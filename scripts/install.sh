#!/usr/bin/env bash
set -euo pipefail
repo=$(cd -- "$(dirname -- "$0")/.." && pwd)
export UV_CACHE_DIR="${UV_CACHE_DIR:-$repo/.data/uv-cache}"
export npm_config_cache="${npm_config_cache:-$repo/.data/npm-cache}"
export DOCKER_CONFIG="${DOCKER_CONFIG:-$repo/.data/docker}"
cd "$repo"
uv sync --project apps/api --frozen
npm ci --prefix apps/web
docker compose up -d --wait db mail
(cd apps/api && uv run --frozen alembic upgrade head)
