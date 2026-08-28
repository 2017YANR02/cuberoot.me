#!/usr/bin/env node
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
let request;
try { request = JSON.parse(raw || '{}'); } catch { process.exit(0); }
const input = request?.tool_input;
const rawInput = typeof input === 'string' ? input : JSON.stringify(input ?? {});
if (!rawInput.trim()) process.exit(0);
const normalized = rawInput.replaceAll('\\', '/');
let additionalContext = '';
if (/apps\/api\/migrations\/[0-9]{4}_.*\.sql/.test(normalized)) {
  additionalContext = '你刚动了 server migration。同步 /dev/schema 的账本:在 packages/client/app/[lang]/dev/schema/page.tsx 的 MIGRATIONS 数组加一行 { n: <编号>, slug, desc };新表顺手加进 TABLES。CI 守卫 tests/dev-schema-api-drift.test.ts 会卡漏改。';
} else if (/apps\/api\/src\/index\.ts/.test(normalized) && rawInput.includes('app.route(')) {
  additionalContext = '你刚改了 index.ts 的路由挂载。若新挂了 route,同步 /dev/api:在 packages/client/app/[lang]/dev/api/page.tsx 的 covers-routes 清单加文件名 + 在 ENDPOINTS 补端点。CI 守卫 tests/dev-schema-api-drift.test.ts 会卡漏改。';
} else if (/apps\/api\/src\/routes\/[a-z0-9_]+\.ts/.test(normalized) && /\.(?:get|post|put|patch|delete)\(/.test(rawInput)) {
  additionalContext = '你刚改了 server route 文件(含端点定义)。若增删了对外端点,同步 /dev/api 的 ENDPOINTS(packages/client/app/[lang]/dev/api/page.tsx);新 route 文件还要进 covers-routes 清单。CI 守卫 tests/dev-schema-api-drift.test.ts 会卡新挂载的 route。';
}
if (additionalContext) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext } }));
