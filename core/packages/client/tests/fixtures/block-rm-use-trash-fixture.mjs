let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let command = '';
  try { command = JSON.parse(raw || '{}').tool_input?.command || ''; } catch { process.exit(0); }
  if (!/Remove-Item|::Delete|\bfind\b[\s\S]*-delete/.test(command)) return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'fixture delete denied',
    },
  }));
});
