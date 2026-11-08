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

If Windows blocks `.ps1` files, use the command launcher:

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

#### Windows PowerShell with fnm

If PowerShell reports that `node` or `npm` is not recognized, Node.js may be
installed through [fnm](https://github.com/Schniz/fnm) without its environment
being loaded in the current terminal. Run this once in that terminal, then
rerun the frontend commands:

```powershell
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
fnm install 20
fnm use 20
node --version
npm --version
```

Node.js 20 or newer satisfies the prerequisite. To load fnm automatically in
future PowerShell terminals, add the first command to your PowerShell profile
(`$PROFILE`).

## Render deployment with Groq

Your Render deployment uses **separate frontend and backend services**.
`render.yaml` is a reference blueprint for that layout; for existing services,
copy the matching settings into their dashboards rather than creating duplicates.
Both services use the repository root directory.

| Setting | Frontend (Static Site) | Backend (Python Web Service) |
| --- | --- | --- |
| Build command | `npm ci && npm run build` | `pip install -r backend/requirements.txt` |
| Publish directory | `dist` | — |
| Start command | — | `python -m uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT` |
| Health check | — | `/health` |

On the **frontend service**, set `VITE_API_URL` to the backend's **public HTTPS
origin**, for example `https://YOUR-BACKEND-SERVICE.onrender.com`. Use the actual
URL shown on the backend's Render dashboard. Do not append `/api`, `/docs` or
`/backend`; the client adds API paths. Do not use the frontend URL, localhost,
or Render's internal hostname. **Rebuild/redeploy the frontend after saving:**
Vite embeds this value during the build, so restarting alone is insufficient.

On the **backend service**, set:

```text
LLM_PROVIDER=groq
AGENT_MODEL=openai/gpt-oss-20b
USE_MOCK_AGENT=false
USE_CACHED_DEMO=true
```

Set **`GROQ_API_KEY` privately in the backend's Render → Environment** and redeploy
that service. Never put it on the frontend, prefix it with `VITE_`, or commit it.
The current backend permits cross-origin requests from the separate frontend.

The optional combined-service entry point `backend.web:app` remains available
for local production tests; it is not needed for this separate-service setup.

After deploying, check `/health` and `/api/config` on the **backend URL**, then
**Open mock graph → pet → chat** on the **frontend URL**. `/api/config` should report `agent_mode: live`, `provider: groq`, and
`credential_configured: true`. A successful chat verifies the key actually works.
No LLM credential is required for graph rendering or theme changes.

The mock graph supports live Groq questions and blast-radius explanations. It
has no associated Java source, so live refactor generation/application still
requires a source-backed project. Proposal previews show the backend's supplied
health scores; equal scores mean no measured improvement yet. Hover or focus
**Approve change** to preview a score, and leave it to restore current health.

**Appearance:** Settings → Appearance offers System, Light, and Dark. System
tracks changes without overwriting your preference; manual choices persist.
The pixel pet honors reduced-motion settings. Both graph views share theme tokens.

## Demo walkthrough

1. Click **Open mock graph**. The included `graph.json` is loaded through FastAPI;
   this presentation UI examines only that mock file. Start both servers above.
2. The 2D canvas fills the workspace until you select a class or open the pet.
   Drag tiles freely: connected arrows follow as you move. Drag empty space to
   pan, scroll to zoom, or use **View → Fit graph to screen**.
3. Click a class to inspect its callers. Press Escape or use **View → Reset view
   & selection** to restore the full canvas. Use **2D / 3D** to switch views.
4. Click the pet in the bottom-right corner to open **Chat**. Send it a
   message, or select a class first to enable **Track Blast Radius** and
   **Modernize Class**. Close the drawer using its close button, the pet, or Escape.
5. Agent chat and graph requests use the same `demo` backend project. If the
   backend cannot be reached, the workspace shows an error and **Retry**.

`USE_MOCK_AGENT=true` keeps these API operations offline. For real Groq responses,
follow **Enable Groq** below. Turning off mock mode changes LLM behavior; it does
not turn the fixture graph into analysis of uploaded source code.

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

Proposals contain typed `{path,before,after}` previews. The `demo` project has no
editable source, so `/apply` returns 409; `/reject` works. Uploaded source-backed
projects support exact-source checks, applying changes and re-analysis. Compilation
and behavioral validation remain unfinished. Health previews stay unchanged
until a measured score is available.
Pet chat and domain inference are exposed through
`POST /api/projects/demo/pet` and `/api/projects/demo/domains`. The pet mood
is computed from backend health; inferred domain tags persist in memory until restart.

## Analyze your own Java checkout

The API supports uploading a Java ZIP and analyzing it into a project-specific
graph. The presentation UI is currently restricted to the included mock file.
To analyze Java locally:

```sh
# Windows: replace .venv/bin/python with .\.venv\Scripts\python.exe
.venv/bin/python -m backend.analysis --repo /path/to/java-repo --output /tmp/graph.json --frontend-output /tmp/graph.frontend.json
```

The parser is an ENG-1 implementation: imports, inheritance and explicit
class-qualified calls are supported; full instance-call resolution, measured
churn and vulnerability scanning remain future work.

## What is still missing for the full product?

The API has upload, analysis, proposal and apply endpoints for Java ZIP projects.
The presentation UI currently opens only the mock graph:

| Capability | Current state / missing work |
| --- | --- |
| Upload or clone a Java project | Safe ZIP ingestion and per-project in-memory analysis are implemented. Git clone and durable storage remain future work. |
| Real graphs in the UI | The API serves uploaded graphs; the current UI needs a source-project selection/upload flow restored. |
| Complete Java dependencies | Parser handles imports, inheritance and class-qualified calls. Instance dispatch and full symbol resolution remain incomplete. |
| Agent UI | The pet is the project-aware chat agent. It answers graph questions, creates proposals, and exposes explicit apply/reject actions. |
| Apply and validate proposals | Uploaded-project proposals verify exact source contents, write only proposed files, re-analyze Java, and update health. |
| Live LLM | Groq support is implemented. Configure `GROQ_API_KEY`, `LLM_PROVIDER=groq`, and `USE_MOCK_AGENT=false` on the backend. |
| Pet evolution | Animated sprite, health, moods and proposal-score previews are connected. Measured preview scoring and durable progression remain. |
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

Production smoke tests (build the app and serve it without Vite):

```sh
# Separate frontend on 8013 and API on 8014, matching Render
TEST_SPLIT_DEPLOYMENT=true TEST_PYTHON="$PWD/.venv/bin/python" npx playwright test --config playwright.production.config.ts
# Optional combined service on 8013
TEST_PYTHON="$PWD/.venv/bin/python" npx playwright test --config playwright.production.config.ts
```

For an existing Chromium installation, optionally set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable. Linux machines may need
Playwright's browser system dependencies (`npx playwright install --with-deps chromium`).

Provider integration validation covers 61 Python tests, including Groq SDK
payloads, all response schemas, provider errors, mock isolation and FastAPI pet
integration. The production build and impact regression check also pass.
The earlier browser tests target the previous agent-workspace layout; they need
updating alongside restoration of that UI after the latest redesign. The build still reports a
large-bundle warning. Windows commands are provided but were not executed on
this Linux validation machine.

## Enable Groq (backend only)

The default provider is **Groq**, using the official SDK and strict JSON Schema
outputs. The default model is `openai/gpt-oss-20b`, hosted on Groq; this model name
**does not require an OpenAI API key**. OpenAI remains an optional provider.

1. Create a key in [Groq Console](https://console.groq.com/keys). If a key has been
   shared in chat or committed anywhere, revoke it and create a replacement.
2. Copy `.env.example` to `.env` in the repository root. Enter the replacement
   key **privately** as `GROQ_API_KEY`. `.env` is ignored by Git. Never put the key
   in a `VITE_` variable; those values can become public browser assets.
3. Keep `LLM_PROVIDER=groq`, `AGENT_MODEL=openai/gpt-oss-20b`, and
   `USE_MOCK_AGENT=false`. Do not use a model lacking strict JSON Schema support.
   Live mode is the default; set `USE_MOCK_AGENT=true` only for an intentional
   offline demo.

### Render agent configuration

For the deployed backend, add these environment variables in Render:

```text
LLM_PROVIDER=groq
AGENT_MODEL=openai/gpt-oss-20b
USE_MOCK_AGENT=false
GROQ_API_KEY=<your private Groq key>
```

The pet chat uses the live provider, and modernization requests create a
validated proposal. Upload a Java ZIP before applying a proposal; the backend
writes only the exact proposed files, re-analyzes the project, and updates the
knowledge graph health.
4. Reinstall Python requirements and restart the API with `.env` loaded.

Windows PowerShell (copy only when `.env` does not already exist):

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Edit .env privately and add your new key, then:
.\scripts\run-api.cmd -Live
```

macOS / Linux:

```sh
test -e .env || cp .env.example .env
# Edit .env privately and add your new key, then:
.venv/bin/python -m pip install -r backend/requirements.txt
USE_MOCK_AGENT=false .venv/bin/python -m uvicorn backend.api.main:app --env-file .env --host 127.0.0.1 --port 8000
```

Exported shell variables take precedence over `.env`. The Windows launcher now
respects `.env`/existing variables; `-Live` explicitly overrides an earlier
`USE_MOCK_AGENT=true`. Without any configuration the app remains in offline mode.

Check configuration without displaying the key:

```sh
# Windows: replace .venv/bin/python with .\.venv\Scripts\python.exe
.venv/bin/python -m backend.agent.check_provider --env-file .env
# Optional: one small provider request, subject to your Groq quota/billing:
.venv/bin/python -m backend.agent.check_provider --env-file .env --live
```

`GET /api/config` reports the provider, model, mode and whether a credential is
present; it never returns the key. Presence does not prove credential validity.
The live check verifies a structured response. Authentication, quota, timeout,
truncated output and invalid JSON failures are surfaced as errors, not fake demo
successes. No live credential check was performed during this integration;
the provider tests use the real Groq SDK with an in-memory HTTP transport.

The live workspace mounts `AgentPanel.tsx` in FastAPI mode. Pet, blast and
domain actions can be exercised directly in the Details view; proposals remain
preview-only. Setting a key alone does not implement uploads: all graph routes
still serve the demo graph.
`USE_CACHED_DEMO=false` only changes which fixture is loaded.

For this managed cloud environment, enter the replacement `GROQ_API_KEY` through
secure environment settings and permit `api.groq.com`. A draft requirement was
prepared; saving a draft alone does not inject a credential or activate access.
For OpenAI compatibility, set `LLM_PROVIDER=openai`, `OPENAI_API_KEY` and an
appropriate `AGENT_MODEL` (default `gpt-4o-mini` when unset).

## Troubleshooting

### Windows: WinError 10013 (socket access forbidden)

This occurs while binding the server port, before any Groq request. Windows may
reserve that port, another process may hold it exclusively, or local security
policy may block the bind. The pip upgrade notice is unrelated.

Try a different port without the reload subprocess:

```powershell
# Backend terminal, from the repository root:
.\scripts\run-api.cmd -Live -Port 8765 -NoReload
```

In the frontend terminal, stop Vite with Ctrl+C and restart it with a matching
proxy target:

```powershell
$env:API_PROXY_TARGET = "http://127.0.0.1:8765"
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:8765/health` to confirm the backend started. Use
`http://127.0.0.1:8765/docs` for API requests. If `.env.local` sets `VITE_API_URL`
to the old backend port, remove that override to use the proxy, or update it.

If binding still fails, inspect the selected port (replace 8765 if needed):

```powershell
Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue
netsh interface ipv4 show excludedportrange protocol=tcp
```

Choose an unused port outside any excluded ranges. If an unreserved port also
fails, local security software or policy needs investigation; send the error
and port diagnostics without any credentials. The launcher accepts `-Port`
(1–65535) and `-NoReload`; default behavior remains port 8000 with reload enabled.

### Other setup issues

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
