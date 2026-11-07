import React, { useEffect, useRef } from 'react';
import { X, FileCode, ArrowRight, Copy, Check } from 'lucide-react';
import { SourceEvidence } from '../types/index';

interface SourceDrawerProps {
  evidence: SourceEvidence | null;
  pathEvidenceList?: SourceEvidence[];
  activeEvidenceIndex?: number;
  onSelectEvidenceIndex?: (index: number) => void;
  onClose: () => void;
}

export const SourceDrawer: React.FC<SourceDrawerProps> = ({
  evidence,
  pathEvidenceList = [],
  activeEvidenceIndex = 0,
  onSelectEvidenceIndex,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);
  const highlightedLineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Scroll to highlighted line when evidence changes
  useEffect(() => {
    if (highlightedLineRef.current) {
      highlightedLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [evidence]);

  if (!evidence) return null;

  const handleCopyPath = () => {
    if (evidence.callerPath) {
      navigator.clipboard.writeText(`${evidence.callerPath}:${evidence.lineNumber}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Source Evidence Drawer"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-2xl flex-col border-l border-slate-800 bg-[#070b14]/98 shadow-[-20px_0_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl transition-all duration-200"
    >
      {/* Top Accent Line matching Trace Motif */}
      <div className="h-0.5 w-full bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500 shadow-[0_0_12px_rgba(56,189,248,0.7)]" />

      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-800/90 px-5 py-3.5">
        <div className="min-w-0 pr-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
              Source Code Evidence
            </span>
            <span className="rounded bg-slate-800/80 px-1.5 py-0.2 font-mono text-[10px] text-slate-400">
              Line {evidence.lineNumber}
            </span>
            {evidence.inferred && (
              <span className="rounded border border-amber-600/40 bg-amber-950/40 px-1.5 py-0.2 font-mono text-[10px] text-amber-300">
                Inferred Call
              </span>
            )}
          </div>

          <h2 className="mt-1 flex items-center gap-2 font-mono text-base font-bold text-slate-100 truncate">
            <FileCode className="h-4 w-4 text-cyan-400 shrink-0" />
            <span className="truncate">{evidence.callerName}.java</span>
          </h2>

          <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <span className="truncate">{evidence.callerPath}:{evidence.lineNumber}</span>
            <button
              type="button"
              onClick={handleCopyPath}
              className="inline-flex items-center text-slate-500 hover:text-slate-300"
              title="Copy path and line"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close source evidence drawer"
          className="rounded-lg border border-slate-800 bg-slate-900/80 p-1.5 text-slate-400 transition hover:border-slate-700 hover:bg-slate-800 hover:text-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Dependency Link Banner: Caller --[depends on]--> Callee */}
      <div className="border-b border-slate-800/80 bg-slate-900/50 px-5 py-2.5">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="font-semibold text-cyan-300">{evidence.callerName}</span>
          <span className="flex items-center gap-1 rounded bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
            depends on
            <ArrowRight className="h-2.5 w-2.5" />
          </span>
          <span className="font-semibold text-slate-200">{evidence.calleeName}</span>
        </div>
        <div className="mt-1 font-mono text-[11px] text-slate-400">
          {evidence.explanation}
        </div>
      </div>

      {/* Multi-Hop Path Navigation Tabs (if part of an indirect trace chain) */}
      {pathEvidenceList.length > 1 && onSelectEvidenceIndex && (
        <div className="flex items-center gap-1 border-b border-slate-800 bg-[#090e1c] px-5 py-1.5 overflow-x-auto">
          <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider shrink-0 mr-1">
            Path Hops:
          </span>
          {pathEvidenceList.map((item, idx) => {
            const isActive = idx === activeEvidenceIndex;
            return (
              <button
                key={item.edgeId}
                type="button"
                onClick={() => onSelectEvidenceIndex(idx)}
                className={`flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[11px] transition shrink-0 ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <span>Hop {idx + 1}:</span>
                <span className="font-medium">{item.callerName}</span>
                <span className="text-[10px] opacity-60">:{item.lineNumber}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Code Viewer */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-[#040711] font-mono text-xs leading-relaxed"
      >
        <div className="py-2">
          {evidence.surroundingCode.map((line) => {
            const isTarget = line.isCallSite;
            return (
              <div
                key={line.line}
                ref={isTarget ? highlightedLineRef : null}
                className={`flex items-start transition-colors ${
                  isTarget
                    ? 'bg-cyan-950/40 border-l-2 border-cyan-400 text-cyan-100 shadow-[inset_0_0_20px_rgba(56,189,248,0.12)]'
                    : 'hover:bg-slate-900/30 text-slate-300'
                }`}
              >
                {/* Line Number Gutter */}
                <div
                  className={`select-none w-14 shrink-0 pr-3 text-right text-[11px] ${
                    isTarget ? 'font-bold text-cyan-400' : 'text-slate-600'
                  }`}
                >
                  {line.line}
                </div>

                {/* Code Line Content */}
                <div className="flex-1 whitespace-pre pr-4 py-0.5 overflow-x-auto">
                  {line.text}
                </div>

                {/* Call Site Pill Badge on Target Line */}
                {isTarget && (
                  <div className="mr-3 shrink-0 rounded bg-cyan-500/20 border border-cyan-400/40 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-cyan-300 self-center">
                    Call Site
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Details */}
      <div className="flex items-center justify-between border-t border-slate-800/90 bg-[#070b14] px-5 py-2.5 font-mono text-[11px] text-slate-400">
        <div>
          Statement: <code className="text-slate-200">{evidence.statement}</code>
        </div>
        <div className="text-[10px] text-slate-500">
          Press <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-slate-300">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
};
