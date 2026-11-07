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
        'sample-checkout': { x: cx - 280, y: cy - 30 },
        'sample-session': { x: cx, y: cy - 30 },
        'sample-auth': { x: cx + 280, y: cy - 30 },
        'sample-logger': { x: cx, y: cy + 140 },
      };

      return nodes.map((n) => ({
        ...n,
        posX: positions[n.id]?.x ?? cx + (n.x ?? 0) * 2,
        posY: positions[n.id]?.y ?? cy + (n.y ?? 0) * 2,
      }));
    }

    // Auto-scale enterprise datasets
    const xs = nodes.map((n) => n.x ?? 0);
    const ys = nodes.map((n) => n.y ?? 0);
    const minX = Math.min(...xs, -100);
    const maxX = Math.max(...xs, 100);
    const minY = Math.min(...ys, -100);
    const maxY = Math.max(...ys, 100);

    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const pad = 100;
    const availW = Math.max(400, dimensions.width - pad * 2);
    const availH = Math.max(300, dimensions.height - pad * 2);

    return nodes.map((n) => {
      const normX = ((n.x ?? 0) - minX) / spanX;
      const normY = ((n.y ?? 0) - minY) / spanY;
      return {
        ...n,
        posX: pad + normX * availW,
        posY: pad + normY * availH,
      };
    });
  }, [nodes, dimensions]);

  const positionedNodesById = useMemo(() => {
    const map = new Map<string, typeof positionedNodes[0]>();
    positionedNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [positionedNodes]);

  // Canvas pan / drag interaction
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden select-none bg-[#FAF9F5]"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <svg
        width="100%"
        height="100%"
        className="absolute inset-0"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      >
        <defs>
          {/* Arrowhead marker: Neutral gray */}
          <marker
            id="arrow-default"
            viewBox="0 0 10 10"
            refX="28"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#94A3B8" />
          </marker>

          {/* Arrowhead marker: Emerald Active Trace */}
          <marker
            id="arrow-active"
            viewBox="0 0 10 10"
            refX="28"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#059669" />
          </marker>

          {/* Arrowhead marker: Transitive Cyan Trace */}
          <marker
            id="arrow-indirect"
            viewBox="0 0 10 10"
            refX="28"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#0284C7" />
          </marker>
        </defs>

        <g
          transform={`translate(${dimensions.width / 2 + pan.x}, ${
            dimensions.height / 2 + pan.y
          }) scale(${zoom}) translate(${-dimensions.width / 2}, ${-dimensions.height / 2})`}
        >
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

            let strokeColor = '#CBD5E1';
            let strokeWidth = 1.6;
            let marker = 'url(#arrow-default)';
            let opacity = 0.65;
            const isHighlighted = isIsolated || isTracedDirect || isTracedIndirect;

            if (isIsolated || isTracedDirect) {
              strokeColor = '#059669';
              strokeWidth = 3;
              marker = 'url(#arrow-active)';
              opacity = 1;
            } else if (isTracedIndirect) {
              strokeColor = '#0284C7';
              strokeWidth = 2.4;
              marker = 'url(#arrow-indirect)';
              opacity = 0.95;
            } else if (selectedNode) {
              opacity = 0.2;
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
                {/* Click Buffer */}
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
                      stroke="#059669"
                      strokeWidth="1.5"
                      className="filter drop-shadow-sm"
                    />
                    <text
                      x="0"
                      y="4"
                      fill="#047857"
                      fontSize="9.5"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      ──calls line {edge.callSiteLine || 37}──&gt;
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

            let cardBorder = '#E2E8F0';
            let cardBg = '#FFFFFF';
            let titleColor = '#0F172A';
            let opacity = 1.0;

            if (isSelected) {
              cardBorder = '#0F172A';
              cardBg = '#FFFFFF';
              titleColor = '#0F172A';
            } else if (isDirect || isIsolated) {
              cardBorder = '#059669';
              cardBg = '#F0FDF4';
              titleColor = '#047857';
            } else if (isIndirect) {
              cardBorder = '#0284C7';
              cardBg = '#F0F9FF';
              titleColor = '#0369A1';
            } else if (selectedNode) {
              opacity = 0.35;
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
                    stroke="#0F172A"
                    strokeWidth="2.5"
                    strokeDasharray="6,4"
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
                  fill="#64748B"
                  fontSize="10"
                  fontFamily="Outfit, system-ui, sans-serif"
                  fontWeight="500"
                >
                  {isSelected
                    ? 'Target (Being Investigated)'
                    : isDirect
                    ? 'Direct Inbound Caller'
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
                    fill="#F1F5F9"
                    stroke="#E2E8F0"
                  />
                  <text
                    x="13"
                    y="12"
                    fill="#334155"
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

      {/* Floating Explanatory Legend: "A -> B means A calls B" */}
      <div className="absolute top-4 left-4 flex items-center gap-2 rounded-xl bg-white/90 backdrop-blur-md border border-slate-200 px-3.5 py-2 text-xs font-sans text-slate-700 shadow-soft">
        <span className="font-bold text-slate-900">Rule:</span>
        <span className="font-mono text-[11px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-bold text-slate-800">
          A → B means A calls B
        </span>
        <span className="text-slate-400 hidden sm:inline">· Tracing B finds callers that use it</span>
      </div>

      {/* Canvas View Controls */}
      <div className="absolute bottom-4 left-4 flex items-center gap-1 rounded-xl bg-white/90 backdrop-blur-md border border-slate-200 p-1 shadow-soft">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))}
          aria-label="Zoom in"
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
          aria-label="Zoom out"
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label="Fit view"
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
          title="Center and fit canvas view"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Map Legend Pills */}
      <div className="absolute bottom-4 right-4 hidden sm:flex items-center gap-3 rounded-xl bg-white/90 backdrop-blur-md border border-slate-200 px-3.5 py-2 font-mono text-[10.5px] text-slate-600 shadow-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-900" />
          Target Class
        </span>
        <span className="text-slate-300">|</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-600" />
          Direct Inbound Caller
        </span>
        <span className="text-slate-300">|</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-600" />
          Indirect Dependent
        </span>
      </div>
    </div>
  );
};
