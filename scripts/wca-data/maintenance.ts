import { check, parseManifest, readReleaseBody } from './common.ts';
import { archiveDescriptor } from './snapshot.ts';

export const RETENTION_MS = 7 * 86400000;
export type ReleaseAsset = { id: number; name: string; size: number; created_at: string };
const managedAsset = /^(?:wca-data-[a-f0-9]{64}\.tar|candidate-[a-f0-9]{64}\.json|stats-(?:snapshot|patch)-[a-f0-9]{64}\.tgz)$/;

/** Fail closed before deleting anything; other publication families are untouched. */
export function cleanupPlan(body: string, assets: ReleaseAsset[], now = Date.now()): ReleaseAsset[] {
  const value = readReleaseBody(body), manifest = parseManifest(value);
  const current = [manifest.archive];
  if (value.statistics) {
    const statistics = archiveDescriptor(value.statistics);
    check(statistics.name.startsWith('stats-snapshot-'), 'Current statistics must be a snapshot');
    current.push(statistics);
  }
  for (const archive of current) check(assets.some(a => a.name === archive.name && a.size === archive.bytes), `Current archive missing or incomplete: ${archive.name}`);
  const keep = new Set(current.map(a => a.name));
  // A newly staged candidate can reuse an old content-addressed archive.
  for (const asset of assets) if (/^candidate-[a-f0-9]{64}\.json$/.test(asset.name)
    && !(now - Date.parse(asset.created_at) >= RETENTION_MS)) keep.add(`wca-data-${asset.name.slice(10, -5)}.tar`);
  return assets.filter(a => managedAsset.test(a.name) && !keep.has(a.name) && now - Date.parse(a.created_at) >= RETENTION_MS);
}
