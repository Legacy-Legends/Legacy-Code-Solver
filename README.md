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
3. Use the **2D / 3D** toggle to explore either view. The app and graph renderer
   now share Three.js 0.187.0; the previous `intersectsFrustum` crash is fixed.
4. Click **Enterprise (40)** to explore the larger local fixture without a
   backend. Select a class from the sidebar or search box.
5. Click **FastAPI** to fetch the 40-node graph from your running server. A green
   indicator shows the connection. Select **BillingOrchestrator** to investigate
   its callers. FastAPI mode requests dependency paths from the backend; Sample
   and Enterprise modes compute locally. Backend errors are shown explicitly.
6. In **Agent workspace**, enter “What breaks if BillingOrchestrator goes down?”
   and click **Ask impact**. The backend result shows counts and highlights the
   affected graph. The mock/live badge tells you which agent mode is active.
7. Click **Preview refactor** to inspect before/after code for the selected target,
   then **Reject proposal** to update its server-side status. Mock code is an
   illustrative fixture; Apply stays disabled until real validation is built.
8. Click **Infer domains** to label the graph (always marked inferred), then
   **Chat with pet** for a response based on server-side graph health. Expand
   **Connection and action log** to see WebSocket startup messages and completed
   UI actions. This log is not a stream of analysis-job progress.

**FastAPI mode uses the backend for graph, impact and agent actions.** The commands above use
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
Pet chat and domain inference are wired through the agent workspace and
`POST /api/projects/demo/pet` and `/api/projects/demo/domains`. The pet mood
is computed from backend health; inferred domain tags persist in memory until restart.

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

The **connected 2D/3D fixture-based demo is working**. The complete upload → analyze → AI refactor
→ apply → re-score workflow is **not implemented yet**:

| Capability | Current state / missing work |
| --- | --- |
| Upload or clone a Java project | Project creation stores metadata only. No ZIP/Git ingestion, authorized checkout, or per-project analysis pipeline. |
| Real graphs in the UI | Java analysis works via CLI. API graph routes still return the same demo graph for registered projects; CLI exports are not automatically loaded. |
| Complete Java dependencies | Parser handles imports, inheritance and class-qualified calls. Instance dispatch and full symbol resolution remain incomplete. |
| Agent UI | Blast questions, preview/reject, pet chat and inferred tags are connected. Real-provider behavior and source-aware refactors still need validation. |
| Apply and validate proposals | `/apply` deliberately returns 409. Need source loading, patch application, Java validation, re-analysis and measured health deltas. Mock diffs are illustrative fixtures. |
| Live LLM | SDK path exists, but needs `OPENAI_API_KEY` and outbound provider access. Live proposals also need a project-aware source loader. No real-provider call was verified in this environment. |
| Pet evolution | Mood and chat are connected. Evolving visuals and improvement after a validated code change remain unfinished. |
| Measured risk signals | Churn and vulnerability scanning are not implemented. Demo scores/signals are synthetic. |
| Persistence and terminal progress | Projects/proposals are in-memory and reset on restart. WebSocket currently sends startup text, not analysis/agent job progress. |

Recommended order to finish the hackathon plan:

1. Pick one 30–80-class Java demo, add safe ZIP/Git ingestion and per-project
   storage, then serve its real analysis and source evidence to the UI.
2. Connect source loading to the agent and implement one narrow refactor with
   exact-file checks, Java parse/compile validation, rollback, and re-analysis.
3. Feed the measured health change into the pet; verify live LLM output with
   credentials while keeping the offline demo reproducible.
4. Complete or explicitly defer instance-call resolution, measured churn,
   vulnerability checks, durable storage and real job progress.
5. Rehearse the full flow, capture a backup demo/video and finish the submission
   materials. The remaining items are implementation work, not configuration.

## Checks

```sh
# Windows: use .\.venv\Scripts\python.exe instead
.venv/bin/python -m pip install -r backend/agent/requirements-dev.txt
.venv/bin/python -m pytest backend/agent/tests backend/analysis/tests backend/api/tests -q
npm run build
node scripts/test-impact.cjs
```

Browser integration tests (they start isolated servers on ports 5174 and 8012):

```sh
npx playwright install chromium
# macOS/Linux; use your virtualenv Python path
TEST_PYTHON="$PWD/.venv/bin/python" npm run test:e2e
```

```powershell
# Windows PowerShell
npx playwright install chromium
$env:TEST_PYTHON = (Resolve-Path .\.venv\Scripts\python.exe).Path
npm run test:e2e
```

For an existing Chromium installation, optionally set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable. Linux machines may need
Playwright's browser system dependencies (`npx playwright install --with-deps chromium`).

Validation covers 42 Python tests, five browser integration tests, the frontend impact
regression check and the production build. Browser tests exercise real HTTP and
WebSocket connections, server impact, blast, preview/reject, domains, pet chat,
3D rendering, failure states and dataset switching. The build still reports a
large-bundle warning. Windows commands are provided but were not executed on
this Linux validation machine.

For live LLM mode, set `USE_MOCK_AGENT=false` and supply `OPENAI_API_KEY` securely
in the backend process. Default model: `gpt-4o-mini`. Live proposal generation
also requires a project-aware source loader; see the agent guide. No API key
belongs in frontend variables or committed files.

## Troubleshooting

- **Backend offline:** open `/api/projects` on port 8000 and check the backend
  terminal. Ensure the UI's data source is FastAPI.
- **Backend address:** by default Vite proxies `/backend` HTTP and WebSocket
  requests to `127.0.0.1:8000`, so the browser uses the frontend's origin. For a
  different server target, set `API_PROXY_TARGET` in the Vite process environment.
  For a separately hosted production API, set `VITE_API_URL` to its public origin
  before building, or configure your production host to reverse-proxy `/backend`.
  A static file host alone does not start the Python server.
- **Missing Python packages:** install requirements with the same virtualenv's
  Python used to launch Uvicorn.
- **Port in use:** stop your old server, or choose another port and update
  `VITE_API_URL` accordingly.

More detail: [platform API](docs/PLATFORM.md),
[analysis engine](backend/analysis/README.md), and
[agent contracts and graph-summary format](backend/agent/README.md).
