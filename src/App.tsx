import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import rawGraphData from './mocks/graph.json';
import {
  GraphData,
  GraphNode,
  DataSourceMode,
  ImpactAnalysis,
  SourceEvidence,
} from './types/index';
import { SAMPLE_GRAPH_DATA, SAMPLE_EVIDENCE_MAP } from './data/sampleProject';
import { computeImpactAnalysis } from './lib/impactAnalysis';
import { fetchLiveGraphData, fetchLiveImpact, BackendBlastResult, DomainTag } from './api/backendAdapter';
import { AgentPanel } from './components/AgentPanel';
import { StartPage } from './components/StartPage';
import { TopBar } from './components/TopBar';
import { WorkspaceSidebar, InvestigationTab } from './components/WorkspaceSidebar';
import { PlanarGraph2D } from './components/PlanarGraph2D';
import { CommandGraph3D } from './components/CommandGraph3D';
import { InvestigateResults } from './components/InvestigateResults';
import { SourceDrawer } from './components/SourceDrawer';
import { BackendErrorBanner } from './components/BackendErrorBanner';

const EMPTY_GRAPH: GraphData = { nodes: [], edges: [], clusters: [], overallHealth: 0 };

type RouteView = 'start' | 'investigate';

export function App() {
  // Browser History & Route State
  const [route, setRoute] = useState<RouteView>(() => {
    return window.location.hash.startsWith('#/investigate') ? 'investigate' : 'start';
  });

  // Active investigation view tab in sidebar: 'graph' | 'hierarchy' | 'blast'
  const [activeTab, setActiveTab] = useState<InvestigationTab>('graph');

  // Data source mode: 'sample' | 'enterprise' | 'live'
  const [dataSource, setDataSource] = useState<DataSourceMode>('sample');
  const [liveGraphData, setLiveGraphData] = useState<GraphData | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactRetry, setImpactRetry] = useState(0);
  const graphRequest = useRef<AbortController>();

  // Canvas Mode: '2d' (Parchment map) | '3d' (Orbit)
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');

  // Mobile layout switch: 'results' | 'map'
  const [mobileView, setMobileView] = useState<'results' | 'map'>('results');

  // Investigation & Selection State
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [impactAnalysis, setImpactAnalysis] = useState<ImpactAnalysis | null>(null);
  const [selectedPathNodeIds, setSelectedPathNodeIds] = useState<string[] | null>(null);

  // Evidence Drawer State
  const [activeEvidence, setActiveEvidence] = useState<SourceEvidence | null>(null);
  const [pathEvidenceList, setPathEvidenceList] = useState<SourceEvidence[]>([]);
  const [activeEvidenceIndex, setActiveEvidenceIndex] = useState(0);

  // Active Graph Data based on Mode
  const activeGraphData = useMemo<GraphData>(() => {
    if (dataSource === 'sample') {
      return JSON.parse(JSON.stringify(SAMPLE_GRAPH_DATA)) as GraphData;
    }
    if (dataSource === 'live') return liveGraphData || EMPTY_GRAPH;
    return JSON.parse(JSON.stringify(rawGraphData)) as GraphData;
  }, [dataSource, liveGraphData]);

  const nodesById = useMemo(() => {
    const map = new Map<string, GraphNode>();
    activeGraphData.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [activeGraphData.nodes]);

  // Sync route with browser hash for native Back / Forward button support
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/investigate')) {
        setRoute('investigate');
        // Parse target class name from query param if available
        const params = new URLSearchParams(hash.split('?')[1] || '');
        const targetClass = params.get('class');
        if (targetClass) {
          const target = activeGraphData.nodes.find((n) => n.name === targetClass);
          if (target) {
            setSelectedNode(target);
            if (dataSource !== 'live') setImpactAnalysis(computeImpactAnalysis(target, activeGraphData, dataSource === 'sample'));
          }
        } else if (!selectedNode && activeGraphData.nodes.length > 0) {
          const defaultTarget =
            activeGraphData.nodes.find((n) => n.name === 'SessionManager') || activeGraphData.nodes[0];
          setSelectedNode(defaultTarget);
          if (dataSource !== 'live') setImpactAnalysis(computeImpactAnalysis(defaultTarget, activeGraphData, dataSource === 'sample'));
        }
      } else {
        setRoute('start');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeGraphData, dataSource, selectedNode]);

  const checkLiveBackend = useCallback(async () => {
    graphRequest.current?.abort();
    const controller = new AbortController();
    graphRequest.current = controller;
    setBackendError(null);
    setIsBackendConnected(false);
    setLiveGraphData(null);
    setSelectedNode(null);
    setImpactAnalysis(null);
    try {
      const graph = await fetchLiveGraphData('demo', controller.signal);
      if (!controller.signal.aborted) {
        setLiveGraphData(graph);
        setIsBackendConnected(true);
      }
    } catch (error) {
      if (!controller.signal.aborted) setBackendError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    if (dataSource === 'live') void checkLiveBackend();
    return () => graphRequest.current?.abort();
  }, [dataSource, checkLiveBackend]);

  useEffect(() => {
    setImpactError(null);
    if (dataSource !== 'live' || !selectedNode || !liveGraphData) {
      setImpactLoading(false);
      return;
    }
    const controller = new AbortController();
    setImpactAnalysis(null);
    setImpactLoading(true);
    fetchLiveImpact(selectedNode.id, 'demo', controller.signal).then(result => {
      if (!controller.signal.aborted) setImpactAnalysis(result);
    }).catch(error => {
      if (!controller.signal.aborted) setImpactError(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (!controller.signal.aborted) setImpactLoading(false);
    });
    return () => controller.abort();
  }, [dataSource, selectedNode?.id, liveGraphData, impactRetry]);

  // Navigate to Investigate directly with a class
  const handleInvestigateClass = useCallback(
    (className: string) => {
      const node = activeGraphData.nodes.find((n) => n.name === className) || activeGraphData.nodes[0];
      if (node) {
        setSelectedNode(node);
        const analysis = dataSource === 'live' ? null : computeImpactAnalysis(node, activeGraphData, dataSource === 'sample');
        if (dataSource !== 'live') setImpactAnalysis(analysis);
        setSelectedPathNodeIds(null);
        setActiveEvidence(null);
        setRoute('investigate');
        window.location.hash = `#/investigate?class=${encodeURIComponent(node.name)}`;
      }
    },
    [activeGraphData, dataSource]
  );

  // Navigate Back to Start
  const handleBackToStart = useCallback(() => {
    setRoute('start');
    window.location.hash = '#/';
  }, []);

  // Reset action inside workspace
  const handleReset = useCallback(() => {
    setSelectedNode(null);
    setImpactAnalysis(null);
    setSelectedPathNodeIds(null);
    setActiveEvidence(null);
    setPathEvidenceList([]);
  }, []);

  // Switch dataset
  const handleSelectDataSource = (mode: DataSourceMode) => {
    if (mode === dataSource) return;
    graphRequest.current?.abort();
    setLiveGraphData(null);
    setDataSource(mode);
    handleReset();
  };

  // Node selection inside workspace
  const handleSelectNode = useCallback(
    (node: GraphNode | null) => {
      setSelectedNode(node);
      setSelectedPathNodeIds(null);

      if (!node) {
        setImpactAnalysis(null);
        return;
      }

      // Compute impact immediately so user does not need to click "Trace"
      const analysis = dataSource === 'live' ? null : computeImpactAnalysis(node, activeGraphData, dataSource === 'sample');
      if (dataSource !== 'live') setImpactAnalysis(analysis);
      setMobileView('results');

      // Update URL silently
      window.history.replaceState(null, '', `#/investigate?class=${encodeURIComponent(node.name)}`);
    },
    [activeGraphData, dataSource]
  );

  const handleBlast = (result: BackendBlastResult) => {
    const first = activeGraphData.nodes.find(node => node.id === result.matched_node_ids[0]);
    if (first) handleSelectNode(first);
    setSelectedPathNodeIds(result.blast_node_ids);
  };

  const handleDomains = (tags: Record<string, DomainTag>) => {
    setLiveGraphData(graph => graph ? {
      ...graph, nodes: graph.nodes.map(node => ({ ...node, ...tags[node.id] })),
    } : graph);
  };

  // Open Source Evidence Drawer
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

  // Ensure default node is selected if in investigate mode
  useEffect(() => {
    if (route === 'investigate' && !selectedNode && activeGraphData.nodes.length > 0) {
      const defaultTarget =
        activeGraphData.nodes.find((n) => n.name === 'SessionManager') || activeGraphData.nodes[0];
      setSelectedNode(defaultTarget);
      if (dataSource !== 'live') setImpactAnalysis(computeImpactAnalysis(defaultTarget, activeGraphData, dataSource === 'sample'));
    }
  }, [route, selectedNode, activeGraphData, dataSource]);

  // VIEW 1: START LANDING PAGE
  if (route === 'start') {
    return (
      <StartPage
        nodes={activeGraphData.nodes}
        onInvestigate={handleInvestigateClass}
        onOpenWorkspace={() => handleInvestigateClass('SessionManager')}
      />
    );
  }

  // VIEW 2: INVESTIGATION WORKSPACE (Page 2)
  return (
    <div className="bg-[#FAF9F5] text-slate-900 font-sans min-h-screen flex antialiased overflow-hidden selection:bg-emerald-200 selection:text-emerald-950">
      {/* Left Workspace Sidebar */}
      <div className="hidden md:flex h-screen shrink-0">
        <WorkspaceSidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          selectedNode={selectedNode}
          nodes={activeGraphData.nodes}
          onSelectNode={handleSelectNode}
          impactAnalysis={impactAnalysis}
          workspaceName={dataSource === 'live' ? 'Backend demo' : 'Local sample'}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Bar */}
        <TopBar
          nodes={activeGraphData.nodes}
          selectedNode={selectedNode}
          onSelectNode={handleSelectNode}
          onReset={handleReset}
          dataSource={dataSource}
          onSelectDataSource={handleSelectDataSource}
          isBackendConnected={isBackendConnected}
          viewMode={viewMode}
          onToggleViewMode={() => setViewMode((m) => (m === '2d' ? '3d' : '2d'))}
          onBackToStart={handleBackToStart}
        />

        {/* Backend Error Banner if in Live API mode and offline */}
        {dataSource === 'live' && !isBackendConnected && backendError && (
          <BackendErrorBanner
            errorMessage={backendError}
            onRetry={checkLiveBackend}
            onSwitchToSample={() => handleSelectDataSource('sample')}
          />
        )}

        {dataSource === 'live' && !isBackendConnected && !backendError && (
          <p role="status" className="p-3 text-sm">Loading backend graph…</p>
        )}

        {/* Mobile Tab Switcher (< 768px) */}
        <div className="flex px-4 py-2 md:hidden select-none bg-white border-b border-slate-200">
          <div className="flex w-full rounded-xl bg-slate-100 p-1 text-xs font-mono">
            <button
              type="button"
              onClick={() => setMobileView('results')}
              className={`flex-1 rounded-lg py-1.5 transition ${
                mobileView === 'results'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              Results {selectedNode ? `(${selectedNode.name})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setMobileView('map')}
              className={`flex-1 rounded-lg py-1.5 transition ${
                mobileView === 'map'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              Map Canvas
            </button>
          </div>
        </div>

        {/* Workspace Grid */}
        <div className="flex-1 flex overflow-hidden">
          {/* Center Canvas: Findings & AST Topology */}
          <main className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6">
            {dataSource === 'live' && liveGraphData && isBackendConnected && (
              <AgentPanel selectedNode={selectedNode} onBlast={handleBlast} onDomains={handleDomains} />
            )}
            {selectedNode && nodesById.get(selectedNode.id)?.domain_tag && (
              <p className="text-sm text-emerald-800">Inferred domain: {nodesById.get(selectedNode.id)?.domain_tag}</p>
            )}
            {impactLoading && <p role="status">Computing impact on the server…</p>}
            {impactError && <div className="text-red-700">
              <p role="alert">{impactError}</p>
              <button className="mt-2 rounded border px-3 py-1 text-sm" onClick={() => setImpactRetry(value => value + 1)}>Retry impact</button>
            </div>}
            {(dataSource !== 'live' || impactAnalysis) && <InvestigateResults
              selectedNode={selectedNode}
              nodesById={nodesById}
              impactAnalysis={impactAnalysis}
              onSelectNode={handleSelectNode}
              onOpenEvidence={handleOpenEvidence}
              selectedPathNodeIds={selectedPathNodeIds}
              onSelectPath={setSelectedPathNodeIds}
              activeTab={activeTab}
              edges={activeGraphData.edges}
              evidenceMap={dataSource === 'sample' ? SAMPLE_EVIDENCE_MAP : {}}
            />}

            {/* Interactive Topological Canvas (Integrated directly below relationship flow) */}
            <div className="glass-card rounded-2xl overflow-hidden border border-slate-200/80 shadow-soft">
              <div className="px-6 py-3.5 bg-white border-b border-slate-200/80 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    AST Graph Topology ({viewMode.toUpperCase()})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Interactive canvas. Drag to pan, scroll to zoom, click any node to trace callers.
                  </p>
                </div>
                <div className="text-[11px] font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded">
                  {activeGraphData.nodes.length} indexed classes · {activeGraphData.edges.length} calls
                </div>
              </div>
              <div className="h-[420px] w-full bg-[#FAF9F5]">
                {viewMode === '2d' ? (
                  <PlanarGraph2D
                    nodes={activeGraphData.nodes}
                    edges={activeGraphData.edges}
                    selectedNode={selectedNode}
                    impactAnalysis={impactAnalysis}
                    selectedPathNodeIds={selectedPathNodeIds}
                    onSelectNode={handleSelectNode}
                    onOpenEvidence={handleOpenEvidence}
                    evidenceMap={dataSource === 'sample' ? SAMPLE_EVIDENCE_MAP : {}}
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
                  />
                )}
              </div>
            </div>
          </main>

          {/* Right Docked Evidence Drawer */}
          <SourceDrawer
            evidence={activeEvidence}
            pathEvidenceList={pathEvidenceList}
            activeEvidenceIndex={activeEvidenceIndex}
            onSelectEvidenceIndex={handleSelectEvidenceIndex}
            onClose={() => setActiveEvidence(null)}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
