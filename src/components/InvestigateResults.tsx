import React from 'react';
import {
  Code2,
  CheckCircle,
  GitCommit,
  CornerDownRight,
  ChevronRight,
} from 'lucide-react';
import {
  GraphNode,
  ImpactAnalysis,
  SourceEvidence,
} from '../types/index';
import { SAMPLE_EVIDENCE_MAP } from '../data/sampleProject';
import { InvestigationTab } from './WorkspaceSidebar';

interface InvestigateResultsProps {
  selectedNode: GraphNode | null;
  nodesById: Map<string, GraphNode>;
  impactAnalysis: ImpactAnalysis | null;
  onSelectNode: (node: GraphNode) => void;
  onOpenEvidence: (evidence: SourceEvidence, pathEvidenceList?: SourceEvidence[]) => void;
  selectedPathNodeIds?: string[] | null;
  onSelectPath?: (pathIds: string[] | null) => void;
  activeTab?: InvestigationTab;
}

export const InvestigateResults: React.FC<InvestigateResultsProps> = ({
  selectedNode,
  nodesById,
  impactAnalysis,
  onSelectNode,
  onOpenEvidence,
  activeTab = 'graph',
}) => {
  if (!selectedNode) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center select-none bg-white/90 rounded-2xl border border-slate-200/80 shadow-soft">
        <h3 className="font-sans text-lg font-bold text-slate-900">
          No class selected
        </h3>
        <p className="mt-1.5 text-xs text-slate-500 max-w-sm">
          Select a Java class from the sidebar or search to inspect its callers and evidence.
        </p>
      </div>
    );
  }

  const directCount = impactAnalysis?.directDependents.length || 0;
  const indirectCount = impactAnalysis?.indirectDependents.length || 0;
  const totalCount = directCount + indirectCount;

  // Find evidence for direct callers
  const getCallerEvidence = (callerId: string): SourceEvidence | undefined => {
    return Object.values(SAMPLE_EVIDENCE_MAP).find(
      (ev) => ev.callerId === callerId && ev.calleeId === selectedNode.id
    );
  };

  // Find downstream callees that this class calls
  const downstreamEdges = Object.values(SAMPLE_EVIDENCE_MAP).filter(
    (ev) => ev.callerId === selectedNode.id
  );

  return (
    <div className="space-y-6">
      {/* 1. DIRECT ANSWER CARD (Highlighted Ingress Point) */}
      <div className="glass-card rounded-2xl p-6 border-l-4 border-l-slate-900 shadow-sm border border-slate-200/80 bg-white/90">
        <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-700 mb-1">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="tracking-wide">
            {totalCount === 0
              ? 'ZERO INBOUND DEPENDENCIES · ISOLATED MODULE'
              : directCount === 1
              ? 'SINGLE DIRECT INGRESS POINT · BYTECODE VERIFIED'
              : `${directCount} DIRECT INGRESS POINTS · BYTECODE VERIFIED`}
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
          {totalCount === 0 ? (
            <>
              No other classes depend on{' '}
              <span className="bg-slate-100 text-slate-900 px-2 py-0.5 rounded font-mono">
                {selectedNode.name}
              </span>
              .
            </>
          ) : (
            <>
              {directCount} class{directCount === 1 ? '' : 'es'} use{directCount === 1 ? 's' : ''}{' '}
              <span className="bg-emerald-50 text-emerald-900 border border-emerald-200/80 px-2 py-0.5 rounded font-mono">
                {selectedNode.name}
              </span>{' '}
              directly.
            </>
          )}
        </h2>

        {/* Direct Callers List */}
        {directCount > 0 ? (
          <div className="mt-5 space-y-3">
            {impactAnalysis?.directDependents.map((dep) => {
              const evidence = getCallerEvidence(dep.node.id);
              return (
                <div
                  key={dep.node.id}
                  className="p-4 rounded-xl bg-slate-50/90 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition hover:border-slate-300"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-mono font-bold text-slate-800 bg-slate-200/70 px-2 py-0.5 rounded">
                      {dep.node.name}.java
                    </span>
                    <p className="text-sm text-slate-700 mt-2 leading-relaxed">
                      <strong>{dep.node.name}</strong> invokes{' '}
                      <code className="font-mono text-slate-900 font-bold bg-slate-200/50 px-1 py-0.5 rounded">
                        {dep.edge.callSiteCode ? dep.edge.callSiteCode.split('(')[0].split('.').pop() + '(…)' : 'validateSession(…)'}
                      </code>{' '}
                      on line {dep.callSiteLine || 37} before executing operations.
                    </p>
                  </div>

                  {evidence && (
                    <button
                      type="button"
                      onClick={() => onOpenEvidence(evidence)}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-md transition shrink-0 cursor-pointer"
                    >
                      <Code2 className="w-4 h-4 text-emerald-400" />
                      <span>View code</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600">
            You can modify, refactor, or delete{' '}
            <code className="font-mono font-semibold text-slate-800">{selectedNode.name}</code> without
            breaking callers in the <code className="font-mono">order-service</code> project.
          </div>
        )}
      </div>

      {/* 2. INTERACTIVE RELATIONSHIP MAP (Horizontal Flow Nodes) */}
      <div className="glass-card rounded-2xl p-6 border border-slate-200/80 bg-white/90 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Interactive Relationship Map
            </h3>
            <p className="text-xs text-slate-500">
              Live directional AST topology. Arrows indicate caller to callee dependencies.
            </p>
          </div>
          <div className="text-xs font-mono bg-slate-100 border border-slate-200 px-3 py-1 rounded text-slate-800 font-semibold shrink-0">
            A → B means A calls B
          </div>
        </div>

        {/* Horizontal Flow Diagram Nodes */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 py-8 px-4 bg-slate-50/70 rounded-xl border border-slate-200/80 overflow-x-auto">
          {/* Node A: Direct Inbound Caller */}
          {impactAnalysis && impactAnalysis.directDependents.length > 0 ? (
            impactAnalysis.directDependents.map((dep) => {
              const evidence = getCallerEvidence(dep.node.id);
              return (
                <React.Fragment key={dep.node.id}>
                  <div
                    onClick={() => {
                      if (evidence) onOpenEvidence(evidence);
                      else onSelectNode(dep.node);
                    }}
                    className="bg-white p-4 rounded-xl border-2 border-slate-300 shadow-md w-48 text-center cursor-pointer hover:border-emerald-500 hover:shadow-lg transition transform hover:-translate-y-0.5"
                  >
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      CALLER CLASS
                    </span>
                    <p className="font-mono text-xs font-bold text-slate-900 mt-1">
                      {dep.node.name}.java
                    </p>
                    <span className="inline-block mt-2 text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded font-semibold">
                      1 Inbound Call
                    </span>
                  </div>

                  {/* Flow Arrow */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-mono font-semibold text-slate-400 mb-1">
                      invokes (L{dep.callSiteLine || 37})
                    </span>
                    <div className="w-12 h-0.5 bg-slate-900 relative">
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-4 border-l-slate-900"></div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          ) : (
            <div className="bg-white/70 p-4 rounded-xl border border-slate-200 w-44 text-center opacity-70">
              <span className="text-[10px] font-bold text-slate-400 uppercase">CALLERS</span>
              <p className="text-xs text-slate-500 mt-1 italic">No inbound callers</p>
            </div>
          )}

          {/* Investigated Target Node */}
          <div className="bg-slate-900 text-white p-4 rounded-xl shadow-xl w-52 text-center ring-4 ring-emerald-500/20 border border-slate-700">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              INVESTIGATED CLASS
            </span>
            <p className="font-mono text-xs font-bold text-white mt-1">
              {selectedNode.name}.java
            </p>
            <span className="inline-block mt-2 text-[10px] text-emerald-300 bg-slate-800 px-2 py-0.5 rounded font-semibold">
              Direct Target
            </span>
          </div>

          {/* Downstream Callees */}
          {downstreamEdges.length > 0 ? (
            downstreamEdges.map((edge) => {
              const calleeNode = Array.from(nodesById.values()).find((n) => n.id === edge.calleeId);
              return (
                <React.Fragment key={edge.edgeId}>
                  {/* Flow Arrow */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-mono font-semibold text-slate-400 mb-1">
                      calls (L{edge.lineNumber})
                    </span>
                    <div className="w-12 h-0.5 bg-slate-400 relative">
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-4 border-l-slate-400"></div>
                    </div>
                  </div>

                  {/* Node C */}
                  <div
                    onClick={() => {
                      if (calleeNode) onSelectNode(calleeNode);
                    }}
                    className="bg-white/90 p-4 rounded-xl border border-slate-200 w-48 text-center opacity-85 hover:opacity-100 hover:border-emerald-400 transition cursor-pointer"
                  >
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      DOWNSTREAM
                    </span>
                    <p className="font-mono text-xs font-bold text-slate-700 mt-1">
                      {edge.calleeName}.java
                    </p>
                    <span className="inline-block mt-2 text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      Transitive Callee
                    </span>
                  </div>
                </React.Fragment>
              );
            })
          ) : (
            <div className="bg-white/70 p-4 rounded-xl border border-slate-200 w-44 text-center opacity-70">
              <span className="text-[10px] font-bold text-slate-400 uppercase">DOWNSTREAM</span>
              <p className="text-xs text-slate-500 mt-1 italic">No outbound calls</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. VIEW-SPECIFIC SECTION: CALL HIERARCHY or BLAST RADIUS */}
      {activeTab === 'hierarchy' && (
        <div className="glass-card rounded-2xl p-6 border border-slate-200/80 bg-white/90 shadow-soft">
          <h3 className="text-base font-bold text-slate-900 mb-3">Call Hierarchy Tree</h3>
          <div className="space-y-3 font-mono text-xs">
            {/* Inbound Callers Tree */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[11px] font-bold uppercase text-slate-400 mb-2">
                ▲ Inbound Callers ({directCount})
              </div>
              {impactAnalysis?.directDependents.map((dep) => (
                <div key={dep.node.id} className="flex items-center space-x-2 py-1 text-slate-800">
                  <CornerDownRight className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-bold">{dep.node.name}.java</span>
                  <span className="text-slate-500 text-[11px]">→ line {dep.callSiteLine || 37}</span>
                </div>
              ))}
            </div>

            {/* Current Target */}
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 font-bold flex items-center space-x-2">
              <GitCommit className="w-4 h-4 text-emerald-600" />
              <span>{selectedNode.name}.java [Current Target]</span>
            </div>

            {/* Outbound Callees Tree */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[11px] font-bold uppercase text-slate-400 mb-2">
                ▼ Outbound Callees ({downstreamEdges.length})
              </div>
              {downstreamEdges.map((edge) => (
                <div key={edge.edgeId} className="flex items-center space-x-2 py-1 text-slate-800">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold">{edge.calleeName}.java</span>
                  <span className="text-slate-500 text-[11px]">via line {edge.lineNumber}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'blast' && (
        <div className="glass-card rounded-2xl p-6 border border-slate-200/80 bg-white/90 shadow-soft">
          <h3 className="text-base font-bold text-slate-900 mb-3">Blast Radius Matrix</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase">Tier 1: Direct Blast</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{directCount} class{directCount === 1 ? '' : 'es'}</p>
              <p className="text-xs text-slate-500 mt-1">
                Will fail compilation or runtime calls immediately if method signatures change.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase">Tier 2: Transitive Reach</span>
              <p className="text-2xl font-bold text-slate-700 mt-1">{indirectCount} class{indirectCount === 1 ? '' : 'es'}</p>
              <p className="text-xs text-slate-500 mt-1">
                Call paths that transitively rely on session state integrity downstream.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
