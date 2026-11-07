import React from 'react';
import {
  X,
  FileCode2,
  FolderGit2,
  Code2,
  GitCommit,
  HelpCircle,
  ChevronRight,
  Eye,
} from 'lucide-react';
import {
  GraphNode,
  ImpactAnalysis,
  DependentItem,
  SourceEvidence,
} from '../types/index';
import { getHealthVisuals } from '../lib/healthColor';

interface RightInspectorProps {
  selectedNode: GraphNode | null;
  nodesById: Map<string, GraphNode>;
  impactAnalysis: ImpactAnalysis | null;
  isTracing: boolean;
  onTraceImpact: () => void;
  onSelectNode: (node: GraphNode) => void;
  onOpenEvidence: (evidence: SourceEvidence, pathEvidenceList?: SourceEvidence[]) => void;
  selectedPathNodeIds: string[] | null;
  onSelectPath: (pathIds: string[] | null) => void;
  onClose: () => void;
}

export const RightInspector: React.FC<RightInspectorProps> = ({
  selectedNode,
  nodesById,
  impactAnalysis,
  isTracing,
  onTraceImpact,
  onSelectNode,
  onOpenEvidence,
  selectedPathNodeIds,
  onSelectPath,
  onClose,
}) => {
  if (!selectedNode) {
    return (
      <aside
        aria-label="Class Inspector"
        className="flex h-full w-full flex-col border-l border-slate-800/90 bg-[#070c18] p-5 select-none"
      >
        <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-slate-400">
          <GitCommit className="h-4 w-4 text-cyan-400" />
          Investigation Inspector
        </div>

        <div className="my-auto flex flex-col items-center text-center px-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-slate-500">
            <HelpCircle className="h-6 w-6 text-cyan-400/80" />
          </div>
          <h3 className="mt-4 font-mono text-sm font-semibold text-slate-200">
            Select a Java Class
          </h3>
          <p className="mt-1.5 font-mono text-xs text-slate-400 leading-relaxed">
            Click any node on the graph canvas or search above to inspect dependencies and trace downstream blast radius.
          </p>

          <div className="mt-6 w-full border-t border-slate-800/80 pt-4 text-left">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Suggested Test Paths:
            </span>
            <div className="mt-2 space-y-1.5 font-mono text-xs">
              {['AuthTokenValidator', 'SessionManager', 'CheckoutService', 'AppLogger'].map(
                (name) => {
                  const node = Array.from(nodesById.values()).find((n) => n.name === name);
                  if (!node) return null;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => onSelectNode(node)}
                      className="flex w-full items-center justify-between rounded border border-slate-800/70 bg-slate-900/40 px-2.5 py-1.5 text-left text-slate-300 transition hover:border-cyan-500/40 hover:bg-slate-800/60 hover:text-cyan-200"
                    >
                      <span className="truncate">{node.name}</span>
                      <ChevronRight className="h-3 w-3 text-slate-500" />
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </div>
      </aside>
    );
  }

  const visuals = getHealthVisuals(selectedNode.health);

  // Helper to open evidence for a dependent item
  const handleOpenEvidence = (dependent: DependentItem) => {
    if (dependent.evidence) {
      onOpenEvidence(dependent.evidence);
    }
  };

  return (
    <aside
      aria-label="Class Inspector"
      className="flex h-full w-full flex-col border-l border-slate-800/90 bg-[#070c18] select-none"
    >
      {/* Top Accent Line */}
      <div
        className="h-1 w-full"
        style={{
          backgroundColor: visuals.coreColor,
          boxShadow: `0 0 14px ${visuals.auraColor}`,
        }}
      />

      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-800/80 px-4 py-3">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
              Selected Target
            </span>
            <span className="font-mono text-[10px] text-slate-500">#{selectedNode.id}</span>
          </div>
          <h2 className="mt-0.5 truncate font-mono text-base font-bold text-slate-100">
            {selectedNode.name}
          </h2>
          <div className="mt-1 flex items-center gap-1.5 text-slate-400 font-mono text-[11px] truncate">
            <FolderGit2 className="h-3 w-3 text-slate-500 shrink-0" />
            <span className="truncate">{selectedNode.clusterName}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Deselect class"
          className="rounded-lg border border-slate-800 bg-slate-900/80 p-1.5 text-slate-400 transition hover:border-slate-700 hover:bg-slate-800 hover:text-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content Scrollable Body */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {/* Source File Path */}
        <div>
          <label className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            <FileCode2 className="h-3 w-3 text-cyan-400" />
            Source File Path
          </label>
          <div className="mt-1 break-all rounded border border-slate-800 bg-[#040710] px-2.5 py-1.5 font-mono text-[11px] text-slate-300">
            {selectedNode.path}
          </div>
        </div>

        {/* Complexity & Health Badges */}
        <div className="grid grid-cols-2 gap-2 font-mono text-xs">
          <div className="rounded border border-slate-800/80 bg-slate-900/40 p-2">
            <div className="text-[10px] uppercase text-slate-400">Code Health</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold" style={{ color: visuals.coreColor }}>
                {selectedNode.health}
              </span>
              <span className="text-[10px] text-slate-500">/ 100</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">{visuals.label}</div>
          </div>

          <div className="rounded border border-slate-800/80 bg-slate-900/40 p-2">
            <div className="text-[10px] uppercase text-slate-400">Complexity</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-200">
                {selectedNode.complexity}
              </span>
              <span className="text-[10px] text-slate-500">branches</span>
            </div>
            <div className="text-[10px] text-slate-400">{selectedNode.loc} LOC</div>
          </div>
        </div>

        {/* PRIMARY ACTION: Trace Impact Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onTraceImpact}
            disabled={isTracing}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 font-mono text-xs font-semibold uppercase tracking-wider shadow-md transition ${
              isTracing
                ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300 cursor-wait'
                : 'border-cyan-400/80 bg-cyan-500 text-slate-950 hover:bg-cyan-400 hover:shadow-cyan-500/25 active:translate-y-0.5'
            }`}
          >
            <GitCommit className="h-4 w-4" />
            {isTracing ? 'Tracing Impact...' : 'Trace Impact'}
          </button>
          <p className="mt-1.5 text-center font-mono text-[10px] text-slate-400">
            Identifies all classes that depend on {selectedNode.name}
          </p>
        </div>

        {/* IMPACT ANALYSIS RESULTS */}
        {impactAnalysis && impactAnalysis.targetNode.id === selectedNode.id && (
          <div className="space-y-4 border-t border-slate-800 pt-3">
            {/* Impact Summary Banner */}
            <div
              className={`rounded-lg border p-3 font-mono ${
                impactAnalysis.totalAffected > 0
                  ? 'border-cyan-500/40 bg-cyan-950/25 text-cyan-200'
                  : 'border-slate-800 bg-slate-900/40 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider">
                  Potentially Affected
                </span>
                <span className="rounded bg-cyan-900/50 border border-cyan-500/30 px-2 py-0.5 font-bold text-cyan-300">
                  {impactAnalysis.totalAffected}{' '}
                  {impactAnalysis.totalAffected === 1 ? 'Class' : 'Classes'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                {impactAnalysis.totalAffected > 0
                  ? `Changing ${selectedNode.name} potentially affects ${impactAnalysis.totalAffected} downstream dependents.`
                  : `No dependents found. No other classes in this project depend on ${selectedNode.name}. Safe to modify in isolation.`}
              </p>
            </div>

            {/* Direct Dependents Section */}
            {impactAnalysis.directDependents.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    Direct Dependents
                  </span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-400 font-bold">
                    {impactAnalysis.directDependents.length}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {impactAnalysis.directDependents.map((dep) => {
                    const isIsolated =
                      selectedPathNodeIds &&
                      selectedPathNodeIds.includes(dep.node.id);

                    return (
                      <div
                        key={dep.node.id}
                        className={`rounded-lg border p-2.5 transition ${
                          isIsolated
                            ? 'border-cyan-400 bg-cyan-950/30 shadow-[0_0_12px_rgba(56,189,248,0.15)]'
                            : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <button
                            type="button"
                            onClick={() => onSelectNode(dep.node)}
                            className="font-mono text-xs font-semibold text-cyan-300 hover:underline text-left truncate"
                          >
                            {dep.node.name}
                          </button>
                          <span className="font-mono text-[9px] text-slate-400 rounded bg-slate-800 px-1 py-0.2 shrink-0">
                            Direct (depth 1)
                          </span>
                        </div>

                        {/* Explicit Natural Reading Direction: Caller --depends on--> Callee */}
                        <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                          <span className="text-slate-300 font-medium">{dep.node.name}</span>
                          <span className="text-cyan-400">──depends on──&gt;</span>
                          <span className="text-slate-300 font-medium">{selectedNode.name}</span>
                        </div>

                        {/* Evidence Actions */}
                        <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-800/80 font-mono text-[10px]">
                          <button
                            type="button"
                            onClick={() =>
                              onSelectPath(isIsolated ? null : dep.pathIds)
                            }
                            className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
                          >
                            <Eye className="h-3 w-3" />
                            {isIsolated ? 'Show all' : 'Isolate path'}
                          </button>

                          {dep.evidence ? (
                            <button
                              type="button"
                              onClick={() => handleOpenEvidence(dep)}
                              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium"
                            >
                              <Code2 className="h-3 w-3" />
                              Inspect call site (line {dep.evidence.lineNumber}) →
                            </button>
                          ) : (
                            <span className="text-slate-500 italic text-[9px]">
                              Call site not indexed
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Indirect Dependents Section */}
            {impactAnalysis.indirectDependents.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-indigo-400" />
                    Indirect Dependents
                  </span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-400 font-bold">
                    {impactAnalysis.indirectDependents.length}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {impactAnalysis.indirectDependents.map((dep) => {
                    const isIsolated =
                      selectedPathNodeIds &&
                      selectedPathNodeIds.includes(dep.node.id);

                    // Reconstruct path names
                    const pathNames = dep.pathIds.map(
                      (id) => nodesById.get(id)?.name || id
                    );

                    return (
                      <div
                        key={dep.node.id}
                        className={`rounded-lg border p-2.5 transition ${
                          isIsolated
                            ? 'border-indigo-400 bg-indigo-950/30 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                            : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <button
                            type="button"
                            onClick={() => onSelectNode(dep.node)}
                            className="font-mono text-xs font-semibold text-indigo-300 hover:underline text-left truncate"
                          >
                            {dep.node.name}
                          </button>
                          <span className="font-mono text-[9px] text-slate-400 rounded bg-slate-800 px-1 py-0.2 shrink-0">
                            Indirect (depth 2)
                          </span>
                        </div>

                        {/* Explicit Natural Reading Direction Path */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1 font-mono text-[10px] text-slate-400 leading-tight">
                          {pathNames.map((name, i) => (
                            <React.Fragment key={i}>
                              <span className="text-slate-300 font-medium">{name}</span>
                              {i < pathNames.length - 1 && (
                                <span className="text-indigo-400">──depends on──&gt;</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>

                        {/* Evidence Actions */}
                        <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-800/80 font-mono text-[10px]">
                          <button
                            type="button"
                            onClick={() =>
                              onSelectPath(isIsolated ? null : dep.pathIds)
                            }
                            className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
                          >
                            <Eye className="h-3 w-3" />
                            {isIsolated ? 'Show all' : 'Isolate path'}
                          </button>

                          {dep.evidence ? (
                            <button
                              type="button"
                              onClick={() => handleOpenEvidence(dep)}
                              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium"
                            >
                              <Code2 className="h-3 w-3" />
                              Inspect call site (line {dep.evidence.lineNumber}) →
                            </button>
                          ) : (
                            <span className="text-slate-500 italic text-[9px]">
                              Call site not indexed
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
