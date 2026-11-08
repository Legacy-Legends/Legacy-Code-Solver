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
} from 'lucide-react';
import { GraphNode } from '../types/index';
import { SearchBar } from './SearchBar';

interface TopBarProps {
  nodes: GraphNode[];
  selectedNode: GraphNode | null;
  onSelectNode: (node: GraphNode | null) => void;
  onReset: () => void;
  onFitGraph: () => void;
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
    <header className="relative z-30 flex flex-wrap sm:flex-nowrap min-h-16 sm:h-16 w-full shrink-0 items-center justify-between gap-4 border-b border-white/60 dark:border-white/10 bg-white/70 dark:bg-slate-900/65 backdrop-blur-xl backdrop-saturate-150 px-6 sm:px-8 py-2 sm:py-0 select-none shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] transition-colors duration-200">
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        <button
          type="button"
          onClick={onBackToStart}
          className="group flex items-center gap-2.5 rounded-xl py-1 pr-1 text-left text-slate-900 transition cursor-pointer"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#3730A3] to-[#4338CA] dark:from-indigo-600 dark:to-indigo-800 text-white shadow-sm ring-1 ring-white/20 group-hover:scale-105 transition-transform">
            <GitFork className="h-4 w-4 text-emerald-400" />
          </div>
          <span className="font-sans text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            Legacy Code Solver
          </span>
        </button>
      </div>

      <div className="order-3 sm:order-2 w-full sm:w-auto sm:flex-1 sm:max-w-lg sm:mx-6">
        <SearchBar
          nodes={nodes}
          selectedNode={selectedNode}
          onSelectNode={(n) => onSelectNode(n)}
        />
      </div>

      <div className="order-2 sm:order-3 relative flex items-center gap-2.5 sm:gap-3 shrink-0" ref={viewMenuRef}>
        <div className="glass-pill flex items-center rounded-xl p-1 text-xs font-mono gap-1 shadow-inner">
          <button
            type="button"
            onClick={() => onToggleViewMode('2d')}
            className={`rounded-lg px-3 py-1.5 transition cursor-pointer flex items-center gap-1.5 font-medium ${
              viewMode === '2d'
                ? 'bg-white/90 dark:bg-slate-800/90 text-indigo-950 dark:text-white font-bold shadow-xs ring-1 ring-black/5 dark:ring-white/10 backdrop-blur-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Network className="h-3.5 w-3.5 text-indigo-700 dark:text-indigo-400" />
            <span>2D</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleViewMode('3d')}
            className={`rounded-lg px-3 py-1.5 transition cursor-pointer flex items-center gap-1.5 font-medium ${
              viewMode === '3d'
                ? 'bg-white/90 dark:bg-slate-800/90 text-emerald-950 dark:text-emerald-300 font-bold shadow-xs ring-1 ring-black/5 dark:ring-white/10 backdrop-blur-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Box className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>3D</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setViewMenuOpen((v) => !v)}
          className="glass-pill flex h-9 items-center gap-1.5 rounded-xl px-3.5 font-sans text-xs font-medium text-slate-800 dark:text-slate-200 transition hover:bg-white/80 dark:hover:bg-slate-800/80 shadow-xs cursor-pointer"
        >
          <span>View</span>
          <ChevronDown className={`h-3.5 w-3.5 text-slate-500 dark:text-slate-400 transition-transform ${viewMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {viewMenuOpen && (
          <div className="glass-card absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl p-2 font-sans text-xs text-slate-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100">
            <button onClick={() => { onFitGraph(); setViewMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer">
              <Maximize2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>Fit graph to screen</span>
            </button>
            <button onClick={() => { onReset(); setViewMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer">
              <RotateCcw className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>Reset view &amp; selection</span>
            </button>
            <div className="my-1.5 h-px bg-slate-200/70 dark:bg-white/10" />
            <button onClick={() => { onToggleViewMode('2d'); setViewMenuOpen(false); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer">
              <span className="flex items-center gap-2.5"><Network className="h-4 w-4 text-slate-500" /><span>2D dependency graph</span></span>
              {viewMode === '2d' && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
            </button>
            <button onClick={() => { onToggleViewMode('3d'); setViewMenuOpen(false); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer">
              <span className="flex items-center gap-2.5"><Box className="h-4 w-4 text-slate-500" /><span>3D force view</span></span>
              {viewMode === '3d' && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
            </button>
            <div className="my-1.5 h-px bg-slate-200/70 dark:bg-white/10" />
            <button onClick={() => { onBackToStart(); setViewMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-slate-600 dark:text-slate-300 transition hover:bg-slate-900/5 hover:text-slate-900 cursor-pointer">
              <Home className="h-4 w-4 text-slate-500" /><span>Start overview</span>
            </button>
          </div>
        )}

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="glass-pill flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/80 transition shadow-xs cursor-pointer"
          >
            <Sliders className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        )}
      </div>
    </header>
  );
};