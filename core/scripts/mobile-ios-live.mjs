import { spawn, spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { BlockList, createConnection, createServer, isIPv6 } from 'node:net';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { launchAndroid, listAndroidTargets } from './mobile-android-live.mjs';

const mobile = realpathSync(fileURLToPath(new URL('../apps/mobile/', import.meta.url)));
const cache = fileURLToPath(new URL('../../.tmp/cache/ios-live/', import.meta.url));
const bundleId = 'me.cuberoot.app';
// The API already permits this loopback origin for installed-client development.
const port = '1420';
const url = `http://127.0.0.1:${port}`;
const log = join(cache, 'vite.log');
const script = fileURLToPath(import.meta.url);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr?.trim() || `${command} ${args.join(' ')} failed.`);
  return result.stdout?.trim();
}

const sim = (...args) => run('xcrun', ['simctl', ...args]);
const device = (...args) => run('xcrun', ['devicectl', ...args]);

function findDuo() {
  const { devices } = JSON.parse(sim('list', 'devices', 'available', '-j'));
  const matches = Object.values(devices).flat().filter(({ name }) => name === 'iPhone Duo');
  if (matches.length === 1) return matches[0];
  const booted = matches.filter(({ state }) => state === 'Booted');
  if (booted.length === 1) return booted[0];
  throw new Error('请在 Device Hub 中创建或启动一个 iPhone Duo 模拟器。');
}

function listeners(address) {
  const selector = isIPv6(address) ? `-i6TCP@[${address}]:${port}` : `-i4TCP@${address}:${port}`;
  const listener = spawnSync('/usr/sbin/lsof', ['-nP', selector, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
  if (listener.error) throw listener.error;
  if (listener.status === 1 && !listener.stdout.trim() && !listener.stderr.trim()) return [];
  if (listener.status !== 0) throw new Error(`无法检查端口 ${port}。`);
  return listener.stdout.trim().split(/\s+/);
}

function hasMobileServer() {
  const pids = listeners('127.0.0.1');
  if (!pids.length) return false;
  if (pids.length === 1) {
    const pid = pids[0];
    const cwd = run('/usr/sbin/lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn']);
    const command = run('/bin/ps', ['-p', pid, '-o', 'command=']);
    if (cwd.split('\n').includes(`n${mobile}`) && command.includes('/vite/bin/vite.js')) return true;
  }
  throw new Error(`端口 ${port} 已被其他程序占用。关闭该程序后再打开 CubeRoot Dev。`);
}

async function startDetached(command, args, logPath) {
  const output = openSync(logPath, 'a');
  const child = spawn(command, args, { cwd: mobile, detached: true, stdio: ['ignore', output, output] });
  closeSync(output);
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', reject);
  });
  child.unref();
}

async function startServer() {
  if (!hasMobileServer()) {
    await startDetached('pnpm', ['dev', '--port', port, '--strictPort'], log);
  }

  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(700) });
      if (response.ok && (await response.text()).includes('/src/main.tsx') && hasMobileServer()) return;
    } catch (error) {
      if (!(error instanceof TypeError) && error.name !== 'TimeoutError') throw error;
    }
    await delay(250);
  }
  throw new Error(`CubeRoot 开发服务未能启动。日志位于 ${log}`);
}

function installedLiveApp(udid) {
  const result = spawnSync('xcrun', ['simctl', 'get_app_container', udid, bundleId, 'app'], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) return false;
  const config = JSON.parse(readFileSync(join(result.stdout.trim(), 'capacitor.config.json'), 'utf8'));
  return config.server?.url === url;
}

function installLiveApp(udid) {
  run('pnpm', ['ios:build'], { cwd: mobile, env: { ...process.env, TMPDIR: cache }, stdio: 'inherit' });
  const builtApp = join(cache, 'cuberoot-mobile-ios-derived-data/Build/Products/Debug-iphonesimulator/App.app');
  const stage = mkdtempSync(join(cache, 'install-'));
  try {
    const app = join(stage, 'App.app');
    run('/usr/bin/ditto', [builtApp, app]);
    const path = join(app, 'capacitor.config.json');
    const config = JSON.parse(readFileSync(path, 'utf8'));
    config.server = { ...config.server, url };
    writeFileSync(path, JSON.stringify(config, null, 2));
    // Only the staged simulator package sees this URL. Refresh its ad-hoc resource seal.
    run('/usr/bin/codesign', ['--force', '--sign', '-', '--preserve-metadata=entitlements', app]);
    sim('install', udid, app);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

function connectedPhones() {
  const { result } = JSON.parse(device('list', 'devices', '--quiet', '--json-output', '-'));
  return result.devices.filter(({ hardwareProperties, connectionProperties }) =>
    hardwareProperties.reality === 'physical' && hardwareProperties.productType.startsWith('iPhone')
    && connectionProperties.pairingState === 'paired' && connectionProperties.tunnelState === 'connected')
    .map(({ hardwareProperties, deviceProperties }) => ({ id: hardwareProperties.udid, name: deviceProperties.name }));
}

function pairedTunnel(udid) {
  const { result } = JSON.parse(device('device', 'info', 'details', '--device', udid, '--timeout', '15', '--quiet', '--json-output', '-'));
  const peer = result.connectionProperties.tunnelIPAddress;
  if (!isIPv6(peer) || !peer.startsWith('fd')) throw new Error('请解锁 iPhone 并确认它已连接到 Mac。');
  const route = run('/sbin/route', ['-n', 'get', '-inet6', peer]);
  const iface = route.match(/interface:\s+(utun\d+)\b/)?.[1];
  for (const address of networkInterfaces()[iface] ?? []) {
    if (address.family !== 'IPv6' || !address.address.startsWith('fd') || !address.cidr) continue;
    const subnet = new BlockList();
    subnet.addSubnet(address.address, Number(address.cidr.split('/')[1]), 'ipv6');
    if (subnet.check(peer, 'ipv6')) return { host: address.address, peer };
  }
  throw new Error('暂时无法连接 iPhone。请解锁手机后再试一次。');
}

function forwardPairedDevice(host, peer) {
  const server = createServer(client => {
    if (client.remoteAddress !== peer) {
      client.destroy();
      return;
    }
    const upstream = createConnection({ host: '127.0.0.1', port: Number(port) });
    client.on('error', () => upstream.destroy());
    upstream.on('error', () => client.destroy());
    client.on('close', () => upstream.destroy());
    upstream.on('close', () => client.destroy());
    client.pipe(upstream).pipe(client);
  });
  server.listen({ host, port: Number(port), ipv6Only: true });
  setInterval(() => {
    const addresses = Object.values(networkInterfaces()).flat();
    if (!addresses.some(address => address.address === host)) process.exit();
  }, 10_000).unref();
}

async function startPairedProxy({ host, peer }) {
  const args = [script, '--paired-proxy', host, peer];
  if (!listeners(host).length) await startDetached(process.execPath, args, join(cache, 'duo-device.log'));
  for (let attempt = 0; attempt < 30; attempt++) {
    const [pid] = listeners(host);
    if (pid) {
      const command = run('/bin/ps', ['-p', pid, '-o', 'command=']);
      if (command.endsWith(args.join(' '))) return;
      break;
    }
    await delay(200);
  }
  throw new Error('iPhone 的预览连接未能启动。请重试一次。');
}

function installOnPhoneIfNeeded(udid) {
  // Build 5 is the first development build that accepts the per-launch preview URL.
  const { result } = JSON.parse(device('device', 'info', 'apps', '--device', udid, '--timeout', '15',
    '--filter', `bundleIdentifier == '${bundleId}'`, '--quiet', '--json-output', '-'));
  const installed = result.apps[0];
  if (installed?.builtByDeveloper && Number(installed.bundleVersion) >= 5) return;

  const derivedData = join(cache, 'iphoneos');
  run('pnpm', ['cap:sync:ios'], { cwd: mobile, stdio: 'inherit' });
  run('xcrun', ['xcodebuild', '-project', 'ios/App/App.xcodeproj', '-scheme', 'App', '-configuration', 'Debug',
    '-destination', `platform=iOS,id=${udid}`, '-derivedDataPath', derivedData, 'CURRENT_PROJECT_VERSION=5', 'build'],
    { cwd: mobile, stdio: 'inherit' });
  const app = join(derivedData, 'Build/Products/Debug-iphoneos/App.app');
  console.log(device('device', 'install', 'app', '--device', udid, '--timeout', '90', app));
}

async function launchPairedPhone(selected) {
  const phones = connectedPhones();
  const phone = selected ? phones.find(({ id }) => id === selected) : phones.length === 1 ? phones[0] : undefined;
  if (!phone) throw new Error('请选择一台已连接的 iPhone。首次连接请先在 Device Hub 中配对。');
  const udid = phone.id;
  const tunnel = pairedTunnel(udid);
  await startServer();
  await startPairedProxy(tunnel);
  installOnPhoneIfNeeded(udid);
  const environment = JSON.stringify({ CUBEROOT_IOS_LIVE_URL: `http://[${tunnel.host}]:${port}` });
  console.log(device('device', 'process', 'launch', '--device', udid, '--terminate-existing', '--timeout', '20',
    '--environment-variables', environment, bundleId));
}

async function launchSimulatorDuo() {
  const { udid, state } = findDuo();
  await startServer();
  if (state === 'Shutdown') sim('boot', udid);
  sim('bootstatus', udid, '-b');
  if (process.argv.includes('--rebuild') || !installedLiveApp(udid)) installLiveApp(udid);
  console.log(sim('launch', udid, bundleId));
  run('/usr/bin/open', ['-b', 'com.apple.dt.Devices', `devices://device/open?id=${udid}`]);
}

try {
  const [mode, host, peer] = process.argv.slice(2);
  if (mode === '--paired-proxy') {
    forwardPairedDevice(host, peer);
  } else if (mode === '--list-phones') {
    console.log(JSON.stringify(connectedPhones()));
  } else if (mode === '--list-android') {
    console.log(JSON.stringify(listAndroidTargets(run)));
  } else {
    mkdirSync(cache, { recursive: true });
    if (mode === '--device') await launchPairedPhone(host);
    else if (mode === '--android') await launchAndroid(host, { run, mobile, startServer, startDetached, port, log: join(cache, 'android-emulator.log') });
    else await launchSimulatorDuo();
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
