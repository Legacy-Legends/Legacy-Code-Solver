import React, { useState, useRef, useEffect } from 'react';
import {
  GitFork,
  ChevronDown,
  RotateCcw,
  Maximize2,
  Box,
  Network,
  Check,
  Home,
  Sliders,
  Server,
} from 'lucide-react';
import { GraphNode, DataSourceMode } from '../types/index';
import { SearchBar } from './SearchBar';

interface TopBarProps {
  nodes: GraphNode[];
  selectedNode: GraphNode | null;
  onSelectNode: (node: GraphNode | null) => void;
  onReset: () => void;
  onFitGraph: () => void;
  dataSource: DataSourceMode;
  onSelectDataSource: (mode: DataSourceMode) => void;
  isBackendConnected: boolean;
  viewMode: '3d' | '2d';
  onToggleViewMode: (mode?: '2d' | '3d') => void;
  onBackToStart: () => void;
  onOpenSettings?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  nodes,
  selectedNode,
  onSelectNode,
  onReset,
  onFitGraph,
  dataSource,
  onSelectDataSource,
  isBackendConnected,
  viewMode,
  onToggleViewMode,
  onBackToStart,
  onOpenSettings,
}) => {
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setViewMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="relative z-30 flex flex-wrap sm:flex-nowrap min-h-13 w-full shrink-0 items-center justify-between gap-2 sm:gap-3 border-b border-[#E4E2DA] bg-white px-3 sm:px-4 py-2 sm:py-0 select-none">
      {/* 1. Product Name & Return to Start */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          type="button"
          onClick={onBackToStart}
          className="flex items-center gap-1.5 sm:gap-2 rounded-lg py-1 pr-1 text-left text-slate-900 transition hover:text-indigo-800 cursor-pointer"
          title="Legacy Code Solver — Return to start page"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3730A3] text-white shadow-2xs">
            <GitFork className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <span className="font-sans text-xs sm:text-sm font-semibold tracking-tight text-slate-900">
            Legacy Code Solver
          </span>
        </button>

        <div className="h-4 w-px bg-[#E4E2DA] hidden sm:block" />

        {/* Accessible Segmented Dataset Selector (Supports test automation + keyboard navigation) */}
        <div
          role="group"
          aria-label="Dataset selector"
          className="flex items-center rounded-lg border border-[#DCD9D0] bg-[#FAF9F5] p-0.5 text-xs font-mono"
        >
          <button
            type="button"
            onClick={() => onSelectDataSource('sample')}
            className={`rounded-md px-2.5 py-1 transition cursor-pointer ${
              dataSource === 'sample'
                ? 'bg-white text-indigo-950 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sample
          </button>
          <button
            type="button"
            onClick={() => onSelectDataSource('enterprise')}
            className={`hidden sm:inline-block rounded-md px-2.5 py-1 transition cursor-pointer ${
              dataSource === 'enterprise'
                ? 'bg-white text-indigo-950 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Enterprise
          </button>
          <button
            type="button"
            onClick={() => onSelectDataSource('live')}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition cursor-pointer ${
              dataSource === 'live'
                ? 'bg-white text-indigo-950 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="h-3 w-3 text-emerald-600" />
            <span>FastAPI</span>
            {isBackendConnected && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* 2. Class Search */}
      <div className="order-3 sm:order-2 w-full sm:w-auto sm:flex-1 sm:max-w-md sm:mx-auto">
        <SearchBar
          nodes={nodes}
          selectedNode={selectedNode}
          onSelectNode={(n) => onSelectNode(n)}
        />
      </div>

      {/* 3. Secondary Actions, View Menu & Settings */}
      <div className="order-2 sm:order-3 relative flex items-center gap-1.5 shrink-0" ref={viewMenuRef}>
        {/* Toggle 2D / 3D Canvas Segmented Group */}
        <div
          role="group"
          aria-label="Canvas mode"
          className="flex items-center rounded-lg border border-[#DCD9D0] bg-[#FAF9F5] p-0.5 text-xs font-mono"
        >
          <button
            type="button"
            onClick={() => onToggleViewMode('2d')}
            title="Switch 2D Planar Map / 3D Orbit Canvas"
            className={`rounded-md px-2.5 py-1 transition cursor-pointer flex items-center gap-1 ${
              viewMode === '2d'
                ? 'bg-white text-indigo-950 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Network className="h-3 w-3 text-indigo-700" />
            <span>2D</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleViewMode('3d')}
            title="Switch 2D Planar Map / 3D Orbit Canvas"
            className={`rounded-md px-2.5 py-1 transition cursor-pointer flex items-center gap-1 ${
              viewMode === '3d'
                ? 'bg-white text-emerald-950 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Box className="h-3 w-3 text-emerald-600" />
            <span>3D</span>
          </button>
        </div>

        {/* View Options Dropdown */}
        <button
          type="button"
          onClick={() => setViewMenuOpen((v) => !v)}
          aria-expanded={viewMenuOpen}
          aria-haspopup="menu"
          className="flex h-8 items-center gap-1 rounded-lg border border-[#DCD9D0] bg-white px-2.5 sm:px-3 font-sans text-xs font-medium text-slate-800 transition hover:bg-[#FAF9F5] shadow-2xs cursor-pointer"
        >
          <span>View</span>
          <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${viewMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {viewMenuOpen && (
          <div
            role="menu"
            aria-label="View options"
            className="absolute right-0 top-full z-50 mt-1.5 w-52 rounded-xl border border-[#DCD9D0] bg-white p-1.5 shadow-lg font-sans text-xs text-slate-800 animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onFitGraph();
                setViewMenuOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-100 cursor-pointer"
            >
              <Maximize2 className="h-3.5 w-3.5 text-slate-500" />
              <span>Fit graph to screen</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onReset();
                setViewMenuOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-100 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>Reset view &amp; selection</span>
            </button>

            <div className="my-1 h-px bg-slate-200" />

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onToggleViewMode('2d');
                setViewMenuOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-100 cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Network className="h-3.5 w-3.5 text-slate-500" />
                <span>2D dependency graph</span>
              </span>
              {viewMode === '2d' && <Check className="h-3.5 w-3.5 text-indigo-700" />}
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onToggleViewMode('3d');
                setViewMenuOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-100 cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Box className="h-3.5 w-3.5 text-slate-500" />
                <span>3D force view</span>
              </span>
              {viewMode === '3d' && <Check className="h-3.5 w-3.5 text-indigo-700" />}
            </button>

            <div className="my-1 h-px bg-slate-200" />

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onBackToStart();
                setViewMenuOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
            >
              <Home className="h-3.5 w-3.5 text-slate-500" />
              <span>Start overview</span>
            </button>
          </div>
        )}

        {/* Accessibility & Settings Button */}
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-[#DCD9D0] bg-white px-2.5 sm:px-3 text-xs text-slate-700 hover:bg-[#FAF9F5] transition shadow-2xs cursor-pointer"
            title="Open Accessibility & Settings"
          >
            <Sliders className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline font-medium">Settings</span>
          </button>
        )}
      </div>
    </header>
  );
};
