"""Optional FastAPI bridge implementing the platform teammate's Agent protocol."""
from collections.abc import Callable
from typing import Protocol
from fastapi import HTTPException
from .core import generate_proposal, resolve_blast_query
from .llm import AgentUnavailable
from .models import BlastResult, Proposal


class GraphLike(Protocol):
    def model_dump(self) -> dict: ...


class AgentAdapter:
    """Inject a project-aware source loader when the platform supports real files.

    No repository path is read based on LLM output. The platform owns project
    checkout authorization, source loading, patch validation and application.
    """
    def __init__(self, source_loader: Callable[[list[str]], dict[str, str]] | None = None):
        self.source_loader = source_loader

    def blast(self, query: str, graph: GraphLike) -> BlastResult:
        try:
            return resolve_blast_query(query, graph.model_dump())
        except AgentUnavailable as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    def proposal(self, target_node_ids: list[str], graph: GraphLike) -> Proposal:
        from .llm import use_mock_agent
        try:
            graph_data = graph.model_dump()
            target_paths = [
                node["path"] for node in graph_data["nodes"]
                if node["id"] in target_node_ids and node.get("path")
            ]
            sources = self.source_loader(target_paths) if self.source_loader else {}
            return generate_proposal(target_node_ids, graph_data, sources)
        except AgentUnavailable as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
