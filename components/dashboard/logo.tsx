/**
 * components/logo.tsx
 *
 * RYDNOW wordmark: "RYD" in white, "NOW" in gold. For use on blue or navy backgrounds.
 */
export default function Logo({ className = 'text-2xl' }: { className?: string }) {
  return (
    <span className={`font-black tracking-tight text-white ${className}`}>
      RYD<span className="text-gold">NOW</span>
    </span>
  );
}


