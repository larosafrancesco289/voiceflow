import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../../stores/appStore';

type Step = 'welcome' | 'how-to-use' | 'permissions';

const STEPS: Step[] = ['welcome', 'how-to-use', 'permissions'];

function WelcomeStep() {
  return (
    <div className="flex flex-col items-center text-center">
      {/* App icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-6 shadow-lg shadow-violet-500/25"
      >
        <svg
          className="w-10 h-10 text-white"
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
      </motion.div>

      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-2xl font-semibold text-white tracking-tight mb-2"
      >
        VoiceFlow
      </motion.h1>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
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

function HowToUseStep() {
  return (
    <div className="flex flex-col items-center text-center">
      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-xl font-semibold text-white tracking-tight mb-6"
      >
        How to Use
      </motion.h2>

      {/* Keyboard shortcut demonstration */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex items-center gap-2 mb-6"
      >
        <span className="px-4 py-2.5 rounded-lg text-base font-medium bg-white/10 text-white border border-white/10 shadow-lg">
          ⌥ Option
        </span>
        <span className="text-white/30 text-lg">+</span>
        <span className="px-4 py-2.5 rounded-lg text-base font-medium bg-white/10 text-white border border-white/10 shadow-lg">
          Space
        </span>
      </motion.div>

      {/* Instructions */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="space-y-3 text-left w-full max-w-[280px]"
      >
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-xs font-medium text-violet-400">1</span>
          </div>
          <p className="text-sm text-white/70">
            <span className="text-white/90 font-medium">Hold</span> the shortcut to start recording
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-xs font-medium text-violet-400">2</span>
          </div>
          <p className="text-sm text-white/70">
            <span className="text-white/90 font-medium">Speak</span> naturally into your microphone
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-xs font-medium text-violet-400">3</span>
          </div>
          <p className="text-sm text-white/70">
            <span className="text-white/90 font-medium">Release</span> to transcribe and auto-paste
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function PermissionsStep({ onComplete }: { onComplete: () => void }) {
  const [micGranted, setMicGranted] = useState<boolean | null>(null);

  const requestMicrophone = async () => {
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
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-xl font-semibold text-white tracking-tight mb-2"
      >
        Microphone Access
      </motion.h2>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-white/50 text-sm mb-6 max-w-[260px]"
      >
        VoiceFlow needs microphone access to transcribe your speech.
      </motion.p>

      {/* Permission status */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
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

      {/* Privacy note */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
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

      {/* Get started button */}
      {micGranted !== null && (
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          onClick={onComplete}
          className="mt-6 py-2.5 px-8 rounded-full bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors"
        >
          Get Started
        </motion.button>
      )}
    </div>
  );
}

function ProgressDots({ currentStep, steps }: { currentStep: number; steps: Step[] }) {
  return (
    <div className="flex gap-2">
      {steps.map((_, index) => (
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

export function Onboarding() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const setOnboardingCompleted = useAppStore((state) => state.setOnboardingCompleted);
  const currentStep = STEPS[currentStepIndex];

  // Resize window to onboarding size and show it on mount
  useEffect(() => {
    const setupWindow = async () => {
      await invoke('resize_main_window', { width: 400, height: 500, centered: true });
      await invoke('show_bubble');
    };
    setupWindow();
  }, []);

  const handleNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleComplete = async () => {
    // Resize back to bubble size
    await invoke('resize_main_window', { width: 90, height: 36, centered: false });
    setOnboardingCompleted(true);
  };

  const isLastStep = currentStepIndex === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8 font-sans">
      {/* Content area */}
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
            {currentStep === 'welcome' && <WelcomeStep />}
            {currentStep === 'how-to-use' && <HowToUseStep />}
            {currentStep === 'permissions' && <PermissionsStep onComplete={handleComplete} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex flex-col items-center gap-6">
        <ProgressDots currentStep={currentStepIndex} steps={STEPS} />

        {!isLastStep && (
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
