import { useAppStore } from '../stores/appStore';
import { ProcessingSpinner } from './ProcessingSpinner';
import { Waveform } from './Waveform';

interface VoicePillProps {
  analyser: AnalyserNode | null;
}

/**
 * Main voice recording pill UI.
 * Shows waveform during recording, spinner during processing.
 */
export function VoicePill({ analyser }: VoicePillProps) {
  const recordingState = useAppStore((state) => state.recordingState);
  const isProcessing = recordingState === 'processing';

  return (
    <div
      style={{
        width: 90,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        background: '#000',
      }}
    >
      {isProcessing ? <ProcessingSpinner /> : <Waveform analyser={analyser} />}
    </div>
  );
}
