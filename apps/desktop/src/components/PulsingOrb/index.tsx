import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import { useAppStore, RecordingState } from '../../stores/appStore';

interface PulsingOrbProps {
  size?: number;
}

export function PulsingOrb({ size = 64 }: PulsingOrbProps) {
  const { audioLevel, recordingState } = useAppStore();

  const springConfig = { stiffness: 500, damping: 30, mass: 0.5 };
  const audioSpring = useSpring(0, springConfig);

  useEffect(() => {
    audioSpring.set(audioLevel);
  }, [audioLevel, audioSpring]);

  const scale = useTransform(audioSpring, [0, 1], [1, 1.35]);
  const innerScale = useTransform(audioSpring, [0, 1], [0.6, 0.85]);

  const stateConfig = useMemo(() => {
    const configs: Record<RecordingState, { opacity: number; blur: number; gradient: string }> = {
      idle: {
        opacity: 0.3,
        blur: 20,
        gradient: 'conic-gradient(from 0deg, #94a3b8, #64748b, #94a3b8)',
      },
      recording: {
        opacity: 1,
        blur: 40,
        gradient: 'conic-gradient(from 0deg, #f472b6, #c084fc, #60a5fa, #34d399, #fbbf24, #f472b6)',
      },
      processing: {
        opacity: 0.8,
        blur: 30,
        gradient: 'conic-gradient(from 0deg, #a78bfa, #818cf8, #6366f1, #a78bfa)',
      },
      complete: {
        opacity: 1,
        blur: 25,
        gradient: 'conic-gradient(from 0deg, #34d399, #10b981, #059669, #34d399)',
      },
    };
    return configs[recordingState];
  }, [recordingState]);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Outer glow ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          scale,
          background: stateConfig.gradient,
          filter: `blur(${stateConfig.blur}px)`,
        }}
        animate={{
          opacity: stateConfig.opacity,
          rotate: 360,
        }}
        transition={{
          opacity: { duration: 0.4, ease: 'easeOut' },
          rotate: {
            duration: recordingState === 'recording' ? 4 : 12,
            repeat: Infinity,
            ease: 'linear',
          },
        }}
      />

      {/* Secondary glow layer for depth */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 0.85,
          height: size * 0.85,
          scale,
          background: stateConfig.gradient,
          filter: `blur(${stateConfig.blur * 0.6}px)`,
        }}
        animate={{
          opacity: stateConfig.opacity * 0.6,
          rotate: -360,
        }}
        transition={{
          rotate: {
            duration: recordingState === 'recording' ? 6 : 18,
            repeat: Infinity,
            ease: 'linear',
          },
        }}
      />

      {/* Core orb with glass effect */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 0.7,
          height: size * 0.7,
          scale: innerScale,
          background: `
            radial-gradient(
              circle at 30% 30%,
              rgba(255, 255, 255, 0.4) 0%,
              rgba(255, 255, 255, 0.1) 40%,
              transparent 70%
            ),
            linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.2) 0%,
              rgba(255, 255, 255, 0.05) 100%
            )
          `,
          backdropFilter: 'blur(8px) saturate(150%)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: `
            inset 0 1px 1px rgba(255, 255, 255, 0.3),
            inset 0 -1px 1px rgba(0, 0, 0, 0.1),
            0 4px 24px rgba(0, 0, 0, 0.15)
          `,
        }}
        animate={{
          opacity: recordingState === 'idle' ? 0.6 : 1,
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Inner highlight */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 0.3,
          height: size * 0.3,
          top: '20%',
          left: '25%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)',
          filter: 'blur(4px)',
        }}
        animate={{
          opacity: recordingState === 'idle' ? 0.3 : 0.7,
          scale: recordingState === 'recording' ? [1, 1.1, 1] : 1,
        }}
        transition={{
          opacity: { duration: 0.3 },
          scale: {
            duration: 2,
            repeat: recordingState === 'recording' ? Infinity : 0,
            ease: 'easeInOut',
          },
        }}
      />

      {/* Processing spinner overlay */}
      {recordingState === 'processing' && (
        <motion.div
          className="absolute rounded-full border-2 border-transparent"
          style={{
            width: size * 0.9,
            height: size * 0.9,
            borderTopColor: 'rgba(167, 139, 250, 0.8)',
            borderRightColor: 'rgba(129, 140, 248, 0.4)',
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      )}

      {/* Success checkmark */}
      {recordingState === 'complete' && (
        <motion.svg
          viewBox="0 0 24 24"
          className="absolute"
          style={{ width: size * 0.35, height: size * 0.35 }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          <motion.path
            d="M5 13l4 4L19 7"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          />
        </motion.svg>
      )}
    </div>
  );
}
