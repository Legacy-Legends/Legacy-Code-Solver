import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { organicLayout } from '../lib/organicLayout';
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
  highlightedNodeIds?: string[];
  fitSignal?: number;
  onSelectNode: (node: GraphNode | null) => void;
  onSelectEdge: (edge: GraphEdge | null) => void;
  onOpenEvidence?: (evidence: SourceEvidence, pathList?: SourceEvidence[]) => void;
  resolveEvidenceForEdge?: (edge: GraphEdge) => SourceEvidence | undefined;
  darkMode?: boolean;
}

function resolveId(endpoint: string | GraphNode): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.id;
}

const CARD_W = 204;
const CARD_H = 60;
const HALF_W = CARD_W / 2;
const HALF_H = CARD_H / 2;

export const PlanarGraph2D: React.FC<PlanarGraph2DProps> = ({
  nodes,
  edges,
  selectedNode,
  selectedEdge,
  impactAnalysis,
  showIndirect,
  selectedPathNodeIds,
  highlightedNodeIds = [],
  fitSignal = 0,
  onSelectNode,
  onSelectEdge,
  onOpenEvidence,
  resolveEvidenceForEdge,
  darkMode = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Dragging State for Graph Panning
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
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);

  // Dragging State for Individual Node Placement
  const [nodeOverrides, setNodeOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const dragNodeRef = useRef<{ id: string; startX: number; startY: number; clientX: number; clientY: number } | null>(null);
  const [isDraggingNode, setIsDraggingNode] = useState(false);

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

  const initialPositions = useMemo(() => organicLayout(nodes, CARD_W, CARD_H), [nodes]);
  const positionedNodes = useMemo(() => nodes.map(node => {
    const position = nodeOverrides[node.id] || initialPositions.get(node.id) || { x: 0, y: 0 };
    return { ...node, posX: position.x, posY: position.y };
  }), [nodes, initialPositions, nodeOverrides]);

  const positionedNodesById = useMemo(() => {
    const map = new Map<string, (typeof positionedNodes)[0]>();
    positionedNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [positionedNodes]);

  const fitGraphToViewport = useCallback(() => {
    if (positionedNodes.length === 0 || dimensions.width === 0 || dimensions.height === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const xs = positionedNodes.map((n) => n.posX);
    const ys = positionedNodes.map((n) => n.posY);
    const minX = Math.min(...xs) - HALF_W - 32;
    const maxX = Math.max(...xs) + HALF_W + 32;
    const minY = Math.min(...ys) - HALF_H - 36;
    const maxY = Math.max(...ys) + HALF_H + 36;

    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);

    const padX = dimensions.width < 500 ? 20 : 56;
    const padY = dimensions.height < 500 ? 32 : 72;
    const scaleX = (dimensions.width - padX) / contentW;
    const scaleY = (dimensions.height - padY) / contentH;
    const idealZoom = Math.max(0.3, Math.min(1.0, Math.min(scaleX, scaleY)));

    setZoom(Number(idealZoom.toFixed(2)));
    setPan({ x: -(minX + maxX) / 2 * idealZoom, y: -(minY + maxY) / 2 * idealZoom });
  }, [positionedNodes, dimensions.width, dimensions.height]);

  // Drag overrides update geometry, but must not refit the viewport on every move.
  const fitRef = useRef(fitGraphToViewport);
  fitRef.current = fitGraphToViewport;
  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) fitRef.current();
  }, [nodes.length, fitSignal, dimensions.width, dimensions.height]);

  const nodeStatusMap = useMemo(() => {
    const map = new Map<
      string,
      'selected' | 'direct' | 'indirect' | 'path' | 'changed' | 'unrelated'
    >();

    if (!selectedNode && !selectedEdge) {
      nodes.forEach((n) => map.set(n.id, highlightedNodeIds.includes(n.id) ? 'changed' : 'unrelated'));
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
  }, [selectedNode, selectedEdge, impactAnalysis, showIndirect, selectedPathNodeIds, highlightedNodeIds, nodes]);

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

  const viewW = dimensions.width || 960;
  const viewH = dimensions.height || 640;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      containerRef.current?.setPointerCapture(e.pointerId);
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

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragNodeRef.current && containerRef.current) {
      const drag = dragNodeRef.current;
      if (!pointerStateRef.current.didDrag && Math.hypot(e.clientX - drag.clientX, e.clientY - drag.clientY) <= 4) return;
      pointerStateRef.current.didDrag = true;
      const rect = containerRef.current.getBoundingClientRect();
      const worldX = (e.clientX - rect.left - (viewW / 2 + pan.x)) / zoom;
      const worldY = (e.clientY - rect.top - (viewH / 2 + pan.y)) / zoom;

      setNodeOverrides((prev) => ({
        ...prev,
        [dragNodeRef.current!.id]: {
          x: worldX - dragNodeRef.current!.startX,
          y: worldY - dragNodeRef.current!.startY,
        },
      }));
      if (!isDraggingNode) setIsDraggingNode(true);
      return; 
    }

    const st = pointerStateRef.current;
    if (!st.isDown) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.didDrag && Math.hypot(dx, dy) > 4) {
      st.didDrag = true;
      setIsDraggingCanvas(true);
    }
    if (st.didDrag) {
      setPan({
        x: st.panStartX + dx,
        y: st.panStartY + dy,
      });
    }
  }, [pan, zoom, viewW, viewH, isDraggingNode]);

  const handlePointerUp = useCallback(() => {
    pointerStateRef.current.isDown = false;
    dragNodeRef.current = null;
    setIsDraggingCanvas(false);
    setIsDraggingNode(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((z) => Number(Math.max(0.3, Math.min(2.2, z + delta)).toFixed(2)));
  }, []);

  const hasActiveFilter = Boolean(selectedNode || selectedEdge);
  const subGridCoords = [0, 28, 56, 84, 112];

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onLostPointerCapture={handlePointerUp}
      data-testid="graph-canvas"
      onWheel={handleWheel}
      onClick={() => {
        if (!pointerStateRef.current.didDrag) {
          onSelectNode(null);
          onSelectEdge(null);
        }
      }}
      className={`relative h-full w-full overflow-hidden select-none transition-colors duration-200 bg-[var(--bg-canvas)]`}
      style={{ cursor: isDraggingCanvas || isDraggingNode ? 'grabbing' : 'grab', touchAction: 'none' }}
    >
      <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono shadow-md backdrop-blur-md border transition-colors ${
            darkMode
              ? 'bg-slate-900/90 border-slate-700/80 text-slate-300'
              : 'bg-white/95 border-slate-200/90 text-slate-700'
          }`}
        >
          {selectedNode ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span className="truncate max-w-xs">
                Class: <strong className={darkMode ? 'text-emerald-400' : 'text-emerald-700'}>{selectedNode.name}</strong>
              </span>
              <span className="text-slate-400">·</span>
              <span className="font-sans font-medium text-[11px]">
                {impactAnalysis?.directDependents.length || 0} direct caller{impactAnalysis?.directDependents.length === 1 ? '' : 's'}
              </span>
              <span className="text-slate-400 hidden sm:inline">· Click background to reset</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
              <span>Drag classes to reposition, click to isolate callers</span>
            </>
          )}
        </div>
      </div>

      <svg width="100%" height="100%" className="absolute inset-0" viewBox={`0 0 ${viewW} ${viewH}`}>
        <defs>
          <pattern
            id="spatial-dots-parallax"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${viewW / 2 + pan.x * 0.45}, ${
              viewH / 2 + pan.y * 0.45
            }) scale(${0.65 + zoom * 0.35})`}
          >
            <circle cx="12" cy="12" r="1.0" fill={'var(--dot-minor)'} opacity={darkMode ? 0.6 : 0.7} />
          </pattern>

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
                    r={isMajor ? 2.1 : 1.3}
                    fill={isMajor ? 'var(--dot-major)' : 'var(--dot-minor)'}
                    opacity={darkMode ? (isMajor ? 0.9 : 0.7) : (isMajor ? 0.85 : 0.75)}
                  />
                );
              })
            )}
          </pattern>

          <marker id="arrow-default" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="5.5" markerHeight="5.5" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M 1 1.6 L 6.5 4 L 1 6.4 z" fill={darkMode ? '#64748B' : '#94A3B8'} />
          </marker>
          <marker id="arrow-active" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="6.5" markerHeight="6.5" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M 1 1.2 L 6.5 4 L 1 6.8 z" fill={darkMode ? '#38BDF8' : '#0284C7'} />
          </marker>
          <marker id="arrow-indirect" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="5.5" markerHeight="5.5" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M 1 1.5 L 6.5 4 L 1 6.5 z" fill={darkMode ? '#A5B4FC' : '#6366F1'} />
          </marker>
          <marker id="arrow-hover" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M 1 1.4 L 6.5 4 L 1 6.6 z" fill={darkMode ? '#60A5FA' : '#2563EB'} />
          </marker>
        </defs>

        <rect width="100%" height="100%" fill="url(#spatial-dots-parallax)" className="pointer-events-none" />
        <rect width="100%" height="100%" fill="url(#spatial-dots-world)" className="pointer-events-none" />

        <g transform={`translate(${viewW / 2 + pan.x}, ${viewH / 2 + pan.y}) scale(${zoom})`}>
          
          {edges.map((edge) => {
            const sId = resolveId(edge.source);
            const tId = resolveId(edge.target);
            const sNode = positionedNodesById.get(sId);
            const tNode = positionedNodesById.get(tId);
            if (!sNode || !tNode) return null;

            const isEdgeSelected = selectedEdge?.id === edge.id;
            const inSelectedPath = isEdgeInSelectedPath(sId, tId);
            const isDirectCallerEdge = !selectedPathNodeIds && selectedNode !== null && tId === selectedNode.id && nodeStatusMap.get(sId) === 'direct';
            const isIndirectCallerEdge = !selectedPathNodeIds && selectedNode !== null && showIndirect && ((nodeStatusMap.get(sId) === 'indirect' && nodeStatusMap.get(tId) === 'direct') || (tId === selectedNode.id && nodeStatusMap.get(sId) === 'direct'));

            const isHovered = hoveredNodeId === sId || hoveredNodeId === tId;
            const isHoverPreview = !hasActiveFilter && hoveredNodeId !== null && isHovered;
            const isActiveDirect = isEdgeSelected || inSelectedPath || isDirectCallerEdge;
            const isActiveIndirect = !isActiveDirect && isIndirectCallerEdge;
            const isHighlighted = isActiveDirect || isActiveIndirect || isHoverPreview;

            let strokeColor = 'var(--graph-edge)';
            let strokeWidth = 1.2;
            let marker = 'url(#arrow-default)';
            let opacity = hasActiveFilter ? 0.06 : 0.45;

            if (isActiveDirect) {
              strokeColor = darkMode ? '#38BDF8' : '#0284C7';
              strokeWidth = 2.4;
              marker = 'url(#arrow-active)';
              opacity = 1;
            } else if (isActiveIndirect) {
              strokeColor = darkMode ? '#818CF8' : '#6366F1';
              strokeWidth = 2.0;
              marker = 'url(#arrow-indirect)';
              opacity = 0.95;
            } else if (isHoverPreview) {
              strokeColor = darkMode ? '#60A5FA' : '#2563EB';
              strokeWidth = 2.0;
              marker = 'url(#arrow-hover)';
              opacity = 0.9;
            }

            const dx = tNode.posX - sNode.posX;
            const dy = tNode.posY - sNode.posY;
            const dist = Math.hypot(dx, dy);

            let pathD = '';
            let labelX = 0;
            let labelY = 0;

            if (dist < 10) {
              pathD = ''; 
            } else if (Math.abs(dx) < CARD_W * 1.5) {
              const startX = sNode.posX;
              const startY = sNode.posY + (dy > 0 ? HALF_H : -HALF_H);
              const endX = tNode.posX;
              const endY = tNode.posY - (dy > 0 ? HALF_H : -HALF_H);
              const curveDist = Math.abs(dy) * 0.4;
              pathD = `M ${startX} ${startY} C ${startX} ${startY + (dy > 0 ? curveDist : -curveDist)}, ${endX} ${endY - (dy > 0 ? curveDist : -curveDist)}, ${endX} ${endY}`;
              labelX = (startX + endX) / 2;
              labelY = (startY + endY) / 2;
            } else {
              const startX = sNode.posX + (dx > 0 ? HALF_W : -HALF_W);
              const startY = sNode.posY;
              const endX = tNode.posX - (dx > 0 ? HALF_W : -HALF_W);
              const endY = tNode.posY;
              const curveDist = Math.abs(dx) * 0.3;
              pathD = `M ${startX} ${startY} C ${startX + (dx > 0 ? curveDist : -curveDist)} ${startY}, ${endX - (dx > 0 ? curveDist : -curveDist)} ${endY}, ${endX} ${endY}`;
              labelX = (startX + endX) / 2;
              labelY = (startY + endY) / 2 - 12;
            }

            const evidence = resolveEvidenceForEdge ? resolveEvidenceForEdge(edge) : undefined;

            return (
              <g
                key={edge.id}
                data-edge-id={edge.id}
                className="cursor-pointer"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEdge(edge);
                  if (evidence && onOpenEvidence) {
                    onOpenEvidence(evidence, [evidence]);
                  }
                }}
              >
                <path d={pathD} fill="none" stroke="transparent" strokeWidth={22} />
                <path d={pathD} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeOpacity={opacity} strokeDasharray={isActiveIndirect && !inSelectedPath ? '5,4' : undefined} markerEnd={marker} />
                {(isHighlighted || (!hasActiveFilter && nodes.length <= 6)) && (
                  <g transform={`translate(${labelX}, ${labelY})`}>
                    <rect x="-34" y="-9" width="68" height="18" rx="5" fill={darkMode ? '#0A101D' : '#FFFFFF'} stroke={isHighlighted ? (isActiveIndirect ? '#818CF8' : '#38BDF8') : ('var(--border-color)')} strokeWidth={isHighlighted ? 1.5 : 1} />
                    <text x="0" y="3.5" fill={isHighlighted ? (isActiveIndirect ? '#C7D2FE' : '#38BDF8') : (darkMode ? '#94A3B8' : '#4B5563')} fontSize="9.5" fontFamily="JetBrains Mono, monospace" fontWeight={isHighlighted ? '700' : '500'} textAnchor="middle">
                      {edge.callSiteLine ? `calls :${edge.callSiteLine}` : edge.type}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {positionedNodes.map((node) => {
            const status = nodeStatusMap.get(node.id) || 'unrelated';
            const isSelected = status === 'selected';
            const isDirect = status === 'direct';
            const isIndirect = status === 'indirect';
            const isChanged = status === 'changed';
            const isDimmed = hasActiveFilter && status === 'unrelated';
            const isHovered = hoveredNodeId === node.id;

            let cardBg = 'var(--bg-surface)';
            let cardBorder = 'var(--border-color)';
            let borderWidth = 1.5;
            let titleColor = 'var(--text-primary)';
            let roleLabel = node.clusterName;
            let badgeBg = 'var(--bg-muted)';
            let badgeText = 'var(--text-muted)';

            if (isSelected) {
              cardBg = darkMode ? '#064E3B' : '#ECFDF5';
              cardBorder = darkMode ? '#10B981' : '#059669';
              borderWidth = 2.5;
              titleColor = darkMode ? '#6EE7B7' : '#065F46';
              roleLabel = 'TARGET CLASS';
              badgeBg = darkMode ? 'rgba(16, 185, 129, 0.25)' : '#D1FAE5';
              badgeText = darkMode ? '#6EE7B7' : '#065F46';
            } else if (isDirect) {
              cardBg = darkMode ? '#082F49' : '#F0F9FF';
              cardBorder = darkMode ? '#38BDF8' : '#0284C7';
              borderWidth = 2.0;
              titleColor = darkMode ? '#7DD3FC' : '#0369A1';
              roleLabel = 'DIRECT CALLER';
              badgeBg = darkMode ? 'rgba(56, 189, 248, 0.25)' : '#E0F2FE';
              badgeText = darkMode ? '#7DD3FC' : '#0369A1';
            } else if (isIndirect) {
              cardBg = darkMode ? '#1E1B4B' : '#EEF2FF';
              cardBorder = darkMode ? '#818CF8' : '#6366F1';
              borderWidth = 1.75;
              titleColor = darkMode ? '#C7D2FE' : '#4338CA';
              roleLabel = 'INDIRECT CALLER';
              badgeBg = darkMode ? 'rgba(129, 140, 248, 0.25)' : '#E0E7FF';
              badgeText = darkMode ? '#C7D2FE' : '#4338CA';
            } else if (isChanged) {
              cardBg = darkMode ? '#451A03' : '#FFFBEB';
              cardBorder = darkMode ? '#F59E0B' : '#D97706';
              borderWidth = 2.5;
              titleColor = darkMode ? '#FCD34D' : '#92400E';
              roleLabel = 'JUST MODERNIZED';
              badgeBg = darkMode ? 'rgba(245, 158, 11, 0.25)' : '#FEF3C7';
              badgeText = darkMode ? '#FCD34D' : '#92400E';
            } else if (isHovered && !hasActiveFilter) {
              cardBg = darkMode ? '#1E293B' : '#F8FAFC';
              cardBorder = darkMode ? '#38BDF8' : '#0284C7';
              borderWidth = 2;
            }

            const displayName = node.name.length > 21 ? `${node.name.slice(0, 20)}…` : node.name;

            return (
              <g
                key={node.id}
                data-node-id={node.id}
                role="button"
                tabIndex={0}
                aria-label={`Class ${node.name}, ${roleLabel}`}
                transform={`translate(${node.posX}, ${node.posY})`}
                opacity={isDimmed ? 0.22 : 1.0}
                className="cursor-pointer transition-opacity duration-200"
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  pointerStateRef.current.didDrag = false;
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  const worldX = (e.clientX - rect.left - (viewW / 2 + pan.x)) / zoom;
                  const worldY = (e.clientY - rect.top - (viewH / 2 + pan.y)) / zoom;
                  dragNodeRef.current = {
                    id: node.id,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    startX: worldX - node.posX,
                    startY: worldY - node.posY,
                  };
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectNode(node); }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!pointerStateRef.current.didDrag) onSelectNode(node);
                }}
              >
                <rect
                  x={-HALF_W}
                  y={-HALF_H}
                  width={CARD_W}
                  height={CARD_H}
                  rx={10}
                  fill={cardBg}
                  stroke={cardBorder}
                  strokeWidth={borderWidth}
                  filter={
                    isSelected
                      ? (darkMode ? 'drop-shadow(0 0 16px rgba(16, 185, 129, 0.4))' : 'drop-shadow(0 4px 12px rgba(5, 150, 105, 0.2))')
                      : isDirect
                      ? (darkMode ? 'drop-shadow(0 0 14px rgba(56, 189, 248, 0.35))' : 'drop-shadow(0 3px 10px rgba(2, 132, 199, 0.15))')
                      : (darkMode ? 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.04))')
                  }
                />
                {(isSelected || isDirect || isIndirect) && (
                  <rect x={-HALF_W} y={-HALF_H + 4} width={4.5} height={CARD_H - 8} rx={2} fill={cardBorder} />
                )}
                <text x={-HALF_W + 14} y={-9} fill={titleColor} fontSize="12" fontFamily="JetBrains Mono, monospace" fontWeight="600" letterSpacing="-0.01em">
                  {displayName}
                </text>
                <rect x={-HALF_W + 14} y={6} width={Math.min(CARD_W - 28, roleLabel.length * 6.5 + 14)} height={17} rx={4} fill={badgeBg} />
                <text x={-HALF_W + 21} y={18} fill={badgeText} fontSize="9" fontFamily="Inter, system-ui, sans-serif" fontWeight={isSelected || isDirect ? '700' : '600'} letterSpacing="0.03em">
                  {roleLabel.toUpperCase()}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <div onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} className={`absolute bottom-4 left-4 z-20 flex items-center gap-1 rounded-xl p-1 shadow-md backdrop-blur-md border ${darkMode ? 'bg-slate-900/90 border-slate-700/80 text-slate-300' : 'bg-white/90 border-slate-200/90 text-slate-700'}`}>
        <button type="button" onClick={() => setZoom((z) => Number(Math.min(2.2, z + 0.15).toFixed(2)))} aria-label="Zoom in" className={`rounded-lg p-1.5 transition cursor-pointer ${darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}><ZoomIn className="h-4 w-4" /></button>
        <button type="button" onClick={() => setZoom((z) => Number(Math.max(0.3, z - 0.15).toFixed(2)))} aria-label="Zoom out" className={`rounded-lg p-1.5 transition cursor-pointer ${darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}><ZoomOut className="h-4 w-4" /></button>
        <div className={`h-4 w-px my-auto ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
        <button type="button" onClick={fitGraphToViewport} aria-label="Fit graph" className={`flex items-center gap-1 rounded-lg px-2 py-1.5 font-sans text-xs font-medium transition cursor-pointer ${darkMode ? 'text-slate-300 hover:bg-slate-800 hover:text-slate-100' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}`}><Maximize2 className="h-3.5 w-3.5" /><span>Fit graph</span></button>
      </div>
    </div>
  );
};