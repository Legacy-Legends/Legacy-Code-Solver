import React from 'react';
import {
  Code2,
  FolderGit2,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import {
  GraphNode,
  ImpactAnalysis,
  SourceEvidence,
} from '../types/index';

interface InvestigateResultsProps {
  selectedNode: GraphNode | null;
  nodesById: Map<string, GraphNode>;
  impactAnalysis: ImpactAnalysis | null;
  onSelectNode: (node: GraphNode) => void;
  onOpenEvidence: (evidence: SourceEvidence, pathEvidenceList?: SourceEvidence[]) => void;
  selectedPathNodeIds: string[] | null;
  onSelectPath: (pathIds: string[] | null) => void;
}

export const InvestigateResults: React.FC<InvestigateResultsProps> = ({
  selectedNode,
  nodesById,
  impactAnalysis,
  onSelectNode,
  onOpenEvidence,
  selectedPathNodeIds,
  onSelectPath,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!selectedNode) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center select-none bg-white border border-parchment-border rounded-2xl shadow-card">
        <h3 className="font-sans text-base font-bold text-ink-900">
          No class selected
        </h3>
        <p className="mt-1 text-xs text-ink-600 max-w-xs font-sans">
          Choose a Java class from the search bar or presets to see its dependents.
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
          {['SessionManager', 'AuthTokenValidator', 'CheckoutService', 'AppLogger'].map((name) => {
            const node = Array.from(nodesById.values()).find((n) => n.name === name);
            if (!node) return null;
            return (
              <button
                key={name}
                type="button"
                onClick={() => onSelectNode(node)}
                className="rounded-lg border border-parchment-border bg-parchment-100 px-2.5 py-1 text-xs font-mono font-medium text-ink-800 hover:bg-lilac-100 hover:border-purple-300"
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const handleCopyPath = () => {
    navigator.clipboard.writeText(selectedNode.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const directCount = impactAnalysis?.directDependents.length || 0;
  const indirectCount = impactAnalysis?.indirectDependents.length || 0;
  const totalCount = directCount + indirectCount;

  // Lead sentence dynamically derived
  let leadSentence = '';
  let subSentence = '';
  if (totalCount === 0) {
    leadSentence = `No other classes depend on ${selectedNode.name}.`;
    subSentence = 'You can modify this class in isolation without affecting other indexed classes in this project.';
  } else if (directCount === 1 && indirectCount === 0) {
    leadSentence = `1 class uses ${selectedNode.name} directly.`;
    subSentence = `Before modifying ${selectedNode.name}, inspect its caller below.`;
  } else if (directCount > 1 && indirectCount === 0) {
    leadSentence = `${directCount} classes use ${selectedNode.name} directly.`;
    subSentence = `Review each direct caller before making breaking signature changes.`;
  } else {
    leadSentence = `${totalCount} classes use ${selectedNode.name} directly or indirectly.`;
    subSentence = `Review direct callers first, followed by downstream classes in the dependency chain.`;
  }

  return (
    <div className="flex h-full flex-col bg-white border border-parchment-border rounded-2xl shadow-card overflow-hidden select-none">
      {/* Target Class Header */}
      <div className="border-b border-parchment-border p-4 bg-parchment-50">
        <div className="flex items-start justify-between">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-plum-700">
                Target Class Under Inspection
              </span>
            </div>
            <h2 className="mt-1 font-mono text-lg font-bold text-ink-900 truncate">
              {selectedNode.name}
            </h2>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-ink-500 truncate">
              <span className="truncate">{selectedNode.path}</span>
              <button
                type="button"
                onClick={handleCopyPath}
                className="text-ink-400 hover:text-ink-700 transition shrink-0"
                title="Copy file path"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 rounded-lg bg-parchment-200 border border-parchment-border px-2 py-1 font-mono text-[10px] text-ink-600">
            <FolderGit2 className="h-3 w-3 text-ink-500" />
            <span>{selectedNode.clusterName}</span>
          </div>
        </div>

        {/* Quick alternative class switcher chips */}
        <div className="mt-3 flex items-center gap-1 font-mono text-[11px]">
          <span className="text-[10px] text-ink-400 uppercase tracking-wider mr-1">Switch:</span>
          {['SessionManager', 'AuthTokenValidator', 'CheckoutService', 'AppLogger'].map((name) => {
            const node = Array.from(nodesById.values()).find((n) => n.name === name);
            if (!node || node.id === selectedNode.id) return null;
            return (
              <button
                key={name}
                type="button"
                onClick={() => onSelectNode(node)}
                className="rounded-md px-2 py-0.5 text-ink-600 hover:text-plum-700 hover:bg-parchment-200 transition"
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>

      {/* The One Answer: Clear Human Lead Sentence */}
      <div className="border-b border-parchment-border px-4 py-3 bg-lilac-50/60">
        <div className="font-sans text-sm font-bold text-plum-900">
          {leadSentence}
        </div>
        <div className="mt-0.5 font-sans text-xs text-ink-600">
          {subSentence}
        </div>
      </div>

      {/* Results List: Readable without the graph */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h4 className="mt-3 font-sans font-bold text-ink-900 text-sm">
              Safe to modify in isolation
            </h4>
            <p className="mt-1 font-sans text-xs text-ink-600 max-w-xs">
              No other indexed Java classes in this project invoke or depend on {selectedNode.name}.
            </p>
          </div>
        ) : (
          <>
            {/* Direct Dependents (Callers) */}
            {directCount > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-ink-600">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-purple-600" />
                    Direct Dependents ({directCount})
                  </span>
                </div>

                <div className="space-y-2">
                  {impactAnalysis?.directDependents.map((dep) => {
                    const isIsolated =
                      selectedPathNodeIds && selectedPathNodeIds.includes(dep.node.id);

                    return (
                      <div
                        key={dep.node.id}
                        onClick={() => onSelectPath(isIsolated ? null : dep.pathIds)}
                        className={`rounded-xl border p-3 transition cursor-pointer ${
                          isIsolated
                            ? 'card-lilac-active'
                            : 'border-parchment-border bg-white hover:border-purple-300 hover:shadow-soft'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-mono text-xs font-bold text-ink-900">
                              {dep.node.name}
                            </span>
                            <span className="ml-2 font-mono text-[10px] text-purple-700 font-semibold bg-purple-100 px-1.5 py-0.2 rounded">
                              Direct caller
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[11px] font-mono text-ink-400">
                            <Eye className="h-3 w-3" />
                            <span>{isIsolated ? 'Selected' : 'Show path'}</span>
                          </div>
                        </div>

                        {/* Readable Relationship explanation */}
                        <div className="mt-1.5 font-sans text-xs text-ink-700">
                          {dep.explanation || `Calls ${selectedNode.name}`}
                        </div>

                        {/* Natural reading path */}
                        <div className="mt-2 flex items-center gap-1.5 font-mono text-[10.5px] text-ink-500 bg-parchment-100 px-2.5 py-1 rounded-lg">
                          <span className="font-semibold text-ink-800">{dep.node.name}</span>
                          <span className="text-purple-600 font-bold">──depends on──&gt;</span>
                          <span className="font-semibold text-ink-800">{selectedNode.name}</span>
                        </div>

                        {/* One clear action: View code */}
                        {dep.evidence && (
                          <div className="mt-2.5 flex items-center justify-end pt-2 border-t border-parchment-border">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (dep.evidence) {
                                  onOpenEvidence(dep.evidence);
                                }
                              }}
                              className="btn-plum inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm"
                            >
                              <Code2 className="h-3.5 w-3.5" />
                              <span>View code (line {dep.evidence.lineNumber})</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Indirect Dependents (Transitive) */}
            {indirectCount > 0 && (
              <div className="space-y-2 pt-2 border-t border-parchment-border">
                <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-ink-600">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-plum-600" />
                    Indirect Dependents ({indirectCount})
                  </span>
                </div>

                <div className="space-y-2">
                  {impactAnalysis?.indirectDependents.map((dep) => {
                    const isIsolated =
                      selectedPathNodeIds && selectedPathNodeIds.includes(dep.node.id);

                    const pathNames = dep.pathIds.map(
                      (id) => nodesById.get(id)?.name || id
                    );

                    return (
                      <div
                        key={dep.node.id}
                        onClick={() => onSelectPath(isIsolated ? null : dep.pathIds)}
                        className={`rounded-xl border p-3 transition cursor-pointer ${
                          isIsolated
                            ? 'card-lilac-active'
                            : 'border-parchment-border bg-white hover:border-purple-300 hover:shadow-soft'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-mono text-xs font-bold text-ink-900">
                              {dep.node.name}
                            </span>
                            <span className="ml-2 font-mono text-[10px] text-plum-700 font-semibold bg-plum-light px-1.5 py-0.2 rounded">
                              Connected through {pathNames[1] || 'dependency'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[11px] font-mono text-ink-400">
                            <Eye className="h-3 w-3" />
                            <span>{isIsolated ? 'Selected' : 'Show path'}</span>
                          </div>
                        </div>

                        {/* Readable Relationship */}
                        <div className="mt-1.5 font-sans text-xs text-ink-700">
                          {dep.explanation || `Depends indirectly on ${selectedNode.name}`}
                        </div>

                        {/* Multi-hop chain */}
                        <div className="mt-2 flex flex-wrap items-center gap-1 font-mono text-[10.5px] text-ink-500 bg-parchment-100 px-2.5 py-1 rounded-lg">
                          {pathNames.map((name, i) => (
                            <React.Fragment key={i}>
                              <span className="font-semibold text-ink-800">{name}</span>
                              {i < pathNames.length - 1 && (
                                <span className="text-plum-600 font-bold">──depends on──&gt;</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>

                        {/* View code action */}
                        {dep.evidence && (
                          <div className="mt-2.5 flex items-center justify-end pt-2 border-t border-parchment-border">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (dep.evidence) {
                                  onOpenEvidence(dep.evidence);
                                }
                              }}
                              className="btn-plum inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm"
                            >
                              <Code2 className="h-3.5 w-3.5" />
                              <span>View code (line {dep.evidence.lineNumber})</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
