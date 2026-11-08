import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ForceGraph3D, { ForceGraphMethods } from 'react-force-graph-3d';
import * as THREE from 'three';
import { Maximize2, ZoomIn, ZoomOut, Layers } from 'lucide-react';
import { ClusterInfo, GraphEdge, GraphNode, ImpactAnalysis } from '../types/index';
import { getHealthVisuals } from '../lib/healthColor';

interface CommandGraph3DProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters?: ClusterInfo[];
  selectedNode: GraphNode | null;
  impactAnalysis: ImpactAnalysis | null;
  selectedPathNodeIds: string[] | null;
  highlightedNodeIds?: string[];
  onSelectNode: (node: GraphNode | null) => void;
  onFallbackTo2D?: () => void;
  reducedMotion?: boolean;
  darkMode?: boolean;
}

function resolveId(endpoint: unknown): string {
  if (!endpoint) return '';
  if (typeof endpoint === 'string') return endpoint;
  if (typeof endpoint === 'object' && endpoint !== null && 'id' in endpoint) {
    return String((endpoint as { id: unknown }).id);
  }
  return '';
}

function checkWebGLSupport(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

class WebGLErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('3D WebGL context error caught gracefully:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const spriteCache = new Map<string, THREE.Sprite>();

function getOrCreateTextSprite(text: string, color: string, bgColor: string, borderColor: string): THREE.Sprite {
  const key = `${text}_${color}_${bgColor}_${borderColor}`;
  const cached = spriteCache.get(key);
  if (cached) return cached.clone();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Sprite();

  canvas.width = 512;
  canvas.height = 128;

  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 6;

  const r = 24;
  const x = 6;
  const y = 6;
  const w = canvas.width - 12;
  const h = canvas.height - 12;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = 'bold 48px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(44, 11, 1);
  spriteCache.set(key, sprite);
  return sprite.clone();
}

export const CommandGraph3D: React.FC<CommandGraph3DProps> = ({
  nodes,
  edges,
  selectedNode,
  impactAnalysis,
  selectedPathNodeIds,
  onSelectNode,
  onFallbackTo2D,
  reducedMotion = false,
  darkMode = false,
}) => {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const isWebGLSupported = useMemo(() => checkWebGLSupport(), []);
  const [dimensions, setDimensions] = useState(() => ({
    width: typeof window !== 'undefined' ? Math.max(600, window.innerWidth - 380) : 900,
    height: typeof window !== 'undefined' ? Math.max(400, window.innerHeight - 56) : 600,
  }));

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0 && h > 0) {
          setDimensions({ width: w, height: h });
        }
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const nodeStatusMap = useMemo(() => {
    const map = new Map<string, 'selected' | 'direct' | 'indirect' | 'isolated' | 'unrelated'>();
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

  // A transparent renderer preserves the CSS grid; spatial points add depth as the camera orbits.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let dispose = () => {};
    const initialize = () => {
      const graph = fgRef.current;
      if (!graph) { if (!cancelled) timer = setTimeout(initialize, 60); return; }
      const scene = graph.scene();
      const light = new THREE.AmbientLight(0xffffff, 2);
      const positions: number[] = [];
      for (let z = -500; z <= 500; z += 125) {
        for (let x = -750; x <= 750; x += 75) {
          for (let y = -500; y <= 500; y += 75) positions.push(x, y, z);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({
        color: getComputedStyle(document.documentElement).getPropertyValue('--dot-major').trim(),
        size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0.5, depthWrite: false,
      });
      const dots = new THREE.Points(geometry, material);
      dots.name = 'spatial-background-dots';
      scene.add(light, dots);
      dispose = () => { scene.remove(light, dots); geometry.dispose(); material.dispose(); light.dispose(); };
    };
    if (isWebGLSupported) initialize();
    return () => { cancelled = true; clearTimeout(timer); dispose(); };
  }, [darkMode, isWebGLSupported]);

  useEffect(() => {
    const timer = setTimeout(() => fgRef.current?.zoomToFit(reducedMotion ? 0 : 500, 50), 350);
    return () => clearTimeout(timer);
  }, [nodes, reducedMotion]);

  useEffect(() => {
    if (!selectedNode || !fgRef.current) return;
    const fg = fgRef.current;
    const timer = setTimeout(() => {
      try {
        const currentNodes =
          (fg as unknown as { graphData?: () => { nodes: (GraphNode & { x?: number; y?: number; z?: number })[] } })
            .graphData?.()?.nodes || (graphData.nodes as (GraphNode & { x?: number; y?: number; z?: number })[]);
        const nodeObj = currentNodes.find((n) => n.id === selectedNode.id);
        if (nodeObj && nodeObj.x !== undefined && nodeObj.y !== undefined && nodeObj.z !== undefined) {
          const dist = 150;
          const hyp = Math.hypot(nodeObj.x || 1, nodeObj.y || 1, nodeObj.z || 1);
          const ratio = 1 + dist / hyp;
          fg.cameraPosition(
            { x: nodeObj.x * ratio, y: nodeObj.y * ratio, z: nodeObj.z * ratio },
            { x: nodeObj.x, y: nodeObj.y, z: nodeObj.z },
            reducedMotion ? 0 : 450
          );
        } else {
          fg.zoomToFit(reducedMotion ? 0 : 400, 50);
        }
      } catch {
        fg.zoomToFit(reducedMotion ? 0 : 400, 50);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [selectedNode, reducedMotion]);

  const handleFitView = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.zoomToFit(reducedMotion ? 0 : 500, 40);
  }, [reducedMotion]);

  const handleZoomIn = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const camera = fg.camera?.();
    const pos = camera ? camera.position : { x: 0, y: 0, z: 240 };
    fg.cameraPosition(
      { x: pos.x * 0.8, y: pos.y * 0.8, z: pos.z * 0.8 },
      undefined,
      reducedMotion ? 0 : 300
    );
  }, [reducedMotion]);

  const handleZoomOut = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const camera = fg.camera?.();
    const pos = camera ? camera.position : { x: 0, y: 0, z: 240 };
    fg.cameraPosition(
      { x: pos.x * 1.25, y: pos.y * 1.25, z: pos.z * 1.25 },
      undefined,
      reducedMotion ? 0 : 300
    );
  }, [reducedMotion]);

  const renderNodeObject = useCallback(
    (rawNode: object) => {
      const node = rawNode as GraphNode;
      const visuals = getHealthVisuals(node.health);
      const status = nodeStatusMap.get(node.id) || 'unrelated';
      const isSelected = selectedNode?.id === node.id;
      const isDirect = status === 'direct';
      const isIndirect = status === 'indirect';
      const isIsolated = status === 'isolated';
      const isDimmed = selectedNode !== null && status === 'unrelated';

      const group = new THREE.Group();
      const baseRadius = 8.5 + Math.min(4.0, node.loc / 350);

      let coreColor = visuals.coreColor;
      let emissiveIntensity = 0.8;

      if (isSelected) {
        coreColor = '#10b981';
        emissiveIntensity = 2.2;
      } else if (isDirect || isIsolated) {
        coreColor = '#34d399';
        emissiveIntensity = 1.6;
      } else if (isIndirect) {
        coreColor = '#38bdf8';
        emissiveIntensity = 1.4;
      } else if (isDimmed) {
        coreColor = '#475569';
        emissiveIntensity = 0.1;
      }

      const coreGeo = new THREE.SphereGeometry(baseRadius, 24, 24);
      const coreMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(coreColor),
        emissive: new THREE.Color(coreColor),
        emissiveIntensity,
        roughness: 0.25,
        metalness: 0.15,
        transparent: isDimmed,
        opacity: isDimmed ? 0.35 : 1.0,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      group.add(coreMesh);

      if (!isDimmed) {
        const haloRadius = baseRadius * (isSelected ? 2.2 : 1.6);
        const haloGeo = new THREE.SphereGeometry(haloRadius, 16, 16);
        const haloMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(coreColor),
          transparent: true,
          opacity: isSelected ? 0.45 : 0.2,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const haloMesh = new THREE.Mesh(haloGeo, haloMat);
        group.add(haloMesh);
      }

      if (isSelected) {
        const ringGeo = new THREE.TorusGeometry(baseRadius * 2.3, 0.6, 12, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#10b981'),
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        group.add(ringMesh);
      }

      const shouldShowLabel = nodes.length <= 8 || isSelected || isDirect || isIndirect || isIsolated;

      if (shouldShowLabel && !isDimmed) {
        let labelColor = '#f8fafc';
        let labelBg = 'rgba(15, 23, 42, 0.95)';
        let labelBorder = '#334155';

        if (isSelected) {
          labelColor = '#6ee7b7';
          labelBg = 'rgba(6, 78, 59, 0.96)';
          labelBorder = '#10b981';
        } else if (isDirect || isIsolated) {
          labelColor = '#a7f3d0';
          labelBg = 'rgba(6, 50, 40, 0.96)';
          labelBorder = '#059669';
        } else if (isIndirect) {
          labelColor = '#bae6fd';
          labelBg = 'rgba(8, 47, 73, 0.96)';
          labelBorder = '#0284c7';
        }

        const labelSprite = getOrCreateTextSprite(node.name, labelColor, labelBg, labelBorder);
        labelSprite.position.set(0, baseRadius + 13, 0);
        group.add(labelSprite);
      }

      return group;
    },
    [selectedNode, nodeStatusMap, nodes.length]
  );

  const graphData = useMemo(() => {
    return {
      nodes: nodes.map((n) => ({ ...n })),
      links: edges.map((e) => ({
        ...e,
        source: resolveId(e.source),
        target: resolveId(e.target),
      })),
    };
  }, [nodes, edges]);

  const fallbackUI = (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--bg-canvas)] p-6 text-center text-slate-800 dark:text-slate-200">
      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-4 shadow-lg">
        <Layers className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold mb-2">3D Force View Fallback</h3>
      <p className="max-w-md text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
        Hardware WebGL context could not be initialized in this browser session. The full dependency architecture and line-level caller tracing is fully interactive in the 2D Planar Map.
      </p>
      {onFallbackTo2D && (
        <button
          type="button"
          onClick={onFallbackTo2D}
          className="px-4 py-2 bg-[#3730A3] hover:bg-[#312E81] text-white text-xs font-semibold rounded-xl shadow-md transition cursor-pointer"
        >
          Return to 2D Planar Map
        </button>
      )}
    </div>
  );

  if (!isWebGLSupported) {
    return fallbackUI;
  }

  return (
    <div ref={containerRef} data-testid="graph-3d" className="spatial-dot-canvas spatial-dot-3d relative h-full w-full overflow-hidden select-none">
      <WebGLErrorBoundary fallback={fallbackUI}>
        <ForceGraph3D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          backgroundColor="rgba(0,0,0,0)"
          rendererConfig={{ alpha: true, antialias: true }}
          showNavInfo={false}
          enableNodeDrag={true}
          nodeThreeObject={renderNodeObject}
          nodeThreeObjectExtend={false}
          nodeLabel={(rawNode) => {
            const n = rawNode as GraphNode;
            const v = getHealthVisuals(n.health);
            return `<div style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(16, 185, 129, 0.4); padding: 8px 12px; border-radius: 8px; font-family: monospace; font-size: 11px; color: #f8fafc; box-shadow: 0 8px 24px rgba(0,0,0,0.85);">
              <div style="font-weight: 700; color: #34d399; font-size: 12px;">${n.name}</div>
              <div style="color: #94a3b8; font-size: 10px; margin-top: 2px;">${n.clusterName}</div>
              <div style="margin-top: 4px; font-size: 10px; color: #cbd5e1;">Health: <b style="color: ${v.coreColor}">${n.health}/100</b> · Complexity: <b>${n.complexity}</b></div>
            </div>`;
          }}
          onNodeClick={(rawNode) => {
            const node = rawNode as GraphNode;
            onSelectNode(node);
          }}
          onBackgroundClick={() => onSelectNode(null)}
          linkWidth={(rawLink) => {
            const link = rawLink as GraphEdge;
            const sId = resolveId(link.source);
            const tId = resolveId(link.target);

            const isTraced =
              selectedNode &&
              (tId === selectedNode.id ||
                nodeStatusMap.get(sId) === 'direct' ||
                nodeStatusMap.get(sId) === 'indirect');

            if (isTraced) return 3.2;
            return 1.0;
          }}
          linkColor={(rawLink) => {
            const link = rawLink as GraphEdge;
            const sId = resolveId(link.source);
            const tId = resolveId(link.target);
            const isDark = darkMode;

            if (selectedNode) {
              const isTraced = tId === selectedNode.id && nodeStatusMap.get(sId) === 'direct';
              if (isTraced) return isDark ? 'rgba(16, 185, 129, 0.95)' : 'rgba(5, 150, 105, 0.85)';

              const isIndirect = nodeStatusMap.get(sId) === 'indirect' || nodeStatusMap.get(tId) === 'direct';
              if (isIndirect) return isDark ? 'rgba(56, 189, 248, 0.85)' : 'rgba(2, 132, 199, 0.75)';

              return isDark ? 'rgba(51, 65, 85, 0.15)' : 'rgba(203, 213, 225, 0.4)';
            }

            return isDark ? 'rgba(100, 116, 139, 0.45)' : 'rgba(148, 163, 184, 0.55)';
          }}
          linkDirectionalParticles={(rawLink) => {
            if (reducedMotion) return 0;

            const link = rawLink as GraphEdge;
            const sId = resolveId(link.source);
            const tId = resolveId(link.target);

            if (selectedNode) {
              const isTraced =
                tId === selectedNode.id ||
                nodeStatusMap.get(sId) === 'direct' ||
                nodeStatusMap.get(sId) === 'indirect';
              return isTraced ? 5 : 0;
            }
            return 1;
          }}
          linkDirectionalParticleSpeed={0.007}
          linkDirectionalParticleWidth={3.0}
          linkDirectionalParticleColor={() => '#34d399'}
        />
      </WebGLErrorBoundary>

      <div className="absolute bottom-4 left-4 flex items-center gap-1 rounded-xl bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 p-1 text-slate-700 dark:text-slate-300 shadow-xl backdrop-blur-md">
        <button onClick={handleZoomIn} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"><ZoomIn className="h-4 w-4" /></button>
        <button onClick={handleZoomOut} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"><ZoomOut className="h-4 w-4" /></button>
        <button onClick={handleFitView} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"><Maximize2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
};