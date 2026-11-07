"""Seeded, instant frontend handoff fixture; all values are synthetic."""
import random
import networkx as nx
from .engine import calculate_metrics, export_graph, graph_model
from .models import Graph, Node


def generate_mock_graph(output_path: str = "backend/analysis/fixtures/graph.json", *, seed: int = 42) -> Graph:
    """Write and return exactly 50 nodes and 100 unique directed edges."""
    rng = random.Random(seed)
    graph = nx.DiGraph()
    domains = ["auth", "billing", "orders", "inventory", "notifications"]
    roles = ["Controller", "Service", "Repository", "Validator", "Mapper", "Client", "Cache", "Policy", "Handler", "Job"]
    for i in range(50):
        package = domains[i // 10]
        name = package.title() + roles[i % 10]
        node_id = f"com.legacy.{package}.{name}"
        graph.add_node(node_id, **Node(id=node_id, name=name,
                       path=f"src/main/java/{node_id.replace('.', '/')}.java",
                       loc=rng.randint(35, 650), complexity=rng.randint(1, 42),
                       churn=rng.randint(0, 60), vuln_count=rng.choice([0, 0, 0, 1, 2])).model_dump())
    ids = list(graph)
    for offset in range(0, 50, 10):
        # A small cycle per domain; remaining nodes need not all be cyclic.
        for i in range(3):
            graph.add_edge(ids[offset + i], ids[offset + (i + 1) % 3], type="calls", weight=1.0)
    while graph.number_of_edges() < 100:
        source = rng.randrange(50)
        target = (source // 10) * 10 + rng.randrange(10) if rng.random() < 0.85 else rng.randrange(50)
        if source != target and not graph.has_edge(ids[source], ids[target]):
            graph.add_edge(ids[source], ids[target], type=rng.choice(["calls", "imports", "extends", "implements"]), weight=float(rng.randint(1, 8)))
    calculate_metrics(graph)
    export_graph(graph, output_path)
    return graph_model(graph)
