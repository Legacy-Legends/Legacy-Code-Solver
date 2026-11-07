import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ForceGraph3D, { ForceGraphMethods } from 'react-force-graph-3d';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ClusterInfo, GraphEdge, GraphNode } from '../types';
import { getHealthVisuals } from '../lib/healthColor';

interface CommandGraph3DProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: ClusterInfo[];
  selectedNode: GraphNode | null;
  onSelectNode: (node: GraphNode | null) => void;
}

function resolveId(endpoint: string | GraphNode): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.id;
}

export const CommandGraph3D: React.FC<CommandGraph3DProps> = ({
  nodes,
  edges,
  clusters,
  selectedNode,
  onSelectNode,
}) => {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  // Window resize listener for full-screen command center
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Map cluster anchors for 5-cluster spatial grouping
  const clusterAnchorMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number; z: number }>();
    clusters.forEach((c) => map.set(c.id, c.anchor));
    return map;
  }, [clusters]);

  const nodesById = useMemo(() => {
    const map = new Map<string, GraphNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Configure UnrealBloomPass and 5-cluster custom force layout
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    // Configure link distance & charge repulsion so 5 clusters are distinct
    const linkForce = fg.d3Force('link') as
      | { distance?: (fn: (edge: GraphEdge) => number) => void }
      | undefined;
    if (linkForce && typeof linkForce.distance === 'function') {
      linkForce.distance((edge: GraphEdge) => {
        const sNode = nodesById.get(resolveId(edge.source));
        const tNode = nodesById.get(resolveId(edge.target));
        if (sNode && tNode && sNode.clusterId === tNode.clusterId) {
          return 34;
        }
        return 135;
      });
    }

    const chargeForce = fg.d3Force('charge') as
      | { strength?: (val: number) => void }
      | undefined;
    if (chargeForce && typeof chargeForce.strength === 'function') {
      chargeForce.strength(-95);
    }

    // Add custom cluster attraction force pulling each node gently toward its cluster anchor
    fg.d3Force('cluster', (alpha: number) => {
      const strength = alpha * 0.32;
      for (const node of nodes) {
        const anchor = clusterAnchorMap.get(node.clusterId);
        if (!anchor) continue;
        node.vx = (node.vx ?? 0) + (anchor.x - (node.x ?? 0)) * strength;
        node.vy = (node.vy ?? 0) + (anchor.y - (node.y ?? 0)) * strength;
        node.vz = (node.vz ?? 0) + (anchor.z - (node.z ?? 0)) * strength;
      }
    });

    fg.d3ReheatSimulation();

    // Add subtle UnrealBloomPass once on the composer
    try {
      const composer = fg.postProcessingComposer?.();
      if (composer && !(composer as unknown as { __bloomAdded?: boolean }).__bloomAdded) {
        const bloomPass = new UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
          0.85,
          0.35,
          0.2
        );
        composer.addPass(bloomPass);
        (composer as unknown as { __bloomAdded?: boolean }).__bloomAdded = true;
      }
    } catch {
      // Fallback gracefully if postProcessingComposer is unavailable in environment
    }
  }, [nodes, clusterAnchorMap, nodesById]);

  // Focus camera gently when selectedNode changes via drawer navigation
  const focusCameraOnNode = useCallback((node: GraphNode) => {
    const fg = fgRef.current;
    if (!fg || node.x === undefined || node.y === undefined || node.z === undefined) {
      return;
    }
    const distance = 165;
    const distRatio = 1 + distance / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
    fg.cameraPosition(
      {
        x: node.x * distRatio,
        y: node.y * distRatio,
        z: node.z * distRatio,
      },
      { x: node.x, y: node.y, z: node.z },
      900
    );
  }, []);

  // Build custom 3D sphere + outer glow aura for each node based on health (0-100)
  const renderNodeObject = useCallback(
    (rawNode: object) => {
      const node = rawNode as GraphNode;
      const visuals = getHealthVisuals(node.health);
      const isSelected = selectedNode?.id === node.id;

      const group = new THREE.Group();
      const baseRadius = 3.8 + Math.min(2.8, node.loc / 650);

      // 1. Inner Core Sphere (teal-green for healthy, dim amber for sick, never red)
      const coreGeo = new THREE.SphereGeometry(baseRadius, 24, 24);
      const coreMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(visuals.coreColor),
        emissive: new THREE.Color(visuals.coreColor),
        emissiveIntensity: isSelected
          ? visuals.emissiveIntensity * 1.45
          : visuals.emissiveIntensity,
        roughness: 0.25,
        metalness: 0.2,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      group.add(coreMesh);

      // 2. Outer Glow Halo (scaled and saturated by health)
      const auraRadius = baseRadius * (isSelected ? visuals.glowScale * 1.2 : visuals.glowScale);
      const auraGeo = new THREE.SphereGeometry(auraRadius, 20, 20);
      const auraMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(visuals.auraColor),
        transparent: true,
        opacity: isSelected ? Math.min(0.55, visuals.auraOpacity * 1.7) : visuals.auraOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const auraMesh = new THREE.Mesh(auraGeo, auraMat);
      group.add(auraMesh);

      // 3. Selection Indicator Ring when inspected
      if (isSelected) {
        const ringGeo = new THREE.TorusGeometry(baseRadius * 2.35, 0.32, 12, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#00f5d4'),
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        group.add(ringMesh);
      }

      return group;
    },
    [selectedNode]
  );

  const graphData = useMemo(
    () => ({
      nodes,
      links: edges,
    }),
    [nodes, edges]
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#050811]">
      <ForceGraph3D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        backgroundColor="#050811"
        showNavInfo={false}
        nodeThreeObject={renderNodeObject}
        nodeThreeObjectExtend={false}
        nodeLabel={(rawNode) => {
          const n = rawNode as GraphNode;
          const v = getHealthVisuals(n.health);
          return `<div style="background: rgba(7,12,24,0.92); border: 1px solid rgba(45,212,191,0.35); padding: 6px 10px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #f1f5f9; box-shadow: 0 4px 20px rgba(0,0,0,0.7);">
            <div style="font-weight: 700; color: ${v.coreColor};">${n.name}</div>
            <div style="color: #94a3b8; font-size: 10px;">${n.clusterName}</div>
            <div style="margin-top: 3px; font-size: 10px;">Health: <span style="color: ${v.coreColor}; font-weight: 600;">${n.health}/100</span> · Complexity: <b>${n.complexity}</b></div>
          </div>`;
        }}
        onNodeClick={(rawNode) => {
          const node = rawNode as GraphNode;
          onSelectNode(node);
          focusCameraOnNode(node);
        }}
        onBackgroundClick={() => onSelectNode(null)}
        linkWidth={(rawLink) => {
          const link = rawLink as GraphEdge;
          const sId = resolveId(link.source);
          const tId = resolveId(link.target);
          if (selectedNode && (sId === selectedNode.id || tId === selectedNode.id)) {
            return 1.6;
          }
          return 0.65;
        }}
        linkColor={(rawLink) => {
          const link = rawLink as GraphEdge;
          const sId = resolveId(link.source);
          const tId = resolveId(link.target);
          if (selectedNode && (sId === selectedNode.id || tId === selectedNode.id)) {
            return 'rgba(45, 212, 191, 0.72)';
          }
          return 'rgba(71, 85, 105, 0.34)';
        }}
        linkDirectionalParticles={(rawLink) => {
          const link = rawLink as GraphEdge;
          return Math.max(2, Math.min(4, Math.round(link.weight / 3)));
        }}
        linkDirectionalParticleSpeed={(rawLink) => {
          const link = rawLink as GraphEdge;
          return 0.0035 + link.weight * 0.00055;
        }}
        linkDirectionalParticleWidth={(rawLink) => {
          const link = rawLink as GraphEdge;
          const sId = resolveId(link.source);
          const tId = resolveId(link.target);
          if (selectedNode && (sId === selectedNode.id || tId === selectedNode.id)) {
            return 2.6;
          }
          return 1.75;
        }}
        linkDirectionalParticleColor={(rawLink) => {
          const link = rawLink as GraphEdge;
          const sourceNode = nodesById.get(resolveId(link.source));
          if (!sourceNode) return '#2dd4bf';
          return sourceNode.health >= 50 ? '#00f5d4' : '#c48b37';
        }}
      />
    </div>
  );
};
