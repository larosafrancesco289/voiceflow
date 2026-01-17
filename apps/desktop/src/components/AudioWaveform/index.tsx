import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../stores/appStore';

interface AudioWaveformProps {
  width?: number;
  height?: number;
  analyser?: AnalyserNode | null;
}

export function AudioWaveform({ width = 200, height = 48, analyser }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const historyRef = useRef<number[]>([]);
  const { recordingState, isDarkMode } = useAppStore();

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = width;
    const displayHeight = height;

    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const numBars = 32;
    const barWidth = 3;
    const gap = (displayWidth - numBars * barWidth) / (numBars - 1);
    const maxBarHeight = displayHeight * 0.8;
    const minBarHeight = 4;
    const centerY = displayHeight / 2;

    let frequencies: number[] = [];

    if (analyser && recordingState === 'recording') {
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      const step = Math.floor(bufferLength / numBars);
      for (let i = 0; i < numBars; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j];
        }
        frequencies.push(sum / step / 255);
      }

      historyRef.current = frequencies;
    } else if (historyRef.current.length > 0 && recordingState === 'processing') {
      frequencies = historyRef.current.map((v) => v * 0.5);
    } else {
      frequencies = Array(numBars).fill(0);
      historyRef.current = [];
    }

    // Define gradient colors based on recording state
    const gradientColors = {
      idle: {
        start: isDarkMode ? 'rgba(100, 116, 139, 0.3)' : 'rgba(148, 163, 184, 0.4)',
        end: isDarkMode ? 'rgba(71, 85, 105, 0.2)' : 'rgba(203, 213, 225, 0.3)',
      },
      recording: {
        start: 'rgba(244, 114, 182, 0.9)',
        mid: 'rgba(168, 85, 247, 0.85)',
        end: 'rgba(96, 165, 250, 0.8)',
      },
      processing: {
        start: 'rgba(167, 139, 250, 0.6)',
        end: 'rgba(129, 140, 248, 0.5)',
      },
      complete: {
        start: 'rgba(52, 211, 153, 0.8)',
        end: 'rgba(16, 185, 129, 0.7)',
      },
    };

    const colors = gradientColors[recordingState];

    frequencies.forEach((value, i) => {
      const x = i * (barWidth + gap);
      const normalizedHeight = minBarHeight + value * (maxBarHeight - minBarHeight);
      const halfHeight = normalizedHeight / 2;

      // Create gradient for each bar
      const gradient = ctx.createLinearGradient(x, centerY - halfHeight, x, centerY + halfHeight);

      if (recordingState === 'recording' && 'mid' in colors) {
        gradient.addColorStop(0, colors.start);
        gradient.addColorStop(0.5, colors.mid);
        gradient.addColorStop(1, colors.end);
      } else {
        gradient.addColorStop(0, colors.start);
        gradient.addColorStop(1, colors.end);
      }

      // Draw glow effect for recording state
      if (recordingState === 'recording' && value > 0.1) {
        ctx.save();
        ctx.shadowColor = 'rgba(168, 85, 247, 0.5)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, centerY - halfHeight, barWidth, normalizedHeight, barWidth / 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw main bar
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, centerY - halfHeight, barWidth, normalizedHeight, barWidth / 2);
      ctx.fill();
    });

    animationRef.current = requestAnimationFrame(drawWaveform);
  }, [width, height, analyser, recordingState, isDarkMode]);

  useEffect(() => {
    drawWaveform();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawWaveform]);

  return (
    <canvas
      ref={canvasRef}
      className="block"
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
    />
  );
}
