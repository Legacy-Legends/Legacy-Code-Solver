import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Eye,
  Keyboard,
  RotateCcw,
  Check,
  ZapOff,
  Type,
  SunMoon,
  Volume2,
  Moon,
  Sun,
} from 'lucide-react';
import {
  AccessibilitySettings,
  ColorblindMode,
  TextScale,
} from '../lib/accessibilityStore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AccessibilitySettings;
  onUpdateSetting: <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => void;
  onResetSettings: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSetting,
  onResetSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'display' | 'shortcuts' | 'engine'>('display');

  // Close modal on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm select-none animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-sm">
              <Sliders className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-base font-bold text-slate-900">
                Settings &amp; Accessibility
              </h2>
              <p className="text-xs text-slate-500">Configure display, visual aids, and motion preferences</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('display')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'display'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Accessibility &amp; Display</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shortcuts')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'shortcuts'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Keyboard Shortcuts</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {activeTab === 'display' && (
            <div className="space-y-5">
              {/* Dark Mode Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-start space-x-3">
                  {settings.darkMode ? (
                    <Moon className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  ) : (
                    <Sun className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="text-xs font-bold text-slate-900">Dark Mode</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Switch between clean paper canvas and obsidian night theme.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.darkMode}
                  onClick={() => onUpdateSetting('darkMode', !settings.darkMode)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    settings.darkMode ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      settings.darkMode ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* High Contrast Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-start space-x-3">
                  <SunMoon className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-slate-900">High Contrast Mode (WCAG AAA)</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Forces maximum text contrast, solid borders, and clear element separation.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.highContrast}
                  onClick={() => onUpdateSetting('highContrast', !settings.highContrast)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    settings.highContrast ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      settings.highContrast ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Reduced Motion Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-start space-x-3">
                  <ZapOff className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-slate-900">Reduced Motion</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Disables 3D particles, camera transitions, and sliding drawer animations.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.reducedMotion}
                  onClick={() => onUpdateSetting('reducedMotion', !settings.reducedMotion)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    settings.reducedMotion ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      settings.reducedMotion ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Colorblind Palette Selection */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-900 block">
                  Colorblind Palette Adaptation
                </label>
                <p className="text-[11px] text-slate-500">
                  Swaps color signals to accessible color pairs for specific forms of color vision deficiency.
                </p>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {(
                    [
                      { id: 'none', label: 'Default', desc: 'Emerald & Slate' },
                      { id: 'protanopia', label: 'Protanopia', desc: 'Cobalt & Amber' },
                      { id: 'tritanopia', label: 'Tritanopia', desc: 'Teal & Crimson' },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => onUpdateSetting('colorblindMode', mode.id as ColorblindMode)}
                      className={`p-2.5 rounded-lg border text-left text-xs transition cursor-pointer ${
                        settings.colorblindMode === mode.id
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{mode.label}</span>
                        {settings.colorblindMode === mode.id && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5 font-normal">{mode.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Scaling */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2">
                  <Type className="w-4 h-4 text-emerald-600" />
                  <label className="text-xs font-bold text-slate-900">Font &amp; Interface Size Scaling</label>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {(
                    [
                      { id: 'normal', label: 'Default (100%)' },
                      { id: 'large', label: 'Large (115%)' },
                      { id: 'xlarge', label: 'Extra Large (130%)' },
                    ] as const
                  ).map((scale) => (
                    <button
                      key={scale.id}
                      type="button"
                      onClick={() => onUpdateSetting('textScale', scale.id as TextScale)}
                      className={`p-2 rounded-lg border text-center text-xs transition cursor-pointer ${
                        settings.textScale === scale.id
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {scale.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Screen Reader Live Announcements */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-start space-x-3">
                  <Volume2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-slate-900">Screen Reader Live Announcements</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Verbally announces class selections and blast calculation updates via ARIA live regions.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.screenReaderAnnouncements}
                  onClick={() =>
                    onUpdateSetting('screenReaderAnnouncements', !settings.screenReaderAnnouncements)
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    settings.screenReaderAnnouncements ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      settings.screenReaderAnnouncements ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-3 font-mono text-xs">
              <p className="font-sans text-xs text-slate-500 mb-4">
                Keyboard shortcuts available across all investigation views:
              </p>
              <div className="space-y-2">
                {[
                  { key: '⌘K or /', action: 'Focus Java symbol search bar' },
                  { key: 'Enter', action: 'Launch featured investigation from landing' },
                  { key: 'Esc', action: 'Close evidence drawer or active modal' },
                  { key: 'Tab / Shift+Tab', action: 'Navigate interactive nodes and controls' },
                  { key: 'Space / Enter', action: 'Inspect focused class or open call site code' },
                  { key: '↑ / ↓', action: 'Navigate dropdown options or search results' },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200"
                  >
                    <span className="font-sans text-slate-700 text-xs">{item.action}</span>
                    <kbd className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-900 text-[11px] font-bold shadow-2xs">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onResetSettings}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to default</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
