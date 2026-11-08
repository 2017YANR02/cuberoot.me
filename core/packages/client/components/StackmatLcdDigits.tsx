import { DIGITS, SEGMENTS } from './seven-segment-paths';

/** Common editable seven-segment display for all StackMat illustrations. */
export default function StackmatLcdDigits({ value, x, y, width, height, color = '#4d594c', arcRadius = 0 }: {
  value: string; x: number; y: number; width: number; height: number; color?: string;
  /** Radius through the glyph centres; zero keeps a flat LCD. */
  arcRadius?: number;
}) {
  if (!/^[\d.:+\-]*$/.test(value)) return <text data-part="status" x={x + width / 2} y={y + height * .8}
    textAnchor="middle" fontSize={height * .8} fontFamily="sans-serif" fill={color}
    textLength={value.length > 10 ? width : undefined} lengthAdjust="spacingAndGlyphs">{value}</text>;
  const characters = Array.from(value);
  const advance = (character: string) => character === '.' || character === ':' ? 18 : 86;
  const total = characters.reduce((sum, character) => sum + advance(character), 0);
  const scale = Math.min(height / 100, width / Math.max(1, total));
  let cursor = 0;
  return <g data-part="digits" transform={arcRadius ? undefined : `translate(${x + width - total * scale} ${y}) scale(${scale} ${height / 114}) skewX(-5)`} fill={color}>
    {characters.map((character, index) => {
      const offset = cursor; cursor += advance(character);
      // Follow the physical display, so punctuation and longer times stay on
      // the same arc rather than changing curvature with the string length.
      const center = advance(character) / 2;
      const position = width - total * scale + (offset + center) * scale;
      const angle = arcRadius ? (position - width / 2) / arcRadius : 0;
      const curvedX = x + width / 2 + arcRadius * Math.sin(angle);
      const curvedY = y + height / 2 + arcRadius * (1 - Math.cos(angle));
      return <g key={index} transform={arcRadius === 0 ? `translate(${offset} 0)`
        : `translate(${curvedX} ${curvedY}) rotate(${angle * 180 / Math.PI}) scale(${scale} ${height / 114}) translate(${-center} -57) skewX(-5)`}>
        {character === '.' ? <circle cx="3" cy="109" r="4"/> : character === ':' ? <><circle cx="3" cy="35" r="4"/><circle cx="3" cy="80" r="4"/></> : character === '+' ? <path d="M27 30H39V51H60V63H39V84H27V63H6V51H27Z"/> : <path d={character === '-' ? SEGMENTS.g : Array.from(DIGITS[character] ?? '').map(segment => SEGMENTS[segment]).join(' ')}/>}
      </g>;
    })}
  </g>;
}
