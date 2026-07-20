#!/usr/bin/env node
// PreToolUse detector: block reads of the client-forgeable X-Forwarded-For header as an
// IP source in server source writes. Reads the hook payload on stdin ({tool_name,
// tool_input}), scans the NEW content (Write.content / Edit.new_string / MultiEdit.edits[])
// of a core/packages/server/src/ .ts file and DENIES (JSON permissionDecision=deny on
// stdout + exit 0; exit 2 is ignored in auto mode) when it reads x-forwarded-for.
// Request IP must come from getIp(c) (utils/analytics_helpers.ts, the single source),
// which reads only nginx's trusted x-real-ip — XFF is client-set and would let anyone
// spoof IP / visitor_id / country, bypass rate limits, and pollute analytics.
// Mirrors the CI ratchet tests/server-no-forwarded-for.test.ts (which is authoritative).
// A genuine need (e.g. logging the raw XFF chain, never for identity) opts out with an
// inline `allow-forwarded-for` comment on the same line.

// Real header read: the header name immediately preceded by a quote or `[`. A prose
// mention like "NO X-Forwarded-For fallback" (a space before it) never matches.
const XFF_READ = /["'`[]x-forwarded-for/i;

const deny = (reason) => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  }));
  process.exit(0);
};

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let ti;
  try { ti = (JSON.parse(raw).tool_input) || {}; } catch { process.exit(0); }
  const fp = String(ti.file_path || '').replace(/\\/g, '/');
  // Only server source .ts (skip its own guard test).
  if (!/core\/packages\/server\/src\//.test(fp) || !/\.ts$/.test(fp) || /\.test\.ts$/.test(fp)) {
    process.exit(0);
  }
  const parts = [];
  if (typeof ti.content === 'string') parts.push(ti.content);
  if (typeof ti.new_string === 'string') parts.push(ti.new_string);
  if (Array.isArray(ti.edits)) for (const e of ti.edits) if (e && typeof e.new_string === 'string') parts.push(e.new_string);
  const text = parts.join('\n');

  // Line-scoped so an inline `allow-forwarded-for` on the same line exempts it.
  for (const line of text.split('\n')) {
    if (XFF_READ.test(line) && !/allow-forwarded-for/.test(line)) {
      deny(
        '禁止读取可伪造的 X-Forwarded-For 作请求 IP 来源:XFF 由客户端自填,任何人都能伪造 → IP / visitor_id / 国家 spoofing、绕过限流、污染统计。' +
          "请用 getIp(c)(import { getIp } from '../utils/analytics_helpers.js';)——全站唯一的请求 IP 来源,只读 nginx 写入的可信 x-real-ip。" +
          '确有正当用途(仅记录原始 XFF 链、绝不用于身份判定):在该行加行内注释 allow-forwarded-for。详见 tests/server-no-forwarded-for.test.ts / /code/guards。',
      );
    }
  }
  process.exit(0);
});
