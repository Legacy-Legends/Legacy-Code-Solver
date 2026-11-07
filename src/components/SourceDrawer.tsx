import React, { useEffect, useRef, useState } from 'react';
import { X, FileCode, ArrowRight, Copy, Check, CornerDownRight } from 'lucide-react';
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
  const [copied, setCopied] = useState(false);
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

  // Scroll to highlighted line
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
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-[#0F172A] text-slate-100 shadow-drawer border-l border-slate-700/80 select-none"
    >
      {/* Top Plum Shimmer Accent */}
      <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-plum-600 to-indigo-500" />

      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-800 px-6 py-4 bg-[#111C33]">
        <div className="min-w-0 pr-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-purple-400">
              Source Code Proof
            </span>
            <span className="rounded-full bg-purple-950 border border-purple-500/40 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-300">
              Line {evidence.lineNumber}
            </span>
            {evidence.inferred && (
              <span className="rounded-full border border-amber-600/40 bg-amber-950/40 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                Inferred Call
              </span>
            )}
          </div>

          <h2 className="mt-1 flex items-center gap-2 font-mono text-base font-bold text-white truncate">
            <FileCode className="h-4 w-4 text-purple-400 shrink-0" />
            <span className="truncate">{evidence.callerName}.java</span>
          </h2>

          <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <span className="truncate">{evidence.callerPath}:{evidence.lineNumber}</span>
            <button
              type="button"
              onClick={handleCopyPath}
              className="text-slate-500 hover:text-slate-300 transition"
              title="Copy path and line number"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close source evidence drawer"
          className="rounded-xl border border-slate-700 bg-slate-800/80 p-2 text-slate-400 transition hover:bg-slate-700 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Dependency Link Banner: Caller --[depends on]--> Callee */}
      <div className="border-b border-slate-800/80 bg-slate-900/60 px-6 py-3">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="font-bold text-purple-300">{evidence.callerName}</span>
          <span className="flex items-center gap-1 rounded-md bg-purple-950/80 border border-purple-500/40 px-2 py-0.5 text-[10px] font-bold text-purple-200">
            depends on
            <ArrowRight className="h-2.5 w-2.5" />
          </span>
          <span className="font-bold text-slate-200">{evidence.calleeName}</span>
        </div>
        <div className="mt-1.5 font-sans text-xs text-slate-300 leading-relaxed">
          {evidence.explanation}
        </div>
      </div>

      {/* Multi-Hop Path Navigation Tabs */}
      {pathEvidenceList.length > 1 && onSelectEvidenceIndex && (
        <div className="flex items-center gap-1.5 border-b border-slate-800 bg-[#0B132B] px-6 py-2 overflow-x-auto">
          <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <CornerDownRight className="h-3 w-3" />
            Path Chain:
          </span>
          {pathEvidenceList.map((item, idx) => {
            const isActive = idx === activeEvidenceIndex;
            return (
              <button
                key={item.edgeId}
                type="button"
                onClick={() => onSelectEvidenceIndex(idx)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-[11px] transition shrink-0 ${
                  isActive
                    ? 'bg-purple-900/50 text-purple-200 border border-purple-400 font-bold'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span>Hop {idx + 1}:</span>
                <span className="font-medium">{item.callerName}</span>
                <span className="text-[10px] opacity-70">:{item.lineNumber}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Dark High-Contrast Code Editor */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-[#090E1A] font-mono text-xs leading-relaxed select-text"
      >
        <div className="py-3">
          {evidence.surroundingCode.map((line) => {
            const isTarget = line.isCallSite;
            return (
              <div
                key={line.line}
                ref={isTarget ? highlightedLineRef : null}
                className={`flex items-start transition-colors ${
                  isTarget
                    ? 'bg-purple-950/50 border-l-4 border-purple-500 text-purple-50 font-medium shadow-[inset_0_0_20px_rgba(147,51,234,0.15)]'
                    : 'hover:bg-slate-900/40 text-slate-300'
                }`}
              >
                {/* Line Gutter */}
                <div
                  className={`select-none w-14 shrink-0 pr-4 text-right text-[11px] ${
                    isTarget ? 'font-bold text-purple-400' : 'text-slate-600'
                  }`}
                >
                  {line.line}
                </div>

                {/* Code Text */}
                <div className="flex-1 whitespace-pre pr-4 py-0.5 overflow-x-auto">
                  {line.text}
                </div>

                {/* Call Site Pill Badge */}
                {isTarget && (
                  <div className="mr-4 shrink-0 rounded-full bg-purple-500/20 border border-purple-400/50 px-2 py-0.2 font-mono text-[9px] font-bold text-purple-300 self-center">
                    Call Site
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-800 bg-[#0B132B] px-6 py-3 font-mono text-[11px] text-slate-400">
        <div className="truncate pr-4">
          Statement: <code className="text-purple-200">{evidence.statement}</code>
        </div>
        <div className="text-[10px] text-slate-500 shrink-0">
          Press <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-slate-300">Esc</kbd> to return
        </div>
      </div>
    </div>
  );
};
