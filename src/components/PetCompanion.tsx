import React, { useMemo } from 'react';
import { GraphNode } from '../types';

interface PetCompanionProps {
  nodes: GraphNode[];
  overallHealth: number;
  isOpen: boolean;
  onToggle: () => void;
  hoverDelta: number | null;
}

export const PetCompanion: React.FC<PetCompanionProps> = ({ nodes, overallHealth, isOpen, onToggle, hoverDelta }) => {
  const target = useMemo(
    () => [...nodes].sort((a, b) => a.health - b.health || a.name.localeCompare(b.name))[0],
    [nodes]
  );
  
  // Calculate projected health
  const activeHealth = hoverDelta ? overallHealth + hoverDelta : overallHealth;

  const moodConfig = useMemo(() => {
    if (activeHealth < 40) return { label: 'Needs care', color: 'bg-amber-400', animation: 'animate-pixel-bounce', border: 'border-amber-500' };
    if (activeHealth < 75) return { label: 'Improving', color: 'bg-indigo-400', animation: 'animate-pixel-walk', border: 'border-indigo-500' };
    return { label: 'Thriving', color: 'bg-emerald-400', animation: 'animate-pixel-bounce', border: 'border-emerald-500' };
  }, [activeHealth]);

  if (!target) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Toggle Agent Workspace"
      aria-expanded={isOpen}
      aria-controls="agent-workspace"
      className="fixed bottom-6 right-6 z-30 group cursor-pointer"
    >
      <div className="flex items-center gap-3 transition-transform duration-300 ease-in-out hover:scale-105">
        
        {!isOpen && (
          <div className={`rounded-xl border backdrop-blur-xl px-3 py-1.5 text-xs shadow-lg animate-in fade-in duration-300 ${
            hoverDelta 
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-950 dark:text-emerald-100'
              : 'bg-white/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
          }`}>
            <div className="font-bold">{hoverDelta ? '🎉 Refactor will help!' : moodConfig.label}</div>
          </div>
        )}
        
        {/* Pixel Art Container */}
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 backdrop-blur-md shadow-xl transition-all ${
          isOpen 
            ? 'bg-slate-900/90 dark:bg-black/90 border-indigo-500' 
            : `bg-white/80 dark:bg-slate-800/80 ${moodConfig.border}`
        }`}>
          {/* CSS Pixel Sprite */}
          <div className={`relative w-6 h-6 ${moodConfig.animation}`}>
             {/* Head */}
             <div className={`absolute top-0 left-1 w-4 h-3 ${moodConfig.color} rounded-t-sm`}></div>
             {/* Eyes */}
             <div className="absolute top-1 left-2 w-0.5 h-0.5 bg-slate-900"></div>
             <div className="absolute top-1 left-3.5 w-0.5 h-0.5 bg-slate-900"></div>
             {/* Body */}
             <div className={`absolute top-3 left-0 w-6 h-3 ${moodConfig.color} rounded-sm`}></div>
             {/* Legs */}
             <div className={`absolute top-6 left-1 w-1 h-1 ${moodConfig.color}`}></div>
             <div className={`absolute top-6 left-4 w-1 h-1 ${moodConfig.color}`}></div>
             
             {/* Happy effects when thriving or hovered */}
             {(activeHealth >= 75 || hoverDelta) && (
               <>
                 <div className="absolute -top-2 -left-1 w-1 h-1 bg-yellow-400 rounded-full animate-ping"></div>
                 <div className="absolute -top-1 -right-1 w-1 h-1 bg-yellow-400 rounded-full animate-ping delay-75"></div>
               </>
             )}
          </div>
        </div>
      </div>
    </button>
  );
};