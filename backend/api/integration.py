"""Typed browser-facing integration over the existing graph and agent contracts."""
from collections import deque
from typing import Any


def impact_for_node(graph: dict[str, Any], node_id: str) -> dict[str, Any]:
    """Reverse BFS with real edges and complete shortest dependency paths."""
    nodes = {node['id']: node for node in graph['nodes']}
    if node_id not in nodes:
        raise ValueError(f'Unknown node: {node_id}')
    incoming: dict[str, list[dict]] = {key: [] for key in nodes}
    for edge in graph['edges']:
        incoming[edge['target']].append(edge)
    queue = deque([(node_id, [node_id])])
    visited = {node_id}
    direct, indirect = [], []
    while queue:
        current, path = queue.popleft()
        for edge in sorted(incoming[current], key=lambda e: e['id']):
            caller = edge['source']
            if caller in visited:
                continue
            visited.add(caller)
            caller_path = [caller, *path]
            item = {'node': nodes[caller], 'edge': edge,
                    'depth': 1 if len(path) == 1 else 2, 'pathIds': caller_path,
                    'explanation': f"{nodes[caller]['name']} depends on {nodes[node_id]['name']} through {len(path)} relationship(s)."}
            (direct if len(path) == 1 else indirect).append(item)
            queue.append((caller, caller_path))
    from datetime import datetime, timezone
    return {'targetNode': nodes[node_id], 'directDependents': direct,
            'indirectDependents': indirect, 'totalAffected': len(visited) - 1,
            'timestamp': datetime.now(timezone.utc).isoformat()}
