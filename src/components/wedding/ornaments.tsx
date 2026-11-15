// Decorative artwork for the curated wedding theme. Every ornament is hidden
// from assistive technology and carries no Event information.

const LEAF = "M0 0C3.1 2.6 3.1 7.2 0 10.6C-3.1 7.2-3.1 2.6 0 0Z";
const SPRIG_ANGLES = [100, 113, 126, 139, 152, 165, 178, 191, 204];

function Sprig({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <g transform={mirrored ? "translate(148 0) scale(-1 1)" : undefined}>
      <path
        className="wedding-draw"
        pathLength={1}
        d="M65.65 133.4A60 60 0 0 1 20.5 46.8"
        fill="none"
        stroke="currentColor"
        strokeWidth={0.8}
        strokeLinecap="round"
      />
      {SPRIG_ANGLES.map((angle, index) => (
        <path
          key={angle}
          className="wedding-crest__leaf"
          d={LEAF}
          transform={`rotate(${angle} 74 74) translate(134 74) rotate(${index % 2 ? 32 : -32})`}
          fill="currentColor"
        />
      ))}
    </g>
  );
}

/** Monogram crest built from the first letters of the Host Display Names. */
export function Crest({
  initials,
  className = "",
}: {
  initials: string[];
  className?: string;
}) {
  return (
    <svg
      className={`wedding-crest ${className}`}
      viewBox="0 0 148 148"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        className="wedding-draw"
        pathLength={1}
        cx="74"
        cy="74"
        r="50"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        transform="rotate(-90 74 74)"
      />
      <circle
        className="wedding-crest__dots"
        cx="74"
        cy="74"
        r="44.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeDasharray="0.1 4.56"
      />
      <Sprig />
      <Sprig mirrored />
      <path
        className="wedding-crest__leaf"
        d="M74 9.5l3.6 4.5-3.6 4.5-3.6-4.5z"
        fill="currentColor"
      />
      {initials.length > 0 && (
        <text
          className="wedding-crest__initials"
          x="74"
          y="74"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {initials[0]}
          {initials[1] && (
            <>
              <tspan className="wedding-crest__amp" dx="3" dy="-1">
                &amp;
              </tspan>
              <tspan dx="3" dy="1">
                {initials[1]}
              </tspan>
            </>
          )}
        </text>
      )}
    </svg>
  );
}

export function Flourish({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`wedding-flourish ${className}`}
      viewBox="0 0 240 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="wedding-draw"
        pathLength={1}
        d="M100 12H10"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="round"
      />
      <path
        className="wedding-draw"
        pathLength={1}
        d="M140 12H230"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="round"
      />
      <path
        d="M120 4.5l7.5 7.5-7.5 7.5-7.5-7.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
      />
      <path d="M120 9l3 3-3 3-3-3z" fill="currentColor" />
      <circle cx="106" cy="12" r="1.4" fill="currentColor" />
      <circle cx="134" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="wedding-icon"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function PinIcon() {
  return (
    <Icon>
      <path d="M14 25s-8-7.2-8-13a8 8 0 1 1 16 0c0 5.8-8 13-8 13Z" />
      <circle cx="14" cy="12" r="3" />
    </Icon>
  );
}

export function AttireIcon() {
  return (
    <Icon>
      <path d="M11.5 12 5 8.5v11l6.5-3.5M16.5 12 23 8.5v11L16.5 16" />
      <rect x="11.5" y="11" width="5" height="6" rx="1.2" />
    </Icon>
  );
}

export function ContactIcon() {
  return (
    <Icon>
      <path d="M5 8.5A2.5 2.5 0 0 1 7.5 6h13A2.5 2.5 0 0 1 23 8.5v8a2.5 2.5 0 0 1-2.5 2.5H13.5L9 23v-4H7.5A2.5 2.5 0 0 1 5 16.5Z" />
      <path d="M10 11h8M10 14.5h5" />
    </Icon>
  );
}

export function ArrowOutIcon() {
  return (
    <svg
      className="wedding-icon wedding-icon--inline"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 11l6-6M6 5h5v5" />
    </svg>
  );
}

export function SavedMark() {
  return (
    <svg
      className="wedding-saved-mark"
      viewBox="0 0 52 52"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        className="wedding-saved-mark__ring"
        pathLength={1}
        cx="26"
        cy="26"
        r="23"
        transform="rotate(-90 26 26)"
      />
      <path
        className="wedding-saved-mark__check"
        pathLength={1}
        d="M16.5 26.5l6.5 6.5 13-14"
      />
    </svg>
  );
}
