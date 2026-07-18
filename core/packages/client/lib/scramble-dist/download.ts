// Blob download helpers shared by the scramble/stats *DistView components.
// Previously each file re-declared its own downloadText / downloadBlob (6+
// copies); this is the single source.

export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Join a header row + data rows into a CSV and download it. */
export function downloadCsv(filename: string, header: string, rows: string[]): void {
  downloadText(filename, [header, ...rows].join('\n'));
}
