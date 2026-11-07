# Legacy Code Solver

Explore a Java dependency graph, trace change impact, and preview modernization
suggestions. React/Vite provides the UI; FastAPI connects the deterministic
analysis engine and the agent module.

## Quick start: offline demo (no API key)

Prerequisites: **Node.js 20+**, npm, Git, and **Python 3.11 or 3.12**
(the current pinned Python dependencies were tested on 3.12). Run all commands from
the repository root. Use two terminals; leave both servers running.

For a fresh checkout:

```sh
git clone https://github.com/Legacy-Legends/Legacy-Code-Solver.git
cd Legacy-Code-Solver
```

For an existing checkout, save your local work and run `git pull --ff-only` first.
Install dependencies while online; the demo makes no LLM calls. Google Fonts
are optional network requests; the interface falls back to local fonts offline.

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

If Windows blocks `.ps1` files, use the policy-safe launcher:

```powershell
.\scripts\run-api.cmd
```

### Terminal 2 — frontend (all platforms)

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Open **http://127.0.0.1:5173**. The API reference is
**http://127.0.0.1:8000/docs**; **http://127.0.0.1:8000/health** should respond
successfully. Stop either server with Ctrl+C. No cache-generation step is needed.

## Two-minute demo walkthrough

1. On the landing page, click **Investigate SessionManager**. The small Sample
   fixture shows CheckoutService depending on SessionManager.
2. Use **Graph AST View**, **Call Hierarchy**, and **Blast Radius** in the sidebar
   to explore the same dependency data. Where available, **View code** opens
   the fixture's source evidence. The demo evidence is checked-in sample data,
   not proof that an uploaded repository was parsed.
3. **Stay in 2D for this demo.** The current 3D toggle can throw
   `object.intersectsFrustum is not a function`. The installed graph renderer
   uses Three.js 0.187.0 alongside the app’s 0.170.0; these versions need to be
   aligned and the 3D flow retested. Reload the page if you encounter the error.
4. Click **Enterprise (40)** to explore the larger local fixture without a
   backend. Select a class from the sidebar or search box.
5. Click **FastAPI** to fetch the 40-node graph from your running server. A green
   indicator shows the connection. Select **BillingOrchestrator** to investigate
   its callers. This verifies browser → API → cached graph integration.
6. Open `/docs` for the agent demo below. The investigation UI currently computes
   impact locally from the loaded graph; it does not call the agent blast route.

**FastAPI is a data-source mode, not a live-LLM switch.** The commands above use
`USE_MOCK_AGENT=true` for offline agent behavior and `USE_CACHED_DEMO=true` for
the checked-in graph. No API key is required. The first two sample modes can
also run with only the frontend server.

## Try the agent endpoints

In the API reference, try:

1. `GET /api/projects/demo/graph` to see the graph and valid node IDs.
2. `POST /api/projects/demo/blast` with
   `{"query":"What breaks if BillingOrchestrator goes down?"}`.
3. `POST /api/projects/demo/proposals` with
   `{"target_node_ids":["node-1-1"]}`.

`node-1-1` is BillingOrchestrator in the checked-in demo. Its blast query currently
returns 100% because reverse reachability covers this densely connected fixture;
that is computed demo data, not an LLM estimate. Copy the returned proposal `id`
into `/api/proposals/{proposal_id}/reject` to complete the preview/reject flow.

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

## What is still missing for the full product?

The **2D fixture-based demo is working**. The 3D view has a known runtime error. The complete upload → analyze → AI refactor
→ apply → re-score workflow is **not implemented yet**:

| Capability | Current state / missing work |
| --- | --- |
| 3D view | Browser check failed with `object.intersectsFrustum is not a function`; dependency alignment and retesting are needed. Use 2D. |
| Upload or clone a Java project | Project creation stores metadata only. No ZIP/Git ingestion, authorized checkout, or per-project analysis pipeline. |
| Real graphs in the UI | Java analysis works via CLI. API graph routes still return the same demo graph for registered projects; CLI exports are not automatically loaded. |
| Complete Java dependencies | Parser handles imports, inheritance and class-qualified calls. Instance dispatch and full symbol resolution remain incomplete. |
| AI interaction in the UI | Agent blast/proposal routes work in mock mode via `/docs`. No conversational agent or proposal review UI is connected. |
| Apply and validate proposals | `/apply` deliberately returns 409. Need source loading, patch application, Java validation, re-analysis and measured health deltas. Mock diffs are illustrative fixtures. |
| Live LLM | SDK path exists, but needs `OPENAI_API_KEY` and outbound provider access. Live proposals also need a project-aware source loader. No real-provider call was verified in this environment. |
| Code-health pet and domain tags | Python functions exist; HTTP/UI wiring and pet visuals are absent. |
| Measured risk signals | Churn and vulnerability scanning are not implemented. Demo scores/signals are synthetic. |
| Persistence and terminal progress | Projects/proposals are in-memory and reset on restart. WebSocket currently sends startup text, not analysis/agent job progress. |

## Checks

```sh
# Windows: use .\.venv\Scripts\python.exe instead
.venv/bin/python -m pip install -r backend/agent/requirements-dev.txt
.venv/bin/python -m pytest backend/agent/tests backend/analysis/tests -q
npm run build
node scripts/test-impact.cjs
```

Latest validation: 37 Python tests, the frontend impact regression check, and the
production build passed. Chromium exercised sample investigation, all three
sidebar views and FastAPI graph loading in 2D without JavaScript exceptions.
The separate 3D check failed with the runtime error documented above. HTTP checks covered health, graphs, blast, proposal preview and
rejection. The build reports a large-bundle warning. Windows commands are
provided but were not executed on this Linux validation machine.

For live LLM mode, set `USE_MOCK_AGENT=false` and supply `OPENAI_API_KEY` securely
in the backend process. Default model: `gpt-4o-mini`. Live proposal generation
also requires a project-aware source loader; see the agent guide. No API key
belongs in frontend variables or committed files.

## Troubleshooting

- **Backend offline:** open `/api/projects` on port 8000 and check the backend
  terminal. Ensure the UI's data source is FastAPI.
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
