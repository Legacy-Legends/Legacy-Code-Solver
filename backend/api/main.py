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

from backend.agent.api_adapter import AgentAdapter
from backend.agent.models import BlastResult, Proposal, PetResponse, DomainTag
from backend.agent import chat_with_pet, infer_domains
from backend.agent.llm import AgentUnavailable, use_mock_agent
from backend.api.integration import impact_for_node

ROOT = Path(__file__).resolve().parents[2]
CACHE_GRAPH = ROOT / "demo-repos" / "cache" / "graph.json"
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
    domain_tag: str = ""
    domain_inferred: bool = False
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


class DependentItem(BaseModel):
    node: Node
    edge: Edge
    depth: Literal[1, 2]
    pathIds: list[str]
    explanation: str


class ImpactResult(BaseModel):
    targetNode: Node
    directDependents: list[DependentItem]
    indirectDependents: list[DependentItem]
    totalAffected: int
    timestamp: str


class PetRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    recent_action: str = Field(default="Viewed graph", max_length=2000)


class BlastRequest(BaseModel):
    query: str = Field(min_length=1)


class ProposalRequest(BaseModel):
    target_node_ids: list[str] = Field(min_length=1)


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


def load_graph() -> GraphData:
    """Load the cached demo graph, falling back to the checked-in frontend fixture."""
    source = CACHE_GRAPH if USE_CACHED_DEMO and CACHE_GRAPH.exists() else FRONTEND_GRAPH
    if not source.exists():
        raise RuntimeError(f"Graph fixture does not exist: {source}")
    with source.open(encoding="utf-8") as graph_file:
        return GraphData.model_validate(json.load(graph_file))


def clone_graph(graph: GraphData) -> GraphData:
    return GraphData.model_validate(graph.model_dump())


def get_agent() -> Agent:
    return AgentAdapter()


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


@app.get("/api/config")
def integration_config() -> dict:
    return {"agent_mode": "mock" if use_mock_agent() else "live",
            "graph_source": "demo_fixture", "can_apply_proposals": False}


@app.get("/api/projects/{project_id}/impact", response_model=ImpactResult)
def impact(project_id: str, class_id: str) -> dict:
    graph = get_graph(project_id)
    try:
        return impact_for_node(graph.model_dump(), class_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/projects/{project_id}/pet", response_model=PetResponse)
def pet(project_id: str, request: PetRequest) -> PetResponse:
    graph = get_graph(project_id)
    try:
        return chat_with_pet(request.query, round(graph.overallHealth), request.recent_action)
    except AgentUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/projects/{project_id}/domains", response_model=dict[str, DomainTag])
def domains(project_id: str) -> dict[str, DomainTag]:
    graph = get_graph(project_id)
    try:
        tags = infer_domains([node.model_dump() for node in graph.nodes])
        for node in GRAPH_STATE.nodes:
            if node.id in tags:
                node.domain_tag = tags[node.id].domain_tag
                node.domain_inferred = True
        return tags
    except AgentUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


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
    raise HTTPException(
        status_code=409,
        detail="A1 proposals are previews only. Patch validation and health recomputation are required before apply.",
    )


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
