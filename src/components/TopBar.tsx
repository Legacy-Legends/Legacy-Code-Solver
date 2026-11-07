import React from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Box,
  Network,
  Server,
  GitBranch,
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
    <header className="border-b border-parchment-border bg-white px-4 py-2.5 shadow-soft select-none z-30">
      <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
        {/* Left: Back to Start & Product Title */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onBackToStart}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-parchment-200 hover:text-plum-700 transition"
            title="Return to Start Page"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Start</span>
          </button>

          <div className="h-4 w-[1px] bg-parchment-border hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-plum-700 text-white">
              <GitBranch className="h-3.5 w-3.5" />
            </div>
            <div>
              <span className="font-sans text-sm font-bold tracking-tight text-ink-900 hidden sm:inline">
                Legacy Code Solver
              </span>
            </div>
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-md mx-2">
          <SearchBar
            nodes={nodes}
            selectedNode={selectedNode}
            onSelectNode={(n) => onSelectNode(n)}
          />
        </div>

        {/* Right: Secondary Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Dataset Selector */}
          <div className="hidden md:flex items-center rounded-lg border border-parchment-border bg-parchment-100 p-0.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => onSelectDataSource('sample')}
              className={`rounded-md px-2.5 py-1 transition ${
                dataSource === 'sample'
                  ? 'bg-white text-plum-800 font-bold shadow-sm'
                  : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              Sample
            </button>
            <button
              type="button"
              onClick={() => onSelectDataSource('enterprise')}
              className={`rounded-md px-2.5 py-1 transition ${
                dataSource === 'enterprise'
                  ? 'bg-white text-plum-800 font-bold shadow-sm'
                  : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              Enterprise (40)
            </button>
            <button
              type="button"
              onClick={() => onSelectDataSource('live')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition ${
                dataSource === 'live'
                  ? 'bg-white text-plum-800 font-bold shadow-sm'
                  : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              <Server className="h-3 w-3" />
              Live API {isBackendConnected ? '●' : '○'}
            </button>
          </div>

          {/* 2D Map / 3D Canvas Switcher */}
          <button
            type="button"
            onClick={onToggleViewMode}
            className="flex items-center gap-1.5 rounded-lg border border-parchment-border bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-parchment-100 hover:border-ink-400 transition"
            title={`Switch to ${viewMode === '2d' ? '3D Orbit view' : '2D Map view'}`}
          >
            {viewMode === '2d' ? (
              <>
                <Box className="h-3.5 w-3.5 text-plum-600" />
                <span className="hidden lg:inline">3D</span>
              </>
            ) : (
              <>
                <Network className="h-3.5 w-3.5 text-plum-600" />
                <span className="hidden lg:inline">Map</span>
              </>
            )}
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-lg border border-parchment-border bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-parchment-100 transition"
            title="Reset active class and view"
          >
            <RotateCcw className="h-3.5 w-3.5 text-ink-500" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
};
