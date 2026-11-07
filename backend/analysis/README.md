# Analysis engine — ENG-1

Owned by teammate 2. Python 3.11+; run commands from the repository root.
This package does not start a server or call an LLM. The API teammate can import
`backend.analysis` directly (the backend directory is a Python namespace package).

## Install and run

```sh
python -m venv backend/analysis/.venv
backend/analysis/.venv/bin/python -m pip install -r backend/analysis/requirements-dev.txt
backend/analysis/.venv/bin/python -m pytest backend/analysis/tests -q
backend/analysis/.venv/bin/python -m backend.analysis \
  --output backend/analysis/fixtures/graph.json \
  --frontend-output backend/analysis/fixtures/graph.frontend.json
# For an actual Java checkout:
backend/analysis/.venv/bin/python -m backend.analysis --repo /path/to/java-repo \
  --output /tmp/graph.json --frontend-output /tmp/graph.frontend.json
```

The committed fixtures have exactly 50 nodes and 100 unique edges, deterministic
cycles, varied health, and synthetic metrics. No network or credentials are
needed after installation. Generation uses seed 42 and takes under one second
on the development machine. `graph.schema.json` is the Pydantic JSON Schema.

## Teammate handoff

```python
from backend.analysis import (
    parse_repo, calculate_metrics, graph_model, to_frontend_graph,
    calculate_blast_radius, compute_health_score, export_graph,
)

G = calculate_metrics(parse_repo("/path/to/java-repo"))
engine_payload = graph_model(G).model_dump()
frontend_payload = to_frontend_graph(graph_model(G))  # GET /api/graph
export_graph(G, "/tmp/graph.json")
blast = calculate_blast_radius(G, ["com.example.AuthService"])
# After changing code, parse the checkout again and recompute metrics.
```

`generate_mock_graph(output_path=..., seed=42)` writes JSON and returns a validated
`Graph`. The strict contract uses `overall_health`, `modules`, `module_id` and
all Node fields requested in ENG-1. A module is `{id, name, node_ids, health}`;
every node belongs to exactly one module. Overall health is the rounded arithmetic
mean over all nodes (including external nodes); empty graphs score 100.

The existing frontend instead expects `overallHealth`, `clusters`, `clusterId`,
`clusterName`, and unique edge IDs. Use `to_frontend_graph` or the committed
`fixtures/graph.frontend.json` for it. Cluster anchors are deterministic display
coordinates, not architectural evidence. Domain tags remain empty and
`domain_inferred` remains false. No frontend source or API routing was changed.

### Direction and blast result

An edge `A -> B` means **A depends on B**. Change impact follows incoming edges
using reverse BFS, at arbitrary depth, matching the frontend's direction.
The result is `{target_node_ids, affected_nodes, affected_edges, percentage}`.
`affected_nodes` contains sorted IDs **including the targets**; edges are the
induced subgraph; percentage is affected count / total graph count * 100.
Deduplicated targets count once. Unknown IDs raise `ValueError`. Empty targets
return an empty result. API code should map this result to its own response
schema; this is not the frontend's `ImpactAnalysis` response.

### Determinism and metrics

- Stable Java IDs: package-qualified names, with dotted nested class names.
- Fan-in/out: unique incoming/outgoing neighbors (DiGraph degrees).
- Centrality: weighted PageRank, not betweenness.
- Cycle membership: strongly connected components plus self-loops. This yields
  the same cycle membership as enumerating simple cycles without exponential work.
- Modules: Louvain on the undirected projection with summed edge weights,
  sorted inputs and fixed seed. Edgeless graphs use singleton modules.
- Health: 100 minus penalties: complexity above 5 (1.5 each, cap 35), fan-out
  above 3 (2 each, cap 20), cycle (20), vulnerabilities (5 each, cap 15), churn
  (0.2 each, cap 10). Rounded and clamped to 0–100. This is a heuristic.

### ENG-1 boundaries

The five functions are working starter implementations, not a complete Java
semantic analyzer. Tree-sitter extracts classes/interfaces/enums/records,
method names, imports and inheritance. Explicit class-qualified calls are
supported. Instance calls, dynamic dispatch, reflection, method overloads,
external wildcard imports and full Java symbol resolution remain future work.
Import edges are file-level dependencies, not proof of actual use by each class.

Methods and imports stay in NetworkX node metadata and are excluded from JSON.
Complexity is a class sum: one per method/constructor plus AST decisions,
non-default switch labels, and short-circuit operators; nested classes count
separately. LOC counts physical lines in the declaration including comments.
Unreadable, invalid UTF-8 and syntactically invalid files are skipped and recorded
in `G.graph['diagnostics']`; invalid root paths raise `ValueError`.

The requested DiGraph keeps one edge per ordered pair. Repeated relationships
increase weight; the retained type has precedence extends > implements > calls
> imports. These weights are static evidence counts, never runtime call counts.

Real churn and vulnerability collection are not implemented in ENG-1; their
values default to zero, meaning unmeasured. Mock values are synthetic. Do not
present zero as a security finding. No real demo repository was selected for
this milestone; the platform teammate owns demo selection.
