// Blob download helpers shared by the scramble/stats *DistView components.

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadText(filename: string, text: string): void {
  downloadBlob(filename, new Blob([text], { type: 'text/plain;charset=utf-8' }));
}

// Keep large exports in 64k-line chunks rather than building one giant string.
export function blobFromLines(lines: Iterable<string>): Blob {
  const parts: string[] = [];
  let buf: string[] = [];
  for (const line of lines) {
    buf.push(line);
    if (buf.length >= 65536) { parts.push(buf.join('\n') + '\n'); buf = []; }
  }
  if (buf.length) parts.push(buf.join('\n'));
  return new Blob(parts, { type: 'text/plain;charset=utf-8' });
}

/** Join a header row + data rows into a CSV and download it. */
export function downloadCsv(filename: string, header: string, rows: string[]): void {
  downloadText(filename, [header, ...rows].join('\n'));
}
