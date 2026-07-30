import os
import sys
from pathlib import Path

file_dir = Path(__file__).resolve().parent
backend_dir = file_dir.parent

for p in [str(backend_dir), str(file_dir), os.getcwd()]:
    if os.path.exists(p) and p not in sys.path:
        sys.path.insert(0, p)

from server import app
