import os
import sys
from pathlib import Path

api_dir = Path(__file__).resolve().parent
project_root = api_dir.parent
backend_dir = project_root / "backend"

for p in [str(backend_dir), str(project_root), str(api_dir), os.getcwd(), os.path.join(os.getcwd(), "backend")]:
    if os.path.exists(p) and p not in sys.path:
        sys.path.insert(0, p)

try:
    from server import app
except Exception as e:
    import traceback
    print("Vercel Server Import Exception:", traceback.format_exc())
    from fastapi import FastAPI
    app = FastAPI(title="YAMINI FLOW Fallback")
    @app.get("/{full_path:path}")
    async def fallback_err(full_path: str):
        return {"error": "Server initialization exception", "detail": str(e)}
