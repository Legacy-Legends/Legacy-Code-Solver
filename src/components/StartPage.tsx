import React from 'react';
import { GitFork, ArrowRight } from 'lucide-react';
import { GraphNode } from '../types/index';

interface StartPageProps {
  nodes: GraphNode[];
  onInvestigate: (className?: string) => void;
  onOpenWorkspace: () => void;
}

export const StartPage: React.FC<StartPageProps> = ({
  onInvestigate,
  onOpenWorkspace,
}) => {
  return (
    <div className="flex min-h-screen flex-col bg-[#F7F5F0] text-[#111827] font-sans antialiased">
      {/* Minimal Header */}
      <header className="border-b border-[#E4E2DA] bg-white px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3730A3] text-white">
            <GitFork className="h-3.5 w-3.5" />
          </div>
          <span className="font-sans text-sm font-semibold tracking-tight text-slate-900">
            Legacy Code Solver
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenWorkspace}
          className="font-sans text-xs font-medium text-indigo-800 hover:underline cursor-pointer"
        >
          Open workspace →
        </button>
      </header>

      {/* Centered Calm Introduction */}
      <main className="mx-auto flex max-w-3xl flex-1 flex-col justify-center px-6 py-12">
        <div className="rounded-2xl border border-[#E4E2DA] bg-white p-8 sm:p-10 shadow-soft">
          <div className="inline-flex items-center gap-2 rounded-md bg-indigo-50 px-2.5 py-1 font-sans text-xs font-medium text-indigo-900">
            Java Dependency &amp; Call-Site Inspector
          </div>

          <h1 className="mt-4 font-sans text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
            See what uses a class before you change it.
          </h1>

          <p className="mt-3 font-sans text-base leading-relaxed text-slate-600">
            Explore the dependency graph to trace direct and indirect callers across a legacy Java codebase, and inspect the exact line of code behind every connection.
          </p>

          {/* Sample Chain Preview */}
          <div className="mt-6 rounded-xl border border-[#E4E2DA] bg-[#F7F5F0] p-4">
            <div className="font-sans text-xs font-medium text-slate-500 mb-2">
              Sample project (<span className="font-mono text-slate-700">order-service</span>)
            </div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-900">
              <span className="rounded-lg border border-[#D6D3CD] bg-white px-2.5 py-1.5 font-semibold">
                CheckoutService
              </span>
              <span className="text-slate-400">→</span>
              <span className="rounded-lg border-2 border-[#3730A3] bg-white px-2.5 py-1.5 font-semibold text-indigo-950">
                SessionManager
              </span>
              <span className="text-slate-400">→</span>
              <span className="rounded-lg border border-[#D6D3CD] bg-white px-2.5 py-1.5 font-semibold">
                AuthTokenValidator
              </span>
            </div>
          </div>

          {/* Single Primary Action */}
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => onInvestigate('SessionManager')}
              className="inline-flex items-center gap-2.5 rounded-xl bg-[#3730A3] px-5 py-3 font-sans text-sm font-semibold text-white transition hover:bg-[#312E81] cursor-pointer"
            >
              <span>Explore sample project</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
