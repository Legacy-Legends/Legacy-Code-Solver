import { GitFork, FileJson, Sliders, ArrowRight } from 'lucide-react';

interface StartPageProps {
  onOpenWorkspace: () => void;
  onOpenSettings: () => void;
}

/** The presentation uses one checked-in mock file, served by the backend. */
export function StartPage({ onOpenWorkspace, onOpenSettings }: StartPageProps) {
  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200/70 dark:border-white/10 px-6 py-5 sm:px-10">
        <div className="flex items-center gap-3 font-bold">
          <GitFork className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          Legacy Code Solver
        </div>
        <button type="button" onClick={onOpenSettings} className="glass-pill flex items-center gap-2 rounded-xl px-4 py-2 text-sm">
          <Sliders className="h-4 w-4" /> Settings
        </button>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10 sm:py-24">
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">Understand the code.<br />See the impact.</h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
          Explore dependencies, trace what a change affects, and talk to your code-health pet.
        </p>
        <section aria-label="Mock codebase" className="mt-12 flex w-full flex-col items-center rounded-3xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 bg-white/60 dark:bg-slate-900/60 px-6 py-16 text-center shadow-sm">
          <FileJson className="mb-5 h-14 w-14 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-2xl font-semibold">Your mock codebase is ready</h2>
          <p className="mt-3 font-mono text-sm text-slate-600 dark:text-slate-400">graph.json</p>
          <p className="mt-3 max-w-lg text-slate-600 dark:text-slate-400">
            Open the included mock file to explore its classes, dependency cycles, and health scores.
          </p>
          <button type="button" onClick={onOpenWorkspace} className="mt-8 flex items-center gap-3 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500">
            Open mock graph <ArrowRight className="h-5 w-5" />
          </button>
        </section>
      </main>
    </div>
  );
}
