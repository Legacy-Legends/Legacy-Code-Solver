import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Check, Search, FileCode } from 'lucide-react';

export interface DropdownItem<T extends string = string> {
  id: T;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  badge?: string;
  disabled?: boolean;
}

interface AccessibleDropdownProps<T extends string = string> {
  label?: string;
  items: DropdownItem<T>[];
  selectedId: T;
  onSelect: (id: T) => void;
  className?: string;
  triggerClassName?: string;
  align?: 'left' | 'right';
  icon?: React.ReactNode;
  showSearch?: boolean;
  placeholder?: string;
}

export function AccessibleDropdown<T extends string = string>({
  label,
  items,
  selectedId,
  onSelect,
  className = '',
  triggerClassName = '',
  align = 'left',
  icon,
  showSearch = true,
  placeholder = 'Select a class...',
}: AccessibleDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedItem = items.find((item) => item.id === selectedId) || items[0];

  // Filter items based on query
  const filteredItems = useMemo(() => {
    if (!filterQuery.trim()) return items;
    const q = filterQuery.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.sublabel && item.sublabel.toLowerCase().includes(q)) ||
        (item.badge && item.badge.toLowerCase().includes(q))
    );
  }, [items, filterQuery]);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        listboxRef.current &&
        !listboxRef.current.contains(e.target as Node) &&
        (!searchInputRef.current || !searchInputRef.current.contains(e.target as Node))
      ) {
        setIsOpen(false);
        setFilterQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && showSearch && items.length > 5) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, showSearch, items.length]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsOpen(true);
          const currentIdx = items.findIndex((i) => i.id === selectedId);
          setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev + 1) % filteredItems.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
          break;
        case 'Home':
          e.preventDefault();
          setHighlightedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setHighlightedIndex(filteredItems.length - 1);
          break;
        case 'Enter':
          e.preventDefault();
          if (
            highlightedIndex >= 0 &&
            filteredItems[highlightedIndex] &&
            !filteredItems[highlightedIndex].disabled
          ) {
            onSelect(filteredItems[highlightedIndex].id);
            setIsOpen(false);
            setFilterQuery('');
            triggerRef.current?.focus();
          }
          break;
        case 'Escape':
        case 'Tab':
          setIsOpen(false);
          setFilterQuery('');
          triggerRef.current?.focus();
          break;
      }
    },
    [isOpen, highlightedIndex, filteredItems, onSelect, selectedId, items]
  );

  // Auto-scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listboxRef.current) {
      const activeElement = listboxRef.current.children[highlightedIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  return (
    <div className={`relative inline-block ${className}`} onKeyDown={handleKeyDown}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          {label}
        </label>
      )}

      {/* Dropdown Trigger */}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls="accessible-dropdown-listbox"
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next) {
            const currentIdx = filteredItems.findIndex((i) => i.id === selectedId);
            setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
          } else {
            setFilterQuery('');
          }
        }}
        className={`group flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-xs font-medium text-slate-800 dark:text-slate-200 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800/90 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 ${triggerClassName}`}
      >
        <span className="flex items-center gap-2 truncate min-w-0">
          <span className="text-indigo-600 dark:text-indigo-400 shrink-0">
            {icon || selectedItem?.icon || <FileCode className="w-4 h-4" />}
          </span>
          <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono text-xs truncate">
            {selectedItem?.label || placeholder}
          </span>
          {selectedItem?.badge && (
            <span className="text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/70 px-2 py-0.5 rounded-md shrink-0">
              {selectedItem.badge}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 group-hover:text-slate-600 dark:group-hover:text-slate-300 ${
            isOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Listbox Panel */}
      {isOpen && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-2 w-72 sm:w-80 bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-700/90 p-2 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Optional Search Input for quick filtering */}
          {showSearch && items.length > 4 && (
            <div className="relative mb-2 px-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={filterQuery}
                onChange={(e) => {
                  setFilterQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder="Filter classes..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          )}

          {/* Listbox */}
          <ul
            id="accessible-dropdown-listbox"
            ref={listboxRef}
            role="listbox"
            tabIndex={-1}
            className="max-h-64 overflow-y-auto space-y-0.5 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700"
          >
            {filteredItems.length > 0 ? (
              filteredItems.map((item, index) => {
                const isSelected = item.id === selectedId;
                const isHighlighted = index === highlightedIndex;

                return (
                  <li
                    key={item.id}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={item.disabled}
                    onClick={() => {
                      if (!item.disabled) {
                        onSelect(item.id);
                        setIsOpen(false);
                        setFilterQuery('');
                        triggerRef.current?.focus();
                      }
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                      item.disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : isSelected
                        ? 'bg-indigo-50/90 dark:bg-indigo-950/80 text-indigo-950 dark:text-indigo-200 font-medium border border-indigo-200/60 dark:border-indigo-800/60'
                        : isHighlighted
                        ? 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate min-w-0 pr-2">
                      <div className="shrink-0 text-slate-400 dark:text-slate-500">
                        {item.icon || <FileCode className="w-3.5 h-3.5" />}
                      </div>
                      <div className="truncate min-w-0">
                        <div className="font-semibold font-mono text-xs text-slate-900 dark:text-slate-100 truncate">
                          {item.label}
                        </div>
                        {item.sublabel && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[180px]">
                            {item.sublabel}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {item.badge && (
                        <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 px-1.5 py-0.5 rounded-md">
                          {item.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      )}
                    </div>
                  </li>
                );
              })
            ) : (
              <div className="px-3 py-3 text-center text-xs text-slate-400 font-mono">
                No classes match &quot;{filterQuery}&quot;
              </div>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
