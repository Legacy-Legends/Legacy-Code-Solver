# Platform and API

The backend is a lightweight FastAPI integration layer. It keeps project and
proposal state in memory so the demo has no database dependency.

## Run offline

From the repository root in PowerShell:

```powershell
.\scripts\run-api.ps1
```

The script generates `demo-repos/cache/graph.json` and
`demo-repos/cache/agent.json`, sets `USE_CACHED_DEMO=true`, and starts Uvicorn
at `http://127.0.0.1:8000`.

The equivalent commands are:

```powershell
python -m pip install -r backend\requirements.txt
python demo-repos\cache_demo.py
$env:USE_CACHED_DEMO = "true"
python -m uvicorn backend.api.main:app --reload --port 8000
```

## Endpoints

- `GET /api/projects` lists known projects.
- `POST /api/projects` registers project metadata.
- `GET /api/projects/{id}/graph` returns the graph contract.
- `POST /api/projects/{id}/blast` resolves an impact query.
- `POST /api/projects/{id}/proposals` creates a modernization proposal.
- `POST /api/proposals/{id}/apply` applies a pending proposal and updates
  health in the in-memory graph.
- `POST /api/proposals/{id}/reject` rejects a pending proposal.
- `WS /ws/terminal` streams startup messages and accepts client messages.

FastAPI's generated API reference is available at `/docs`.

## Integration seam

The blast and proposal routes receive an `Agent` through `Depends(get_agent)`.
The deterministic `MockAgent` is the offline default. The agent module can be
connected by replacing `get_agent` or using FastAPI's dependency overrides
without changing route handlers.
