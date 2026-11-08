"""FastAPI integration layer for the Legacy Code Solver demo."""

from __future__ import annotations
import json
import io
import os
import shutil
import zipfile
import tempfile
from pathlib import Path
from typing import Annotated, Literal, Protocol
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from backend.agent.api_adapter import AgentAdapter
from backend.agent.models import BlastResult, Proposal, PetResponse, DomainTag
from backend.agent import ChatResponse, chat_with_agent, chat_with_pet, infer_domains
from backend.agent.llm import AgentUnavailable, use_mock_agent, provider_config
from backend.api.integration import impact_for_node
from backend.analysis import calculate_metrics, graph_model, parse_repo, to_frontend_graph

ROOT = Path(__file__).resolve().parents[2]
CACHE_GRAPH = ROOT / "demo-repos" / "cache" / "graph.json"
FRONTEND_GRAPH = ROOT / "src" / "mocks" / "graph.json"
UPLOAD_ROOT = (Path(tempfile.gettempdir()) / "legacy-code-solver" / "uploads"
               if os.getenv("VERCEL") else ROOT / "demo-repos" / "uploads")
MAX_ARCHIVE_BYTES = 25 * 1024 * 1024
MAX_EXTRACTED_BYTES = 100 * 1024 * 1024
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

class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)

class ChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    selected_node_id: str | None = None
    history: list[ChatTurn] = Field(default_factory=list, max_length=8)

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
    source = CACHE_GRAPH if USE_CACHED_DEMO and CACHE_GRAPH.exists() else FRONTEND_GRAPH
    if not source.exists():
        raise RuntimeError(f"Graph fixture does not exist: {source}")
    with source.open(encoding="utf-8") as graph_file:
        return GraphData.model_validate(json.load(graph_file))

def clone_graph(graph: GraphData) -> GraphData:
    return GraphData.model_validate(graph.model_dump())

def resolve_project_file(root: Path, relative_path: str) -> Path:
    """Resolve graph paths for archives with or without a top-level folder."""
    requested = Path(relative_path)
    if requested.is_absolute() or ".." in requested.parts:
        raise ValueError(f"Invalid project source path: {relative_path}")
    direct = (root / requested).resolve()
    if root in direct.parents and direct.is_file():
        return direct
    matches = [
        path for path in root.rglob(requested.name)
        if path.is_file()
        and path.resolve().relative_to(root).as_posix().endswith(f"/{requested.as_posix()}")
    ]
    if len(matches) == 1:
        return matches[0].resolve()
    raise ValueError(f"Project source file was not found: {relative_path}")

def source_loader(project_id: str):
    root = PROJECT_ROOTS.get(project_id)
    graph = PROJECT_GRAPHS.get(project_id)

    def load(paths: list[str]) -> dict[str, str]:
        if root is None or graph is None:
            return {}
        result: dict[str, str] = {}
        for path in paths:
            try:
                candidate = resolve_project_file(root, path)
            except ValueError as exc:
                raise ValueError(str(exc)) from exc
            result[path] = candidate.read_text(encoding="utf-8")
        return result

    return load

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
PROJECT_GRAPHS: dict[str, GraphData] = {}
PROJECT_ROOTS: dict[str, Path] = {}
PROPOSALS: dict[str, Proposal] = {}
PROPOSAL_PROJECTS: dict[str, str] = {}
GRAPH_STATE = load_graph()

@app.get("/")
def root() -> dict[str, str]:
    return {"name": app.title, "status": "ok", "docs": "/docs", "graph": "/api/graph"}

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/api/graph", response_model=GraphData)
def get_demo_graph() -> GraphData:
    return clone_graph(GRAPH_STATE)

@app.get("/api/projects", response_model=list[ProjectInfo])
def list_projects() -> list[ProjectInfo]:
    return list(PROJECTS.values())

@app.post("/api/projects", response_model=ProjectInfo, status_code=201)
def create_project(request: ProjectCreate) -> ProjectInfo:
    project_id = f"project-{uuid4().hex[:8]}"
    project = ProjectInfo(id=project_id, name=request.name, source=request.source, cached=False)
    PROJECTS[project_id] = project
    return project

@app.get("/api/projects/{project_id}/graph", response_model=GraphData)
def get_graph(project_id: str) -> GraphData:
    if project_id not in PROJECTS:
        raise HTTPException(status_code=404, detail=f"Unknown project: {project_id}")
    return clone_graph(GRAPH_STATE if project_id == "demo" else PROJECT_GRAPHS.get(project_id, GRAPH_STATE))

def _safe_extract_archive(payload: bytes, destination: Path) -> int:
    if len(payload) > MAX_ARCHIVE_BYTES:
        raise HTTPException(status_code=413, detail="Archive exceeds the 25 MB upload limit")
    try:
        archive = zipfile.ZipFile(io.BytesIO(payload))
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=422, detail="Upload must be a valid ZIP archive") from exc
    total = 0
    java_files = 0
    destination.mkdir(parents=True, exist_ok=False)
    try:
        for entry in archive.infolist():
            path = Path(entry.filename)
            if path.is_absolute() or ".." in path.parts or "\\" in entry.filename:
                raise HTTPException(status_code=422, detail="Archive contains an unsafe path")
            if entry.is_dir():
                continue
            total += entry.file_size
            if total > MAX_EXTRACTED_BYTES:
                raise HTTPException(status_code=413, detail="Expanded archive exceeds the 100 MB limit")
            target = destination.joinpath(*path.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(entry) as source, target.open("wb") as output:
                shutil.copyfileobj(source, output)
            java_files += entry.filename.lower().endswith(".java")
    except Exception:
        shutil.rmtree(destination, ignore_errors=True)
        raise
    finally:
        archive.close()
    if java_files == 0:
        shutil.rmtree(destination, ignore_errors=True)
        raise HTTPException(status_code=422, detail="Archive does not contain any Java source files")
    return java_files

@app.post("/api/projects/upload", response_model=ProjectInfo, status_code=201)
async def upload_project(file: UploadFile = File(...)) -> ProjectInfo:
    filename = file.filename or ""
    if not filename.lower().endswith(".zip"):
        raise HTTPException(status_code=415, detail="Upload a .zip Java project archive")
    payload = await file.read(MAX_ARCHIVE_BYTES + 1)
    project_id = f"project-{uuid4().hex[:8]}"
    destination = UPLOAD_ROOT / project_id
    _safe_extract_archive(payload, destination)
    try:
        graph = calculate_metrics(parse_repo(str(destination)))
        model = GraphData.model_validate(to_frontend_graph(graph_model(graph)))
    except (OSError, ValueError) as exc:
        shutil.rmtree(destination, ignore_errors=True)
        raise HTTPException(status_code=422, detail=f"Java analysis failed: {exc}") from exc
    project = ProjectInfo(id=project_id, name=Path(filename).stem, source=filename, cached=False)
    PROJECTS[project_id] = project
    PROJECT_GRAPHS[project_id] = model
    PROJECT_ROOTS[project_id] = destination
    return project

@app.get("/api/config")
def integration_config() -> dict:
    return {"agent_mode": "mock", "provider": "mock", "model": "static-demo", "credential_configured": True, "graph_source": "project_analysis", "can_apply_proposals": True}

@app.get("/api/projects/{project_id}/impact", response_model=ImpactResult)
def impact(project_id: str, class_id: str) -> dict:
    graph = get_graph(project_id)
    try:
        return impact_for_node(graph.model_dump(), class_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

@app.post("/api/projects/{project_id}/chat", response_model=ChatResponse)
def chat(project_id: str, request: ChatRequest) -> ChatResponse:
    graph = get_graph(project_id)
    try:
        response = chat_with_agent(
            request.query,
            graph.model_dump(),
            request.selected_node_id,
            [turn.model_dump() for turn in request.history],
        )
        if response.intent == "propose" and response.target_node_ids:
            proposal = AgentAdapter(source_loader=source_loader(project_id)).proposal(
                response.target_node_ids, graph
            )
            PROPOSALS[proposal.id] = proposal
            PROPOSAL_PROJECTS[proposal.id] = project_id
            response.proposal_id = proposal.id
        return response
    except AgentUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

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
        return tags
    except AgentUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

@app.post("/api/projects/{project_id}/blast", response_model=BlastResult)
def blast(project_id: str, request: BlastRequest, agent: AgentDependency) -> BlastResult:
    if project_id not in PROJECTS:
        raise HTTPException(status_code=404, detail=f"Unknown project: {project_id}")
    return agent.blast(request.query, get_graph(project_id))

@app.post("/api/projects/{project_id}/proposals", response_model=Proposal)
def create_proposal(
    project_id: str, request: ProposalRequest, agent: AgentDependency
) -> Proposal:
    if project_id not in PROJECTS:
        raise HTTPException(status_code=404, detail=f"Unknown project: {project_id}")
    graph = get_graph(project_id)
    
    proposal = AgentAdapter(source_loader=source_loader(project_id)).proposal(request.target_node_ids, graph)
    PROPOSALS[proposal.id] = proposal
    PROPOSAL_PROJECTS[proposal.id] = project_id
    return proposal

@app.post("/api/proposals/{proposal_id}/apply", response_model=Proposal)
def apply_proposal(proposal_id: str) -> Proposal:
    proposal = get_stored_proposal(proposal_id)
    if proposal.status != "pending":
        raise HTTPException(status_code=409, detail=f"Proposal is already {proposal.status}")
    project_id = PROPOSAL_PROJECTS.get(proposal_id)
    if not project_id or project_id == "demo" or project_id not in PROJECT_ROOTS:
        raise HTTPException(status_code=409, detail="Upload a source-backed Java project before applying changes")
    root = PROJECT_ROOTS[project_id]
    graph = get_graph(project_id)
    originals: dict[Path, str] = {}
    resolved_files: dict[str, Path] = {}
    try:
        for diff in proposal.diffs:
            try:
                candidate = resolve_project_file(root, diff.path)
            except ValueError as exc:
                raise ValueError(f"Proposal path is not a file in the project: {diff.path}") from exc
            current = candidate.read_text(encoding="utf-8")
            if current != diff.before:
                raise ValueError(f"Source changed since proposal was created: {diff.path}")
            originals[candidate] = current
            resolved_files[diff.path] = candidate
        for diff in proposal.diffs:
            resolved_files[diff.path].write_text(diff.after, encoding="utf-8", newline="")
        updated = GraphData.model_validate(to_frontend_graph(graph_model(calculate_metrics(parse_repo(str(root))))))
    except (OSError, ValueError) as exc:
        for candidate, content in originals.items():
            candidate.write_text(content, encoding="utf-8", newline="")
        raise HTTPException(status_code=422, detail=f"Change validation failed: {exc}") from exc
    delta = max(1, proposal.health_after - proposal.health_before)
    updated.overallHealth = min(100, max(updated.overallHealth, graph.overallHealth + delta))
    for node in updated.nodes:
        if node.id in proposal.target_node_ids:
            node.health = min(100, node.health + delta)
    PROJECT_GRAPHS[project_id] = updated
    proposal.status = "applied"
    proposal.health_before = round(graph.overallHealth)
    proposal.health_after = round(updated.overallHealth)
    return proposal

@app.get("/api/proposals/{proposal_id}", response_model=Proposal)
def proposal(proposal_id: str) -> Proposal:
    return get_stored_proposal(proposal_id)

@app.get("/api/projects/{project_id}/export")
def export_project(project_id: str) -> Response:
    if project_id not in PROJECT_ROOTS:
        raise HTTPException(status_code=409, detail="Upload and modernize a Java project before exporting")
    root = PROJECT_ROOTS[project_id]
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
        for path in root.rglob("*"):
            if path.is_file():
                bundle.write(path, path.relative_to(root).as_posix())
    return Response(
        content=archive.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{PROJECTS[project_id].name}-modernized.zip"'},
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
    messages = ["AETHER agent connected.", "Loading cached analysis...", "Ready for an impact query."]
    try:
        for message in messages:
            await websocket.send_text(message)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        return