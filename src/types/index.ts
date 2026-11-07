/**
 * SHARED DATA CONTRACT (Frontend <-> FastAPI Backend)
 * All field names strictly match the architecture & API specification.
 */

export type EdgeType = 'calls' | 'imports' | 'extends' | 'implements';

export interface ClusterInfo {
  id: string;
  name: string;
  packagePath: string;
  anchor: { x: number; y: number; z: number };
}

export interface GraphNode {
  id: string;
  name: string;
  path: string;
  clusterId: string;
  clusterName: string;
  /** Cyclomatic complexity score */
  complexity: number;
  /** Code health score from 0 to 100 (teal-green healthy, dim amber sick, never red) */
  health: number;
  loc: number;
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
}

export interface GraphEdge {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  type: EdgeType;
  weight: number;
}

export interface GraphData {
  overallHealth: number;
  clusters: ClusterInfo[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}
