import React from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Server,
  Layers,
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
  onBackToStart: () => void;
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
  onBackToStart,
}) => {
  return (
    <header className="h-14 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between select-none z-30 shrink-0">
      {/* Left: {dataSource === 'live' ? (isBackendConnected ? 'Backend graph' : 'Backend disconnected') : 'Sample graph'} status & Target Package Path */}
      <div className="flex items-center space-x-4 min-w-0">
        <button
          type="button"
          onClick={onBackToStart}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 transition cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Change Target</span>
        </button>

        <div className="h-4 w-px bg-slate-200 hidden sm:block shrink-0" />

        <div className="flex items-center space-x-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            {dataSource === 'live' ? (isBackendConnected ? 'Backend graph' : 'Backend disconnected') : 'Sample graph'}
          </span>
        </div>

        {selectedNode && (
          <span className="text-xs text-slate-400 font-mono truncate hidden md:inline">
            {selectedNode.path}
          </span>
        )}
      </div>

      {/* Center: Search Bar */}
      <div className="hidden lg:block w-72 mx-4">
        <SearchBar
          nodes={nodes}
          selectedNode={selectedNode}
          onSelectNode={(n) => onSelectNode(n)}
        />
      </div>

      {/* Right: Controls & Datasets */}
      <div className="flex items-center space-x-3 shrink-0">
        {/* Dataset Switcher */}
        <div className="hidden sm:flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => onSelectDataSource('sample')}
            className={`rounded-md px-2.5 py-1 transition cursor-pointer ${
              dataSource === 'sample'
                ? 'bg-white text-slate-900 font-bold shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Sample
          </button>
          <button
            type="button"
            onClick={() => onSelectDataSource('enterprise')}
            className={`rounded-md px-2.5 py-1 transition cursor-pointer ${
              dataSource === 'enterprise'
                ? 'bg-white text-slate-900 font-bold shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Enterprise (40)
          </button>
          <button
            type="button"
            onClick={() => onSelectDataSource('live')}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition cursor-pointer ${
              dataSource === 'live'
                ? 'bg-white text-slate-900 font-bold shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Server className="h-3 w-3 text-emerald-600" />
            <span>FastAPI</span>
            {isBackendConnected && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            )}
          </button>
        </div>

        {/* 2D / 3D Canvas Switch */}
        <button
          type="button"
          onClick={onToggleViewMode}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-mono text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
          title="Switch 2D Planar Map / 3D Orbit Canvas"
        >
          <Layers className="h-3.5 w-3.5 text-emerald-600" />
          <span className="font-semibold">{viewMode.toUpperCase()}</span>
        </button>

        {/* Reset Selection */}
        {selectedNode && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
            title="Clear active node filter"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </header>
  );
};
