import React, { useMemo } from 'react';
import { GraphNode } from '../types';

interface PetCompanionProps {
  nodes: GraphNode[];
  overallHealth: number;
}

function moodForHealth(health: number): { label: string; emoji: string; className: string } {
  if (health < 40) {
    return {
      label: 'Needs care',
      emoji: '😟',
      className:
        'border-amber-400/60 dark:border-amber-500/40 bg-amber-50/75 dark:bg-amber-950/65 text-amber-950 dark:text-amber-200 shadow-[0_8px_30px_rgba(245,158,11,0.18)]',
    };
  }
  if (health < 75) {
    return {
      label: 'Improving',
      emoji: '🐾',
      className:
        'border-indigo-300/60 dark:border-indigo-500/40 bg-indigo-50/75 dark:bg-indigo-950/65 text-indigo-950 dark:text-indigo-200 shadow-[0_8px_30px_rgba(99,102,241,0.18)]',
    };
  }
  return {
    label: 'Thriving',
    emoji: '😺',
    className:
      'border-emerald-300/60 dark:border-emerald-500/40 bg-emerald-50/75 dark:bg-emerald-950/65 text-emerald-950 dark:text-emerald-200 shadow-[0_8px_30px_rgba(16,185,129,0.18)]',
  };
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
        className="absolute flex items-center gap-2.5 transition-all duration-700 ease-in-out"
        style={{ left: `${left}%`, transform: 'translateX(-50%)' }}
      >
        <div
          className={`rounded-2xl border backdrop-blur-xl backdrop-saturate-150 px-3.5 py-2 text-xs ring-1 ring-white/40 dark:ring-white/10 ${mood.className}`}
        >
          <div className="font-bold tracking-tight">
            {mood.emoji} {mood.label}
          </div>
          <div className="max-w-48 truncate opacity-90">
            Watching {target.name} · {target.health}/100
          </div>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/60 dark:border-white/15 bg-white/65 dark:bg-slate-900/65 backdrop-blur-md text-xl shadow-md"
          aria-hidden="true"
        >
          🐾
        </div>
      </div>
    </div>
  );
};