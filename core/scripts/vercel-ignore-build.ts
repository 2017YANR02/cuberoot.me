// Vercel runs this before installing dependencies. Keep it Node-only and use
// Deploy Next's path contract as the single source for frontend build inputs.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
try {
  const base = process.env.VERCEL_GIT_PREVIOUS_SHA;
  if (!base) throw new Error('No previous deployment');
  const workflow = readFileSync(new URL('../../.github/workflows/deploy_next.yml', import.meta.url), 'utf8');
  const push = workflow.match(/\n  push:\n([\s\S]*?)(?=\n\S|$)/)?.[1];
  const block = push?.match(/    paths:\n((?:      - '[^']+'\n)+)/)?.[1];
  if (!block) throw new Error('Frontend build path contract unavailable');
  const paths = [...block.matchAll(/      - '([^']+)'/g)]
    .map(match => match[1]!)
    .filter(path => !path.startsWith('ops/') && !path.startsWith('.github/'))
    .map(path => path.startsWith('!')
      ? `:(exclude)${path.slice(1).replace(/\/\*\*$/, '')}`
      : path.replace(/\/\*\*$/, ''));
  if (!paths.length) throw new Error('Frontend build path contract is empty');
  execFileSync('git', ['-C', root, 'diff', '--quiet', base, 'HEAD', '--', ...paths], { stdio: 'inherit' });
  process.exit(0); // No frontend inputs changed: skip the build.
} catch {
  process.exit(1); // Changed inputs or missing evidence: build.
}
