// 「一个账号只能绑一个邮箱」的分层守卫。约束铺了三层,任何一层被摘掉都不该静默:
//   DB      migrations/0078 的偏唯一索引 uq_auth_identity_one_email —— 唯一真保证(挡并发)
//   server  addIdentity 先行检查 → 'has-email',路由回 `account already has an email`
//   client  authErrorText 认这个串,给「请先解绑现有邮箱」;面板已有邮箱时不渲染绑定入口
//
// 重点是**跨包字面量耦合**:服务端错误串和前端 includes() 匹配靠一模一样的英文句子对上。
// 谁顺手改一边措辞,前端就会静默退化成把英文原文糊到用户脸上 —— 这类退化没人会在 review
// 里看出来,所以钉在这儿。CI 跑 client vitest(server 包无测试集),故跨包扫源码。
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SERVER = join(__dirname, '../../server');
const CLIENT = join(__dirname, '..');

/** 三层共用的契约串。改它 = 三处一起改,这个常量就是提醒。 */
const ERROR_KEY = 'account already has an email';
const INDEX_NAME = 'uq_auth_identity_one_email';

describe('DB 层:偏唯一索引', () => {
  const migrations = readdirSync(join(SERVER, 'migrations')).filter((f) => f.endsWith('.sql'));
  const sql = migrations.map((f) => readFileSync(join(SERVER, 'migrations', f), 'utf8')).join('\n');

  it('建了 user_id 上 provider=email 的偏唯一索引', () => {
    expect(sql).toContain(INDEX_NAME);
    // 必须是 partial(WHERE provider = 'email'):不带 WHERE 会把「每人至多一条身份」全锁死,
    // WCA / Google / 手机 就再也绑不上了。
    const idx = sql.slice(sql.indexOf(INDEX_NAME));
    expect(idx).toMatch(/ON\s+auth_identities\s*\(\s*user_id\s*\)/i);
    expect(idx).toMatch(/WHERE\s+provider\s*=\s*'email'/i);
  });
});

describe('server 层', () => {
  const account = readFileSync(join(SERVER, 'src/utils/account.ts'), 'utf8');
  const route = readFileSync(join(SERVER, 'src/routes/account_auth.ts'), 'utf8');

  it("addIdentity 有独立的 'has-email' 状态,不并进 'conflict'", () => {
    // 两者给用户的话完全不同:一个是「去解绑你自己的」,一个是「这是别人的」。
    expect(account).toContain("'has-email'");
    expect(account).toMatch(/provider === 'email'/);
  });

  it('并发兜底:认索引名把唯一约束冲突还原成 has-email', () => {
    // 先行检查挡不住并发双绑,晚到的那条由索引抛错落进 catch。不认索引名就会被误报成
    // 「已被他人占用」,用户按提示去解绑别人的邮箱 —— 找不到,卡死。
    expect(account).toContain(INDEX_NAME);
  });

  it('link/email/verify 用专属错误串回 409', () => {
    expect(route).toContain(ERROR_KEY);
    const at = route.indexOf(ERROR_KEY);
    // 必须排在通用 conflict 分支之前,否则永远走不到。
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(route.indexOf('email already linked to another account'));
  });
});

describe('换绑出口(约束不能把人关死)', () => {
  const account = readFileSync(join(SERVER, 'src/utils/account.ts'), 'utf8');
  const route = readFileSync(join(SERVER, 'src/routes/account_auth.ts'), 'utf8');
  const panel = readFileSync(join(CLIENT, 'components/AuthPanel.tsx'), 'utf8');

  // 唯一邮箱 + 「唯一的登录方式不许解绑」两条规矩一夹,只有邮箱的账号(上线时 22 个)
  // 就再也换不了邮箱。出口是原地 UPDATE,少了它这个约束就是个陷阱。
  it('服务端有原地替换,不是先删后加', () => {
    expect(account).toContain('replaceEmailIdentity');
    // 切到下一个顶层声明为止 —— 切到文件尾会把后面 removeIdentity 的 DELETE 也算进来。
    const from = account.indexOf('export async function replaceEmailIdentity');
    const rest = account.slice(from + 1);
    const to = rest.search(/\nexport /);
    const fn = to === -1 ? rest : rest.slice(0, to);
    expect(fn).toMatch(/UPDATE\s+auth_identities/i);
    // 必须锁行:并发两次换绑各读旧值再各改一次,后写的赢、前一次静默丢失。
    expect(fn).toMatch(/FOR\s+UPDATE/i);
    // 绝不能出现删除 —— 那就又回到「零登录方式」的中间态了。
    expect(fn).not.toMatch(/DELETE\s+FROM/i);
  });

  it('有 /auth/email/replace 端点', () => {
    expect(route).toContain('/auth/email/replace');
  });

  it('邮箱那行给了「更换」入口', () => {
    expect(panel).toContain('replaceEmailVerify');
    expect(panel).toMatch(/i\.provider === 'email'/);
  });
});

describe('client 层', () => {
  const panel = readFileSync(join(CLIENT, 'components/AuthPanel.tsx'), 'utf8');

  it('authErrorText 认得服务端那个串(跨包契约)', () => {
    expect(panel).toContain(ERROR_KEY);
  });

  it('已有邮箱时不渲染「绑定邮箱」入口', () => {
    // 否则会和上面「邮箱 xxx@x 解绑」那行撞脸,看着像重复渲染 —— 这正是最初的报障。
    expect(panel).toMatch(/avail\.email\s*&&\s*!hasEmail/);
  });
});
