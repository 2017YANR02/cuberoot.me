/** Completed jobs may retain the verified export and statistics without raw journals. */
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, basename } from 'node:path';

export function verifyRetainedDoubleZbll(work: string): boolean {
  const marker = resolve(work, 'retention.json');
  if (!existsSync(marker)) return false;
  const retained = JSON.parse(readFileSync(marker, 'utf8'));
  if (retained.schema !== 1 || retained.mode !== 'final-results-and-statistics') throw Error('Invalid Double ZBLL retention record');
  const manifestBytes = readFileSync(resolve(work, 'export/manifest.json'));
  if (createHash('sha256').update(manifestBytes).digest('hex') !== retained.manifestSha256) throw Error('Retained Double ZBLL manifest changed');
  const manifest = JSON.parse(manifestBytes.toString());
  if (manifest.pairCount !== 243049 || manifest.caseCount !== 493 || manifest.sourceStates !== 7555446) throw Error('Incomplete retained Double ZBLL export');
  for (const [name, sha] of [[manifest.dataFile, manifest.dataSha256], [manifest.casesFile, manifest.casesSha256]]) {
    if (typeof name !== 'string' || basename(name) !== name) throw Error('Invalid retained artifact path');
    const bytes = readFileSync(resolve(work, 'export', name));
    if (createHash('sha256').update(bytes).digest('hex') !== sha) throw Error(`Retained Double ZBLL hash mismatch: ${name}`);
  }
  return true;
}
