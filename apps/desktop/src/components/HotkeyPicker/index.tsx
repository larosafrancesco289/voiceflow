import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore, HotkeyConfig } from '../../stores/appStore';
import { getModifierSymbol, getDisplayString } from '../../utils/modifierSymbols';

interface KeyInfo {
  modifiers: string[];
  key: string;
}

const MODIFIER_KEYS = ['Alt', 'Control', 'Shift', 'Meta'] as const;

function parseKeyboardEvent(e: KeyboardEvent): KeyInfo | null {
  // Ignore pure modifier key presses
  if (MODIFIER_KEYS.includes(e.key as typeof MODIFIER_KEYS[number])) {
    return null;
  }

  const modifiers: string[] = [];
  if (e.altKey) modifiers.push('Alt');
  if (e.ctrlKey) modifiers.push('Control');
  if (e.shiftKey) modifiers.push('Shift');
  if (e.metaKey) modifiers.push('Meta');

  // Normalize key code to a readable format
  let key = e.code;
  if (key.startsWith('Key')) {
    key = key.slice(3);
  } else if (key.startsWith('Digit')) {
    key = key.slice(5);
  }

  return { modifiers, key };
}

export function HotkeyPicker() {
  const { hotkey, setHotkey } = useAppStore();
  const [isCapturing, setIsCapturing] = useState(false);
  const [pendingHotkey, setPendingHotkey] = useState<KeyInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load current shortcut from Rust backend on mount
  useEffect(() => {
    const loadShortcut = async () => {
      try {
        const config = await invoke<{ modifiers: string[]; key: string }>('get_current_shortcut');
        setHotkey({
          modifiers: config.modifiers,
          key: config.key,
          display: getDisplayString(config.modifiers, config.key),
        });
      } catch (err) {
        console.error('Failed to load shortcut:', err);
      }
    };
    loadShortcut();
  }, [setHotkey]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const keyInfo = parseKeyboardEvent(e);
    if (keyInfo) {
      // Require at least one modifier
      if (keyInfo.modifiers.length === 0) {
        setError('Please include a modifier key (Option, Control, Shift, or Command)');
        return;
      }
      setError(null);
      setPendingHotkey(keyInfo);
    }
  }, []);

  const startCapture = useCallback(() => {
    setIsCapturing(true);
    setPendingHotkey(null);
    setError(null);
  }, []);

  const cancelCapture = useCallback(() => {
    setIsCapturing(false);
    setPendingHotkey(null);
    setError(null);
  }, []);

  const saveHotkey = useCallback(async () => {
    if (!pendingHotkey) return;

    setIsSaving(true);
    setError(null);

    try {
      await invoke('set_shortcut', {
        modifiers: pendingHotkey.modifiers,
        key: pendingHotkey.key,
      });

      const newHotkey: HotkeyConfig = {
        modifiers: pendingHotkey.modifiers,
        key: pendingHotkey.key,
        display: getDisplayString(pendingHotkey.modifiers, pendingHotkey.key),
      };

      setHotkey(newHotkey);
      setIsCapturing(false);
      setPendingHotkey(null);
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to set shortcut');
    } finally {
      setIsSaving(false);
    }
  }, [pendingHotkey, setHotkey]);

  // Add/remove keyboard listener when capturing
  useEffect(() => {
    if (isCapturing) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isCapturing, handleKeyDown]);

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {!isCapturing ? (
          <motion.button
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={startCapture}
            className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/15 transition-colors"
          >
            {hotkey.modifiers.map((mod, i) => (
              <span
                key={i}
                className="px-2 py-1 rounded text-xs font-medium bg-white/10 text-white/90"
              >
                {getModifierSymbol(mod)}
              </span>
            ))}
            <span className="px-2 py-1 rounded text-xs font-medium bg-white/10 text-white/90">
              {hotkey.key}
            </span>
          </motion.button>
        ) : (
          <motion.div
            key="capture"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-3 py-2 rounded bg-violet-500/20 border border-violet-500/30 min-w-[100px] justify-center">
                {pendingHotkey ? (
                  <>
                    {pendingHotkey.modifiers.map((mod, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded text-xs font-medium bg-violet-500/30 text-violet-300"
                      >
                        {getModifierSymbol(mod)}
                      </span>
                    ))}
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-violet-500/30 text-violet-300">
                      {pendingHotkey.key}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-white/50">Press keys...</span>
                )}
              </div>

              {pendingHotkey && (
                <button
                  onClick={saveHotkey}
                  disabled={isSaving}
                  className="px-3 py-1.5 rounded text-xs font-medium bg-violet-500 hover:bg-violet-400 text-white transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              )}

              <button
                onClick={cancelCapture}
                className="px-3 py-1.5 rounded text-xs font-medium bg-white/10 hover:bg-white/15 text-white/70 transition-colors"
              >
                Cancel
              </button>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-red-400"
              >
                {error}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
