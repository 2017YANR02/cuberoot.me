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
            </span>
            {part.slice(1)}
          </> : part}
        </span>
      ))}
      {plus && <span className="timer-plus2">+</span>}
    </>
  );
}
