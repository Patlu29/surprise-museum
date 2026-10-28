interface FrameMarkProps {
  /** A crooked empty frame, for the not-found screen. */
  crooked?: boolean;
  /** Slow brass sweep along the frame while something loads (static under reduced motion). */
  sweeping?: boolean;
}

/**
 * The brass picture-frame mark (design spec 7.1). Drawn in SVG with tokens, so it needs no
 * download. Decorative. Also the placeholder for the home and not-found illustrations.
 */
export function FrameMark({ crooked, sweeping }: FrameMarkProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={[
        'frame-mark',
        crooked && 'frame-mark--crooked',
        sweeping && 'frame-mark--sweeping',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
      focusable="false"
    >
      <g className="frame-mark__frame">
        <rect x="18" y="22" width="84" height="76" rx="6" className="frame-mark__outer" />
        <rect x="27" y="31" width="66" height="58" rx="3" className="frame-mark__mat" />
        <rect x="27" y="31" width="66" height="58" rx="3" className="frame-mark__edge" />
        <path d="M44 78l11-14 8 9 7-8 10 13z" className="frame-mark__hill" />
        <circle cx="48" cy="48" r="5" className="frame-mark__sun" />
      </g>
      <rect x="40" y="8" width="40" height="5" rx="2.500" className="frame-mark__light" />
      <path d="M60 13v9" className="frame-mark__edge" />
    </svg>
  );
}
