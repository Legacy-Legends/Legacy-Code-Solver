import { useState, useMemo, useEffect, useCallback } from 'react';
import rawGraphData from './mocks/graph.json';
import { GraphData, GraphNode, GraphEdge, ImpactAnalysis, SourceEvidence } from './types/index';
import { SAMPLE_EVIDENCE_MAP } from './data/sampleProject';
import { computeImpactAnalysis } from './lib/impactAnalysis';
import { StartPage } from './components/StartPage';
import { TopBar } from './components/TopBar';
import { PlanarGraph2D } from './components/PlanarGraph2D';
import { CommandGraph3D } from './components/CommandGraph3D';
import { DetailPanel } from './components/DetailPanel';
import { SourceDrawer } from './components/SourceDrawer';
import { SettingsModal } from './components/SettingsModal';
import { useAccessibilitySettings, registerAnnouncer, announceToScreenReader } from './lib/accessibilityStore';
import { AgentPanel } from './components/AgentPanel';
import { PetCompanion } from './components/PetCompanion';

type RouteView = 'start' | 'investigate';

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

export function App() {
  const { settings, updateSetting, resetSettings } = useAccessibilitySettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    registerAnnouncer((msg: string) => setAnnouncement(msg));
  }, []);

  const [route, setRoute] = useState<RouteView>(() => {
    if (window.location.hash.startsWith('#/investigate')) return 'investigate';
    return 'start';
  });

  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [fitSignal, setFitSignal] = useState(0);
  const [mobileView, setMobileView] = useState<'graph' | 'details'>('graph');

  // Interactive Graph State
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [impactAnalysis, setImpactAnalysis] = useState<ImpactAnalysis | null>(null);
  const [showIndirect, setShowIndirect] = useState(false);
  const [selectedPathNodeIds, setSelectedPathNodeIds] = useState<string[] | null>(null);

  // Evidence Drawer & Agent State
  const [activeEvidence, setActiveEvidence] = useState<SourceEvidence | null>(null);
  const [pathEvidenceList, setPathEvidenceList] = useState<SourceEvidence[]>([]);
  const [activeEvidenceIndex, setActiveEvidenceIndex] = useState(0);
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [hoveredProposalHealth, setHoveredProposalHealth] = useState<number | null>(null);

  // Force single mock dataset as requested
  const [activeGraphData] = useState<GraphData>(() => JSON.parse(JSON.stringify(rawGraphData)));

  const nodesById = useMemo(() => {
    const map = new Map<string, GraphNode>();
    activeGraphData.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [activeGraphData.nodes]);

  const resolveEvidenceForEdge = useCallback((edge: GraphEdge): SourceEvidence | undefined => {
    return SAMPLE_EVIDENCE_MAP[edge.id];
  }, []);

  const syncClassToUrl = useCallback((node: GraphNode | null) => {
    const nextHash = node ? `#/investigate?class=${encodeURIComponent(node.name)}` : '#/investigate';
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  }, []);

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

      const analysis = computeImpactAnalysis(node, activeGraphData, true);
      setImpactAnalysis(analysis);
    },
    [activeGraphData, syncClassToUrl]
  );

  useEffect(() => {
    const applyUrlState = () => {
      if (!window.location.hash || window.location.hash === '#/start') {
        setRoute('start');
        return;
      }
      if (window.location.hash.startsWith('#/investigate')) setRoute('investigate');

      const classParam = getUrlClassParam();
      if (classParam && activeGraphData.nodes.length > 0) {
        const target = activeGraphData.nodes.find(
          (n) => n.name.toLowerCase() === classParam.toLowerCase() || n.id.toLowerCase() === classParam.toLowerCase()
        );
        if (target) {
          setSelectedNode(target);
          setImpactAnalysis(computeImpactAnalysis(target, activeGraphData, true));
        }
      }
    };
    applyUrlState();
    window.addEventListener('hashchange', applyUrlState);
    return () => window.removeEventListener('hashchange', applyUrlState);
  }, [activeGraphData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeEvidence) setActiveEvidence(null);
        else if (selectedPathNodeIds) setSelectedPathNodeIds(null);
        else if (selectedEdge) setSelectedEdge(null);
        else if (selectedNode) handleSelectNode(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeEvidence, selectedPathNodeIds, selectedEdge, selectedNode, handleSelectNode]);

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

  const handleExploreSample = (className?: string) => {
    const targetName = className || activeGraphData.nodes[0]?.name;
    const target = activeGraphData.nodes.find((n) => n.name.toLowerCase() === targetName.toLowerCase()) || activeGraphData.nodes[0];
    if (target) {
      setSelectedNode(target);
      setImpactAnalysis(computeImpactAnalysis(target, activeGraphData, true));
      syncClassToUrl(target);
    }
    setRoute('investigate');
  };

  const handleOpenEvidence = useCallback((evidence: SourceEvidence, pathList?: SourceEvidence[]) => {
    setActiveEvidence(evidence);
    if (pathList && pathList.length > 0) {
      setPathEvidenceList(pathList);
      const idx = pathList.findIndex((p) => p.edgeId === evidence.edgeId);
      setActiveEvidenceIndex(idx >= 0 ? idx : 0);
    } else {
      setPathEvidenceList([evidence]);
      setActiveEvidenceIndex(0);
    }
  }, []);

  const handleCustomUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    announceToScreenReader(`Uploaded codebase archive: ${file.name}. Parsing AST.`);
    setTimeout(() => {
      syncClassToUrl(null);
      setRoute('investigate');
    }, 1500);
  };

  if (route === 'start') {
    return (
      <div className="min-h-screen w-full overflow-y-auto bg-[#F7F5F0] dark:bg-[#090D16]">
        <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
        <StartPage
          nodes={activeGraphData.nodes}
          onInvestigate={handleExploreSample}
          onOpenWorkspace={() => handleExploreSample()}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onCustomUpload={handleCustomUpload}
        />
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdateSetting={updateSetting} onResetSettings={resetSettings} />
      </div>
    );
  }

  // Sidebar is only taking up space if something is selected OR if the agent is open.
  const isSidebarOpen = selectedNode !== null || selectedEdge !== null || activeEvidence !== null || isAgentOpen;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#F7F5F0] dark:bg-[#090D16] text-[#111827] dark:text-[#F8FAFC] font-sans antialiased">
      <TopBar
        nodes={activeGraphData.nodes}
        selectedNode={selectedNode}
        onSelectNode={handleSelectNode}
        onReset={handleReset}
        onFitGraph={() => setFitSignal((s) => s + 1)}
        viewMode={viewMode}
        onToggleViewMode={(nextMode) => setViewMode((prev) => nextMode || (prev === '2d' ? '3d' : '2d'))}
        onBackToStart={() => { window.location.hash = '#/start'; setRoute('start'); }}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <div className="flex border-b border-white/60 dark:border-white/10 bg-white/65 dark:bg-slate-900/65 backdrop-blur-xl px-4 py-1.5 md:hidden select-none">
        <div className="glass-pill flex w-full rounded-xl p-0.5 font-sans text-xs">
          <button type="button" onClick={() => setMobileView('graph')} className={`flex-1 rounded-lg py-1.5 font-medium transition cursor-pointer ${mobileView === 'graph' ? 'bg-white/90 dark:bg-slate-800/90 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400'}`}>Graph</button>
          <button type="button" onClick={() => setMobileView('details')} className={`flex-1 rounded-lg py-1.5 font-medium transition cursor-pointer ${mobileView === 'details' ? 'bg-white/90 dark:bg-slate-800/90 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400'}`}>Details</button>
        </div>
      </div>

      <main className="relative flex flex-1 overflow-hidden">
        {/* Dynamic Width Canvas: Expands to full screen when sidebar collapses */}
        <div className={`relative h-full flex-1 overflow-hidden transition-all duration-300 ease-in-out ${mobileView === 'details' ? 'hidden md:block' : 'block'}`}>
          {viewMode === '2d' ? (
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

          {/* Draggable Pet is now a standalone trigger inside the graph canvas */}
          <PetCompanion
            nodes={activeGraphData.nodes}
            overallHealth={activeGraphData.overallHealth}
            isOpen={isAgentOpen}
            onToggle={() => setIsAgentOpen((v) => !v)}
            hoverDelta={hoveredProposalHealth}
          />
        </div>

        {/* Dynamic Sidebar Container */}
        {isSidebarOpen && (
          <div className={`h-full w-full md:w-[360px] lg:w-[420px] shrink-0 border-l border-white/60 dark:border-white/10 bg-white/65 dark:bg-slate-900/60 backdrop-blur-2xl backdrop-saturate-150 shadow-[-8px_0_32px_-4px_rgba(15,23,42,0.06)] dark:shadow-[-12px_0_40px_-4px_rgba(0,0,0,0.6)] z-20 transition-all duration-300 ${mobileView === 'graph' ? 'hidden md:block' : 'block'}`}>
            <div className="flex h-full min-h-0 flex-col">
              {activeEvidence ? (
                <SourceDrawer
                  evidence={activeEvidence}
                  pathEvidenceList={pathEvidenceList}
                  activeEvidenceIndex={activeEvidenceIndex}
                  onSelectEvidenceIndex={(i) => { setActiveEvidence(pathEvidenceList[i]); setActiveEvidenceIndex(i); }}
                  onClose={() => setActiveEvidence(null)}
                />
              ) : (
                <>
                  {/* If a node is selected, show its details on top */}
                  {(selectedNode || selectedEdge) && (
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
                  )}

                  {/* If Agent is toggled ON, show it (either stacked below details or full-height) */}
                  {isAgentOpen && (
                    <div className={`shrink-0 overflow-y-auto ${selectedNode || selectedEdge ? 'max-h-[48%] border-t border-white/60 dark:border-white/10 p-3' : 'h-full p-4'}`}>
                      <AgentPanel
                        projectId="demo"
                        selectedNode={selectedNode}
                        onBlast={(result) => setSelectedPathNodeIds(result.blast_node_ids)}
                        hoveredProposalHealth={setHoveredProposalHealth}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>

      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdateSetting={updateSetting} onResetSettings={resetSettings} />
    </div>
  );
}

export default App;