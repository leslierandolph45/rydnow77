export default function Logo({ className = 'text-2xl' }: { className?: string }) {
  return (
    <span className={`font-black tracking-tight text-white ${className}`}>
      RYD<span className="text-gold">NOW</span>
    </span>
  );
}
