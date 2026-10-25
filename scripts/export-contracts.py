"""Run from apps/api: uv run python ../../scripts/export-contracts.py."""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'apps/api'))
from app.main import app  # noqa: E402

(root/'packages/api-contracts/openapi.json').write_text(json.dumps(app.openapi(),indent=2)+'\n')
