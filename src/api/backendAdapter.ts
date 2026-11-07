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

/**
 * Checks connection to FastAPI backend.
 */
export async function checkBackendHealth(): Promise<{ ok: boolean; message?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timer);

    if (res && res.ok) {
      return { ok: true };
    }

    // Try /api/graph as alternative health check
    const resGraph = await fetch(`${BACKEND_URL}/api/graph`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    }).catch(() => null);

    if (resGraph && resGraph.ok) {
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
 * Never silently substitutes mock data upon failure.
 */
export async function fetchLiveGraphData(): Promise<GraphData> {
  const res = await fetch(`${BACKEND_URL}/api/graph`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(
      `FastAPI returned HTTP ${res.status} (${res.statusText}) on GET /api/graph`
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
 * Requests impact analysis for a class from the FastAPI backend.
 * If backend impact endpoint is not implemented, computes impact deterministically
 * using the shared graph contract while clearly noting client-side execution.
 */
export async function fetchLiveImpact(
  targetNode: GraphNode,
  graphData: GraphData,
  signal?: AbortSignal
): Promise<ImpactAnalysis> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/impact?classId=${encodeURIComponent(targetNode.id)}`,
      {
        headers: { Accept: 'application/json' },
        signal,
      }
    );

    if (res.ok) {
      const data = (await res.json()) as ImpactAnalysis;
      if (data && Array.isArray(data.directDependents)) {
        return data;
      }
    }
  } catch {
    // If specific /api/impact endpoint is not present, fall back to graph analysis
  }

  // Deterministic fallback based on live graph structure
  return computeImpactAnalysis(targetNode, graphData, false);
}
