import { useEffect, useRef, useMemo } from 'react';
import { useAppStore } from './stores/appStore';
import { useTranscription } from './hooks/useTranscription';
import { Settings } from './components/Settings';

// Waveform with pure DOM animation
function Waveform({ analyser }: { analyser: AnalyserNode | null }) {
  const { recordingState, setAudioLevel } = useAppStore();
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const animationRef = useRef<number | null>(null);
  const breathingRef = useRef<number | null>(null);

  const baseHeights = useMemo(() => [8, 12, 16, 12, 8], []);
  const isRecording = recordingState === 'recording';

  // Breathing animation (idle)
  useEffect(() => {
    if (isRecording) {
      if (breathingRef.current) cancelAnimationFrame(breathingRef.current);
      return;
    }

    let startTime: number | null = null;

    const breathe = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        const delay = i * 100;
        const t = ((elapsed + delay) % 1000) / 1000;
        const ease = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
        const h = baseHeights[i] * (0.3 + ease * 0.55);
        bar.style.height = `${h}px`;
      });

      breathingRef.current = requestAnimationFrame(breathe);
    };

    breathingRef.current = requestAnimationFrame(breathe);
    return () => {
      if (breathingRef.current) cancelAnimationFrame(breathingRef.current);
    };
  }, [isRecording, baseHeights]);

  // Audio-reactive (recording)
  useEffect(() => {
    if (!analyser || !isRecording) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const step = Math.floor(analyser.frequencyBinCount / 5);

    const update = () => {
      analyser.getByteFrequencyData(dataArray);

      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
      setAudioLevel(avg);

      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j];
        }
        const level = sum / step / 255;
        const h = baseHeights[i] * (0.2 + level * 0.8);
        bar.style.height = `${h}px`;
      });

      animationRef.current = requestAnimationFrame(update);
    };

    animationRef.current = requestAnimationFrame(update);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, isRecording, setAudioLevel, baseHeights]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height: '100%' }}>
      {baseHeights.map((h, i) => (
        <div
          key={i}
          ref={el => { barsRef.current[i] = el; }}
          style={{
            width: 3,
            height: h * 0.4,
            borderRadius: 1.5,
            backgroundColor: '#fff',
            willChange: 'height',
          }}
        />
      ))}
    </div>
  );
}

// Voice pill
function VoicePill({ analyser }: { analyser: AnalyserNode | null }) {
  return (
    <div style={{
      width: 72,
      height: 28,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      background: '#000',
    }}>
      <Waveform analyser={analyser} />
    </div>
  );
}

// Main app
function App() {
  const { isDarkMode, setDarkMode } = useAppStore();
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
