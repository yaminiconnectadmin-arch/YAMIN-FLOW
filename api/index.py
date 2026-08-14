import os
import sys
from pathlib import Path

api_dir = Path(__file__).resolve().parent
project_root = api_dir.parent
backend_dir = project_root / "backend"

for p in [str(backend_dir), str(project_root), str(api_dir), os.getcwd(), os.path.join(os.getcwd(), "backend")]:
    if os.path.exists(p) and p not in sys.path:
        sys.path.insert(0, p)

from server import app
