import { motion } from 'framer-motion';

interface ToggleProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
}

export function Toggle({ enabled, onChange }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="relative w-10 h-6 rounded-full transition-all duration-200"
      style={{ background: enabled ? '#22c55e' : 'rgba(255, 255, 255, 0.1)' }}
    >
      <motion.div
        className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white"
        animate={{ x: enabled ? 16 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
