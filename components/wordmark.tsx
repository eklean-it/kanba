// EKGO! wordmark — v3 composition ported from ekgo-admin's brand/Wordmark.
// Inline SVG so the letters inherit the app font + theme color and the bang
// sits flush against the "O" (viewBox 340x120, bang at x=269).
const NAVY = "#0f172a";
const LIME = "#bef264";
const PAPER = "#fafaf7";

type Variant = "full" | "reverse" | "adaptive";

// `adaptive` uses currentColor for the letters + stem (theme-aware via
// text-foreground); the drop stays lime always.
const PALETTES: Record<Variant, { letter: string; stem: string; drop: string }> = {
  full: { letter: NAVY, stem: NAVY, drop: LIME },
  reverse: { letter: PAPER, stem: PAPER, drop: LIME },
  adaptive: { letter: "currentColor", stem: "currentColor", drop: LIME },
};

export function Wordmark({
  variant = "adaptive",
  className,
  title = "EKGO!",
}: {
  variant?: Variant;
  className?: string;
  title?: string;
}) {
  const p = PALETTES[variant];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 340 120"
      role="img"
      aria-label={title}
      className={className}
    >
      <text x="0" y="98" fontWeight={800} fontSize={120} letterSpacing={-6} fill={p.letter}>
        EKGO
      </text>
      <g transform="translate(269,8) scale(0.96)">
        <path
          d="M 37 0 L 63 0 L 64 64 C 64 67, 62 70, 58 70 L 42 70 C 38 70, 36 67, 36 64 Z"
          fill={p.stem}
        />
        <circle cx="50" cy="90" r="10" fill={p.drop} />
      </g>
    </svg>
  );
}
