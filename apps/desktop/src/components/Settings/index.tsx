import { motion } from 'framer-motion';
import { useAppStore } from '../../stores/appStore';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

function SettingsSection({ title, children }: SettingsSectionProps) {
  const { isDarkMode } = useAppStore();

  return (
    <div className="mb-6">
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{
          color: isDarkMode ? 'var(--text-tertiary)' : 'rgba(0, 0, 0, 0.4)',
          fontFamily: 'var(--font-system)',
        }}
      >
        {title}
      </h3>
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
        }}
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

export function Settings() {
  const { isDarkMode, autoPasteEnabled, setAutoPasteEnabled, history, clearHistory } = useAppStore();

  return (
    <div
      className={`min-h-screen p-6 ${isDarkMode ? 'dark' : ''}`}
      style={{
        fontFamily: 'var(--font-system)',
        background: isDarkMode ? '#1c1c1e' : '#f5f5f7',
      }}
    >
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-semibold"
          style={{
            color: isDarkMode ? 'var(--text-primary)' : 'rgba(0, 0, 0, 0.85)',
            fontFamily: 'var(--font-system)',
            fontWeight: 600,
            letterSpacing: '-0.02em',
          }}
        >
          Settings
        </h1>
        <p
          className="text-sm mt-1"
          style={{ color: isDarkMode ? 'var(--text-secondary)' : 'rgba(0, 0, 0, 0.5)' }}
        >
          Configure VoiceFlow preferences
        </p>
      </div>

      {/* Keyboard Shortcut Section */}
      <SettingsSection title="Keyboard Shortcut">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p
                className="text-sm font-medium"
                style={{ color: isDarkMode ? 'var(--text-primary)' : 'rgba(0, 0, 0, 0.85)' }}
              >
                Hold to record
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: isDarkMode ? 'var(--text-secondary)' : 'rgba(0, 0, 0, 0.5)' }}
              >
                Press and hold to start, release to transcribe
              </p>
            </div>
            <div
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
              style={{
                background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
                color: isDarkMode ? 'var(--text-primary)' : 'rgba(0, 0, 0, 0.7)',
              }}
            >
              <span className="text-base">⌥</span>
              <span>Space</span>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Behavior Section */}
      <SettingsSection title="Behavior">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p
                className="text-sm font-medium"
                style={{ color: isDarkMode ? 'var(--text-primary)' : 'rgba(0, 0, 0, 0.85)' }}
              >
                Auto-paste
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: isDarkMode ? 'var(--text-secondary)' : 'rgba(0, 0, 0, 0.5)' }}
              >
                Copy transcription to clipboard automatically
              </p>
            </div>
            <Toggle enabled={autoPasteEnabled} onChange={setAutoPasteEnabled} />
          </div>
        </div>
      </SettingsSection>

      {/* History Section */}
      <SettingsSection title="Recent Transcriptions">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p
              className="text-sm"
              style={{ color: isDarkMode ? 'var(--text-secondary)' : 'rgba(0, 0, 0, 0.5)' }}
            >
              {history.length} item{history.length !== 1 ? 's' : ''}
            </p>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-xs font-medium transition-colors"
                style={{ color: '#ef4444' }}
              >
                Clear all
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <p
              className="text-sm italic"
              style={{ color: isDarkMode ? 'var(--text-tertiary)' : 'rgba(0, 0, 0, 0.3)' }}
            >
              No transcriptions yet. Hold ⌥ Space to start.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {history.slice(0, 5).map((item, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg"
                  style={{
                    background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  }}
                >
                  <p
                    className="text-sm truncate"
                    style={{ color: isDarkMode ? 'var(--text-primary)' : 'rgba(0, 0, 0, 0.8)' }}
                  >
                    {item.text}
                  </p>
                  <p
                    className="text-[10px] mt-1"
                    style={{ color: isDarkMode ? 'var(--text-tertiary)' : 'rgba(0, 0, 0, 0.35)' }}
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
      <div
        className="mt-8 text-center text-xs"
        style={{ color: isDarkMode ? 'var(--text-tertiary)' : 'rgba(0, 0, 0, 0.3)' }}
      >
        <p>VoiceFlow v0.1.0</p>
        <p className="text-[10px] mt-1">Local speech-to-text powered by parakeet-mlx</p>
      </div>
    </div>
  );
}
