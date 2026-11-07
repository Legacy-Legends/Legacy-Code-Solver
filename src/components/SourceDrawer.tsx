import React, { useEffect, useRef, useState } from 'react';
import { X, FileCode, Copy, Check, ArrowRight } from 'lucide-react';
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

  // Center the highlighted call-site line immediately when evidence opens
  useEffect(() => {
    if (highlightedLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const target = highlightedLineRef.current;
      const offsetTop = target.offsetTop - container.offsetTop;
      container.scrollTop = Math.max(
        0,
        offsetTop - container.clientHeight / 2 + target.clientHeight / 2
      );
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
    <aside
      id="evidenceDrawer"
      role="dialog"
      aria-modal="true"
      aria-label="Source Evidence Drawer"
      className="fixed inset-y-0 right-0 md:static md:inset-auto z-40 flex h-full w-full md:w-[360px] lg:w-[420px] shrink-0 flex-col border-l border-[#E4E2DA] bg-white text-slate-900 select-none"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[#E4E2DA] bg-[#FAF9F5] px-5 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-sans text-xs font-medium text-indigo-900">
            <FileCode className="h-3.5 w-3.5 text-indigo-700 shrink-0" />
            <span>Java source evidence</span>
            <span className="rounded bg-indigo-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-900">
              Line {evidence.lineNumber}
            </span>
          </div>
          <h2 className="mt-1 font-mono text-sm font-bold text-slate-900 break-all">
            {evidence.callerName}.java
          </h2>
          <div className="mt-0.5 font-mono text-[11px] text-slate-500 break-all">
            {evidence.callerPath}:{evidence.lineNumber}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCopyPath}
            title="Copy path and line number"
            className="rounded-lg border border-[#DCD9D0] bg-white p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
          >
            {copied ? <Check className="h-4 w-4 text-indigo-700" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close evidence drawer"
            className="rounded-lg border border-[#DCD9D0] bg-white p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Concise Relationship Explanation */}
      <div className="border-b border-[#E4E2DA] bg-white px-5 py-3">
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs font-semibold text-slate-900">
          <span>{evidence.callerName}</span>
          <ArrowRight className="h-3.5 w-3.5 text-indigo-700" />
          <span>{evidence.calleeName}</span>
        </div>
        <p className="mt-1 font-sans text-xs leading-relaxed text-slate-600">
          {evidence.explanation ||
            `${evidence.callerName} calls ${evidence.calleeName} on line ${evidence.lineNumber}.`}
        </p>
      </div>

      {/* Multi-Hop Path Navigation Tabs (if traversing chain) */}
      {pathEvidenceList.length > 1 && onSelectEvidenceIndex && (
        <div className="flex items-center gap-1.5 border-b border-[#E4E2DA] bg-[#FAF9F5] px-5 py-2 overflow-x-auto">
          <span className="font-sans text-xs font-medium text-slate-500 shrink-0 mr-1">
            Call path:
          </span>
          {pathEvidenceList.map((item, idx) => {
            const isActive = idx === activeEvidenceIndex;
            return (
              <button
                key={item.edgeId}
                type="button"
                onClick={() => onSelectEvidenceIndex(idx)}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-mono text-xs transition shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#3730A3] text-white font-semibold'
                    : 'bg-white border border-[#DCD9D0] text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>{item.callerName}</span>
                <span className="opacity-75">:{item.lineNumber}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Opaque High-Contrast Code Inspection Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-[#111827] p-4 font-mono text-xs select-text"
      >
        {evidence.surroundingCode && evidence.surroundingCode.length > 0 ? (
          evidence.surroundingCode.map((line) => {
            const isTarget = line.isCallSite;
            return isTarget ? (
              <div
                key={line.line}
                ref={highlightedLineRef}
                className="my-1 flex items-start gap-3 rounded-lg border-l-4 border-indigo-400 bg-indigo-950/90 px-3 py-2 text-white"
              >
                <span className="w-8 shrink-0 select-none text-right font-bold text-indigo-300">
                  {line.line}
                </span>
                <div className="flex-1 min-w-0 whitespace-pre-wrap break-all font-mono">
                  <span className="font-semibold text-white">{line.text}</span>
                </div>
                <span className="shrink-0 select-none rounded bg-indigo-500/30 px-2 py-0.5 font-sans text-[10px] font-semibold text-indigo-200">
                  Call site
                </span>
              </div>
            ) : (
              <div
                key={line.line}
                className="flex items-start gap-3 rounded px-3 py-0.5 text-slate-300 hover:bg-slate-800/60"
              >
                <span className="w-8 shrink-0 select-none text-right text-[11px] text-slate-500">
                  {line.line}
                </span>
                <span className="flex-1 min-w-0 whitespace-pre-wrap break-all">{line.text}</span>
              </div>
            );
          })
        ) : (
          <div className="p-3 text-slate-300">
            <code>{evidence.statement}</code>
          </div>
        )}
      </div>

      {/* Footer Strip */}
      <div className="flex items-center justify-between border-t border-[#E4E2DA] bg-[#FAF9F5] px-5 py-2.5 font-sans text-xs text-slate-600">
        <span className="font-mono text-[11px] text-slate-700 truncate pr-2">
          {evidence.statement}
        </span>
        <span className="shrink-0 text-[11px] text-slate-500">Esc to close</span>
      </div>
    </aside>
  );
};
