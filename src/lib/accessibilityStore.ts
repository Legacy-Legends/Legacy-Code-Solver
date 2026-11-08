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

  // Detect system preferences
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

// Custom Hook to consume and manipulate accessibility settings
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

  // Sync DOM classes whenever settings change
  useEffect(() => {
    const root = document.documentElement;

    // High Contrast
    if (settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Reduced Motion
    if (settings.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }

    // Text Scale
    root.classList.remove('text-scale-normal', 'text-scale-large', 'text-scale-xlarge');
    root.classList.add(`text-scale-${settings.textScale}`);

    // Colorblind Mode
    root.classList.remove('cb-none', 'cb-protanopia', 'cb-tritanopia');
    root.classList.add(`cb-${settings.colorblindMode}`);

    // Dark Mode
    if (settings.darkMode) {
      root.classList.add('dark');
      document.body?.classList.add('dark');
    } else {
      root.classList.remove('dark');
      document.body?.classList.remove('dark');
    }
  }, [settings]);

  return {
    settings,
    updateSetting,
    resetSettings,
  };
}

// Global screen reader announcer
let globalAnnounce: ((message: string) => void) | null = null;

export function registerAnnouncer(fn: (msg: string) => void) {
  globalAnnounce = fn;
}

export function announceToScreenReader(message: string) {
  if (globalAnnounce) {
    globalAnnounce(message);
  }
}
