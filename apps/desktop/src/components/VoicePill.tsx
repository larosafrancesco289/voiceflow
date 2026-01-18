import { useAppStore } from '../stores/appStore';
import { ProcessingSpinner } from './ProcessingSpinner';
import { Waveform } from './Waveform';
import { ModelLoading } from './ModelLoading';

interface VoicePillProps {
  analyser: AnalyserNode | null;
}

function PillContent({ analyser }: { analyser: AnalyserNode | null }): React.ReactNode {
  const recordingState = useAppStore((state) => state.recordingState);
  const modelLoadingState = useAppStore((state) => state.modelLoadingState);

  if (modelLoadingState.isLoading) {
    return <ModelLoading variant="pill" />;
  }

  if (recordingState === 'processing') {
    return <ProcessingSpinner />;
  }

  return <Waveform analyser={analyser} />;
}

export function VoicePill({ analyser }: VoicePillProps) {
  return (
    <div className="w-[90px] h-7 flex items-center justify-center rounded-full bg-black">
      <PillContent analyser={analyser} />
    </div>
  );
}
