"""Cache the current graph fixture for offline API demos.

Run from the repository root:
    python demo-repos/cache_demo.py
"""

from pathlib import Path
import shutil
import json


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "mocks" / "graph.json"
TARGET = ROOT / "demo-repos" / "cache" / "graph.json"
AGENT_TARGET = ROOT / "demo-repos" / "cache" / "agent.json"

if not SOURCE.exists():
    raise SystemExit(f"Missing graph fixture: {SOURCE}")

TARGET.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(SOURCE, TARGET)
with SOURCE.open(encoding="utf-8") as graph_file:
    graph = json.load(graph_file)

first_node = graph["nodes"][0] if graph["nodes"] else None
agent_cache = {
    "blast": {},
    "proposal": {
        "id": "cached-proposal",
        "target_node_ids": [],
        "rationale": "Demo proposal: isolate the selected legacy dependency behind an interface.",
        "diffs": ["// Cached demo diff: isolate the selected legacy dependency."],
        "health_before": graph["overallHealth"],
        "health_after": min(100, graph["overallHealth"] + 5),
        "change_blast_node_ids": [],
        "status": "pending",
    },
}
if first_node:
    agent_cache["blast"][first_node["name"]] = {
        "matched_node_ids": [first_node["id"]],
        "blast_node_ids": [first_node["id"]],
        "blast_edge_ids": [
            edge["id"]
            for edge in graph["edges"]
            if edge["source"] == first_node["id"] or edge["target"] == first_node["id"]
        ],
        "percent": round(100 / len(graph["nodes"]), 2),
        "summary": f"Cached analysis matched 1 node for: {first_node['name']}",
        "affected_domains": [first_node["clusterName"]],
    }
with AGENT_TARGET.open("w", encoding="utf-8") as agent_file:
    json.dump(agent_cache, agent_file, indent=2)
print(f"Cached graph fixture at {TARGET}")
print(f"Cached agent responses at {AGENT_TARGET}")
