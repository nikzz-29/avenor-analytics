"""Run both development servers and stop their process groups cleanly on exit."""
import os
import signal
import subprocess
import time
from pathlib import Path

root = Path(__file__).resolve().parents[1]
os.environ.setdefault('UV_CACHE_DIR', str(root / '.data/uv-cache'))
commands = [
    (["uv", "run", "--frozen", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"], root / 'apps/api'),
    (["npm", "run", "dev"], root / 'apps/web'),
]
processes = []

def stop(signum: int, frame: object) -> None:
    raise KeyboardInterrupt

signal.signal(signal.SIGTERM, stop)
try:
    for command, directory in commands:
        processes.append(subprocess.Popen(command, cwd=directory, start_new_session=True))
    while all(process.poll() is None for process in processes):
        time.sleep(0.25)
except KeyboardInterrupt:
    pass
finally:
    for process in processes:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
    for process in processes:
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
