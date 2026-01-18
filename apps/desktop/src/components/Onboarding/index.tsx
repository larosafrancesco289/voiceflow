import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore, HotkeyConfig } from '../../stores/appStore';
import { getModifierDisplay } from '../../utils/modifierSymbols';
import { ModelLoading } from '../ModelLoading';

type Step = 'welcome' | 'how-to-use' | 'permissions' | 'model-setup';

const STEPS: Step[] = ['welcome', 'how-to-use', 'permissions', 'model-setup'];

const FADE_IN_Y = { initial: { y: 20, opacity: 0 }, animate: { y: 0, opacity: 1 } };
const FADE_IN_SCALE = { initial: { scale: 0.8, opacity: 0 }, animate: { scale: 1, opacity: 1 } };

function WelcomeStep(): React.ReactNode {
  return (
    <div className="flex flex-col items-center text-center">
      <motion.div
        {...FADE_IN_SCALE}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-6 shadow-lg shadow-violet-500/25"
      >
        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
      </motion.div>

      <motion.h1
        {...FADE_IN_Y}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-2xl font-semibold text-white tracking-tight mb-2"
      >
        VoiceFlow
      </motion.h1>

      <motion.p
        {...FADE_IN_Y}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="text-white/50 text-sm leading-relaxed max-w-[260px]"
      >
        Local speech-to-text for macOS.
        <br />
        Fast, private, and always available.
      </motion.p>
    </div>
  );
}

interface HowToUseStepProps {
  hotkey: HotkeyConfig;
}

const INSTRUCTIONS = [
  { action: 'Hold', description: 'the shortcut to start recording' },
  { action: 'Speak', description: 'naturally into your microphone' },
  { action: 'Release', description: 'to transcribe and auto-paste' },
];

function HowToUseStep({ hotkey }: HowToUseStepProps): React.ReactNode {
  const modifierDisplays = getModifierDisplay(hotkey.modifiers);

  return (
    <div className="flex flex-col items-center text-center">
      <motion.h2
        {...FADE_IN_Y}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-xl font-semibold text-white tracking-tight mb-6"
      >
        How to Use
      </motion.h2>

      <motion.div
        {...FADE_IN_Y}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex items-center gap-2 mb-6"
      >
        {modifierDisplays.map((mod, i) => (
          <span
            key={i}
            className="px-4 py-2.5 rounded-lg text-base font-medium bg-white/10 text-white border border-white/10 shadow-lg"
          >
            {mod.symbol} {mod.label}
          </span>
        ))}
        {modifierDisplays.length > 0 && <span className="text-white/30 text-lg">+</span>}
        <span className="px-4 py-2.5 rounded-lg text-base font-medium bg-white/10 text-white border border-white/10 shadow-lg">
          {hotkey.key}
        </span>
      </motion.div>

      <motion.div
        {...FADE_IN_Y}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="space-y-3 text-left w-full max-w-[280px]"
      >
        {INSTRUCTIONS.map((item, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-medium text-violet-400">{index + 1}</span>
            </div>
            <p className="text-sm text-white/70">
              <span className="text-white/90 font-medium">{item.action}</span> {item.description}
            </p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

interface PermissionsStepProps {
  onContinue: () => void;
}

function PermissionsStep({ onContinue }: PermissionsStepProps): React.ReactNode {
  const [micGranted, setMicGranted] = useState<boolean | null>(null);

  const requestMicrophone = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicGranted(true);
    } catch {
      setMicGranted(false);
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      <motion.h2
        {...FADE_IN_Y}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-xl font-semibold text-white tracking-tight mb-2"
      >
        Microphone Access
      </motion.h2>

      <motion.p
        {...FADE_IN_Y}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-white/50 text-sm mb-6 max-w-[260px]"
      >
        VoiceFlow needs microphone access to transcribe your speech.
      </motion.p>

      <motion.div
        {...FADE_IN_Y}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="w-full max-w-[280px] mb-6"
      >
        {micGranted === null && (
          <button
            onClick={requestMicrophone}
            className="w-full py-3 px-4 rounded-xl bg-violet-500 hover:bg-violet-400 text-white font-medium text-sm transition-colors"
          >
            Grant Microphone Access
          </button>
        )}

        {micGranted === true && (
          <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-emerald-400">Microphone enabled</span>
          </div>
        )}

        {micGranted === false && (
          <div className="py-3 px-4 rounded-xl bg-amber-500/20 border border-amber-500/30">
            <p className="text-sm text-amber-400 mb-2">Access denied</p>
            <p className="text-xs text-white/40">
              Open System Settings → Privacy & Security → Microphone to enable access.
            </p>
          </div>
        )}
      </motion.div>

      <motion.div
        {...FADE_IN_Y}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5 max-w-[280px]"
      >
        <svg className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-xs text-white/50 text-left leading-relaxed">
          <span className="text-white/70 font-medium">100% local processing.</span>
          {' '}Audio never leaves your Mac. No cloud, no data collection.
        </p>
      </motion.div>

      {micGranted !== null && (
        <motion.button
          {...FADE_IN_Y}
          transition={{ duration: 0.3, delay: 0.2 }}
          onClick={onContinue}
          className="mt-6 py-2.5 px-8 rounded-full bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors"
        >
          Continue
        </motion.button>
      )}
    </div>
  );
}

interface ModelSetupStepProps {
  isReady: boolean;
  onStartServer: () => void;
  onComplete: () => void;
}

function ModelSetupStep({ isReady, onStartServer, onComplete }: ModelSetupStepProps): React.ReactNode {
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    onStartServer();
  }, [onStartServer]);

  const title = isReady ? 'Ready to Go' : 'Setting Up';
  const description = isReady
    ? 'The speech recognition model is loaded and ready.'
    : 'Preparing the speech recognition model for first use.';

  return (
    <div className="flex flex-col items-center text-center">
      <motion.h2
        {...FADE_IN_Y}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-xl font-semibold text-white tracking-tight mb-2"
      >
        {title}
      </motion.h2>

      <motion.p
        {...FADE_IN_Y}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-white/50 text-sm mb-6 max-w-[260px]"
      >
        {description}
      </motion.p>

      <motion.div
        {...FADE_IN_Y}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="w-full max-w-[280px] mb-6"
      >
        {isReady ? (
          <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-emerald-400">Model ready</span>
          </div>
        ) : (
          <ModelLoading variant="full" />
        )}
      </motion.div>

      {isReady && (
        <motion.button
          {...FADE_IN_Y}
          transition={{ duration: 0.3, delay: 0.2 }}
          onClick={onComplete}
          className="py-2.5 px-8 rounded-full bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors"
        >
          Get Started
        </motion.button>
      )}
    </div>
  );
}

interface ProgressDotsProps {
  currentStep: number;
  totalSteps: number;
}

function ProgressDots({ currentStep, totalSteps }: ProgressDotsProps): React.ReactNode {
  return (
    <div className="flex gap-2">
      {Array.from({ length: totalSteps }, (_, index) => (
        <motion.div
          key={index}
          className="h-1.5 rounded-full"
          initial={false}
          animate={{
            width: index === currentStep ? 24 : 6,
            backgroundColor: index === currentStep ? 'rgba(139, 92, 246, 1)' : 'rgba(255, 255, 255, 0.2)',
          }}
          transition={{ duration: 0.3 }}
        />
      ))}
    </div>
  );
}

interface OnboardingProps {
  isReady: boolean;
  onStartServer: () => void;
}

export function Onboarding({ isReady, onStartServer }: OnboardingProps): React.ReactNode {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const setOnboardingCompleted = useAppStore((state) => state.setOnboardingCompleted);
  const hotkey = useAppStore((state) => state.hotkey);
  const currentStep = STEPS[currentStepIndex];

  useEffect(() => {
    const setupWindow = async (): Promise<void> => {
      await invoke('resize_main_window', { width: 400, height: 500, centered: true });
      await invoke('show_bubble');
    };
    setupWindow();
  }, []);

  const handleNext = (): void => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleComplete = async (): Promise<void> => {
    await invoke('resize_main_window', { width: 90, height: 36, centered: false });
    await invoke('hide_bubble');
    await invoke('show_main_app');
    setOnboardingCompleted(true);
  };

  const showContinueButton = currentStep === 'welcome' || currentStep === 'how-to-use';

  function renderStepContent(): React.ReactNode {
    switch (currentStep) {
      case 'welcome':
        return <WelcomeStep />;
      case 'how-to-use':
        return <HowToUseStep hotkey={hotkey} />;
      case 'permissions':
        return <PermissionsStep onContinue={handleNext} />;
      case 'model-setup':
        return (
          <ModelSetupStep
            isReady={isReady}
            onStartServer={onStartServer}
            onComplete={handleComplete}
          />
        );
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8 font-sans">
      <div className="flex-1 flex items-center justify-center w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm"
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-col items-center gap-6">
        <ProgressDots currentStep={currentStepIndex} totalSteps={STEPS.length} />

        {showContinueButton && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={handleNext}
            className="py-2.5 px-8 rounded-full bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors"
          >
            Continue
          </motion.button>
        )}
      </div>
    </div>
  );
}
