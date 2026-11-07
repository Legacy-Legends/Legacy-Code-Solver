import React, { useMemo, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { GraphNode, GraphEdge, ImpactAnalysis } from '../types/index';
import { getHealthVisuals } from '../lib/healthColor';

interface PlanarGraph2DProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNode: GraphNode | null;
  impactAnalysis: ImpactAnalysis | null;
  selectedPathNodeIds: string[] | null;
  onSelectNode: (node: GraphNode | null) => void;
  onFitView?: () => void;
}

function resolveId(endpoint: string | GraphNode): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.id;
}

export const PlanarGraph2D: React.FC<PlanarGraph2DProps> = ({
  nodes,
  edges,
  selectedNode,
  impactAnalysis,
  selectedPathNodeIds,
  onSelectNode,
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Compute node classification relative to active trace
  const nodeStatusMap = useMemo(() => {
    const map = new Map<
      string,
      'selected' | 'direct' | 'indirect' | 'isolated' | 'unrelated'
    >();

    if (!selectedNode) {
      nodes.forEach((n) => map.set(n.id, 'unrelated'));
      return map;
    }

    map.set(selectedNode.id, 'selected');

    if (impactAnalysis && impactAnalysis.targetNode.id === selectedNode.id) {
      impactAnalysis.directDependents.forEach((d) => map.set(d.node.id, 'direct'));
      impactAnalysis.indirectDependents.forEach((d) => map.set(d.node.id, 'indirect'));
    }

    if (selectedPathNodeIds && selectedPathNodeIds.length > 0) {
      selectedPathNodeIds.forEach((id) => {
        if (id !== selectedNode.id) {
          map.set(id, 'isolated');
        }
      });
    }

    return map;
  }, [selectedNode, impactAnalysis, selectedPathNodeIds, nodes]);

  // Coordinate positioning: compute structured or force layout coordinates for 2D
  const positionedNodes = useMemo(() => {
    // If small sample project (4 nodes), place them in clear dependency order
    if (nodes.length <= 6) {
      const positions: Record<string, { x: number; y: number }> = {
        'sample-checkout': { x: 120, y: 220 },
        'sample-session': { x: 380, y: 220 },
        'sample-auth': { x: 640, y: 220 },
        'sample-logger': { x: 380, y: 400 },
      };

      return nodes.map((n) => ({
        ...n,
        posX: positions[n.id]?.x ?? (n.x ? n.x * 2.5 + 400 : 300),
        posY: positions[n.id]?.y ?? (n.y ? n.y * 2.5 + 250 : 250),
      }));
    }

    // Enterprise layout: normalize x, y coordinates
    return nodes.map((n, i) => {
      const posX = n.x !== undefined ? n.x * 3.2 + 450 : 150 + (i % 6) * 110;
      const posY = n.y !== undefined ? n.y * 3.2 + 300 : 100 + Math.floor(i / 6) * 80;
      return { ...n, posX, posY };
    });
  }, [nodes]);

  const positionedNodesById = useMemo(() => {
    const map = new Map<string, (typeof positionedNodes)[0]>();
    positionedNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [positionedNodes]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'svg') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#050811] select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* 2D Topological Canvas SVG */}
      <svg
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onSelectNode(null);
          }
        }}
      >
        <defs>
          {/* Arrow markers for dependency direction */}
          <marker
            id="arrow-default"
            viewBox="0 0 10 10"
            refX="22"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#475569" />
          </marker>
          <marker
            id="arrow-trace"
            viewBox="0 0 10 10"
            refX="22"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#00f5d4" />
          </marker>
          <marker
            id="arrow-indirect"
            viewBox="0 0 10 10"
            refX="22"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#818cf8" />
          </marker>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {edges.map((edge) => {
            const sId = resolveId(edge.source);
            const tId = resolveId(edge.target);
            const sNode = positionedNodesById.get(sId);
            const tNode = positionedNodesById.get(tId);
            if (!sNode || !tNode) return null;

            const isTracedDirect =
              selectedNode &&
              tId === selectedNode.id &&
              nodeStatusMap.get(sId) === 'direct';

            const isTracedIndirect =
              selectedNode &&
              (nodeStatusMap.get(sId) === 'indirect' ||
                nodeStatusMap.get(sId) === 'isolated');

            const isIsolated =
              selectedPathNodeIds &&
              selectedPathNodeIds.includes(sId) &&
              selectedPathNodeIds.includes(tId);

            let strokeColor = '#334155';
            let strokeWidth = 1.2;
            let marker = 'url(#arrow-default)';
            let opacity = 0.45;

            if (isIsolated || isTracedDirect) {
              strokeColor = '#00f5d4';
              strokeWidth = 2.4;
              marker = 'url(#arrow-trace)';
              opacity = 1;
            } else if (isTracedIndirect) {
              strokeColor = '#818cf8';
              strokeWidth = 2;
              marker = 'url(#arrow-indirect)';
              opacity = 0.9;
            } else if (selectedNode) {
              opacity = 0.12;
            }

            // Draw clean curved connection
            const dx = tNode.posX - sNode.posX;
            const dy = tNode.posY - sNode.posY;
            const cx = sNode.posX + dx / 2;
            const cy = sNode.posY + dy / 2 - 20;

            return (
              <g key={edge.id} className="pointer-events-none">
                <path
                  d={`M ${sNode.posX} ${sNode.posY} Q ${cx} ${cy} ${tNode.posX} ${tNode.posY}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  markerEnd={marker}
                  strokeDasharray={edge.type === 'implements' ? '4,4' : undefined}
                />
                {/* Edge Label for traced edges */}
                {(isTracedDirect || isIsolated) && (
                  <text
                    x={cx}
                    y={cy - 6}
                    fill="#22d3ee"
                    fontSize="9"
                    fontFamily="JetBrains Mono, monospace"
                    textAnchor="middle"
                    className="font-semibold"
                  >
                    depends on ({edge.type})
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {positionedNodes.map((node) => {
            const status = nodeStatusMap.get(node.id) || 'unrelated';
            const isSelected = selectedNode?.id === node.id;
            const visuals = getHealthVisuals(node.health);

            let nodeBorder = '#334155';
            let nodeBg = '#0b1120';
            let textColor = '#cbd5e1';
            let nodeOpacity = 1;

            if (isSelected) {
              nodeBorder = '#00f5d4';
              nodeBg = '#071d24';
              textColor = '#00f5d4';
            } else if (status === 'direct') {
              nodeBorder = '#38bdf8';
              nodeBg = '#082333';
              textColor = '#7dd3fc';
            } else if (status === 'indirect') {
              nodeBorder = '#818cf8';
              nodeBg = '#131633';
              textColor = '#a5b4fc';
            } else if (status === 'isolated') {
              nodeBorder = '#38bdf8';
              nodeBg = '#0a1e2d';
              textColor = '#38bdf8';
            } else if (selectedNode) {
              nodeOpacity = 0.28;
            }

            return (
              <g
                key={node.id}
                transform={`translate(${node.posX}, ${node.posY})`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode(node);
                }}
                className="cursor-pointer transition-all"
                opacity={nodeOpacity}
              >
                {/* Outer Ring for selection / trace */}
                {isSelected && (
                  <circle
                    r="34"
                    fill="none"
                    stroke="#00f5d4"
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                    className="animate-spin-slow"
                  />
                )}

                {/* Node Box */}
                <rect
                  x="-80"
                  y="-22"
                  width="160"
                  height="44"
                  rx="8"
                  fill={nodeBg}
                  stroke={nodeBorder}
                  strokeWidth={isSelected ? 2 : 1.2}
                  className="filter drop-shadow-md"
                />

                {/* Health Indicator Pip */}
                <circle
                  cx="-64"
                  cy="0"
                  r="5"
                  fill={visuals.coreColor}
                />

                {/* Node Class Name */}
                <text
                  x="-52"
                  y="-4"
                  fill={textColor}
                  fontSize="11"
                  fontWeight={isSelected ? 'bold' : '600'}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {node.name.length > 15 ? `${node.name.slice(0, 14)}…` : node.name}
                </text>

                {/* Node Cluster / Status Subtitle */}
                <text
                  x="-52"
                  y="12"
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {isSelected
                    ? 'Target (Selected)'
                    : status === 'direct'
                    ? 'Direct Dependent'
                    : status === 'indirect'
                    ? 'Indirect Dependent'
                    : node.clusterName.slice(0, 16)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Canvas Viewport Controls */}
      <div className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#080d1a]/90 p-1 font-mono text-xs shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(2.2, z + 0.15))}
          aria-label="Zoom in"
          className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
          aria-label="Zoom out"
          className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label="Fit view"
          className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          title="Fit view / Reset zoom"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Quiet Legend Overlay */}
      <div className="absolute top-4 left-4 hidden sm:flex items-center gap-3 rounded-lg border border-slate-800/80 bg-[#080d1a]/80 px-3 py-1.5 font-mono text-[10px] text-slate-400 backdrop-blur-md">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#00f5d4]" />
          Target
        </span>
        <span className="text-slate-700">|</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#38bdf8]" />
          Direct Dependent
        </span>
        <span className="text-slate-700">|</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#818cf8]" />
          Indirect Dependent
        </span>
      </div>
    </div>
  );
};
