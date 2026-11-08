import { useState, useMemo, useEffect, useCallback } from 'react';
import rawGraphData from './mocks/graph.json';
import {
  GraphData,
  GraphNode,
  GraphEdge,
  DataSourceMode,
  ImpactAnalysis,
  SourceEvidence,
} from './types/index';
import { SAMPLE_GRAPH_DATA, SAMPLE_EVIDENCE_MAP } from './data/sampleProject';
import { getEnterpriseSourceEvidence } from './data/enterpriseSourceSnippets';
import { computeImpactAnalysis } from './lib/impactAnalysis';
import { fetchLiveGraphData, checkBackendHealth, uploadProject } from './api/backendAdapter';
import { StartPage } from './components/StartPage';
import { TopBar } from './components/TopBar';
import { PlanarGraph2D } from './components/PlanarGraph2D';
import { CommandGraph3D } from './components/CommandGraph3D';
import { DetailPanel } from './components/DetailPanel';
import { SourceDrawer } from './components/SourceDrawer';
import { BackendErrorBanner } from './components/BackendErrorBanner';
import { SettingsModal } from './components/SettingsModal';
import { useAccessibilitySettings, registerAnnouncer, announceToScreenReader } from './lib/accessibilityStore';
import { AgentPanel } from './components/AgentPanel';
import { PetCompanion } from './components/PetCompanion';
import { DomainTag } from './api/backendAdapter';

type RouteView = 'start' | 'investigate';

const EMPTY_GRAPH_DATA: GraphData = {
  overallHealth: 0,
  clusters: [],
  nodes: [],
  edges: [],
};

/**
 * Extracts ?class= parameter from either URL search or hash query string.
 */
function getUrlClassParam(): string | null {
  const searchParams = new URLSearchParams(window.location.search);
  const fromSearch = searchParams.get('class');
  if (fromSearch) return fromSearch;

  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex >= 0) {
    const hashParams = new URLSearchParams(hash.slice(qIndex + 1));
    return hashParams.get('class');
  }
  return null;
}

function getUrlParams(): URLSearchParams {
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex >= 0) {
    return new URLSearchParams(hash.slice(qIndex + 1));
  }
  return new URLSearchParams(window.location.search);
}

export function App() {
  // Accessibility & Settings hook
  const { settings, updateSetting, resetSettings } = useAccessibilitySettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  // Register screen reader announcer
  useEffect(() => {
    registerAnnouncer((msg: string) => {
      setAnnouncement(msg);
    });
  }, []);

  // Start in 'start' (landing page) by default unless #/investigate is explicitly in URL
  const [route, setRoute] = useState<RouteView>(() => {
    if (window.location.hash.startsWith('#/investigate')) return 'investigate';
    return 'start';
  });

  // Data source mode: 'sample' | 'enterprise' | 'live'
  const [dataSource, setDataSource] = useState<DataSourceMode>('sample');
  const [liveGraphData, setLiveGraphData] = useState<GraphData | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState('demo');

  // Canvas Mode: starts in stable, well-framed 2D layout
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [fitSignal, setFitSignal] = useState(0);

  // Mobile layout switch (< 768px): 'graph' | 'details'
  const [mobileView, setMobileView] = useState<'graph' | 'details'>('graph');

  // Investigation & Selection State
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [impactAnalysis, setImpactAnalysis] = useState<ImpactAnalysis | null>(null);
  const [showIndirect, setShowIndirect] = useState(false);
  const [selectedPathNodeIds, setSelectedPathNodeIds] = useState<string[] | null>(null);

  // Evidence Drawer State
  const [activeEvidence, setActiveEvidence] = useState<SourceEvidence | null>(null);
  const [pathEvidenceList, setPathEvidenceList] = useState<SourceEvidence[]>([]);
  const [activeEvidenceIndex, setActiveEvidenceIndex] = useState(0);

  // Active Graph Data based on Mode.
  // Never substitutes mock graph data when in 'live' mode and backend is offline!
  const activeGraphData = useMemo<GraphData>(() => {
    if (dataSource === 'sample') {
      return JSON.parse(JSON.stringify(SAMPLE_GRAPH_DATA)) as GraphData;
    }
    if (dataSource === 'live') {
      return liveGraphData || EMPTY_GRAPH_DATA;
    }
    return JSON.parse(JSON.stringify(rawGraphData)) as GraphData;
  }, [dataSource, liveGraphData]);

  const nodesById = useMemo(() => {
    const map = new Map<string, GraphNode>();
    activeGraphData.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [activeGraphData.nodes]);

  // Resolve SourceEvidence for any edge in Sample or Enterprise mode
  const resolveEvidenceForEdge = useCallback(
    (edge: GraphEdge): SourceEvidence | undefined => {
      if (dataSource === 'sample') {
        return SAMPLE_EVIDENCE_MAP[edge.id];
      }
      return getEnterpriseSourceEvidence(edge, nodesById) ?? undefined;
    },
    [dataSource, nodesById]
  );

  // Update URL when selectedNode changes so refreshing restores the class
  const syncClassToUrl = useCallback((node: GraphNode | null) => {
    const nextHash = node
      ? `#/investigate?class=${encodeURIComponent(node.name)}`
      : '#/investigate';
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  }, []);

  // Select a node: highlight immediate callers, clear old path & indirect state
  const handleSelectNode = useCallback(
    (node: GraphNode | null) => {
      setSelectedNode(node);
      setSelectedEdge(null);
      setSelectedPathNodeIds(null);
      setShowIndirect(false);
      syncClassToUrl(node);

      if (!node) {
        setImpactAnalysis(null);
        return;
      }

      const analysis = computeImpactAnalysis(
        node,
        activeGraphData,
        dataSource === 'sample'
      );
      setImpactAnalysis(analysis);
    },
    [activeGraphData, dataSource, syncClassToUrl]
  );

  // Restore class from URL on mount and on hashchange
  useEffect(() => {
    const applyUrlState = () => {
      if (!window.location.hash || window.location.hash === '#/start') {
        setRoute('start');
        return;
      }
      if (window.location.hash.startsWith('#/investigate')) {
        setRoute('investigate');
      }
      const params = getUrlParams();
      const modeParam = params.get('source') as DataSourceMode | null;
      if (modeParam && ['sample', 'enterprise', 'live'].includes(modeParam) && modeParam !== dataSource) {
        setDataSource(modeParam);
      }

      const classParam = getUrlClassParam();
      if (classParam && activeGraphData.nodes.length > 0) {
        const target = activeGraphData.nodes.find(
          (n) =>
            n.name.toLowerCase() === classParam.toLowerCase() ||
            n.id.toLowerCase() === classParam.toLowerCase()
        );
        if (target) {
          const analysis = computeImpactAnalysis(
            target,
            activeGraphData,
            dataSource === 'sample'
          );
          setSelectedNode(target);
          setSelectedEdge(null);
          setImpactAnalysis(analysis);

          const wantIndirect = params.get('indirect') === '1' || params.get('indirect') === 'true';
          setShowIndirect(wantIndirect);
          if (wantIndirect && analysis.indirectDependents.length > 0) {
            setSelectedPathNodeIds(analysis.indirectDependents[0].pathIds);
          } else {
            setSelectedPathNodeIds(null);
          }

          const wantEvidence = params.get('evidence') === '1' || params.get('evidence') === 'true';
          if (wantEvidence) {
            if (wantIndirect && analysis.indirectDependents[0]?.evidence) {
              const indDep = analysis.indirectDependents[0];
              const interDep = analysis.directDependents.find(
                (d) => d.node.id === indDep.pathIds[1]
              );
              const hops = [indDep.evidence, interDep?.evidence].filter(
                Boolean
              ) as SourceEvidence[];
              setActiveEvidence(indDep.evidence ?? null);
              setPathEvidenceList(hops);
              setActiveEvidenceIndex(0);
            } else if (analysis.directDependents[0]?.evidence) {
              const dirEv = analysis.directDependents[0].evidence;
              setActiveEvidence(dirEv ?? null);
              setPathEvidenceList([dirEv]);
              setActiveEvidenceIndex(0);
            }
          }
        }
      } else if (!classParam) {
        setSelectedNode(null);
        setSelectedEdge(null);
        setImpactAnalysis(null);
        setShowIndirect(false);
        setSelectedPathNodeIds(null);
      }
    };

    applyUrlState();
    window.addEventListener('hashchange', applyUrlState);
    return () => window.removeEventListener('hashchange', applyUrlState);
  }, [activeGraphData, dataSource]);

  // Global Escape handler: closes Evidence Drawer first, then clears selected node/edge
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeEvidence) {
          setActiveEvidence(null);
        } else if (selectedPathNodeIds) {
          setSelectedPathNodeIds(null);
        } else if (selectedEdge) {
          setSelectedEdge(null);
        } else if (selectedNode) {
          handleSelectNode(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeEvidence, selectedPathNodeIds, selectedEdge, selectedNode, handleSelectNode]);

  // Check live backend health
  const checkLiveBackend = useCallback(async () => {
    setBackendError(null);
    const health = await checkBackendHealth();
    setIsBackendConnected(health.ok);
    if (health.ok) {
      try {
        const live = await fetchLiveGraphData(activeProjectId);
        setLiveGraphData(live);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setLiveGraphData(null);
        setBackendError(msg);
        setIsBackendConnected(false);
      }
    } else {
      setLiveGraphData(null);
      setBackendError(health.message || 'FastAPI backend connection refused');
      setIsBackendConnected(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (dataSource === 'live') {
      checkLiveBackend();
    }
  }, [dataSource, checkLiveBackend]);

  // Reset view action
  const handleReset = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
    setImpactAnalysis(null);
    setShowIndirect(false);
    setSelectedPathNodeIds(null);
    setActiveEvidence(null);
    setPathEvidenceList([]);
    setFitSignal((s) => s + 1);
    syncClassToUrl(null);
  }, [syncClassToUrl]);

  // Switch data source
  const handleSelectDataSource = (mode: DataSourceMode) => {
    setDataSource(mode);
    setSelectedNode(null);
    setSelectedEdge(null);
    setImpactAnalysis(null);
    setShowIndirect(false);
    setSelectedPathNodeIds(null);
    setActiveEvidence(null);
    setPathEvidenceList([]);
    syncClassToUrl(null);
  };

  const handleDomains = useCallback(
    (tags: Record<string, DomainTag>) => {
      setLiveGraphData((current) => {
        if (!current) return current;
        return {
          ...current,
          nodes: current.nodes.map((node) => {
            const tag = tags[node.id];
            return tag
              ? { ...node, domain_tag: tag.domain_tag, domain_inferred: tag.domain_inferred }
              : node;
          }),
        };
      });
    },
    []
  );

  // Open workspace from StartPage
  const handleExploreSample = (className?: string) => {
    setActiveProjectId('demo');
    setDataSource('sample');
    const targetName = className || 'SessionManager';
    const target =
      SAMPLE_GRAPH_DATA.nodes.find(
        (n) => n.name.toLowerCase() === targetName.toLowerCase()
      ) || SAMPLE_GRAPH_DATA.nodes[0];

    if (target) {
      setSelectedNode(target);
      setSelectedEdge(null);
      setShowIndirect(false);
      setSelectedPathNodeIds(null);
      setImpactAnalysis(computeImpactAnalysis(target, SAMPLE_GRAPH_DATA, true));
      syncClassToUrl(target);
    }
    setRoute('investigate');
  };

  // Open Source Evidence Drawer (preserving selectedNode and camera state)
  const handleOpenEvidence = useCallback(
    (evidence: SourceEvidence, pathList?: SourceEvidence[]) => {
      setActiveEvidence(evidence);
      if (pathList && pathList.length > 0) {
        setPathEvidenceList(pathList);
        const idx = pathList.findIndex((p) => p.edgeId === evidence.edgeId);
        setActiveEvidenceIndex(idx >= 0 ? idx : 0);
      } else {
        setPathEvidenceList([evidence]);
        setActiveEvidenceIndex(0);
      }
    },
    []
  );

  const handleSelectEvidenceIndex = (index: number) => {
    const target = pathEvidenceList[index];
    if (target) {
      setActiveEvidence(target);
      setActiveEvidenceIndex(index);
    }
  };

  const handleCustomUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    announceToScreenReader(`Uploaded codebase archive: ${file.name}. Parsing AST.`);
    setBackendError(null);
    try {
      const project = await uploadProject(file);
      syncClassToUrl(null);
      setActiveProjectId(project.id);
      setDataSource('live');
      setRoute('investigate');
    } catch (error) {
      setBackendError(error instanceof Error ? error.message : String(error));
    }
  };

  if (route === 'start') {
    return (
      <div className="min-h-screen w-full overflow-y-auto bg-[#F7F5F0] dark:bg-[#090D16]">
        <div className="sr-only" role="status" aria-live="polite">
          {announcement}
        </div>
        <StartPage
          nodes={activeGraphData.nodes}
          onInvestigate={handleExploreSample}
          onOpenWorkspace={() => handleExploreSample('SessionManager')}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onCustomUpload={handleCustomUpload}
        />
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onUpdateSetting={updateSetting}
          onResetSettings={resetSettings}
        />
      </div>
    );
  }

  const isLiveOffline = dataSource === 'live' && (!isBackendConnected || !liveGraphData);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#F7F5F0] dark:bg-[#090D16] text-[#111827] dark:text-[#F8FAFC] font-sans antialiased">
      {/* 1. Compact Header */}
      <TopBar
        nodes={activeGraphData.nodes}
        selectedNode={selectedNode}
        onSelectNode={handleSelectNode}
        onReset={handleReset}
        onFitGraph={() => setFitSignal((s) => s + 1)}
        dataSource={dataSource}
        onSelectDataSource={handleSelectDataSource}
        isBackendConnected={isBackendConnected}
        viewMode={viewMode}
        onToggleViewMode={(nextMode) =>
          setViewMode((prev) => nextMode || (prev === '2d' ? '3d' : '2d'))
        }
        onBackToStart={() => {
          window.location.hash = '#/start';
          setRoute('start');
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Backend Error Banner when Live API is unreachable */}
      {isLiveOffline && (
        <BackendErrorBanner
          errorMessage={backendError}
          onRetry={checkLiveBackend}
          onSwitchToSample={() => handleSelectDataSource('sample')}
        />
      )}

      {/* Mobile View Switcher (< 768px) */}
      <div className="flex border-b border-[#E4E2DA] bg-white px-4 py-1.5 md:hidden select-none">
        <div className="flex w-full rounded-lg bg-[#F7F5F0] p-0.5 font-sans text-xs">
          <button
            type="button"
            onClick={() => setMobileView('graph')}
            className={`flex-1 rounded-md py-1.5 font-medium transition cursor-pointer ${
              mobileView === 'graph'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            Graph ({activeGraphData.nodes.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileView('details')}
            className={`flex-1 rounded-md py-1.5 font-medium transition cursor-pointer ${
              mobileView === 'details'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            Details {selectedNode ? `(${selectedNode.name})` : ''}
          </button>
        </div>
      </div>

      {/* Main Workspace: 2. Large Interactive Dependency Graph + 3. One Contextual Detail Panel */}
      <main className="relative flex flex-1 overflow-hidden">
        {/* 2. Large Interactive Dependency Graph */}
        <div
          className={`relative h-full flex-1 overflow-hidden ${
            mobileView === 'details' ? 'hidden md:block' : 'block'
          }`}
        >
          {isLiveOffline ? (
            <div className="flex h-full w-full flex-col items-center justify-center bg-[#F7F5F0] p-6 text-center">
              <div className="max-w-md rounded-2xl border border-[#E4E2DA] bg-white p-6 shadow-soft">
                <h2 className="font-sans text-base font-semibold text-slate-900">
                  Live backend unavailable
                </h2>
                <p className="mt-1.5 font-sans text-xs leading-relaxed text-slate-600">
                  No live graph is displayed because the FastAPI server at{' '}
                  <code className="font-mono text-slate-800">http://localhost:8000</code> could not be reached. Mock graphs are never shown under a Live label.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={checkLiveBackend}
                    className="rounded-lg border border-[#DCD9D0] bg-white px-3 py-1.5 font-sans text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                  >
                    Retry connection
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectDataSource('sample')}
                    className="rounded-lg bg-[#3730A3] px-3.5 py-1.5 font-sans text-xs font-semibold text-white hover:bg-[#312E81] cursor-pointer"
                  >
                    Switch to Sample project
                  </button>
                </div>
              </div>
            </div>
          ) : viewMode === '2d' ? (
            <PlanarGraph2D
              nodes={activeGraphData.nodes}
              edges={activeGraphData.edges}
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              impactAnalysis={impactAnalysis}
              showIndirect={showIndirect}
              selectedPathNodeIds={selectedPathNodeIds}
              fitSignal={fitSignal}
              onSelectNode={handleSelectNode}
              onSelectEdge={setSelectedEdge}
              onOpenEvidence={handleOpenEvidence}
              resolveEvidenceForEdge={resolveEvidenceForEdge}
              darkMode={settings.darkMode}
            />
          ) : (
            <CommandGraph3D
              nodes={activeGraphData.nodes}
              edges={activeGraphData.edges}
              clusters={activeGraphData.clusters}
              selectedNode={selectedNode}
              impactAnalysis={impactAnalysis}
              selectedPathNodeIds={selectedPathNodeIds}
              onSelectNode={handleSelectNode}
              onFallbackTo2D={() => setViewMode('2d')}
              reducedMotion={settings.reducedMotion}
            />
          )}

          {/* Mobile Collapsible Bottom Summary Pill when a class is selected on Graph view */}
          {selectedNode && mobileView === 'graph' && (
            <div className="glass-card absolute inset-x-3 bottom-16 z-20 flex items-center justify-between gap-3 rounded-xl p-3 md:hidden">
              <div className="min-w-0">
                <div className="font-mono text-xs font-bold text-slate-900 truncate">
                  {selectedNode.name}
                </div>
                <div className="font-sans text-[11px] text-slate-600 truncate">
                  {impactAnalysis && impactAnalysis.directDependents.length > 0
                    ? `${impactAnalysis.directDependents.length} direct caller${
                        impactAnalysis.directDependents.length === 1 ? '' : 's'
                      }${
                        impactAnalysis.indirectDependents.length > 0
                          ? ` · ${impactAnalysis.indirectDependents.length} indirect`
                          : ''
                      }`
                    : 'No callers found'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileView('details')}
                className="shrink-0 rounded-lg bg-[#3730A3] px-3 py-1.5 font-sans text-xs font-semibold text-white cursor-pointer"
              >
                Details &amp; code →
              </button>
            </div>
          )}
          {!isLiveOffline && dataSource === 'live' && (
            <PetCompanion nodes={activeGraphData.nodes} overallHealth={activeGraphData.overallHealth} />
          )}
        </div>

        {/* 3. Single Contextual Detail Panel */}
        {activeEvidence ? (
          <SourceDrawer
            evidence={activeEvidence}
            pathEvidenceList={pathEvidenceList}
            activeEvidenceIndex={activeEvidenceIndex}
            onSelectEvidenceIndex={handleSelectEvidenceIndex}
            onClose={() => setActiveEvidence(null)}
          />
        ) : (
          <div
            className={`h-full w-full md:w-[360px] lg:w-[420px] shrink-0 border-l border-[#E4E2DA] bg-[#FCFBF8] z-20 ${
              mobileView === 'graph' ? 'hidden md:block' : 'block'
            }`}
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="min-h-0 flex-1">
                <DetailPanel
                  nodes={activeGraphData.nodes}
                  edges={activeGraphData.edges}
                  nodesById={nodesById}
                  selectedNode={selectedNode}
                  selectedEdge={selectedEdge}
                  impactAnalysis={impactAnalysis}
                  showIndirect={showIndirect}
                  onToggleIndirect={setShowIndirect}
                  selectedPathNodeIds={selectedPathNodeIds}
                  onSelectPath={setSelectedPathNodeIds}
                  onSelectNode={handleSelectNode}
                  onSelectEdge={setSelectedEdge}
                  onOpenEvidence={handleOpenEvidence}
                  resolveEvidenceForEdge={resolveEvidenceForEdge}
                />
              </div>
              {!isLiveOffline && dataSource === 'live' && (
                <div className="max-h-[48%] shrink-0 overflow-y-auto border-t border-[#E4E2DA]">
                  <AgentPanel
                    projectId={activeProjectId}
                    selectedNode={selectedNode}
                    onBlast={(result) => {
                      setSelectedPathNodeIds(result.blast_node_ids);
                    }}
                    onDomains={handleDomains}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Screen Reader Live Announcement Region */}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      {/* Accessibility & Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSetting={updateSetting}
        onResetSettings={resetSettings}
      />
    </div>
  );
}

export default App;
