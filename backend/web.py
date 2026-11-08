"""Serve the built React app and API from one Render HTTPS origin.

Build with `npm ci && npm run build`, then run `uvicorn backend.web:app`.
The development entry point remains backend.api.main:app.
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from backend.api.main import app as api

DIST = Path(__file__).resolve().parents[1] / "dist"
if not (DIST / "index.html").is_file():
    raise RuntimeError("Frontend build missing. Run npm ci && npm run build before starting backend.web:app")

# Own the homepage without replacing the API-only entry point's JSON homepage.
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/", include_in_schema=False)
def frontend() -> FileResponse:
    return FileResponse(DIST / "index.html", headers={"Cache-Control": "no-cache"})


app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")
# Preserve /api, /health, /docs and /openapi.json without a production proxy.
app.mount("/", api)
