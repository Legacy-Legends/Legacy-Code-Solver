import { GraphData, ImpactAnalysis } from '../types/index';

// Same-origin Vite proxy works when the browser is on another machine too.
export const BACKEND_URL = (import.meta.env.VITE_API_URL || '/backend').replace(/\/$/, '');
export interface BackendBlastResult {
  matched_node_ids: string[];
  blast_node_ids: string[];
  blast_edge_ids: string[];
  percent: number;
  summary: string;
  affected_domains: string[];
}
export interface Proposal {
  id: string;
  target_node_ids: string[];
  rationale: string;
  diffs: { path: string; before: string; after: string }[];
  health_before: number;
  health_after: number;
  change_blast_node_ids: string[];
  status: 'pending' | 'applied' | 'rejected';
}
export interface AgentConfig {
  agent_mode: 'mock' | 'live';
  graph_source: string;
  can_apply_proposals: boolean;
}
export interface PetResponse { mood: 'sick' | 'okay' | 'thriving'; message: string }
export interface DomainTag { domain_tag: string; domain_inferred: true }

async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const timer = setTimeout(cancel, 55000);
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  try {
    const response = await fetch(`${BACKEND_URL}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) {
      const detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || data);
      throw new Error(`Backend ${response.status}: ${detail}`);
    }
    return data as T;
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) throw new Error('Backend request timed out. Please retry.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

export const fetchAgentConfig = (signal?: AbortSignal) => request<AgentConfig>('/api/config', undefined, signal);
export async function fetchLiveGraphData(projectId = 'demo', signal?: AbortSignal): Promise<GraphData> {
  const data = await request<GraphData>(`/api/projects/${encodeURIComponent(projectId)}/graph`, undefined, signal);
  if (!Array.isArray(data.nodes) || !Array.isArray(data.edges) || !Array.isArray(data.clusters) || typeof data.overallHealth !== 'number') {
    throw new Error('Backend returned an invalid graph contract.');
  }
  return data;
}
export const fetchLiveBlast = (query: string, projectId = 'demo', signal?: AbortSignal) =>
  request<BackendBlastResult>(`/api/projects/${encodeURIComponent(projectId)}/blast`, { query }, signal);
export const fetchLiveImpact = (nodeId: string, projectId = 'demo', signal?: AbortSignal) =>
  request<ImpactAnalysis>(`/api/projects/${encodeURIComponent(projectId)}/impact?class_id=${encodeURIComponent(nodeId)}`, undefined, signal);
export const createProposal = (ids: string[], signal?: AbortSignal) =>
  request<Proposal>('/api/projects/demo/proposals', { target_node_ids: ids }, signal);
export const rejectProposal = (id: string, signal?: AbortSignal) =>
  request<Proposal>(`/api/proposals/${encodeURIComponent(id)}/reject`, {}, signal);
export const fetchPet = (query: string, signal?: AbortSignal) =>
  request<PetResponse>('/api/projects/demo/pet', { query, recent_action: 'Reviewed dependency graph' }, signal);
export const fetchDomains = (signal?: AbortSignal) =>
  request<Record<string, DomainTag>>('/api/projects/demo/domains', {}, signal);

export function terminalUrl(): string {
  const url = new URL(`${BACKEND_URL}/ws/terminal`, window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}

export async function checkBackendHealth(
  signal?: AbortSignal
): Promise<{ ok: boolean; message?: string }> {
  try {
    const data = await request<unknown>('/api/config', undefined, signal);
    return { ok: Boolean(data) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
