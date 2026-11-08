import { useState, useEffect, useLayoutEffect, useCallback } from 'react';

export type ColorblindMode = 'none' | 'protanopia' | 'tritanopia';
export type ThemePreference = 'system' | 'light' | 'dark';
export type TextScale = 'normal' | 'large' | 'xlarge';

export interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  colorblindMode: ColorblindMode;
  textScale: TextScale;
  screenReaderAnnouncements: boolean;
  theme: ThemePreference;
  /** Resolved theme, retained for existing graph renderers. */
  darkMode: boolean;
}

const STORAGE_KEY = 'legacy_code_solver_a11y_settings';

export const DEFAULT_SETTINGS: AccessibilitySettings = {
  highContrast: false,
  reducedMotion: false,
  colorblindMode: 'none',
  textScale: 'normal',
  screenReaderAnnouncements: true,
  theme: 'system',
  darkMode: false,
};

function resolveDark(theme: ThemePreference): boolean {
  return theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

export function loadSettings(): AccessibilitySettings {
  const defaults = { ...DEFAULT_SETTINGS, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches };
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    // Migrate the previous boolean setting; unrelated saved preferences never disable System mode.
    const theme: ThemePreference = ['system', 'light', 'dark'].includes(raw.theme)
      ? raw.theme : typeof raw.darkMode === 'boolean' ? (raw.darkMode ? 'dark' : 'light') : 'system';
    return {
      ...defaults,
      theme,
      darkMode: resolveDark(theme),
      highContrast: typeof raw.highContrast === 'boolean' ? raw.highContrast : defaults.highContrast,
      reducedMotion: typeof raw.reducedMotion === 'boolean' ? raw.reducedMotion : defaults.reducedMotion,
      screenReaderAnnouncements: typeof raw.screenReaderAnnouncements === 'boolean' ? raw.screenReaderAnnouncements : true,
      textScale: ['normal', 'large', 'xlarge'].includes(raw.textScale) ? raw.textScale : 'normal',
      colorblindMode: ['none', 'protanopia', 'tritanopia'].includes(raw.colorblindMode) ? raw.colorblindMode : 'none',
    };
  } catch {
    return { ...defaults, darkMode: resolveDark('system') };
  }
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
        const theme = key === 'theme' ? value as ThemePreference : key === 'darkMode' ? (value ? 'dark' : 'light') : prev.theme;
        const next = { ...prev, [key]: value, theme, darkMode: resolveDark(theme) };
        saveSettings(next);
        return next;
      });
    },
    []
  );

  const resetSettings = useCallback(() => {
    const next = { ...DEFAULT_SETTINGS, darkMode: resolveDark('system'), reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches };
    setSettings(next);
    saveSettings(next);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setSettings(prev => prev.theme === 'system' ? { ...prev, darkMode: media.matches } : prev);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setSettings(loadSettings());
    };
    media.addEventListener('change', handleChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      media.removeEventListener('change', handleChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;

    if (settings.highContrast) root.classList.add('high-contrast');
    else root.classList.remove('high-contrast');

    if (settings.reducedMotion) root.classList.add('reduced-motion');
    else root.classList.remove('reduced-motion');

    root.classList.remove('text-scale-normal', 'text-scale-large', 'text-scale-xlarge');
    root.classList.add(`text-scale-${settings.textScale}`);

    root.classList.remove('cb-none', 'cb-protanopia', 'cb-tritanopia');
    root.classList.add(`cb-${settings.colorblindMode}`);

    root.classList.toggle('dark', settings.darkMode);
    root.dataset.theme = settings.darkMode ? 'dark' : 'light';
    root.dataset.themePreference = settings.theme;
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