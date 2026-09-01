import "./brand-lockup.css";

interface BrandMarkProps {
  readonly className?: string;
}

interface BrandLockupProps {
  readonly className?: string;
  readonly descriptor?: string;
  readonly inverse?: boolean;
  readonly compact?: boolean;
}

interface BrandRouteMotifProps {
  readonly className?: string;
}

export function BrandMark({ className = "" }: BrandMarkProps): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className={`brand-mark ${className}`.trim()}
      focusable="false"
      viewBox="0 0 64 64"
    >
      <rect className="brand-mark__field" height="60" rx="12" width="60" x="2" y="2" />
      <path
        className="brand-mark__letter brand-mark__letter--r"
        d="M12 14h15.2c8.3 0 13.2 4.5 13.2 11.7 0 4.8-2.4 8.2-6.6 10.2L42 50h-9.4l-7-12.4h-5.4V50H12V14Zm8.2 7v9.8h6.5c3.5 0 5.4-1.7 5.4-4.9 0-3.3-1.9-4.9-5.4-4.9h-6.5Z"
      />
      <path
        className="brand-mark__letter brand-mark__letter--t"
        d="M36 14h18v7.2h-5V50h-8V21.2h-5V14Z"
      />
      <path className="brand-mark__route" d="M8 54h20c7 0 10-3.6 10-9.4" />
      <circle className="brand-mark__route-stop" cx="8" cy="54" r="2" />
    </svg>
  );
}

export function BrandLockup({
  className = "",
  descriptor = "Centro de control",
  inverse = false,
  compact = false,
}: BrandLockupProps): React.JSX.Element {
  const classes = [
    "brand-lockup",
    inverse ? "brand-lockup--inverse" : "",
    compact ? "brand-lockup--compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <BrandMark />
      <span className="brand-lockup__copy">
        <strong className="brand-lockup__name">
          <span>R&amp;T</span> SITRAM
        </strong>
        <small>{descriptor}</small>
      </span>
    </div>
  );
}

export function BrandRouteMotif({ className = "" }: BrandRouteMotifProps): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className={`brand-route-motif ${className}`.trim()}
      focusable="false"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 720 900"
    >
      <g className="brand-route-motif__stone">
        <path d="M-40 180 126 52l176 64 120-82 186 112 154-58" />
        <path d="m-52 330 190-122 144 44 150-92 172 104 168-70" />
        <path d="m-24 508 166-116 166 46 142-102 170 88 124-54" />
        <path d="M52 72v166M218 92v172M394 66v164M566 104v170" />
      </g>
      <path
        className="brand-route-motif__route brand-route-motif__route--out"
        d="M58 782h126c68 0 104-40 104-102V552c0-66 38-104 104-104h104c74 0 112-42 112-112V198"
        pathLength="1"
      />
      <path
        className="brand-route-motif__route brand-route-motif__route--return"
        d="M606 198v128c0 44-23 67-68 67h-96c-89 0-136 51-136 142v136c0 39-21 59-63 59H102"
        pathLength="1"
      />
      <circle
        className="brand-route-motif__stop brand-route-motif__stop--origin"
        cx="58"
        cy="782"
        r="8"
      />
      <circle
        className="brand-route-motif__stop brand-route-motif__stop--turn"
        cx="606"
        cy="198"
        r="8"
      />
      <circle
        className="brand-route-motif__stop brand-route-motif__stop--return"
        cx="102"
        cy="730"
        r="8"
      />
    </svg>
  );
}
