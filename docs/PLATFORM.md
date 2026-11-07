# Platform and API

The backend is a lightweight FastAPI integration layer. It keeps project and
proposal state in memory so the demo has no database dependency.

## Run offline

From the repository root in PowerShell:

```powershell
.\scripts\run-api.ps1
```

The script generates the demo caches, sets `USE_CACHED_DEMO=true`, and starts Uvicorn
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
- `POST /api/proposals/{id}/apply` returns HTTP 409 for A1 previews until real
  patch validation and health recomputation are connected.
- `POST /api/proposals/{id}/reject` rejects a pending proposal.
- `WS /ws/terminal` streams startup messages and accepts client messages.

FastAPI's generated API reference is available at `/docs`.

## Integration seam

The blast and proposal routes receive an `Agent` through `Depends(get_agent)`.
The default `AgentAdapter` connects `backend.agent` to these routes.
`USE_MOCK_AGENT=true` (the default) bypasses the LLM for every agent function.
`USE_CACHED_DEMO` selects the graph fixture independently; old cached agent
responses are no longer read. Proposal diffs are now objects with `path`,
`before`, and `after` fields. Live proposals require a project-aware source loader.
See [the agent handoff](../backend/agent/README.md) for graph-summary limits,
provider configuration, typed contracts, and the A1 preview boundary.
