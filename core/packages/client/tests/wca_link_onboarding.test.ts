// 「注册后引导绑定 WCA」的守卫。链路横跨三个包,任一环断掉都是**静默**退化:
//   server   loginWithIdentity 判定这次是不是新建账号 → 4 个登录端点把 isNew 透传出来
//   client   只在 isNew && 还没绑 WCA 时插一步引导,否则照常回跳 ?next=
//   三方那条 微信/QQ/支付宝 授权整页跳走,回来时人已不在表单里 → 回调页打标记,/account 接上
//
// 两种坏法都不会有人报 bug:isNew 丢了 → 新人再也不被问(功能没了);条件写成只看有没有绑
// WCA → 老用户每次登录都被问一遍(更糟,用户只会默默烦)。所以把判定条件本身钉在这儿。
// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { workspaceFixturePath } from './workspace-fixture-path';

const CLIENT = join(__dirname, '..');

const account = readFileSync(
  workspaceFixturePath('@cuberoot/server', 'src', 'utils', 'account.ts'),
  'utf8',
);
const route = readFileSync(
  workspaceFixturePath('@cuberoot/server', 'src', 'routes', 'account_auth.ts'),
  'utf8',
);
const verifiedNameMigration = readFileSync(
  workspaceFixturePath('@cuberoot/server', 'migrations', '0151_wca_verified_display_names.sql'),
  'utf8',
);
const panel = readFileSync(join(CLIENT, 'components/AuthPanel.tsx'), 'utf8');
const page = readFileSync(join(CLIENT, 'app/[lang]/account/page.tsx'), 'utf8');
const socialCb = readFileSync(join(CLIENT, 'app/auth/social/callback/page.tsx'), 'utf8');

describe('server:谁是新注册,只有服务端知道', () => {
  it('loginWithIdentity 连 isNew 一起返回', () => {
    // 登录与注册合流(免用户枚举)后,响应之外没有任何地方能区分两者。
    expect(account).toMatch(/loginWithIdentity[\s\S]{0,400}?Promise<\{\s*user: AppUser;\s*isNew: boolean\s*\}>/);
  });

  it('命中已有身份 = 老用户,并发抢建 = 别人建的,两者都不算新注册', () => {
    // 并发那条分支尤其容易写反:账号确实是这一瞬间建的,但建它的是另一个请求,
    // 本次认领了就会两个请求各引导一次。
    expect(account).toContain('isNew: false');
    expect(account).toContain('isNew: true');
    const from = account.indexOf('export async function loginWithIdentity');
    const body = account.slice(from, account.indexOf('\nexport ', from + 1));
    expect((body.match(/isNew: false/g) ?? []).length).toBe(2);
    expect((body.match(/isNew: true/g) ?? []).length).toBe(1);
  });

  it('五条「登录/注册」合流的路都把 isNew 发出来', () => {
    // 邮箱码 / 手机码 / Google / 国内三方 / 微信小程序 —— 少一条,那条路上的新人就不会被引导。
    // 另外两条会话响应来自纯密码登录和小程序票据换 web 会话:账号天然已存在,不带 isNew。
    const directSessions = route.match(/c\.json\(\{\s*token,\s*user: publicUser\(user\)[^)]*\}\)/g) ?? [];
    const typedSessions = route.match(/const session: WebSession = \{\s*token,\s*user: publicUser\(user\)\s*\};\s*return c\.json\([^;]+\);/g) ?? [];
    const sessions = [...directSessions, ...typedSessions];
    expect(sessions.length).toBe(7);
    expect(sessions.filter((s) => s.includes('isNew')).length).toBe(5);

    const pwAt = route.indexOf("'/auth/email/password'");
    expect(pwAt).toBeGreaterThan(-1);
    expect(route.slice(pwAt, route.indexOf('accountAuthRoutes.', pwAt + 1))).not.toContain('isNew');

    const exchangeAt = route.indexOf("'/auth/web-session/exchange'");
    expect(exchangeAt).toBeGreaterThan(-1);
    expect(route.slice(exchangeAt, route.indexOf('accountAuthRoutes.', exchangeAt + 1))).not.toContain('isNew');
  });

  it('isNew 不进 JWT', () => {
    // 它描述的是「这一次请求」,不是会话属性;签进 365 天的 token 里,等于每次带着它跑。
    expect(route).not.toMatch(/signSession\(\{[^}]*isNew/);
  });
});

describe('client:只问新人,只问一次', () => {
  it('会话响应类型认得 isNew', () => {
    const api = readFileSync(join(CLIENT, 'lib/account-api.ts'), 'utf8');
    expect(api).toMatch(/interface SessionResp[\s\S]{0,300}?isNew\?: boolean/);
  });

  it('引导条件同时看「新注册」和「还没绑 WCA」', () => {
    // 只看 isNew → 用 WCA 注册的人被问「你有 WCA ID 吗」;
    // 只看 hasWca → 每个没绑 WCA 的老用户每次登录都被问一遍。
    expect(page).toMatch(/info\?\.isNew\s*&&\s*!info\.hasWca/);
  });

  it('引导可跳过,跳过后照常回跳 ?next=', () => {
    // 这一步是注册流程的一环,不是收费站。
    expect(page).toMatch(/<WcaLinkPrompt[^>]*onSkip=\{leave\}/);
  });

  it('三方注册那条路留标记,/account 消费掉', () => {
    expect(socialCb).toMatch(/r\.isNew\s*&&\s*!r\.user\.wcaId/);
    expect(socialCb).toContain('markWcaLinkPrompt()');
    expect(page).toContain('takeWcaLinkPrompt()');
  });
});

describe('引导只给 OAuth 一条路', () => {
  const from = panel.indexOf('export function WcaLinkPrompt');
  const body = panel.slice(from, panel.indexOf('\nconst PROVIDER_LABEL', from));

  it('WcaLinkPrompt 存在且走 WCA 授权', () => {
    expect(from).toBeGreaterThan(-1);
    expect(body).toContain('startWcaLink');
  });

  it('不给手填 WCA ID 的输入框', () => {
    // 手填没有所有权证明 —— 等于让任何人认领别人的成绩和纪录。绑定必须由 WCA 授权回来。
    expect(body).not.toContain('<input');
  });
});

describe('WCA 实名锁定用户名', () => {
  it('绑定 WCA 时用授权资料里的官方姓名覆盖展示名', () => {
    expect(route).toContain("addIdentity(uid, 'wca', me.wca_id, me.wca_id, verifiedName, me.avatar?.url ?? null)");
    expect(account).toMatch(/provider === 'wca'[\s\S]{0,500}?display_name = \$\{verifiedDisplayName \?\? ''\}/);
  });

  it('已绑定账号从 WCA 缓存回填官方姓名', () => {
    expect(verifiedNameMigration).toMatch(/UPDATE app_users AS u[\s\S]*SET display_name = BTRIM\(w\.name\)[\s\S]*FROM wca_users AS w/);
    expect(verifiedNameMigration).toContain('u.wca_id = w.wca_id');
    expect(verifiedNameMigration).toContain("NULLIF(BTRIM(w.name), '') IS NOT NULL");
  });

  it('以后每次 WCA 登录都会刷新官方姓名', () => {
    expect(account).toContain("provider === 'wca' && profile.name");
    expect(account).toContain("CASE WHEN ? = 'wca' THEN ?");
  });

  it('后端写入以 wca_id IS NULL 为原子闸门', () => {
    expect(account).toMatch(/UPDATE app_users SET display_name = \? WHERE id = \? AND wca_id IS NULL/);
    expect(route).toContain('WCA-linked accounts use their verified WCA name');
  });

  it('前端对 WCA 用户隐藏修改入口并说明实名来源', () => {
    expect(page).toContain('const wcaLocked = Boolean(profile.wcaId)');
    expect(page).toContain('!editing && !wcaLocked');
    expect(page).toContain('已绑定 WCA，用户名使用 WCA 实名。');
  });
});

// ── 标记本身的行为(三方那条路全靠它把引导接上)──
type FakeSS = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
function makeSessionStorage(): FakeSS {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}
function makeThrowingSessionStorage(): FakeSS {
  return {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceededError'); },
    removeItem() { throw new Error('SecurityError'); },
  };
}

// store 初始化时就读 window / localStorage,globals 必须先于 import 就位(同 auth-store-quota)。
const g = globalThis as unknown as { window?: unknown; localStorage?: unknown; sessionStorage?: FakeSS };
g.window = { addEventListener() {} };
g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
g.sessionStorage = makeSessionStorage();

const { markWcaLinkPrompt, takeWcaLinkPrompt } = await import('@/lib/auth-store');

describe('markWcaLinkPrompt / takeWcaLinkPrompt', () => {
  beforeEach(() => { g.sessionStorage = makeSessionStorage(); });
  afterEach(() => { vi.useRealTimers(); });

  it('没打过标记就不引导', () => {
    expect(takeWcaLinkPrompt()).toBe(false);
  });

  it('打了标记引导一次,读完即清', () => {
    // 不清就会每次进 /account 都被问 —— 这一步只属于注册那一刻。
    markWcaLinkPrompt();
    expect(takeWcaLinkPrompt()).toBe(true);
    expect(takeWcaLinkPrompt()).toBe(false);
  });

  it('注册完先去逛了很久,回来就别再突然发问', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    markWcaLinkPrompt();
    vi.setSystemTime(new Date('2026-01-01T00:09:00Z'));
    // 9 分钟内仍算同一次注册流程
    expect(takeWcaLinkPrompt()).toBe(true);

    markWcaLinkPrompt();
    vi.setSystemTime(new Date('2026-01-01T00:20:00Z'));
    expect(takeWcaLinkPrompt()).toBe(false);
  });

  it('sessionStorage 不可用(隐私模式)时安静降级,不炸登录', () => {
    // 引导从来不是必经环节,账号页的绑定入口一直在。
    g.sessionStorage = makeThrowingSessionStorage();
    expect(() => markWcaLinkPrompt()).not.toThrow();
    expect(takeWcaLinkPrompt()).toBe(false);
  });
});
