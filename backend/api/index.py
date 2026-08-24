import os
import sys
from pathlib import Path

api_dir = Path(__file__).resolve().parent
backend_dir = api_dir.parent

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from server import app
