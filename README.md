# Legacy Code Solver

Explore a Java dependency graph, trace change impact, and preview modernization
suggestions. React/Vite provides the UI; FastAPI connects the deterministic
analysis engine and the agent module.

## Quick start: offline demo (no API key)

Prerequisites: **Node.js 20+**, npm, and **Python 3.11+**. Run all commands from
the repository root. Use two terminals; leave both servers running.

### Terminal 1 — backend (macOS / Linux)

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
USE_MOCK_AGENT=true USE_CACHED_DEMO=true .venv/bin/python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
```

### Terminal 1 — backend (Windows PowerShell)

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
$env:USE_MOCK_AGENT = "true"
$env:USE_CACHED_DEMO = "true"
.\.venv\Scripts\python.exe -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
```

### Terminal 2 — frontend (all platforms)

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Open **http://127.0.0.1:5173**. Click **Investigate SessionManager** to explore the sample immediately.
In the investigation view, select **Live API** in the data-source selector to load the backend demo graph.
Search for a class (for example `BillingOrchestrator` in the backend fixture),
select it, and investigate its direct and indirect dependents. Switch between
the 2D and 3D views. The API reference is **http://127.0.0.1:8000/docs**.

The checked-in caches are sufficient; no cache-generation step is required.
“Live API” means the UI is fetching from your server. With `USE_MOCK_AGENT=true`,
agent responses still use offline demo logic, not a paid LLM.

## Try the agent endpoints

In the API reference, try:

1. `GET /api/projects/demo/graph` to see the graph and valid node IDs.
2. `POST /api/projects/demo/blast` with
   `{"query":"What breaks if BillingOrchestrator goes down?"}`.
3. `POST /api/projects/demo/proposals` with
   `{"target_node_ids":["<an ID from the graph>"]}`.

Proposals contain typed `{path,before,after}` previews. A1 does **not** apply code
or validate a refactor; `/apply` returns 409. `/reject` works. Health remains
unchanged until a real patch-validation and recomputation pipeline is connected.
Pet chat and domain inference are available as Python functions in
`backend.agent`; they are not yet exposed as UI features or HTTP routes.

## Analyze your own Java checkout

The current UI/API serves demo fixtures. Project creation registers metadata;
it does not yet upload, clone or analyze a repository. To analyze Java locally:

```sh
# Windows: replace .venv/bin/python with .\.venv\Scripts\python.exe
.venv/bin/python -m backend.analysis --repo /path/to/java-repo --output /tmp/graph.json --frontend-output /tmp/graph.frontend.json
```

The parser is an ENG-1 implementation: imports, inheritance and explicit
class-qualified calls are supported; full instance-call resolution, measured
churn and vulnerability scanning remain future work.

## Checks

```sh
# Windows: use .\.venv\Scripts\python.exe instead
.venv/bin/python -m pip install -r backend/agent/requirements-dev.txt
.venv/bin/python -m pytest backend/agent/tests backend/analysis/tests -q
npm run build
node scripts/test-impact.cjs
```

For live LLM mode, set `USE_MOCK_AGENT=false` and supply `OPENAI_API_KEY` securely
in the backend process. Default model: `gpt-4o-mini`. Live proposal generation
also requires a project-aware source loader; see the agent guide. No API key
belongs in frontend variables or committed files.

## Troubleshooting

- **Backend offline:** open `/api/projects` on port 8000 and check the backend
  terminal. Ensure the UI's data source is Live API.
- **Different backend address:** set `VITE_API_URL=http://127.0.0.1:8000` in
  `.env.local` and restart Vite. On another machine, use a backend address that
  your browser can reach; `localhost` always means the browser's own machine.
- **Missing Python packages:** install requirements with the same virtualenv's
  Python used to launch Uvicorn.
- **Port in use:** stop your old server, or choose another port and update
  `VITE_API_URL` accordingly.

More detail: [platform API](docs/PLATFORM.md),
[analysis engine](backend/analysis/README.md), and
[agent contracts and graph-summary format](backend/agent/README.md).
