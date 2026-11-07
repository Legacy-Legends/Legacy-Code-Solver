import React from 'react';
import { AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';

interface BackendErrorBannerProps {
  errorMessage?: string | null;
  onRetry: () => void;
  onSwitchToSample: () => void;
}

export const BackendErrorBanner: React.FC<BackendErrorBannerProps> = ({
  errorMessage,
  onRetry,
  onSwitchToSample,
}) => {
  return (
    <div className="border-b border-rose-900/60 bg-rose-950/40 px-4 py-2.5 text-slate-200">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <div className="text-xs font-mono">
            <span className="font-semibold text-rose-200">FastAPI backend unreachable</span>
            <span className="text-slate-400"> — </span>
            <span className="text-rose-300">
              {errorMessage || 'Connection refused at http://localhost:8000'}
            </span>
            <span className="text-slate-400 hidden md:inline">
              . Start backend with <code className="text-slate-200">python -m uvicorn backend.api.main:app --port 8000</code>.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1 rounded border border-rose-800/80 bg-rose-900/40 px-2 py-0.5 text-rose-200 hover:bg-rose-800/50"
          >
            <RefreshCw className="h-2.5 w-2.5" />
            Retry
          </button>
          <button
            type="button"
            onClick={onSwitchToSample}
            className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-cyan-300 hover:bg-slate-700"
          >
            Switch to Sample Project
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
