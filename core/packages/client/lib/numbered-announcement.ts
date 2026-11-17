/** Editable ordered lines: preserve blank rows and the caret within its item. */
export function numberAnnouncementLines(text: string, caret = text.length) {
  if (!text) return { text: '', caret: 0 };
  const prefix = /^\s*\d+[.)、]\s*/;
  const lines = text.split('\n');
  const before = text.slice(0, caret).split('\n');
  const row = before.length - 1;
  const oldPrefix = lines[row].match(prefix)?.[0].length ?? 0;
  const numbered = lines.map((line, index) => `${index + 1}. ${line.replace(prefix, '')}`);
  return { text: numbered.join('\n'), caret: numbered.slice(0, row).reduce((sum, line) => sum + line.length + 1, 0) + `${row + 1}. `.length + Math.max(0, before[row].length - oldPrefix) };
}
export function announcementItems(text: string) {
  return text.split('\n').map(line => line.replace(/^\s*\d+[.)、]\s*/, '').trim()).filter(Boolean);
}
