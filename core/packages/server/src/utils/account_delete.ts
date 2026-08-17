/**
 * 注销账号 —— 把一个 uid 从站上抹掉。清单集中在这一个文件里,因为它是**全站唯一一处**
 * 需要知道「用户数据都散在哪」的代码:业务表各自按归属键(ownerKey)存,没有外键串起来,
 * 漏掉一张表 = 用户以为删干净了、其实没有。新增带归属键的表时,这两张清单必须跟着加
 * (守卫:client tests/account-delete-coverage.test.ts 扫 schema 里所有归属列都被登记)。
 *
 * 两种处置,分界线是「这条数据是不是只属于我」:
 *   purge      私有数据(计时器备份、公式标记、关注、通知、画作、反馈…)→ 硬删,不留痕。
 *   anonymize  公开内容(论坛帖、公开复盘、评论、公式提交)→ 留在站上,作者位换成墓碑键
 *              deleted:<uid> 且清掉姓名快照。别人的讨论不断链、公开复盘的直链不 404,
 *              但内容与 WCA ID / 邮箱的关联被切断,回溯不到人。
 *
 * 不动的东西(有意为之):
 *   membership_orders / memberships  交易记录留作对账凭证;里面只有归属键,没有姓名邮箱。
 *   recons.person_id / reconer_id    「这份复盘讲的是谁的解法 / 谁做的复盘」是内容署名,
 *                                     和账号是两回事(多数复盘的选手根本不是提交者本人)。
 *   别人收件箱里的通知                 保留通知本体(那是别人的历史),但把其中的 actor 换成墓碑。
 */
import { sql } from '../db/connection.js';
import { deletedOwnerKey } from '@cuberoot/shared/account';

/** 私有数据:[表, 归属列]。整行删除。 */
export const PURGE_TABLES: readonly (readonly [string, string])[] = [
  ['comp_follows', 'wca_id'],            // 关注的比赛
  ['alg_case_marks', 'wca_id'],          // 公式掌握标记
  ['alg_chain_orders', 'wca_id'],        // 公式集连拧顺序
  ['alg_preferred_algs', 'wca_id'],      // 公式记忆主公式偏好
  ['alg_case_srs', 'wca_id'],            // 公式记忆调度
  ['alg_set_progress', 'wca_id'],        // 「过遍」进度(轮次 + 游标 + 折叠时刻)
  ['alg_srs_daily', 'wca_id'],           // 每日复习计数
  ['alg_submission_reads', 'wca_id'],    // 公式提交的已读位置
  ['scramble_marks', 'wca_id'],          // 打乱标记
  ['timer_backups', 'wca_id'],           // 计时器云备份
  ['timer_sessions', 'wca_id'],          // 计时器会话
  ['train_results', 'user_id'],          // 训练成绩
  ['paint_drawings', 'wca_id'],          // 画板作品(仅本人可见)
  ['notifications', 'user_key'],         // 我的收件箱
  ['feedback', 'wca_id'],                // 反馈会话(feedback_media / feedback_messages 见下)
  ['feedback_messages', 'wca_id'],
  ['colpi_votes', 'voter_wca_id'],       // 术语投票
  // 日历整套都是私人行程 —— 标题 / 地点 / 参会人比多数表更敏感,一律硬删。
  // 先删跨事件的两张(我在别人事件里的受邀行、提醒去重记录),再删事件与日历本体。
  ['calendar_guests', 'guest_key'],      // 我被别人邀请的那些行
  ['calendar_reminder_log', 'user_key'], // 提醒去重记录
  ['calendar_events', 'owner_key'],      // 我的日程(删日历也会级联,这里显式兜一遍)
  ['calendars', 'owner_key'],            // 日历本体
  ['calendar_shares', 'owner_key'],      // 对外展示设置 + 分享 token
  // 导入批次行。事件和日历都已在上面删掉了,但批次行不会跟着走 —— 那两列是
  // ON DELETE SET NULL,删的是被指向的一方,批次自己留了下来,还带着导入文件名。
  ['calendar_imports', 'owner_key'],     // 一次 .ics / .zip 导入一行(source = 原文件名)
  ['collaborative_document_subscriptions', 'user_key'], // 我的协作文档订阅与最后查看时间
  ['collaborative_document_members', 'user_key'], // 别人文档授予我的权限
  ['collaborative_documents', 'owner_key'],       // 我的私有协作文档(成员随文档级联删除)
  ['wca_users', 'wca_id'],               // WCA OAuth 缓存(含 access_token,必须销毁)
];

/** 公开内容:作者列换墓碑键,姓名快照清空(前端按墓碑键显示「已注销用户」)。 */
export const ANONYMIZE_TABLES: readonly { table: string; idCol: string; nameCol?: string }[] = [
  { table: 'forum_threads', idCol: 'author_id', nameCol: 'author_name' },
  { table: 'forum_threads', idCol: 'last_post_author_id', nameCol: 'last_post_author_name' },
  { table: 'forum_posts', idCol: 'author_id', nameCol: 'author_name' },
  { table: 'forum_reactions', idCol: 'author_id', nameCol: 'author_name' },
  { table: 'forum_reports', idCol: 'reporter_id', nameCol: 'reporter_name' },
  { table: 'comments', idCol: 'author_id', nameCol: 'author_name' },
  { table: 'alg_submissions', idCol: 'author_id', nameCol: 'author_name' },
  { table: 'recons', idCol: 'added_by_id', nameCol: 'added_by' },
  { table: 'notifications', idCol: 'actor_key', nameCol: 'actor_name' },
  { table: 'wiki_terms', idCol: 'owner_wca_id', nameCol: 'owner_name' },
  { table: 'wiki_additions', idCol: 'owner_wca_id', nameCol: 'owner_name' },
  { table: 'article', idCol: 'owner_wca_id', nameCol: 'owner_name' },
  { table: 'article_image', idCol: 'owner_wca_id' },
  { table: 'article_report', idCol: 'reporter_wca_id' },
  { table: 'teacher_directory_entries', idCol: 'owner_key', nameCol: 'owner_name' },
  // 我给别人文档添加成员的操作痕迹不属于被邀请人,只切断操作者身份。
  { table: 'collaborative_document_members', idCol: 'added_by' },
];

/**
 * 带归属列、但**故意**不进上面两张清单的表 —— 覆盖率守卫拿这份名单放行,所以每一条都得有理由。
 * 新表要么进清单,要么进这里,不能两边都不在(那就是漏了)。
 */
export const NOT_USER_OWNED: Readonly<Record<string, string>> = {
  app_users: '账号本体,最后整行删',
  auth_identities: '身份行,随 app_users 级联删',
  organizations: '机构主体独立保留,创建者外键随账号删除置空',
  organization_members: '机构成员关系随账号删除级联,但最后一位有效 owner 会被事务拒绝',
  student_profiles: '学员档案属于机构,关联站内账号随账号删除置空',
  guardian_links: '监护关系属于机构,关联站内账号随账号删除置空',
  teaching_audit_events: '教学审计必须保留,操作者账号随删除置空且保留姓名快照',
  teaching_idempotency_requests: '短期防重记录随操作者账号删除级联',
  teaching_mutation_rate_limits: '教学写入尝试限流状态随账号删除级联',
  teaching_platform_identities: '旧教学平台账号映射随站内账号删除级联',
  teaching_platform_assertion_nonces: '短期登录断言防重记录随站内账号删除级联',
  memberships: '会员权益状态:留着,同一个人重新绑 WCA 回来还认',
  membership_orders: '交易凭证,财务对账要;只有归属键,没有姓名邮箱',
  contributors: '站方手录的致谢名单,单独处理(只把 wca_id 置 NULL,名字留着)',
  sponsors: '赞助方名录,admin 手录,与站内账号无关',
  watched_persons: '站方监控名单(admin 配置)',
  watched_pr_baseline: '同上,监控用的基线快照',
  comp_snapshots: 'wca_id 这里是**比赛** id,不是人',
  cn_comp_zh: '比赛名中文译名表,wca_id 是比赛 id',
  // 下面全是 WCA 官方数据的镜像 / 派生统计:描述的是 WCA 选手这个客观身份,
  // 不因某人在本站注销而消失(他的 WCA 成绩本来就是公开的)。
  historical_best_ranks: 'WCA 排名历史(官方数据派生)',
  sor_historical_best: 'SOR 历史(官方数据派生)',
  wca_championship_podiums: 'WCA 官方领奖台',
  wca_live_person_results: 'WCA 直播成绩镜像',
  wca_person_aka: 'WCA 选手改名对照',
  wca_person_results: 'WCA 官方成绩镜像(选手页首屏数据源)',
  wca_person_avatar: 'WCA 官网头像 URL 缓存(公开资料,非站内账号资产)',
  wca_person_results_snapshot: 'WCA 成绩快照',
  wca_result_changes: 'WCA 成绩变更记录',
  wca_kinch: 'WCA 官方成绩派生的 Kinch 综合排名,不属于站内账号数据',
};

export class AccountOwnsOrganizationError extends Error {
  constructor() {
    super('transfer organization ownership before deleting account');
    this.name = 'AccountOwnsOrganizationError';
  }
}

/**
 * 抹掉账号。单事务:要么整套删干净,要么一行不动 —— 中途失败留下「账号没了但数据还在」
 * 的半成品,既没删成也再没人能删(登录方式已经没了)。
 *
 * @param userId app_users.id
 * @param key    该账号的归属键(真 wca_id 或 u<uid>)—— 业务表按它存,不是按 userId。
 */
export async function deleteAccount(userId: number, key: string): Promise<void> {
  const tomb = deletedOwnerKey(userId);
  await sql.begin(async (tx) => {
    // 锁住机构与本人 owner 行,和成员角色变更使用同一把机构锁。DB 的 deferred
    // constraint trigger 是最终兜底;这里先给账号注销接口一个稳定、可解释的 409。
    const soleOwnerships = await tx`
      SELECT o.id
      FROM organizations o
      JOIN organization_members own
        ON own.organization_id = o.id
       AND own.user_id = ${userId}
       AND own.role = 'owner'
       AND own.status = 'active'
      WHERE NOT EXISTS (
        SELECT 1
        FROM organization_members other_owner
        WHERE other_owner.organization_id = o.id
          AND other_owner.user_id <> ${userId}
          AND other_owner.role = 'owner'
          AND other_owner.status = 'active'
      )
      FOR UPDATE OF o, own`;
    if (soleOwnerships.length > 0) throw new AccountOwnsOrganizationError();

    // 表名 / 列名走字符串插值、值一律走 $n 占位符。标识符全部来自本文件顶上那两张常量清单
    // (且有测试把它们钉在 schema 上),不接受任何外部输入 —— 注入面为零。
    // 不用 postgres.js 的 ${tx(name)} 标识符 helper:同一个写法在不同上下文会被猜成标识符
    // 或值列表,而这段代码删的是删不回来的东西,不给驱动留推断空间。
    const ids = await tx`SELECT provider, provider_uid FROM auth_identities WHERE user_id = ${userId}`;
    const targets = (ids as unknown as { provider: string; provider_uid: string }[])
      .filter((i) => i.provider === 'email' || i.provider === 'phone')
      .map((i) => i.provider_uid);
    // 未核销的验证码:按该账号名下的邮箱 / 手机作废,免得注销后旧码还能验。
    if (targets.length) {
      const ph = targets.map((_, i) => `$${i + 1}`).join(',');
      await tx.unsafe(`DELETE FROM auth_codes WHERE target IN (${ph})`, targets);
    }

    for (const [table, col] of PURGE_TABLES) {
      await tx.unsafe(`DELETE FROM ${table} WHERE ${col} = $1`, [key]);
    }

    // 复盘按可见性分流:公开的匿名保留(直链 / SEO 页不 404),不公开的直接删 ——
    // private / unlisted 本来就只有本人看得到,匿名化后成了谁也访问不到的幽灵行。
    await tx`DELETE FROM recons WHERE added_by_id = ${key} AND visibility <> 'public'`;

    for (const { table, idCol, nameCol } of ANONYMIZE_TABLES) {
      const setName = nameCol ? `, ${nameCol} = ''` : '';
      await tx.unsafe(`UPDATE ${table} SET ${idCol} = $1${setName} WHERE ${idCol} = $2`, [tomb, key]);
    }

    // 贡献者致谢名单是站方手录的,名字留着,只切断与账号的关联。
    await tx`UPDATE contributors SET wca_id = NULL WHERE wca_id = ${key}`;

    // 最后删账号本体。auth_identities 有 ON DELETE CASCADE(0064),身份跟着走。
    await tx`DELETE FROM app_users WHERE id = ${userId}`;
  });
}
