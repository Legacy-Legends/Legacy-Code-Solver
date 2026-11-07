"""Strict JSON contracts shared by the agent and FastAPI layer."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pathlib import PurePosixPath


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


class BlastResult(StrictModel):
    matched_node_ids: list[str]
    blast_node_ids: list[str]
    blast_edge_ids: list[str]
    percent: float = Field(ge=0, le=100)
    summary: str
    affected_domains: list[str]


class Diff(StrictModel):
    path: str
    before: str
    after: str

    @field_validator("path")
    @classmethod
    def safe_relative_path(cls, value: str) -> str:
        path = PurePosixPath(value)
        if not value or path.is_absolute() or ".." in path.parts or "\\" in value or ":" in value:
            raise ValueError("Diff paths must be relative POSIX paths without traversal")
        return value


class Proposal(StrictModel):
    id: str
    target_node_ids: list[str]
    rationale: str
    diffs: list[Diff]
    health_before: int = Field(ge=0, le=100)
    health_after: int = Field(ge=0, le=100)
    change_blast_node_ids: list[str]
    status: Literal["pending", "applied", "rejected"]


class PetResponse(StrictModel):
    mood: Literal["sick", "okay", "thriving"]
    message: str


class DomainTag(StrictModel):
    domain_tag: str
    domain_inferred: Literal[True] = True


# Provider responses expose only decisions the LLM is permitted to make.
class TargetSelection(StrictModel):
    matched_node_ids: list[str]


class RefactorDraft(StrictModel):
    rationale: str
    diffs: list[Diff]


class DomainAssignment(StrictModel):
    node_id: str
    domain_tag: str


class DomainBatch(StrictModel):
    assignments: list[DomainAssignment]


class PetLine(StrictModel):
    message: str
