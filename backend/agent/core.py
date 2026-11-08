"""A1 agent functions: LLM suggestions, deterministic impact and demo fallbacks."""
import re
from typing import Any
from uuid import uuid4

from backend.analysis import calculate_blast_radius
from .graph import dependency_graph, prepare_graph_summary
from .llm import structured_response, use_mock_agent
from .models import (
    BlastResult, ChatResponse, Diff, DomainBatch, DomainTag, PetLine, PetResponse,
    Proposal, RefactorDraft, TargetSelection,
)


def _targets(ids: list[str], graph: dict) -> list[str]:
    result = sorted(set(ids))
    if not set(result) <= {n["id"] for n in graph["nodes"]}:
        raise ValueError("Target IDs must exist in the supplied graph")
    return result


def _bounded_text(value: str, label: str, limit: int = 2000) -> None:
    if not isinstance(value, str) or len(value) > limit:
        raise ValueError(f"{label} must be a string up to {limit} characters")


def resolve_blast_query(query: str, graph_summary: dict) -> BlastResult:
    """Resolve IDs, then use the analysis engine's reverse BFS for every number."""
    _bounded_text(query, "query")
    if not query.strip():
        raise ValueError("Query must not be empty")
    graph = prepare_graph_summary(graph_summary)
    mock = use_mock_agent()
    if not graph["nodes"]:
        selected = []
    elif mock:
        # Reproducible presentation fallback; never invent IDs from another fixture.
        normalized = re.sub(r"[^a-z0-9]", "", query.lower())
        selected = [n["id"] for n in graph["nodes"]
                    if re.sub(r"[^a-z0-9]", "", n["name"].lower()) in normalized or n["id"].lower() in query.lower()]
        selected = selected or [min(graph["nodes"], key=lambda n: (n["health"], n["id"]))["id"]]
    else:
        selected = structured_response(TargetSelection,
            "Identify only existing node IDs explicitly relevant to the user's impact question. "
            "Return an empty list if there is no match; do not guess.",
            {"query": query, "nodes": [{"id": n["id"], "name": n["name"], "path": n["path"]} for n in graph["nodes"]]}).matched_node_ids
    targets = _targets(selected, graph)
    blast = calculate_blast_radius(dependency_graph(graph), targets)
    affected = set(blast["affected_nodes"])
    domains = sorted({n["domain_tag"] for n in graph["nodes"] if n["id"] in affected and n["domain_tag"]})
    prefix = "Demo analysis: " if mock else ""
    summary = (f"{prefix}{len(targets)} selected component(s) touch {len(affected)} of {len(graph['nodes'])} "
               f"components ({blast['percentage']}%), including the targets. "
               "Inspect the dependent callers before changing this boundary.") if targets else "No matching components found. Try an exact class name."
    return BlastResult(matched_node_ids=targets, blast_node_ids=blast["affected_nodes"],
                       blast_edge_ids=sorted(e["id"] for e in graph["edges"] if e["source"] in affected and e["target"] in affected),
                       percent=blast["percentage"], summary=summary, affected_domains=domains)


def generate_proposal(target_node_ids: list[str], graph_context: dict, source_code: dict[str, str]) -> Proposal:
    """Return a preview only: never apply code or claim an unmeasured health gain.

    source_code maps repository-relative paths to complete UTF-8 file contents.
    Live diffs must match the exact supplied file and may touch only target paths.
    """
    graph = prepare_graph_summary(graph_context)
    targets = _targets(target_node_ids, graph)
    if not targets:
        raise ValueError("At least one proposal target is required")
    if use_mock_agent():
        draft = RefactorDraft(
            rationale="DEMO PREVIEW: simplify the legacy text guard while preserving its null handling. "
                      "This illustrative fixture is not a patch to the selected repository. Health stays unchanged until validation.",
            diffs=[Diff(path="demo/LegacyText.java",
                        before='class LegacyText { boolean empty(String s) { return s == null || s.length() == 0; } }\n',
                        after='class LegacyText { boolean empty(String s) { return s == null || s.isEmpty(); } }\n')])
    else:
        paths = {n["path"] for n in graph["nodes"] if n["id"] in targets}
        if not paths or "" in paths or not paths <= source_code.keys():
            raise ValueError("Live proposals require complete source for every target path")
        sources = {path: source_code[path] for path in sorted(paths)}
        for path, code in sources.items():
            _bounded_text(code, "source code", 12000)
            Diff(path=path, before=code, after=code)
        draft = structured_response(RefactorDraft,
            "Propose one small behavior-preserving Java modernization. Return complete before/after "
            "file contents for supplied paths only. No new dependencies. Do not claim compilation or health improvements.",
            {"target_node_ids": targets, "source_code": sources})
        seen = set()
        for diff in draft.diffs:
            if diff.path not in sources or diff.path in seen or diff.before != sources[diff.path] or not diff.after.strip() or diff.before == diff.after:
                raise ValueError("Provider diff must uniquely match a supplied target file and change its content")
            seen.add(diff.path)
        if not seen:
            raise ValueError("Provider returned no changes")
    blast = calculate_blast_radius(dependency_graph(graph), targets)
    return Proposal(id=f"proposal-{uuid4().hex}", target_node_ids=targets, rationale=draft.rationale,
                    diffs=draft.diffs, health_before=graph["overall_health"], health_after=graph["overall_health"],
                    change_blast_node_ids=blast["affected_nodes"], status="pending")


def infer_domains(nodes: list[dict[str, Any]]) -> dict[str, DomainTag]:
    """Return ID -> typed tag. Every tag is explicitly marked as inferred."""
    normalized = prepare_graph_summary({"nodes": nodes, "edges": []})["nodes"]
    if use_mock_agent():
        keywords = [("Payments", ("pay", "bill", "invoice")), ("Auth", ("auth", "login", "session")),
                    ("Orders", ("order", "checkout")), ("Inventory", ("stock", "inventory")),
                    ("Notifications", ("mail", "notify", "notification"))]
        return {n["id"]: DomainTag(domain_tag=next((domain for domain, words in keywords
                if any(word in (n["name"] + n["path"]).lower() for word in words)), "Platform")) for n in normalized}
    if not normalized:
        return {}
    batch = structured_response(DomainBatch, "Infer a short business-domain label for every supplied node ID exactly once.",
                                {"nodes": [{k: n[k] for k in ("id", "name", "path")} for n in normalized]})
    if len(batch.assignments) != len(normalized) or {a.node_id for a in batch.assignments} != {n["id"] for n in normalized}:
        raise ValueError("Domain assignments must cover every input ID exactly once")
    return {a.node_id: DomainTag(domain_tag=a.domain_tag) for a in batch.assignments}


def chat_with_pet(query: str, health_score: int, recent_action: str) -> PetResponse:
    """Mood is deterministic; the LLM only supplies the personality line."""
    _bounded_text(query, "query")
    _bounded_text(recent_action, "recent_action")
    if isinstance(health_score, bool) or not isinstance(health_score, int) or not 0 <= health_score <= 100:
        raise ValueError("health_score must be an integer from 0 to 100")
    mood = "sick" if health_score < 40 else "okay" if health_score < 75 else "thriving"
    if use_mock_agent():
        message = {"sick": "My dependency noodles are tangled. Find one cycle and let's untie it!",
                   "okay": "Steady paws. One small refactor, one test run, one victory snack.",
                   "thriving": "Clean code, clear skies. I'm doing zoomies through the call graph!"}[mood]
    else:
        message = structured_response(PetLine, "Write one short, playful code-health pet line. "
            "Use the supplied mood; do not claim any code was fixed or tests passed.",
            {"query": query, "health_score": health_score, "mood": mood, "recent_action": recent_action}).message
    return PetResponse(mood=mood, message=message)


def chat_with_agent(
    query: str,
    graph_context: dict,
    selected_node_id: str | None = None,
    history: list[dict[str, str]] | None = None,
) -> ChatResponse:
    """Answer a project-aware question and identify an optional next action.

    The provider can suggest a proposal target, but it never mutates source
    code. Applying a change remains an explicit, validated API operation.
    """
    _bounded_text(query, "query")
    if not query.strip():
        raise ValueError("Query must not be empty")
    graph = prepare_graph_summary(graph_context)
    node_ids = {node["id"] for node in graph["nodes"]}
    if selected_node_id and selected_node_id not in node_ids:
        raise ValueError("Selected node does not exist in the supplied graph")
    safe_history = [
        {"role": item.get("role", ""), "content": item.get("content", "")[:2000]}
        for item in (history or [])[-8:]
        if item.get("role") in {"user", "assistant"} and isinstance(item.get("content"), str)
    ]
    if use_mock_agent():
        target_ids = [selected_node_id] if selected_node_id else []
        lowered = query.lower()
        intent = "propose" if any(word in lowered for word in ("modernize", "refactor", "fix", "change")) else (
            "explain" if target_ids else "answer"
        )
        if intent == "propose" and not target_ids and graph["nodes"]:
            target_ids = [min(graph["nodes"], key=lambda node: (node["health"], node["id"]))["id"]]
        target = next((node for node in graph["nodes"] if node["id"] in target_ids), None)
        if target:
            fan_out = sum(edge["source"] == target["id"] for edge in graph["edges"])
            message = (
                f"{target['name']} has health {target['health']}/100 and "
                f"{fan_out} outgoing dependencies. I can prepare a small, "
                "behavior-preserving modernization proposal for your review."
            )
        else:
            message = (
                f"I found {len(graph['nodes'])} analyzed components at "
                f"{graph['overall_health']}/100 overall health. Select a class or "
                "ask what should be modernized first."
            )
        return ChatResponse(message=message, intent=intent, target_node_ids=target_ids)
    response = structured_response(
        ChatResponse,
        "Act as a software modernization assistant. Answer the user's question "
        "using only the supplied graph context and conversation. If a small "
        "behavior-preserving refactor would help, set intent to propose and "
        "return only existing target node IDs. Never claim code was changed.",
        {
            "query": query,
            "selected_node_id": selected_node_id,
            "history": safe_history,
            "graph": graph,
        },
    )
    if not set(response.target_node_ids) <= node_ids:
        raise ValueError("Agent returned an unknown target node")
    return response
