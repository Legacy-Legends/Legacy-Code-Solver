import { useEffect, useRef, useState } from 'react';
import {
  AgentConfig, BackendBlastResult, ChatResponse, DomainTag, PetResponse, Proposal,
  createProposal, fetchAgentConfig, fetchChat, fetchDomains, fetchLiveBlast, fetchPet, rejectProposal, terminalUrl,
} from '../api/backendAdapter';
import { GraphNode } from '../types';

interface Props {
  projectId: string;
  selectedNode: GraphNode | null;
  onBlast: (result: BackendBlastResult) => void;
  onDomains: (tags: Record<string, DomainTag>) => void;
}

/** Mounted only for a loaded server graph; cancellation prevents stale UI updates. */
export function AgentPanel({ projectId, selectedNode, onBlast, onDomains }: Props) {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [query, setQuery] = useState('What breaks if BillingOrchestrator goes down?');
  const [blast, setBlast] = useState<BackendBlastResult | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [pet, setPet] = useState<PetResponse | null>(null);
  const [petQuery, setPetQuery] = useState('How are we doing?');
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
        if (result.intent === 'propose' && result.target_node_ids.length > 0) {
          setActivity(items => [...items.slice(-7), 'Agent identified a modernization proposal target.']);
        }
      }
    });
  };
  return (
    <section aria-label="Backend agent workspace" className="rounded-2xl border border-emerald-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Agent workspace</h2>
        <span className="text-xs rounded-full bg-emerald-50 px-3 py-1 text-emerald-900">
          {config ? `${config.agent_mode === 'mock' ? 'Mock agent · no LLM calls' : `Live ${config.provider} · ${config.model}`} · ${projectId === 'demo' ? 'demo graph' : 'uploaded project'}` : 'Checking agent mode…'}
        </span>
      </div>
      <form className="flex flex-wrap gap-2" onSubmit={e => {
        e.preventDefault(); setBlast(null);
        void run('Blast analysis', async signal => {
          const result = await fetchLiveBlast(query, projectId, signal);
          if (signal.aborted) return;
          setBlast(result); onBlast(result);
        });
      }}>
        <input aria-label="Impact question" className={input} value={query} maxLength={2000} onChange={e => setQuery(e.target.value)} required />
        <button className={button} disabled={!!busy || !config || !query.trim()}>Ask impact</button>
      </form>
      <section aria-label="Agent chat" className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
        <p className="font-bold">Agent chat</p>
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
      {blast && <div role="status" className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
        <p className="font-bold">{blast.blast_node_ids.length} affected components · {blast.percent}% (including targets)</p>
        <p>{blast.summary}</p>
        {blast.affected_domains.length > 0 && <p>Inferred domains: {blast.affected_domains.join(', ')}</p>}
      </div>}
      <div className="flex flex-wrap items-center gap-2">
        <button className={button} disabled={!!busy || !config || !selectedNode} onClick={() => {
          if (!selectedNode) return;
          setProposal(null);
          void run('Proposal preview', async signal => {
            const result = await createProposal([selectedNode.id], projectId, signal);
            if (!signal.aborted) setProposal(result);
          });
        }}>Preview refactor</button>
        <span className="text-xs text-slate-600">Target: {selectedNode?.name || 'Select a class'}</span>
        <button className={button} disabled={!!busy || !config} onClick={() => void run('Domain inference', async signal => {
          const tags = await fetchDomains(projectId, signal);
          if (!signal.aborted) onDomains(tags);
        })}>Infer domains</button>
      </div>
      {proposal && <article aria-label="Proposal preview" className="rounded-lg border border-slate-200 p-4 space-y-3">
        <p className="font-semibold">Proposal · {proposal.status}</p>
        <p className="text-xs">Proposal targets: {proposal.target_node_ids.join(', ')}</p>
        <p className="text-sm">{proposal.rationale}</p>
        <p className="text-xs">Health: {proposal.health_before} → {proposal.health_after}. No patch has been applied.</p>
        {proposal.diffs.map(diff => <div key={diff.path}>
          <h3 className="font-mono text-sm mb-2">{diff.path}</h3>
          <div className="grid md:grid-cols-2 gap-2">
            <div><p className="text-xs font-bold">Before</p><pre className="overflow-auto max-h-64 bg-red-50 p-3 text-xs whitespace-pre-wrap">{diff.before}</pre></div>
            <div><p className="text-xs font-bold">After</p><pre className="overflow-auto max-h-64 bg-emerald-50 p-3 text-xs whitespace-pre-wrap">{diff.after}</pre></div>
          </div>
        </div>)}
        <div className="flex gap-2">
          <button className={button} disabled title="Patch validation and application are not implemented yet">Apply unavailable</button>
          <button className={button} disabled={!!busy || proposal.status !== 'pending'} onClick={() => void run('Proposal rejection', async signal => {
            const result = await rejectProposal(proposal.id, signal);
            if (!signal.aborted) setProposal(result);
          })}>Reject proposal</button>
        </div>
      </article>}
      <form className="rounded-lg bg-emerald-50 p-3 space-y-2" onSubmit={e => {
        e.preventDefault();
        void run('Pet chat', async signal => {
          const result = await fetchPet(petQuery, projectId, signal);
          if (!signal.aborted) setPet(result);
        });
      }}>
        <p className="font-bold">🐾 Code-health pet {pet && `· ${pet.mood}`}</p>
        {pet && <p role="status" className="text-sm">{pet.message}</p>}
        <div className="flex gap-2">
          <input aria-label="Message to pet" className={input} value={petQuery} maxLength={2000} onChange={e => setPetQuery(e.target.value)} required />
          <button className={button} disabled={!!busy || !config || !petQuery.trim()}>Chat with pet</button>
        </div>
      </form>
      {busy && <p role="status" className="text-sm">{busy}…</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <details><summary className="text-xs cursor-pointer">Connection and action log</summary><pre className="text-xs whitespace-pre-wrap mt-2">{activity.join('\n')}</pre></details>
    </section>
  );
}
