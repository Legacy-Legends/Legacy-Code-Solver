import { useEffect, useRef, useState } from 'react';
import { Sparkles, ArrowUp, Target, FileDiff, X, Plus, RefreshCw, ChevronDown } from 'lucide-react';
import {
  BackendBlastResult, Proposal, AgentConfig, createProposal, fetchChat, fetchLiveBlast,
  fetchAgentConfig, fetchProposal, applyProposal, rejectProposal,
} from '../api/backendAdapter';
import { GraphNode } from '../types';
import { PetHealth } from './PixelPet';

interface Props {
  onClose: () => void;
  projectId: string;
  selectedNode: GraphNode | null;
  overallHealth: number;
  onBlast: (result: BackendBlastResult) => void;
  onGraphUpdated: () => void;
}
type Message = { role: 'user' | 'assistant'; content: string };
const welcome: Message = { role: 'assistant', content: 'Let’s make this code easier to live with. Ask about the architecture, trace a dependency, or select a class to review a refactor.' };

export function AgentPanel({ onClose, projectId, selectedNode, overallHealth, onBlast, onGraphUpdated }: Props) {
  const [query, setQuery] = useState('');
  const [chat, setChat] = useState<Message[]>([welcome]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchAgentConfig(controller.signal).then(setConfig).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Agent configuration unavailable.');
    });
    return () => { controller.abort(); requestRef.current?.abort(); };
  }, [projectId]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [chat, busy, proposal]);

  const append = (content: string) => setChat(previous => [...previous, { role: 'assistant', content }]);
  const run = async (action: (signal: AbortSignal) => Promise<void>) => {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true); setError(null);
    try { await action(controller.signal); }
    catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Agent request failed. Please retry.'); }
    finally {
      if (!controller.signal.aborted) setBusy(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  };
  const propose = () => selectedNode && run(async signal => {
    const result = await createProposal([selectedNode.id], projectId, signal);
    if (signal.aborted) return;
    setProposal(result); setPreview(false);
    append(`A change is ready for review: ${selectedNode.name}. Expand the file to inspect the diff. Hover or focus Approve change to preview its health score.`);
  });
  const blast = () => selectedNode && run(async signal => {
    const result = await fetchLiveBlast(`What breaks if ${selectedNode.name} fails?`, projectId, signal);
    if (signal.aborted) return;
    onBlast(result);
    append(`Critical Path Identified\n${result.summary}\n${result.blast_node_ids.length} affected components · ${result.percent.toFixed(1)}% of the graph${result.affected_domains.length ? `\nDomains: ${result.affected_domains.join(', ')}` : ''}`);
  });
  const send = () => {
    if (!query.trim() || busy) return;
    const text = query.trim();
    // The server accepts eight turns; keep long conversations within that contract.
    const history = chat.slice(-8).map(turn => ({ ...turn, content: turn.content.slice(0, 2000) }));
    setChat(previous => [...previous, { role: 'user', content: text }]); setQuery('');
    void run(async signal => {
      const result = await fetchChat(text, selectedNode?.id || null, history, projectId, signal);
      if (signal.aborted) return;
      append(result.message);
      if (result.proposal_id) {
        const draft = await fetchProposal(result.proposal_id, signal);
        if (!signal.aborted) { setProposal(draft); setPreview(false); }
      }
    });
  };
  const approve = () => proposal && run(async signal => {
    if (projectId === 'demo') throw new Error('This mock graph has no editable Java source. A source-backed project is required to apply a refactor.');
    const applied = await applyProposal(proposal.id, signal);
    if (!signal.aborted) { setProposal(applied); setPreview(false); onGraphUpdated(); append('Change applied. Refreshing measured codebase health.'); }
  });
  const reject = () => proposal && run(async signal => {
    const rejected = await rejectProposal(proposal.id, signal);
    if (!signal.aborted) { setProposal(rejected); setPreview(false); }
  });

  const projectedHealth = preview && proposal?.status === 'pending' ? proposal.health_after : null;
  return (
    <section aria-label="Pet and AI agent" className="agent-panel">
      <header className="agent-header">
        <div className="flex items-center gap-2"><Sparkles size={15} className="text-[var(--accent)]" /><h2>CHAT</h2></div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="New chat" disabled={busy} onClick={() => { setChat([welcome]); setProposal(null); setPreview(false); setError(null); }}><Plus size={16} /></button>
          <button type="button" onClick={onClose} aria-label="Close agent"><X size={16} /></button>
        </div>
      </header>
      <div className="agent-context"><Target size={13} /><span className="truncate">{selectedNode ? selectedNode.path || selectedNode.name : 'Workspace · dependency graph'}</span></div>
      <div ref={scrollRef} className="agent-thread" role="log" aria-label="Conversation" aria-live="polite">
        {chat.map((message, index) => <article key={index} className={`agent-message agent-message-${message.role}`}>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold">{message.role === 'assistant' && <Sparkles size={13} className="text-[var(--accent)]" />}{message.role === 'assistant' ? 'Code companion' : 'You'}</div>
          <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        </article>)}
        {selectedNode && <div className="agent-actions">
          <button disabled={busy} onClick={blast}><Target size={13} />Track Blast Radius</button>
          <button disabled={busy} onClick={propose}><FileDiff size={13} />Modernize Class</button>
        </div>}
        {busy && <p role="status" className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><RefreshCw size={13} className="animate-spin" />Working on it…</p>}
        {error && <p role="alert" className="agent-error">{error}</p>}
        {proposal && <div className="proposal-card">
          <div className="mb-2 flex justify-between gap-2 text-xs font-semibold"><span>Suggested changes</span><span className="capitalize">{proposal.status}</span></div>
          <p className="mb-3 text-xs leading-relaxed">{proposal.rationale}</p>
          {proposal.diffs.map(diff => <details key={diff.path} className="proposal-file">
            <summary><FileDiff size={13} /><span className="break-all">{diff.path}</span></summary>
            <div className="diff-before"><span>Before</span><pre>{diff.before}</pre></div>
            <div className="diff-after"><span>After</span><pre>{diff.after}</pre></div>
          </details>)}
          <p className="my-3 text-xs text-[var(--text-muted)]">Health preview: {proposal.health_before} → {proposal.health_after}/100. {proposal.health_before === proposal.health_after ? 'No measured improvement yet.' : 'Estimate until the change is validated.'}</p>
          {proposal.status === 'pending' && <div className="flex flex-wrap gap-2">
            <button className="agent-primary" disabled={busy} onMouseEnter={() => setPreview(true)} onMouseLeave={() => setPreview(false)} onFocus={() => setPreview(true)} onBlur={() => setPreview(false)} onPointerDown={() => setPreview(true)} onClick={approve}>Approve change</button>
            <button className="agent-secondary" disabled={busy} onClick={reject}>Reject</button>
          </div>}
        </div>}
      </div>
      <footer className="agent-composer">
        <PetHealth health={preview && proposal ? proposal.health_before : overallHealth} projectedHealth={projectedHealth} />
        <form onSubmit={event => { event.preventDefault(); send(); }} className="agent-input-box">
          <textarea aria-label="Message the pet" rows={2} maxLength={2000} value={query} disabled={busy} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); }
          }} placeholder={selectedNode ? `Ask about ${selectedNode.name}…` : 'Ask about your code…'} />
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <span className="flex min-w-0 items-center gap-1 text-[11px] text-[var(--text-muted)]"><Sparkles size={12} />Agent<ChevronDown size={12} /><span className="ml-2 truncate">{config?.agent_mode === 'live' ? `${config.provider === 'groq' ? 'Groq' : 'OpenAI'} · ${config.model}` : ''}</span></span>
            <button type="submit" aria-label="Send message" disabled={busy || !query.trim()} className="agent-send"><ArrowUp size={16} /></button>
          </div>
        </form>
        <p className="mt-2 text-center text-[10px] text-[var(--text-muted)]">Enter to send · Shift+Enter for a new line</p>
      </footer>
    </section>
  );
}
