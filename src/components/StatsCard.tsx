import React from 'react';
import { Activity, Share2, GitCommit, Layers } from 'lucide-react';
import { getHealthVisuals } from '../lib/healthColor';

interface StatsCardProps {
  overallHealth: number;
  nodeCount: number;
  edgeCount: number;
  clusterCount: number;
  healthyCount: number;
  moderateCount: number;
  sickCount: number;
  isDrawerOpen: boolean;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  overallHealth,
  nodeCount,
  edgeCount,
  clusterCount,
  healthyCount,
  moderateCount,
  sickCount,
  isDrawerOpen,
}) => {
  const visuals = getHealthVisuals(overallHealth);

  return (
    <aside
      aria-label="System Telemetry Stats"
      className={`fixed top-5 z-20 w-80 rounded-xl border border-slate-800/90 bg-[#080d1a]/90 p-4 shadow-[0_0_40px_rgba(0,0,0,0.75)] backdrop-blur-md transition-all duration-300 ${
        isDrawerOpen ? 'right-[388px]' : 'right-5'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
          </span>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
            System Telemetry
          </span>
        </div>
        <span
          className={`rounded border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${visuals.badgeClass}`}
        >
          {visuals.label}
        </span>
      </div>

      {/* Overall Health Hero Metric */}
      <div className="mt-3.5">
        <div className="flex items-baseline justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <Activity className="h-3.5 w-3.5 text-teal-400" />
            Overall Code Health
          </span>
          <div className="flex items-baseline gap-1 font-mono">
            <span className={`text-2xl font-bold tracking-tight ${visuals.textColor}`}>
              {overallHealth}
            </span>
            <span className="text-xs text-slate-500">/ 100</span>
          </div>
        </div>

        {/* Health Bar */}
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-900/90 p-0.5 ring-1 ring-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${visuals.barColor}`}
            style={{ width: `${overallHealth}%` }}
          />
        </div>

        {/* Distribution Pills */}
        <div className="mt-2.5 grid grid-cols-3 gap-1.5 font-mono text-[10px]">
          <div className="flex items-center justify-between rounded bg-emerald-950/35 px-2 py-1 border border-emerald-500/20">
            <span className="flex items-center gap-1 text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00f5d4] shadow-[0_0_6px_#00f5d4]" />
              Healthy
            </span>
            <span className="font-semibold text-emerald-200">{healthyCount}</span>
          </div>
          <div className="flex items-center justify-between rounded bg-teal-950/30 px-2 py-1 border border-teal-500/20">
            <span className="flex items-center gap-1 text-teal-200/90">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2dd4bf]" />
              Mod
            </span>
            <span className="font-semibold text-teal-100">{moderateCount}</span>
          </div>
          <div className="flex items-center justify-between rounded bg-amber-950/30 px-2 py-1 border border-amber-700/30">
            <span className="flex items-center gap-1 text-amber-300/80">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9a6e34]" />
              Sick
            </span>
            <span className="font-semibold text-amber-200/90">{sickCount}</span>
          </div>
        </div>
      </div>

      {/* Node & Edge Counts */}
      <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-3">
        <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 px-2.5 py-2">
          <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
            <GitCommit className="h-3 w-3 text-teal-400" />
            Nodes
          </div>
          <div className="mt-0.5 font-mono text-lg font-semibold text-slate-100">
            {nodeCount}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 px-2.5 py-2">
          <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
            <Share2 className="h-3 w-3 text-teal-400" />
            Edges
          </div>
          <div className="mt-0.5 font-mono text-lg font-semibold text-slate-100">
            {edgeCount}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 px-2.5 py-2">
          <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
            <Layers className="h-3 w-3 text-teal-400" />
            Clusters
          </div>
          <div className="mt-0.5 font-mono text-lg font-semibold text-slate-100">
            {clusterCount}
          </div>
        </div>
      </div>
    </aside>
  );
};
