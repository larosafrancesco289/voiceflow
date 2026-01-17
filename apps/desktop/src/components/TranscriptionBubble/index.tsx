import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../stores/appStore';
import { useTranscription } from '../../hooks/useTranscription';
import { PulsingOrb } from '../PulsingOrb';
import { AudioWaveform } from '../AudioWaveform';

export function TranscriptionBubble() {
  const { recordingState, partialTranscription, currentTranscription, isDarkMode } = useAppStore();
  const { getAnalyser } = useTranscription();

  const displayText = currentTranscription || partialTranscription;

  const stateLabels = {
    idle: '',
    recording: 'Listening...',
    processing: 'Transcribing...',
    complete: 'Done!',
  };

  return (
    <div className={`w-full h-full ${isDarkMode ? 'dark' : ''}`}>
      <motion.div
        className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl"
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      >
        {/* Glass background */}
        <div
          className="absolute inset-0 glass-morphism"
          style={{
            borderRadius: '16px',
            border: isDarkMode
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(255, 255, 255, 0.5)',
            boxShadow: isDarkMode
              ? '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
              : '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center px-6 py-4 w-full">
          <div className="flex items-center gap-4 w-full">
            {/* Orb */}
            <PulsingOrb size={56} />

            {/* Text content */}
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                {displayText ? (
                  <motion.p
                    key="transcription"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className={`text-sm font-medium leading-snug truncate ${
                      isDarkMode ? 'text-white/90' : 'text-gray-800'
                    }`}
                    style={{
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
                      fontWeight: 500,
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
                    className={`text-sm ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}
                    style={{
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
                      fontWeight: 400,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {stateLabels[recordingState]}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Waveform */}
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{
                  opacity: recordingState === 'recording' || recordingState === 'processing' ? 1 : 0,
                  height: recordingState === 'recording' || recordingState === 'processing' ? 40 : 0,
                }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="overflow-hidden mt-2"
              >
                <AudioWaveform width={180} height={36} analyser={getAnalyser()} />
              </motion.div>
            </div>
          </div>

          {/* Keyboard hint */}
          <AnimatePresence>
            {recordingState === 'recording' && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ delay: 0.5, duration: 0.3 }}
                className="absolute bottom-2 right-3"
              >
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    isDarkMode
                      ? 'bg-white/10 text-white/40'
                      : 'bg-black/5 text-gray-400'
                  }`}
                  style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                    fontWeight: 500,
                  }}
                >
                  Release to stop
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Subtle gradient overlay for depth */}
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{
            background: isDarkMode
              ? 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%, rgba(0,0,0,0.1) 100%)'
              : 'linear-gradient(180deg, rgba(255,255,255,0.5) 0%, transparent 40%, rgba(0,0,0,0.02) 100%)',
          }}
        />
      </motion.div>
    </div>
  );
}
