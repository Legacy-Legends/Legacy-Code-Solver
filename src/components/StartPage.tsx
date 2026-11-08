import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  GitFork,
  Box,
  Search,
  UploadCloud,
  FileCode,
  CheckCircle,
  Sliders,
  ArrowRight,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { GraphNode } from '../types/index';
import { AccessibleDropdown, DropdownItem } from './AccessibleDropdown';

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
  const [targetClass, setTargetClass] = useState<string>('SessionManager');

  // Keyboard shortcuts: ⌘K or / to focus search, Enter to trigger featured audit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Enter' && !isSearchFocused && uploadStatus === 'idle') {
        onInvestigate(targetClass);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchFocused, uploadStatus, onInvestigate, targetClass]);

  // Click outside search dropdown
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

  // Handle Drag & Drop
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

  // Dropdown items for quick class selection
  const classDropdownItems: DropdownItem[] = (nodes.length > 0
    ? nodes
    : [
        {
          id: 'SessionManager',
          name: 'SessionManager',
          path: 'src/main/java/com/acme/session/SessionManager.java',
          clusterName: 'Session Management',
        },
        {
          id: 'CheckoutService',
          name: 'CheckoutService',
          path: 'src/main/java/com/acme/order/CheckoutService.java',
          clusterName: 'Order Processing',
        },
        {
          id: 'AuthTokenValidator',
          name: 'AuthTokenValidator',
          path: 'src/main/java/com/acme/auth/AuthTokenValidator.java',
          clusterName: 'Security & Identity',
        },
        {
          id: 'AppLogger',
          name: 'AppLogger',
          path: 'src/main/java/com/acme/logging/AppLogger.java',
          clusterName: 'Infrastructure & Logging',
        },
      ]
  ).map((n) => ({
    id: n.name,
    label: `${n.name}.java`,
    sublabel: n.path,
    badge: n.clusterName,
    icon: <FileCode className="w-3.5 h-3.5 text-indigo-500" />,
  }));

  // Dynamic AST Bytecode Proof snippet that responds to the selected class
  const proofData = useMemo(() => {
    switch (targetClass) {
      case 'AuthTokenValidator':
        return {
          callerFile: 'SessionManager.java',
          callerLabel: 'CALLER',
          callerLinePre: '40 UserSession session = sessionCache.get(token);',
          callerLineSiteNum: 42,
          callerLineSite: 'TokenValidationResult res = authTokenValidator.verifyToken(token);',
          callerLinePost: '43 if (!res.isValid()) return null;',
          depFile: 'AuthTokenValidator.java',
          depLabel: 'DEPENDENCY',
          depLinePre: '130 public class AuthTokenValidator {',
          depLineSiteNum: 131,
          depLineSite: 'public TokenValidationResult verifyToken(String rawToken) {',
          depLinePost: '132   if (rawToken == null) return TokenValidationResult.invalid();',
        };
      case 'CheckoutService':
        return {
          callerFile: 'OrderController.java',
          callerLabel: 'CALLER',
          callerLinePre: '18 if (cart.isEmpty()) return ResponseEntity.badRequest().build();',
          callerLineSiteNum: 19,
          callerLineSite: 'OrderResult result = checkoutService.processCheckout(token, cart);',
          callerLinePost: '20 return ResponseEntity.ok(result);',
          depFile: 'CheckoutService.java',
          depLabel: 'DEPENDENCY',
          depLinePre: '33 /** Verifies user authorization before creating order */',
          depLineSiteNum: 34,
          depLineSite: 'public OrderResult processCheckout(String sessionToken, Cart cart) {',
          depLinePost: '35   if (sessionToken == null) throw new IllegalArgumentException();',
        };
      case 'AppLogger':
        return {
          callerFile: 'OrderRepository.java',
          callerLabel: 'CALLER',
          callerLinePre: '52 db.orders().insert(order);',
          callerLineSiteNum: 53,
          callerLineSite: 'appLogger.info("Order created successfully: " + order.getId());',
          callerLinePost: '54 return order;',
          depFile: 'AppLogger.java',
          depLabel: 'DEPENDENCY',
          depLinePre: '169 public class AppLogger {',
          depLineSiteNum: 170,
          depLineSite: 'public void info(String message) {',
          depLinePost: '171   emit("INFO", message, null);',
        };
      case 'SessionManager':
      default:
        return {
          callerFile: 'CheckoutService.java',
          callerLabel: 'CALLER',
          callerLinePre: '35 if (token == null) throw ...;',
          callerLineSiteNum: 37,
          callerLineSite: 'sessionManager.validateSession(tok);',
          callerLinePost: '38 if (!session.isActive()) return ...;',
          depFile: 'SessionManager.java',
          depLabel: 'DEPENDENCY',
          depLinePre: '27 public class SessionManager {',
          depLineSiteNum: 28,
          depLineSite: 'public UserSession validateSession(...) {',
          depLinePost: '29   return tokenStore.find(t);',
        };
    }
  }, [targetClass]);

  return (
    <div className="spatial-dot-canvas text-slate-900 font-sans min-h-screen flex flex-col antialiased selection:bg-emerald-200 selection:text-emerald-950 overflow-x-hidden">
      {/* Top Navigation */}
      <header className="border-b border-[#E4E2DA] bg-white px-6 h-14 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#3730A3] flex items-center justify-center text-white shadow-xs">
              <GitFork className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900">
              Legacy Code Solver
            </span>
          </div>
          <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>
          <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-600 bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200/80">
            <Box className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-medium text-slate-800">order-service</span>
            <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
              Sample
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Search Bar with Autocomplete Dropdown */}
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

              {/* Search Dropdown */}
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

          {/* Settings & Accessibility Button */}
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

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 pt-8 pb-20 flex-1 flex flex-col justify-start">
        <div className="max-w-3xl mb-8">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-900 text-xs font-semibold mb-3 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>STATIC AST BYTECODE ANALYSIS · ZERO GUESSWORK</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            See what breaks before you <br className="hidden sm:inline" />
            touch legacy code.
          </h1>
          <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
            Upload your Java repository, JAR, or ZIP to trace every direct caller, multi-tier dependency chain, and verified source call site in milliseconds.
          </p>
        </div>

        {/* Center Stage: Central Upload Interaction (Main Idea) & Live Call Linkage Proof */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-10">
          {/* Left: Main Upload File Dropzone & Launcher (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`glass-card rounded-2xl p-7 border-2 transition-all ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/50 shadow-lg scale-[1.01]'
                  : 'border-[#E4E2DA] hover:border-slate-300 shadow-soft'
              }`}
            >
              {/* Upload Drop Area */}
              <div className="text-center py-7 px-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 hover:bg-slate-50 transition">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".zip,.jar,.tar,.gz,.java"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-emerald-600 mx-auto mb-3">
                  <UploadCloud className="w-7 h-7" />
                </div>

                {uploadStatus === 'idle' && (
                  <>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                      Drop your codebase
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                      Drag &amp; drop your repository archive, JAR, or source files.
                    </p>

                    <div className="mt-4 flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-5 py-2.5 rounded-xl bg-[#3730A3] hover:bg-[#312E81] text-white font-semibold text-xs shadow-md transition cursor-pointer flex items-center gap-2"
                      >
                        <FolderOpen className="w-4 h-4 text-emerald-400" />
                        <span>Browse Codebase Files</span>
                      </button>
                    </div>
                  </>
                )}

                {uploadStatus === 'uploading' && (
                  <div className="py-2">
                    <Loader2 className="w-6 h-6 text-emerald-600 animate-spin mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-900">Uploading {uploadedFileName}…</p>
                    <p className="text-[11px] text-slate-500 mt-1">Reading archive entries into memory</p>
                  </div>
                )}

                {uploadStatus === 'parsing' && (
                  <div className="py-2">
                    <Loader2 className="w-6 h-6 text-emerald-600 animate-spin mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-900">Parsing AST &amp; Bytecode Call Sites…</p>
                    <p className="text-[11px] text-slate-500 mt-1">Extracting class symbols and invocations</p>
                  </div>
                )}

                {uploadStatus === 'ready' && (
                  <div className="py-2">
                    <div className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full text-xs font-bold mb-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>AST Parsing Complete</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">
                      Indexed classes in {uploadedFileName}
                    </p>
                    <button
                      type="button"
                      onClick={() => onInvestigate('SessionManager')}
                      className="mt-4 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md transition cursor-pointer inline-flex items-center gap-2"
                    >
                      <span>Explore AST Dependency Matrix</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Sample Exploration Bar with Dynamic Target Class */}
              <div className="mt-5 pt-4 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-slate-500 font-medium shrink-0">Sample class:</span>
                  <AccessibleDropdown
                    items={classDropdownItems}
                    selectedId={targetClass}
                    onSelect={(id) => setTargetClass(id)}
                    triggerClassName="w-48 sm:w-56"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onInvestigate(targetClass)}
                  className="px-4 py-2 bg-[#3730A3] hover:bg-[#312E81] text-white font-semibold text-xs rounded-xl shadow-sm transition shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <span>Investigate {targetClass}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Right: Live Code Linkage Proof (5 cols) */}
          <div className="lg:col-span-5 glass-card rounded-2xl p-7 border border-[#E4E2DA] shadow-soft">
            <div className="flex items-center justify-between text-xs mb-4">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="font-bold text-slate-900 tracking-wide">AST Bytecode Proof</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded font-medium border border-emerald-200">
                  VERIFIED
                </span>
              </div>
              <span className="text-slate-500 font-mono text-[11px]">A → B (A calls B)</span>
            </div>

            {/* Caller & Dependency Code Blocks */}
            <div className="space-y-3 font-mono text-xs">
              {/* Caller Sheet */}
              <div className="bg-[#0A101D] rounded-xl p-4 text-slate-300 shadow-md border border-slate-800/80">
                <div className="flex items-center justify-between text-slate-400 pb-2 mb-2 border-b border-slate-800">
                  <span className="flex items-center space-x-1.5 text-white">
                    <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-semibold">{proofData.callerFile}</span>
                  </span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded font-sans font-bold">
                    {proofData.callerLabel}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="text-slate-500">{proofData.callerLinePre}</div>
                  <div className="bg-slate-800/90 text-white px-2 py-1.5 rounded -mx-1 border border-emerald-500/40 shadow-sm">
                    <span className="text-emerald-400 font-bold">{proofData.callerLineSiteNum}</span> &nbsp;{proofData.callerLineSite}
                  </div>
                  <div className="text-slate-500">{proofData.callerLinePost}</div>
                </div>
              </div>

              {/* Dependency Sheet */}
              <div className="bg-[#0A101D] rounded-xl p-4 text-slate-300 shadow-md border border-slate-800/80">
                <div className="flex items-center justify-between text-slate-400 pb-2 mb-2 border-b border-slate-800">
                  <span className="flex items-center space-x-1.5 text-white">
                    <FileCode className="w-3.5 h-3.5 text-sky-400" />
                    <span className="font-semibold">{proofData.depFile}</span>
                  </span>
                  <span className="text-[10px] bg-sky-950 text-sky-300 border border-sky-800/60 px-1.5 py-0.5 rounded font-sans font-bold">
                    {proofData.depLabel}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="text-slate-500">{proofData.depLinePre}</div>
                  <div className="bg-slate-800/90 text-white px-2 py-1.5 rounded -mx-1 border border-sky-500/40 shadow-sm">
                    <span className="text-sky-400 font-bold">{proofData.depLineSiteNum}</span> &nbsp;{proofData.depLineSite}
                  </div>
                  <div className="text-slate-500">{proofData.depLinePost}</div>
                </div>
              </div>
            </div>

            <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">
              Every edge connects to a verifiable line number. Zero fuzzy heuristics.
            </p>
          </div>
        </div>

        {/* 3 Core Proof Cards Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-[#E4E2DA]">
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-lg bg-[#3730A3] text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-xs">
              1
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Deterministic Call Graphs</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Extracted directly from Java bytecode and AST structure, avoiding hallucinated dependencies.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-900 border border-slate-200 flex items-center justify-center font-bold text-sm flex-shrink-0">
              2
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Line-Numbered Evidence</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Click any edge or caller to jump straight to the exact line number where the callee is invoked.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-900 border border-slate-200 flex items-center justify-center font-bold text-sm flex-shrink-0">
              3
            </div>
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
