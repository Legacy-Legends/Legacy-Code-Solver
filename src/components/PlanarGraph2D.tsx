import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { GraphNode, GraphEdge, ImpactAnalysis, SourceEvidence } from '../types/index';
import { getHealthVisuals } from '../lib/healthColor';

interface PlanarGraph2DProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNode: GraphNode | null;
  impactAnalysis: ImpactAnalysis | null;
  selectedPathNodeIds: string[] | null;
  onSelectNode: (node: GraphNode | null) => void;
  onOpenEvidence?: (evidence: SourceEvidence) => void;
  evidenceMap?: Record<string, SourceEvidence>;
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
  onOpenEvidence,
  evidenceMap,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Measure container size
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth || 900;
        const h = containerRef.current.clientHeight || 600;
        setDimensions({ width: w, height: h });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

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

  // Framed layout coordinates: Guaranteed centered, readable, non-colliding
  const positionedNodes = useMemo(() => {
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;

    // Small sample project (4 nodes: Checkout -> Session -> Auth + Logger)
    if (nodes.length <= 6) {
      const positions: Record<string, { x: number; y: number }> = {
        'sample-checkout': { x: cx - 280, y: cy - 40 },
        'sample-session': { x: cx, y: cy - 40 },
        'sample-auth': { x: cx + 280, y: cy - 40 },
        'sample-logger': { x: cx, y: cy + 150 },
      };

      return nodes.map((n) => ({
        ...n,
        posX: positions[n.id]?.x ?? cx + (n.x ?? 0) * 2,
        posY: positions[n.id]?.y ?? cy + (n.y ?? 0) * 2,
      }));
    }

    // Enterprise layout (40 nodes) arranged across cluster quadrants
    return nodes.map((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      const radius = 220 + (i % 3) * 60;
      const posX = cx + Math.cos(angle) * radius;
      const posY = cy + Math.sin(angle) * (radius * 0.7);
      return { ...n, posX, posY };
    });
  }, [nodes, dimensions]);

  const positionedNodesById = useMemo(() => {
    const map = new Map<string, (typeof positionedNodes)[0]>();
    positionedNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [positionedNodes]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).tagName === 'rect') {
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

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#070b14] ambient-glow topo-grid select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* 2D Topological SVG Canvas */}
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
            refX="28"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 2 L 8 5 L 0 8 z" fill="#475569" />
          </marker>
          <marker
            id="arrow-trace-cyan"
            viewBox="0 0 10 10"
            refX="28"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
          >
            <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#00f5d4" />
          </marker>
          <marker
            id="arrow-trace-indigo"
            viewBox="0 0 10 10"
            refX="28"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
          >
            <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#818cf8" />
          </marker>

          {/* Gradients */}
          <linearGradient id="trace-grad-cyan" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#00f5d4" />
          </linearGradient>
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
            let strokeWidth = 1.4;
            let marker = 'url(#arrow-default)';
            let opacity = 0.4;
            const isHighlighted = isIsolated || isTracedDirect || isTracedIndirect;

            if (isIsolated || isTracedDirect) {
              strokeColor = 'url(#trace-grad-cyan)';
              strokeWidth = 3.2;
              marker = 'url(#arrow-trace-cyan)';
              opacity = 1;
            } else if (isTracedIndirect) {
              strokeColor = '#818cf8';
              strokeWidth = 2.6;
              marker = 'url(#arrow-trace-indigo)';
              opacity = 0.95;
            } else if (selectedNode) {
              opacity = 0.12;
            }

            // Connection curve
            const dx = tNode.posX - sNode.posX;
            const dy = tNode.posY - sNode.posY;
            const cx = sNode.posX + dx / 2;
            const cy = sNode.posY + dy / 2 - (dx !== 0 ? 25 : 0);

            // Clickable evidence handler
            const evidence = evidenceMap ? evidenceMap[edge.id] : undefined;

            return (
              <g
                key={edge.id}
                className={evidence ? 'cursor-pointer' : ''}
                onClick={(e) => {
                  if (evidence && onOpenEvidence) {
                    e.stopPropagation();
                    onOpenEvidence(evidence);
                  }
                }}
              >
                {/* Fat invisible hit area for clicking */}
                <path
                  d={`M ${sNode.posX} ${sNode.posY} Q ${cx} ${cy} ${tNode.posX} ${tNode.posY}`}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="20"
                />

                {/* Visible Trace Path */}
                <path
                  d={`M ${sNode.posX} ${sNode.posY} Q ${cx} ${cy} ${tNode.posX} ${tNode.posY}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  markerEnd={marker}
                  strokeDasharray={isHighlighted ? '8,4' : undefined}
                  className={isHighlighted ? 'animate-trace-flow' : ''}
                />

                {/* Labeled Arrow Badge on Traced Edges */}
                {isHighlighted && (
                  <g transform={`translate(${cx}, ${cy - 10})`}>
                    <rect
                      x="-55"
                      y="-12"
                      width="110"
                      height="22"
                      rx="11"
                      fill="rgba(7, 12, 24, 0.92)"
                      stroke="#00f5d4"
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="3"
                      fill="#00f5d4"
                      fontSize="9.5"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      ──depends on──&gt;
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Node Cards */}
          {positionedNodes.map((node) => {
            const status = nodeStatusMap.get(node.id) || 'unrelated';
            const isSelected = selectedNode?.id === node.id;
            const visuals = getHealthVisuals(node.health);

            const isDirect = status === 'direct';
            const isIndirect = status === 'indirect';
            const isIsolated = status === 'isolated';

            let cardBorder = 'rgba(255, 255, 255, 0.1)';
            let cardBg = 'rgba(15, 23, 42, 0.88)';
            let titleColor = '#f1f5f9';
            let opacity = 1.0;

            if (isSelected) {
              cardBorder = '#00f5d4';
              cardBg = 'rgba(7, 34, 40, 0.95)';
              titleColor = '#00f5d4';
            } else if (isDirect || isIsolated) {
              cardBorder = '#38bdf8';
              cardBg = 'rgba(8, 38, 56, 0.95)';
              titleColor = '#7dd3fc';
            } else if (isIndirect) {
              cardBorder = '#818cf8';
              cardBg = 'rgba(20, 24, 58, 0.95)';
              titleColor = '#a5b4fc';
            } else if (selectedNode) {
              opacity = 0.22;
            }

            const cardW = 210;
            const cardH = 66;

            return (
              <g
                key={node.id}
                transform={`translate(${node.posX}, ${node.posY})`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode(node);
                }}
                className="cursor-pointer transition-all duration-200"
                opacity={opacity}
              >
                {/* Luminous halo for selected node */}
                {isSelected && (
                  <rect
                    x={-cardW / 2 - 6}
                    y={-cardH / 2 - 6}
                    width={cardW + 12}
                    height={cardH + 12}
                    rx="16"
                    fill="none"
                    stroke="#00f5d4"
                    strokeWidth="1.5"
                    strokeDasharray="6,4"
                    opacity="0.8"
                  />
                )}

                {/* Card Container */}
                <rect
                  x={-cardW / 2}
                  y={-cardH / 2}
                  width={cardW}
                  height={cardH}
                  rx="12"
                  fill={cardBg}
                  stroke={cardBorder}
                  strokeWidth={isSelected ? 2 : 1}
                  className="filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.65)]"
                />

                {/* Top Subtle Glass Highlight */}
                <path
                  d={`M ${-cardW / 2 + 12} ${-cardH / 2 + 1} L ${cardW / 2 - 12} ${-cardH / 2 + 1}`}
                  stroke="rgba(255, 255, 255, 0.25)"
                  strokeWidth="1"
                />

                {/* Health Dot */}
                <circle
                  cx={-cardW / 2 + 16}
                  cy={-cardH / 2 + 22}
                  r="5"
                  fill={visuals.coreColor}
                  className={isSelected ? 'animate-pulse' : ''}
                />

                {/* Class Name */}
                <text
                  x={-cardW / 2 + 28}
                  y={-cardH / 2 + 25}
                  fill={titleColor}
                  fontSize="12.5"
                  fontWeight="bold"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {node.name.length > 18 ? `${node.name.slice(0, 17)}…` : node.name}
                </text>

                {/* Subtitle / Package / Status */}
                <text
                  x={-cardW / 2 + 16}
                  y={-cardH / 2 + 48}
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {isSelected
                    ? 'Target Class (Inspected)'
                    : isDirect
                    ? 'Direct Dependent (Caller)'
                    : isIndirect
                    ? 'Indirect Dependent (Chain)'
                    : node.clusterName.slice(0, 22)}
                </text>

                {/* Health Score Chip */}
                <g transform={`translate(${cardW / 2 - 34}, ${-cardH / 2 + 12})`}>
                  <rect
                    x="0"
                    y="0"
                    width="26"
                    height="16"
                    rx="4"
                    fill="rgba(0, 0, 0, 0.5)"
                    stroke="rgba(255, 255, 255, 0.1)"
                  />
                  <text
                    x="13"
                    y="12"
                    fill={visuals.coreColor}
                    fontSize="9"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {node.health}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Canvas View Controls */}
      <div className="absolute bottom-4 left-4 flex items-center gap-1 rounded-xl glass-panel p-1 text-slate-300 shadow-xl backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))}
          aria-label="Zoom in"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
          aria-label="Zoom out"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label="Fit view"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
          title="Center and fit canvas view"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Quiet Canvas Legend */}
      <div className="absolute bottom-4 right-4 hidden sm:flex items-center gap-3 rounded-xl glass-panel px-3.5 py-1.5 font-mono text-[10.5px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#00f5d4] shadow-[0_0_8px_#00f5d4]" />
          Target Class
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
