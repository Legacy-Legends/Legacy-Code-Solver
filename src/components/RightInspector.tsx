import React, { useState } from 'react';
import {
  X,
  FolderGit2,
  Code2,
  GitCommit,
  HelpCircle,
  ChevronRight,
  Eye,
  Copy,
  Check,
  ArrowRight,
  Info,
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
  const [copied, setCopied] = useState(false);
  const [focusedDependentId, setFocusedDependentId] = useState<string | null>(null);

  if (!selectedNode) {
    return (
      <aside
        aria-label="Class Inspector"
        className="glass-panel flex h-full w-full flex-col p-6 select-none"
      >
        <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-slate-400">
          <GitCommit className="h-4 w-4 text-cyan-400" />
          Dependency Inspector
        </div>

        <div className="my-auto flex flex-col items-center text-center px-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 shadow-[0_0_20px_rgba(0,245,212,0.15)]">
            <HelpCircle className="h-7 w-7" />
          </div>

          <h3 className="mt-4 font-sans text-base font-bold text-slate-100">
            Select a Java Class
          </h3>
          <p className="mt-2 font-sans text-xs text-slate-400 leading-relaxed max-w-xs">
            Click any node on the live dependency map or choose a preset below to inspect blast radius and source evidence.
          </p>

          <div className="mt-8 w-full border-t border-white/5 pt-5 text-left">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Demo Test Classes:
            </span>
            <div className="mt-3 space-y-2">
              {[
                { name: 'SessionManager', role: 'Direct caller of AuthTokenValidator, used by CheckoutService' },
                { name: 'AuthTokenValidator', role: 'Core security token validator with transitive callers' },
                { name: 'CheckoutService', role: 'Order checkout transaction orchestrator' },
                { name: 'AppLogger', role: 'Independent utility with zero callers (isolated)' },
              ].map(({ name, role }) => {
                const node = Array.from(nodesById.values()).find((n) => n.name === name);
                if (!node) return null;
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => onSelectNode(node)}
                    className="flex w-full items-start justify-between rounded-xl border border-white/5 bg-slate-900/40 p-3 text-left transition hover:border-cyan-400/30 hover:bg-slate-800/60 group"
                  >
                    <div>
                      <div className="font-mono text-xs font-bold text-slate-200 group-hover:text-cyan-300">
                        {node.name}
                      </div>
                      <div className="font-sans text-[10.5px] text-slate-400 mt-0.5">
                        {role}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 shrink-0 mt-1" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    );
  }

  const visuals = getHealthVisuals(selectedNode.health);

  const handleCopyPath = () => {
    navigator.clipboard.writeText(selectedNode.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenEvidence = (dependent: DependentItem) => {
    if (dependent.evidence) {
      onOpenEvidence(dependent.evidence);
    }
  };

  // Determine currently focused dependent for the "Why is this here?" card
  const allDependents = [
    ...(impactAnalysis?.directDependents || []),
    ...(impactAnalysis?.indirectDependents || []),
  ];
  const activeFocusedDependent =
    allDependents.find((d) => d.node.id === focusedDependentId) ||
    allDependents[0] ||
    null;

  return (
    <aside
      aria-label="Class Inspector"
      className="glass-panel flex h-full w-full flex-col select-none"
    >
      {/* Top Refraction Accent Line */}
      <div
        className="h-1 w-full"
        style={{
          backgroundColor: visuals.coreColor,
          boxShadow: `0 0 16px ${visuals.auraColor}`,
        }}
      />

      {/* Header */}
      <div className="flex items-start justify-between border-b border-white/10 px-5 py-3.5">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
              Selected Target
            </span>
            <span className="font-mono text-[10px] text-slate-500">#{selectedNode.id}</span>
          </div>

          <h2 className="mt-1 truncate font-mono text-lg font-bold text-slate-100">
            {selectedNode.name}
          </h2>

          <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-slate-400 truncate">
            <span className="truncate">{selectedNode.path}</span>
            <button
              type="button"
              onClick={handleCopyPath}
              className="text-slate-500 hover:text-slate-300 transition shrink-0"
              title="Copy file path"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Deselect class"
          className="rounded-xl border border-white/10 bg-slate-900/60 p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable Content Body */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {/* Package & Metrics Grid */}
        <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
          <div className="rounded-xl border border-white/5 bg-slate-900/50 p-2.5">
            <div className="text-[10px] uppercase text-slate-400 flex items-center gap-1">
              <FolderGit2 className="h-3 w-3 text-slate-500" />
              Package Cluster
            </div>
            <div className="mt-1 font-semibold text-slate-200 truncate">
              {selectedNode.clusterName}
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-slate-900/50 p-2.5">
            <div className="text-[10px] uppercase text-slate-400">Code Health</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-bold" style={{ color: visuals.coreColor }}>
                {selectedNode.health}
              </span>
              <span className="text-[10px] text-slate-500">/ 100</span>
              <span className="ml-auto text-[10px] text-slate-400 font-normal">{visuals.label}</span>
            </div>
          </div>
        </div>

        {/* Primary Action Button: Trace Impact */}
        <div>
          <button
            type="button"
            onClick={onTraceImpact}
            disabled={isTracing}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 font-mono text-xs font-bold uppercase tracking-wider transition shadow-lg ${
              isTracing
                ? 'bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 cursor-wait'
                : 'bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 hover:from-cyan-300 hover:to-teal-300 hover:shadow-[0_0_24px_rgba(0,245,212,0.4)] active:scale-[0.99]'
            }`}
          >
            <GitCommit className="h-4 w-4" />
            {isTracing ? 'Tracing Impact...' : 'Trace Impact'}
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-1.5 text-center font-mono text-[10.5px] text-slate-400">
            Traverses callers in reverse to find potentially affected classes
          </p>
        </div>

        {/* IMPACT ANALYSIS RESULTS */}
        {impactAnalysis && impactAnalysis.targetNode.id === selectedNode.id && (
          <div className="space-y-4 pt-2">
            {/* Impact Summary Banner */}
            <div
              className={`rounded-2xl border p-3.5 font-mono ${
                impactAnalysis.totalAffected > 0
                  ? 'border-cyan-500/30 bg-cyan-950/30 text-cyan-100 shadow-[0_4px_20px_rgba(0,245,212,0.08)]'
                  : 'border-slate-800 bg-slate-900/50 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider">
                  Potentially Affected
                </span>
                <span className="rounded-full bg-cyan-900/60 border border-cyan-400/40 px-2.5 py-0.5 font-bold text-cyan-300">
                  {impactAnalysis.totalAffected}{' '}
                  {impactAnalysis.totalAffected === 1 ? 'Class' : 'Classes'}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-300 font-sans leading-relaxed">
                {impactAnalysis.totalAffected > 0
                  ? `Changing ${selectedNode.name} potentially affects ${impactAnalysis.totalAffected} downstream ${
                      impactAnalysis.totalAffected === 1 ? 'dependent' : 'dependents'
                    }.`
                  : `Safe to modify in isolation. No other classes in this project depend on ${selectedNode.name}.`}
              </p>
            </div>

            {/* "WHY IS THIS HERE?" EXPLANATION CARD */}
            {activeFocusedDependent && (
              <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-4 shadow-xl">
                <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  <Info className="h-3.5 w-3.5" />
                  Why is this here?
                </div>

                <div className="mt-2 font-sans text-xs text-slate-200 leading-relaxed">
                  <span className="font-mono font-bold text-cyan-300">
                    {activeFocusedDependent.node.name}
                  </span>{' '}
                  {activeFocusedDependent.explanation || `depends on ${selectedNode.name}`}
                </div>

                {/* Explicit Clickable Text Path */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-950/70 border border-white/5 px-2.5 py-1.5 font-mono text-[11px]">
                  {activeFocusedDependent.pathIds.map((id, idx) => {
                    const n = nodesById.get(id);
                    const isLast = idx === activeFocusedDependent.pathIds.length - 1;
                    return (
                      <React.Fragment key={id}>
                        <button
                          type="button"
                          onClick={() => n && onSelectNode(n)}
                          className="font-bold text-slate-200 hover:text-cyan-300 hover:underline"
                        >
                          {n?.name || id}
                        </button>
                        {!isLast && (
                          <span className="text-cyan-400 flex items-center gap-0.5 text-[10px]">
                            ──depends on──&gt;
                          </span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* PROVE: View Source Evidence Button */}
                {activeFocusedDependent.evidence && (
                  <button
                    type="button"
                    onClick={() => handleOpenEvidence(activeFocusedDependent)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-950/40 px-3 py-2 font-mono text-xs font-semibold text-cyan-200 hover:bg-cyan-900/50 hover:text-cyan-100 transition shadow"
                  >
                    <Code2 className="h-3.5 w-3.5 text-cyan-400" />
                    <span>View Source Evidence (Line {activeFocusedDependent.evidence.lineNumber})</span>
                    <ArrowRight className="h-3.5 w-3.5 text-cyan-400" />
                  </button>
                )}
              </div>
            )}

            {/* DIRECT DEPENDENTS LIST */}
            {impactAnalysis.directDependents.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f5d4]" />
                    Direct Dependents (Callers)
                  </span>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 font-bold">
                    {impactAnalysis.directDependents.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {impactAnalysis.directDependents.map((dep) => {
                    const isIsolated =
                      selectedPathNodeIds &&
                      selectedPathNodeIds.includes(dep.node.id);
                    const isFocused = activeFocusedDependent?.node.id === dep.node.id;

                    return (
                      <div
                        key={dep.node.id}
                        onClick={() => setFocusedDependentId(dep.node.id)}
                        className={`rounded-xl border p-3 transition cursor-pointer ${
                          isFocused
                            ? 'border-cyan-400/80 bg-cyan-950/30 shadow-[0_0_15px_rgba(0,245,212,0.12)]'
                            : 'border-white/5 bg-slate-900/40 hover:border-white/10 hover:bg-slate-900/60'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectNode(dep.node);
                            }}
                            className="font-mono text-xs font-bold text-cyan-300 hover:underline text-left truncate"
                          >
                            {dep.node.name}
                          </button>
                          <span className="font-mono text-[9px] text-slate-400 rounded-full bg-slate-800/80 px-2 py-0.5 shrink-0">
                            Direct (depth 1)
                          </span>
                        </div>

                        {/* Explicit Natural Reading Direction */}
                        <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[10.5px] text-slate-400">
                          <span className="text-slate-300 font-medium">{dep.node.name}</span>
                          <span className="text-cyan-400 font-semibold">──depends on──&gt;</span>
                          <span className="text-slate-300 font-medium">{selectedNode.name}</span>
                        </div>

                        {/* Actions */}
                        <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-white/5 font-mono text-[10.5px]">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPath(isIsolated ? null : dep.pathIds);
                            }}
                            className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
                          >
                            <Eye className="h-3 w-3" />
                            {isIsolated ? 'Show full map' : 'Isolate path'}
                          </button>

                          {dep.evidence ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEvidence(dep);
                              }}
                              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-semibold"
                            >
                              <Code2 className="h-3 w-3" />
                              View source (line {dep.evidence.lineNumber}) →
                            </button>
                          ) : (
                            <span className="text-slate-500 italic text-[10px]">
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

            {/* INDIRECT DEPENDENTS LIST */}
            {impactAnalysis.indirectDependents.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />
                    Indirect Dependents (Transitive)
                  </span>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 font-bold">
                    {impactAnalysis.indirectDependents.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {impactAnalysis.indirectDependents.map((dep) => {
                    const isIsolated =
                      selectedPathNodeIds &&
                      selectedPathNodeIds.includes(dep.node.id);
                    const isFocused = activeFocusedDependent?.node.id === dep.node.id;

                    const pathNames = dep.pathIds.map(
                      (id) => nodesById.get(id)?.name || id
                    );

                    return (
                      <div
                        key={dep.node.id}
                        onClick={() => setFocusedDependentId(dep.node.id)}
                        className={`rounded-xl border p-3 transition cursor-pointer ${
                          isFocused
                            ? 'border-indigo-400/80 bg-indigo-950/30 shadow-[0_0_15px_rgba(129,140,248,0.12)]'
                            : 'border-white/5 bg-slate-900/40 hover:border-white/10 hover:bg-slate-900/60'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectNode(dep.node);
                            }}
                            className="font-mono text-xs font-bold text-indigo-300 hover:underline text-left truncate"
                          >
                            {dep.node.name}
                          </button>
                          <span className="font-mono text-[9px] text-slate-400 rounded-full bg-slate-800/80 px-2 py-0.5 shrink-0">
                            Indirect (depth 2)
                          </span>
                        </div>

                        {/* Explicit Path Chain */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1 font-mono text-[10.5px] text-slate-400">
                          {pathNames.map((name, i) => (
                            <React.Fragment key={i}>
                              <span className="text-slate-300 font-medium">{name}</span>
                              {i < pathNames.length - 1 && (
                                <span className="text-indigo-400 font-semibold">──depends on──&gt;</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>

                        {/* Actions */}
                        <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-white/5 font-mono text-[10.5px]">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPath(isIsolated ? null : dep.pathIds);
                            }}
                            className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
                          >
                            <Eye className="h-3 w-3" />
                            {isIsolated ? 'Show full map' : 'Isolate path'}
                          </button>

                          {dep.evidence ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEvidence(dep);
                              }}
                              className="flex items-center gap-1 text-indigo-300 hover:text-indigo-200 font-semibold"
                            >
                              <Code2 className="h-3 w-3" />
                              View source (line {dep.evidence.lineNumber}) →
                            </button>
                          ) : (
                            <span className="text-slate-500 italic text-[10px]">
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
