# Offline demo checklist

1. Open two PowerShell terminals at the repository root.
2. In terminal one, run `pnpm dev`.
3. In terminal two, run `.\scripts\run-api.ps1`.
4. Open the Vite URL and confirm the graph is visible.
5. Use the first node name from the graph for a deterministic cached query.
6. Create a proposal for that node, apply it, and confirm the health score rises.
7. If the browser is closed, restart the API script; it regenerates both cache
   files before starting Uvicorn.

The selected offline demo is the checked-in AETHER fixture in
`src/mocks/graph.json`, containing 40 nodes and 90 edges. It is intentionally
stable so the presentation does not depend on a remote repository or API key.
