"""Run FastAPI and Vite together, stopping both when either exits."""
import signal
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
python = root / '.venv/bin/python'
if not python.exists():
    python = Path.home() / '.venv/bin/python'
if not python.exists():
    python = Path(sys.executable)
env = None
canonical_db = root / 'artifacts' / 'clinical_hospital-local-canonical.sqlite'
if canonical_db.is_file():
    # Keep local API reads and writes on the verified DB copy that contains
    # both operational tables and the canonical DAV catalog. Production uses
    # its own environment and is unaffected by this local-only preference.
    import os
    env = os.environ.copy()
    env['DATABASE_URL'] = f'sqlite+aiosqlite:///{canonical_db}'
    env['DAV_CATALOG_DB_PATH'] = str(canonical_db)
    env.setdefault('DAV_CATALOG_RUN_ID', 'dav-canonical-local-20261030-v12')
processes = [
    subprocess.Popen([str(python), '-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000', '--reload'], cwd=root / 'backend', env=env),
    subprocess.Popen(['npm', 'run', 'dev:web'], cwd=root, env=env),
    subprocess.Popen(['npm', 'run', 'dev:admin'], cwd=root, env=env),
]
try:
    while all(p.poll() is None for p in processes):
        signal.pause()
finally:
    for process in processes:
        if process.poll() is None:
            process.terminate()
    for process in processes:
        try: process.wait(timeout=5)
        except subprocess.TimeoutExpired: process.kill()
