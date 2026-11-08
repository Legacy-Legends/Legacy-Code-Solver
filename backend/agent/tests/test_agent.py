import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.agent import chat_with_pet, generate_proposal, infer_domains, prepare_graph_summary, resolve_blast_query
from backend.agent import core, llm
from backend.agent.models import Diff, DomainBatch, DomainAssignment, PetLine, RefactorDraft, TargetSelection


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    monkeypatch.setenv("USE_MOCK_AGENT", "true")
    monkeypatch.setattr(core, "structured_response", lambda *args, **kwargs: pytest.fail("Mock mode invoked LLM"))


@pytest.fixture
def graph():
    return {"overall_health": 45, "nodes": [
        {"id": "web", "name": "Checkout", "path": "Web.java", "health": 60},
        {"id": "auth", "name": "UserAuth", "path": "Auth.java", "health": 30, "domain_tag": "Auth"},
        {"id": "db", "name": "Database", "path": "Db.java", "health": 90}],
        "edges": [{"id": "e1", "source": "web", "target": "auth"},
                  {"id": "e2", "source": "auth", "target": "db"}]}


def test_mock_all_functions_no_llm(graph):
    blast = resolve_blast_query("What breaks if UserAuth goes down?", graph)
    assert blast.matched_node_ids == ["auth"]
    assert blast.blast_node_ids == ["auth", "web"]
    assert blast.blast_edge_ids == ["e1"] and blast.percent == 66.67
    assert blast.affected_domains == ["Auth"]
    proposal = generate_proposal(["auth"], graph, {})
    assert proposal.diffs[0].before != proposal.diffs[0].after
    assert proposal.health_before == proposal.health_after == 45
    assert proposal.change_blast_node_ids == ["auth", "web"]
    assert proposal.status == "pending"
    tags = infer_domains(graph["nodes"])
    assert tags["auth"].domain_tag == "Auth" and tags["auth"].domain_inferred
    assert chat_with_pet("Hello", 30, "Viewed graph").mood == "sick"
    json.dumps(proposal.model_dump())


@pytest.mark.parametrize("value", ["true", "TRUE", "1", "yes", "on"])
def test_toggle_variants(monkeypatch, value, graph):
    monkeypatch.setenv("USE_MOCK_AGENT", value)
    assert resolve_blast_query("UserAuth", graph).matched_node_ids == ["auth"]


def test_toggle_default_and_invalid(monkeypatch):
    monkeypatch.delenv("USE_MOCK_AGENT", raising=False)
    assert not llm.use_mock_agent()
    monkeypatch.setenv("USE_MOCK_AGENT", "treu")
    with pytest.raises(ValueError):
        llm.use_mock_agent()


@pytest.mark.parametrize("health,mood", [(0, "sick"), (39, "sick"), (40, "okay"), (74, "okay"), (75, "thriving"), (100, "thriving")])
def test_pet_boundaries(health, mood):
    assert chat_with_pet("Hi", health, "").mood == mood


def test_bad_inputs(graph):
    with pytest.raises(ValueError):
        generate_proposal(["missing"], graph, {})
    with pytest.raises(ValueError):
        generate_proposal([], graph, {})
    with pytest.raises(ValueError):
        chat_with_pet("Hi", 101, "")
    with pytest.raises(ValueError):
        resolve_blast_query("", graph)
    for path in ("../x.java", "/tmp/x.java", "C:\\x.java"):
        with pytest.raises(ValidationError):
            Diff(path=path, before="a", after="b")


def test_empty_and_cycle(graph):
    assert resolve_blast_query("Auth", {"nodes": [], "edges": []}).percent == 0
    graph["edges"].append({"id": "e3", "source": "auth", "target": "web"})
    assert resolve_blast_query("UserAuth", graph).blast_edge_ids == ["e1", "e3"]


def test_summary_normalizes_both_fixtures():
    root = Path(__file__).resolve().parents[2]
    engine = json.loads((root / "analysis/fixtures/graph.json").read_text())
    frontend = json.loads((root / "analysis/fixtures/graph.frontend.json").read_text())
    a, b = prepare_graph_summary(engine), prepare_graph_summary(frontend)
    assert a == b
    assert len(a["nodes"]) == 50 and len(a["edges"]) == 100


def test_summary_rejects_overflow_and_dangling_edges(graph):
    with pytest.raises(ValueError):
        prepare_graph_summary({"nodes": [{}] * 81})
    graph["edges"][0]["source"] = "missing"
    with pytest.raises(ValueError):
        prepare_graph_summary(graph)


def test_live_selection_only_controls_ids(monkeypatch, graph):
    monkeypatch.setenv("USE_MOCK_AGENT", "false")
    def response(schema, instruction, payload):
        assert schema is TargetSelection
        assert "edges" not in payload
        return TargetSelection(matched_node_ids=["auth"])
    monkeypatch.setattr(core, "structured_response", response)
    assert resolve_blast_query("Auth?", graph).percent == 66.67
    monkeypatch.setattr(core, "structured_response", lambda *args: TargetSelection(matched_node_ids=["hallucinated"]))
    with pytest.raises(ValueError):
        resolve_blast_query("Auth?", graph)


def test_live_proposal_validates_before_and_paths(monkeypatch, graph):
    monkeypatch.setenv("USE_MOCK_AGENT", "false")
    source = "class Auth {}"
    draft = RefactorDraft(rationale="Example", diffs=[Diff(path="Auth.java", before=source, after="final class Auth {}")])
    monkeypatch.setattr(core, "structured_response", lambda *args: draft)
    result = generate_proposal(["auth"], graph, {"Auth.java": source})
    assert result.health_after == result.health_before
    draft.diffs[0].before = "wrong"
    with pytest.raises(ValueError):
        generate_proposal(["auth"], graph, {"Auth.java": source})
    with pytest.raises(ValueError):
        generate_proposal(["auth"], graph, {})


def test_live_domains_and_pet(monkeypatch, graph):
    monkeypatch.setenv("USE_MOCK_AGENT", "false")
    monkeypatch.setattr(core, "structured_response", lambda *args: DomainBatch(assignments=[DomainAssignment(node_id="auth", domain_tag="Identity")]))
    assert infer_domains([graph["nodes"][1]])["auth"].domain_inferred
    with pytest.raises(ValueError):
        infer_domains(graph["nodes"])
    monkeypatch.setattr(core, "structured_response", lambda *args: PetLine(message="Tiny paws, tidy code."))
    assert chat_with_pet("Hi", 90, "Viewed graph").mood == "thriving"


def test_provider_missing_key_and_payload_budget(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(llm.AgentUnavailable):
        llm.structured_response(TargetSelection, "Select", {})
    with pytest.raises(ValueError):
        llm.structured_response(TargetSelection, "Select", {"source": "x" * 16001})


def test_api_integration_and_preview_guard():
    from backend.api.main import app, GRAPH_STATE
    client = TestClient(app)
    target = GRAPH_STATE.nodes[0]
    response = client.post("/api/projects/demo/blast", json={"query": target.name})
    assert response.status_code == 200 and target.id in response.json()["matched_node_ids"]
    response = client.post("/api/projects/demo/proposals", json={"target_node_ids": [target.id]})
    assert response.status_code == 200
    proposal = response.json()
    assert set(proposal["diffs"][0]) == {"path", "before", "after"}
    health = GRAPH_STATE.overallHealth
    assert client.post(f"/api/proposals/{proposal['id']}/apply").status_code == 409
    assert GRAPH_STATE.overallHealth == health
    assert client.post(f"/api/proposals/{proposal['id']}/reject").json()["status"] == "rejected"


def test_api_live_errors(monkeypatch):
    from backend.api.main import app, GRAPH_STATE
    monkeypatch.setenv("USE_MOCK_AGENT", "false")
    monkeypatch.setattr(core, "structured_response", lambda *args: (_ for _ in ()).throw(llm.AgentUnavailable("No provider")))
    client = TestClient(app)
    assert client.post("/api/projects/demo/blast", json={"query": "Auth"}).status_code == 503
    assert client.post("/api/projects/demo/proposals", json={"target_node_ids": [GRAPH_STATE.nodes[0].id]}).status_code == 422


def test_official_sdk_structured_boundary(monkeypatch):
    """Exercise our SDK invocation and schema generation without paid requests."""
    from types import SimpleNamespace
    import openai
    from openai.lib._pydantic import to_strict_json_schema
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "unit-test-placeholder")
    class FakeClient:
        def __init__(self, **kwargs):
            assert kwargs == {"timeout": 20.0, "max_retries": 1}
            self.beta = SimpleNamespace(chat=SimpleNamespace(completions=self))
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def parse(self, **kwargs):
            schema = to_strict_json_schema(kwargs["response_format"])
            assert schema["additionalProperties"] is False
            assert kwargs["max_tokens"] == 3000
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(parsed=TargetSelection(matched_node_ids=["auth"])))])
    monkeypatch.setattr(openai, "OpenAI", FakeClient)
    assert llm.structured_response(TargetSelection, "Resolve IDs", {"query": "Auth"}).matched_node_ids == ["auth"]
