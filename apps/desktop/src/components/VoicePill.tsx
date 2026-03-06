import { invoke, isTauri } from '@tauri-apps/api/core';
import { useAppStore } from '../stores/appStore';
import { ModelLoading } from './ModelLoading';
import { ProcessingSpinner } from './ProcessingSpinner';
import { Waveform } from './Waveform';

interface VoicePillProps {
  analyser: AnalyserNode | null;
}

function PillContent({ analyser }: VoicePillProps): React.ReactNode {
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

export function VoicePill({ analyser }: VoicePillProps): React.ReactNode {
  const handleClick = (): void => {
    if (isTauri()) {
      void invoke('show_main_app');
    }
  };

  return (
    <button
      type="button"
      aria-label="Open VoiceFlow"
      className="w-[90px] h-7 flex items-center justify-center rounded-full bg-black cursor-pointer"
      onClick={handleClick}
    >
      <PillContent analyser={analyser} />
    </button>
  );
}
