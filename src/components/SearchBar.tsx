import React, { useState, useRef, useEffect } from 'react';
import { Search, X, CornerDownLeft } from 'lucide-react';
import { GraphNode } from '../types/index';

interface SearchBarProps {
  nodes: GraphNode[];
  selectedNode: GraphNode | null;
  onSelectNode: (node: GraphNode) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  nodes,
  selectedNode,
  onSelectNode,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Global keyboard shortcut '/' or 'Cmd+K' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k')) &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter matching nodes
  const filteredNodes = React.useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return nodes
      .filter((n) => n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q))
      .slice(0, 8);
  }, [nodes, query]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredNodes]);

  const handleSelect = (node: GraphNode) => {
    onSelectNode(node);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredNodes.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredNodes.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredNodes.length) % filteredNodes.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredNodes[selectedIndex];
      if (target) {
        handleSelect(target);
      }
    }
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search class (e.g. Auth, Session, Billing)..."
          className="h-8 w-full rounded-md border border-slate-700/80 bg-slate-900/90 pl-8.5 pr-14 font-mono text-xs text-slate-100 placeholder-slate-500 shadow-inner outline-none transition focus:border-cyan-400/80 focus:ring-1 focus:ring-cyan-400/50"
        />

        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-200"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-2.5 hidden select-none rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] text-slate-400 sm:inline-block">
            /
          </kbd>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && query.trim() && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-full z-50 mt-1.5 w-full rounded-lg border border-slate-700/90 bg-[#0b1120] p-1 shadow-2xl backdrop-blur-xl"
        >
          {filteredNodes.length > 0 ? (
            <div className="space-y-0.5">
              {filteredNodes.map((n, idx) => {
                const isSelected = idx === selectedIndex;
                const isCurrent = selectedNode?.id === n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => handleSelect(n)}
                    className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left transition ${
                      isSelected
                        ? 'bg-cyan-500/15 text-cyan-200'
                        : 'text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-xs font-medium">
                          {n.name}
                        </span>
                        {isCurrent && (
                          <span className="rounded bg-cyan-900/40 px-1 py-0.2 font-mono text-[9px] text-cyan-300">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="truncate font-mono text-[10px] text-slate-500">
                        {n.path}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
                        {n.clusterName}
                      </span>
                      {isSelected && (
                        <CornerDownLeft className="h-3 w-3 text-cyan-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-2 font-mono text-xs text-slate-400">
              No matching Java classes found for &quot;{query}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
};
