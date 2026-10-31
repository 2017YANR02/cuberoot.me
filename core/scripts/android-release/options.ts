export function parseOptions(args: string[]) {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (flags.has(arg) || values.has(arg)) throw new Error(`Duplicate option: ${arg}`);
    if (['--help', '--only-play', '--build-only'].includes(arg)) flags.add(arg);
    else if (arg === '--resume') {
      throw new Error('--resume no longer publishes local artifacts. Open the original GitHub Actions run and rerun failed jobs; no release was requested.');
    } else if (['--platform', '--notes', '--play'].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value: ${arg}`);
      values.set(arg, value);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  const platform = values.get('--platform') ?? 'android';
  if (!['android', 'windows', 'both'].includes(platform)) throw new Error('Expected --platform android|windows|both');
  const playTrack = values.get('--play') ?? 'none';
  if (!['none', 'internal', 'production'].includes(playTrack) || values.get('--play') === 'none') throw new Error('Expected --play internal|production');
  if (playTrack !== 'none' && platform === 'windows') throw new Error('--play requires --platform android or both');
  if (flags.has('--only-play') && (playTrack === 'none' || platform !== 'android')) throw new Error('--only-play requires --play internal|production and --platform android');
  const notes = values.get('--notes');
  if (notes !== undefined && (!notes.trim() || notes.length > 4000)) throw new Error('Release notes must contain 1–4000 characters');
  return { platform, playTrack, onlyPlay: flags.has('--only-play'), buildOnly: flags.has('--build-only'), notes: notes?.trim(), help: flags.has('--help') };
}
