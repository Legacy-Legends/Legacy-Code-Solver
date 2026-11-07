"""FastAPI integration layer for the Legacy Code Solver demo."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Annotated, Literal, Protocol
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

ROOT = Path(__file__).resolve().parents[2]
CACHE_GRAPH = ROOT / "demo-repos" / "cache" / "graph.json"
CACHE_AGENT = ROOT / "demo-repos" / "cache" / "agent.json"
FRONTEND_GRAPH = ROOT / "src" / "mocks" / "graph.json"
USE_CACHED_DEMO = os.getenv("USE_CACHED_DEMO", "").lower() in {"1", "true", "yes"}


class ClusterInfo(BaseModel):
    id: str
    name: str
    packagePath: str
    anchor: dict[str, float]


class Node(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    path: str
    clusterId: str
    clusterName: str
    complexity: float
    health: float = Field(ge=0, le=100)
    loc: int = Field(ge=0)
    x: float | None = None
    y: float | None = None
    z: float | None = None


class Edge(BaseModel):
    id: str
    source: str
    target: str
    type: str
    weight: float = Field(ge=0)


class GraphData(BaseModel):
    overallHealth: float = Field(ge=0, le=100)
    clusters: list[ClusterInfo]
    nodes: list[Node]
    edges: list[Edge]


class BlastRequest(BaseModel):
    query: str = Field(min_length=1)


class BlastResult(BaseModel):
    matched_node_ids: list[str]
    blast_node_ids: list[str]
    blast_edge_ids: list[str]
    percent: float = Field(ge=0, le=100)
    summary: str
    affected_domains: list[str]


class ProposalRequest(BaseModel):
    target_node_ids: list[str] = Field(min_length=1)


class Proposal(BaseModel):
    id: str
    target_node_ids: list[str]
    rationale: str
    diffs: list[str]
    health_before: float = Field(ge=0, le=100)
    health_after: float = Field(ge=0, le=100)
    change_blast_node_ids: list[str]
    status: Literal["pending", "applied", "rejected"]


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1)
    source: str | None = None


class ProjectInfo(BaseModel):
    id: str
    name: str
    source: str | None
    cached: bool


class Agent(Protocol):
    def blast(self, query: str, graph: GraphData) -> BlastResult: ...

    def proposal(self, target_node_ids: list[str], graph: GraphData) -> Proposal: ...


class MockAgent:
    """Deterministic agent used until the LLM integration is connected."""

    def blast(self, query: str, graph: GraphData) -> BlastResult:
        cached_result = load_cached_agent_result("blast", query)
        if cached_result is not None:
            return BlastResult.model_validate(cached_result)
        normalized_query = query.lower()
        matches = [
            node
            for node in graph.nodes
            if normalized_query in node.name.lower() or normalized_query in node.id.lower()
        ]
        matched_ids = [node.id for node in matches] or ([graph.nodes[0].id] if graph.nodes else [])
        blast_ids = [node.id for node in graph.nodes if node.id in matched_ids]
        blast_edges = [
            edge.id
            for edge in graph.edges
            if edge.source in blast_ids or edge.target in blast_ids
        ]
        domains = sorted({node.clusterName for node in graph.nodes if node.id in blast_ids})
        percent = round((len(blast_ids) / len(graph.nodes)) * 100, 2) if graph.nodes else 0
        return BlastResult(
            matched_node_ids=matched_ids,
            blast_node_ids=blast_ids,
            blast_edge_ids=blast_edges,
            percent=percent,
            summary=f"Demo analysis matched {len(matched_ids)} node(s) for: {query}",
            affected_domains=domains,
        )

    def proposal(self, target_node_ids: list[str], graph: GraphData) -> Proposal:
        cached_result = load_cached_agent_result("proposal", target_node_ids)
        if cached_result is not None:
            cached_result["id"] = f"proposal-{uuid4().hex[:8]}"
            cached_result["target_node_ids"] = target_node_ids
            cached_result["change_blast_node_ids"] = target_node_ids
            return Proposal.model_validate(cached_result)
        return Proposal(
            id=f"proposal-{uuid4().hex[:8]}",
            target_node_ids=target_node_ids,
            rationale="Demo proposal: isolate the selected legacy dependency behind an interface.",
            diffs=["// Demo diff will be supplied by the agent layer."],
            health_before=graph.overallHealth,
            health_after=min(100, graph.overallHealth + 5),
            change_blast_node_ids=target_node_ids,
            status="pending",
        )


def load_graph() -> GraphData:
    """Load the cached demo graph, falling back to the checked-in frontend fixture."""
    source = CACHE_GRAPH if USE_CACHED_DEMO and CACHE_GRAPH.exists() else FRONTEND_GRAPH
    if not source.exists():
        raise RuntimeError(f"Graph fixture does not exist: {source}")
    with source.open(encoding="utf-8") as graph_file:
        return GraphData.model_validate(json.load(graph_file))


def load_cached_agent_result(kind: str, key: object) -> dict[str, object] | None:
    """Return a cached response when the offline demo has one for this input."""
    if not USE_CACHED_DEMO or not CACHE_AGENT.exists():
        return None
    with CACHE_AGENT.open(encoding="utf-8") as agent_file:
        cache = json.load(agent_file)
    if kind == "blast" and isinstance(key, str):
        return cache.get("blast", {}).get(key)
    if kind == "proposal":
        return cache.get("proposal")
    return None


def clone_graph(graph: GraphData) -> GraphData:
    return GraphData.model_validate(graph.model_dump())


def get_agent() -> Agent:
    return MockAgent()


app = FastAPI(title="Legacy Code Solver API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

AgentDependency = Annotated[Agent, Depends(get_agent)]
PROJECTS: dict[str, ProjectInfo] = {
    "demo": ProjectInfo(
        id="demo",
        name="AETHER Legacy Demo",
        source="src/mocks/graph.json",
        cached=USE_CACHED_DEMO,
    )
}
PROPOSALS: dict[str, Proposal] = {}
GRAPH_STATE = load_graph()


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": app.title,
        "status": "ok",
        "docs": "/docs",
        "graph": "/api/graph",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/graph", response_model=GraphData)
def get_demo_graph() -> GraphData:
    """Compatibility route used by the frontend's backend adapter."""
    return clone_graph(GRAPH_STATE)


@app.get("/api/projects", response_model=list[ProjectInfo])
def list_projects() -> list[ProjectInfo]:
    return list(PROJECTS.values())


@app.post("/api/projects", response_model=ProjectInfo, status_code=201)
def create_project(request: ProjectCreate) -> ProjectInfo:
    project_id = f"project-{uuid4().hex[:8]}"
    project = ProjectInfo(
        id=project_id,
        name=request.name,
        source=request.source,
        cached=False,
    )
    PROJECTS[project_id] = project
    return project


@app.get("/api/projects/{project_id}/graph", response_model=GraphData)
def get_graph(project_id: str) -> GraphData:
    if project_id not in PROJECTS:
        raise HTTPException(status_code=404, detail=f"Unknown project: {project_id}")
    return clone_graph(GRAPH_STATE)


@app.post("/api/projects/{project_id}/blast", response_model=BlastResult)
def blast(project_id: str, request: BlastRequest, agent: AgentDependency) -> BlastResult:
    if project_id not in PROJECTS:
        raise HTTPException(status_code=404, detail=f"Unknown project: {project_id}")
    return agent.blast(request.query, GRAPH_STATE)


@app.post("/api/projects/{project_id}/proposals", response_model=Proposal)
def create_proposal(
    project_id: str, request: ProposalRequest, agent: AgentDependency
) -> Proposal:
    if project_id not in PROJECTS:
        raise HTTPException(status_code=404, detail=f"Unknown project: {project_id}")
    graph = GRAPH_STATE
    unknown_ids = set(request.target_node_ids) - {node.id for node in graph.nodes}
    if unknown_ids:
        raise HTTPException(status_code=404, detail=f"Unknown node IDs: {sorted(unknown_ids)}")
    proposal = agent.proposal(request.target_node_ids, graph)
    PROPOSALS[proposal.id] = proposal
    return proposal


@app.post("/api/proposals/{proposal_id}/apply", response_model=Proposal)
def apply_proposal(proposal_id: str) -> Proposal:
    proposal = get_stored_proposal(proposal_id)
    if proposal.status != "pending":
        raise HTTPException(status_code=409, detail=f"Proposal is already {proposal.status}")
    for node in GRAPH_STATE.nodes:
        if node.id in proposal.target_node_ids:
            node.health = min(100, node.health + 5)
    GRAPH_STATE.overallHealth = min(100, GRAPH_STATE.overallHealth + 5)
    proposal.status = "applied"
    return proposal


@app.post("/api/proposals/{proposal_id}/reject", response_model=Proposal)
def reject_proposal(proposal_id: str) -> Proposal:
    proposal = get_stored_proposal(proposal_id)
    if proposal.status != "pending":
        raise HTTPException(status_code=409, detail=f"Proposal is already {proposal.status}")
    proposal.status = "rejected"
    proposal.health_after = proposal.health_before
    return proposal


def get_stored_proposal(proposal_id: str) -> Proposal:
    proposal = PROPOSALS.get(proposal_id)
    if proposal is None:
        raise HTTPException(status_code=404, detail=f"Unknown proposal: {proposal_id}")
    return proposal


@app.websocket("/ws/terminal")
async def terminal(websocket: WebSocket) -> None:
    await websocket.accept()
    messages = [
        "AETHER agent connected.",
        "Loading cached analysis...",
        "Ready for an impact query.",
    ]
    try:
        for message in messages:
            await websocket.send_text(message)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        return
