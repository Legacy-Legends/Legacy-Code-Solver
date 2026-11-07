/**
 * VISUAL RULES ENFORCEMENT:
 * - Red (#ef4444 / #ff2a4b) is strictly reserved for BLAST RADIUS only.
 * - Node health is represented by glow/aura and saturation:
 *   - Healthy (>70): bright saturated teal-green (#00f5d4 / #10b981)
 *   - Moderate (40-70): balanced cyan-teal to warm amber-gold (#38bdf8 -> #d99b26)
 *   - Sick (<40): dim desaturated amber (#926c3b / #a67636), NEVER red.
 */

export interface HealthVisuals {
  coreColor: string;
  auraColor: string;
  auraOpacity: number;
  emissiveIntensity: number;
  glowScale: number;
  label: 'Healthy' | 'Moderate' | 'Sick (Legacy)';
  badgeClass: string;
  barColor: string;
  textColor: string;
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
      .join('')
  );
}

function lerpHex(hexA: string, hexB: string, t: number): string {
  const a = hexA.replace('#', '');
  const b = hexB.replace('#', '');
  const r = lerpChannel(parseInt(a.slice(0, 2), 16), parseInt(b.slice(0, 2), 16), t);
  const g = lerpChannel(parseInt(a.slice(2, 4), 16), parseInt(b.slice(2, 4), 16), t);
  const bl = lerpChannel(parseInt(a.slice(4, 6), 16), parseInt(b.slice(4, 6), 16), t);
  return rgbToHex(r, g, bl);
}

/**
 * Computes non-red health visuals for a node's health score (0-100).
 * - Healthy (70-100): luminous teal-green (#10b981 -> #00f5d4), intense glow
 * - Moderate (40-69): transitional muted gold-amber to teal (#b88636 -> #10b981)
 * - Sick (0-39): dim desaturated amber (#735329 -> #a67633), subtle dull haze, NEVER red
 */
export function getHealthVisuals(health: number): HealthVisuals {
  const clamped = Math.max(0, Math.min(100, health));

  if (clamped >= 70) {
    // Healthy: bright teal-green glow, high saturation
    const t = (clamped - 70) / 30; // 0..1
    const coreColor = lerpHex('#10b981', '#00f5d4', t);
    const auraColor = lerpHex('#14b8a6', '#2afadf', t);
    return {
      coreColor,
      auraColor,
      auraOpacity: 0.24 + t * 0.18,
      emissiveIntensity: 0.9 + t * 0.65,
      glowScale: 2.0 + t * 0.45,
      label: 'Healthy',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
      barColor: 'bg-gradient-to-r from-teal-500 to-emerald-400',
      textColor: 'text-emerald-300',
    };
  }

  if (clamped >= 40) {
    // Moderate (40-70): mid saturation cyan-teal to warm muted gold
    const t = (clamped - 40) / 30; // 0..1
    const coreColor = lerpHex('#b58338', '#14b8a6', t);
    const auraColor = lerpHex('#9c6f2d', '#0d9488', t);
    return {
      coreColor,
      auraColor,
      auraOpacity: 0.12 + t * 0.1,
      emissiveIntensity: 0.35 + t * 0.45,
      glowScale: 1.55 + t * 0.4,
      label: 'Moderate',
      badgeClass: 'bg-amber-500/15 text-amber-200 border-amber-500/35',
      barColor: 'bg-gradient-to-r from-amber-600/80 to-teal-400/90',
      textColor: 'text-teal-200',
    };
  }

  // Sick (<40): dim desaturated amber, low aura, never red
  const t = clamped / 40; // 0..1
  const coreColor = lerpHex('#735329', '#a67633', t);
  const auraColor = lerpHex('#5c4220', '#8c642b', t);
  return {
    coreColor,
    auraColor,
    auraOpacity: 0.05 + t * 0.06,
    emissiveIntensity: 0.12 + t * 0.18,
    glowScale: 1.28 + t * 0.22,
    label: 'Sick (Legacy)',
    badgeClass: 'bg-amber-900/30 text-amber-300/85 border-amber-700/40',
    barColor: 'bg-gradient-to-r from-amber-800/80 to-amber-600/80',
    textColor: 'text-amber-300/90',
  };
}

/**
 * Canonical edge key helper for consistent lookup across string or object links.
 */
export function getEdgeKey(source: string | { id?: string }, target: string | { id?: string }): string {
  const s = typeof source === 'string' ? source : source.id ?? '';
  const t = typeof target === 'string' ? target : target.id ?? '';
  return `${s}->${t}`;
}
