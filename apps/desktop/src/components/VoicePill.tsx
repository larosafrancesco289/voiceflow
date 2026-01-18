import { useAppStore } from '../stores/appStore';
import { ProcessingSpinner } from './ProcessingSpinner';
import { Waveform } from './Waveform';

interface VoicePillProps {
  analyser: AnalyserNode | null;
}

export function VoicePill({ analyser }: VoicePillProps) {
  const recordingState = useAppStore((state) => state.recordingState);
  const isProcessing = recordingState === 'processing';

  return (
    <div className="w-[90px] h-7 flex items-center justify-center rounded-full bg-black">
      {isProcessing ? <ProcessingSpinner /> : <Waveform analyser={analyser} />}
    </div>
  );
}
