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
      {/* 1. Product Name & Project Selector */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          type="button"
          onClick={onBackToStart}
          className="flex items-center gap-1.5 sm:gap-2 rounded-lg py-1 pr-1 text-left text-slate-900 transition hover:text-indigo-800 cursor-pointer"
          title="Legacy Code Solver — Return to start page"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3730A3] text-white">
            <GitFork className="h-3.5 w-3.5" />
          </div>
          <span className="font-sans text-xs sm:text-sm font-semibold tracking-tight text-slate-900">
            Legacy Code Solver
          </span>
        </button>

        <div className="h-4 w-px bg-[#E4E2DA] hidden sm:block" />

        {/* Project Selector */}
        <div className="flex items-center">
          <label htmlFor="project-selector" className="sr-only">
            Project dataset
          </label>
          <div className="relative flex items-center">
            <select
              id="project-selector"
              aria-label="Project selector"
              value={dataSource}
              onChange={(e) => onSelectDataSource(e.target.value as DataSourceMode)}
              className="h-8 max-w-[104px] sm:max-w-none appearance-none rounded-lg border border-[#DCD9D0] bg-[#FAF9F5] pl-2 sm:pl-3 pr-5 sm:pr-7 font-sans text-xs font-medium text-slate-800 transition hover:border-slate-400 focus:border-indigo-700 focus:bg-white focus:outline-none cursor-pointer truncate"
            >
              <option value="sample">Sample: order-service</option>
              <option value="enterprise">Enterprise: acme-legacy (40)</option>
              <option value="live">
                Live: FastAPI {isBackendConnected ? '(connected)' : '(offline)'}
              </option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-500" />
          </div>
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

      {/* 3. Secondary Actions in a Clearly Labeled View Menu */}
      <div className="order-2 sm:order-3 relative flex items-center gap-1.5 shrink-0" ref={viewMenuRef}>
        <button
          type="button"
          onClick={() => setViewMenuOpen((v) => !v)}
          aria-expanded={viewMenuOpen}
          aria-haspopup="menu"
          className="flex h-8 items-center gap-1 rounded-lg border border-[#DCD9D0] bg-white px-2.5 sm:px-3 font-sans text-xs font-medium text-slate-800 transition hover:bg-[#FAF9F5] cursor-pointer"
        >
          <span>View</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
        </button>

        {viewMenuOpen && (
          <div
            role="menu"
            aria-label="View options"
            className="absolute right-0 top-full z-50 mt-1.5 w-52 rounded-xl border border-[#DCD9D0] bg-white p-1.5 shadow-lg font-sans text-xs text-slate-800"
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
      </div>
    </header>
  );
};
