#!/usr/bin/env node
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
if (!raw.includes('(?<=') && !raw.includes('(?<!')) process.exit(0);

let request;
try { request = JSON.parse(raw || '{}'); } catch { process.exit(0); }
const filePath = String(request?.tool_input?.file_path ?? '').replaceAll('\\', '/');
const isBrowserSource = /\/core\/packages\/client\/(?:app|components|data|hooks|i18n|lib|types|wasm)\/.+\.(?:[cm]?[jt]sx?)$/.test(filePath)
  || /\/core\/packages\/platform\/(?:app|components|data|lib)\/.+\.(?:[cm]?[jt]sx?)$/.test(filePath)
  || /\/core\/packages\/(?:shared|visualcube)\/src\/.+\.(?:[cm]?[jt]sx?)$/.test(filePath);
if (!isBrowserSource) process.exit(0);

const input = request.tool_input ?? {};
const content = [input.content, input.new_string, ...(input.edits ?? []).map((edit) => edit?.new_string)]
  .filter((value) => typeof value === 'string')
  .join('\n');
if (!content.includes('(?<=') && !content.includes('(?<!')) process.exit(0);

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: '浏览器端源码禁用正则后行断言。旧版 WebKit 会在解析 chunk 时整段失败；请改用捕获边界或显式检查前一个字符。',
  },
}));
