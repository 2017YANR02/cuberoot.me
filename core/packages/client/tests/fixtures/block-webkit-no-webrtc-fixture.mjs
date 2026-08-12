let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let content = '';
  try { content = JSON.parse(raw || '{}').tool_input?.content || ''; } catch { process.exit(0); }
  if (!/webkit\s*\.\s*launch\s*\(/.test(content)) return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'fixture browser launch denied',
    },
  }));
});
