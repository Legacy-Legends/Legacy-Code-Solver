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

  // Measure container dimensions
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

  // Framed layout coordinates on parchment
  const positionedNodes = useMemo(() => {
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;

    // Small sample project: generous horizontal spacing, no clipping
    if (nodes.length <= 6) {
      const positions: Record<string, { x: number; y: number }> = {
        'sample-checkout': { x: cx - 290, y: cy - 40 },
        'sample-session': { x: cx, y: cy - 40 },
        'sample-auth': { x: cx + 290, y: cy - 40 },
        'sample-logger': { x: cx, y: cy + 140 },
      };

      return nodes.map((n) => ({
        ...n,
        posX: positions[n.id]?.x ?? cx + (n.x ?? 0) * 2,
        posY: positions[n.id]?.y ?? cy + (n.y ?? 0) * 2,
      }));
    }

    // Enterprise layout: organized cluster layout
    return nodes.map((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      const radius = 240 + (i % 3) * 60;
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
      className="relative h-full w-full overflow-hidden bg-[#FAF8F5] parchment-grid select-none"
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
          {/* Unmistakable Dark Arrowheads */}
          <marker
            id="arrow-parchment-default"
            viewBox="0 0 10 10"
            refX="30"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#71717A" />
          </marker>
          <marker
            id="arrow-parchment-active"
            viewBox="0 0 10 10"
            refX="30"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#4A154B" />
          </marker>
          <marker
            id="arrow-parchment-indirect"
            viewBox="0 0 10 10"
            refX="30"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#6B21A8" />
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

            let strokeColor = '#A1A1AA';
            let strokeWidth = 1.6;
            let marker = 'url(#arrow-parchment-default)';
            let opacity = 0.55;
            const isHighlighted = isIsolated || isTracedDirect || isTracedIndirect;

            if (isIsolated || isTracedDirect) {
              strokeColor = '#4A154B';
              strokeWidth = 3.2;
              marker = 'url(#arrow-parchment-active)';
              opacity = 1;
            } else if (isTracedIndirect) {
              strokeColor = '#6B21A8';
              strokeWidth = 2.6;
              marker = 'url(#arrow-parchment-indirect)';
              opacity = 0.95;
            } else if (selectedNode) {
              opacity = 0.15;
            }

            // Connection curve
            const dx = tNode.posX - sNode.posX;
            const dy = tNode.posY - sNode.posY;
            const cx = sNode.posX + dx / 2;
            const cy = sNode.posY + dy / 2 - (dx !== 0 ? 25 : 0);

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
                {/* Fat invisible click buffer */}
                <path
                  d={`M ${sNode.posX} ${sNode.posY} Q ${cx} ${cy} ${tNode.posX} ${tNode.posY}`}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="20"
                />

                {/* Visible Trace Line */}
                <path
                  d={`M ${sNode.posX} ${sNode.posY} Q ${cx} ${cy} ${tNode.posX} ${tNode.posY}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  markerEnd={marker}
                />

                {/* Clear Labeled Connection Tag */}
                {isHighlighted && (
                  <g transform={`translate(${cx}, ${cy - 10})`}>
                    <rect
                      x="-55"
                      y="-11"
                      width="110"
                      height="22"
                      rx="11"
                      fill="#FFFFFF"
                      stroke="#4A154B"
                      strokeWidth="1.5"
                      className="filter drop-shadow-sm"
                    />
                    <text
                      x="0"
                      y="4"
                      fill="#4A154B"
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

            let cardBorder = '#E2DCD2';
            let cardBg = '#FFFFFF';
            let titleColor = '#18181B';
            let opacity = 1.0;

            if (isSelected) {
              cardBorder = '#4A154B';
              cardBg = '#FFFFFF';
              titleColor = '#4A154B';
            } else if (isDirect || isIsolated) {
              cardBorder = '#7C3AED';
              cardBg = '#FAF5FF';
              titleColor = '#4A154B';
            } else if (isIndirect) {
              cardBorder = '#8B5CF6';
              cardBg = '#F5F3FF';
              titleColor = '#581C87';
            } else if (selectedNode) {
              opacity = 0.28;
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
                className="cursor-pointer transition-all duration-150"
                opacity={opacity}
              >
                {/* Outer frame for selected node */}
                {isSelected && (
                  <rect
                    x={-cardW / 2 - 5}
                    y={-cardH / 2 - 5}
                    width={cardW + 10}
                    height={cardH + 10}
                    rx="18"
                    fill="none"
                    stroke="#4A154B"
                    strokeWidth="2"
                    strokeDasharray="5,4"
                  />
                )}

                {/* Card Rect */}
                <rect
                  x={-cardW / 2}
                  y={-cardH / 2}
                  width={cardW}
                  height={cardH}
                  rx="14"
                  fill={cardBg}
                  stroke={cardBorder}
                  strokeWidth={isSelected ? 2.5 : 1.2}
                  className="filter drop-shadow-sm"
                />

                {/* Health Dot */}
                <circle
                  cx={-cardW / 2 + 16}
                  cy={-cardH / 2 + 22}
                  r="5"
                  fill={visuals.coreColor}
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

                {/* Subtitle Role / Status */}
                <text
                  x={-cardW / 2 + 16}
                  y={-cardH / 2 + 48}
                  fill="#71717A"
                  fontSize="10"
                  fontFamily="Inter, system-ui, sans-serif"
                  fontWeight="500"
                >
                  {isSelected
                    ? 'Target (Being Changed)'
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
                    fill="#F5F2EB"
                    stroke="#E2DCD2"
                  />
                  <text
                    x="13"
                    y="12"
                    fill="#3F3F46"
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

      {/* Floating Explanatory Legend: "A -> B means A uses B" */}
      <div className="absolute top-4 left-4 flex items-center gap-2 rounded-xl bg-white border border-parchment-border px-3.5 py-2 text-xs font-sans text-ink-700 shadow-soft">
        <span className="font-bold text-plum-800">Rule:</span>
        <span className="font-mono text-[11px] bg-parchment-100 border border-parchment-border px-1.5 py-0.5 rounded font-semibold text-ink-800">
          A → B means A uses B
        </span>
        <span className="text-ink-400 hidden sm:inline">· Tracing B finds callers that use it</span>
      </div>

      {/* Canvas View Controls */}
      <div className="absolute bottom-4 left-4 flex items-center gap-1 rounded-xl bg-white border border-parchment-border p-1 shadow-soft">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))}
          aria-label="Zoom in"
          className="rounded-lg p-1.5 text-ink-600 hover:bg-parchment-200 hover:text-ink-900 transition"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
          aria-label="Zoom out"
          className="rounded-lg p-1.5 text-ink-600 hover:bg-parchment-200 hover:text-ink-900 transition"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label="Fit view"
          className="rounded-lg p-1.5 text-ink-600 hover:bg-parchment-200 hover:text-ink-900 transition"
          title="Center and fit canvas view"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Map Legend Pills */}
      <div className="absolute bottom-4 right-4 hidden sm:flex items-center gap-3 rounded-xl bg-white border border-parchment-border px-3.5 py-2 font-mono text-[10.5px] text-ink-600 shadow-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-plum-700" />
          Target Class
        </span>
        <span className="text-parchment-border">|</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-purple-600" />
          Direct Dependent
        </span>
        <span className="text-parchment-border">|</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-plum-500" />
          Indirect Dependent
        </span>
      </div>
    </div>
  );
};
