export interface ByteRange {
  start: number;
  end: number;
}

/** Parse one HTTP byte range. Multipart byte ranges are intentionally unsupported. */
export function parseByteRange(header: string | undefined, size: number): ByteRange | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || size <= 0) return null;

  const startText = match[1];
  const endText = match[2];
  if (!startText && !endText) return null;

  let start: number;
  let end: number;
  if (!startText) {
    const suffix = Number(endText);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText ? Number(endText) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return null;
    if (start < 0 || start >= size || end < start) return null;
    end = Math.min(end, size - 1);
  }
  return { start, end };
}
