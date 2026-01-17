import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from './stores/appStore';
import { useTranscription } from './hooks/useTranscription';
import { PulsingOrb } from './components/PulsingOrb';
import { AudioWaveform } from './components/AudioWaveform';
import { Settings } from './components/Settings';

function MainView() {
  const { isDarkMode, recordingState, partialTranscription, currentTranscription } = useAppStore();
  const { isConnected, isReady, startRecording, stopRecording, getAnalyser } = useTranscription();

  const displayText = currentTranscription || partialTranscription;

  const stateLabels = {
    idle: isReady ? 'Click to record' : 'Connecting...',
    recording: 'Listening...',
    processing: 'Transcribing...',
    complete: 'Done!',
  };

  const handleClick = async () => {
    if (recordingState === 'idle' && isReady) {
      await startRecording();
    } else if (recordingState === 'recording') {
      await stopRecording();
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-6 ${
        isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
      }`}
    >
      <div className="flex items-center gap-4 mb-4">
        <div onClick={handleClick} className="cursor-pointer">
          <PulsingOrb size={64} />
        </div>

        <div className="flex-1">
          <AnimatePresence mode="wait">
            {displayText ? (
              <motion.p
                key="text"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm font-medium"
              >
                {displayText}
              </motion.p>
            ) : (
              <motion.p
                key="status"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm opacity-60"
              >
                {stateLabels[recordingState]}
              </motion.p>
            )}
          </AnimatePresence>

          {(recordingState === 'recording' || recordingState === 'processing') && (
            <div className="mt-2">
              <AudioWaveform width={200} height={32} analyser={getAnalyser()} />
            </div>
          )}
        </div>
      </div>

      <p className="text-xs opacity-40">
        {isConnected ? (isReady ? '🟢 Ready' : '🟡 Loading model...') : '🔴 Disconnected'} • Click orb to record
      </p>
    </div>
  );
}

function App() {
  const { isDarkMode, setDarkMode } = useAppStore();
  const [currentPage, setCurrentPage] = useState<'main' | 'settings'>('main');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setDarkMode(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [setDarkMode]);

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/settings') {
      setCurrentPage('settings');
    }
  }, []);

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      {currentPage === 'settings' ? <Settings /> : <MainView />}
    </div>
  );
}

export default App;
