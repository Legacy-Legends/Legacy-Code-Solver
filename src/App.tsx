import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { fetchLiveGraphData, checkBackendHealth } from './api/backendAdapter';
import { StartPage } from './components/StartPage';
import { TopBar } from './components/TopBar';
import { PlanarGraph2D } from './components/PlanarGraph2D';
import { CommandGraph3D } from './components/CommandGraph3D';
import { InvestigateResults } from './components/InvestigateResults';
import { SourceDrawer } from './components/SourceDrawer';
import { BackendErrorBanner } from './components/BackendErrorBanner';

type RouteView = 'start' | 'investigate';

export function App() {
  // Browser History & Route State
  const [route, setRoute] = useState<RouteView>(() => {
    return window.location.hash.startsWith('#/investigate') ? 'investigate' : 'start';
  });

  // Data source mode: 'sample' | 'enterprise' | 'live'
  const [dataSource, setDataSource] = useState<DataSourceMode>('sample');
  const [liveGraphData, setLiveGraphData] = useState<GraphData | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

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
    if (dataSource === 'live' && liveGraphData) {
      return liveGraphData;
    }
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
            setImpactAnalysis(computeImpactAnalysis(target, activeGraphData, dataSource === 'sample'));
          }
        }
      } else {
        setRoute('start');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeGraphData, dataSource]);

  // Check live backend health
  const checkLiveBackend = useCallback(async () => {
    setBackendError(null);
    const health = await checkBackendHealth();
    setIsBackendConnected(health.ok);
    if (health.ok) {
      try {
        const live = await fetchLiveGraphData();
        setLiveGraphData(live);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setBackendError(msg);
        setIsBackendConnected(false);
      }
    } else {
      setBackendError(health.message || 'FastAPI backend connection refused');
      setIsBackendConnected(false);
    }
  }, []);

  useEffect(() => {
    if (dataSource === 'live') {
      checkLiveBackend();
    }
  }, [dataSource, checkLiveBackend]);

  // Navigate to Investigate directly with a class
  const handleInvestigateClass = useCallback(
    (className: string) => {
      const node = activeGraphData.nodes.find((n) => n.name === className) || activeGraphData.nodes[0];
      if (node) {
        setSelectedNode(node);
        const analysis = computeImpactAnalysis(node, activeGraphData, dataSource === 'sample');
        setImpactAnalysis(analysis);
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
      const analysis = computeImpactAnalysis(node, activeGraphData, dataSource === 'sample');
      setImpactAnalysis(analysis);
      setMobileView('results');

      // Update URL silently
      window.history.replaceState(null, '', `#/investigate?class=${encodeURIComponent(node.name)}`);
    },
    [activeGraphData, dataSource]
  );

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

  // VIEW 2: INVESTIGATION WORKSPACE
  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#FAF8F5] text-[#18181B] font-sans parchment-grid">
      {/* Top Header */}
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
      {dataSource === 'live' && !isBackendConnected && (
        <BackendErrorBanner
          errorMessage={backendError}
          onRetry={checkLiveBackend}
          onSwitchToSample={() => handleSelectDataSource('sample')}
        />
      )}

      {/* Mobile Tab Switcher (< 1024px) */}
      <div className="flex px-4 pt-2 pb-1 lg:hidden select-none bg-white border-b border-parchment-border">
        <div className="flex w-full rounded-xl bg-parchment-100 p-1 text-xs font-mono">
          <button
            type="button"
            onClick={() => setMobileView('results')}
            className={`flex-1 rounded-lg py-1.5 transition ${
              mobileView === 'results'
                ? 'bg-white text-plum-900 font-bold shadow-sm'
                : 'text-ink-600'
            }`}
          >
            Results &amp; Proof {selectedNode ? `(${selectedNode.name})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setMobileView('map')}
            className={`flex-1 rounded-lg py-1.5 transition ${
              mobileView === 'map'
                ? 'bg-white text-plum-900 font-bold shadow-sm'
                : 'text-ink-600'
            }`}
          >
            Dependency Map
          </button>
        </div>
      </div>

      {/* Main Investigation Split Layout */}
      <main className="relative flex flex-1 overflow-hidden p-3 sm:p-5 gap-4">
        {/* MAP CANVAS PANE (Flexible large canvas) */}
        <div
          className={`relative h-full flex-1 rounded-2xl overflow-hidden bg-white border border-parchment-border shadow-soft ${
            mobileView === 'results' ? 'hidden lg:block' : 'block'
          }`}
        >
          {viewMode === '2d' ? (
            <PlanarGraph2D
              nodes={activeGraphData.nodes}
              edges={activeGraphData.edges}
              selectedNode={selectedNode}
              impactAnalysis={impactAnalysis}
              selectedPathNodeIds={selectedPathNodeIds}
              onSelectNode={handleSelectNode}
              onOpenEvidence={handleOpenEvidence}
              evidenceMap={SAMPLE_EVIDENCE_MAP}
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

        {/* RESULTS & EVIDENCE PANE (Side-by-side on desktop, readable without graph) */}
        <div
          className={`h-full w-full lg:w-[410px] xl:w-[450px] shrink-0 z-20 ${
            mobileView === 'map' ? 'hidden lg:block' : 'block'
          }`}
        >
          <InvestigateResults
            selectedNode={selectedNode}
            nodesById={nodesById}
            impactAnalysis={impactAnalysis}
            onSelectNode={handleSelectNode}
            onOpenEvidence={handleOpenEvidence}
            selectedPathNodeIds={selectedPathNodeIds}
            onSelectPath={setSelectedPathNodeIds}
          />
        </div>

        {/* SOURCE EVIDENCE DRAWER OVERLAY */}
        <SourceDrawer
          evidence={activeEvidence}
          pathEvidenceList={pathEvidenceList}
          activeEvidenceIndex={activeEvidenceIndex}
          onSelectEvidenceIndex={handleSelectEvidenceIndex}
          onClose={() => setActiveEvidence(null)}
        />
      </main>
    </div>
  );
}

export default App;
