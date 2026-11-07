# Legacy Code Solver

Legacy Code Solver is an interactive dependency-graph demo for exploring
blast radius and proposing safe modernization changes. The React frontend
renders the graph, while the FastAPI platform layer exposes graph, impact,
proposal, and terminal APIs.

## Quick start

```powershell
pnpm install
pnpm dev
```

In a second PowerShell terminal:

```powershell
.\scripts\run-api.ps1
```

Open the Vite URL shown in the first terminal. The backend API reference is
available at `http://127.0.0.1:8000/docs`.

See [docs/PLATFORM.md](docs/PLATFORM.md) for the API contract and offline demo
workflow.
