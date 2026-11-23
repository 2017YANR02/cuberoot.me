import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const packageId = 'me.cuberoot.app.debug';
const liveAction = `${packageId}.LIVE_RELOAD`;
const liveActivity = 'me.cuberoot.app.LiveReloadActivity';

function androidTools() {
  const sdk = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, join(homedir(), 'Library/Android/sdk')]
    .find(path => path && existsSync(join(path, 'platform-tools/adb')));
  if (!sdk) return;
  return { sdk, adb: join(sdk, 'platform-tools/adb'), emulator: join(sdk, 'emulator/emulator') };
}

function connectedAndroids(adb, run) {
  return run(adb, ['devices', '-l']).split('\n').flatMap(line => {
    const [serial, state] = line.trim().split(/\s+/);
    if (state !== 'device') return [];
    const model = line.match(/\bmodel:(\S+)/)?.[1].replaceAll('_', ' ');
    return [{ serial, model, emulator: serial.startsWith('emulator-') }];
  });
}

export function listAndroidTargets(run) {
  const tools = androidTools();
  if (!tools) return [];
  const avds = existsSync(tools.emulator) ? run(tools.emulator, ['-list-avds']).split('\n').filter(Boolean) : [];
  const simulators = avds.map(avd => ({ id: `avd:${avd}`, name: avds.length === 1 ? 'Android 模拟器' : `Android 模拟器（${avd.replaceAll('_', ' ')}）` }));
  const phones = connectedAndroids(tools.adb, run).filter(device => !device.emulator)
    .map(({ serial, model }) => ({ id: `phone:${serial}`, name: `${model ?? 'Android'}（安卓真机）` }));
  return [...simulators, ...phones];
}

async function bootEmulator({ adb, emulator }, avd, { run, startDetached, log }) {
  if (!existsSync(emulator) || !run(emulator, ['-list-avds']).split('\n').includes(avd)) {
    throw new Error('找不到这个安卓模拟器。请在 Android Studio 中打开设备管理器检查。');
  }
  function findSerial() {
    for (const device of connectedAndroids(adb, run).filter(device => device.emulator)) {
      try {
        const name = run(adb, ['-s', device.serial, 'emu', 'avd', 'name'], { timeout: 4000 }).split('\n')[0].trim();
        if (name === avd) return device.serial;
      } catch {
        // A disconnected or still-starting emulator will be picked up on the next poll.
      }
    }
  }
  let serial = findSerial();
  if (!serial) await startDetached(emulator, ['-avd', avd], log);
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    serial ??= findSerial();
    if (serial) {
      try {
        if (run(adb, ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], { timeout: 5000 }) === '1') return serial;
      } catch {
        serial = undefined;
      }
    }
    await delay(1000);
  }
  throw new Error(`安卓模拟器未能启动。日志位于 ${log}`);
}

function installDebugApp(adb, { run, mobile, sdk }) {
  const homebrewJava = '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
  const java = [process.env.JAVA_HOME, homebrewJava].find(path => path && existsSync(join(path, 'bin/java')))
    ?? run('/usr/libexec/java_home', ['-v', '21']);
  console.log('首次使用，在安卓设备上安装 CubeRoot 开发版。');
  run('pnpm', ['android:apk:debug'], {
    cwd: mobile, env: { ...process.env, JAVA_HOME: java, ANDROID_HOME: sdk }, stdio: 'inherit',
  });
  const apk = join(mobile, 'android/app/build/outputs/apk/debug/app-debug.apk');
  console.log(adb('install', '-r', apk));
}

export async function launchAndroid(target, context) {
  const { run, startServer, port, mobile } = context;
  const tools = androidTools();
  if (!tools) throw new Error('当前 Mac 上找不到 Android SDK。');
  const id = target?.slice(target.indexOf(':') + 1);
  let serial;
  if (id && target.startsWith('avd:')) {
    serial = await bootEmulator(tools, id, context);
  } else if (id && target.startsWith('phone:')) {
    serial = connectedAndroids(tools.adb, run).find(device => !device.emulator && device.serial === id)?.serial;
  }
  if (!serial) throw new Error('请解锁安卓手机，并通过无线调试配对或用数据线连接后允许 USB 调试。');
  const adb = (...args) => run(tools.adb, ['-s', serial, ...args]);
  await startServer();
  const endpoint = `tcp:${port}`;
  const forwards = adb('reverse', '--list').split('\n').map(line => line.trim().split(/\s+/));
  const existing = forwards.find(([, devicePort]) => devicePort === endpoint);
  if (existing && existing[2] !== endpoint) throw new Error(`安卓设备上的端口 ${port} 已被其他调试任务占用。`);
  if (!existing) adb('reverse', '--no-rebind', endpoint, endpoint);
  const activity = adb('shell', 'cmd', 'package', 'resolve-activity', '--brief', '-a', liveAction, '-p', packageId);
  if (process.argv.includes('--rebuild') || !activity.endsWith(liveActivity)) {
    installDebugApp(adb, { run, mobile, sdk: tools.sdk });
  }
  const result = adb('shell', 'am', 'start', '-W', '-S', '-a', liveAction, '-n', `${packageId}/${liveActivity}`);
  if (!result.includes('Status: ok')) throw new Error(result);
  console.log(result);
}
