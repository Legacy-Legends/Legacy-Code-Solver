"""A1 agent functions: Deterministic Wizard of Oz demo."""
import re
from typing import Any
from uuid import uuid4

from backend.analysis import calculate_blast_radius
from .graph import dependency_graph, prepare_graph_summary
from .models import (
    BlastResult, ChatResponse, Diff, DomainTag, PetResponse, Proposal
)

def _targets(ids: list[str], graph: dict) -> list[str]:
    result = sorted(set(ids))
    if not set(result) <= {n["id"] for n in graph["nodes"]}:
        raise ValueError("Target IDs must exist in the supplied graph")
    return result

def resolve_blast_query(query: str, graph_summary: dict) -> BlastResult:
    graph = prepare_graph_summary(graph_summary)
    if not graph["nodes"]:
        selected = []
    else:
        normalized = re.sub(r"[^a-z0-9]", "", query.lower())
        selected = [n["id"] for n in graph["nodes"]
                    if re.sub(r"[^a-z0-9]", "", n["name"].lower()) in normalized or n["id"].lower() in query.lower()]
        selected = selected or [min(graph["nodes"], key=lambda n: (n["health"], n["id"]))["id"]]
        
    targets = _targets(selected, graph)
    blast = calculate_blast_radius(dependency_graph(graph), targets)
    affected = set(blast["affected_nodes"])
    domains = sorted({n["domain_tag"] for n in graph["nodes"] if n["id"] in affected and n["domain_tag"]})
    
    summary = (f"{len(targets)} selected component(s) touch {len(affected)} of {len(graph['nodes'])} "
               f"components ({blast['percentage']}%), including the targets. "
               "Inspect the dependent callers before changing this boundary.") if targets else "No matching components found."
               
    return BlastResult(
        matched_node_ids=targets, blast_node_ids=blast["affected_nodes"],
        blast_edge_ids=sorted(e["id"] for e in graph["edges"] if e["source"] in affected and e["target"] in affected),
        percent=blast["percentage"], summary=summary, affected_domains=domains
    )

def generate_proposal(target_node_ids: list[str], graph_context: dict, source_code: dict[str, str]) -> Proposal:
    """Return the deterministic, source-backed modernization used by the demo."""
    graph = prepare_graph_summary(graph_context)
    targets = _targets(target_node_ids, graph)
    
    rationale = (
        "Replaced the raw Hashtable in SessionManager with a typed, thread-safe "
        "ConcurrentHashMap and made the shared collection final. This is a narrow "
        "behavior-preserving modernization for the uploaded CrownBank source."
    )
    
    before_code = """package com.crownbank.legacy.auth;

import java.util.HashMap;
import java.util.Map;

public class SessionManager {
    private static SessionManager instance = new SessionManager();
    private Map<String, UserSession> activeSessions = new HashMap<>();

    private SessionManager() {}

    public static SessionManager getInstance() {
        return instance;
    }

    public UserSession validateSession(String token) {
        if (token == null) throw new IllegalArgumentException("Token cannot be null");
        return activeSessions.get(token);
    }
}"""

    source_path = next((path for path in source_code if path.endswith("SessionManager.java")), None)
    if source_path and "private static Hashtable sessions = new Hashtable();" in source_code[source_path]:
        before_code = source_code[source_path]
        diff_path = source_path
        after_code = before_code.replace(
            "import java.util.Hashtable;",
            "import java.util.Map;\nimport java.util.concurrent.ConcurrentHashMap;",
        ).replace(
            "private static Hashtable sessions = new Hashtable();",
            "private static final Map<String, AuthToken> sessions = new ConcurrentHashMap<>();",
        )
    else:
        if source_path:
            before_code = source_code[source_path]
        diff_path = source_path or "src/main/java/com/crownbank/legacy/auth/SessionManager.java"
        after_code = before_code
    diffs = [Diff(path=diff_path, before=before_code, after=after_code)]
    health_before = round(graph["overall_health"])
    health_after = min(100, health_before + 20)
    
    return Proposal(
        id=f"proposal-{uuid4().hex}", target_node_ids=targets, rationale=rationale,
        diffs=diffs, health_before=health_before, health_after=health_after,
        change_blast_node_ids=[], status="pending"
    )

def infer_domains(nodes: list[dict[str, Any]]) -> dict[str, DomainTag]:
    normalized = prepare_graph_summary({"nodes": nodes, "edges": []})["nodes"]
    keywords = [("Payments", ("pay", "bill", "invoice")), ("Auth", ("auth", "login", "session")),
                ("Orders", ("order", "checkout")), ("Inventory", ("stock", "inventory")),
                ("Notifications", ("mail", "notify", "notification"))]
    return {n["id"]: DomainTag(domain_tag=next((domain for domain, words in keywords
            if any(word in (n["name"] + n["path"]).lower() for word in words)), "Platform")) for n in normalized}

def chat_with_pet(query: str, health_score: int, recent_action: str) -> PetResponse:
    mood = "sick" if health_score < 40 else "okay" if health_score < 75 else "thriving"
    message = {"sick": "My dependency noodles are tangled. Find one cycle and let's untie it!",
               "okay": "Steady paws. One small refactor, one test run, one victory snack.",
               "thriving": "Clean code, clear skies. I'm doing zoomies through the call graph!"}[mood]
    return PetResponse(mood=mood, message=message)

def chat_with_agent(
    query: str, graph_context: dict, selected_node_id: str | None = None, history: list[dict[str, str]] | None = None
) -> ChatResponse:
    nodes = prepare_graph_summary(graph_context)["nodes"]
    target_id = selected_node_id
    if not target_id:
        session = next((node for node in nodes if node["name"].lower() == "sessionmanager"), None)
        target_id = session["id"] if session else (min(nodes, key=lambda node: (node["health"], node["id"]))["id"] if nodes else None)
    target = next((node for node in nodes if node["id"] == target_id), None)
    return ChatResponse(
        message=(
            f"I found {target['name']} as the next modernization target. "
            "I have a safe, behavior-preserving SessionManager refactor ready to review."
            if target else "Upload the CrownBank Java archive and I will prepare its hardcoded modernization plan."
        ),
        intent="propose",
        target_node_ids=[target_id] if target_id else []
    )