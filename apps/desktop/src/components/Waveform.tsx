import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';

const BAR_COUNT = 15;
const MAX_HEIGHT = 20;
const MIN_HEIGHT = 3;
const MIN_SCALE = MIN_HEIGHT / MAX_HEIGHT;

const CENTER = Math.floor(BAR_COUNT / 2);

// Amplitude curve: center bars taller, edges smaller
const barHeights = Array.from({ length: BAR_COUNT }, (_, i) => {
  const distFromCenter = Math.abs(i - CENTER);
  const normalized = distFromCenter / CENTER;
  return Math.cos(normalized * Math.PI * 0.45); // Smooth bell curve
});

// Random offsets for each bar (seeded by position for consistency)
const barRandomOffsets = Array.from({ length: BAR_COUNT }, (_, i) => {
  const phi = 1.618033988749;
  return (i * phi) % 1 * Math.PI * 2; // Golden ratio based pseudo-random
});

interface WaveformProps {
  analyser: AnalyserNode | null;
}

/**
 * Simple voice-activated waveform.
 * Detects speaking (binary), then plays smooth left-to-right breathing animation.
 */
export function Waveform({ analyser }: WaveformProps) {
  const recordingState = useAppStore((state) => state.recordingState);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const animationRef = useRef<number | null>(null);
  const displayLevels = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const isSpeakingRef = useRef(0); // Smoothed 0-1 value
  const phaseRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);

  const isRecording = recordingState === 'recording';

  useEffect(() => {
    const dataArray = analyser ? new Uint8Array(analyser.fftSize) : null;
    lastTimeRef.current = null;

    const animate = (timestamp: number) => {
      const lastTime = lastTimeRef.current ?? timestamp;
      const dt = (timestamp - lastTime) / 1000; // Delta time in seconds
      lastTimeRef.current = timestamp;

      // Voice activity detection - simple threshold
      let isSpeaking = false;
      if (isRecording && analyser && dataArray) {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        isSpeaking = rms > 0.015; // Simple threshold
      }

      // Smooth the speaking state (fast on, slower off)
      const target = isSpeaking ? 1 : 0;
      const smoothSpeed = isSpeaking ? 12 : 6; // Fast attack, medium release
      isSpeakingRef.current += (target - isSpeakingRef.current) * Math.min(1, dt * smoothSpeed);

      // Advance phase for wave animation (faster speed)
      phaseRef.current += dt * 5.5;

      const speakingAmount = isSpeakingRef.current;
      const time = phaseRef.current;

      for (let i = 0; i < BAR_COUNT; i++) {
        const bar = barsRef.current[i];
        if (!bar) continue;

        // Primary left-to-right wave
        const waveOffset = (i / BAR_COUNT) * Math.PI * 2;
        const wave = Math.sin(time - waveOffset);

        // Secondary randomness wave (slower, per-bar offset)
        const randomWave = Math.sin(time * 0.7 + barRandomOffsets[i]) * 0.25;

        const waveNorm = (wave + 1) * 0.5; // 0 to 1

        // Combine: height curve * (wave + randomness) * speaking amount
        const height = barHeights[i] * (0.25 + (waveNorm + randomWave) * 0.7) * speakingAmount;

        // Smooth bar transitions
        displayLevels.current[i] += (height - displayLevels.current[i]) * Math.min(1, dt * 15);

        const scale = MIN_SCALE + displayLevels.current[i] * (1 - MIN_SCALE);
        bar.style.transform = `scaleY(${scale}) translateZ(0)`;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isRecording]);

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
