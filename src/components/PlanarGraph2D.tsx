import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { GraphNode, GraphEdge, ImpactAnalysis, SourceEvidence } from '../types/index';

interface PlanarGraph2DProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNode: GraphNode | null;
  selectedEdge: GraphEdge | null;
  impactAnalysis: ImpactAnalysis | null;
  showIndirect: boolean;
  selectedPathNodeIds: string[] | null;
  fitSignal?: number;
  onSelectNode: (node: GraphNode | null) => void;
  onSelectEdge: (edge: GraphEdge | null) => void;
  onOpenEvidence?: (evidence: SourceEvidence, pathList?: SourceEvidence[]) => void;
  resolveEvidenceForEdge?: (edge: GraphEdge) => SourceEvidence | undefined;
}

function resolveId(endpoint: string | GraphNode): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.id;
}

const CARD_W = 204;
const CARD_H = 60;
const HALF_W = CARD_W / 2;
const HALF_H = CARD_H / 2;

/**
 * Computes exact intersection point on the rectangular node boundary
 * along the ray from (cx, cy) toward (targetX, targetY).
 */
function getBoxBoundaryPoint(
  cx: number,
  cy: number,
  targetX: number,
  targetY: number,
  pad: number = 0
): { x: number; y: number } {
  const dx = targetX - cx;
  const dy = targetY - cy;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return { x: cx, y: cy };
  }
  const w = HALF_W + pad;
  const h = HALF_H + pad;
  const tx = Math.abs(dx) > 0.001 ? w / Math.abs(dx) : Infinity;
  const ty = Math.abs(dy) > 0.001 ? h / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return {
    x: cx + dx * t,
    y: cy + dy * t,
  };
}

export const PlanarGraph2D: React.FC<PlanarGraph2DProps> = ({
  nodes,
  edges,
  selectedNode,
  selectedEdge,
  impactAnalysis,
  showIndirect,
  selectedPathNodeIds,
  fitSignal = 0,
  onSelectNode,
  onSelectEdge,
  onOpenEvidence,
  resolveEvidenceForEdge,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const hasInitialFitRef = useRef(false);

  // Drag state with threshold so clicking a node or background never starts an accidental pan
  const pointerStateRef = useRef<{
    isDown: boolean;
    didDrag: boolean;
    startX: number;
    startY: number;
    panStartX: number;
    panStartY: number;
  }>({
    isDown: false,
    didDrag: false,
    startX: 0,
    startY: 0,
    panStartX: 0,
    panStartY: 0,
  });
  const [isDragging, setIsDragging] = useState(false);

  // Measure container dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth || 960;
        const h = containerRef.current.clientHeight || 640;
        setDimensions({ width: w, height: h });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Compute stable logical world coordinates ONLY when `nodes` or `edges` change.
  // Never recomputes on selection or drawer toggle.
  const positionedNodes = useMemo(() => {
    if (nodes.length === 0) return [];

    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();
    nodes.forEach((n) => {
      inDegree.set(n.id, 0);
      outDegree.set(n.id, 0);
    });
    edges.forEach((e) => {
      const s = resolveId(e.source);
      const t = resolveId(e.target);
      outDegree.set(s, (outDegree.get(s) || 0) + 1);
      inDegree.set(t, (inDegree.get(t) || 0) + 1);
    });

    // Small dataset (e.g. Sample project): arrange connected chain horizontally, isolated classes below
    if (nodes.length <= 6) {
      const connected = nodes.filter(
        (n) => (inDegree.get(n.id) || 0) > 0 || (outDegree.get(n.id) || 0) > 0
      );
      const isolated = nodes.filter(
        (n) => (inDegree.get(n.id) || 0) === 0 && (outDegree.get(n.id) || 0) === 0
      );

      // Order connected chain from callers (in=0) -> middle -> callees (out=0)
      const orderedConnected = [...connected].sort((a, b) => {
        const scoreA = (inDegree.get(a.id) || 0) - (outDegree.get(a.id) || 0);
        const scoreB = (inDegree.get(b.id) || 0) - (outDegree.get(b.id) || 0);
        return scoreA - scoreB;
      });

      const spacingX = 316;
      const chainY = isolated.length > 0 ? -48 : 0;
      const isolatedY = 112;

      const posMap = new Map<string, { x: number; y: number }>();
      orderedConnected.forEach((n, idx) => {
        const offset = (idx - (orderedConnected.length - 1) / 2) * spacingX;
        posMap.set(n.id, { x: offset, y: chainY });
      });

      isolated.forEach((n, idx) => {
        const offset = (idx - (isolated.length - 1) / 2) * spacingX;
        posMap.set(n.id, { x: offset, y: isolatedY });
      });

      return nodes.map((n) => ({
        ...n,
        posX: posMap.get(n.id)?.x ?? 0,
        posY: posMap.get(n.id)?.y ?? 0,
      }));
    }

    // Larger datasets (e.g. Enterprise 40-node graph): group by cluster into aligned columns & rows
    const clusters = new Map<string, GraphNode[]>();
    nodes.forEach((n) => {
      const list = clusters.get(n.clusterId) || [];
      list.push(n);
      clusters.set(n.clusterId, list);
    });

    const clusterEntries = Array.from(clusters.entries());
    const posMap = new Map<string, { x: number; y: number }>();

    if (clusterEntries.length > 1) {
      const colSpacing = 276;
      const rowSpacing = 86;
      clusterEntries.forEach(([, clusterNodes], cIdx) => {
        const colX = (cIdx - (clusterEntries.length - 1) / 2) * colSpacing;
        clusterNodes.forEach((n, rIdx) => {
          const rowY = (rIdx - (clusterNodes.length - 1) / 2) * rowSpacing;
          posMap.set(n.id, { x: colX, y: rowY });
        });
      });
    } else {
      const cols = Math.ceil(Math.sqrt(nodes.length));
      const rows = Math.ceil(nodes.length / cols);
      nodes.forEach((n, idx) => {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        posMap.set(n.id, {
          x: (c - (cols - 1) / 2) * 270,
          y: (r - (rows - 1) / 2) * 88,
        });
      });
    }

    return nodes.map((n) => ({
      ...n,
      posX: posMap.get(n.id)?.x ?? 0,
      posY: posMap.get(n.id)?.y ?? 0,
    }));
  }, [nodes, edges]);

  const positionedNodesById = useMemo(() => {
    const map = new Map<string, (typeof positionedNodes)[0]>();
    positionedNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [positionedNodes]);

  // Fit graph nicely to container
  const fitGraphToViewport = useCallback(() => {
    if (positionedNodes.length === 0 || dimensions.width === 0 || dimensions.height === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const xs = positionedNodes.map((n) => n.posX);
    const ys = positionedNodes.map((n) => n.posY);
    const minX = Math.min(...xs) - HALF_W - 28;
    const maxX = Math.max(...xs) + HALF_W + 28;
    const minY = Math.min(...ys) - HALF_H - 36;
    const maxY = Math.max(...ys) + HALF_H + 36;

    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);

    const padX = dimensions.width < 500 ? 20 : 48;
    const padY = dimensions.height < 500 ? 32 : 64;
    const scaleX = (dimensions.width - padX) / contentW;
    const scaleY = (dimensions.height - padY) / contentH;
    const idealZoom = Math.max(0.34, Math.min(1.05, Math.min(scaleX, scaleY)));

    setZoom(Number(idealZoom.toFixed(2)));
    setPan({ x: 0, y: 0 });
  }, [positionedNodes, dimensions.width, dimensions.height]);

  // Auto-fit when container is first measured, dataset changes, or Fit Graph is triggered
  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0 && !hasInitialFitRef.current) {
      hasInitialFitRef.current = true;
      fitGraphToViewport();
    }
  }, [dimensions.width, dimensions.height, fitGraphToViewport]);

  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      fitGraphToViewport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, fitSignal]);

  // Compute node visual status relative to active selection
  const nodeStatusMap = useMemo(() => {
    const map = new Map<
      string,
      'selected' | 'direct' | 'indirect' | 'path' | 'unrelated'
    >();

    if (!selectedNode && !selectedEdge) {
      nodes.forEach((n) => map.set(n.id, 'unrelated'));
      return map;
    }

    if (selectedEdge && !selectedNode) {
      const sId = resolveId(selectedEdge.source);
      const tId = resolveId(selectedEdge.target);
      nodes.forEach((n) => {
        if (n.id === tId) map.set(n.id, 'selected');
        else if (n.id === sId) map.set(n.id, 'direct');
        else map.set(n.id, 'unrelated');
      });
      return map;
    }

    if (!selectedNode) return map;

    map.set(selectedNode.id, 'selected');

    // If a specific path is highlighted, highlight nodes on that path
    if (selectedPathNodeIds && selectedPathNodeIds.length > 0) {
      selectedPathNodeIds.forEach((id, idx) => {
        if (id === selectedNode.id) {
          map.set(id, 'selected');
        } else if (idx === selectedPathNodeIds.length - 2) {
          map.set(id, 'direct');
        } else {
          map.set(id, 'indirect');
        }
      });
      return map;
    }

    if (impactAnalysis && impactAnalysis.targetNode.id === selectedNode.id) {
      impactAnalysis.directDependents.forEach((d) => map.set(d.node.id, 'direct'));
      if (showIndirect) {
        impactAnalysis.indirectDependents.forEach((d) => map.set(d.node.id, 'indirect'));
      }
    }

    return map;
  }, [selectedNode, selectedEdge, impactAnalysis, showIndirect, selectedPathNodeIds, nodes]);

  // Helper to check if an edge (sId -> tId) is part of the highlighted path
  const isEdgeInSelectedPath = useCallback(
    (sId: string, tId: string): boolean => {
      if (!selectedPathNodeIds || selectedPathNodeIds.length < 2) return false;
      for (let i = 0; i < selectedPathNodeIds.length - 1; i++) {
        if (selectedPathNodeIds[i] === sId && selectedPathNodeIds[i + 1] === tId) {
          return true;
        }
      }
      return false;
    },
    [selectedPathNodeIds]
  );

  // Pointer handlers for background drag-to-pan
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      pointerStateRef.current = {
        isDown: true,
        didDrag: false,
        startX: e.clientX,
        startY: e.clientY,
        panStartX: pan.x,
        panStartY: pan.y,
      };
    },
    [pan]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const st = pointerStateRef.current;
    if (!st.isDown) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.didDrag && Math.hypot(dx, dy) > 4) {
      st.didDrag = true;
      setIsDragging(true);
    }
    if (st.didDrag) {
      setPan({
        x: st.panStartX + dx,
        y: st.panStartY + dy,
      });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    pointerStateRef.current.isDown = false;
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((z) => Number(Math.max(0.4, Math.min(2.2, z + delta)).toFixed(2)));
  }, []);

  const hasActiveFilter = Boolean(selectedNode || selectedEdge);
  const viewW = dimensions.width || 960;
  const viewH = dimensions.height || 640;

  // Precompute 5x5 sub-grid coordinates for the 140x140 world-space dot tile (28px spacing)
  const subGridCoords = [0, 28, 56, 84, 112];

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onClick={() => {
        if (!pointerStateRef.current.didDrag) {
          onSelectNode(null);
          onSelectEdge(null);
        }
      }}
      className="relative h-full w-full overflow-hidden select-none bg-[#F7F5F0]"
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <svg
        width="100%"
        height="100%"
        className="absolute inset-0"
        viewBox={`0 0 ${viewW} ${viewH}`}
      >
        <defs>
          {/* Deep-space parallax dot grid (moves at 0.45x pan speed for spatial depth) */}
          <pattern
            id="spatial-dots-parallax"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${viewW / 2 + pan.x * 0.45}, ${
              viewH / 2 + pan.y * 0.45
            }) scale(${0.65 + zoom * 0.35})`}
          >
            <circle cx="12" cy="12" r="1.05" fill="#CFCAC0" opacity="0.7" />
          </pattern>

          {/* Primary world-space dot grid (28px minor dots + 140px major spatial coordinate dots) */}
          <pattern
            id="spatial-dots-world"
            width="140"
            height="140"
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${viewW / 2 + pan.x}, ${
              viewH / 2 + pan.y
            }) scale(${zoom})`}
          >
            {subGridCoords.map((gx) =>
              subGridCoords.map((gy) => {
                const isMajor = gx === 0 && gy === 0;
                return (
                  <circle
                    key={`${gx}-${gy}`}
                    cx={gx}
                    cy={gy}
                    r={isMajor ? 2.15 : 1.35}
                    fill={isMajor ? '#8A8375' : '#BDB7AA'}
                    opacity={isMajor ? 0.85 : 0.75}
                  />
                );
              })
            )}
          </pattern>

          {/* Default subtle slate arrowhead */}
          <marker
            id="arrow-default"
            viewBox="0 0 10 10"
            refX="8.5"
            refY="5"
            markerWidth="6.5"
            markerHeight="6.5"
            orient="auto"
          >
            <path d="M 0 1.5 L 9.5 5 L 0 8.5 z" fill="#94A3B8" />
          </marker>

          {/* Active Indigo Arrowhead */}
          <marker
            id="arrow-active"
            viewBox="0 0 10 10"
            refX="8.5"
            refY="5"
            markerWidth="7.5"
            markerHeight="7.5"
            orient="auto"
          >
            <path d="M 0 1 L 9.5 5 L 0 9 z" fill="#3730A3" />
          </marker>

          {/* Indirect Indigo Arrowhead */}
          <marker
            id="arrow-indirect"
            viewBox="0 0 10 10"
            refX="8.5"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M 0 1.2 L 9.5 5 L 0 8.8 z" fill="#4F46E5" />
          </marker>
        </defs>

        {/* Spatial Dot Grid Layers */}
        <rect
          width="100%"
          height="100%"
          fill="url(#spatial-dots-parallax)"
          className="pointer-events-none"
        />
        <rect
          width="100%"
          height="100%"
          fill="url(#spatial-dots-world)"
          className="pointer-events-none"
        />

        <g
          transform={`translate(${viewW / 2 + pan.x}, ${
            viewH / 2 + pan.y
          }) scale(${zoom})`}
        >
          {/* 1. Directed Dependency Edges */}
          {edges.map((edge) => {
            const sId = resolveId(edge.source);
            const tId = resolveId(edge.target);
            const sNode = positionedNodesById.get(sId);
            const tNode = positionedNodesById.get(tId);
            if (!sNode || !tNode) return null;

            const isEdgeSelected = selectedEdge?.id === edge.id;
            const inSelectedPath = isEdgeInSelectedPath(sId, tId);

            const isDirectCallerEdge =
              !selectedPathNodeIds &&
              selectedNode !== null &&
              tId === selectedNode.id &&
              nodeStatusMap.get(sId) === 'direct';

            const isIndirectCallerEdge =
              !selectedPathNodeIds &&
              selectedNode !== null &&
              showIndirect &&
              ((nodeStatusMap.get(sId) === 'indirect' &&
                nodeStatusMap.get(tId) === 'direct') ||
                (tId === selectedNode.id && nodeStatusMap.get(sId) === 'direct'));

            const isActiveDirect = isEdgeSelected || inSelectedPath || isDirectCallerEdge;
            const isActiveIndirect = !isActiveDirect && isIndirectCallerEdge;
            const isHighlighted = isActiveDirect || isActiveIndirect;

            let strokeColor = '#94A3B8';
            let strokeWidth = 1.75;
            let marker = 'url(#arrow-default)';
            let opacity = 0.75;

            if (isActiveDirect) {
              strokeColor = '#3730A3';
              strokeWidth = 2.75;
              marker = 'url(#arrow-active)';
              opacity = 1;
            } else if (isActiveIndirect) {
              strokeColor = '#4F46E5';
              strokeWidth = 2.25;
              marker = 'url(#arrow-indirect)';
              opacity = 0.95;
            } else if (hasActiveFilter) {
              opacity = 0.18;
            }

            // Compute exact boundary anchor points on source and target node boxes
            const startPt = getBoxBoundaryPoint(
              sNode.posX,
              sNode.posY,
              tNode.posX,
              tNode.posY,
              1
            );
            const endPt = getBoxBoundaryPoint(
              tNode.posX,
              tNode.posY,
              sNode.posX,
              sNode.posY,
              3
            );

            const sameRowAdjacent =
              Math.abs(sNode.posY - tNode.posY) < 4 &&
              Math.abs(sNode.posX - tNode.posX) <= 340;

            const midX = (startPt.x + endPt.x) / 2;
            const midY = (startPt.y + endPt.y) / 2;
            const curveOffset = sameRowAdjacent ? 0 : -22;
            const ctrlX = midX;
            const ctrlY = midY + curveOffset;

            const pathD = sameRowAdjacent
              ? `M ${startPt.x} ${startPt.y} L ${endPt.x} ${endPt.y}`
              : `M ${startPt.x} ${startPt.y} Q ${ctrlX} ${ctrlY} ${endPt.x} ${endPt.y}`;

            const labelX = midX;
            const labelY = sameRowAdjacent ? midY - 16 : ctrlY - 10;
            const evidence = resolveEvidenceForEdge ? resolveEvidenceForEdge(edge) : undefined;

            return (
              <g
                key={edge.id}
                className="cursor-pointer"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEdge(edge);
                  if (evidence && onOpenEvidence) {
                    onOpenEvidence(evidence, [evidence]);
                  }
                }}
              >
                {/* Wide 22px invisible hit target for effortless clicking */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={22}
                />

                {/* Visible connection line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  strokeDasharray={isActiveIndirect && !inSelectedPath ? '5,4' : undefined}
                  markerEnd={marker}
                />

                {/* Call-site pill on active connections or small graphs */}
                {(isHighlighted || (!hasActiveFilter && nodes.length <= 6)) && (
                  <g transform={`translate(${labelX}, ${labelY})`}>
                    <rect
                      x="-34"
                      y="-9"
                      width="68"
                      height="18"
                      rx="5"
                      fill="#FFFFFF"
                      stroke={isHighlighted ? '#3730A3' : '#D6D3CD'}
                      strokeWidth={isHighlighted ? 1.3 : 1}
                    />
                    <text
                      x="0"
                      y="3"
                      fill={isHighlighted ? '#312E81' : '#4B5563'}
                      fontSize="9.5"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={isHighlighted ? '600' : '500'}
                      textAnchor="middle"
                    >
                      {edge.callSiteLine ? `calls :${edge.callSiteLine}` : edge.type}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* 2. Class Node Boxes */}
          {positionedNodes.map((node) => {
            const status = nodeStatusMap.get(node.id) || 'unrelated';
            const isSelected = status === 'selected';
            const isDirect = status === 'direct';
            const isIndirect = status === 'indirect';
            const isDimmed = hasActiveFilter && status === 'unrelated';

            let cardBg = '#FFFFFF';
            let cardBorder = '#D6D3CD';
            let borderWidth = 1.5;
            let titleColor = '#111827';
            let roleLabel = node.clusterName;
            let roleColor = '#6B7280';
            if (isSelected) {
              cardBg = '#FFFFFF';
              cardBorder = '#3730A3';
              borderWidth = 2.5;
              titleColor = '#1E1B4B';
              roleLabel = 'Selected class';
              roleColor = '#3730A3';
            } else if (isDirect) {
              cardBg = '#F5F7FF';
              cardBorder = '#4338CA';
              borderWidth = 2;
              titleColor = '#1E1B4B';
              roleLabel = 'Direct caller';
              roleColor = '#4338CA';
            } else if (isIndirect) {
              cardBg = '#FAF9FF';
              cardBorder = '#6366F1';
              borderWidth = 1.75;
              titleColor = '#312E81';
              roleLabel = 'Indirect caller';
              roleColor = '#4F46E5';
            }

            const displayName =
              node.name.length > 21 ? `${node.name.slice(0, 20)}…` : node.name;

            return (
              <g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-label={`Class ${node.name}, ${roleLabel}`}
                transform={`translate(${node.posX}, ${node.posY})`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEdge(null);
                  onSelectNode(node);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelectEdge(null);
                    onSelectNode(node);
                  }
                }}
                className="cursor-pointer focus:outline-none"
                opacity={isDimmed ? 0.3 : 1}
              >
                {/* Distinct selection outline halo */}
                {isSelected && (
                  <rect
                    x={-HALF_W - 4}
                    y={-HALF_H - 4}
                    width={CARD_W + 8}
                    height={CARD_H + 8}
                    rx="14"
                    fill="none"
                    stroke="#4338CA"
                    strokeWidth="2"
                    strokeOpacity="0.35"
                  />
                )}

                {/* Opaque High-Contrast Node Box */}
                <rect
                  x={-HALF_W}
                  y={-HALF_H}
                  width={CARD_W}
                  height={CARD_H}
                  rx="11"
                  fill={cardBg}
                  stroke={cardBorder}
                  strokeWidth={borderWidth}
                />

                {/* Left Accent Pill inside Card */}
                <rect
                  x={-HALF_W + 12}
                  y={-HALF_H + 14}
                  width="4"
                  height={CARD_H - 28}
                  rx="2"
                  fill={isSelected || isDirect || isIndirect ? cardBorder : '#CBD5E1'}
                />

                {/* Class Name (Monospace, high contrast) */}
                <text
                  x={-HALF_W + 24}
                  y={-HALF_H + 26}
                  fill={titleColor}
                  fontSize="12.5"
                  fontWeight="600"
                  fontFamily="JetBrains Mono, monospace"
                >
                  <title>{node.name}</title>
                  {displayName}
                </text>

                {/* Role or Cluster Subtitle (Clean Sans-Serif) */}
                <text
                  x={-HALF_W + 24}
                  y={-HALF_H + 45}
                  fill={roleColor}
                  fontSize="11"
                  fontWeight={isSelected || isDirect || isIndirect ? '600' : '400'}
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {roleLabel.length > 25 ? `${roleLabel.slice(0, 24)}…` : roleLabel}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Restrained Frosted Controls: Zoom & Fit */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="glass-card absolute bottom-4 left-4 flex items-center gap-1 rounded-xl p-1"
      >
        <button
          type="button"
          onClick={() => setZoom((z) => Number(Math.min(2.2, z + 0.15).toFixed(2)))}
          aria-label="Zoom in"
          className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition cursor-pointer"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Number(Math.max(0.4, z - 0.15).toFixed(2)))}
          aria-label="Zoom out"
          className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition cursor-pointer"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <div className="h-4 w-px bg-[#E4E2DA] mx-0.5" />
        <button
          type="button"
          onClick={fitGraphToViewport}
          aria-label="Fit graph"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition cursor-pointer"
          title="Fit graph to view"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span>Fit graph</span>
        </button>
      </div>

      {/* Honest Direction Note */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="glass-card absolute bottom-4 right-4 hidden sm:flex items-center gap-2 rounded-xl px-3 py-1.5 font-sans text-xs text-slate-700"
      >
        <span className="font-mono font-semibold text-slate-900">A → B</span>
        <span>means A uses B</span>
      </div>
    </div>
  );
};
