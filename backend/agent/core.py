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
    """Return a hardcoded 'Wizard of Oz' modernization diff for the live demo."""
    graph = prepare_graph_summary(graph_context)
    targets = _targets(target_node_ids, graph)
    
    rationale = (
        "Refactored SessionManager to eliminate the Singleton anti-pattern, "
        "introduced Dependency Injection for better testability, replaced HashMap with ConcurrentHashMap "
        "for thread safety, and updated validateSession to return an Optional<UserSession> "
        "to prevent NullPointerExceptions in downstream services."
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

    after_code = """package com.crownbank.legacy.auth;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Optional;

public class SessionManager {
    private final Map<String, UserSession> activeSessions;

    public SessionManager() {
        this.activeSessions = new ConcurrentHashMap<>();
    }

    public Optional<UserSession> validateSession(String token) {
        if (token == null || token.trim().isEmpty()) {
            return Optional.empty();
        }
        return Optional.ofNullable(activeSessions.get(token));
    }
}"""
    
    diffs = [Diff(path="src/main/java/com/crownbank/legacy/auth/SessionManager.java", before=before_code, after=after_code)]
    
    return Proposal(
        id=f"proposal-{uuid4().hex}", target_node_ids=targets, rationale=rationale,
        diffs=diffs, health_before=42, health_after=85,
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
    return ChatResponse(
        message="I've analyzed the constraints. I can safely decouple this architecture and eliminate the cycle.",
        intent="propose",
        target_node_ids=[selected_node_id] if selected_node_id else []
    )