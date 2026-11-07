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
    <div className="border-b border-amber-300/80 bg-amber-50 px-4 py-2 text-slate-800 shrink-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
          <div className="font-sans text-xs">
            <span className="font-semibold text-slate-900">FastAPI backend unreachable</span>
            <span className="text-slate-500"> — </span>
            <span className="text-slate-700">
              {errorMessage || 'Connection refused at http://localhost:8000'}
            </span>
            <span className="text-slate-400 hidden md:inline">
              . Start backend with <code className="font-mono text-slate-800">python -m uvicorn backend.api.main:app --port 8000</code>.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-sans text-xs shrink-0">
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1 rounded-lg border border-amber-400 bg-white px-2.5 py-1 font-medium text-slate-800 hover:bg-amber-100/50 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
          <button
            type="button"
            onClick={onSwitchToSample}
            className="flex items-center gap-1 rounded-lg bg-[#3730A3] px-2.5 py-1 font-semibold text-white hover:bg-[#312E81] cursor-pointer"
          >
            Switch to Sample Project
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
