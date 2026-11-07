"""Explicit adapter to the existing src/types/index.ts GraphData contract."""
from typing import Any
from .models import Graph


def to_frontend_graph(graph: Graph) -> dict[str, Any]:
    modules = {module.id: module for module in graph.modules}
    return {
        "overallHealth": graph.overall_health,
        "clusters": [{"id": m.id, "name": m.name, "packagePath": "",
                      "anchor": {"x": (i % 4) * 180, "y": 0, "z": (i // 4) * 180}}
                     for i, m in enumerate(graph.modules)],
        "nodes": [{"id": n.id, "name": n.name, "path": n.path,
                   "clusterId": n.module_id, "clusterName": modules[n.module_id].name,
                   "complexity": n.complexity, "health": n.health, "loc": n.loc}
                  for n in graph.nodes],
        "edges": [{"id": f"edge-{i:04d}", **edge.model_dump()} for i, edge in enumerate(graph.edges)],
    }
