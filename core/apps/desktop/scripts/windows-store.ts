/** MSIX preparation only. No upload, signing, store purchase or website publication. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const desktop = resolve(import.meta.dirname, '..');
const repo = resolve(desktop, '../../..');
const target = 'x86_64-pc-windows-msvc';
const icons = { 'StoreLogo.png': 50, 'Square44x44Logo.png': 44, 'Square150x150Logo.png': 150 };

export interface StoreIdentity {
  name: string;
  publisher: string;
  publisherDisplayName: string;
  version: string;
}

export function readIdentity(env: NodeJS.ProcessEnv): StoreIdentity {
  const required = (key: string) => {
    const value = env[key];
    if (!value || value !== value.trim() || /[\x00-\x1f<>]/.test(value)
      || /REPLACE|PLACEHOLDER|YOUR_|TODO/i.test(value)) throw new Error(`Set ${key} from Partner Center (version must be chosen explicitly)`);
    return value;
  };
  const name = required('WINDOWS_STORE_IDENTITY_NAME');
  const publisher = required('WINDOWS_STORE_PUBLISHER');
  const publisherDisplayName = required('WINDOWS_STORE_PUBLISHER_DISPLAY_NAME');
  const version = required('WINDOWS_STORE_VERSION');
  if (!/^[A-Za-z0-9.-]{3,50}$/.test(name)) throw new Error('Invalid Microsoft package identity name');
  if (!publisher.startsWith('CN=') || publisher.length > 8192) throw new Error('Use the exact Package/Identity/Publisher from Partner Center');
  if (publisherDisplayName.length > 256) throw new Error('Publisher display name is too long');
  const parts = version.split('.');
  if (parts.length !== 4 || parts.some(p => !/^(0|[1-9]\d*)$/.test(p) || Number(p) > 65535)
    || Number(parts[0]) === 0 || parts[3] !== '0') throw new Error('Store version must be Major.Minor.Build.0, major > 0, each component <= 65535');
  return { name, publisher, publisherDisplayName, version };
}

const xml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&apos;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export function renderManifest(identity: StoreIdentity): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:uap3="http://schemas.microsoft.com/appx/manifest/uap/windows10/3"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap uap3 rescap">
  <Identity Name="${xml(identity.name)}" Publisher="${xml(identity.publisher)}" Version="${identity.version}" ProcessorArchitecture="x64" />
  <Properties>
    <DisplayName>CubeRoot</DisplayName>
    <PublisherDisplayName>${xml(identity.publisherDisplayName)}</PublisherDisplayName>
    <Logo>Assets\\StoreLogo.png</Logo>
  </Properties>
  <Resources><Resource Language="en-US" /><Resource Language="zh-CN" /></Resources>
  <Dependencies><TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.26100.0" /></Dependencies>
  <Applications>
    <Application Id="CubeRoot" Executable="cuberoot-desktop.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements DisplayName="CubeRoot" Description="CubeRoot" BackgroundColor="transparent"
        Square150x150Logo="Assets\\Square150x150Logo.png" Square44x44Logo="Assets\\Square44x44Logo.png" />
      <Extensions>
        <uap3:Extension Category="windows.protocol">
          <uap3:Protocol Name="me.cuberoot.app" Parameters="&quot;%1&quot;" />
        </uap3:Extension>
      </Extensions>
    </Application>
  </Applications>
  <Capabilities>
    <Capability Name="internetClient" />
    <rescap:Capability Name="runFullTrust" />
    <DeviceCapability Name="bluetooth" />
    <DeviceCapability Name="microphone" />
  </Capabilities>
</Package>
`;
}

export function verifyX64Executable(bytes: Buffer): void {
  if (bytes.length < 64 || bytes.toString('ascii', 0, 2) !== 'MZ') throw new Error('Expected a Windows PE executable');
  const offset = bytes.readUInt32LE(0x3c);
  if (offset + 6 > bytes.length || bytes.toString('ascii', offset, offset + 4) !== 'PE\0\0'
    || bytes.readUInt16LE(offset + 4) !== 0x8664) throw new Error('Expected an x64 PE executable');
}

function checkInputs() {
  const config = JSON.parse(readFileSync(join(desktop, 'src-tauri/tauri.conf.json'), 'utf8'));
  if (config.identifier !== 'me.cuberoot.desktop' || config.productName !== 'CubeRoot'
    || JSON.stringify(config.plugins['deep-link'].desktop.schemes) !== '["me.cuberoot.app"]') {
    throw new Error('Desktop identity/protocol changed: review the MSIX manifest before building');
  }
  for (const [name, size] of Object.entries(icons)) {
    const data = readFileSync(join(desktop, 'src-tauri/icons', name));
    if (data.length < 24 || data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
      || data.readUInt32BE(16) !== size || data.readUInt32BE(20) !== size) throw new Error(`Invalid Store asset: ${name}`);
  }
}

function run(command: string, args: string[], cwd = desktop, env = process.env): void {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}

function findMakeAppx(): string {
  const bin = join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Windows Kits', '10', 'bin');
  const versions = readdirSync(bin).filter(v => /^10\.0\.\d+\.0$/.test(v)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  const found = versions.map(v => join(bin, v, 'x64', 'makeappx.exe')).find(existsSync);
  if (!found) throw new Error('Install the Windows 10/11 SDK with MakeAppx');
  return found;
}

export function main(mode: string | undefined): void {
  if (mode !== 'check' && mode !== 'build') throw new Error('Usage: windows-store.ts check|build');
  const identity = readIdentity(process.env);
  checkInputs();
  const manifest = renderManifest(identity);
  if (mode === 'check') {
    console.log(JSON.stringify({ ...identity, arch: 'x64', channel: 'microsoft-store', payment: 'existing-membership', signing: 'unsigned-for-store', nativeBuild: 'not-run' }, null, 2));
    return;
  }
  if (process.platform !== 'win32') throw new Error('MSIX native build requires Windows; use store:check on macOS');
  const makeAppx = findMakeAppx();
  // A Store candidate is tied to an exact clean revision, never a mixture of jobs.
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' });
  const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: repo, encoding: 'utf8' });
  const commit = revision.stdout?.trim();
  if (revision.status !== 0 || !/^[a-f0-9]{40}$/.test(commit) || status.status !== 0 || status.stdout.trim()) {
    throw new Error('Store candidate builds require a clean checkout at an exact commit');
  }
  const base = join(repo, '.local-data/windows-store');
  mkdirSync(base, { recursive: true });
  const output = mkdtempSync(join(base, `${identity.version}-${commit.slice(0, 12)}-`));
  const stage = join(output, 'package');
  const artifacts = join(output, 'artifacts');
  mkdirSync(join(stage, 'Assets'), { recursive: true });
  mkdirSync(artifacts);
  const override = join(output, 'tauri-store.conf.json');
  writeFileSync(override, JSON.stringify({ version: identity.version.split('.').slice(0, 3).join('.'), bundle: { resources: null, createUpdaterArtifacts: false } }, null, 2));
  // Invoke the installed CLI's Node bin, not a Windows .cmd shim or shell string.
  const tauriCli = createRequire(import.meta.url).resolve('@tauri-apps/cli/tauri.js');
  const cargoTarget = join(base, 'target');
  run(process.execPath, [tauriCli, 'build', '--no-bundle', '--target', target,
    '--features', 'microsoft-store', '--config', override, '--', '--locked'], desktop, { ...process.env, CARGO_TARGET_DIR: cargoTarget });
  const executable = join(cargoTarget, target, 'release/cuberoot-desktop.exe');
  verifyX64Executable(readFileSync(executable));
  copyFileSync(executable, join(stage, 'cuberoot-desktop.exe'));
  for (const name of Object.keys(icons)) copyFileSync(join(desktop, 'src-tauri/icons', name), join(stage, 'Assets', name));
  writeFileSync(join(stage, 'AppxManifest.xml'), manifest);
  const filename = `CubeRoot-${identity.version}-x64.msix`;
  const msix = join(artifacts, filename);
  // Keep schema/semantic validation enabled: never pass MakeAppx /nv.
  run(makeAppx, ['pack', '/d', stage, '/p', msix, '/o']);
  const bytes = readFileSync(msix);
  const receipt = { schemaVersion: 1, commit, ...identity, arch: 'x64', channel: 'microsoft-store',
    payment: 'existing-membership', signed: false, submitted: false, builtAt: new Date().toISOString(),
    filename, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    executableSha256: createHash('sha256').update(readFileSync(executable)).digest('hex') };
  copyFileSync(join(stage, 'AppxManifest.xml'), join(artifacts, 'AppxManifest.xml'));
  writeFileSync(join(artifacts, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(`Unsigned Store candidate: ${artifacts}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv[2]);
