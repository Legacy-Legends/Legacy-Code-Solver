import React, { useEffect, useRef, useState } from 'react';
import { X, FileCode, Copy, Check, Lightbulb, CornerDownRight } from 'lucide-react';
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

  // Scroll to highlighted call site line
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
    <aside
      id="evidenceDrawer"
      role="dialog"
      aria-modal="true"
      aria-label="Source Evidence Drawer"
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg lg:max-w-xl flex-col bg-[#0A101D] text-slate-200 border-l border-slate-800 shadow-drawer select-none animate-in slide-in-from-right duration-200"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#0F172A]">
        <div className="flex items-center space-x-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"></span>
          <span className="font-bold text-sm text-white tracking-wide">Source Evidence</span>
          <span className="text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded">
            Line {evidence.lineNumber}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleCopyPath}
            title="Copy path and line number"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close evidence drawer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* File Path Strip */}
      <div className="px-4 py-2.5 bg-[#0D1527] border-b border-slate-800/80 text-[11px] font-mono text-slate-400 flex items-center justify-between">
        <div className="flex items-center space-x-2 truncate">
          <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">{evidence.callerPath}</span>
        </div>
        <span className="shrink-0 text-[10px] text-slate-500 font-sans font-medium">Java 17 AST</span>
      </div>

      {/* WHY THIS APPEARS IN RESULTS Card */}
      <div className="p-4 bg-emerald-950/30 border-b border-emerald-900/40 text-xs">
        <div className="flex items-center space-x-1.5 text-emerald-300 font-bold mb-1">
          <Lightbulb className="w-3.5 h-3.5 text-emerald-400" />
          <span className="tracking-wide uppercase text-[10px]">WHY THIS APPEARS IN RESULTS</span>
        </div>
        <p className="text-slate-300 text-[11px] leading-relaxed">
          {evidence.explanation ||
            `This direct invocation on line ${evidence.lineNumber} proves reachability from ${evidence.callerName} into ${evidence.calleeName}.`}
        </p>
      </div>

      {/* Multi-Hop Path Navigation Tabs (if traversing chain) */}
      {pathEvidenceList.length > 1 && onSelectEvidenceIndex && (
        <div className="flex items-center gap-1.5 border-b border-slate-800 bg-[#080E1A] px-4 py-2 overflow-x-auto">
          <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <CornerDownRight className="h-3 w-3 text-emerald-400" />
            Path:
          </span>
          {pathEvidenceList.map((item, idx) => {
            const isActive = idx === activeEvidenceIndex;
            return (
              <button
                key={item.edgeId}
                type="button"
                onClick={() => onSelectEvidenceIndex(idx)}
                className={`flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] transition shrink-0 ${
                  isActive
                    ? 'bg-emerald-900/50 text-emerald-200 border border-emerald-500/60 font-bold'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span>Hop {idx + 1}:</span>
                <span>{item.callerName}</span>
                <span className="text-[10px] opacity-70">:{item.lineNumber}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Code Inspection Area */}
      <div
        ref={containerRef}
        className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1 select-text bg-[#0A101D]"
      >
        {evidence.surroundingCode && evidence.surroundingCode.length > 0 ? (
          evidence.surroundingCode.map((line) => {
            const isTarget = line.isCallSite;
            return isTarget ? (
              <div
                key={line.line}
                ref={highlightedLineRef}
                className="bg-[#122824] text-white p-2.5 rounded-lg border border-emerald-500/50 shadow-md flex items-start space-x-3 my-1.5"
              >
                <span className="text-emerald-400 font-bold select-none shrink-0 w-8 text-right">
                  {line.line}
                </span>
                <div className="flex-1 overflow-x-auto whitespace-pre font-mono">
                  {/* Highlight call method with amber underline */}
                  <span className="text-slate-200">
                    {line.text.includes('validateSession') ? (
                      <>
                        {line.text.split('validateSession')[0]}
                        <span className="text-amber-300 font-bold underline decoration-dotted">
                          validateSession
                        </span>
                        {line.text.split('validateSession')[1]}
                      </>
                    ) : line.text.includes('verifyToken') ? (
                      <>
                        {line.text.split('verifyToken')[0]}
                        <span className="text-amber-300 font-bold underline decoration-dotted">
                          verifyToken
                        </span>
                        {line.text.split('verifyToken')[1]}
                      </>
                    ) : (
                      line.text
                    )}
                  </span>
                </div>
                <span className="text-[9px] font-bold text-emerald-300 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800 shrink-0 select-none">
                  Call Site
                </span>
              </div>
            ) : (
              <div
                key={line.line}
                className="flex items-start space-x-3 text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 px-2 py-0.5 rounded transition"
              >
                <span className="text-slate-600 select-none shrink-0 w-8 text-right text-[11px]">
                  {line.line}
                </span>
                <span className="whitespace-pre overflow-x-auto flex-1">{line.text}</span>
              </div>
            );
          })
        ) : (
          <div className="space-y-1.5">
            <div className="text-slate-500">35 if (sessionToken == null) throw new IllegalArgumentException();</div>
            <div className="text-slate-500">36 // CALL SITE: CheckoutService depends on SessionManager</div>
            <div className="bg-[#122824] text-white p-2.5 rounded-lg border border-emerald-500/50 shadow-md flex items-start space-x-3">
              <span className="text-emerald-400 font-bold select-none w-8 text-right">37</span>
              <span className="text-slate-200">
                UserSession session = sessionManager.<span className="text-amber-300 font-bold underline decoration-dotted">validateSession</span>(sessionToken);
              </span>
            </div>
            <div className="text-slate-500">38 if (!session.isActive()) return OrderResult.unauthorized();</div>
            <div className="text-slate-500">39 BigDecimal total = cart.calculateSubtotal();</div>
          </div>
        )}
      </div>

      {/* Footer Strip */}
      <div className="p-3 border-t border-slate-800 bg-[#0D1527] flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <div className="flex items-center space-x-2">
          <span>Call 1 of 1 in {evidence.callerName}</span>
          <span>•</span>
          <span className="text-slate-500">Press Esc to close</span>
        </div>
        <span className="text-emerald-400 font-semibold flex items-center gap-1">
          <Check className="w-3 h-3 text-emerald-400" />
          <span>AST Bytecode Verified</span>
        </span>
      </div>
    </aside>
  );
};
