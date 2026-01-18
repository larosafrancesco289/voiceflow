import { motion } from 'framer-motion';
import { useAppStore } from '../../stores/appStore';
import { HotkeyPicker } from '../HotkeyPicker';
import { Toggle } from '../Toggle';

function SettingRow({
  label,
  description,
  children,
  delay = 0,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="flex items-center justify-between py-4 border-b border-white/5"
    >
      <div>
        <p className="text-sm font-medium text-white/90">{label}</p>
        {description && (
          <p className="text-xs mt-0.5 text-white/40">{description}</p>
        )}
      </div>
      {children}
    </motion.div>
  );
}

export function Settings() {
  const { autoPasteEnabled, setAutoPasteEnabled, history, clearHistory } = useAppStore();

  return (
    <div className="min-h-screen p-6 bg-[#0a0a0a] font-sans">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Settings
        </h1>
      </motion.div>

      {/* Settings sections */}
      <div className="space-y-1">
        <SettingRow
          label="Hold to record"
          description="Click to change shortcut"
          delay={0.05}
        >
          <HotkeyPicker />
        </SettingRow>

        <SettingRow
          label="Auto-paste"
          description="Paste transcription automatically"
          delay={0.1}
        >
          <Toggle enabled={autoPasteEnabled} onChange={setAutoPasteEnabled} />
        </SettingRow>
      </div>

      {/* History section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mt-8"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-wider text-white/30">
            Recent ({history.length})
          </p>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-xs transition-colors hover:opacity-80 text-white/40"
            >
              Clear
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="text-sm py-4 text-white/25">No transcriptions yet</p>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {history.slice(0, 5).map((item, index) => (
              <motion.div
                key={item.timestamp}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: 0.25 + index * 0.05 }}
                className="p-3 rounded-lg bg-white/5"
              >
                <p className="text-sm truncate text-white/80">{item.text}</p>
                <p className="text-[10px] mt-1 text-white/25">
                  {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="absolute bottom-6 left-6 right-6 text-center"
      >
        <p className="text-[11px] text-white/20">VoiceFlow v0.1.0</p>
      </motion.div>
    </div>
  );
}
