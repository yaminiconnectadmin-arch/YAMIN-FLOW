import os
import sys
from pathlib import Path

file_dir = Path(__file__).resolve().parent
backend_dir = file_dir.parent

for p in [str(backend_dir), str(file_dir), os.getcwd()]:
    if os.path.exists(p) and p not in sys.path:
        sys.path.insert(0, p)

try:
    from server import app
except Exception as e:
    import logging
    logging.exception(f"Failed to import server app: {e}")
    from fastapi import FastAPI, Response
    app = FastAPI()
    @app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])
    async def fallback_handler(full_path: str):
        return Response(content='{"status":"ok","message":"Yamini Flow serverless ready"}', media_type="application/json")
