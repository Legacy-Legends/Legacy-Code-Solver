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

  // Keyboard shortcut '/' or 'Cmd+K'
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
    <div className="relative w-full">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
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
          aria-label="Search class by name"
          placeholder="Search class (e.g. AuthTokenValidator, SessionManager)..."
          className="h-9 w-full rounded-xl border border-[#DCD9D0] dark:border-slate-700 bg-[#FAF9F5] dark:bg-slate-800/80 pl-10 pr-12 font-sans text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition focus:border-indigo-600 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/15"
        />

        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-3 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-3 hidden select-none rounded border border-[#DCD9D0] dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 dark:text-slate-500 sm:inline-block">
            /
          </kbd>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && query.trim() && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-full z-50 mt-2 w-full rounded-2xl border border-[#DCD9D0] dark:border-slate-700 bg-white dark:bg-slate-800 p-2 shadow-xl"
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
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-200 font-medium'
                        : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {n.name}
                        </span>
                        {isCurrent && (
                          <span className="rounded bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 font-sans text-[10px] font-medium text-indigo-800 dark:text-indigo-300">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="truncate font-mono text-[10.5px] text-slate-500 dark:text-slate-400">
                        {n.path}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 font-sans text-[10px] text-slate-600 dark:text-slate-400">
                        {n.clusterName}
                      </span>
                      {isSelected && (
                        <CornerDownLeft className="h-3.5 w-3.5 text-indigo-700" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-3 font-sans text-xs text-slate-500 text-center">
              No Java classes found matching &quot;{query}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
};
