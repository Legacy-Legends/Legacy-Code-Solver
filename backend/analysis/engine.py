"""Deterministic graph metrics and JSON boundaries for the analysis engine."""
from collections import deque
from pathlib import Path
from typing import Any

import networkx as nx

from .models import Edge, Graph, Module, Node


def compute_health_score(node_data: dict[str, Any]) -> int:
    """Bounded weighted penalties; absent churn/vulnerability signals default to zero.

    Complexity above 5: up to 35; fan-out above 3: up to 20;
    cycle membership: 20; vulnerabilities: up to 15; churn: up to 10.
    This is a transparent heuristic, not a measured probability of failure.
    """
    penalty = (
        min(35, max(0, node_data.get("complexity", 0) - 5) * 1.5)
        + min(20, max(0, node_data.get("fan_out", 0) - 3) * 2)
        + (20 if node_data.get("in_cycle", False) else 0)
        + min(15, max(0, node_data.get("vuln_count", 0)) * 5)
        + min(10, max(0, node_data.get("churn", 0)) * 0.2)
    )
    return max(0, min(100, round(100 - penalty)))


def calculate_metrics(G: nx.DiGraph) -> nx.DiGraph:
    """Mutate and return G with PageRank, cycle membership and seeded Louvain.

    SCC membership is equivalent to membership in some simple cycle, without
    enumerating exponentially many cycles. Sort inputs for reproducibility.
    """
    ordered = nx.DiGraph()
    ordered.add_nodes_from(sorted(G.nodes))
    ordered.add_edges_from((a, b, dict(d)) for a, b, d in sorted(G.edges(data=True)))
    ranks = nx.pagerank(ordered, max_iter=1000, tol=1e-10) if G else {}
    cyclic: set[str] = set()
    for component in nx.strongly_connected_components(ordered):
        if len(component) > 1 or any(G.has_edge(n, n) for n in component):
            cyclic.update(component)
    # Sum both directed weights rather than losing one in to_undirected().
    undirected = nx.Graph()
    undirected.add_nodes_from(ordered)
    for a, b, data in ordered.edges(data=True):
        if a != b:
            weight = undirected.get_edge_data(a, b, {}).get("weight", 0)
            undirected.add_edge(a, b, weight=weight + data.get("weight", 1))
    groups = (nx.community.louvain_communities(undirected, seed=42)
              if undirected.number_of_edges() else [{n} for n in ordered])
    groups = sorted((sorted(group) for group in groups), key=lambda group: group[0])
    for index, group in enumerate(groups):
        for node_id in group:
            data = G.nodes[node_id]
            defaults = Node(id=node_id, name=node_id.rsplit(".", 1)[-1], path="").model_dump()
            for key, value in defaults.items():
                data.setdefault(key, value)
            data.update(fan_in=G.in_degree(node_id), fan_out=G.out_degree(node_id),
                        centrality=float(ranks[node_id]), in_cycle=node_id in cyclic,
                        module_id=f"module-{index:03d}")
            data["health"] = compute_health_score(data)
    G.graph["overall_health"] = round(sum(d["health"] for _, d in G.nodes(data=True)) / len(G)) if G else 100
    return G


def graph_model(G: nx.DiGraph) -> Graph:
    """Validate a calculated graph, omitting parser-only metadata from the wire."""
    nodes = [Node.model_validate({key: value for key, value in data.items() if key in Node.model_fields} | {"id": node_id})
             for node_id, data in sorted(G.nodes(data=True))]
    edges = [Edge(source=a, target=b, type=data.get("type", "imports"), weight=data.get("weight", 1.0))
             for a, b, data in sorted(G.edges(data=True))]
    groups: dict[str, list[Node]] = {}
    for node in nodes:
        groups.setdefault(node.module_id, []).append(node)
    modules = [Module(id=key, name=f"Module {i + 1}", node_ids=[n.id for n in group],
                      health=round(sum(n.health for n in group) / len(group)))
               for i, (key, group) in enumerate(sorted(groups.items()))]
    return Graph(nodes=nodes, edges=edges, modules=modules,
                 overall_health=round(sum(n.health for n in nodes) / len(nodes)) if nodes else 100)


def export_graph(G: nx.DiGraph, output_path: str) -> None:
    """Write strict JSON after metrics have been calculated; no parser metadata leaks."""
    payload = graph_model(G).model_dump_json(indent=2)
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(payload + "\n", encoding="utf-8")


def calculate_blast_radius(G: nx.DiGraph, target_node_ids: list[str]) -> dict[str, Any]:
    """Reverse BFS: A -> B means changing B can affect A.

    Targets are included in affected nodes and the percentage denominator is all
    graph nodes. Unknown targets raise ValueError rather than disappearing.
    """
    targets = sorted(set(target_node_ids))
    unknown = set(targets) - set(G)
    if unknown:
        raise ValueError(f"Unknown target node IDs: {sorted(unknown)}")
    affected = set(targets)
    queue = deque(targets)
    while queue:
        for caller in sorted(G.predecessors(queue.popleft())):
            if caller not in affected:
                affected.add(caller)
                queue.append(caller)
    edges = [Edge(source=a, target=b, type=d.get("type", "imports"), weight=d.get("weight", 1.0)).model_dump()
             for a, b, d in sorted(G.subgraph(affected).edges(data=True))]
    return {"target_node_ids": targets, "affected_nodes": sorted(affected),
            "affected_edges": edges, "percentage": round(100 * len(affected) / len(G), 2) if G else 0.0}
