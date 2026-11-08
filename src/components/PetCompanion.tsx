import React, { useMemo } from 'react';
import { GraphNode } from '../types';

interface PetCompanionProps {
  nodes: GraphNode[];
  overallHealth: number;
}

function moodForHealth(health: number): { label: string; emoji: string; className: string } {
  if (health < 40) {
    return { label: 'Needs care', emoji: '😟', className: 'border-amber-300 bg-amber-50 text-amber-950' };
  }
  if (health < 75) {
    return { label: 'Improving', emoji: '🐾', className: 'border-indigo-200 bg-indigo-50 text-indigo-950' };
  }
  return { label: 'Thriving', emoji: '😺', className: 'border-emerald-200 bg-emerald-50 text-emerald-950' };
}

export const PetCompanion: React.FC<PetCompanionProps> = ({ nodes, overallHealth }) => {
  const target = useMemo(
    () => [...nodes].sort((a, b) => a.health - b.health || a.name.localeCompare(b.name))[0],
    [nodes]
  );
  const mood = moodForHealth(overallHealth);
  const targetIndex = target ? nodes.findIndex((node) => node.id === target.id) : 0;
  const left = nodes.length > 1 ? 12 + (targetIndex / (nodes.length - 1)) * 72 : 50;

  if (!target) return null;

  return (
    <div
      className="pointer-events-none absolute bottom-5 left-0 right-0 z-10 h-16"
      aria-label={`Code health pet visiting ${target.name}`}
    >
      <div
        className="absolute flex items-center gap-2 transition-all duration-700 ease-in-out"
        style={{ left: `${left}%`, transform: 'translateX(-50%)' }}
      >
        <div className={`rounded-xl border px-2.5 py-1.5 text-xs shadow-sm ${mood.className}`}>
          <div className="font-semibold">{mood.emoji} {mood.label}</div>
          <div className="max-w-48 truncate">Watching {target.name} · {target.health}/100</div>
        </div>
        <div className="text-2xl drop-shadow-sm" aria-hidden="true">🐾</div>
      </div>
    </div>
  );
};
