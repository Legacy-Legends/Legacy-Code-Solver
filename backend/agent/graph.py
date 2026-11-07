"""Normalize either teammate's graph shape without sending source or edges to LLM."""
import math
from typing import Any
import networkx as nx

MAX_NODES = 80
MAX_EDGES = 400


def prepare_graph_summary(graph: dict[str, Any]) -> dict[str, Any]:
    """Produce the documented compact shape; never silently truncate a graph."""
    raw_nodes, raw_edges = graph.get("nodes", []), graph.get("edges", [])
    if len(raw_nodes) > MAX_NODES or len(raw_edges) > MAX_EDGES:
        raise ValueError("A1 supports at most 80 nodes and 400 edges per graph")
    nodes = []
    for node in raw_nodes:
        node_id = node["id"]
        if not isinstance(node_id, str) or not node_id or len(node_id) > 200:
            raise ValueError("Node IDs must be nonempty strings up to 200 characters")
        item = {"id": node_id, "name": node.get("name", node_id), "path": node.get("path", ""),
                "health": node.get("health", 100), "domain_tag": node.get("domain_tag", "")}
        if any(not isinstance(item[k], str) or len(item[k]) > 240 for k in ("name", "path", "domain_tag")):
            raise ValueError("Node labels/paths must be strings up to 240 characters")
        score = item["health"]
        if isinstance(score, bool) or not isinstance(score, (int, float)) or not math.isfinite(score) or not 0 <= score <= 100:
            raise ValueError("Health must be a finite number from 0 to 100")
        nodes.append(item)
    ids = {n["id"] for n in nodes}
    if len(ids) != len(nodes):
        raise ValueError("Duplicate node IDs")
    # Match analysis.to_frontend_graph edge IDs for engine JSON without IDs.
    raw_edges = sorted(raw_edges, key=lambda e: (e["source"], e["target"])) if all("id" not in e for e in raw_edges) else raw_edges
    edges = []
    for i, edge in enumerate(raw_edges):
        if edge["source"] not in ids or edge["target"] not in ids:
            raise ValueError("Dangling graph edge")
        edge_id = edge.get("id", f"edge-{i:04d}")
        if not isinstance(edge_id, str) or not edge_id:
            raise ValueError("Edge IDs must be nonempty strings")
        edges.append({"id": edge_id, "source": edge["source"], "target": edge["target"]})
    if len({e["id"] for e in edges}) != len(edges):
        raise ValueError("Duplicate edge IDs")
    health = graph.get("overall_health", graph.get("overallHealth", round(sum(n["health"] for n in nodes) / len(nodes)) if nodes else 100))
    if isinstance(health, bool) or not isinstance(health, (float, int)) or not math.isfinite(health) or not 0 <= health <= 100:
        raise ValueError("Overall health must be from 0 to 100")
    return {"nodes": sorted(nodes, key=lambda n: n["id"]), "edges": edges, "overall_health": round(health)}


def dependency_graph(summary: dict[str, Any]) -> nx.DiGraph:
    graph = nx.DiGraph()
    graph.add_nodes_from(node["id"] for node in summary["nodes"])
    graph.add_edges_from((edge["source"], edge["target"]) for edge in summary["edges"])
    return graph
