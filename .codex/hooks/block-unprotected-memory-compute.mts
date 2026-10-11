#!/usr/bin/env node
// Startup interlock, not an OS swap setting. No verified no-swap launcher is
// registered yet: polling vm_stat, env flags and a small batch are not exemptions.
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const native = /^(?:table_generator(?:_high_memory)?|solve_h48_h10(?:_\d+)?|(?:pseudo_f2leo|f2leo|pseudo_pair|pair|std)_analyzer)(?:\.exe)?$/;
const script = /(?:^|\/)(?:solve_h10\.mts|double-zbll\.ts|gen-table\.mjs|backfill_xcross_variant\.[cm]?[jt]s)$/;
const base = (word: string) => word.replaceAll('\\', '/').split('/').pop() ?? '';

// Preserve quoted arguments so `rg 'table_generator' ...` is inspection, while
// command lists and shell -c wrappers are checked independently. This is not a
// general shell interpreter: aliases and opaque/generated scripts need review.
function segments(command: string): string[][] {
  const result: string[][] = [];
  let words: string[] = [], word = '', quote = '';
  const flushWord = () => { if (word) words.push(word); word = ''; };
  const flush = () => { flushWord(); if (words.length) result.push(words); words = []; };
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (char === '\\' && command[i + 1] === '\n') { i++; continue; }
    if (quote) {
      if (char === quote) quote = '';
      else if (char === '\\' && quote !== "'" && ['"', '\\', '`'].includes(command[i + 1])) word += command[++i];
      else word += char;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '#' && !word) {
      while (i < command.length && command[i] !== '\n') i++;
      flush();
    } else if (';&|\n(){}'.includes(char)) flush();
    else if (/\s/.test(char)) flushWord();
    else word += char;
  }
  flush();
  return result;
}

export function blockedCompute(command: string, depth = 0): string | undefined {
  if (depth > 8) return undefined;
  for (const words of segments(command)) {
    const first = base(words.find(word => !/^[\w]+=.*/.test(word)) ?? '');
    // These commands read or display their arguments; names in source/fixtures
    // are not launches. Command substitution is checked separately below.
    if (/^(?:rg|grep|cat|head|tail|sed|less|echo|printf|git|ls|stat|du|wc|file)$/.test(first)) continue;
    if (first === 'cargo' && !words.includes('run')) continue;
    for (const [index, word] of words.entries()) {
      const normalized = word.replaceAll('\\', '/');
      const name = base(word).replace(/^--bin=/, '');
      if (native.test(name) || script.test(normalized)
        || /(?:^|\/)double-zbll-1000\/run\.mts$/.test(normalized)) return name;
      if (word === 'double-zbll' && words.some(w => /^(?:pnpm|npm|yarn)(?:\.cmd)?$/.test(base(w)))) return word;
      const localStats = word === 'stats:scramble:local' || /(?:^|\/)scripts\/stats\/update-local\.ts$/.test(normalized);
      if (localStats && !words.slice(index + 1).includes('--plan')) return '打乱统计计算';
      const publishedStats = /^stats:scramble(?::publish)?$/.test(word)
        || /(?:^|\/)scripts\/stats\/update-published\.ts$/.test(normalized);
      if (publishedStats && !words.slice(index + 1).includes('--publish-only')) return '打乱统计计算';
      if (/^-(?:[a-z]*c|e|eval)$/.test(word) || word === '--eval' || word === '-Command') {
        const nested = words[index + 1] ?? '';
        const blocked = blockedCompute(nested, depth + 1);
        if (blocked) return blocked;
        // Visible child-process calls in inline JS/Python/PowerShell. Do not
        // execute or import arbitrary code in order to classify it.
        if (/spawn|exec|subprocess|Start-Process/.test(nested)
          && /table_generator|solve_h(?:48_h)?10|double-zbll|stats:scramble|scripts[\\/]stats[\\/]update-/.test(nested)) return '内联脚本中的大内存计算';
      }
    }
  }
  for (const match of command.matchAll(/\$\(([^()]*)\)|`([^`]*)`/g)) {
    const blocked = blockedCompute(match[1] ?? match[2], depth + 1);
    if (blocked) return blocked;
  }
  return undefined;
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let request;
  try { request = JSON.parse(raw || '{}'); } catch { return; }
  const command = request?.tool_input?.command;
  if (typeof command !== 'string') return;
  const cwd = request?.tool_input?.workdir ?? request?.tool_input?.cwd ?? request?.cwd;
  const root = repoRoot.toLowerCase();
  const directory = typeof cwd === 'string' ? resolve(cwd).toLowerCase() : '';
  if (directory !== root && !directory.startsWith(root + sep)
    && !command.replaceAll('\\', '/').toLowerCase().includes(root.replaceAll('\\', '/'))) return;
  const blocked = blockedCompute(command);
  if (!blocked) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: 'PreToolUse', permissionDecision: 'deny',
    permissionDecisionReason: `禁止启动 ${blocked}：尚无经核验、覆盖进程及其子进程的系统级防交换保护。现有轮询监控、NO_SWAP 环境变量及缩小批次不能保证零换出。保留结果和断点，先配置并核验系统级保护，再登记受保护入口；不要重设基线或绕过 hook。只读查看统计计划可用 pnpm stats:scramble:local --plan。见 AGENTS.md「项目硬性约束：禁止使用交换空间」。`,
  } }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
