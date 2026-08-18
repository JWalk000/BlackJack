/** Architectural arch mark — estate as elevation, arc as the curve. */
export function BrandMark({
  className = "h-8 w-8",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      aria-hidden
    >
      <path
        d="M5 33.5h30"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="square"
      />
      <path
        d="M9 33.5V19.5a11 11 0 0 1 22 0V33.5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinejoin="miter"
      />
      <path
        d="M14.5 22.5a5.5 5.5 0 0 1 11 0"
        className="text-signal"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="square"
      />
      <circle cx="20" cy="10.2" r="1.7" className="fill-signal" />
    </svg>
  );
}
