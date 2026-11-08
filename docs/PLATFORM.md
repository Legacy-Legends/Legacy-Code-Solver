# Platform and API

The backend is a lightweight FastAPI integration layer. It keeps project and
proposal state in memory so the demo has no database dependency.

## Run offline

From the repository root in PowerShell:

```powershell
.\scripts\run-api.ps1
```

If Windows reports that script execution is disabled, use the policy-safe
launcher instead:

```powershell
.\scripts\run-api.cmd
```

Or run the PowerShell script with a process-only bypass:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-api.ps1
```

The script generates the demo caches, sets `USE_CACHED_DEMO=true`, and starts Uvicorn
at `http://127.0.0.1:8000`.

## Groq live agent

1. Revoke any API key that was pasted into chat or committed anywhere.
2. Copy `.env.example` to `.env`.
3. Put the replacement key in `GROQ_API_KEY` inside `.env`.
4. Restart the API with `.\scripts\run-api.cmd`.

When `GROQ_API_KEY` is present, the agent uses Groq's OpenAI-compatible API.
Without a provider key, it automatically uses the deterministic mock agent.
The key is never sent to the frontend or written to source control.

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


## Connected frontend actions

FastAPI mode now calls these endpoints through Vite's `/backend` HTTP/WebSocket
proxy (default target `http://127.0.0.1:8000`):

- `GET /api/config`: agent mode, graph source, and apply capability.
- `GET /api/projects/{id}/impact?class_id=...`: reverse BFS, actual edge objects,
  direct/indirect dependencies and full shortest paths. No LLM needed.
- Existing blast and proposal/reject routes: used by the agent workspace.
- `POST /api/projects/{id}/pet`: `{query, recent_action?}`; health comes from the
  server graph, never from the browser.
- `POST /api/projects/{id}/domains`: ID-to-inferred-tag map, retained in the demo
  graph in memory. The next blast can report those inferred domains.
- `/ws/terminal`: connection/startup messages shown in the UI action log.

Sample/Enterprise modes remain local fixtures. FastAPI mode does not fall back
to a local graph after an error. Apply remains unavailable, and all registered
projects still share the demo graph pending real project ingestion/storage.
