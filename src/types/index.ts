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
  domain_tag?: string;
  domain_inferred?: boolean;
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
  callSiteLine?: number;
  callSiteCode?: string;
  explanation?: string;
}

export interface GraphData {
  overallHealth: number;
  clusters: ClusterInfo[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * EVIDENCE & IMPACT CONTRACTS
 */

export interface SourceLineContext {
  line: number;
  text: string;
  isCallSite: boolean;
}

export interface SourceEvidence {
  edgeId: string;
  callerId: string;
  callerName: string;
  callerPath: string;
  calleeId: string;
  calleeName: string;
  calleePath: string;
  lineNumber: number;
  statement: string;
  surroundingCode: SourceLineContext[];
  relationship: string;
  explanation: string;
  inferred?: boolean;
}

export interface DependentItem {
  node: GraphNode;
  edge: GraphEdge;
  callSiteLine?: number;
  explanation?: string;
  depth: 1 | 2; // 1 = direct, 2 = indirect
  pathIds: string[]; // sequence of node ids in dependency path from dependent to target
  evidence?: SourceEvidence;
}

export interface ImpactAnalysis {
  targetNode: GraphNode;
  directDependents: DependentItem[];
  indirectDependents: DependentItem[];
  totalAffected: number;
  isolatedPathNodeIds?: string[];
  timestamp: string;
}

export type DataSourceMode = 'sample' | 'enterprise' | 'live';
