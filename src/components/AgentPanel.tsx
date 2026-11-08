import { useEffect, useRef, useState } from 'react';
import {
  AgentConfig, ChatResponse, Proposal,
  applyProposal, fetchAgentConfig, fetchChat, fetchProposal, rejectProposal, terminalUrl,
} from '../api/backendAdapter';
import { GraphNode } from '../types';

interface Props {
  projectId: string;
  selectedNode: GraphNode | null;
  onGraphChanged: () => void;
}

/** Mounted only for a loaded server graph; cancellation prevents stale UI updates. */
export function AgentPanel({ projectId, selectedNode, onGraphChanged }: Props) {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [chatQuery, setChatQuery] = useState('');
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [activity, setActivity] = useState<string[]>([]);
  const controller = useRef<AbortController>();
  const running = useRef(false);

  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    fetchAgentConfig(abort.signal).then(setConfig).catch(e => {
      if (!abort.signal.aborted) setError(String(e.message));
    });
    const socket = new WebSocket(terminalUrl());
    socket.onmessage = event => setActivity(items => [...items.slice(-7), String(event.data)]);
    socket.onerror = () => setActivity(items => [...items.slice(-7), 'Terminal connection unavailable. HTTP actions are still available.']);
    return () => { abort.abort(); socket.onmessage = null; socket.onerror = null; socket.close(); };
  }, []);

  async function run(label: string, operation: (signal: AbortSignal) => Promise<void>) {
    if (running.current || !controller.current) return;
    running.current = true;
    setBusy(label);
    setError(null);
    const signal = controller.current.signal;
    try {
      await operation(signal);
      if (!signal.aborted) setActivity(items => [...items.slice(-7), `${label} completed.`]);
    } catch (e) {
      if (!signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      running.current = false;
      if (!signal.aborted) setBusy('');
    }
  }
  const button = 'rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40';
  const input = 'min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm';
  const sendChat = () => {
    const queryText = chatQuery.trim();
    if (!queryText) return;
    setChatQuery('');
    setChat(items => [...items, { role: 'user', content: queryText }]);
    void run('Agent response', async signal => {
      const result: ChatResponse = await fetchChat(queryText, selectedNode?.id || null, chat, projectId, signal);
      if (!signal.aborted) {
        setChat(items => [...items, { role: 'assistant', content: result.message }]);
        if (result.proposal_id) {
          const created = await fetchProposal(result.proposal_id, signal);
          if (!signal.aborted) setProposal(created);
        }
      }
    });
  };
  return (
    <section aria-label="Backend agent workspace" className="rounded-2xl border border-emerald-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Agent workspace</h2>
        <span className="text-xs rounded-full bg-emerald-50 px-3 py-1 text-emerald-900">
          {config ? `${config.agent_mode === 'live' ? `Live ${config.provider} · ${config.model}` : 'Offline agent'} · ${projectId === 'demo' ? 'demo graph' : 'uploaded project'}` : 'Connecting to pet agent…'}
        </span>
      </div>
      <section aria-label="Agent chat" className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
        <p className="font-bold">🐾 Pet agent chat</p>
        <div className="max-h-40 space-y-2 overflow-y-auto text-sm">
          {chat.length === 0 && <p className="text-slate-600">Ask about this codebase, a class, or what to modernize next.</p>}
          {chat.map((item, index) => (
            <p key={`${item.role}-${index}`} className={item.role === 'user' ? 'text-slate-600' : 'font-medium text-slate-900'}>
              <span className="mr-1 font-semibold">{item.role === 'user' ? 'You:' : 'Agent:'}</span>{item.content}
            </p>
          ))}
        </div>
        <div className="flex gap-2">
          <input aria-label="Agent chat message" className={input} value={chatQuery} maxLength={2000}
            onChange={e => setChatQuery(e.target.value)} placeholder="What should I modernize first?" />
          <button type="button" className={button} disabled={!!busy || !config || !chatQuery.trim()} onClick={sendChat}>Send</button>
        </div>
      </section>
      {proposal && <article aria-label="Proposal preview" className="rounded-lg border border-slate-200 p-4 space-y-3">
        <p className="font-semibold">Pet agent proposal · {proposal.status}</p>
        <p className="text-xs">Proposal targets: {proposal.target_node_ids.join(', ')}</p>
        <p className="text-sm">{proposal.rationale}</p>
        <p className="text-xs">Health: {proposal.health_before} → {proposal.health_after}.</p>
        {proposal.diffs.map(diff => <div key={diff.path}>
          <h3 className="font-mono text-sm mb-2">{diff.path}</h3>
          <div className="grid md:grid-cols-2 gap-2">
            <div><p className="text-xs font-bold">Before</p><pre className="overflow-auto max-h-64 bg-red-50 p-3 text-xs whitespace-pre-wrap">{diff.before}</pre></div>
            <div><p className="text-xs font-bold">After</p><pre className="overflow-auto max-h-64 bg-emerald-50 p-3 text-xs whitespace-pre-wrap">{diff.after}</pre></div>
          </div>
        </div>)}
        <div className="flex gap-2">
          <button className={button} disabled={!!busy || proposal.status !== 'pending' || projectId === 'demo'} onClick={() => void run('Apply modernization', async signal => {
            const result = await applyProposal(proposal.id, signal);
            if (!signal.aborted) {
              setProposal(result);
              onGraphChanged();
            }
          })}>Apply change</button>
          <button className={button} disabled={!!busy || proposal.status !== 'pending'} onClick={() => void run('Proposal rejection', async signal => {
            const result = await rejectProposal(proposal.id, signal);
            if (!signal.aborted) setProposal(result);
          })}>Reject proposal</button>
        </div>
      </article>}
      {busy && <p role="status" className="text-sm">{busy}…</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <details><summary className="text-xs cursor-pointer">Connection and action log</summary><pre className="text-xs whitespace-pre-wrap mt-2">{activity.join('\n')}</pre></details>
    </section>
  );
}
