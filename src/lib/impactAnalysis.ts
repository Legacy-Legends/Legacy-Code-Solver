import { GraphData, GraphEdge, GraphNode, ImpactAnalysis, DependentItem, SourceEvidence } from '../types/index';
import { SAMPLE_EVIDENCE_MAP } from '../data/sampleProject';
import { getEnterpriseSourceEvidence } from '../data/enterpriseSourceSnippets';

export function resolveNodeId(endpoint: string | GraphNode): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.id;
}

/**
 * Computes impact analysis for a target Java class.
 *
 * DIRECTIONALITY HONESTY:
 * In this graph, an edge (source -> target) denotes: source DEPENDS ON target.
 * E.g., Checkout -> Session means Checkout depends on Session.
 *
 * Therefore, tracing changes to class C requires finding all classes that depend on C,
 * which means searching edges in reverse (where edge.target === C.id).
 *
 * Returns:
 * - directDependents: immediate callers where edge.target === targetNode.id
 * - indirectDependents: callers of callers (depth >= 2)
 */
export function computeImpactAnalysis(
  targetNode: GraphNode,
  graphData: GraphData,
  isSampleMode: boolean
): ImpactAnalysis {
  const nodesById = new Map<string, GraphNode>();
  graphData.nodes.forEach((n) => nodesById.set(n.id, n));

  // Build incoming edge map: targetId -> edges that point to it (callers who depend on it)
  const incomingEdgesByTarget = new Map<string, GraphEdge[]>();
  for (const edge of graphData.edges) {
    const tId = resolveNodeId(edge.target);
    const list = incomingEdgesByTarget.get(tId) || [];
    list.push(edge);
    incomingEdgesByTarget.set(tId, list);
  }

  const directDependents: DependentItem[] = [];
  const indirectDependents: DependentItem[] = [];
  const visitedNodeIds = new Set<string>([targetNode.id]);

  function getEvidenceForEdge(edge: GraphEdge): SourceEvidence | undefined {
    if (isSampleMode) {
      return SAMPLE_EVIDENCE_MAP[edge.id];
    }
    const ent = getEnterpriseSourceEvidence(edge, nodesById);
    return ent ?? undefined;
  }

  // 1. Direct Dependents: callers pointing directly to targetNode
  const directEdges = incomingEdgesByTarget.get(targetNode.id) || [];
  for (const edge of directEdges) {
    const callerId = resolveNodeId(edge.source);
    if (callerId === targetNode.id || visitedNodeIds.has(callerId)) continue;

    const callerNode = nodesById.get(callerId);
    if (!callerNode) continue;

    visitedNodeIds.add(callerId);
    directDependents.push({
      node: callerNode,
      edge,
      callSiteLine: edge.callSiteLine,
      explanation: edge.explanation || `${callerNode.name} depends directly on ${targetNode.name}`,
      depth: 1,
      pathIds: [callerId, targetNode.id],
      evidence: getEvidenceForEdge(edge),
    });
  }

  // 2. Indirect Dependents: callers that depend on direct dependents
  const queue = [...directDependents];
  for (let index = 0; index < queue.length; index++) {
    const direct = queue[index];
    const indirectEdges = incomingEdgesByTarget.get(direct.node.id) || [];
    for (const edge of indirectEdges) {
      const callerId = resolveNodeId(edge.source);
      if (visitedNodeIds.has(callerId)) continue;

      const callerNode = nodesById.get(callerId);
      if (!callerNode) continue;

      visitedNodeIds.add(callerId);
      indirectDependents.push({
        node: callerNode,
        edge,
        callSiteLine: edge.callSiteLine,
        explanation:
          edge.explanation ||
          `${callerNode.name} depends indirectly on ${targetNode.name} through ${direct.node.name}`,
        depth: 2,
        pathIds: [callerId, ...direct.pathIds],
        evidence: getEvidenceForEdge(edge),
      });
      queue.push(indirectDependents[indirectDependents.length - 1]);
    }
  }

  return {
    targetNode,
    directDependents,
    indirectDependents,
    totalAffected: directDependents.length + indirectDependents.length,
    timestamp: new Date().toISOString(),
  };
}
