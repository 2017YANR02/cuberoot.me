import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, win32, posix } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export function localPaths(platform = process.platform, home = homedir(), env = process.env) {
  const path = platform === 'win32' ? win32 : posix;
  const data = platform === 'win32' ? (env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'))
    : platform === 'darwin' ? path.join(home, 'Library', 'Application Support')
      : (env.XDG_DATA_HOME || path.join(home, '.local', 'share'));
  return { desktop: path.join(home, 'Desktop'), profile: path.join(data, 'DouyinTranscript', 'browser-profile') };
}

export async function browserExecutable(home = homedir(), env = process.env) {
  if (env.DOUYIN_BROWSER_EXECUTABLE) {
    if (!existsSync(env.DOUYIN_BROWSER_EXECUTABLE)) throw new Error('DOUYIN_BROWSER_EXECUTABLE 指向的浏览器不存在。');
    return env.DOUYIN_BROWSER_EXECUTABLE;
  }
  // Existing installations keep their browser; other computers use the package's Chromium.
  try {
    const config = JSON.parse(await readFile(join(home, '.codex', 'playwright-mcp.json'), 'utf8'));
    const candidate = config.browser?.launchOptions?.executablePath;
    if (candidate && existsSync(candidate)) return candidate;
  } catch { /* Codex is optional. */ }
  const { chromium } = await import('playwright');
  return chromium.executablePath();
}

export async function disableWebRTC(context) {
  const canonical = join(homedir(), '.codex', 'bin', 'pw-no-webrtc.cjs');
  const guard = require(existsSync(canonical) ? canonical : './pw-no-webrtc.cjs');
  return guard.disableWebRTC(context);
}
