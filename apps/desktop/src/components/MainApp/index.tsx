import { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { ModelLoading } from '../ModelLoading';
import { HotkeyPicker } from '../HotkeyPicker';
import { Toggle } from '../Toggle';
import { getModifierSymbol } from '../../utils/modifierSymbols';

type Tab = 'home' | 'settings';

function StatusBadge({ ready }: { ready: boolean }): React.ReactNode {
  const statusClass = ready
    ? 'bg-emerald-500/20 text-emerald-400'
    : 'bg-amber-500/20 text-amber-400';
  const dotClass = ready ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse';

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      {ready ? 'Ready' : 'Loading'}
    </div>
  );
}

function HomeView() {
  const hotkey = useAppStore((state) => state.hotkey);
  const modelLoadingState = useAppStore((state) => state.modelLoadingState);
  const history = useAppStore((state) => state.history);

  return (
    <div className="flex-1 flex flex-col">
      {/* Shortcut Display */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/5 mb-4">
        <p className="text-xs text-white/40 mb-3 uppercase tracking-wider">
          Hold to Record
        </p>
        <div className="flex items-center gap-2">
          {hotkey.modifiers.map((mod, i) => (
            <span
              key={i}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-white/10 text-white border border-white/10"
            >
              {getModifierSymbol(mod)}
            </span>
          ))}
          <span className="text-white/30">+</span>
          <span className="px-3 py-2 rounded-lg text-sm font-medium bg-white/10 text-white border border-white/10">
            {hotkey.key}
          </span>
        </div>
      </div>

      {/* Model Status (only show when loading) */}
      {modelLoadingState.isLoading && (
        <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 mb-4">
          <ModelLoading variant="full" />
        </div>
      )}

      {/* Recent History */}
      <div className="flex-1 min-h-0">
        <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">
          Recent ({history.length})
        </p>
        {history.length === 0 ? (
          <div className="p-4 rounded-xl bg-white/5 text-center">
            <p className="text-sm text-white/25">No transcriptions yet</p>
            <p className="text-xs text-white/15 mt-1">
              Hold {hotkey.display} to start recording
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {history.slice(0, 5).map((item) => (
              <div
                key={item.timestamp}
                className="p-3 rounded-lg bg-white/5"
              >
                <p className="text-sm text-white/80 line-clamp-2">{item.text}</p>
                <p className="text-[10px] mt-1 text-white/25">
                  {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsView() {
  const { autoPasteEnabled, setAutoPasteEnabled, history, clearHistory } = useAppStore();

  return (
    <div className="flex-1 flex flex-col">
      {/* Settings sections */}
      <div className="space-y-1">
        <div className="flex items-center justify-between py-4 border-b border-white/5">
          <div>
            <p className="text-sm font-medium text-white/90">Hold to record</p>
            <p className="text-xs mt-0.5 text-white/40">Click to change shortcut</p>
          </div>
          <HotkeyPicker />
        </div>

        <div className="flex items-center justify-between py-4 border-b border-white/5">
          <div>
            <p className="text-sm font-medium text-white/90">Auto-paste</p>
            <p className="text-xs mt-0.5 text-white/40">Paste transcription automatically</p>
          </div>
          <Toggle enabled={autoPasteEnabled} onChange={setAutoPasteEnabled} />
        </div>
      </div>

      {/* History section */}
      <div className="mt-6 flex-1">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-wider text-white/30">
            History ({history.length})
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
          <div className="space-y-2 max-h-[140px] overflow-y-auto">
            {history.slice(0, 5).map((item) => (
              <div
                key={item.timestamp}
                className="p-3 rounded-lg bg-white/5"
              >
                <p className="text-sm truncate text-white/80">{item.text}</p>
                <p className="text-[10px] mt-1 text-white/25">
                  {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function MainApp() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const modelLoadingState = useAppStore((state) => state.modelLoadingState);
  const isModelReady = !modelLoadingState.isLoading;

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-sans flex flex-col">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* App Icon */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">
                VoiceFlow
              </h1>
              <p className="text-xs text-white/40">Local speech-to-text</p>
            </div>
          </div>
          <StatusBadge ready={isModelReady} />
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 rounded-lg bg-white/5">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'home'
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'settings'
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            Settings
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-6 pb-4 flex flex-col">
        {activeTab === 'home' ? <HomeView /> : <SettingsView />}
      </div>

      {/* Footer */}
      <div className="p-4 text-center border-t border-white/5">
        <p className="text-[11px] text-white/20">VoiceFlow v0.1.0</p>
      </div>
    </div>
  );
}
