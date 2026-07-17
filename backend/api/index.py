import sys
from pathlib import Path

# Add project root to path so server can be imported
sys.path.append(str(Path(__file__).parent.parent))

from server import app
