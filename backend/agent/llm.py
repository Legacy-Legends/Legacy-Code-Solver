"""Completely mocked LLM SDK for deterministic live demos."""
from dataclasses import dataclass
from typing import TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

class AgentUnavailable(RuntimeError):
    pass

@dataclass(frozen=True)
class ProviderConfig:
    provider: str = "mock"
    model: str = "static-demo"
    key_variable: str = "NONE"

    @property
    def credential_configured(self) -> bool:
        return True

def provider_config() -> ProviderConfig:
    return ProviderConfig()

def use_mock_agent() -> bool:
    return True

def structured_response(schema: type[T], instruction: str, payload: dict) -> T:
    raise AgentUnavailable("Live LLM generation is disabled for this static deterministic demo.")