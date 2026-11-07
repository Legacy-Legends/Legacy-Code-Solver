import React, { useState, useEffect, useRef } from 'react';
import {
  GitFork,
  Box,
  Search,
  GitCommit,
  FileCode,
  Info,
  CheckCircle,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import { GraphNode } from '../types/index';

interface StartPageProps {
  nodes: GraphNode[];
  onInvestigate: (className: string) => void;
  onOpenWorkspace: () => void;
}

export const StartPage: React.FC<StartPageProps> = ({
  nodes,
  onInvestigate,
  onOpenWorkspace,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts: ⌘K or / to focus search, Enter to trigger featured audit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Enter' && !isSearchFocused && !isChooserOpen) {
        onInvestigate('SessionManager');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchFocused, isChooserOpen, onInvestigate]);

  // Click outside search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setIsSearchFocused(false);
        setIsChooserOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredNodes = nodes.filter(
    (n) =>
      n.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      n.path.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="bg-[#FAF9F5] text-slate-900 font-sans min-h-screen flex flex-col antialiased selection:bg-emerald-200 selection:text-emerald-950 overflow-x-hidden">
      {/* Top Navigation */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-md shadow-slate-900/15">
                <GitFork className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                Legacy Code Solver
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>
            <div className="hidden sm:flex items-center space-x-2 text-sm text-slate-600 bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200/80">
              <Box className="w-4 h-4 text-emerald-600" />
              <span className="font-medium text-slate-800">order-service</span>
              <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                Sample
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Search Bar with Autocomplete Dropdown */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                placeholder="Search Java symbols..."
                className="pl-9 pr-12 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-52 sm:w-64 text-slate-900 placeholder-slate-400 transition"
              />
              <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">
                ⌘K
              </span>

              {/* Live Search Dropdown */}
              {isSearchFocused && (
                <div
                  ref={dropdownRef}
                  className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 overflow-hidden"
                >
                  <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                    <span>Classes in order-service ({filteredNodes.length})</span>
                    <span className="font-mono text-[10px]">Select to inspect</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {filteredNodes.length > 0 ? (
                      filteredNodes.map((node) => (
                        <button
                          key={node.id}
                          type="button"
                          onClick={() => {
                            onInvestigate(node.name);
                            setIsSearchFocused(false);
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center justify-between group transition"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 font-mono">
                              {node.name}.java
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                              {node.path}
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 group-hover:bg-emerald-100 group-hover:text-emerald-800 px-2 py-0.5 rounded">
                            {node.clusterName}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-xs text-slate-500 text-center">
                        No Java classes match &quot;{searchQuery}&quot;
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenWorkspace}
              title="Open full workspace directly"
              className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center text-xs font-semibold shadow-sm transition"
            >
              JS
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-10 flex-1 flex flex-col justify-center">
        <div className="max-w-3xl mb-8">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-xs font-semibold mb-4 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Deterministic AST Bytecode Analysis</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            See what depends on your code <br className="hidden sm:inline" />
            before you change it.
          </h1>
          <p className="mt-3.5 text-lg text-slate-600 leading-relaxed max-w-2xl">
            Static blast-radius analysis that traces direct callers and multi-tier call paths across your legacy codebase in milliseconds.
          </p>
        </div>

        {/* Center Stage Interactive Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
          {/* Left: Investigation Launcher */}
          <div className="lg:col-span-5 glass-card rounded-2xl p-7 border border-slate-200/80 shadow-card">
            <div className="flex items-center justify-between text-xs font-semibold mb-3">
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200/70 px-2.5 py-1 rounded-md tracking-wide">
                FEATURED AUDIT
              </span>
              <span className="text-slate-500 font-mono text-[11px]">AST Scope: 42 files</span>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              What uses SessionManager?
            </h2>

            <div className="mt-4 p-4 rounded-xl bg-slate-50/90 border border-slate-200 text-sm text-slate-700 leading-relaxed">
              <div className="flex items-start space-x-2.5">
                <Info className="w-4 h-4 text-emerald-700 mt-0.5 flex-shrink-0" />
                <p>
                  Changing <code className="font-mono font-semibold text-slate-900 bg-slate-200/70 px-1 py-0.5 rounded">SessionManager</code> means callers like <span className="font-semibold text-slate-900">CheckoutService</span> are worth inspecting.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-sm py-2 border-b border-slate-100">
                <span className="text-slate-500">Direct Inbound Callers</span>
                <span className="font-bold text-slate-900">1 class</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-slate-100">
                <span className="text-slate-500">Transitive Blast Radius</span>
                <span className="font-bold text-slate-700">3 call-sites</span>
              </div>
            </div>

            <div className="mt-7 space-y-3">
              <button
                type="button"
                onClick={() => onInvestigate('SessionManager')}
                className="w-full flex items-center justify-between px-6 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-lg shadow-slate-900/20 transition-all transform hover:-translate-y-0.5 group cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <GitCommit className="w-5 h-5 text-emerald-400 group-hover:rotate-12 transition-transform" />
                  <span>Investigate SessionManager</span>
                </div>
                <div className="flex items-center space-x-2 text-xs font-mono bg-slate-800/90 text-slate-200 px-2 py-1 rounded border border-slate-700">
                  <span>↵ Enter</span>
                </div>
              </button>

              {/* Secondary class selector toggle */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsChooserOpen(!isChooserOpen)}
                  className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 rounded-lg transition"
                >
                  <span className="flex items-center gap-1.5">
                    <span>Or choose another target class in sample</span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isChooserOpen ? 'rotate-180' : ''}`} />
                </button>

                {isChooserOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-40 space-y-1">
                    {nodes.map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => {
                          onInvestigate(node.name);
                          setIsChooserOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-xs font-mono transition"
                      >
                        <span className="font-bold text-slate-800">{node.name}.java</span>
                        <span className="text-[10px] text-slate-400 font-sans">{node.clusterName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Live Code Linkage Preview */}
          <div className="lg:col-span-7 glass-card rounded-2xl p-7 border border-slate-200/80 shadow-card">
            <div className="flex items-center justify-between text-xs mb-4">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="font-bold text-slate-900 tracking-wide">Live Call Linkage Proof</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded font-medium border border-emerald-200">
                  BYTECODE VERIFIABLE
                </span>
              </div>
              <span className="text-slate-500 font-mono text-[11px]">A → B (A calls B)</span>
            </div>

            {/* Visual Two-Sheet Glass Code Flow */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
              {/* Caller Sheet */}
              <div className="bg-[#0A101D] rounded-xl p-4 text-xs font-mono text-slate-300 shadow-md border border-slate-800/80">
                <div className="flex items-center justify-between text-slate-400 pb-2 mb-3 border-b border-slate-800">
                  <span className="flex items-center space-x-1.5 text-white">
                    <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-semibold">CheckoutService.java</span>
                  </span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded font-sans font-bold">
                    CALLER
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="text-slate-500">35 if (sessionToken == null) throw ...;</div>
                  <div className="text-slate-500">36 // CALL SITE: Depends on SessionManager</div>
                  <div className="bg-slate-800/90 text-white px-2 py-1.5 rounded -mx-1 border border-emerald-500/40 shadow-sm">
                    <span className="text-emerald-400 font-bold">37</span> &nbsp;&nbsp;sessionManager.<span className="text-amber-300 font-bold underline decoration-dotted">validateSession</span>(sessionToken);
                  </div>
                  <div className="text-slate-500">38 if (!session.isActive()) return ...;</div>
                  <div className="text-slate-500">39 BigDecimal total = cart.calculateSubtotal();</div>
                </div>
              </div>

              {/* Dependency Sheet */}
              <div className="bg-[#0A101D] rounded-xl p-4 text-xs font-mono text-slate-300 shadow-md border border-slate-800/80">
                <div className="flex items-center justify-between text-slate-400 pb-2 mb-3 border-b border-slate-800">
                  <span className="flex items-center space-x-1.5 text-white">
                    <FileCode className="w-3.5 h-3.5 text-sky-400" />
                    <span className="font-semibold">SessionManager.java</span>
                  </span>
                  <span className="text-[10px] bg-sky-950 text-sky-300 border border-sky-800/60 px-1.5 py-0.5 rounded font-sans font-bold">
                    DEPENDENCY
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="text-slate-500">27 public class SessionManager &#123;</div>
                  <div className="bg-slate-800/90 text-white px-2 py-1.5 rounded -mx-1 border border-sky-500/40 shadow-sm">
                    <span className="text-sky-400 font-bold">28</span> &nbsp;&nbsp;public UserSession <span className="text-amber-300 font-bold">validateSession</span>(String rawToken) &#123;
                  </div>
                  <div className="text-slate-500">29 &nbsp;&nbsp;&nbsp;&nbsp;UserSession cached = sessionCache.get(...);</div>
                  <div className="text-slate-500">30 &nbsp;&nbsp;&nbsp;&nbsp;return cached;</div>
                  <div className="text-slate-500">31 &nbsp;&nbsp;&#125;</div>
                </div>
              </div>
            </div>

            {/* Explanatory callout */}
            <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Line 37 invokes line 28 directly during order checkout workflow.</span>
              </span>
              <button
                type="button"
                onClick={() => onInvestigate('SessionManager')}
                className="text-emerald-700 font-semibold hover:underline flex items-center gap-1"
              >
                <span>Inspect in Graph</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* 3 Core Clarifying Questions Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-200/80">
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm">
              1
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">What does this tool do?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Computes bytecode dependency graphs so you know the exact blast radius before editing code.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-900 border border-slate-200 flex items-center justify-center font-bold text-sm flex-shrink-0">
              2
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">What should I click?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Click <strong>Investigate SessionManager</strong> to view the live AST relationship matrix and evidence.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-900 border border-slate-200 flex items-center justify-center font-bold text-sm flex-shrink-0">
              3
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">How do I know it&apos;s right?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Every dependency path links to line-numbered Java AST statements with zero guesswork.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
