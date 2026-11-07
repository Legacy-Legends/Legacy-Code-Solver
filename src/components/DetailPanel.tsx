import React from 'react';
import {
  X,
  ArrowRight,
  Code2,
  GitBranch,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  GraphNode,
  GraphEdge,
  ImpactAnalysis,
  DependentItem,
  SourceEvidence,
} from '../types/index';

interface DetailPanelProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodesById: Map<string, GraphNode>;
  selectedNode: GraphNode | null;
  selectedEdge: GraphEdge | null;
  impactAnalysis: ImpactAnalysis | null;
  showIndirect: boolean;
  onToggleIndirect: (next: boolean) => void;
  selectedPathNodeIds: string[] | null;
  onSelectPath: (pathIds: string[] | null) => void;
  onSelectNode: (node: GraphNode | null) => void;
  onSelectEdge: (edge: GraphEdge | null) => void;
  onOpenEvidence: (evidence: SourceEvidence, pathList?: SourceEvidence[]) => void;
  resolveEvidenceForEdge: (edge: GraphEdge) => SourceEvidence | undefined;
}

function resolveId(endpoint: string | GraphNode): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.id;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({
  nodes,
  edges,
  nodesById,
  selectedNode,
  selectedEdge,
  impactAnalysis,
  showIndirect,
  onToggleIndirect,
  selectedPathNodeIds,
  onSelectPath,
  onSelectNode,
  onSelectEdge,
  onOpenEvidence,
  resolveEvidenceForEdge,
}) => {
  // 1. Empty State: Nothing selected
  if (!selectedNode && !selectedEdge) {
    return (
      <aside
        aria-label="Investigation details"
        className="flex h-full w-full flex-col bg-[#FCFBF8] p-5 text-slate-800 select-none overflow-y-auto"
      >
        <div className="my-auto py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E4E2DA] bg-white text-indigo-800 shadow-2xs">
            <GitBranch className="h-4 w-4" />
          </div>
          <h2 className="mt-3.5 font-sans text-base font-semibold text-slate-900">
            Select a class to see what uses it.
          </h2>
          <p className="mt-1.5 font-sans text-xs leading-relaxed text-slate-600">
            Click any class box or connection arrow on the graph to trace callers and inspect the exact Java call site.
          </p>

          {nodes.length > 0 && (
            <div className="mt-6 border-t border-[#E4E2DA] pt-4">
              <div className="font-sans text-xs font-medium text-slate-500 mb-2.5">
                Classes in active graph ({nodes.length})
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {nodes.slice(0, 12).map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => onSelectNode(node)}
                    className="flex w-full items-center justify-between rounded-lg border border-[#E4E2DA] bg-white px-3 py-2 text-left transition hover:border-indigo-400 hover:bg-indigo-50/40 cursor-pointer"
                  >
                    <span className="font-mono text-xs font-medium text-slate-900 break-all pr-2">
                      {node.name}
                    </span>
                    <span className="shrink-0 font-sans text-[11px] text-slate-500">
                      {node.clusterName}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    );
  }

  // Helper to open multi-hop or single-hop evidence for a dependent item
  const handleViewDependentCode = (dep: DependentItem) => {
    if (!dep.evidence) return;

    if (dep.depth === 2 && impactAnalysis && dep.pathIds.length >= 3) {
      const intermediateId = dep.pathIds[1];
      const intermediateDirect = impactAnalysis.directDependents.find(
        (d) => d.node.id === intermediateId
      );
      const hops: SourceEvidence[] = [dep.evidence];
      if (intermediateDirect?.evidence) {
        hops.push(intermediateDirect.evidence);
      }
      onOpenEvidence(dep.evidence, hops);
      return;
    }

    onOpenEvidence(dep.evidence, [dep.evidence]);
  };

  // 2. Connection-Only State (when an edge is clicked without a selected node, or alongside it)
  const edgeCaller = selectedEdge ? nodesById.get(resolveId(selectedEdge.source)) : undefined;
  const edgeCallee = selectedEdge ? nodesById.get(resolveId(selectedEdge.target)) : undefined;
  const edgeEvidence = selectedEdge ? resolveEvidenceForEdge(selectedEdge) : undefined;

  if (!selectedNode && selectedEdge && edgeCaller && edgeCallee) {
    return (
      <aside
        aria-label="Connection details"
        className="flex h-full w-full flex-col bg-[#FCFBF8] p-5 text-slate-800 select-none overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-2 border-b border-[#E4E2DA] pb-3.5">
          <div className="min-w-0">
            <div className="font-sans text-xs font-medium text-indigo-800">
              Selected connection
            </div>
            <h2 className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-sm font-semibold text-slate-900 break-all">
              <span>{edgeCaller.name}</span>
              <ArrowRight className="h-3.5 w-3.5 text-indigo-700 shrink-0" />
              <span>{edgeCallee.name}</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onSelectEdge(null)}
            aria-label="Dismiss connection details"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-900 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-[#E4E2DA] bg-white p-4">
          <p className="font-sans text-sm leading-relaxed text-slate-800">
            <span className="font-mono font-semibold text-slate-900">{edgeCaller.name}</span>{' '}
            calls{' '}
            <span className="font-mono font-semibold text-slate-900">{edgeCallee.name}</span>
            {selectedEdge.callSiteLine ? ` on line ${selectedEdge.callSiteLine}` : ''}.
          </p>
          {(selectedEdge.explanation || edgeEvidence?.explanation) && (
            <p className="mt-2 font-sans text-xs leading-relaxed text-slate-600">
              {selectedEdge.explanation || edgeEvidence?.explanation}
            </p>
          )}

          {edgeEvidence && (
            <button
              type="button"
              onClick={() => onOpenEvidence(edgeEvidence, [edgeEvidence])}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#3730A3] px-3.5 py-2.5 font-sans text-xs font-semibold text-white transition hover:bg-[#312E81] cursor-pointer"
            >
              <Code2 className="h-4 w-4" />
              <span>View code (line {edgeEvidence.lineNumber})</span>
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onSelectNode(edgeCaller)}
            className="rounded-lg border border-[#E4E2DA] bg-white px-3 py-2 text-left font-sans text-xs text-slate-700 hover:border-indigo-400 cursor-pointer"
          >
            <div className="text-[11px] text-slate-500">Caller</div>
            <div className="font-mono font-semibold text-slate-900 truncate">
              {edgeCaller.name}
            </div>
          </button>
          <button
            type="button"
            onClick={() => onSelectNode(edgeCallee)}
            className="rounded-lg border border-[#E4E2DA] bg-white px-3 py-2 text-left font-sans text-xs text-slate-700 hover:border-indigo-400 cursor-pointer"
          >
            <div className="text-[11px] text-slate-500">Callee</div>
            <div className="font-mono font-semibold text-slate-900 truncate">
              {edgeCallee.name}
            </div>
          </button>
        </div>
      </aside>
    );
  }

  if (!selectedNode) return null;

  const directDependents = impactAnalysis?.directDependents || [];
  const indirectDependents = impactAnalysis?.indirectDependents || [];

  // Outbound dependencies (what selectedNode itself calls)
  const outboundEdges = edges.filter((e) => resolveId(e.source) === selectedNode.id);

  // Construct one clear plain-English finding sentence
  let findingText = '';
  if (directDependents.length === 0) {
    findingText = `No callers found. No other classes in this project depend on ${selectedNode.name}.`;
  } else if (directDependents.length === 1) {
    const callerName = directDependents[0].node.name;
    if (indirectDependents.length === 0) {
      findingText = `${callerName} calls ${selectedNode.name}.`;
    } else if (showIndirect && indirectDependents.length === 1) {
      findingText = `${callerName} calls ${selectedNode.name} directly, and ${indirectDependents[0].node.name} reaches it through ${callerName}.`;
    } else {
      findingText = `${callerName} calls ${selectedNode.name}.`;
    }
  } else {
    const names = directDependents.slice(0, 2).map((d) => d.node.name).join(' and ');
    const extra = directDependents.length > 2 ? ` and ${directDependents.length - 2} more` : '';
    findingText = `${names}${extra} call ${selectedNode.name} directly.`;
  }

  return (
    <aside
      aria-label="Class investigation details"
      className="flex h-full w-full flex-col bg-[#FCFBF8] text-slate-800 select-none overflow-y-auto"
    >
      {/* Header: Selected Class Name & Dismiss */}
      <div className="flex items-start justify-between gap-3 border-b border-[#E4E2DA] bg-white px-5 py-4">
        <div className="min-w-0">
          <div className="font-sans text-xs font-medium text-slate-500">
            {selectedNode.clusterName}
          </div>
          <h2 className="mt-0.5 font-mono text-base font-bold text-slate-900 break-all">
            {selectedNode.name}
          </h2>
          <div className="mt-1 font-mono text-[11px] text-slate-500 break-all">
            {selectedNode.path}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onSelectNode(null);
            onSelectEdge(null);
          }}
          aria-label="Dismiss class details"
          className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 p-5">
        {/* One Plain-English Finding */}
        <div className="rounded-xl border border-[#DCD9D0] bg-white p-3.5">
          <p className="font-sans text-sm font-medium leading-relaxed text-slate-900">
            {findingText}
          </p>
        </div>

        {/* Selected Connection Callout (if an edge was clicked) */}
        {selectedEdge && edgeCaller && edgeCallee && (
          <div className="rounded-xl border border-indigo-300 bg-indigo-50/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="font-sans text-xs font-semibold text-indigo-950">
                Selected connection
              </span>
              <button
                type="button"
                onClick={() => onSelectEdge(null)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Clear
              </button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-xs font-semibold text-indigo-950 break-all">
              <span>{edgeCaller.name}</span>
              <ArrowRight className="h-3 w-3 text-indigo-700 shrink-0" />
              <span>{edgeCallee.name}</span>
            </div>
            <p className="mt-1.5 font-sans text-xs leading-relaxed text-slate-700">
              {selectedEdge.explanation ||
                edgeEvidence?.explanation ||
                `${edgeCaller.name} calls ${edgeCallee.name}.`}
            </p>
            {edgeEvidence && (
              <button
                type="button"
                onClick={() => onOpenEvidence(edgeEvidence, [edgeEvidence])}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#3730A3] px-3 py-1.5 font-sans text-xs font-semibold text-white transition hover:bg-[#312E81] cursor-pointer"
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>View code (line {edgeEvidence.lineNumber})</span>
              </button>
            )}
          </div>
        )}

        {/* Direct Callers Section */}
        {directDependents.length > 0 && (
          <section aria-label="Direct callers" className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-sans text-xs font-semibold text-slate-700">
                Direct callers ({directDependents.length})
              </h3>
            </div>

            <div className="space-y-2">
              {directDependents.map((dep) => {
                const isPathSelected =
                  selectedPathNodeIds !== null &&
                  selectedPathNodeIds.length === 2 &&
                  selectedPathNodeIds[0] === dep.node.id;

                return (
                  <div
                    key={dep.node.id}
                    onClick={() =>
                      onSelectPath(isPathSelected ? null : dep.pathIds)
                    }
                    className={`rounded-xl border p-3.5 transition cursor-pointer ${
                      isPathSelected
                        ? 'border-[#3730A3] bg-indigo-50/50'
                        : 'border-[#E4E2DA] bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectNode(dep.node);
                        }}
                        className="font-mono text-xs font-semibold text-slate-900 hover:text-indigo-800 hover:underline text-left break-all cursor-pointer"
                      >
                        {dep.node.name}
                      </button>
                      <span className="shrink-0 rounded bg-indigo-50 px-2 py-0.5 font-sans text-[11px] font-medium text-indigo-900">
                        Direct caller
                      </span>
                    </div>

                    <p className="mt-1.5 font-sans text-xs leading-relaxed text-slate-600">
                      {dep.explanation || `${dep.node.name} calls ${selectedNode.name}.`}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                      <span className="font-mono text-[11px] text-slate-500">
                        {dep.evidence
                          ? `Line ${dep.evidence.lineNumber}`
                          : dep.callSiteLine
                          ? `Line ${dep.callSiteLine}`
                          : 'Direct dependency'}
                      </span>

                      {dep.evidence && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPath(dep.pathIds);
                            handleViewDependentCode(dep);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#3730A3] px-2.5 py-1.5 font-sans text-xs font-medium text-white transition hover:bg-[#312E81] cursor-pointer"
                        >
                          <Code2 className="h-3.5 w-3.5" />
                          <span>View code</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Indirect Callers Control & List */}
        {indirectDependents.length > 0 && (
          <section aria-label="Indirect callers" className="space-y-2.5 border-t border-[#E4E2DA] pt-4">
            <button
              type="button"
              onClick={() => onToggleIndirect(!showIndirect)}
              aria-expanded={showIndirect}
              className="flex w-full items-center justify-between rounded-xl border border-[#DCD9D0] bg-white px-3.5 py-2.5 font-sans text-xs font-semibold text-slate-800 transition hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer"
            >
              <span>
                {showIndirect
                  ? `Hide indirect (${indirectDependents.length})`
                  : `Show indirect (${indirectDependents.length})`}
              </span>
              {showIndirect ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </button>

            {showIndirect && (
              <div className="space-y-2 pt-1">
                {indirectDependents.map((dep) => {
                  const intermediateId = dep.pathIds[1];
                  const intermediateNode = nodesById.get(intermediateId);
                  const intermediateName = intermediateNode?.name || intermediateId;

                  const isPathSelected =
                    selectedPathNodeIds !== null &&
                    selectedPathNodeIds.includes(dep.node.id);

                  return (
                    <div
                      key={dep.node.id}
                      onClick={() =>
                        onSelectPath(isPathSelected ? null : dep.pathIds)
                      }
                      className={`rounded-xl border p-3.5 transition cursor-pointer ${
                        isPathSelected
                          ? 'border-[#3730A3] bg-indigo-50/50'
                          : 'border-[#E4E2DA] bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectNode(dep.node);
                          }}
                          className="font-mono text-xs font-semibold text-slate-900 hover:text-indigo-800 hover:underline text-left break-all cursor-pointer"
                        >
                          {dep.node.name}
                        </button>
                        <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 font-sans text-[11px] font-medium text-slate-700">
                          via {intermediateName}
                        </span>
                      </div>

                      {/* Path Chain */}
                      <div className="mt-2 flex flex-wrap items-center gap-1 rounded-lg bg-[#F7F5F0] px-2.5 py-1.5 font-mono text-[11px] text-slate-800 break-all">
                        <span>{dep.node.name}</span>
                        <ArrowRight className="h-3 w-3 text-indigo-700 shrink-0" />
                        <span className="font-semibold text-indigo-900">{intermediateName}</span>
                        <ArrowRight className="h-3 w-3 text-indigo-700 shrink-0" />
                        <span>{selectedNode.name}</span>
                      </div>

                      <p className="mt-2 font-sans text-xs leading-relaxed text-slate-600">
                        {dep.node.name} calls {intermediateName}, which calls {selectedNode.name}.
                      </p>

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                        <span className="font-sans text-[11px] text-slate-500">
                          {isPathSelected ? 'Full path highlighted' : 'Click to highlight path'}
                        </span>

                        {dep.evidence && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPath(dep.pathIds);
                              handleViewDependentCode(dep);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3730A3] px-2.5 py-1.5 font-sans text-xs font-medium text-white transition hover:bg-[#312E81] cursor-pointer"
                          >
                            <Code2 className="h-3.5 w-3.5" />
                            <span>View code</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Outbound Dependencies (What this class uses) */}
        {outboundEdges.length > 0 && (
          <section aria-label="Classes used by this class" className="space-y-2 border-t border-[#E4E2DA] pt-4">
            <h3 className="font-sans text-xs font-semibold text-slate-600">
              Uses ({outboundEdges.length})
            </h3>
            <div className="space-y-1.5">
              {outboundEdges.map((edge) => {
                const targetNode = nodesById.get(resolveId(edge.target));
                if (!targetNode) return null;
                const ev = resolveEvidenceForEdge(edge);
                return (
                  <div
                    key={edge.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#E4E2DA] bg-white px-3 py-2 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectNode(targetNode)}
                      className="font-mono font-medium text-slate-800 hover:text-indigo-800 hover:underline text-left break-all cursor-pointer"
                    >
                      {targetNode.name}
                    </button>
                    {ev && (
                      <button
                        type="button"
                        onClick={() => onOpenEvidence(ev, [ev])}
                        className="shrink-0 font-sans text-[11px] font-medium text-indigo-800 hover:underline cursor-pointer"
                      >
                        View code →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
};
