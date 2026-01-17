import { useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../stores/appStore';

const BAR_COUNT = 15;
const MAX_HEIGHT = 20;
const MIN_HEIGHT = 3;
const MIN_SCALE = MIN_HEIGHT / MAX_HEIGHT;
const NOISE_FLOOR = 0.02;
const AUDIO_SMOOTH_MS = 50;
const ATTACK_MS = 40;
const RELEASE_MS = 120;
const IDLE_SMOOTH_MS = 180;

// Center-out mapping: index 7 is center, bars mirror outward
const CENTER = Math.floor(BAR_COUNT / 2);
const centerOutOrder = Array.from({ length: BAR_COUNT }, (_, displayIdx) => {
  const distFromCenter = Math.abs(displayIdx - CENTER);
  return CENTER - distFromCenter;
});

interface WaveformProps {
  analyser: AnalyserNode | null;
}

/**
 * Smooth waveform visualization with audio-aware smoothing + GPU-friendly transforms.
 * Shows audio reactivity during recording, idle breathing animation otherwise.
 */
export function Waveform({ analyser }: WaveformProps) {
  const recordingState = useAppStore((state) => state.recordingState);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const animationRef = useRef<number | null>(null);
  const smoothedLevels = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const displayLevels = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const lastTimeRef = useRef<number | null>(null);

  const isRecording = recordingState === 'recording';

  // Memoize segment ranges to avoid recalculating on every frame
  const segmentRanges = useMemo(() => {
    if (!analyser) return null;
    const binCount = analyser.frequencyBinCount;
    const voiceStart = Math.floor(binCount * 0.01);
    const voiceEnd = Math.floor(binCount * 0.25);
    const voiceRange = voiceEnd - voiceStart;
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const segmentStart = voiceStart + Math.floor((i / BAR_COUNT) * voiceRange);
      const segmentEnd = voiceStart + Math.floor(((i + 1) / BAR_COUNT) * voiceRange);
      return [segmentStart, segmentEnd] as const;
    });
  }, [analyser]);

  useEffect(() => {
    let startTime: number | null = null;
    lastTimeRef.current = null;
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

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

        for (let i = 0; i < BAR_COUNT; i++) {
          const [segmentStart, segmentEnd] = segmentRanges[i];
          let sum = 0;
          for (let j = segmentStart; j < segmentEnd; j++) {
            sum += dataArray[j];
          }

          const avg = sum / Math.max(1, segmentEnd - segmentStart);
          const rawLevel = avg / 255;
          const gated = Math.max(0, rawLevel - NOISE_FLOOR) / (1 - NOISE_FLOOR);
          const shaped = Math.pow(gated, 0.7);

          smoothedLevels.current[i] += (shaped - smoothedLevels.current[i]) * audioSmooth;
        }

        // Calculate target scales with center-out display mapping
        for (let i = 0; i < BAR_COUNT; i++) {
          const level = smoothedLevels.current[i];
          const response = level > displayLevels.current[i] ? attack : release;
          displayLevels.current[i] += (level - displayLevels.current[i]) * response;
        }

        // Apply to bars using center-out mapping
        for (let displayIdx = 0; displayIdx < BAR_COUNT; displayIdx++) {
          const freqIdx = centerOutOrder[displayIdx];
          const bar = barsRef.current[displayIdx];
          if (bar) {
            const scale = MIN_SCALE + displayLevels.current[freqIdx] * (1 - MIN_SCALE);
            bar.style.transform = `scaleY(${scale}) translateZ(0)`;
          }
        }
      } else {
        // Idle breathing animation - symmetric from center
        const phase = (elapsed / 2500) * Math.PI * 2;

        for (let displayIdx = 0; displayIdx < BAR_COUNT; displayIdx++) {
          const distFromCenter = Math.abs(displayIdx - CENTER);
          const offset = distFromCenter * 0.3;
          const wave = Math.sin(phase - offset) * 0.5 + 0.5;
          const centerFactor = 1 - (distFromCenter / CENTER) * 0.5;
          const targetLevel = wave * 0.4 * centerFactor;
          displayLevels.current[displayIdx] += (targetLevel - displayLevels.current[displayIdx]) * idleSmooth;

          const bar = barsRef.current[displayIdx];
          if (bar) {
            const scale = MIN_SCALE + displayLevels.current[displayIdx] * (1 - MIN_SCALE);
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
  }, [analyser, isRecording, segmentRanges]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        height: MAX_HEIGHT,
      }}
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            barsRef.current[i] = el;
          }}
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
