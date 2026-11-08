import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Box, Target, FileDiff, X, RefreshCw } from 'lucide-react';
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
  hoveredProposalHealth: (delta: number | null) => void;
}

export function AgentPanel({ projectId, selectedNode, onBlast, onDomains, hoveredProposalHealth }: Props) {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [chatQuery, setChatQuery] = useState('');
  
  // Initialize with a welcome message mimicking Copilot
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; content: string | React.ReactNode }[]>([
    { role: 'assistant', content: 'Hi! I am your AI architecture assistant. Ask me to map dependencies, analyze blast radii, or propose safe refactors for legacy code.' }
  ]);
  
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const abort = new AbortController();
    fetchAgentConfig(abort.signal).then(setConfig).catch(() => {});
    return () => abort.abort();
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chat]);

  const appendAssistant = (content: React.ReactNode) => {
    setChat(prev => [...prev, { role: 'assistant', content }]);
  };

  const handleAction = async (action: 'blast' | 'propose') => {
    if (busy || !selectedNode) return;
    setBusy(true);
    try {
      if (action === 'blast') {
        appendAssistant(`Analyzing blast radius for ${selectedNode.name}...`);
        const res = await fetchLiveBlast(`What breaks if ${selectedNode.name} fails?`, projectId, new AbortController().signal);
        onBlast(res);
        appendAssistant(
          <div className="space-y-1">
            <div className="font-bold text-rose-600 dark:text-rose-400">Critical Path Identified</div>
            <div>Found {res.blast_node_ids.length} affected components. {res.summary}</div>
            {res.affected_domains.length > 0 && <div className="text-[11px] text-slate-500 mt-1">Domains: {res.affected_domains.join(', ')}</div>}
          </div>
        );
      } else if (action === 'propose') {
        appendAssistant(`Generating modernization diff for ${selectedNode.name}...`);
        const res = await createProposal([selectedNode.id], projectId, new AbortController().signal);
        setProposal(res);
        appendAssistant(`Proposal ready for ${selectedNode.name}.`);
      }
    } catch (e) {
      appendAssistant(<span className="text-red-500">Operation failed.</span>);
    } finally {
      setBusy(false);
    }
  };

  const sendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = chatQuery.trim();
    if (!query || busy) return;
    
    setChatQuery('');
    setChat(prev => [...prev, { role: 'user', content: query }]);
    setBusy(true);
    
    try {
      // Clean chat history of ReactNodes before sending to API
      const safeHistory = chat.map(c => ({ 
        role: c.role, 
        content: typeof c.content === 'string' ? c.content : '[System Action Executed]' 
      }));
      
      const result = await fetchChat(query, selectedNode?.id || null, safeHistory, projectId, new AbortController().signal);
      appendAssistant(result.message);
    } catch {
      appendAssistant(<span className="text-red-500">Failed to connect to agent.</span>);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col h-full bg-white dark:bg-[#090D16] border-t border-slate-200 dark:border-slate-800">
      
      {/* VS Code Copilot style Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide uppercase">Agent Chat</h2>
        </div>
        {selectedNode && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-200/50 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-400">
            <Target className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            {selectedNode.name}
          </div>
        )}
      </div>

      {/* Main Chat Thread Window */}
      <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
        {chat.map((msg, i) => (
          <div key={i} className={`flex gap-3 max-w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
              </div>
            )}
            
            <div className={`px-3.5 py-2.5 rounded-2xl ${
              msg.role === 'user' 
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tr-sm max-w-[85%]'
                : 'bg-transparent text-slate-800 dark:text-slate-200 w-full'
            }`}>
              {msg.content}
              
              {/* Inject Action Buttons directly into assistant flow if it's the latest welcome/context message */}
              {msg.role === 'assistant' && i === 0 && selectedNode && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <button 
                    onClick={() => handleAction('blast')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium cursor-pointer transition-colors"
                  >
                    <Box className="w-3.5 h-3.5" /> Track Blast Radius
                  </button>
                  <button 
                    onClick={() => handleAction('propose')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium cursor-pointer transition-colors"
                  >
                    <FileDiff className="w-3.5 h-3.5" /> Modernize Class
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex gap-3 items-center opacity-70">
            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
              <RefreshCw className="w-3 h-3 text-indigo-600 dark:text-indigo-400 animate-spin" />
            </div>
            <span className="text-xs text-slate-500">Agent is thinking...</span>
          </div>
        )}
      </div>

      {/* Proposal Diff Viewer (Sliding Panel logic inside chat) */}
      {proposal && (
        <div className="mx-4 mb-4 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300">Modernization Diff</span>
            <button onClick={() => setProposal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 mb-3">{proposal.rationale}</p>
          <div className="flex gap-2">
            <button 
              onMouseEnter={() => hoveredProposalHealth(proposal.health_after - proposal.health_before)}
              onMouseLeave={() => hoveredProposalHealth(null)}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-1.5 rounded-md cursor-pointer transition-colors"
            >
              Apply Refactor
            </button>
          </div>
        </div>
      )}

      {/* Bottom Input Area */}
      <div className="p-4 pt-0 shrink-0">
        <form onSubmit={sendChat} className="relative flex items-center">
          <input
            type="text"
            value={chatQuery}
            onChange={(e) => setChatQuery(e.target.value)}
            disabled={busy}
            placeholder={selectedNode ? `Ask about ${selectedNode.name}...` : "Ask a question..."}
            className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-lg pl-4 pr-10 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all disabled:opacity-50"
          />
          <button 
            type="submit" 
            disabled={!chatQuery.trim() || busy}
            className="absolute right-2 p-1.5 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </section>
  );
}