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
    <header className="relative z-30 flex flex-wrap sm:flex-nowrap min-h-16 h-16 w-full shrink-0 items-center justify-between gap-4 border-b border-[#E4E2DA] dark:border-slate-800 bg-white/95 dark:bg-[#0D131F]/95 backdrop-blur-sm px-6 sm:px-8 py-2 sm:py-0 select-none shadow-xs transition-colors duration-200">
      {/* 1. Product Name & Return to Start */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        <button
          type="button"
          onClick={onBackToStart}
          className="group flex items-center gap-2.5 rounded-xl py-1 pr-1 text-left text-slate-900 transition cursor-pointer"
          title="Legacy Code Solver — Return to start page"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#3730A3] to-[#4338CA] dark:from-indigo-600 dark:to-indigo-800 text-white shadow-xs group-hover:scale-105 transition-transform">
            <GitFork className="h-4 w-4 text-emerald-400" />
          </div>
          <span className="font-sans text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            Legacy Code Solver
          </span>
        </button>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

        {/* Accessible Segmented Dataset Selector (Supports test automation + keyboard navigation) */}
        <div
          role="group"
          aria-label="Dataset selector"
          className="flex items-center rounded-xl border border-[#DCD9D0] dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800/80 p-1 text-xs font-mono gap-1 shadow-2xs"
        >
          <button
            type="button"
            onClick={() => onSelectDataSource('sample')}
            className={`rounded-lg px-3 py-1.5 transition cursor-pointer font-medium ${
              dataSource === 'sample'
                ? 'bg-white dark:bg-slate-900 text-indigo-950 dark:text-white font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Sample
          </button>
          <button
            type="button"
            onClick={() => onSelectDataSource('enterprise')}
            className={`hidden sm:inline-block rounded-lg px-3 py-1.5 transition cursor-pointer font-medium ${
              dataSource === 'enterprise'
                ? 'bg-white dark:bg-slate-900 text-indigo-950 dark:text-white font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Enterprise
          </button>
          <button
            type="button"
            onClick={() => onSelectDataSource('live')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition cursor-pointer font-medium ${
              dataSource === 'live'
                ? 'bg-white dark:bg-slate-900 text-indigo-950 dark:text-white font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Server className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>FastAPI</span>
            {isBackendConnected && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* 2. Class Search */}
      <div className="order-3 sm:order-2 w-full sm:w-auto sm:flex-1 sm:max-w-lg sm:mx-6">
        <SearchBar
          nodes={nodes}
          selectedNode={selectedNode}
          onSelectNode={(n) => onSelectNode(n)}
        />
      </div>

      {/* 3. Secondary Actions, View Menu & Settings */}
      <div className="order-2 sm:order-3 relative flex items-center gap-2.5 sm:gap-3 shrink-0" ref={viewMenuRef}>
        {/* Toggle 2D / 3D Canvas Segmented Group */}
        <div
          role="group"
          aria-label="Canvas mode"
          className="flex items-center rounded-xl border border-[#DCD9D0] dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800/80 p-1 text-xs font-mono gap-1 shadow-2xs"
        >
          <button
            type="button"
            onClick={() => onToggleViewMode('2d')}
            title="Switch 2D Planar Map / 3D Orbit Canvas"
            className={`rounded-lg px-3 py-1.5 transition cursor-pointer flex items-center gap-1.5 font-medium ${
              viewMode === '2d'
                ? 'bg-white dark:bg-slate-900 text-indigo-950 dark:text-white font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Network className="h-3.5 w-3.5 text-indigo-700 dark:text-indigo-400" />
            <span>2D</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleViewMode('3d')}
            title="Switch 2D Planar Map / 3D Orbit Canvas"
            className={`rounded-lg px-3 py-1.5 transition cursor-pointer flex items-center gap-1.5 font-medium ${
              viewMode === '3d'
                ? 'bg-white dark:bg-slate-900 text-emerald-950 dark:text-emerald-300 font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Box className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>3D</span>
          </button>
        </div>

        {/* View Options Dropdown */}
        <button
          type="button"
          onClick={() => setViewMenuOpen((v) => !v)}
          aria-expanded={viewMenuOpen}
          aria-haspopup="menu"
          className="flex h-9 items-center gap-1.5 rounded-xl border border-[#DCD9D0] dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3.5 font-sans text-xs font-medium text-slate-800 dark:text-slate-200 transition hover:bg-[#FAF9F5] dark:hover:bg-slate-700 shadow-2xs cursor-pointer"
        >
          <span>View</span>
          <ChevronDown className={`h-3.5 w-3.5 text-slate-500 dark:text-slate-400 transition-transform ${viewMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {viewMenuOpen && (
          <div
            role="menu"
            aria-label="View options"
            className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-[#DCD9D0] dark:border-slate-700 bg-white dark:bg-slate-800 p-2 shadow-xl font-sans text-xs text-slate-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onFitGraph();
                setViewMenuOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              <Maximize2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>Fit graph to screen</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onReset();
                setViewMenuOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>Reset view &amp; selection</span>
            </button>

            <div className="my-1.5 h-px bg-slate-200 dark:bg-slate-700" />

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onToggleViewMode('2d');
                setViewMenuOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Network className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span>2D dependency graph</span>
              </span>
              {viewMode === '2d' && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onToggleViewMode('3d');
                setViewMenuOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Box className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span>3D force view</span>
              </span>
              {viewMode === '3d' && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
            </button>

            <div className="my-1.5 h-px bg-slate-200 dark:bg-slate-700" />

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onBackToStart();
                setViewMenuOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <Home className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>Start overview</span>
            </button>
          </div>
        )}

        {/* Accessibility & Settings Button */}
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-[#DCD9D0] dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-[#FAF9F5] dark:hover:bg-slate-700 transition shadow-2xs cursor-pointer"
            title="Open Accessibility & Settings"
          >
            <Sliders className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        )}
      </div>
    </header>
  );
};
