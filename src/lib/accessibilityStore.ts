import { useState, useEffect, useCallback } from 'react';

export type ColorblindMode = 'none' | 'protanopia' | 'tritanopia';
export type TextScale = 'normal' | 'large' | 'xlarge';

export interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  colorblindMode: ColorblindMode;
  textScale: TextScale;
  screenReaderAnnouncements: boolean;
  darkMode: boolean;
}

const STORAGE_KEY = 'legacy_code_solver_a11y_settings';

export const DEFAULT_SETTINGS: AccessibilitySettings = {
  highContrast: false,
  reducedMotion: false,
  colorblindMode: 'none',
  textScale: 'normal',
  screenReaderAnnouncements: true,
  darkMode: false,
};

export function loadSettings(): AccessibilitySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // Fallback to system preferences
  }

  const systemPrefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  const systemPrefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;

  return {
    ...DEFAULT_SETTINGS,
    reducedMotion: !!systemPrefersReducedMotion,
    darkMode: !!systemPrefersDark,
  };
}

export function saveSettings(settings: AccessibilitySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage quota or sandboxed
  }
}

export function useAccessibilitySettings() {
  const [settings, setSettings] = useState<AccessibilitySettings>(loadSettings);

  const updateSetting = useCallback(
    <K extends keyof AccessibilitySettings>(key: K, value: AccessibilitySettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        saveSettings(next);
        return next;
      });
    },
    []
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  }, []);

  // System dark mode listener
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-update if the user hasn't explicitly set a preference in localStorage
      if (!localStorage.getItem(STORAGE_KEY)) {
        updateSetting('darkMode', e.matches);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [updateSetting]);

  useEffect(() => {
    const root = document.documentElement;

    if (settings.highContrast) root.classList.add('high-contrast');
    else root.classList.remove('high-contrast');

    if (settings.reducedMotion) root.classList.add('reduced-motion');
    else root.classList.remove('reduced-motion');

    root.classList.remove('text-scale-normal', 'text-scale-large', 'text-scale-xlarge');
    root.classList.add(`text-scale-${settings.textScale}`);

    root.classList.remove('cb-none', 'cb-protanopia', 'cb-tritanopia');
    root.classList.add(`cb-${settings.colorblindMode}`);

    if (settings.darkMode) {
      root.classList.add('dark');
      document.body?.classList.add('dark');
      root.style.setProperty('--bg-canvas', '#090D16');
      root.style.setProperty('--bg-surface', '#0F172A');
      root.style.setProperty('--border-color', '#334155');
    } else {
      root.classList.remove('dark');
      document.body?.classList.remove('dark');
      root.style.setProperty('--bg-canvas', '#F7F5F0');
      root.style.setProperty('--bg-surface', '#FFFFFF');
      root.style.setProperty('--border-color', '#E4E2DA');
    }
  }, [settings]);

  return { settings, updateSetting, resetSettings };
}

let globalAnnounce: ((message: string) => void) | null = null;

export function registerAnnouncer(fn: (msg: string) => void) {
  globalAnnounce = fn;
}

export function announceToScreenReader(message: string) {
  if (globalAnnounce) {
    globalAnnounce(message);
  }
}