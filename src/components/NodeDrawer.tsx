import React from 'react';
import {
  X,
  FileCode2,
  Activity,
  Cpu,
  FolderGit2,
  ArrowUpRight,
  ArrowDownLeft,
  Code2,
} from 'lucide-react';
import { GraphEdge, GraphNode } from '../types';
import { getHealthVisuals } from '../lib/healthColor';

interface NodeDrawerProps {
  node: GraphNode | null;
  edges: GraphEdge[];
  nodesById: Map<string, GraphNode>;
  onClose: () => void;
  onSelectNode: (node: GraphNode) => void;
}

function resolveNodeId(endpoint: string | GraphNode): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.id;
}

export const NodeDrawer: React.FC<NodeDrawerProps> = ({
  node,
  edges,
  nodesById,
  onClose,
  onSelectNode,
}) => {
  if (!node) return null;

  const visuals = getHealthVisuals(node.health);

  const outgoingEdges = edges.filter((e) => resolveNodeId(e.source) === node.id);
  const incomingEdges = edges.filter((e) => resolveNodeId(e.target) === node.id);

  const complexityPercent = Math.min(100, Math.round((node.complexity / 75) * 100));
  const complexityLabel =
    node.complexity >= 45
      ? 'High Entanglement'
      : node.complexity >= 25
      ? 'Moderate Complexity'
      : 'Clean & Modular';

  return (
    <aside
      aria-label="Node Details Inspector"
      className="fixed right-0 top-0 z-30 flex h-full w-[368px] flex-col border-l border-slate-800/90 bg-[#070c18]/95 shadow-[-16px_0_48px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-transform duration-300"
    >
      {/* Top Accent Bar */}
      <div
        className="h-1 w-full"
        style={{
          backgroundColor: visuals.coreColor,
          boxShadow: `0 0 16px ${visuals.auraColor}`,
        }}
      />

      {/* Drawer Header */}
      <div className="flex items-start justify-between border-b border-slate-800/80 px-5 py-4">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-400/90">
              Node Inspector
            </span>
            <span className="font-mono text-[10px] text-slate-500">#{node.id}</span>
          </div>
          <h2 className="mt-1 truncate font-mono text-lg font-bold tracking-tight text-slate-100">
            {node.name}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close details drawer"
          className="rounded-lg border border-slate-800 bg-slate-900/70 p-1.5 text-slate-400 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {/* Cluster Badge */}
        <div className="rounded-lg border border-slate-800/80 bg-slate-900/45 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-400">
              <FolderGit2 className="h-3.5 w-3.5 text-teal-400" />
              Cluster
            </span>
            <span className="font-mono font-medium text-slate-200">{node.clusterName}</span>
          </div>
        </div>

        {/* File Path */}
        <div>
          <label className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
            <FileCode2 className="h-3.5 w-3.5 text-teal-400" />
            Source File Path
          </label>
          <div className="mt-1.5 break-all rounded-lg border border-slate-800/90 bg-[#040710] px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-300">
            {node.path}
          </div>
        </div>

        {/* Primary Metrics: Health & Complexity */}
        <div className="grid grid-cols-1 gap-3.5">
          {/* Health Card */}
          <div className="rounded-xl border border-slate-800/90 bg-slate-900/50 p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                <Activity className="h-3.5 w-3.5 text-teal-400" />
                Code Health
              </span>
              <span
                className={`rounded border px-2 py-0.5 font-mono text-[10px] font-medium uppercase ${visuals.badgeClass}`}
              >
                {visuals.label}
              </span>
            </div>

            <div className="mt-2.5 flex items-baseline justify-between font-mono">
              <div className="flex items-baseline gap-1">
                <span
                  className="text-3xl font-bold"
                  style={{ color: visuals.coreColor }}
                >
                  {node.health}
                </span>
                <span className="text-xs text-slate-500">/ 100</span>
              </div>
              <span className="text-[11px] text-slate-400">
                {node.health >= 70
                  ? 'High saturation teal glow'
                  : node.health >= 40
                  ? 'Transitional amber-teal'
                  : 'Dim amber legacy state'}
              </span>
            </div>

            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-950 p-0.5 ring-1 ring-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${visuals.barColor}`}
                style={{ width: `${node.health}%` }}
              />
            </div>
          </div>

          {/* Complexity Card */}
          <div className="rounded-xl border border-slate-800/90 bg-slate-900/50 p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                <Cpu className="h-3.5 w-3.5 text-amber-400/90" />
                Cyclomatic Complexity
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {complexityLabel}
              </span>
            </div>

            <div className="mt-2.5 flex items-baseline justify-between font-mono">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-100">
                  {node.complexity}
                </span>
                <span className="text-xs text-slate-500">branches</span>
              </div>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Code2 className="h-3.5 w-3.5 text-slate-500" />
                {node.loc} LOC
              </span>
            </div>

            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-950 ring-1 ring-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-400 via-amber-400/80 to-amber-600/90 transition-all duration-500"
                style={{ width: `${complexityPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Connected Edges Summary */}
        <div className="space-y-3 border-t border-slate-800/80 pt-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              Coupling &amp; Dependencies
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              { outgoingEdges.length + incomingEdges.length } active links
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] uppercase text-slate-400">
                <ArrowUpRight className="h-3.5 w-3.5 text-teal-400" />
                Outgoing
              </div>
              <div className="mt-0.5 text-base font-semibold text-slate-200">
                {outgoingEdges.length}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2">
              <div className="flex items-center gap-1 text-[10px] uppercase text-slate-400">
                <ArrowDownLeft className="h-3.5 w-3.5 text-amber-400/90" />
                Incoming
              </div>
              <div className="mt-0.5 text-base font-semibold text-slate-200">
                {incomingEdges.length}
              </div>
            </div>
          </div>

          {/* Connected Node List */}
          <div className="space-y-1.5 pt-1">
            {outgoingEdges.slice(0, 5).map((edge) => {
              const targetId = resolveNodeId(edge.target);
              const targetNode = nodesById.get(targetId);
              if (!targetNode) return null;
              const targetVisuals = getHealthVisuals(targetNode.health);
              return (
                <button
                  key={edge.id}
                  type="button"
                  onClick={() => onSelectNode(targetNode)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-800/70 bg-slate-900/35 px-2.5 py-1.5 text-left transition-colors hover:border-teal-500/40 hover:bg-slate-800/60"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: targetVisuals.coreColor }}
                    />
                    <span className="truncate font-mono text-xs text-slate-200">
                      {targetNode.name}
                    </span>
                  </div>
                  <span className="ml-2 shrink-0 rounded bg-slate-800/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                    {edge.type} →
                  </span>
                </button>
              );
            })}
            {incomingEdges.slice(0, 4).map((edge) => {
              const sourceId = resolveNodeId(edge.source);
              const sourceNode = nodesById.get(sourceId);
              if (!sourceNode) return null;
              const sourceVisuals = getHealthVisuals(sourceNode.health);
              return (
                <button
                  key={edge.id}
                  type="button"
                  onClick={() => onSelectNode(sourceNode)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-800/70 bg-slate-900/35 px-2.5 py-1.5 text-left transition-colors hover:border-teal-500/40 hover:bg-slate-800/60"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: sourceVisuals.coreColor }}
                    />
                    <span className="truncate font-mono text-xs text-slate-200">
                      {sourceNode.name}
                    </span>
                  </div>
                  <span className="ml-2 shrink-0 rounded bg-slate-800/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                    ← {edge.type}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};
