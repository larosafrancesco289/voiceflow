/**
 * Processing spinner - thin rotating arc that matches the minimal aesthetic.
 * Shown while transcription is in progress.
 */
export function ProcessingSpinner() {
  return (
    <div className="flex items-center justify-center w-5 h-5">
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        className="animate-spin"
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
    </div>
  );
}
