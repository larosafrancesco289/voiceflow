import { motion } from 'framer-motion';
import { useAppStore, ModelLoadingState } from '../../stores/appStore';

interface ModelLoadingProps {
  variant?: 'pill' | 'full';
}

function LoadingIcon() {
  return (
    <svg
      className="w-4 h-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function getStageLabel(stage: ModelLoadingState['stage']): string {
  switch (stage) {
    case 'downloading':
      return 'Downloading';
    case 'loading':
      return 'Loading';
    case 'warmup':
      return 'Warming up';
    case 'error':
      return 'Error';
    default:
      return 'Preparing';
  }
}

export function ModelLoading({ variant = 'full' }: ModelLoadingProps) {
  const modelLoadingState = useAppStore((state) => state.modelLoadingState);

  if (!modelLoadingState.isLoading) {
    return null;
  }

  if (variant === 'pill') {
    return (
      <div className="flex items-center gap-2 text-white/60">
        <LoadingIcon />
        <span className="text-xs truncate max-w-[60px]">
          {getStageLabel(modelLoadingState.stage)}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4 p-6"
    >
      <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center">
        <LoadingIcon />
      </div>

      <div className="text-center">
        <p className="text-sm font-medium text-white/90">
          {getStageLabel(modelLoadingState.stage)}
        </p>
        <p className="text-xs text-white/50 mt-1 max-w-[240px]">
          {modelLoadingState.message}
        </p>
      </div>

      {modelLoadingState.progress > 0 && modelLoadingState.progress < 1 && (
        <div className="w-full max-w-[200px]">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-violet-500"
              initial={{ width: 0 }}
              animate={{ width: `${modelLoadingState.progress * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-[10px] text-white/30 text-center mt-1">
            {Math.round(modelLoadingState.progress * 100)}%
          </p>
        </div>
      )}

      {modelLoadingState.stage === 'downloading' && (
        <p className="text-[10px] text-white/30 text-center max-w-[200px]">
          First-time setup: downloading speech recognition model (~600MB)
        </p>
      )}
    </motion.div>
  );
}
