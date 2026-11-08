"""Lightweight A1 agent API; importing the package performs no network activity."""
from .core import chat_with_agent, chat_with_pet, generate_proposal, infer_domains, resolve_blast_query
from .graph import prepare_graph_summary
from .models import BlastResult, ChatResponse, Diff, DomainTag, PetResponse, Proposal

__all__ = ["chat_with_agent", "chat_with_pet", "generate_proposal", "infer_domains", "resolve_blast_query",
           "prepare_graph_summary", "BlastResult", "ChatResponse", "Diff", "DomainTag", "PetResponse", "Proposal"]
