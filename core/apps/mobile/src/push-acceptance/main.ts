import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { NotificationOpenQueue } from '@cuberoot/app-ui/notification-navigation';
import { NOTIFICATION_PUSH_KINDS, parseNotificationOpen, type NotificationOpen } from '@cuberoot/shared/notification-push';
import type { WebSession } from '@cuberoot/shared/auth/web-session';
import { RecordPushController } from '../native/record-push-controller';
import { recordPushPlugin } from '../native/record-push-plugin';
import { addNotificationOpenListener } from '../native/notification-open';
import { acceptanceRequest } from './config';

declare const __PUSH_ACCEPTANCE_API_ORIGIN__: string;
const request = acceptanceRequest(__PUSH_ACCEPTANCE_API_ORIGIN__);
const root = document.getElementById('root')!;
root.innerHTML = `<h1>推送隔离验收 / Push acceptance</h1>
<p>仅临时身份与内存数据；不发送系统通知，不打开生产页面。<br>Fixture accounts and memory only. No system delivery or production pages.</p>
<p id="origin"></p><p id="adapter"></p>
<p><label>配对令牌 / Pairing token <input id="pairing" type="password" autocomplete="off"></label></p>
<p><label>测试账号 / Test account <select id="uid"><option value="900001">A (900001)</option><option value="900002">B (900002)</option></select></label>
<button id="connect">连接并绑定 / Connect & bind</button> <button id="logout">退出并撤销 / Logout & revoke</button></p>
<p><label>通知类型 / Kind <select id="kind"></select></label> <button id="generate">生成测试通知 / Generate fixture</button></p>
<p><label><input type="checkbox" id="blocked">暂缓跳转 / Defer navigation</label> <button id="tap">模拟点击 / Simulate tap</button></p>
<p id="status" role="status"></p><pre id="payload"></pre><p id="destination"></p>`;
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
element('origin').textContent = `API: ${__PUSH_ACCEPTANCE_API_ORIGIN__}`;
const native = Capacitor.isNativePlatform();
async function nativeTestStatus() {
  const id = (await App.getInfo()).id;
  const state = await recordPushPlugin.status();
  if (Capacitor.getPlatform() === 'android' && id !== 'me.cuberoot.app.debug') throw new Error('Use an Android Debug host');
  if (Capacitor.getPlatform() === 'ios' && (state.provider !== 'apns' || state.environment !== 'sandbox')) throw new Error('Use an iOS development/sandbox host');
  if (__PUSH_ACCEPTANCE_API_ORIGIN__.startsWith('http:')) throw new Error('Native acceptance requires a trusted private HTTPS endpoint');
  return state;
}
element('adapter').textContent = native ? '原生注册 adapter / Native registration adapter (may contact APNs/Getui)' : '浏览器模拟 adapter / Browser fixture adapter';
for (const kind of NOTIFICATION_PUSH_KINDS) {
  const option = document.createElement('option'); option.value = kind; option.textContent = kind;
  element<HTMLSelectElement>('kind').append(option);
}
// Never read production Keychain/session/device identities. This process owns all state.
const memory = new Map<string, string>();
let mockEnabled = false;
let session: WebSession | null = null;
let ready = false;
let notification: NotificationOpen | null = null;
const opened = new NotificationOpenQueue();
const status = (message: string) => { element('status').textContent = message; };
const flush = () => {
  const destination = opened.take(session?.user.uid, ready, element<HTMLInputElement>('blocked').checked);
  if (destination) element('destination').textContent = `目标路径（不导航） / Destination (not navigated): ${destination}`;
  else status('无跳转：等待、重复或账号不匹配 / No navigation: pending, duplicate or account mismatch');
};
const controller = new RecordPushController({
  storage: { async getItem(key) { return memory.get(key) ?? null; }, async setItem(key, value) { memory.set(key, value); }, async removeItem(key) { memory.delete(key); } },
  appId: async () => {
    if (!native) return 'me.cuberoot.app.debug';
    const id = (await App.getInfo()).id;
    if (Capacitor.getPlatform() === 'android' && id !== 'me.cuberoot.app.debug') throw new Error('Use an Android Debug host');
    return id;
  },
  identity: () => ({ installationId: crypto.randomUUID(), secret: Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('') }),
  request: (method, path, body, token) => request(method, `/v1${path}`, body, token),
  async status() {
    if (!native) return { configured: true, enabled: mockEnabled, clientId: 'fixture-client-id-0001' };
    return nativeTestStatus();
  },
  async start() { if (native) { await nativeTestStatus(); return recordPushPlugin.start(); } mockEnabled = true; return { configured: true, enabled: true, clientId: 'fixture-client-id-0001' }; },
  async stop() { if (native) { await nativeTestStatus(); return recordPushPlugin.stop(); } mockEnabled = false; },
});
// Subscribe before pairing/auth so genuine native cold taps use the same queue.
void addNotificationOpenListener(value => { opened.offer(value); flush(); }).catch(() => status('原生回调不可用 / Native callback unavailable'));
let busy = false;
function action(id: string, run: () => Promise<void>) {
  element(id).onclick = async () => {
    if (busy) return; busy = true;
    try { await run(); } catch { status('请求未完成，请核对隔离 API、令牌或本机配置 / Request failed; check fixture API, pairing or native configuration'); }
    finally { busy = false; }
  };
}
action('connect', async () => {
  const next = await request('POST', '/__acceptance/session', { uid: Number(element<HTMLSelectElement>('uid').value) }, element<HTMLInputElement>('pairing').value);
  session = next as WebSession;
  ready = true;
  await controller.sync(session);
  flush();
  const state = await request('GET', '/__acceptance/status', undefined, session.token);
  status(state.bound ? '测试设备已绑定 / Fixture device bound' : '未绑定，等待原生 token 或核对配置 / Unbound; await native token or check configuration');
});
action('logout', async () => {
  await controller.logout(); session = null; ready = true; notification = null; flush();
  element('payload').textContent = ''; element('destination').textContent = '';
  status('已撤销测试绑定 / Fixture binding revoked');
});
action('generate', async () => {
  if (!session) throw new Error();
  const fixture = await request('POST', '/__acceptance/notification', { kind: element<HTMLSelectElement>('kind').value }, session.token);
  notification = parseNotificationOpen(fixture.notification);
  element('payload').textContent = JSON.stringify(notification, null, 2);
  status('仅生成 payload，未发送 / Payload generated; not sent');
});
action('tap', async () => { if (notification) { opened.offer(notification); flush(); } });
element('blocked').onchange = flush;
