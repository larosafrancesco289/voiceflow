import { useEffect, useRef } from 'react';
import { useAppStore } from './stores/appStore';
import { useTranscription } from './hooks/useTranscription';
import { Settings } from './components/Settings';

// Processing spinner - thin rotating arc that matches the minimal aesthetic
function ProcessingSpinner() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 20,
      height: 20,
    }}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        style={{
          animation: 'spin 1s linear infinite',
        }}
      >
        <circle
          cx="9"
          cy="9"
          r="7"
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="2"
        />
        <path
          d="M 9 2 A 7 7 0 0 1 16 9"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Smooth waveform with audio-aware smoothing + GPU-friendly transforms
const BAR_COUNT = 15;
const MAX_HEIGHT = 20; // Must fit inside 28px pill
const MIN_HEIGHT = 3;
const MIN_SCALE = MIN_HEIGHT / MAX_HEIGHT;
const NOISE_FLOOR = 0.03; // Gate tiny jitters
const AUDIO_SMOOTH_MS = 90;
const ATTACK_MS = 70;
const RELEASE_MS = 160;
const IDLE_SMOOTH_MS = 220;

function Waveform({ analyser }: { analyser: AnalyserNode | null }) {
  const recordingState = useAppStore((state) => state.recordingState);
  const setAudioLevel = useAppStore((state) => state.setAudioLevel);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const animationRef = useRef<number | null>(null);

  // Double smoothing: smooth the audio levels, then smooth the visual heights
  const smoothedLevels = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const displayLevels = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const audioLevelRef = useRef(0);
  const frameCount = useRef(0);
  const lastTimeRef = useRef<number | null>(null);

  const isRecording = recordingState === 'recording';

  useEffect(() => {
    let startTime: number | null = null;
    lastTimeRef.current = null;
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    const segmentRanges = analyser
      ? Array.from({ length: BAR_COUNT }, (_, i) => {
          const binCount = analyser.frequencyBinCount;
          const voiceStart = Math.floor(binCount * 0.01);
          const voiceEnd = Math.floor(binCount * 0.25);
          const voiceRange = voiceEnd - voiceStart;
          const segmentStart = voiceStart + Math.floor((i / BAR_COUNT) * voiceRange);
          const segmentEnd = voiceStart + Math.floor(((i + 1) / BAR_COUNT) * voiceRange);
          return [segmentStart, segmentEnd];
        })
      : null;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const lastTime = lastTimeRef.current ?? timestamp;
      const dt = Math.min(64, Math.max(0, timestamp - lastTime));
      lastTimeRef.current = timestamp;
      const smoothingForMs = (ms: number) => 1 - Math.exp(-dt / ms);
      const audioSmooth = smoothingForMs(AUDIO_SMOOTH_MS);
      const attack = smoothingForMs(ATTACK_MS);
      const release = smoothingForMs(RELEASE_MS);
      const idleSmooth = smoothingForMs(IDLE_SMOOTH_MS);

      if (isRecording && analyser && dataArray && segmentRanges) {
        // Audio-reactive mode
        analyser.getByteFrequencyData(dataArray);

        let totalLevel = 0;

        for (let i = 0; i < BAR_COUNT; i++) {
          const [segmentStart, segmentEnd] = segmentRanges[i];
          let sum = 0;
          for (let j = segmentStart; j < segmentEnd; j++) {
            sum += dataArray[j];
          }

          const avg = sum / Math.max(1, segmentEnd - segmentStart);
          const rawLevel = avg / 255;
          totalLevel += rawLevel;

          const gated = Math.max(0, rawLevel - NOISE_FLOOR) / (1 - NOISE_FLOOR);
          const shaped = Math.pow(gated, 0.7);

          // First smoothing layer: smooth the raw audio levels (removes trembling)
          smoothedLevels.current[i] += (shaped - smoothedLevels.current[i]) * audioSmooth;
        }

        // Calculate target scales
        for (let i = 0; i < BAR_COUNT; i++) {
          const level = smoothedLevels.current[i];
          const response = level > displayLevels.current[i] ? attack : release;
          displayLevels.current[i] += (level - displayLevels.current[i]) * response;

          const bar = barsRef.current[i];
          if (bar) {
            const scale = MIN_SCALE + displayLevels.current[i] * (1 - MIN_SCALE);
            bar.style.transform = `scaleY(${scale}) translateZ(0)`;
          }
        }

        // Update audio level store (throttled)
        frameCount.current++;
        if (frameCount.current % 4 === 0) {
          const avgLevel = totalLevel / BAR_COUNT;
          if (Math.abs(avgLevel - audioLevelRef.current) > 0.03) {
            audioLevelRef.current = avgLevel;
            setAudioLevel(avgLevel);
          }
        }
      } else {
        // Idle breathing animation
        for (let i = 0; i < BAR_COUNT; i++) {
          const phase = (elapsed / 3000) * Math.PI * 2; // 3 second cycle
          const offset = i * 0.2;
          const wave = Math.sin(phase + offset) * 0.5 + 0.5;

          // Gentle breathing between MIN_SCALE and 40% of max
          const targetLevel = wave * 0.4;
          displayLevels.current[i] += (targetLevel - displayLevels.current[i]) * idleSmooth;

          const bar = barsRef.current[i];
          if (bar) {
            const scale = MIN_SCALE + displayLevels.current[i] * (1 - MIN_SCALE);
            bar.style.transform = `scaleY(${scale}) translateZ(0)`;
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isRecording, setAudioLevel]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      height: MAX_HEIGHT
    }}>
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          ref={el => { barsRef.current[i] = el; }}
          style={{
            width: 2,
            height: MAX_HEIGHT,
            borderRadius: 1,
            backgroundColor: '#fff',
            transform: `scaleY(${MIN_SCALE}) translateZ(0)`,
            transformOrigin: 'center center',
            willChange: 'transform',
          }}
        />
      ))}
    </div>
  );
}

// Voice pill
function VoicePill({ analyser }: { analyser: AnalyserNode | null }) {
  const recordingState = useAppStore((state) => state.recordingState);
  const isProcessing = recordingState === 'processing';

  return (
    <div style={{
      width: 90,
      height: 28,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      background: '#000',
    }}>
      {isProcessing ? <ProcessingSpinner /> : <Waveform analyser={analyser} />}
    </div>
  );
}

// Main app
function App() {
  const setDarkMode = useAppStore((state) => state.setDarkMode);
  const { analyser } = useTranscription();
  const isSettingsPage = window.location.pathname === '/settings';

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(mq.matches);
    const handler = (e: MediaQueryListEvent) => setDarkMode(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [setDarkMode]);

  if (isSettingsPage) {
    return <div className="settings-page min-h-screen"><Settings /></div>;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <VoicePill analyser={analyser} />
    </div>
  );
}

export default App;
