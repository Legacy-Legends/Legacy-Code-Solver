# AI / agent layer — A1

Python 3.11+, Pydantic v2, official Groq/OpenAI SDKs. No background jobs, provider
calls on import, or filesystem writes. API and agent output share the same models.

## Run

From the repository root:

```sh
python -m pip install -r backend/agent/requirements-dev.txt
USE_MOCK_AGENT=true python -m pytest backend/agent/tests backend/analysis/tests -q
```

For the server, install `backend/requirements.txt` and run the platform's Uvicorn
command. `get_agent()` now injects `AgentAdapter`. `USE_CACHED_DEMO` still selects
the graph cache; `USE_MOCK_AGENT` independently controls agent behavior. Legacy
`demo-repos/cache/agent.json` responses are no longer consumed because their
proposal diffs do not match the typed contract.

`USE_MOCK_AGENT` defaults to **true**. Accepted true values: true/1/yes/on;
false values: false/0/no/off (case-insensitive). Invalid values raise an error.
Read at call time, so tests and the API can change it without reimporting modules.
Every function bypasses the SDK in mock mode, even if credentials are present.
Mock prose, refactor fixture and pet lines are canned; IDs and impact counts
are bound to the supplied graph so the demo never highlights nonexistent nodes.

For live Groq mode, set `LLM_PROVIDER=groq`, `USE_MOCK_AGENT=false`, and provide
`GROQ_API_KEY` securely in the backend environment. Default model:
`openai/gpt-oss-20b` (served by Groq). The environment must permit `api.groq.com`.
Groq's official SDK sends `response_format: json_schema` with `strict: true`,
followed by independent Pydantic validation. Requests use a 20-second timeout,
one retry and a 4,096-completion-token cap. Models must support strict JSON Schema.

To use OpenAI instead, explicitly set `LLM_PROVIDER=openai`, supply
`OPENAI_API_KEY`, and set `AGENT_MODEL=gpt-4o-mini` (or leave the model unset).
That path retains `chat.completions.parse`, with the same timeout/retry limits
and a 3,000-token output cap. Changing providers never reuses another provider's
key, and an unknown provider is rejected.

No key is committed or needed for mock mode. Credential presence is checked
without returning values. Refusal, truncation, malformed responses and provider
errors raise `AgentUnavailable` (HTTP 503); no silent fallback to demo data occurs.
Use `python -m backend.agent.check_provider --env-file .env` to inspect setup;
add `--live` to make one small structured-output request. Exported variables
win over `.env`. See the root README for Windows and macOS/Linux launch commands.

## Exact graph_summary format

Pass either the engine Graph JSON, the current frontend GraphData JSON, or this
compact format. `prepare_graph_summary()` normalizes all three:

```json
{
  "overall_health": 55,
  "nodes": [
    {"id": "checkout", "name": "Checkout", "path": "src/Checkout.java", "health": 60, "domain_tag": "Orders"},
    {"id": "auth", "name": "UserAuth", "path": "src/UserAuth.java", "health": 50, "domain_tag": "Auth"}
  ],
  "edges": [
    {"id": "edge-0000", "source": "checkout", "target": "auth"}
  ]
}
```

- IDs are unique strings; all edge endpoints must exist. Edges mean **source
  depends on target**. Preserve frontend edge IDs for correct highlighting.
  Missing IDs in engine JSON use the analysis frontend adapter's sorted edge IDs.
- Maximum **80 nodes / 400 edges**. Node IDs <= 200 characters; names, paths and
  domain labels <= 240 characters. Health is finite and between 0 and 100.
- Only `{id, name, path}` node records and the question go to the LLM for target
  resolution. All edges, health, and blast calculations remain local. Do not
  include raw ASTs, methods, full source or rendered coordinates in this prompt.
- Every actual provider payload is capped at **16,000 UTF-8 bytes** before the
  request (a conservative bound of at most 16,000 content tokens, plus system/
  schema overhead). Query/recent-action strings are each limited to 2,000 chars.
  Limits raise clear errors; graphs are never silently truncated. Larger-project
  retrieval is future work. A selected subgraph gives subgraph-relative impact,
  not whole-project impact, so do not label it as the latter.

## Functions and semantics

```python
from backend.agent import (
    resolve_blast_query, generate_proposal, infer_domains, chat_with_pet,
)

blast = resolve_blast_query("What breaks if UserAuth goes down?", graph_dict)
proposal = generate_proposal(["auth"], graph_dict, {"src/UserAuth.java": source_text})
tags = infer_domains(graph_dict["nodes"])
pet = chat_with_pet("How are we doing?", 55, "Reviewed dependency graph")
json_payload = blast.model_dump()  # FastAPI can also return the model directly
# Merge inferred annotations explicitly:
for node in graph_dict["nodes"]:
    node.update(tags[node["id"]].model_dump())
```

BlastResult and Proposal match the requested field names. `diffs` are typed
`Diff` models serialized as `{path, before, after}` objects. `infer_domains`
returns `dict[str, DomainTag]` keyed by node ID; every value has
`domain_tag` and `domain_inferred: true`. It never mutates the input.

Blast uses the analysis engine's reverse BFS at arbitrary depth. Results include
the selected targets, induced edges, and percentage of all supplied nodes. Counts
and the explanatory summary are generated from computed results, not invented by
the model. Live unmatched queries return empty sets. Mock unmatched queries select
the least healthy node deterministically for the presentation happy path.

Proposal `source_code` is a map of repository-relative POSIX paths to **complete
file text**. Live mode sends only selected target files, checks exact `before`
content, disallows duplicate/outside-target paths, and requires an actual change.
The total prompt byte cap still applies; per-file text is capped at 12,000 chars.
These checks do not establish Java syntax, compilation, or semantic correctness.
The mock proposal uses a clearly labeled illustrative `demo/LegacyText.java`
fixture, not a patch against an arbitrary target's source.

Health before/after both use current overall graph health. A1 does not predict
unmeasured gains, apply patches, or reparse proposed code. Proposals remain
`pending`. The API's former simulated apply operation now returns HTTP 409 until
a real validator/apply pipeline exists; rejecting a preview still works. The
platform teammate must inject `AgentAdapter(source_loader=...)` to provide
project-authorized source files for live proposal generation. Without that,
live proposals return HTTP 422 instead of fabricated diffs.

Pet mood is computed locally: 0–39 sick, 40–74 okay, 75–100 thriving. The LLM can
write the line but cannot override mood. Domain tags are always inferred labels,
not verified business facts.

## Validation and handoff

Tests cover no-provider mock behavior, current frontend/engine fixtures,
reverse reachability, cycles, bounds, strict diffs, live-output validation using
stubbed provider responses, SDK structured-output invocation, and actual FastAPI
routes through TestClient. Real provider responses require credentials and are
not claimed as tested by this offline suite.


The latest frontend redesign no longer mounts the existing AgentPanel. The
HTTP adapter/routes still expose blast questions, preview/rejection, domain
inference and pet chat; `/docs` can exercise them until the panel is restored.
Server impact uses `/api/projects/{id}/impact`. The older browser checks target
the previous layout and need to be updated with the UI integration.
