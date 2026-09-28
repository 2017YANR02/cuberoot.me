/** Compact terminal view of a statistics run. The full output is saved by the launcher. */
import { clearLine, createInterface, cursorTo } from 'node:readline';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type TerminalOutput = NodeJS.WriteStream;

function cellWidth(char: string): number {
  return /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe6f\uff01-\uff60\uffe0-\uffe6]/u.test(char) ? 2 : 1;
}

function fit(line: string, columns: number): string {
  const limit = Math.max(20, columns - 2);
  let width = 0;
  let result = '';
  for (const char of line) {
    const next = cellWidth(char);
    if (width + next > limit) return `${result}…`;
    result += char;
    width += next;
  }
  return result;
}

function compact(line: string): string {
  return line
    .replace(/^\[进度\]\s*/u, '')
    .replace(/ \| [\d.]+ MB\/s.*$/u, '')
    .replace(/ \| (?:已运行|用时) \d\d:\d\d:\d\d$/u, '');
}

export function createTerminalProgressFilter(output: TerminalOutput): { push: (line: string) => void; finish: () => void } {
  let active = false;
  const seen = new Set<string>();
  const finish = () => {
    if (active) output.write('\n');
    active = false;
  };
  const push = (line: string) => {
    const progress = /^\[(?:进度|取数)\]/u.test(line);
    const other = /^=== |^下载中断 |^统计完成：|^Run summary:|^\[publish\]|^\[git\]|^(?:Error:|error:)/u.test(line);
    if (!progress && !other) return;
    if (progress) {
      const status = compact(line);
      if (seen.has(status)) return;
      seen.add(status);
      if (output.isTTY) {
        clearLine(output, 0);
        cursorTo(output, 0);
        output.write(fit(status, output.columns || 80));
        active = true;
      } else output.write(`${status}\n`);
      return;
    }
    finish();
    output.write(`${line}\n`);
  };
  return { push, finish };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const filter = createTerminalProgressFilter(process.stdout);
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of input) filter.push(line);
  filter.finish();
}
