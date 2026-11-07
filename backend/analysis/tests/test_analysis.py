import json

import networkx as nx
import pytest
from pydantic import ValidationError

from backend.analysis import (
    Graph, Node, calculate_blast_radius, calculate_metrics, compute_health_score,
    export_graph, generate_mock_graph, graph_model, parse_repo, to_frontend_graph,
)


def test_mock_contract_and_reproducibility(tmp_path):
    first = tmp_path / "one.json"
    second = tmp_path / "two.json"
    model = generate_mock_graph(str(first))
    generate_mock_graph(str(second))
    assert first.read_bytes() == second.read_bytes()
    assert Graph.model_validate_json(first.read_text()) == model
    assert len(model.nodes) == 50 and len(model.edges) == 100
    assert len({n.health for n in model.nodes}) > 10
    assert any(n.in_cycle for n in model.nodes)
    assert any(not n.in_cycle for n in model.nodes)
    assert all(n.domain_tag == "" and not n.domain_inferred for n in model.nodes)
    frontend = to_frontend_graph(model)
    assert set(frontend) == {"overallHealth", "clusters", "nodes", "edges"}
    assert len({e["id"] for e in frontend["edges"]}) == 100
    assert {n["clusterId"] for n in frontend["nodes"]} <= {c["id"] for c in frontend["clusters"]}


def test_metrics_cycles_isolates_and_repeatability():
    graph = nx.DiGraph([("a", "b"), ("b", "a"), ("c", "b"), ("self", "self")])
    graph.add_node("isolated")
    calculate_metrics(graph)
    first = graph_model(graph)
    assert graph.nodes["a"]["in_cycle"] and graph.nodes["self"]["in_cycle"]
    assert not graph.nodes["c"]["in_cycle"]
    assert graph.nodes["b"]["fan_in"] == 2
    assert sum(n["centrality"] for _, n in graph.nodes(data=True)) == pytest.approx(1)
    assert graph_model(calculate_metrics(graph)) == first
    reordered = nx.DiGraph()
    reordered.add_nodes_from(reversed(list(graph)))
    reordered.add_edges_from(reversed(list(graph.edges)))
    assert graph_model(calculate_metrics(reordered)) == first


def test_empty_and_edgeless(tmp_path):
    empty = calculate_metrics(nx.DiGraph())
    export_graph(empty, str(tmp_path / "empty.json"))
    assert json.loads((tmp_path / "empty.json").read_text())["overall_health"] == 100
    assert calculate_blast_radius(empty, [])["percentage"] == 0
    isolated = nx.DiGraph()
    isolated.add_nodes_from(["a", "b"])
    assert len(graph_model(calculate_metrics(isolated)).modules) == 2


def test_blast_reverse_direction_cycle_and_multiple_targets():
    graph = nx.DiGraph([("client", "service"), ("service", "db"), ("db", "driver"),
                        ("other", "db"), ("loop", "other"), ("other", "loop")])
    result = calculate_blast_radius(graph, ["db", "db"])
    assert result["affected_nodes"] == ["client", "db", "loop", "other", "service"]
    assert result["percentage"] == 83.33
    assert len(result["affected_edges"]) == 5
    assert calculate_blast_radius(graph, ["client"])["affected_nodes"] == ["client"]
    assert calculate_blast_radius(graph, ["client", "driver"])["percentage"] == 100
    with pytest.raises(ValueError, match="Unknown"):
        calculate_blast_radius(graph, ["missing"])


def test_java_parser(tmp_path):
    (tmp_path / "A.java").write_text('''package demo;
import java.util.List;
class A extends B implements I {
  int go(int x) { if (x > 0 && x < 3) B.run(); return x; }
  class Nested { void f() { while (true) {} } }
}
''')
    (tmp_path / "B.java").write_text("package demo; class B { static void run() {} }")
    (tmp_path / "I.java").write_text("package demo; interface I {}")
    (tmp_path / "Broken.java").write_text("class Broken {")
    (tmp_path / "Binary.java").write_bytes(b"\xff")
    graph = parse_repo(str(tmp_path))
    assert set(graph) == {"demo.A", "demo.A.Nested", "demo.B", "demo.I", "java.util.List"}
    assert graph.nodes["demo.A"]["methods"] == ["go"]
    assert graph.nodes["demo.A"]["complexity"] == 3
    assert graph.nodes["demo.A.Nested"]["complexity"] == 2
    assert graph["demo.A"]["demo.B"]["type"] == "extends"
    assert graph["demo.A"]["demo.B"]["weight"] == 2
    assert graph["demo.A"]["demo.I"]["type"] == "implements"
    assert graph.nodes["java.util.List"]["type"] == "external"
    assert len(graph.graph["diagnostics"]) == 2
    graph_model(calculate_metrics(graph))
    with pytest.raises(ValueError):
        parse_repo(str(tmp_path / "missing"))


def test_imports_static_calls_and_same_names(tmp_path):
    (tmp_path / "a.java").write_text("package a; class Common {}")
    (tmp_path / "b.java").write_text("package b; class Common { static void go() {} }")
    (tmp_path / "c.java").write_text("package a; import b.Common; class C { void f() { Common.go(); } }")
    graph = parse_repo(str(tmp_path))
    assert graph["a.C"]["b.Common"]["type"] == "calls"
    assert not graph.has_edge("a.C", "a.Common")


@pytest.mark.parametrize("values", [{"health": 101}, {"loc": -1}, {"centrality": float("nan")}, {"extra": 3}, {"loc": "5"}])
def test_contract_rejects_invalid_values(values):
    with pytest.raises(ValidationError):
        Node(id="a", name="A", path="A.java", **values)


def test_contract_rejects_dangling_edges(tmp_path):
    data = generate_mock_graph(str(tmp_path / "graph.json")).model_dump()
    data["edges"][0]["target"] = "missing"
    with pytest.raises(ValidationError, match="endpoint"):
        Graph.model_validate(data)


def test_health_is_bounded_and_penalizes_risk():
    assert compute_health_score({}) == 100
    assert compute_health_score({"complexity": 10}) < compute_health_score({"complexity": 5})
    assert compute_health_score({"complexity": 100, "fan_out": 100, "in_cycle": True, "vuln_count": 100, "churn": 100}) == 0
