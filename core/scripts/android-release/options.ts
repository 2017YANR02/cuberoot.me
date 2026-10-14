export function parseOptions(args: string[]) {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (flags.has(arg) || values.has(arg)) throw new Error(`Duplicate option: ${arg}`);
    if (['--help', '--build-only', '--only-play'].includes(arg)) flags.add(arg);
    else if (['--resume', '--play'].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value: ${arg}`);
      values.set(arg, value);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  const track = values.get('--play');
  if (track && track !== 'internal' && track !== 'production') throw new Error('Expected --play internal|production');
  if (flags.has('--only-play') && !track) throw new Error('--only-play requires --play internal|production');
  return { values, flags };
}
