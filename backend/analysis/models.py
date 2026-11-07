"""Version-one analysis contract. Edges point from dependent to dependency."""
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


class Node(ContractModel):
    id: str
    type: Literal["class", "module", "external"] = "class"
    name: str
    path: str
    loc: int = Field(default=0, ge=0)
    complexity: int = Field(default=0, ge=0)
    fan_in: int = Field(default=0, ge=0)
    fan_out: int = Field(default=0, ge=0)
    centrality: float = Field(default=0.0, ge=0, le=1)
    in_cycle: bool = False
    vuln_count: int = Field(default=0, ge=0)
    churn: int = Field(default=0, ge=0)
    health: int = Field(default=100, ge=0, le=100)
    module_id: str = ""
    domain_tag: str = ""
    domain_inferred: bool = False


class Edge(ContractModel):
    source: str
    target: str
    type: Literal["imports", "calls", "extends", "implements"]
    weight: float = Field(default=1.0, gt=0)


class Module(ContractModel):
    id: str
    name: str
    node_ids: list[str]
    health: int = Field(ge=0, le=100)


class Graph(ContractModel):
    nodes: list[Node]
    edges: list[Edge]
    modules: list[Module]
    overall_health: int = Field(ge=0, le=100)

    @model_validator(mode="after")
    def check_references(self) -> Self:
        ids = {node.id for node in self.nodes}
        modules = {module.id: module for module in self.modules}
        if len(ids) != len(self.nodes) or len(modules) != len(self.modules):
            raise ValueError("Node and module IDs must be unique")
        edge_keys = {(edge.source, edge.target) for edge in self.edges}
        if len(edge_keys) != len(self.edges):
            raise ValueError("DiGraph contract permits one edge per ordered pair")
        if any(edge.source not in ids or edge.target not in ids for edge in self.edges):
            raise ValueError("Edge endpoint does not exist")
        membership: dict[str, str] = {}
        for module in self.modules:
            for node_id in module.node_ids:
                if node_id not in ids or node_id in membership:
                    raise ValueError("Invalid or duplicate module membership")
                membership[node_id] = module.id
        if any(membership.get(node.id) != node.module_id for node in self.nodes):
            raise ValueError("Every node must belong to exactly its declared module")
        return self
