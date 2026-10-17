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
            <span className="timer-capital-d">
              <span className="timer-capital-d-text">D</span>
              <svg className="timer-capital-d-segments" viewBox="0 0 600 800" aria-hidden="true" focusable="false">
                <g fill="currentColor" transform="translate(84 0) skewX(-6)">
                  <path d="M12 12 82 82 82 350 47 389 12 350Z" />
                  <path d="m12 450 35-39 35 39v268l-70 70Z" />
                  <path d="M24 0h312l70 70H94Z" />
                  <path d="m350 5 145 145v96l-78-78-67-67Z" />
                  <path d="m425 186 70 70v94l-35 39-35-39Z" />
                  <path d="m425 450 35-39 35 39v94l-70 70Z" />
                  <path d="m417 632 78-78v96L350 795v-96Z" />
                  <path d="M94 730h312l-70 70H24Z" />
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
