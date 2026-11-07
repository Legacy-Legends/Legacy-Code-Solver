import React from 'react';
import { GitBranch, RotateCcw, Box, Network, Server, CheckCircle2, AlertCircle } from 'lucide-react';
import { GraphNode, DataSourceMode } from '../types/index';
import { SearchBar } from './SearchBar';

interface TopBarProps {
  nodes: GraphNode[];
  selectedNode: GraphNode | null;
  onSelectNode: (node: GraphNode | null) => void;
  onReset: () => void;
  dataSource: DataSourceMode;
  onSelectDataSource: (mode: DataSourceMode) => void;
  isBackendConnected: boolean;
  viewMode: '3d' | '2d';
  onToggleViewMode: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  nodes,
  selectedNode,
  onSelectNode,
  onReset,
  dataSource,
  onSelectDataSource,
  isBackendConnected,
  viewMode,
  onToggleViewMode,
}) => {
  const projectLabel =
    dataSource === 'sample'
      ? 'order-service'
      : dataSource === 'enterprise'
      ? 'acme-legacy-core'
      : 'live-repository';

  const sourceBadge =
    dataSource === 'sample'
      ? { label: 'Sample project (Verified fixture)', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/30' }
      : dataSource === 'enterprise'
      ? { label: 'Enterprise mock (40 classes)', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/30' }
      : isBackendConnected
      ? { label: 'Live Backend (FastAPI :8000)', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/30' }
      : { label: 'Live Backend (Offline :8000)', color: 'text-rose-400 border-rose-500/30 bg-rose-950/30' };

  return (
    <header className="relative z-30 flex h-13 w-full items-center justify-between border-b border-slate-800 bg-[#080d1a] px-4 py-2 select-none">
      {/* Left: Product Name & Project */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6.5 w-6.5 items-center justify-center rounded border border-cyan-500/40 bg-cyan-500/10 text-cyan-400">
            <GitBranch className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold tracking-tight text-slate-100">
                Legacy Code Solver
              </span>
              <span className="rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.2 font-mono text-[10px] text-slate-300">
                {projectLabel}
              </span>
            </div>
            <div className="hidden font-mono text-[9px] text-slate-400 sm:block">
              Static Impact &amp; Dependency Investigation
            </div>
          </div>
        </div>

        {/* Honest Data Source Tag */}
        <div className={`hidden items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] md:flex ${sourceBadge.color}`}>
          {dataSource === 'live' ? (
            isBackendConnected ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            ) : (
              <AlertCircle className="h-3 w-3 text-rose-400" />
            )
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          )}
          {sourceBadge.label}
        </div>
      </div>

      {/* Middle: Search Bar */}
      <div className="mx-4 flex-1 max-w-sm sm:max-w-md">
        <SearchBar
          nodes={nodes}
          selectedNode={selectedNode}
          onSelectNode={(n) => onSelectNode(n)}
        />
      </div>

      {/* Right: Mode Controls & Reset */}
      <div className="flex items-center gap-2">
        {/* Dataset Switcher Dropdown */}
        <div className="hidden sm:flex items-center rounded-lg border border-slate-800 bg-slate-900/80 p-0.5 text-[11px] font-mono">
          <button
            type="button"
            onClick={() => onSelectDataSource('sample')}
            className={`rounded px-2 py-1 transition ${
              dataSource === 'sample'
                ? 'bg-slate-800 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Sample acceptance test project: CheckoutService, SessionManager, AuthTokenValidator, AppLogger"
          >
            Sample
          </button>
          <button
            type="button"
            onClick={() => onSelectDataSource('enterprise')}
            className={`rounded px-2 py-1 transition ${
              dataSource === 'enterprise'
                ? 'bg-slate-800 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="40-node enterprise legacy mock"
          >
            Enterprise
          </button>
          <button
            type="button"
            onClick={() => onSelectDataSource('live')}
            className={`flex items-center gap-1 rounded px-2 py-1 transition ${
              dataSource === 'live'
                ? 'bg-slate-800 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Connect to FastAPI backend at http://localhost:8000"
          >
            <Server className="h-2.5 w-2.5" />
            Live API
          </button>
        </div>

        {/* 2D / 3D Canvas Switcher */}
        <button
          type="button"
          onClick={onToggleViewMode}
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 font-mono text-[11px] text-slate-300 transition hover:border-slate-700 hover:bg-slate-800"
          title={`Switch to ${viewMode === '3d' ? '2D Planar topological' : '3D Orbit'} view`}
        >
          {viewMode === '3d' ? (
            <>
              <Network className="h-3 w-3 text-cyan-400" />
              <span className="hidden sm:inline">2D View</span>
            </>
          ) : (
            <>
              <Box className="h-3 w-3 text-cyan-400" />
              <span className="hidden sm:inline">3D View</span>
            </>
          )}
        </button>

        {/* Reset View Action */}
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 font-mono text-[11px] text-slate-300 transition hover:border-slate-700 hover:bg-slate-800 hover:text-slate-100"
          title="Reset selection, trace, and camera position"
        >
          <RotateCcw className="h-3 w-3 text-slate-400" />
          <span className="hidden sm:inline">Reset view</span>
        </button>
      </div>
    </header>
  );
};
