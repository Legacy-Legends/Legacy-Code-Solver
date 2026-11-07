import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ForceGraph3D, { ForceGraphMethods } from 'react-force-graph-3d';
import * as THREE from 'three';
import { Maximize2 } from 'lucide-react';
import { ClusterInfo, GraphEdge, GraphNode, ImpactAnalysis } from '../types/index';
import { getHealthVisuals } from '../lib/healthColor';

interface CommandGraph3DProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters?: ClusterInfo[];
  selectedNode: GraphNode | null;
  impactAnalysis: ImpactAnalysis | null;
  selectedPathNodeIds: string[] | null;
  onSelectNode: (node: GraphNode | null) => void;
}

function resolveId(endpoint: string | GraphNode): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.id;
}

function createTextSprite(text: string, color: string, bgColor: string, borderColor: string) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Sprite();

  canvas.width = 512;
  canvas.height = 128;

  // Background box with rounded corners
  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 6;

  const r = 24;
  const x = 8;
  const y = 8;
  const w = canvas.width - 16;
  const h = canvas.height - 16;

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

  // Text
  ctx.fillStyle = color;
  ctx.font = 'bold 44px JetBrains Mono, monospace';
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
  return sprite;
}

export const CommandGraph3D: React.FC<CommandGraph3DProps> = ({
  nodes,
  edges,
  selectedNode,
  impactAnalysis,
  selectedPathNodeIds,
  onSelectNode,
}) => {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });

  // Measure container size
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 900,
          height: containerRef.current.clientHeight || 600,
        });
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

  // Set initial camera position on mount
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    // Add ambient and directional lights to the 3D scene so nodes are never dark!
    try {
      const scene = fg.scene?.();
      if (scene && !(scene as unknown as { __lightsAdded?: boolean }).__lightsAdded) {
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
        dirLight.position.set(100, 200, 150);
        scene.add(dirLight);

        const pointLight = new THREE.PointLight(0x00f5d4, 3.5, 400);
        pointLight.position.set(0, 0, 100);
        scene.add(pointLight);

        (scene as unknown as { __lightsAdded?: boolean }).__lightsAdded = true;
      }
    } catch {
      // Graceful fallback
    }

    // Set stable camera position centered on scene
    fg.cameraPosition({ x: 0, y: 0, z: 230 }, { x: 0, y: 0, z: 0 }, 400);

    const timer = setTimeout(() => {
      fg.zoomToFit(500, 40);
    }, 350);

    return () => clearTimeout(timer);
  }, []);

  const handleFitView = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.zoomToFit(600, 40);
  }, []);

  // Build custom 3D sphere + outer glow aura + billboard label
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
      // Scaled baseRadius so nodes are prominent and visible
      const baseRadius = 8.0 + Math.min(4.0, node.loc / 400);

      let coreColor = visuals.coreColor;
      let emissiveIntensity = 1.0;

      if (isSelected) {
        coreColor = '#00f5d4';
        emissiveIntensity = 2.0;
      } else if (isDirect || isIsolated) {
        coreColor = '#38bdf8';
        emissiveIntensity = 1.6;
      } else if (isIndirect) {
        coreColor = '#818cf8';
        emissiveIntensity = 1.4;
      } else if (isDimmed) {
        coreColor = '#334155';
        emissiveIntensity = 0.1;
      }

      // 1. Core Sphere
      const coreGeo = new THREE.SphereGeometry(baseRadius, 24, 24);
      const coreMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(coreColor),
        emissive: new THREE.Color(coreColor),
        emissiveIntensity,
        roughness: 0.2,
        metalness: 0.1,
        transparent: isDimmed,
        opacity: isDimmed ? 0.3 : 1.0,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      group.add(coreMesh);

      // 2. Halo Glow
      if (!isDimmed) {
        const haloRadius = baseRadius * (isSelected ? 2.4 : 1.7);
        const haloGeo = new THREE.SphereGeometry(haloRadius, 16, 16);
        const haloMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(coreColor),
          transparent: true,
          opacity: isSelected ? 0.5 : 0.25,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const haloMesh = new THREE.Mesh(haloGeo, haloMat);
        group.add(haloMesh);
      }

      // 3. Selection Indicator Ring
      if (isSelected) {
        const ringGeo = new THREE.TorusGeometry(baseRadius * 2.5, 0.5, 12, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#00f5d4'),
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        group.add(ringMesh);
      }

      // 4. Billboard text label
      const shouldShowLabel =
        nodes.length <= 6 || isSelected || isDirect || isIndirect || isIsolated;

      if (shouldShowLabel && !isDimmed) {
        let labelColor = '#f1f5f9';
        let labelBg = 'rgba(11, 19, 38, 0.94)';
        let labelBorder = '#334155';

        if (isSelected) {
          labelColor = '#00f5d4';
          labelBg = 'rgba(7, 34, 40, 0.96)';
          labelBorder = '#00f5d4';
        } else if (isDirect || isIsolated) {
          labelColor = '#7dd3fc';
          labelBg = 'rgba(8, 38, 56, 0.96)';
          labelBorder = '#38bdf8';
        } else if (isIndirect) {
          labelColor = '#a5b4fc';
          labelBg = 'rgba(20, 24, 58, 0.96)';
          labelBorder = '#818cf8';
        }

        const labelSprite = createTextSprite(node.name, labelColor, labelBg, labelBorder);
        labelSprite.position.set(0, baseRadius + 12, 0);
        group.add(labelSprite);
      }

      return group;
    },
    [selectedNode, nodeStatusMap, nodes.length]
  );

  const graphData = useMemo(() => ({ nodes, links: edges }), [nodes, edges]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-[#070b14] ambient-glow">
      <ForceGraph3D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        backgroundColor="#070b14"
        showNavInfo={false}
        enableNodeDrag={true}
        nodeThreeObject={renderNodeObject}
        nodeThreeObjectExtend={false}
        nodeLabel={(rawNode) => {
          const n = rawNode as GraphNode;
          const v = getHealthVisuals(n.health);
          return `<div style="background: rgba(13,19,34,0.95); border: 1px solid rgba(0,245,212,0.4); padding: 8px 12px; border-radius: 8px; font-family: monospace; font-size: 11px; color: #f1f5f9; box-shadow: 0 8px 24px rgba(0,0,0,0.85);">
            <div style="font-weight: 700; color: #00f5d4; font-size: 12px;">${n.name}</div>
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
          return 0.8;
        }}
        linkColor={(rawLink) => {
          const link = rawLink as GraphEdge;
          const sId = resolveId(link.source);
          const tId = resolveId(link.target);

          if (selectedNode) {
            const isTraced =
              tId === selectedNode.id && nodeStatusMap.get(sId) === 'direct';
            if (isTraced) return 'rgba(0, 245, 212, 0.95)';

            const isIndirect =
              nodeStatusMap.get(sId) === 'indirect' ||
              nodeStatusMap.get(tId) === 'direct';
            if (isIndirect) return 'rgba(129, 140, 248, 0.85)';

            return 'rgba(51, 65, 85, 0.12)';
          }

          return 'rgba(71, 85, 105, 0.4)';
        }}
        linkDirectionalParticles={(rawLink) => {
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
        linkDirectionalParticleSpeed={0.006}
        linkDirectionalParticleWidth={3.2}
        linkDirectionalParticleColor={() => '#00f5d4'}
      />

      {/* Floating Canvas Controls */}
      <div className="absolute bottom-4 left-4 flex items-center gap-1 rounded-xl glass-panel p-1 text-slate-300 shadow-xl backdrop-blur-xl">
        <button
          type="button"
          onClick={handleFitView}
          aria-label="Fit view"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
          title="Fit view / center graph"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
