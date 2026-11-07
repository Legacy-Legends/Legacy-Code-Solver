import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import rawGraphData from './mocks/graph.json';
import {
  GraphData,
  GraphNode,
  DataSourceMode,
  ImpactAnalysis,
  SourceEvidence,
} from './types/index';
import { SAMPLE_GRAPH_DATA } from './data/sampleProject';
import { computeImpactAnalysis } from './lib/impactAnalysis';
import { fetchLiveGraphData, checkBackendHealth } from './api/backendAdapter';
import { TopBar } from './components/TopBar';
import { CommandGraph3D } from './components/CommandGraph3D';
import { PlanarGraph2D } from './components/PlanarGraph2D';
import { RightInspector } from './components/RightInspector';
import { SourceDrawer } from './components/SourceDrawer';
import { BackendErrorBanner } from './components/BackendErrorBanner';

export function App() {
  // Data source mode: 'sample' | 'enterprise' | 'live'
  const [dataSource, setDataSource] = useState<DataSourceMode>('sample');
  const [liveGraphData, setLiveGraphData] = useState<GraphData | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  // View mode: '3d' | '2d'
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');

  // Mobile layout tab: 'graph' | 'inspector'
  const [mobileTab, setMobileTab] = useState<'graph' | 'inspector'>('graph');

  // Selection & Investigation State
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [impactAnalysis, setImpactAnalysis] = useState<ImpactAnalysis | null>(null);
  const [isTracing, setIsTracing] = useState(false);
  const [selectedPathNodeIds, setSelectedPathNodeIds] = useState<string[] | null>(null);

  // Evidence Drawer State
  const [activeEvidence, setActiveEvidence] = useState<SourceEvidence | null>(null);
  const [pathEvidenceList, setPathEvidenceList] = useState<SourceEvidence[]>([]);
  const [activeEvidenceIndex, setActiveEvidenceIndex] = useState(0);

  // Active Request Tracking (avoids race condition when selecting classes rapidly)
  const activeRequestId = useRef(0);

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

  // Lookup map of nodes by ID
  const nodesById = useMemo(() => {
    const map = new Map<string, GraphNode>();
    activeGraphData.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [activeGraphData.nodes]);

  // Check live backend health when switched to 'live'
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

  // Reset view action
  const handleReset = useCallback(() => {
    setSelectedNode(null);
    setImpactAnalysis(null);
    setSelectedPathNodeIds(null);
    setActiveEvidence(null);
    setPathEvidenceList([]);
  }, []);

  // When changing data source, reset investigation
  const handleSelectDataSource = (mode: DataSourceMode) => {
    setDataSource(mode);
    handleReset();
  };

  // Select a node: update selectedNode, switch mobile view, reset active path
  const handleSelectNode = useCallback(
    (node: GraphNode | null) => {
      setSelectedNode(node);
      setSelectedPathNodeIds(null);

      // If clicking background or deselecting, clear trace
      if (!node) {
        setImpactAnalysis(null);
        return;
      }

      // If a new node is selected while another was traced, clear previous trace immediately
      setImpactAnalysis(null);
      setMobileTab('inspector');
    },
    []
  );

  // Trace Impact Action
  const handleTraceImpact = useCallback(() => {
    if (!selectedNode) return;

    setIsTracing(true);
    const reqId = ++activeRequestId.current;

    // Simulate minor async tick so UI shows tracing feedback cleanly
    setTimeout(() => {
      // Race condition check: ensure user didn't switch to a different node in the interim
      if (reqId !== activeRequestId.current) return;

      const analysis = computeImpactAnalysis(
        selectedNode,
        activeGraphData,
        dataSource === 'sample'
      );

      setImpactAnalysis(analysis);
      setIsTracing(false);
    }, 180);
  }, [selectedNode, activeGraphData, dataSource]);

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

  // Switch between hops in a multi-hop evidence path
  const handleSelectEvidenceIndex = (index: number) => {
    const target = pathEvidenceList[index];
    if (target) {
      setActiveEvidence(target);
      setActiveEvidenceIndex(index);
    }
  };

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#050811] text-slate-100 font-sans">
      {/* Top Navigation Bar */}
      <TopBar
        nodes={activeGraphData.nodes}
        selectedNode={selectedNode}
        onSelectNode={handleSelectNode}
        onReset={handleReset}
        dataSource={dataSource}
        onSelectDataSource={handleSelectDataSource}
        isBackendConnected={isBackendConnected}
        viewMode={viewMode}
        onToggleViewMode={() => setViewMode((m) => (m === '3d' ? '2d' : '3d'))}
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
      <div className="flex border-b border-slate-800 bg-[#080d1a] px-4 py-1.5 lg:hidden select-none">
        <div className="flex w-full rounded-lg border border-slate-800 bg-slate-900/80 p-0.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => setMobileTab('graph')}
            className={`flex-1 rounded py-1 transition ${
              mobileTab === 'graph'
                ? 'bg-slate-800 text-cyan-300 shadow'
                : 'text-slate-400'
            }`}
          >
            Graph Canvas
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('inspector')}
            className={`flex-1 rounded py-1 transition ${
              mobileTab === 'inspector'
                ? 'bg-slate-800 text-cyan-300 shadow'
                : 'text-slate-400'
            }`}
          >
            Inspector {selectedNode ? `(${selectedNode.name})` : ''}
          </button>
        </div>
      </div>

      {/* Main Workspace Area */}
      <main className="relative flex flex-1 overflow-hidden">
        {/* GRAPH CANVAS REGION (Dominant workspace area) */}
        <div
          className={`relative h-full flex-1 overflow-hidden transition-all duration-300 ${
            mobileTab === 'inspector' ? 'hidden lg:block' : 'block'
          }`}
        >
          {viewMode === '3d' ? (
            <CommandGraph3D
              nodes={activeGraphData.nodes}
              edges={activeGraphData.edges}
              clusters={activeGraphData.clusters}
              selectedNode={selectedNode}
              impactAnalysis={impactAnalysis}
              selectedPathNodeIds={selectedPathNodeIds}
              onSelectNode={handleSelectNode}
            />
          ) : (
            <PlanarGraph2D
              nodes={activeGraphData.nodes}
              edges={activeGraphData.edges}
              selectedNode={selectedNode}
              impactAnalysis={impactAnalysis}
              selectedPathNodeIds={selectedPathNodeIds}
              onSelectNode={handleSelectNode}
            />
          )}
        </div>

        {/* RIGHT INSPECTOR REGION (Visible side-by-side on laptop screens >= 1024px) */}
        <div
          className={`h-full w-full lg:w-[380px] xl:w-[410px] shrink-0 border-l border-slate-800/90 z-20 ${
            mobileTab === 'graph' ? 'hidden lg:block' : 'block'
          }`}
        >
          <RightInspector
            selectedNode={selectedNode}
            nodesById={nodesById}
            impactAnalysis={impactAnalysis}
            isTracing={isTracing}
            onTraceImpact={handleTraceImpact}
            onSelectNode={handleSelectNode}
            onOpenEvidence={handleOpenEvidence}
            selectedPathNodeIds={selectedPathNodeIds}
            onSelectPath={setSelectedPathNodeIds}
            onClose={() => handleSelectNode(null)}
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
