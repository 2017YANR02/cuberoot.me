/** Cross-platform CLI for the same protected workflow used by /admin/releases. */
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOptions } from './options.ts';

const repository = '2017YANR02/cuberoot.me';
const workflow = 'app_release.yml';
export const help = `pnpm android:release [--platform android|windows|both] [--notes "Release notes"]
  [--play internal|production] [--only-play] [--build-only]
Publishes website downloads using the protected GitHub Actions app_release.yml workflow.
Defaults to Android and the latest main commit; local changes are never packaged.
Requires authenticated GitHub CLI (gh) with permission to dispatch this repository's workflow.
Builds, signing and publication run entirely in CI. Closing this terminal does not cancel them.
Without --notes, the main commit subject is used. --play explicitly adds Google Play submission;
--only-play skips website publication. --build-only retains signed CI artifacts without publication.
--resume is retired: inspect the original Actions run and rerun failed jobs instead.`;

type Gh = (args: string[], inherit?: boolean) => string;
interface Dependencies {
  gh: Gh;
  uuid: () => string;
  sleep: (milliseconds: number) => Promise<void>;
  log: (message: string) => void;
}
const gh: Gh = (args, inherit = false) => {
  const result = spawnSync('gh', args, { encoding: 'utf8', stdio: inherit ? 'inherit' : 'pipe', maxBuffer: 4 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`GitHub CLI failed (${result.status}). Inspect the Actions URL above before retrying a release.`);
  return result.stdout?.trim() ?? '';
};

export async function release(args: string[], deps: Dependencies = {
  gh, uuid: randomUUID, sleep: ms => new Promise(resolve => setTimeout(resolve, ms)), log: console.log,
}) {
  const options = parseOptions(args);
  if (options.help) { deps.log(help); return; }
  const main = JSON.parse(deps.gh(['api', `repos/${repository}/commits/main`])) as { sha: string; commit: { message: string } };
  if (!/^[a-f0-9]{40}$/.test(main.sha)) throw new Error('GitHub did not return an exact main commit');
  const notes = options.notes ?? main.commit.message.split('\n')[0].trim().slice(0, 4000);
  if (!notes) throw new Error('Provide --notes for this release');
  if (options.playTrack !== 'none' && [...notes].length > 500) throw new Error('Google Play release notes must be at most 500 characters; provide shorter --notes. No release was requested.');
  const requestId = deps.uuid();
  const url = `https://github.com/${repository}/actions/workflows/${workflow}`;
  deps.log(`Request ${requestId}: ${options.platform}, Play ${options.playTrack}, only-play ${options.onlyPlay}, build-only ${options.buildOnly}, main ${main.sha}\n${url}`);
  try {
    deps.gh(['workflow', 'run', workflow, '--repo', repository, '--ref', 'main',
      '-f', `source_commit=${main.sha}`, '-f', `request_id=${requestId}`,
      '-f', `platform=${options.platform}`, '-f', `notes=${notes}`,
      '-f', `play_track=${options.playTrack}`, '-f', `only_play=${options.onlyPlay}`, '-f', `build_only=${options.buildOnly}`]);
  } catch {
    throw new Error(`Dispatch outcome is unknown. Find request ${requestId} at ${url} before retrying; this command will not dispatch again automatically.`);
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    const runs = JSON.parse(deps.gh(['run', 'list', '--repo', repository, '--workflow', workflow,
      '--event', 'workflow_dispatch', '--limit', '100', '--json', 'databaseId,displayTitle,url'])) as { databaseId: number; displayTitle: string; url: string }[];
    const run = runs.find(run => run.displayTitle === `App release ${requestId}`);
    if (run) {
      deps.log(run.url);
      deps.gh(['run', 'watch', String(run.databaseId), '--repo', repository, '--exit-status'], true);
      deps.log(`CI release completed: ${run.url}. Device installation and Google Play availability are separate checks.`);
      return;
    }
    await deps.sleep(10_000);
  }
  throw new Error(`Request ${requestId} was accepted but its run is not visible yet. Inspect ${url}; do not submit a duplicate release.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await release(process.argv.slice(2)).catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
