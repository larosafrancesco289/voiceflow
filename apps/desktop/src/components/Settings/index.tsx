import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { invoke } from '@tauri-apps/api/core';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

function SettingsSection({ title, children }: SettingsSectionProps) {
  const { isDarkMode } = useAppStore();

  return (
    <div className="mb-6">
      <h3
        className={`text-xs font-semibold uppercase tracking-wider mb-3 ${
          isDarkMode ? 'text-white/40' : 'text-gray-400'
        }`}
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
      >
        {title}
      </h3>
      <div
        className={`rounded-xl overflow-hidden ${
          isDarkMode ? 'bg-white/5' : 'bg-black/[0.03]'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

function Toggle({ enabled, onChange }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-[26px] rounded-full transition-colors duration-200 ${
        enabled ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <motion.div
        className="absolute top-[3px] left-[3px] w-5 h-5 rounded-full bg-white shadow-sm"
        animate={{ x: enabled ? 18 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

interface KeyBadgeProps {
  keyName: string;
  onRemove?: () => void;
  removable?: boolean;
}

function KeyBadge({ keyName, onRemove, removable = true }: KeyBadgeProps) {
  const { isDarkMode } = useAppStore();

  const displayName: Record<string, string> = {
    fn: 'Fn',
    capslock: 'Caps Lock',
    ctrl: 'Control',
    alt: 'Option',
    cmd: 'Command',
    shift: 'Shift',
  };

  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
        isDarkMode
          ? 'bg-white/10 text-white/80'
          : 'bg-gray-100 text-gray-700'
      }`}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
    >
      {displayName[keyName] || keyName}
      {removable && onRemove && (
        <button
          onClick={onRemove}
          className={`ml-1 w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
            isDarkMode
              ? 'hover:bg-white/20 text-white/50 hover:text-white/80'
              : 'hover:bg-gray-200 text-gray-400 hover:text-gray-600'
          }`}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 2l6 6M8 2l-6 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </motion.span>
  );
}

export function Settings() {
  const {
    isDarkMode,
    triggerKeys,
    setTriggerKeys,
    autoPasteEnabled,
    setAutoPasteEnabled,
    history,
    clearHistory,
  } = useAppStore();

  const [showAddKey, setShowAddKey] = useState(false);

  const availableKeys = ['fn', 'capslock', 'ctrl', 'alt', 'cmd', 'shift'];
  const remainingKeys = availableKeys.filter((k) => !triggerKeys.includes(k));

  const handleAddKey = (key: string) => {
    const newKeys = [...triggerKeys, key];
    setTriggerKeys(newKeys);
    invoke('set_trigger_keys', { keys: newKeys });
    setShowAddKey(false);
  };

  const handleRemoveKey = (key: string) => {
    if (triggerKeys.length <= 1) return;
    const newKeys = triggerKeys.filter((k) => k !== key);
    setTriggerKeys(newKeys);
    invoke('set_trigger_keys', { keys: newKeys });
  };

  return (
    <div
      className={`min-h-screen p-6 ${isDarkMode ? 'dark bg-[#1c1c1e]' : 'bg-[#f5f5f7]'}`}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' }}
    >
      {/* Header */}
      <div className="mb-8">
        <h1
          className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
            fontWeight: 600,
            letterSpacing: '-0.02em',
          }}
        >
          Settings
        </h1>
        <p className={`text-sm mt-1 ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
          Configure VoiceFlow preferences
        </p>
      </div>

      {/* Trigger Keys Section */}
      <SettingsSection title="Trigger Keys">
        <div className={`p-4 ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
          <p className={`text-sm mb-3 ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
            Press and hold any of these keys to start recording
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            <AnimatePresence mode="popLayout">
              {triggerKeys.map((key) => (
                <KeyBadge
                  key={key}
                  keyName={key}
                  onRemove={() => handleRemoveKey(key)}
                  removable={triggerKeys.length > 1}
                />
              ))}
            </AnimatePresence>
          </div>

          {remainingKeys.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowAddKey(!showAddKey)}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  isDarkMode
                    ? 'text-indigo-400 hover:text-indigo-300'
                    : 'text-indigo-600 hover:text-indigo-500'
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 3v10M3 8h10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Add trigger key
              </button>

              <AnimatePresence>
                {showAddKey && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute top-full left-0 mt-2 p-2 rounded-xl shadow-xl z-10 min-w-[160px] ${
                      isDarkMode ? 'bg-[#2c2c2e]' : 'bg-white'
                    }`}
                  >
                    {remainingKeys.map((key) => (
                      <button
                        key={key}
                        onClick={() => handleAddKey(key)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          isDarkMode
                            ? 'hover:bg-white/10 text-white/80'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {key === 'fn' ? 'Fn' : key === 'capslock' ? 'Caps Lock' : key.charAt(0).toUpperCase() + key.slice(1)}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Behavior Section */}
      <SettingsSection title="Behavior">
        <div
          className={`flex items-center justify-between p-4 ${
            isDarkMode ? 'border-b border-white/5' : 'border-b border-gray-100'
          }`}
        >
          <div>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-white/90' : 'text-gray-800'}`}>
              Auto-paste
            </p>
            <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
              Automatically paste transcription to active app
            </p>
          </div>
          <Toggle enabled={autoPasteEnabled} onChange={setAutoPasteEnabled} />
        </div>
      </SettingsSection>

      {/* History Section */}
      <SettingsSection title="History">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
              {history.length} recent transcription{history.length !== 1 ? 's' : ''}
            </p>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className={`text-xs font-medium transition-colors ${
                  isDarkMode
                    ? 'text-red-400 hover:text-red-300'
                    : 'text-red-500 hover:text-red-600'
                }`}
              >
                Clear all
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <p className={`text-sm italic ${isDarkMode ? 'text-white/30' : 'text-gray-400'}`}>
              No transcriptions yet
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {history.slice(0, 5).map((item, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${
                    isDarkMode ? 'bg-white/5' : 'bg-gray-50'
                  }`}
                >
                  <p
                    className={`text-sm truncate ${
                      isDarkMode ? 'text-white/80' : 'text-gray-700'
                    }`}
                  >
                    {item.text}
                  </p>
                  <p
                    className={`text-[10px] mt-1 ${
                      isDarkMode ? 'text-white/30' : 'text-gray-400'
                    }`}
                  >
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </SettingsSection>

      {/* About */}
      <div className={`mt-8 text-center ${isDarkMode ? 'text-white/30' : 'text-gray-400'}`}>
        <p className="text-xs">VoiceFlow v0.1.0</p>
        <p className="text-[10px] mt-1">Local speech-to-text powered by parakeet-mlx</p>
      </div>
    </div>
  );
}
