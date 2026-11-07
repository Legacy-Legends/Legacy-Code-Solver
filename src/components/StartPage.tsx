import React, { useState } from 'react';
import { ArrowRight, Search, FileCode2, GitBranch, Sparkles, X, ChevronRight } from 'lucide-react';
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
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNodes = nodes.filter(
    (n) =>
      n.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      n.path.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-y-auto bg-[#FAF8F5] parchment-grid text-[#18181B] select-none">
      {/* Top Header */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-plum-700 text-white shadow-md">
            <GitBranch className="h-4 w-4" />
          </div>
          <div>
            <span className="font-sans text-base font-bold tracking-tight text-[#18181B]">
              Legacy Code Solver
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenWorkspace}
          className="text-xs font-medium text-ink-600 hover:text-plum-700 transition flex items-center gap-1 group py-1 px-2.5 rounded-lg hover:bg-parchment-200"
        >
          <span>Open workspace directly</span>
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </header>

      {/* Main Single-Screen Hero Container */}
      <main className="my-auto mx-auto flex w-full max-w-4xl flex-col items-center px-6 py-6 text-center">
        {/* Sample project pill */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-plum-600/20 bg-plum-light px-3 py-1 text-xs font-semibold text-plum-700 shadow-sm">
          <Sparkles className="h-3 w-3" />
          <span>Interactive Example · order-service (Java)</span>
        </div>

        {/* Primary Headline */}
        <h1 className="mt-5 max-w-3xl font-sans text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#18181B] leading-[1.15]">
          See what depends on your code before you change it.
        </h1>

        {/* Concrete Example Situation */}
        <p className="mt-3.5 max-w-2xl font-sans text-base sm:text-lg text-ink-600 leading-relaxed">
          You&apos;re about to change how a user session is validated. Which other class in your codebase should you inspect?
        </p>

        {/* Concrete Two-File Dependency Preview */}
        <div className="mt-7 w-full max-w-2xl rounded-2xl parchment-card p-5 text-left shadow-card border border-parchment-border">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-3 flex items-center gap-1.5">
            <FileCode2 className="h-3.5 w-3.5 text-plum-600" />
            <span>Dependency relationship in sample code</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
            {/* Caller File */}
            <div className="rounded-xl border border-purple-200 bg-lilac-50 p-3.5 transition">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-plum-800">CheckoutService.java</span>
                <span className="text-[10px] text-purple-700 font-semibold bg-purple-200/60 px-1.5 py-0.5 rounded">
                  Caller
                </span>
              </div>
              <div className="mt-2 font-mono text-[11px] text-ink-700 bg-white/80 p-2 rounded-lg border border-purple-100">
                <span className="text-purple-600 font-bold">line 37:</span> sessionManager.<span className="font-semibold text-plum-700">validateSession</span>(token);
              </div>
            </div>

            {/* Dependency File */}
            <div className="rounded-xl border border-parchment-border bg-parchment-100 p-3.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-ink-800">SessionManager.java</span>
                <span className="text-[10px] text-ink-600 font-semibold bg-parchment-300 px-1.5 py-0.5 rounded">
                  Dependency
                </span>
              </div>
              <div className="mt-2 font-mono text-[11px] text-ink-700 bg-white/80 p-2 rounded-lg border border-parchment-border">
                <span className="text-ink-400 font-bold">line 28:</span> public UserSession <span className="font-semibold text-ink-900">validateSession</span>(...)
              </div>
            </div>
          </div>

          <p className="mt-3.5 text-xs text-ink-600 font-sans leading-relaxed flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-plum-600 shrink-0" />
            <span>
              <strong>CheckoutService</strong> depends on <strong>SessionManager</strong>. Changing SessionManager potentially affects checkout transaction behavior.
            </span>
          </p>
        </div>

        {/* Primary & Secondary Actions */}
        <div className="mt-7 flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
          <button
            type="button"
            onClick={() => onInvestigate('SessionManager')}
            className="btn-plum flex items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 text-sm sm:text-base font-bold shadow-md w-full sm:w-auto"
          >
            <span>Investigate SessionManager</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsChooserOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-parchment-border bg-white px-5 py-3.5 text-sm font-semibold text-ink-700 hover:bg-parchment-100 hover:border-ink-400 transition shadow-sm w-full sm:w-auto"
          >
            <Search className="h-4 w-4 text-ink-500" />
            <span>Choose another class</span>
          </button>
        </div>

        {/* Quiet Footnote */}
        <div className="mt-6 flex items-center gap-3 text-[11px] font-sans text-ink-500">
          <span>Deterministic Java static analysis</span>
          <span className="text-parchment-500">·</span>
          <span>Actual source lines</span>
          <span className="text-parchment-500">·</span>
          <span>100% offline demo ready</span>
        </div>
      </main>

      {/* Class Chooser Modal if clicked "Choose another class" */}
      {isChooserOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 select-none"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl border border-parchment-border">
            <div className="flex items-center justify-between pb-3 border-b border-parchment-border">
              <div className="font-sans font-bold text-base text-ink-900">
                Choose a Java Class to Investigate
              </div>
              <button
                type="button"
                onClick={() => setIsChooserOpen(false)}
                className="p-1 rounded-lg text-ink-400 hover:bg-parchment-200 hover:text-ink-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search classes (e.g. Auth, Session, Logger)..."
                autoFocus
                className="w-full rounded-xl border border-parchment-border bg-parchment-50 py-2 pl-9 pr-4 font-mono text-xs text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-plum-600"
              />
            </div>

            <div className="mt-3 max-h-64 overflow-y-auto space-y-1">
              {filteredNodes.length > 0 ? (
                filteredNodes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      setIsChooserOpen(false);
                      onInvestigate(n.name);
                    }}
                    className="flex w-full items-center justify-between p-2.5 rounded-xl text-left hover:bg-lilac-50 hover:border-purple-200 border border-transparent transition group"
                  >
                    <div>
                      <div className="font-mono text-xs font-bold text-ink-800 group-hover:text-plum-700">
                        {n.name}
                      </div>
                      <div className="font-mono text-[10px] text-ink-500 truncate max-w-xs sm:max-w-sm">
                        {n.path}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-ink-400 group-hover:text-plum-600 shrink-0" />
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-ink-500 font-sans">
                  No classes found matching &quot;{searchQuery}&quot;
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
