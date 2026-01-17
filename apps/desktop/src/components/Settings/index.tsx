import { motion } from 'framer-motion';
import { useAppStore } from '../../stores/appStore';

// Refined toggle switch
function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="relative w-10 h-6 rounded-full transition-all duration-200"
      style={{
        background: enabled ? '#22c55e' : 'rgba(255, 255, 255, 0.1)',
      }}
    >
      <motion.div
        className="absolute top-1 left-1 w-4 h-4 rounded-full"
        style={{ background: '#fff' }}
        animate={{ x: enabled ? 16 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

// Keyboard shortcut badge
function ShortcutBadge() {
  return (
    <div className="flex items-center gap-1">
      <span
        className="px-2 py-1 rounded text-xs font-medium"
        style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'rgba(255, 255, 255, 0.9)' }}
      >
        ⌥
      </span>
      <span
        className="px-2 py-1 rounded text-xs font-medium"
        style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'rgba(255, 255, 255, 0.9)' }}
      >
        Space
      </span>
    </div>
  );
}

// Setting row component
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
      className="flex items-center justify-between py-4"
      style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
    >
      <div>
        <p className="text-sm font-medium" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
          {label}
        </p>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
            {description}
          </p>
        )}
      </div>
      {children}
    </motion.div>
  );
}

export function Settings() {
  const { autoPasteEnabled, setAutoPasteEnabled, history, clearHistory } = useAppStore();

  return (
    <div
      className="min-h-screen p-6"
      style={{
        background: '#0a0a0a',
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <h1
          className="text-xl font-semibold tracking-tight"
          style={{ color: '#fff', letterSpacing: '-0.02em' }}
        >
          Settings
        </h1>
      </motion.div>

      {/* Settings sections */}
      <div className="space-y-1">
        <SettingRow
          label="Hold to record"
          description="Press and hold, release to transcribe"
          delay={0.05}
        >
          <ShortcutBadge />
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
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255, 255, 255, 0.3)' }}>
            Recent ({history.length})
          </p>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-xs transition-colors hover:opacity-80"
              style={{ color: 'rgba(255, 255, 255, 0.4)' }}
            >
              Clear
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="text-sm py-4" style={{ color: 'rgba(255, 255, 255, 0.25)' }}>
            No transcriptions yet
          </p>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {history.slice(0, 5).map((item, index) => (
              <motion.div
                key={item.timestamp}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: 0.25 + index * 0.05 }}
                className="p-3 rounded-lg"
                style={{ background: 'rgba(255, 255, 255, 0.04)' }}
              >
                <p
                  className="text-sm truncate"
                  style={{ color: 'rgba(255, 255, 255, 0.8)' }}
                >
                  {item.text}
                </p>
                <p className="text-[10px] mt-1" style={{ color: 'rgba(255, 255, 255, 0.25)' }}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
        <p className="text-[11px]" style={{ color: 'rgba(255, 255, 255, 0.2)' }}>
          VoiceFlow v0.1.0
        </p>
      </motion.div>
    </div>
  );
}
