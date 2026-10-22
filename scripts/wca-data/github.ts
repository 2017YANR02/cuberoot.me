import { execFileSync, spawnSync } from 'node:child_process';
import { REPO, TAG, check, run, resolveRelease } from './common.ts';
export const endpoint = `repos/${REPO}/releases`;
export function gh(args: string[], input?: unknown) { return run('gh', args, input === undefined ? {} : { input: JSON.stringify(input) }); }
export function api(path: string, input?: unknown) { return JSON.parse(gh(['api', path, ...(input === undefined ? [] : ['--method', 'PATCH', '--input', '-'])], input)); }
export function release(create = false): any {
  const result = spawnSync('gh', ['api', `${endpoint}/tags/${TAG}`], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
  return resolveRelease(result, () => JSON.parse(gh(['api', `${endpoint}?per_page=100`, '--paginate', '--slurp'])).flat(), create ? () => JSON.parse(gh(['api', endpoint, '--method', 'POST', '--input', '-'], {
    tag_name: TAG, target_commitish: run('git', ['rev-parse', 'HEAD']), name: 'Latest WCA data', draft: true, make_latest: 'false', body: '',
  })) : undefined);
}
export function upload(r: any, path: string, name: string) { if (!r.assets.some((a: any) => a.name === name)) gh(['release', 'upload', TAG, path, '--repo', REPO]); }
export function download(r: any, name: string, destination: string) {
  check(r.assets.some((a: any) => a.name === name), `Missing release asset: ${name}`);
  execFileSync('gh', ['release', 'download', TAG, '--repo', REPO, '--pattern', name, '--output', destination], { stdio: ['ignore', 'inherit', 'inherit'], timeout: 300_000 });
}
