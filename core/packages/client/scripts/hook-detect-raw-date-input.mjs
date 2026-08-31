#!/usr/bin/env node
// Shared raw date-input detector for PreToolUse and CI.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAW_DATE = /<input\b(?:(?!>).)*\btype\s*=\s*(?:["']date["']|\{\s*["']date["']\s*\})[^>]*>/gis;
const TEXT_DATE = /<input\b(?:(?!>).)*\bplaceholder\s*=\s*["']yyyy-mm-dd["'][^>]*>/gis;

export function scanRawDateInputs(source) {
  return [...source.matchAll(RAW_DATE), ...source.matchAll(TEXT_DATE)]
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
}

export function violationsFromHookPayload(payload) {
  const input = payload?.tool_input || {};
  const filePath = String(input.file_path || '').replace(/\\/g, '/');
  const guardedApp = /packages\/client\/(app|components)\//.test(filePath)
    || /apps\/mobile\/src\//.test(filePath);
  const canonicalInput = /packages\/timer-ui\/src\/DateInput\.tsx$/.test(filePath);
  if (!guardedApp || !/\.tsx$/.test(filePath) || canonicalInput) return [];
  const content = [input.content, input.new_string]
    .concat(Array.isArray(input.edits) ? input.edits.map((edit) => edit?.new_string) : [])
    .filter((part) => typeof part === 'string')
    .join('\n');
  return scanRawDateInputs(content);
}

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
}

const isMain = process.argv[1]
  && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isMain) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { raw += chunk; });
  process.stdin.on('end', () => {
    let payload;
    try { payload = JSON.parse(raw || '{}'); } catch { process.exit(0); }
    if (violationsFromHookPayload(payload).length) {
      deny('日期输入禁止重复造轮:Web 用 components/DateInput 或 DateRangeInput,App 用 @cuberoot/timer-ui;本地/API 日期走 @cuberoot/shared/iso-date。');
    }
    process.exit(0);
  });
}
