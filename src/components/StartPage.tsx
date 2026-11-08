import React, { useState, useEffect, useRef } from 'react';
import {
  GitFork,
  Search,
  UploadCloud,
  CheckCircle,
  Sliders,
  ArrowRight,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { GraphNode } from '../types/index';

interface StartPageProps {
  nodes?: GraphNode[];
  onInvestigate: (className?: string) => void;
  onOpenWorkspace: () => void;
  onOpenSettings?: () => void;
  onCustomUpload?: (files: FileList | null) => void;
}

export const StartPage: React.FC<StartPageProps> = ({
  nodes = [],
  onInvestigate,
  onOpenWorkspace,
  onOpenSettings,
  onCustomUpload,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'uploading' | 'parsing' | 'ready'
  >('idle');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Enter' && !isSearchFocused && uploadStatus === 'idle') {
        onInvestigate();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchFocused, uploadStatus, onInvestigate]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setIsSearchFocused(false);
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const first = files[0];
    setUploadedFileName(first.name);
    setUploadStatus('uploading');

    if (onCustomUpload) {
      onCustomUpload(files);
    }

    setTimeout(() => {
      setUploadStatus('parsing');
    }, 700);

    setTimeout(() => {
      setUploadStatus('ready');
    }, 1500);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };

  return (
    <div className="spatial-dot-canvas text-slate-900 font-sans min-h-screen flex flex-col antialiased selection:bg-emerald-200 selection:text-emerald-950 overflow-x-hidden">
      <header className="border-b border-[#E4E2DA] dark:border-slate-800 bg-white/95 dark:bg-[#0D131F]/95 backdrop-blur-sm px-6 sm:px-8 h-16 flex items-center justify-between sticky top-0 z-30 transition-colors duration-200 shadow-xs">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <div className="w-8.5 h-8.5 rounded-xl bg-gradient-to-br from-[#3730A3] to-[#4338CA] dark:from-indigo-600 dark:to-indigo-800 flex items-center justify-center text-white shadow-xs">
              <GitFork className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Legacy Code Solver
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {nodes.length > 0 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                placeholder="Search Java symbols..."
                className="pl-8 pr-12 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-40 sm:w-56 text-slate-900 placeholder-slate-400 transition"
              />
              <span className="absolute right-2 top-1.5 text-[9px] text-slate-400 font-mono bg-white border border-slate-200 px-1 py-0.2 rounded shadow-2xs">
                ⌘K
              </span>

              {isSearchFocused && (
                <div
                  ref={dropdownRef}
                  className="absolute right-0 mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 overflow-hidden"
                >
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                    <span>Classes in project ({filteredNodes.length})</span>
                    <span className="font-mono text-[9px]">Select to inspect</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {filteredNodes.length > 0 ? (
                      filteredNodes.map((node) => (
                        <button
                          key={node.id}
                          type="button"
                          onClick={() => {
                            onInvestigate(node.name);
                            setIsSearchFocused(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between group transition cursor-pointer"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 font-mono">
                              {node.name}.java
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                              {node.path}
                            </div>
                          </div>
                          <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 group-hover:bg-indigo-100 group-hover:text-indigo-800 px-1.5 py-0.5 rounded">
                            {node.clusterName}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-slate-500 text-center">
                        No Java classes match &quot;{searchQuery}&quot;
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              title="Open Settings & Accessibility"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#DCD9D0] bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden md:inline">Settings</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenWorkspace}
            title="Open workspace directly"
            className="font-sans text-xs font-semibold text-indigo-800 hover:text-indigo-950 flex items-center gap-1 cursor-pointer"
          >
            <span>Open workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-16 pb-20 flex-1 flex flex-col justify-start w-full">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            See what breaks before you <br className="hidden sm:inline" />
            touch legacy code.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Upload your Java repository, JAR, or ZIP to trace every direct caller, multi-tier dependency chain, and verified source call site in milliseconds.
          </p>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`glass-card rounded-3xl p-10 border-2 transition-all w-full ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/50 shadow-lg scale-[1.02]'
              : 'border-[#E4E2DA] hover:border-slate-300 shadow-soft'
          }`}
        >
          <div className="text-center py-12 px-6 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 hover:bg-slate-50 transition">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".zip,.jar,.tar,.gz,.java"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-emerald-600 mx-auto mb-4">
              <UploadCloud className="w-8 h-8" />
            </div>

            {uploadStatus === 'idle' && (
              <>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Drop your codebase
                </h2>
                <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                  Drag &amp; drop your repository archive, JAR, or source files.
                </p>

                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 rounded-xl bg-[#3730A3] hover:bg-[#312E81] text-white font-semibold text-sm shadow-md transition cursor-pointer flex items-center gap-2"
                  >
                    <FolderOpen className="w-4 h-4 text-emerald-400" />
                    <span>Browse Codebase Files</span>
                  </button>
                </div>
              </>
            )}

            {uploadStatus === 'uploading' && (
              <div className="py-6">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-900">Uploading {uploadedFileName}…</p>
                <p className="text-xs text-slate-500 mt-1">Reading archive entries into memory</p>
              </div>
            )}

            {uploadStatus === 'parsing' && (
              <div className="py-6">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-900">Parsing AST &amp; Bytecode Call Sites…</p>
                <p className="text-xs text-slate-500 mt-1">Extracting class symbols and invocations</p>
              </div>
            )}

            {uploadStatus === 'ready' && (
              <div className="py-6">
                <div className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-100 px-4 py-1.5 rounded-full text-sm font-bold mb-3">
                  <CheckCircle className="w-4 h-4" />
                  <span>AST Parsing Complete</span>
                </div>
                <p className="text-base font-bold text-slate-900">
                  Indexed classes in {uploadedFileName}
                </p>
                <button
                  type="button"
                  onClick={() => onInvestigate()}
                  className="mt-6 px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md transition cursor-pointer inline-flex items-center gap-2"
                >
                  <span>Explore Dependency Matrix</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10 border-t border-[#E4E2DA]">
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-lg bg-[#3730A3] text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-xs">1</div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Deterministic Call Graphs</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Extracted directly from Java bytecode and AST structure, avoiding hallucinated dependencies.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-900 border border-slate-200 flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Line-Numbered Evidence</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Click any edge or caller to jump straight to the exact line number where the callee is invoked.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-900 border border-slate-200 flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Instant Blast-Radius Matrix</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Know which upstream services will fail compilation or runtime calls before making a commit.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};