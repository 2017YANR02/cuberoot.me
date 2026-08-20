// 注销账号的分层守卫。这件事没有第二次机会:点下去数据就没了,漏一张表 = 用户以为删干净了
// 其实没有,多删一张 = 删了不该删的。三层各钉一条:
//   清单 ↔ schema  两张清单里的每个 (表, 列) 都真实存在,且**所有**带归属列的表都被表过态
//                  (进清单 / 进豁免名单二选一)—— 新加一张带 wca_id 的表就会在这里红。
//   墓碑键         deleted:<uid> 必须塞得进最窄的那列(VARCHAR(20)),否则注销时事务直接抛。
//   跨包契约       路由路径 + 错误串 + 前端展示,任何一端改措辞另一端就静默失灵。
// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  PURGE_TABLES, ANONYMIZE_TABLES, NOT_USER_OWNED, AccountOwnsOrganizationError,
} from '../../server/src/utils/account_delete';
import {
  deletedOwnerKey, isDeletedOwner, primaryHandle, ownerKey,
} from '@cuberoot/shared/account';
import { ownerDisplayName } from '@/lib/cuber-name-display';

const SERVER = join(__dirname, '../../server');
const CLIENT = join(__dirname, '..');

const ROUTE = readFileSync(join(SERVER, 'src/routes/account_auth.ts'), 'utf8');
const API_PATH = '/v1/auth/account/delete';

// ── schema 解析(CREATE TABLE + 后续 ALTER TABLE ADD COLUMN)──
function parseSchema(files: string[]): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  const add = (t: string, c: string) => {
    const key = t.toLowerCase();
    if (!tables.has(key)) tables.set(key, new Set());
    tables.get(key)!.add(c.toLowerCase());
  };
  for (const sql of files) {
    // CREATE TABLE [IF NOT EXISTS] name ( ...列... );
    for (const m of sql.matchAll(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+([a-z_0-9]+)\s*\(([\s\S]*?)\n\);/gi)) {
      const [, table, body] = m;
      for (const line of body.split('\n')) {
        const col = /^\s{2}([a-z_0-9]+)\s+[a-z]/i.exec(line);   // 列定义:两空格缩进 + 名 + 类型
        if (col) add(table, col[1]);
      }
    }
    for (const m of sql.matchAll(/ALTER TABLE\s+(?:IF EXISTS\s+)?([a-z_0-9]+)\s+ADD COLUMN(?:\s+IF NOT EXISTS)?\s+([a-z_0-9]+)/gi)) {
      add(m[1], m[2]);
    }
  }
  return tables;
}
const SCHEMA_SNAPSHOT_SQL = readFileSync(join(SERVER, 'src/db/schema.pg.sql'), 'utf8');
const SNAPSHOT_SCHEMA = parseSchema([SCHEMA_SNAPSHOT_SQL]);
const SCHEMA = parseSchema([
  SCHEMA_SNAPSHOT_SQL,
  ...readdirSync(join(SERVER, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(SERVER, 'migrations', f), 'utf8')),
]);

/** 一眼能看出「这一行属于某个站内用户」的列名。wca_id 太泛(比赛 id / 官方数据都叫它),
 *  所以覆盖率检查靠下面的豁免名单收口,不靠列名本身判断。 */
const OWNER_COLUMNS = [
  'wca_id', 'user_key', 'actor_key', 'author_id', 'owner_wca_id',
  'reporter_id', 'reporter_wca_id', 'voter_wca_id', 'added_by_id', 'owner_key',
  'guest_key',
];

const STAGE3_TRAINING_TABLES = [
  'training_templates',
  'training_template_versions',
  'training_assignments',
  'training_assignment_targets',
  'training_assignment_goal_metrics',
  'training_evidence',
  'training_evidence_assignments',
  'training_submission_reviews',
  'daily_training_rollups',
  'student_account_binding_invites',
  'guardian_account_binding_invites',
] as const;

const STAGE4_CONVERSATION_TABLES = [
  'teaching_conversations',
  'teaching_conversation_participants',
  'teaching_conversation_messages',
] as const;

const LEAVE_MAKEUP_TABLES = [
  'leave_requests',
  'makeup_attempts',
] as const;

describe('清单 ↔ schema', () => {
  it('schema 解析出的表数合理(解析器本身没坏)', () => {
    expect(SCHEMA.size).toBeGreaterThan(50);
    expect(SCHEMA.get('app_users')?.has('wca_id')).toBe(true);
  });

  it('硬删清单里的每个 (表, 列) 都存在', () => {
    for (const [table, col] of PURGE_TABLES) {
      expect(SCHEMA.has(table), `表 ${table} 不在 schema 里`).toBe(true);
      expect(SCHEMA.get(table)!.has(col), `${table}.${col} 不在 schema 里`).toBe(true);
    }
  });

  it('匿名化清单里的每个 (表, 列) 都存在', () => {
    for (const { table, idCol, nameCol } of ANONYMIZE_TABLES) {
      expect(SCHEMA.has(table), `表 ${table} 不在 schema 里`).toBe(true);
      expect(SCHEMA.get(table)!.has(idCol), `${table}.${idCol} 不在 schema 里`).toBe(true);
      if (nameCol) expect(SCHEMA.get(table)!.has(nameCol), `${table}.${nameCol} 不在 schema 里`).toBe(true);
    }
  });

  it('私有数据是删、公开内容是改,两张清单不重叠地混用同一张表的同一列', () => {
    const purged = new Set(PURGE_TABLES.map(([t, c]) => `${t}.${c}`));
    for (const { table, idCol } of ANONYMIZE_TABLES) {
      // notifications 例外:user_key(我的收件箱)删,actor_key(别人收件箱里的我)改 —— 不同列。
      expect(purged.has(`${table}.${idCol}`), `${table}.${idCol} 同时被删又被改`).toBe(false);
    }
  });

  it('每张带归属列的表都表过态:进清单,或进豁免名单', () => {
    const handled = new Set<string>([
      ...PURGE_TABLES.map(([t]) => t),
      ...ANONYMIZE_TABLES.map((a) => a.table),
      ...Object.keys(NOT_USER_OWNED),
      'recons',   // 按可见性分流(公开的匿名化 / 私享的删),不走清单,见 deleteAccount
    ]);
    const missing: string[] = [];
    for (const [table, cols] of SCHEMA) {
      if (table.startsWith('wca_fs_')) continue;   // 趣味统计全是 WCA 官方数据派生
      if (!OWNER_COLUMNS.some((c) => cols.has(c))) continue;
      if (!handled.has(table)) missing.push(table);
    }
    // 新建带归属键的表却忘了想「注销时它该怎么办」—— 这条就是那一刻的提醒。
    expect(missing, `这些表带归属列但没在注销清单里表态: ${missing.join(', ')}`).toEqual([]);
  });

  it('豁免名单每条都写了理由', () => {
    for (const [table, why] of Object.entries(NOT_USER_OWNED)) {
      expect(why.length, `${table} 的豁免理由太短`).toBeGreaterThan(4);
    }
  });

  it('豁免名单里的每张表都存在于受版本控制的 schema 来源', () => {
    for (const table of Object.keys(NOT_USER_OWNED)) {
      expect(SCHEMA.has(table), `豁免表 ${table} 不在 schema snapshot 或 migration 里`).toBe(true);
    }
  });

  it('教学租户表逐张登记账号删除策略', () => {
    expect(Object.keys(NOT_USER_OWNED)).toEqual(expect.arrayContaining([
      'organizations',
      'organization_members',
      'student_profiles',
      'guardian_links',
      'guardian_account_binding_invites',
      'teaching_audit_events',
      'teaching_idempotency_requests',
      'teaching_mutation_rate_limits',
      'teaching_platform_identities',
      'teaching_platform_assertion_nonces',
      'teaching_campuses',
      'teaching_groups',
      'teaching_relation_locks',
      'student_group_memberships',
      'teacher_assignments',
      'lesson_package_products',
      'student_packages',
      'teaching_sessions',
      'session_teachers',
      'attendance_records',
      'lesson_credit_ledger',
      'session_events',
      ...LEAVE_MAKEUP_TABLES,
      'lesson_feedback',
      'teaching_weekly_reports',
      ...STAGE3_TRAINING_TABLES,
      ...STAGE4_CONVERSATION_TABLES,
    ]));
    for (const table of [
      ...STAGE3_TRAINING_TABLES,
      ...STAGE4_CONVERSATION_TABLES,
      ...LEAVE_MAKEUP_TABLES,
    ]) {
      expect(SNAPSHOT_SCHEMA.has(table), `教学表 ${table} 必须存在于最终 schema snapshot`).toBe(true);
    }
  });
});

describe('墓碑键', () => {
  it('塞得进最窄的归属列(VARCHAR(20))', () => {
    // comments.author_id / notifications.user_key 都是 VARCHAR(20);超长 = 注销时事务直接抛。
    expect(deletedOwnerKey(999_999_999).length).toBeLessThanOrEqual(20);
  });

  it('与 ownerKey 的两种形态都不撞', () => {
    const tomb = deletedOwnerKey(144);
    expect(tomb).not.toBe(ownerKey(144, null));          // u144
    expect(tomb).not.toBe(ownerKey(144, '2017YANR02'));
    expect(isDeletedOwner(tomb)).toBe(true);
    expect(isDeletedOwner('u144')).toBe(false);
    expect(isDeletedOwner('2017YANR02')).toBe(false);
    expect(isDeletedOwner('')).toBe(false);
    expect(isDeletedOwner(null)).toBe(false);
  });

  it('不同账号的墓碑互不相同(同一人的历史发言仍串得起来,不同人不会混成一个)', () => {
    expect(deletedOwnerKey(1)).not.toBe(deletedOwnerKey(2));
  });
});

describe('确认用的主标识(前后端同一优先级)', () => {
  const email = { provider: 'email', providerUid: 'a@b.com' };
  const phone = { provider: 'phone', providerUid: '+8613800138000' };
  const wca = { provider: 'wca', providerUid: '2017YANR02' };
  const wechat = { provider: 'wechat', providerUid: 'oX7aB9c-opaque' };

  it('邮箱 > 手机 > WCA', () => {
    expect(primaryHandle([wca, phone, email], 7)).toBe('a@b.com');
    expect(primaryHandle([wca, phone], 7)).toBe('+8613800138000');
    expect(primaryHandle([wca], 7)).toBe('2017YANR02');
  });

  it('只有三方绑定时回落到合成键 —— 三方 uid 是不透明串,没人抄得出来', () => {
    expect(primaryHandle([wechat], 7)).toBe('u7');
  });

  it('什么都没有也不返回空以外的东西(空 = 服务端直接拒绝注销)', () => {
    expect(primaryHandle([], null)).toBe('');
  });
});

describe('服务端两道闸', () => {
  // 路由挂在 /v1 下,源码里写的是不带前缀的那半截。
  const seg = ROUTE.slice(ROUTE.indexOf("'/auth/account/delete'"));

  it('照抄主标识 + 大小写折叠比对', () => {
    expect(seg).toContain('primaryHandle');
    expect(seg).toMatch(/toLowerCase\(\)\s*!==\s*handle\.toLowerCase\(\)/);
  });

  it('设了密码的账号必须再验一次密码', () => {
    expect(seg).toContain('getPasswordHash');
    expect(seg).toContain('verifyPassword');
  });

  it('**不认** amr=email_code 的 grant —— 那是给重设密码开的口子,不给不可逆操作放行', () => {
    const upTo = seg.slice(0, seg.indexOf('deleteAccount('));
    expect(upTo).not.toContain('emailGrant(c)');
  });

  it('业务表按归属键存,所以两个键都要传给 deleteAccount', () => {
    expect(seg).toMatch(/deleteAccount\(uid,\s*ownerKey\(uid,\s*user\.wca_id\)\)/);
  });

  it('最后一位机构 owner 注销返回 409', () => {
    expect(AccountOwnsOrganizationError.prototype).toBeInstanceOf(Error);
    expect(seg).toContain('AccountOwnsOrganizationError');
    expect(seg).toContain('409');
  });
});

describe('删除动作本身', () => {
  const impl = readFileSync(join(SERVER, 'src/utils/account_delete.ts'), 'utf8');

  it('整套走一个事务 —— 半途失败留下「账号没了但数据还在」就再没人能删了', () => {
    expect(impl).toContain('sql.begin');
    // app_users 那一行必须在事务里,且排在最后(前面的清理都按归属键找行)。
    expect(impl.indexOf('DELETE FROM app_users')).toBeGreaterThan(impl.indexOf('ANONYMIZE_TABLES'));
  });

  it('先锁机构并拒绝删除最后一位有效 owner', () => {
    expect(impl).toContain('FOR UPDATE OF o, own');
    expect(impl).toContain("other_owner.role = 'owner'");
    expect(impl).toContain('throw new AccountOwnsOrganizationError()');
  });

  it('删除账号前结束长期任教并切断活动引用，同时保留负责人快照', () => {
    const endAssignment = impl.indexOf('UPDATE teacher_assignments');
    const unlink = impl.indexOf('UPDATE session_teachers SET teacher_user_id = NULL');
    const deleteUser = impl.indexOf('DELETE FROM app_users');
    expect(endAssignment).toBeGreaterThan(-1);
    expect(impl).toContain('SET teacher_user_id = NULL');
    expect(impl).toContain('GREATEST(NOW(), effective_from)');
    expect(unlink).toBeGreaterThan(endAssignment);
    expect(unlink).toBeGreaterThan(-1);
    expect(deleteUser).toBeGreaterThan(unlink);
  });

  it('删除账号前匿名化训练批改 live reviewer，保留不可变快照', () => {
    const unlinkReview = impl.indexOf('UPDATE training_submission_reviews');
    const deleteUser = impl.indexOf('DELETE FROM app_users');
    expect(unlinkReview).toBeGreaterThan(-1);
    expect(impl.slice(unlinkReview, deleteUser)).toMatch(/SET\s+reviewer_user_id\s*=\s*NULL/);
    expect(deleteUser).toBeGreaterThan(unlinkReview);
  });

  it('删除账号前匿名化课后反馈作者，保留不可变快照', () => {
    const unlinkFeedback = impl.indexOf('UPDATE lesson_feedback SET author_user_id = NULL');
    const deleteUser = impl.indexOf('DELETE FROM app_users');
    expect(unlinkFeedback).toBeGreaterThan(-1);
    expect(deleteUser).toBeGreaterThan(unlinkFeedback);
  });

  it('删除账号前切断请假与补课的实时账号引用，保留不可变身份快照', () => {
    const unlinkLeave = impl.indexOf('UPDATE leave_requests');
    const unlinkMakeup = impl.indexOf('UPDATE makeup_attempts');
    const unlinkFeedback = impl.indexOf('UPDATE lesson_feedback');
    const deleteUser = impl.indexOf('DELETE FROM app_users');
    expect(unlinkLeave).toBeGreaterThan(-1);
    expect(unlinkMakeup).toBeGreaterThan(unlinkLeave);
    expect(unlinkFeedback).toBeGreaterThan(unlinkMakeup);
    expect(deleteUser).toBeGreaterThan(unlinkMakeup);

    const leaveUpdate = impl.slice(unlinkLeave, unlinkMakeup);
    expect(leaveUpdate).toContain('requested_by_user_id');
    expect(leaveUpdate).toContain('decided_by_user_id');
    expect(leaveUpdate).not.toMatch(/_snapshot\s*=/);

    const makeupUpdate = impl.slice(unlinkMakeup, unlinkFeedback);
    expect(makeupUpdate).toContain('created_by_user_id');
    expect(makeupUpdate).toContain('resolved_by_user_id');
    expect(makeupUpdate).not.toMatch(/_snapshot\s*=/);
  });

  it('删除账号前分别匿名化周报生成者与发布者，保留不可变快照', () => {
    const unlinkReport = impl.indexOf('UPDATE teaching_weekly_reports');
    const deleteUser = impl.indexOf('DELETE FROM app_users');
    expect(unlinkReport).toBeGreaterThan(-1);
    expect(impl.slice(unlinkReport, deleteUser)).toContain('generated_by_user_id');
    expect(impl.slice(unlinkReport, deleteUser)).toContain('published_by_user_id');
    expect(deleteUser).toBeGreaterThan(unlinkReport);
  });

  it('删除账号前成对清空学员与监护人账号绑定状态', () => {
    const unlinkStudent = impl.indexOf('UPDATE student_profiles');
    const unlinkGuardian = impl.indexOf('UPDATE guardian_links');
    const deleteUser = impl.indexOf('DELETE FROM app_users');
    expect(unlinkStudent).toBeGreaterThan(-1);
    expect(impl.slice(unlinkStudent, unlinkGuardian)).toMatch(
      /SET account_user_id = NULL, account_linked_at = NULL/,
    );
    expect(unlinkGuardian).toBeGreaterThan(unlinkStudent);
    expect(impl.slice(unlinkGuardian, deleteUser)).toMatch(
      /SET guardian_user_id = NULL, account_linked_at = NULL/,
    );
    expect(deleteUser).toBeGreaterThan(unlinkGuardian);
  });

  it('复盘按可见性分流:公开的匿名保留,私享 / 不公开列出的删掉', () => {
    expect(impl).toMatch(/DELETE FROM recons WHERE added_by_id = \$\{key\} AND visibility <> 'public'/);
  });

  it('WCA OAuth 缓存(含 access_token)必须销毁', () => {
    expect(PURGE_TABLES.some(([t]) => t === 'wca_users')).toBe(true);
  });

  it('名字快照跟着清空 —— 只换 id 不清名字等于没匿名', () => {
    expect(impl).toMatch(/\$\{nameCol\} = ''/);
  });

  it('值一律走 $n 占位符,只有清单里的表名 / 列名才拼进 SQL', () => {
    // 拼进 SQL 的标识符全部来自本文件的常量清单(且被上面的 schema 断言钉死),
    // 归属键 / 墓碑键这些值绝不能被拼进字符串。
    expect(impl).toMatch(/WHERE \$\{col\} = \$1/);
    expect(impl).toMatch(/SET \$\{idCol\} = \$1\$\{setName\} WHERE \$\{idCol\} = \$2/);
    expect(impl).not.toMatch(/unsafe\(`[^`]*\$\{key\}/);
    expect(impl).not.toMatch(/unsafe\(`[^`]*\$\{tomb\}/);
  });
});

describe('跨包契约', () => {
  it('前端打的是服务端那条路径', () => {
    const api = readFileSync(join(CLIENT, 'lib/account-api.ts'), 'utf8');
    expect(ROUTE).toContain("'/auth/account/delete'");
    expect(api).toContain(API_PATH);
  });

  it('确认不匹配的错误串两端对得上', () => {
    const panel = readFileSync(join(CLIENT, 'components/AuthPanel.tsx'), 'utf8');
    expect(ROUTE).toContain('confirmation does not match');
    expect(panel).toContain('confirmation does not match');
  });

  it('注销入口链到独立一屏,不是弹层', () => {
    const page = readFileSync(join(CLIENT, 'app/[lang]/account/page.tsx'), 'utf8');
    expect(page).toContain("href=\"/account?view=delete\"");
    expect(page).toContain('DeleteAccountPanel');
  });
});

describe('展示层:墓碑键 → 「已注销用户」', () => {
  it('姓名快照已清空,靠归属键认出来', () => {
    const tomb = deletedOwnerKey(144);
    expect(ownerDisplayName(tomb, '', true)).toBe('已注销用户');
    expect(ownerDisplayName(tomb, '', false)).toBe('Deleted user');
  });

  it('库里万一还留着旧名字也不显示 —— 认键不认名', () => {
    expect(ownerDisplayName(deletedOwnerKey(1), 'Feliks Zemdegs', true)).toBe('已注销用户');
  });

  it('正常用户照旧走 displayCuberName(中文括号名照抽)', () => {
    expect(ownerDisplayName('2017YANR02', 'Xuanyi Geng (耿暄一)', true)).toBe('耿暄一');
    expect(ownerDisplayName('u144', 'Feliks Zemdegs', false)).toBe('Feliks Zemdegs');
  });
});
