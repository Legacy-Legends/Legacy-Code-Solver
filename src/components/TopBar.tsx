import React from 'react';
import {
  RotateCcw,
  Box,
  Network,
  Server,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
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
      ? { label: 'Sample Project', status: 'verified', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40' }
      : dataSource === 'enterprise'
      ? { label: 'Enterprise Mock (40 classes)', status: 'cached', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/40' }
      : isBackendConnected
      ? { label: 'FastAPI Live (:8000)', status: 'connected', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40' }
      : { label: 'FastAPI Offline (:8000)', status: 'offline', color: 'text-rose-400 border-rose-500/30 bg-rose-950/40' };

  return (
    <header className="relative z-30 mx-3 sm:mx-5 mt-3 select-none">
      <div className="glass-pill flex h-14 w-full items-center justify-between px-3 sm:px-4 py-2 rounded-2xl">
        {/* Left: Product Glyph & Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-sky-500/10 border border-cyan-400/30 text-cyan-300 shadow-[0_0_15px_rgba(0,245,212,0.15)]">
            <Sparkles className="h-4 w-4" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-sans text-sm font-bold tracking-tight text-slate-100">
                Legacy Code Solver
              </span>
              <span className="rounded-full border border-slate-700/80 bg-slate-800/60 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                {projectLabel}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse-subtle" />
              <span>Static Dependency Investigation</span>
              <span className="text-slate-600">·</span>
              <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.2 text-[9px] ${sourceBadge.color}`}>
                {dataSource === 'live' ? (
                  isBackendConnected ? (
                    <CheckCircle2 className="h-2.5 w-2.5" />
                  ) : (
                    <AlertCircle className="h-2.5 w-2.5" />
                  )
                ) : null}
                {sourceBadge.label}
              </span>
            </div>
          </div>
        </div>

        {/* Middle: Integrated Search Bar */}
        <div className="mx-2 sm:mx-4 flex-1 max-w-xs sm:max-w-md">
          <SearchBar
            nodes={nodes}
            selectedNode={selectedNode}
            onSelectNode={(n) => onSelectNode(n)}
          />
        </div>

        {/* Right: View & Data Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Dataset Switcher Segmented Control */}
          <div className="hidden md:flex items-center rounded-xl border border-white/5 bg-slate-900/60 p-0.5 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => onSelectDataSource('sample')}
              className={`rounded-lg px-2.5 py-1 transition ${
                dataSource === 'sample'
                  ? 'bg-slate-800/90 text-cyan-300 shadow-sm border border-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Verified sample fixture: SessionManager, CheckoutService, AuthTokenValidator, AppLogger"
            >
              Sample
            </button>
            <button
              type="button"
              onClick={() => onSelectDataSource('enterprise')}
              className={`rounded-lg px-2.5 py-1 transition ${
                dataSource === 'enterprise'
                  ? 'bg-slate-800/90 text-cyan-300 shadow-sm border border-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="40-node enterprise mock dataset"
            >
              Enterprise
            </button>
            <button
              type="button"
              onClick={() => onSelectDataSource('live')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
                dataSource === 'live'
                  ? 'bg-slate-800/90 text-cyan-300 shadow-sm border border-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Connect to live FastAPI backend at http://localhost:8000"
            >
              <Server className="h-3 w-3" />
              Live API
            </button>
          </div>

          {/* 2D / 3D Canvas Switcher */}
          <button
            type="button"
            onClick={onToggleViewMode}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-1.5 font-mono text-xs text-slate-300 transition hover:bg-slate-800 hover:text-cyan-200 hover:border-cyan-400/30"
            title={`Switch to ${viewMode === '2d' ? '3D Orbit view' : '2D Topological Flow'}`}
          >
            {viewMode === '2d' ? (
              <>
                <Box className="h-3.5 w-3.5 text-cyan-400" />
                <span className="hidden lg:inline">3D View</span>
              </>
            ) : (
              <>
                <Network className="h-3.5 w-3.5 text-cyan-400" />
                <span className="hidden lg:inline">2D Map</span>
              </>
            )}
          </button>

          {/* Reset Action */}
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/60 px-2.5 py-1.5 font-mono text-xs text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
            title="Reset selection, trace path, and view"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
            <span className="hidden xl:inline">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
};
