export function petMood(health: number) {
  return health < 40 ? 'sick' : health < 75 ? 'okay' : 'healthy';
}

/** A small, resolution-independent pixel sprite; no external image or font required. */
export function PixelPet({ health, preview = false }: { health: number; preview?: boolean }) {
  const mood = petMood(health);
  return (
    <svg role="img" aria-label={`Code pet: ${mood}`} viewBox="0 0 24 24" shapeRendering="crispEdges" className={`pixel-pet pet-${mood} ${preview ? 'pet-preview' : ''}`}>
      <ellipse cx="12" cy="22" rx="8" ry="1" fill="var(--shadow-color)" />
      <g className="pet-body">
        <path d="M5 3H9V6H15V3H19V8H21V18H19V21H15V19H9V21H5V18H3V8H5Z" fill="var(--pet-outline)" />
        <path d="M6 5H8V8H16V5H18V9H20V17H18V19H16V17H8V19H6V17H4V9H6Z" fill="var(--pet-color)" />
        <path d="M6 9H18V11H6ZM5 11H7V15H5Z" fill="var(--pet-highlight)" />
        <g className="pet-eyes" fill="var(--pet-outline)">
          {mood === 'sick' ? <path d="M7 11H10V12H7ZM14 11H17V12H14Z" /> : <path d="M7 10H10V13H7ZM14 10H17V13H14Z" />}
        </g>
        {mood === 'sick' ? <path d="M10 16V15H14V16" stroke="var(--pet-outline)" fill="none" /> :
          mood === 'healthy' ? <path d="M9 14H11V15H13V14H15V16H13V17H11V16H9Z" fill="var(--pet-outline)" /> :
          <path d="M10 15H14V16H10Z" fill="var(--pet-outline)" />}
        {mood === 'sick' && <path d="M19 5H20V7H21V9H18V7H19Z" fill="#60a5fa" />}
        {mood === 'healthy' && <path d="M1 3H2V2H3V3H4V4H3V5H2V4H1ZM20 1H21V0H22V1H23V2H22V3H21V2H20Z" fill="var(--status-healthy)" />}
      </g>
    </svg>
  );
}

export function PetHealth({ health, projectedHealth }: { health: number; projectedHealth: number | null }) {
  const current = Math.round(Math.max(0, Math.min(100, health)));
  const preview = projectedHealth !== null;
  const displayed = preview ? Math.round(Math.max(0, Math.min(100, projectedHealth))) : current;
  const delta = displayed - current;
  return (
    <div className="pet-health" data-testid="pet-health" data-health={displayed} data-preview={preview}>
      <PixelPet health={displayed} preview={preview} />
      <div className="min-w-0 flex-1" aria-live="polite">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold capitalize">{petMood(displayed)}</span>
          <span className="font-mono text-xs">{preview ? `${current} → ${displayed}` : displayed}/100</span>
        </div>
        <div role="meter" aria-label={preview ? 'Projected code health' : 'Codebase health'} aria-valuenow={displayed} aria-valuemin={0} aria-valuemax={100} className="pet-meter">
          <div style={{ width: `${displayed}%` }} />
        </div>
        <p className="text-xs text-[var(--text-muted)]">{preview ? `Preview · ${delta > 0 ? '+' : ''}${delta} points${delta === 0 ? ' · no measured change yet' : ''}` : 'Codebase health · keeping an eye on your code'}</p>
      </div>
    </div>
  );
}
