import test from 'node:test';
import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';
import { createRequire } from 'node:module';
import { localPaths, browserExecutable } from './runtime.mjs';

const require = createRequire(import.meta.url);
const portable = require('./pw-no-webrtc.cjs');

test('Windows keeps the existing login directory and uses Desktop', () => {
  assert.deepEqual(localPaths('win32', 'C:\\Users\\A B', { LOCALAPPDATA: 'D:\\User Data' }), {
    desktop: 'C:\\Users\\A B\\Desktop', profile: 'D:\\User Data\\DouyinTranscript\\browser-profile',
  });
  assert.equal(localPaths('win32', 'C:\\Users\\A', {}).profile, 'C:\\Users\\A\\AppData\\Local\\DouyinTranscript\\browser-profile');
});

test('macOS uses its own Application Support even with stale Windows environment variables', () => {
  assert.deepEqual(localPaths('darwin', '/Users/张三 Test', { LOCALAPPDATA: 'C:\\old' }), {
    desktop: '/Users/张三 Test/Desktop', profile: '/Users/张三 Test/Library/Application Support/DouyinTranscript/browser-profile',
  });
});

test('a machine without Codex resolves the installed Playwright browser; invalid overrides fail', async () => {
  const { chromium } = await import('playwright');
  assert.equal(await browserExecutable('/nonexistent-douyin-test-home', {}), chromium.executablePath());
  await assert.rejects(browserExecutable('/unused', { DOUYIN_BROWSER_EXECUTABLE: '/nonexistent-douyin-browser' }), /不存在/);
});

test('the portable guard works without Codex and blocks WebRTC before page scripts', async () => {
  let script;
  await portable.disableWebRTC({ addInitScript: async callback => { script = callback; } });
  const sandbox = createContext({ window: { RTCPeerConnection: function () {} }, navigator: { mediaDevices: {} } });
  runInContext(`(${script.toString()})()`, sandbox);
  assert.equal(sandbox.window.RTCPeerConnection, undefined);
  await assert.rejects(sandbox.navigator.mediaDevices.getUserMedia(), /WebRTC disabled/);
});
