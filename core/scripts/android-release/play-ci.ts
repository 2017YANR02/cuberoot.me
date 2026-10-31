/** Optional Play submission shares the official CI identity and never needs a developer host. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANDROID_RELEASE_CERTIFICATE, releaseIdentity } from '../../packages/shared/src/android-release.ts';
import { playClient } from './play.ts';

interface PlayArtifact {
  schemaVersion: 1;
  applicationId: 'me.cuberoot.app';
  versionCode: number;
  versionName: string;
  commit: string;
  sha256: string;
  size: number;
  certificateSha256: string;
  notes: string;
}

export function parsePlayArtifact(value: unknown, sequence: number, commit: string, notes: string): PlayArtifact {
  const identity = releaseIdentity(sequence);
  const r = value as PlayArtifact;
  if (!r || r.schemaVersion !== 1 || r.applicationId !== 'me.cuberoot.app'
    || r.versionCode !== identity.versionCode || r.versionName !== identity.versionName
    || !/^[a-f0-9]{40}$/.test(commit) || r.commit !== commit
    || !/^[a-f0-9]{64}$/.test(r.sha256) || !Number.isSafeInteger(r.size) || r.size < 1
    || r.certificateSha256 !== ANDROID_RELEASE_CERTIFICATE
    || typeof notes !== 'string' || !notes.trim() || [...notes].length > 500 || r.notes !== notes) {
    throw new Error('Play artifact does not match this release');
  }
  return r;
}

export function verifyPlayBytes(bytes: Buffer, metadata: PlayArtifact) {
  if (bytes.length !== metadata.size || createHash('sha256').update(bytes).digest('hex') !== metadata.sha256) {
    throw new Error('Play artifact integrity mismatch');
  }
}

function command(program: string, args: string[]) {
  const result = spawnSync(program, args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  // Do not include process output in failures: signing and account diagnostics can contain private data.
  if (result.error || result.status !== 0) throw new Error(`Play verification failed: ${program}`);
  return `${result.stdout}\n${result.stderr}`.trim();
}

function verifySignature(aab: string) {
  // Explicit locale keeps parsing stable across runner images. Self-signed Android certs are expected.
  const verified = command('jarsigner', ['-J-Duser.language=en', '-J-Duser.country=US', '-verify', aab]);
  if (!verified.includes('jar verified.') || /jar is unsigned|unsigned entries/i.test(verified)) throw new Error('AAB is not fully signed');
  const cert = command('keytool', ['-J-Duser.language=en', '-J-Duser.country=US', '-printcert', '-jarfile', aab]);
  const fingerprints = [...cert.matchAll(/SHA256:\s*([A-Fa-f0-9:]+)/g)].map(match => match[1]!.replaceAll(':', '').toLowerCase());
  if (fingerprints.length !== 1 || fingerprints[0] !== ANDROID_RELEASE_CERTIFICATE) throw new Error('Wrong Play upload certificate');
}

export async function main(args: string[], env: NodeJS.ProcessEnv = process.env) {
  if (env.GITHUB_ACTIONS !== 'true') throw new Error('Play release is restricted to CI');
  const [mode, input, outputOrTrack] = args;
  if (args.length !== 3 || !['prepare', 'submit'].includes(mode!) || !input || !outputOrTrack) {
    throw new Error('Expected prepare SIGNED_AAB DIRECTORY or submit DIRECTORY internal|production');
  }
  const identity = releaseIdentity(Number(env.GITHUB_RUN_NUMBER));
  const commit = env.RELEASE_COMMIT ?? '';
  const notes = env.RELEASE_NOTES ?? '';
  // Validate identity and notes before touching signing tools or Google credentials.
  parsePlayArtifact({ schemaVersion: 1, applicationId: 'me.cuberoot.app', ...identity, commit,
    sha256: '0'.repeat(64), size: 1, certificateSha256: ANDROID_RELEASE_CERTIFICATE, notes }, Number(env.GITHUB_RUN_NUMBER), commit, notes);
  if (mode === 'prepare') {
    const aab = resolve(input);
    if (!env.BUNDLETOOL_JAR) throw new Error('Pinned BUNDLETOOL_JAR required');
    verifySignature(aab);
    const manifest = (xpath: string) => command('java', ['-jar', env.BUNDLETOOL_JAR!, 'dump', 'manifest', `--bundle=${aab}`, `--xpath=${xpath}`]);
    if (manifest('/manifest/@package') !== 'me.cuberoot.app'
      || manifest('/manifest/@android:versionCode') !== String(identity.versionCode)
      || manifest('/manifest/@android:versionName') !== identity.versionName) throw new Error('AAB manifest identity mismatch');
    const bytes = readFileSync(aab);
    const metadata = parsePlayArtifact({ schemaVersion: 1, applicationId: 'me.cuberoot.app', ...identity, commit,
      sha256: createHash('sha256').update(bytes).digest('hex'), size: statSync(aab).size,
      certificateSha256: ANDROID_RELEASE_CERTIFICATE, notes }, Number(env.GITHUB_RUN_NUMBER), commit, notes);
    mkdirSync(outputOrTrack, { recursive: true });
    copyFileSync(aab, join(outputOrTrack, 'app-release.aab'));
    writeFileSync(join(outputOrTrack, 'play.json'), JSON.stringify(metadata, null, 2) + '\n');
    console.log(`Verified Play artifact ${identity.versionName} (${identity.versionCode})`);
  } else {
    if (outputOrTrack !== 'internal' && outputOrTrack !== 'production') throw new Error('Unsupported Play track');
    const metadata = parsePlayArtifact(JSON.parse(readFileSync(join(input, 'play.json'), 'utf8')), Number(env.GITHUB_RUN_NUMBER), commit, notes);
    const aab = join(input, 'app-release.aab');
    verifyPlayBytes(readFileSync(aab), metadata);
    verifySignature(aab);
    if (!env.PLAY_SERVICE_ACCOUNT_FILE) throw new Error('Protected Play service-account file required');
    const play = await playClient(env.PLAY_SERVICE_ACCOUNT_FILE);
    const state = await play.inspect();
    if (state.maxVersionCode >= identity.versionCode) throw new Error('Play already contains this or a newer version; inspect the prior submission before starting a new release');
    const receipt = await play.publish(aab, identity.versionCode, outputOrTrack, identity.versionName, notes);
    writeFileSync(join(input, 'play-submission.json'), JSON.stringify({ commit, ...identity, track: outputOrTrack, receipt }, null, 2) + '\n');
    console.log(`Submitted Play ${identity.versionName} (${identity.versionCode}) to ${outputOrTrack}; review and public availability must be checked separately.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
