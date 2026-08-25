// 「一个账号只能绑一个邮箱、一个手机号」的分层守卫。两条凭据同一套规矩,约束各铺三层,
// 任何一层被摘掉都不该静默:
//   DB      migrations/0078(邮箱)/ 0103(手机)的偏唯一索引 —— 唯一真保证(挡并发)
//   server  addIdentity 先行检查 → 'has-email' / 'has-phone',路由回对应错误串
//   client  authErrorText 认这个串,给「请先解绑现有的」;面板已有该凭据时不渲染绑定入口
//
// 重点是**跨包字面量耦合**:服务端错误串和前端 includes() 匹配靠一模一样的英文句子对上。
// 谁顺手改一边措辞,前端就会静默退化成把英文原文糊到用户脸上 —— 这类退化没人会在 review
// 里看出来,所以钉在这儿。CI 跑 client vitest(server 包无测试集),故跨包扫源码。
// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { workspaceFixturePath } from './workspace-fixture-path';

const SERVER = workspaceFixturePath('@cuberoot/server');
const CLIENT = join(__dirname, '..');

/** 三层共用的契约串。改任何一条 = 三处一起改,这张表就是提醒。 */
const CREDS = [
  {
    provider: 'email',
    index: 'uq_auth_identity_one_email',
    /** addIdentity 的返回值 → 路由的 409 错误串 → 前端 authErrorText 的 includes()。 */
    errorKey: 'account already has an email',
    /** 同一路由里的「已被他人占用」,是另一回事,必须排在上面那条之后。 */
    takenKey: 'email already linked to another account',
    replaceRoute: '/auth/email/replace',
  },
  {
    provider: 'phone',
    index: 'uq_auth_identity_one_phone',
    errorKey: 'account already has a phone',
    takenKey: 'phone already linked to another account',
    replaceRoute: '/auth/phone/replace',
  },
] as const;

const account = readFileSync(join(SERVER, 'src/utils/account.ts'), 'utf8');
const route = readFileSync(join(SERVER, 'src/routes/account_auth.ts'), 'utf8');
const panel = readFileSync(join(CLIENT, 'components/AuthPanel.tsx'), 'utf8');
const migrations = readdirSync(join(SERVER, 'migrations')).filter((f) => f.endsWith('.sql'));
const sql = migrations.map((f) => readFileSync(join(SERVER, 'migrations', f), 'utf8')).join('\n');

describe.each(CREDS)('$provider:三层约束', ({ provider, index, errorKey, takenKey, replaceRoute }) => {
  it('DB 有 user_id 上的偏唯一索引', () => {
    expect(sql).toContain(index);
    // 必须是 partial(WHERE provider = '…'):不带 WHERE 会把「每人至多一条身份」全锁死,
    // 另一条凭据 + WCA + 三方就再也绑不上了。
    const idx = sql.slice(sql.indexOf(index));
    expect(idx).toMatch(/ON\s+auth_identities\s*\(\s*user_id\s*\)/i);
    expect(idx).toMatch(new RegExp(`WHERE\\s+provider\\s*=\\s*'${provider}'`, 'i'));
  });

  it('并发兜底:addIdentity 认索引名把唯一约束冲突还原成 has-…', () => {
    // 先行检查挡不住并发双绑,晚到的那条由索引抛错落进 catch。不认索引名就会被误报成
    // 「已被他人占用」,用户按提示去解绑别人的凭据 —— 找不到,卡死。
    expect(account).toContain(index);
  });

  it('绑定路由用专属错误串回 409,且排在通用 conflict 之前', () => {
    // 只在 link/<provider>/verify 这一个 handler 里比顺序 —— 换绑路由也带同一句 takenKey,
    // 拿全文件 indexOf 比会比到另一个 handler 上去。
    const from = route.indexOf(`'/auth/link/${provider}/verify'`);
    expect(from).toBeGreaterThan(-1);
    const next = route.indexOf('accountAuthRoutes.post(', from + 1);
    const handler = route.slice(from, next === -1 ? undefined : next);
    const at = handler.indexOf(errorKey);
    expect(at).toBeGreaterThan(-1);
    // 两者给用户的话完全不同:一个是「去解绑你自己的」,一个是「这是别人的」。
    // 排在后面就永远走不到。
    expect(at).toBeLessThan(handler.indexOf(takenKey));
  });

  it('authErrorText 认得服务端那个串(跨包契约)', () => {
    expect(panel).toContain(errorKey);
  });

  it('已有该凭据时不渲染绑定入口', () => {
    // 否则会和上面「邮箱 xxx@x 解绑」那行撞脸,看着像重复渲染 —— 这正是最初的报障。
    const has = provider === 'email' ? 'hasEmail' : 'hasPhone';
    expect(panel).toMatch(new RegExp(`avail\\.${provider}\\s*&&\\s*!${has}`));
  });

  it('有换绑端点', () => {
    expect(route).toContain(replaceRoute);
  });
});

describe('server 层:单条凭据的先行检查', () => {
  it("addIdentity 有独立的 'has-<provider>' 状态,不并进 'conflict'", () => {
    // 邮箱和手机共用同一段先行检查,名单是 SINGLE_PER_ACCOUNT —— 少了谁,那条凭据就能绑多个。
    expect(account).toMatch(/SINGLE_PER_ACCOUNT\s*=\s*\['email',\s*'phone'\]/);
    expect(account).toContain('return `has-${provider}`');
  });
});

describe('换绑出口(约束不能把人关死)', () => {
  // 唯一凭据 + 「唯一的登录方式不许解绑」两条规矩一夹,只有邮箱(或只有手机号)的账号
  // 就再也换不了。出口是原地 UPDATE,少了它这个约束就是个陷阱。
  it('服务端有原地替换,不是先删后加', () => {
    expect(account).toContain('replaceCredentialIdentity');
    // 切到下一个顶层声明为止 —— 切到文件尾会把后面 removeIdentity 的 DELETE 也算进来。
    const from = account.indexOf('export async function replaceCredentialIdentity');
    const rest = account.slice(from + 1);
    const to = rest.search(/\nexport /);
    const fn = to === -1 ? rest : rest.slice(0, to);
    expect(fn).toMatch(/UPDATE\s+auth_identities/i);
    // 必须锁行:并发两次换绑各读旧值再各改一次,后写的赢、前一次静默丢失。
    expect(fn).toMatch(/FOR\s+UPDATE/i);
    // 绝不能出现删除 —— 那就又回到「零登录方式」的中间态了。
    expect(fn).not.toMatch(/DELETE\s+FROM/i);
  });

  it('面板给了「更换」入口', () => {
    expect(panel).toContain('replaceEmailVerify');
    expect(panel).toContain('replacePhoneVerify');
    expect(panel).toMatch(/i\.provider === 'email' \|\| i\.provider === 'phone'/);
  });
});
