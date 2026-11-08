# Legacy Code Solver

Legacy Code Solver turns an unfamiliar Java codebase into a visual, explainable
modernization experience. Upload a Java ZIP, inspect its analyzed knowledge
graph, ask the pet-agent questions, review a concrete modernization proposal,
approve it, and export the updated codebase.

## Why it matters

Legacy systems are difficult to change safely because their dependencies and
risks are hidden across dozens of files. This project makes the codebase
understandable at a glance:

- **Visual knowledge graph:** classes, dependencies, cycles, modules, health,
  and blast radius are visible on one interactive canvas.
- **Actionable impact analysis:** select a class or ask the agent what a change
  affects before touching the code.
- **Pet as the agent:** the pet is the user-facing guide and its mood and health
  reflect the analyzed codebase and modernization progress.
- **Approveable modernization:** the demo agent proposes a source-backed,
  hardcoded `SessionManager` refactor for the CrownBank sample. Approval writes
  the exact file, re-analyzes the project, highlights changed nodes, updates
  health, and enables ZIP export.

The result is more than a dependency diagram: it gives developers and judges a
fast visual explanation of where a legacy system is fragile, what to modernize
first, and how an accepted change improves the system.

## Current demo

The current hackathon demo is deterministic and offline. It does not use Groq
or another external LLM, so the experience has zero API latency and is
repeatable on a demo laptop.

The hardcoded CrownBank modernization changes:

```java
private static Hashtable sessions = new Hashtable();
```

to a typed, thread-safe collection:

```java
private static final Map<String, AuthToken> sessions =
    new ConcurrentHashMap<>();
```

The proposal is generated from the uploaded source rather than showing an
unrelated canned diff. The backend validates the original file contents before
writing, re-runs Java analysis, updates the graph, and exports the modernized
project as a ZIP.

## Quick start

Requirements: Node.js 20+, npm, Git, and Python 3.11 or 3.12.

```sh
git clone https://github.com/Legacy-Legends/Legacy-Code-Solver.git
cd Legacy-Code-Solver
```

### Backend

Windows PowerShell:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
```

macOS/Linux:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
```

### Frontend

In a second terminal:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The backend health check
is [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health).

## Demo walkthrough

1. On the landing page, choose **Upload code files ZIP** and select the
   CrownBank archive.
2. The backend extracts and analyzes the Java source, skips `src/test`, resolves
   local types and service-locator dependencies, and opens the knowledge graph.
3. Switch between the 2D and 3D graph views. Select a node to inspect callers
   and blast radius.
4. Open the pet-agent chat. Ask questions or ask it to modernize the code.
5. Review the source-backed SessionManager proposal and choose **Approve
   change**.
6. Observe the health update and highlighted changed node, then use
   **Export modernized ZIP** on the graph canvas.

The **Open mock graph** button remains available for a quick UI tour without an
upload. The uploaded project is the path for the full analyze → propose →
approve → export demo.

## Deployment

Render uses separate services:

| Setting | Frontend static site | Backend Python web service |
| --- | --- | --- |
| Build command | `npm ci && npm run build` | `pip install -r backend/requirements.txt` |
| Publish directory | `dist` | — |
| Start command | — | `python -m uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT` |
| Health check | — | `/health` |

Set `VITE_API_URL` on the frontend to the public backend origin. The current
agent is mock-only; no API key or Groq configuration is required.

## Validation

```powershell
.\.venv\Scripts\python.exe -m pytest -q
npm run typecheck
npm run build
```

The repository uses npm and `package-lock.json` as its single frontend
dependency source.
