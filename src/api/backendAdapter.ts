import { GraphData, ImpactAnalysis, GraphNode } from '../types/index';
import { computeImpactAnalysis } from '../lib/impactAnalysis';

export const BACKEND_URL =
  (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ||
  'http://localhost:8000';

export interface BackendStatus {
  isConnected: boolean;
  isChecking: boolean;
  endpoint: string;
  errorMessage?: string;
  lastChecked?: string;
}

export interface BackendBlastResult {
  matched_node_ids: string[];
  blast_node_ids: string[];
  blast_edge_ids: string[];
  percent: number;
  summary: string;
  affected_domains: string[];
}

/**
 * Checks connection to FastAPI backend.
 */
export async function checkBackendHealth(): Promise<{ ok: boolean; message?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);

    // Try /api/projects
    const resProjects = await fetch(`${BACKEND_URL}/api/projects`, {
      method: 'GET',
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timer);

    if (resProjects && resProjects.ok) {
      return { ok: true };
    }

    // Try /health as alternative
    const resHealth = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(1500),
    }).catch(() => null);

    if (resHealth && resHealth.ok) {
      return { ok: true };
    }

    return {
      ok: false,
      message: `Failed to connect to FastAPI backend at ${BACKEND_URL}. Ensure the server is running on port 8000.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `FastAPI backend unavailable at ${BACKEND_URL} (${msg})`,
    };
  }
}

/**
 * Fetches live graph data from FastAPI backend.
 * Checks /api/projects/demo/graph first, falls back to /api/graph.
 * Never silently substitutes mock data upon failure.
 */
export async function fetchLiveGraphData(projectId: string = 'demo'): Promise<GraphData> {
  let res = await fetch(`${BACKEND_URL}/api/projects/${projectId}/graph`, {
    headers: { Accept: 'application/json' },
  }).catch(() => null);

  if (!res || !res.ok) {
    res = await fetch(`${BACKEND_URL}/api/graph`, {
      headers: { Accept: 'application/json' },
    });
  }

  if (!res.ok) {
    throw new Error(
      `FastAPI returned HTTP ${res.status} (${res.statusText}) on GET /api/projects/${projectId}/graph`
    );
  }

  const data = (await res.json()) as GraphData;
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    throw new Error(
      `Invalid backend contract: Expected GraphData schema with nodes[] and edges[], received: ${JSON.stringify(
        data
      ).slice(0, 100)}`
    );
  }

  return data;
}

/**
 * Requests blast radius analysis for a class from the FastAPI backend agent.
 */
export async function fetchLiveBlast(
  query: string,
  projectId: string = 'demo',
  signal?: AbortSignal
): Promise<BackendBlastResult | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/projects/${projectId}/blast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query }),
      signal,
    });

    if (res.ok) {
      return (await res.json()) as BackendBlastResult;
    }
  } catch {
    // Return null if backend endpoint is unavailable
  }
  return null;
}

/**
 * Requests impact analysis for a class.
 */
export async function fetchLiveImpact(
  targetNode: GraphNode,
  graphData: GraphData,
  signal?: AbortSignal
): Promise<ImpactAnalysis> {
  // Reconstruct real dependency paths from the graph, never synthetic direct edges.
  // The agent's blast response is an affected set, not a direct/indirect path tree.
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return computeImpactAnalysis(targetNode, graphData, false);
}
