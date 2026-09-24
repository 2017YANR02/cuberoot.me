#!/usr/bin/env node
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
let request;
try { request = JSON.parse(raw || '{}'); } catch { process.exit(0); }
const input = request?.tool_input;
const inputText = typeof input === 'string' ? input : `${input?.command ?? ''}${input?.file_path ?? ''}`;
if (!/app[/\\][^/\\]+[/\\]calc[/\\]/.test(inputText)) process.exit(0);
const additionalContext = '你刚改了 client calc/ 下的文件 — calc 无自动化测试(旧 Vite 版 calc-interactions 随 Vite 退役已删),改完前必须手动 Playwright 验证 /zh/calc: (1) browser_navigate http://127.0.0.1:3000/zh/calc?event=333 (2) browser_evaluate 用 window.__calcStore 读 store + DOM 查 .event-selector 事件按钮,确认渲染/切换/计分正常 (3) 别只看 200。';
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext } }));
