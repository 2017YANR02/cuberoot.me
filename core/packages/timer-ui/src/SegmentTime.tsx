/** Seven-segment timer text with punctuation rendered separately from the font. */
export function SegmentTime({ text }: { text: string }) {
  const plus = text.endsWith('+');
  const body = plus ? text.slice(0, -1) : text;
  return (
    <>
      {body.split(':').map((part, index) => (
        <span key={index}>
          {index > 0 && <span aria-hidden="true" className="timer-colon" />}
          {part === 'DNF' || part === 'DNS' ? <>
            <span className="timer-capital-d" role="img" aria-label="D">
              <span className="timer-capital-d-text">D</span>
              <svg className="timer-capital-d-segments" viewBox="0 0 585 800" aria-hidden="true" focusable="false">
                <g fill="currentColor" transform="translate(21 0) skewX(-3)">
                  <path d="M55 0h330l50 50-50 50H140Z" />
                  <path d="M45 10 130 95v235l-85 45Z" />
                  <path d="m45 405 85 45v255l-85 85Z" />
                  <path d="m435 55 55 55v265l-85-45V95Z" />
                  <path d="m490 405-85 45v255l30 40 55-55Z" />
                  <path d="M130 700h275l30 50-50 50H55Z" />
                </g>
              </svg>
            </span>
            {part.slice(1)}
          </> : part}
        </span>
      ))}
      {plus && <span className="timer-plus2">+</span>}
    </>
  );
}
