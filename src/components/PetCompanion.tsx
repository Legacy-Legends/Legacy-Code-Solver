import { GraphNode } from '../types';
import { PixelPet, petMood } from './PixelPet';

interface PetCompanionProps {
  nodes: GraphNode[];
  overallHealth: number;
  isOpen: boolean;
  onToggle: () => void;
}

export function PetCompanion({ nodes, overallHealth, isOpen, onToggle }: PetCompanionProps) {
  if (!nodes.length) return null;
  return (
    <button type="button" onClick={onToggle} aria-label="Toggle Agent Workspace" aria-expanded={isOpen} aria-controls="agent-workspace" className={`pet-launcher fixed bottom-6 z-30 flex items-center gap-3 ${isOpen ? 'pet-launcher-open' : ''}`}>
      {!isOpen && <span className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-left text-xs shadow-lg"><span className="block font-semibold capitalize">{petMood(overallHealth)}</span>{Math.round(overallHealth)}/100 health</span>}
      <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--accent)] bg-[var(--bg-surface)] shadow-lg"><PixelPet health={overallHealth} /></span>
    </button>
  );
}
