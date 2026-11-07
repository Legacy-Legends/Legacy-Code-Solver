import { useMemo, useState, useEffect } from 'react';
import { Terminal } from 'lucide-react';
import rawGraphData from './mocks/graph.json';
import { GraphData, GraphNode } from './types';
import { CommandGraph3D } from './components/CommandGraph3D';
import { StatsCard } from './components/StatsCard';
import { NodeDrawer } from './components/NodeDrawer';

export function App() {
  // Clone graph data once so ForceGraph3D can mutate x/y/z coordinates safely
  const graphData = useMemo<GraphData>(() => {
    return JSON.parse(JSON.stringify(rawGraphData)) as GraphData;
  }, []);

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const nodesById = useMemo(() => {
    const map = new Map<string, GraphNode>();
    graphData.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [graphData.nodes]);

  const { healthyCount, moderateCount, sickCount } = useMemo(() => {
    let healthy = 0;
    let moderate = 0;
    let sick = 0;
    for (const n of graphData.nodes) {
      if (n.health >= 70) healthy++;
      else if (n.health >= 40) moderate++;
      else sick++;
    }
    return { healthyCount: healthy, moderateCount: moderate, sickCount: sick };
  }, [graphData.nodes]);

  // Close drawer on Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNode(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#050811] text-slate-100 select-none">
      {/* 3D Force-Directed Graph Canvas */}
      <CommandGraph3D
        nodes={graphData.nodes}
        edges={graphData.edges}
        clusters={graphData.clusters}
        selectedNode={selectedNode}
        onSelectNode={setSelectedNode}
      />

      {/* Subtle Command-Center Grid & Radial Vignette Overlay (non-interactive) */}
      <div className="pointer-events-none fixed inset-0 z-10 command-grid-overlay opacity-40" />
      <div
        className="pointer-events-none fixed inset-0 z-10"
        style={{
          background:
            'radial-gradient(circle at center, transparent 52%, rgba(3, 6, 14, 0.72) 100%)',
        }}
      />

      {/* Top-Left Command Center HUD Identifier & Health Legend */}
      <header className="pointer-events-none fixed left-5 top-5 z-20 flex flex-col gap-2">
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-800/80 bg-[#080d1a]/85 px-3.5 py-2.5 shadow-lg backdrop-blur-md">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-teal-500/30 bg-teal-500/10 text-teal-300">
            <Terminal className="h-4 w-4" />
          </div>
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-100">
              AETHER // Command Center
            </div>
            <div className="font-mono text-[10px] text-slate-400">
              3D Legacy Dependency &amp; Code-Health Topology · Click any node to inspect
            </div>
          </div>
        </div>

        {/* Non-Red Health Visual Key */}
        <div className="flex items-center gap-3 rounded-lg border border-slate-800/70 bg-[#080d1a]/75 px-3 py-1.5 font-mono text-[10px] text-slate-400 backdrop-blur-md">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#00f5d4] shadow-[0_0_8px_#00f5d4]" />
            Healthy (70–100)
          </span>
          <span className="text-slate-700">|</span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#2dd4bf]" />
            Moderate (40–69)
          </span>
          <span className="text-slate-700">|</span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#8c642b]" />
            Sick (0–39 · Dim Amber)
          </span>
        </div>
      </header>

      {/* Top-Right Stats Card */}
      <StatsCard
        overallHealth={graphData.overallHealth}
        nodeCount={graphData.nodes.length}
        edgeCount={graphData.edges.length}
        clusterCount={graphData.clusters.length}
        healthyCount={healthyCount}
        moderateCount={moderateCount}
        sickCount={sickCount}
        isDrawerOpen={Boolean(selectedNode)}
      />

      {/* Right-Side Node Details Drawer */}
      <NodeDrawer
        node={selectedNode}
        edges={graphData.edges}
        nodesById={nodesById}
        onClose={() => setSelectedNode(null)}
        onSelectNode={(target) => setSelectedNode(target)}
      />
    </main>
  );
}

export default App;
