import React from 'react';
import { ArrowRight, GitBranch, Zap } from 'lucide-react';
import { GraphNode, ImpactAnalysis } from '../types/index';

interface InquiryHeroBarProps {
  selectedNode: GraphNode | null;
  impactAnalysis: ImpactAnalysis | null;
  isTracing: boolean;
  onTraceImpact: () => void;
  onSelectNode: (node: GraphNode) => void;
  nodesById: Map<string, GraphNode>;
}

export const InquiryHeroBar: React.FC<InquiryHeroBarProps> = ({
  selectedNode,
  impactAnalysis,
  isTracing,
  onTraceImpact,
  onSelectNode,
  nodesById,
}) => {
  const targetName = selectedNode ? selectedNode.name : 'SessionManager';

  // Sample preset options
  const presets = ['SessionManager', 'AuthTokenValidator', 'CheckoutService', 'AppLogger'];

  return (
    <div className="relative z-20 mx-3 sm:mx-5 mt-2.5 select-none">
      <div className="glass-panel flex flex-col md:flex-row items-start md:items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border border-white/10 shadow-[0_12px_36px_rgba(0,0,0,0.5)]">
        {/* Core Question & Icon */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300">
            <Zap className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
                Core Investigation
              </span>
              {impactAnalysis && impactAnalysis.targetNode.id === selectedNode?.id && (
                <span className="rounded-full bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.2 font-mono text-[9px] font-bold text-cyan-300">
                  {impactAnalysis.totalAffected} {impactAnalysis.totalAffected === 1 ? 'dependent' : 'dependents'} found
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-1.5 font-sans text-sm sm:text-base font-semibold text-slate-100 truncate">
              <span>If I change</span>
              <span className="font-mono text-cyan-300 font-bold bg-cyan-950/40 border border-cyan-500/30 px-1.5 py-0.5 rounded-md">
                {targetName}
              </span>
              <span>what else should I inspect?</span>
            </div>
          </div>
        </div>

        {/* Action Button & Quick Presets */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* Quick presets pills */}
          <div className="hidden lg:flex items-center gap-1 font-mono text-[11px] text-slate-400 mr-2">
            <span className="text-[10px] uppercase text-slate-500 mr-1">Presets:</span>
            {presets.map((name) => {
              const node = Array.from(nodesById.values()).find((n) => n.name === name);
              if (!node) return null;
              const isCurrent = selectedNode?.id === node.id;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onSelectNode(node)}
                  className={`rounded-lg px-2 py-1 transition ${
                    isCurrent
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 font-semibold'
                      : 'bg-slate-900/40 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-white/5'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>

          {/* Primary Action Button: Trace Impact */}
          <button
            type="button"
            onClick={onTraceImpact}
            disabled={isTracing}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition shadow-lg ${
              isTracing
                ? 'bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 cursor-wait'
                : 'bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 hover:from-cyan-300 hover:to-teal-300 hover:shadow-[0_0_24px_rgba(0,245,212,0.4)] active:scale-[0.98]'
            }`}
          >
            <GitBranch className="h-3.5 w-3.5" />
            <span>{isTracing ? 'Tracing Impact...' : 'Trace Impact'}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
