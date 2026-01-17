import { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from './stores/appStore';
import { useTranscription } from './hooks/useTranscription';
import { Settings } from './components/Settings';

// Minimal waveform component with organic breathing animation
function BreathingWaveform({ analyser }: { analyser: AnalyserNode | null }) {
  const { recordingState, setAudioLevel } = useAppStore();
  const barsRef = useRef<HTMLDivElement[]>([]);
  const animationRef = useRef<number | null>(null);

  const barCount = 5;
  const baseHeights = useMemo(() => [14, 20, 24, 20, 14], []);
  const animationDelays = useMemo(() => [0, 0.1, 0.2, 0.1, 0], []);

  useEffect(() => {
    if (!analyser || recordingState !== 'recording') {
      // Reset bars when not recording
      barsRef.current.forEach((bar, i) => {
        if (bar) {
          bar.style.height = `${baseHeights[i] * 0.4}px`;
        }
      });
      return;
    }

    const updateBars = () => {
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      // Get average level for the audio meter
      const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength / 255;
      setAudioLevel(average);

      // Map frequency data to bars with smoothing
      const step = Math.floor(bufferLength / barCount);
      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j];
        }
        const level = sum / step / 255;
        const minHeight = baseHeights[i] * 0.25;
        const maxHeight = baseHeights[i];
        const height = minHeight + level * (maxHeight - minHeight);
        bar.style.height = `${height}px`;
      });

      animationRef.current = requestAnimationFrame(updateBars);
    };

    updateBars();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, recordingState, setAudioLevel, baseHeights, barCount]);

  const isRecording = recordingState === 'recording';
  const isComplete = recordingState === 'complete';

  return (
    <div className="flex items-center justify-center gap-[3px] h-6">
      {Array.from({ length: barCount }).map((_, i) => (
        <motion.div
          key={i}
          ref={(el) => {
            if (el) barsRef.current[i] = el;
          }}
          className={`wave-bar ${isRecording ? 'recording' : ''} ${isComplete ? 'complete' : ''}`}
          initial={{ height: baseHeights[i] * 0.4 }}
          animate={
            !isRecording
              ? {
                  height: [
                    baseHeights[i] * 0.3,
                    baseHeights[i] * 0.5,
                    baseHeights[i] * 0.3,
                  ],
                }
              : undefined
          }
          transition={
            !isRecording
              ? {
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: animationDelays[i],
                }
              : { duration: 0.05 }
          }
          style={{
            originY: 0.5,
          }}
        />
      ))}
    </div>
  );
}

// Processing spinner
function ProcessingSpinner() {
  return (
    <svg
      className="spinner w-5 h-5"
      viewBox="0 0 20 20"
      fill="none"
      style={{ color: 'var(--wave-recording-2)' }}
    >
      <circle
        cx="10"
        cy="10"
        r="8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="32"
        strokeDashoffset="8"
        opacity="0.8"
      />
    </svg>
  );
}

// Success checkmark
function SuccessCheck() {
  return (
    <motion.svg
      viewBox="0 0 20 20"
      className="w-5 h-5"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
    >
      <motion.circle
        cx="10"
        cy="10"
        r="9"
        fill="none"
        stroke="var(--wave-complete)"
        strokeWidth="1.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3 }}
      />
      <motion.path
        d="M6 10l3 3 5-6"
        fill="none"
        stroke="var(--wave-complete)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      />
    </motion.svg>
  );
}

// Main voice bubble
interface VoiceBubbleProps {
  getAnalyser: () => AnalyserNode | null;
  isReady: boolean;
  isConnected: boolean;
  onHoldStart: () => void;
  onHoldEnd: () => void;
}

function VoiceBubble({ getAnalyser, isReady, isConnected, onHoldStart, onHoldEnd }: VoiceBubbleProps) {
  const { recordingState, partialTranscription, currentTranscription } = useAppStore();

  const displayText = currentTranscription || partialTranscription;
  const isRecording = recordingState === 'recording';
  const isProcessing = recordingState === 'processing';
  const isComplete = recordingState === 'complete';

  const statusText = isRecording
    ? 'Listening...'
    : isProcessing
      ? 'Transcribing...'
      : !isConnected
        ? 'Starting server...'
        : !isReady
          ? 'Loading model...'
          : 'Hold to talk';

  return (
    <motion.div
      className={`voice-bubble relative w-[300px] h-[64px] flex items-center px-4 gap-3 drag-region ${
        isRecording ? 'recording' : ''
      }`}
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 30,
      }}
    >
      {/* Waveform / Spinner / Checkmark */}
      <div className="flex-shrink-0 w-8 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {isProcessing ? (
            <motion.div
              key="spinner"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <ProcessingSpinner />
            </motion.div>
          ) : isComplete ? (
            <motion.div
              key="check"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <SuccessCheck />
            </motion.div>
          ) : (
            <motion.div
              key="wave"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <BreathingWaveform analyser={getAnalyser()} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {displayText ? (
            <motion.p
              key="text"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="text-[13px] font-medium truncate no-drag"
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-system)',
                letterSpacing: '-0.01em',
              }}
            >
              {displayText}
            </motion.p>
          ) : (
            <motion.p
              key="status"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="text-[13px]"
              style={{
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-system)',
                letterSpacing: '-0.01em',
              }}
            >
              {statusText}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Hold-to-talk button */}
      <div className="flex-shrink-0">
        <motion.button
          type="button"
          className={`hold-button no-drag ${isRecording ? 'recording' : ''} ${
            isProcessing ? 'processing' : ''
          }`}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            if (!isReady) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            onHoldStart();
          }}
          onPointerUp={() => onHoldEnd()}
          onPointerCancel={() => onHoldEnd()}
          disabled={!isReady && !isRecording}
          aria-pressed={isRecording}
          aria-label={isRecording ? 'Release to stop recording' : 'Hold to start recording'}
          whileTap={{ scale: 0.97 }}
        >
          <span className="hold-dot" />
          <span className="hold-label">{isRecording ? 'Release' : 'Hold'}</span>
        </motion.button>
      </div>

      {/* Keyboard hint badge */}
      <AnimatePresence>
        {(isRecording || isReady) && (
          <motion.div
            initial={{ opacity: 0, x: 4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 4 }}
            transition={{ delay: 0.2, duration: 0.2 }}
            className="flex-shrink-0"
          >
            <span className="kbd-badge no-drag">{isRecording ? 'release' : '⌥ Space'}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Main app
function App() {
  const { isDarkMode, setDarkMode } = useAppStore();
  const { getAnalyser, isReady, isConnected, startRecording, stopRecording } = useTranscription();

  // Check for settings route
  const isSettingsPage = window.location.pathname === '/settings';

  // System dark mode detection
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setDarkMode(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [setDarkMode]);

  if (isSettingsPage) {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <Settings />
      </div>
    );
  }

  // Always show bubble when window is visible (window is hidden when idle)
  // This ensures no white flash when transitioning states
  return (
    <div
      className={`h-full w-full flex items-center justify-center p-2 ${isDarkMode ? 'dark' : ''}`}
      style={{ background: isDarkMode ? '#1c1c1e' : '#f5f5f7' }}
    >
      <VoiceBubble
        getAnalyser={getAnalyser}
        isReady={isReady}
        isConnected={isConnected}
        onHoldStart={startRecording}
        onHoldEnd={stopRecording}
      />
    </div>
  );
}

export default App;
