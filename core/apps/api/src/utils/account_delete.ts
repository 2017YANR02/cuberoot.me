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
import { removeDriveAccountFiles } from './drive_storage.js';

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
  ['recon_videos', 'owner_wca_id'],      // 未提交的复盘视频上传
  ['train_results', 'user_id'],          // 训练成绩
  ['paint_drawings', 'wca_id'],          // 画板作品(仅本人可见)
  ['pb_records', 'owner_key'],            // CubePB 个人纪录历史
  ['pb_profiles', 'owner_key'],           // CubePB 公开设置
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
  ['platform_idempotency_requests', 'actor_key'], // Platform 短期写入防重记录
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
 * 直接引用 app_users 的 Platform 表。注销策略由 0168 的 app_users BEFORE DELETE
 * trigger 原子执行；这份清单只给覆盖率测试做 schema 漂移守卫。
 */
export const PLATFORM_ACCOUNT_DELETE_TABLES = [
  'platform_instructors',
  'platform_instructor_applications',
  'platform_media_assets',
  'platform_courses',
  'platform_course_owners',
  'platform_course_revisions',
  'platform_lesson_revisions',
  'platform_learning_paths',
  'platform_quiz_revisions',
  'platform_products',
  'platform_events',
  'platform_news_articles',
  'platform_coupons',
  'platform_shipping_addresses',
  'platform_orders',
  'platform_coupon_redemptions',
  'platform_refunds',
  'platform_inventory_ledger',
  'platform_fulfillment_ledger',
  'platform_event_registrations',
  'platform_course_entitlements',
  'platform_entitlement_ledger',
  'platform_memberships',
  'platform_membership_ledger',
  'platform_lesson_progress',
  'platform_lesson_notes',
  'platform_favorites',
  'platform_quiz_attempts',
  'platform_course_reviews',
  'platform_certificates',
  'platform_checkins',
  'platform_point_ledger',
  'platform_user_achievements',
  'platform_instructor_revenue_ledger',
  'platform_instructor_payouts',
  'platform_invite_codes',
  'platform_invite_redemptions',
  'platform_qr_codes',
  'platform_qr_revisions',
  'platform_qr_scans',
  'platform_qr_templates',
  'platform_qr_card_designs',
  'platform_qr_card_jobs',
  'platform_privacy_consents',
  'platform_analytics_events',
  'platform_retention_jobs',
  'platform_reconciliation_records',
  'platform_audit_events',
  'platform_idempotency_requests',
] as const;

/**
 * 带归属列、但**故意**不进上面两张清单的表 —— 覆盖率守卫拿这份名单放行,所以每一条都得有理由。
 * 新表要么进清单,要么进这里,不能两边都不在(那就是漏了)。
 */
export const NOT_USER_OWNED: Readonly<Record<string, string>> = {
  app_users: '账号本体,最后整行删',
  auth_identities: '身份行,随 app_users 级联删',
  account_last_devices: '账号最近设备摘要是私有支持数据,随 app_users 级联删',
  auth_web_session_tickets: '未确认的微信浏览器票据无账号归属，已确认的跨运行时票据随 app_users 级联删',
  user_friendships: '好友关系的三个账号外键都随 app_users 级联删',
  user_blocks: '黑名单关系的双向账号外键都随 app_users 级联删',
  user_wca_friend_contacts: '未注册 WCA 好友条目只属于账号本人,随 app_users 级联删',
  drive_members: '网盘访问权限随 app_users 级联删',
  drive_nodes: '私有网盘元数据随 app_users 级联删,磁盘实体文件由注销流程清理',
  drive_uploads: '未完成上传随 app_users 级联删,临时文件由注销流程清理',
  vault_user_keys: '资料库密钥随 app_users 级联删',
  vault_items: '资料库内容随所有者账号级联删',
  vault_item_access: '资料库授权随内容或接收者账号级联删',
  organizations: '机构主体独立保留,创建者外键随账号删除置空',
  organization_members: '机构成员关系随账号删除级联,但最后一位有效 owner 会被事务拒绝',
  student_profiles: '学员档案属于机构,关联站内账号随账号删除置空',
  guardian_links: '监护关系属于机构,关联站内账号随账号删除置空',
  teaching_audit_events: '教学审计必须保留,操作者账号随删除置空且保留姓名快照',
  teaching_idempotency_requests: '短期防重记录随操作者账号删除级联',
  teaching_mutation_rate_limits: '教学写入尝试限流状态随账号删除级联',
  teaching_platform_identities: '旧教学平台账号映射随站内账号删除级联',
  teaching_platform_assertion_nonces: '短期登录断言防重记录随站内账号删除级联',
  teaching_campuses: '机构校区独立保留,创建者账号随删除置空',
  teaching_groups: '机构班级独立保留,创建者账号随删除置空',
  teaching_relation_locks: '教学关系并发锁属于机构,不承载用户资料',
  student_group_memberships: '学员班级关系是机构历史,创建者账号随删除置空',
  teacher_assignments: '长期任教历史保留稳定账号、姓名与角色快照,活动账号引用在删除前显式置空',
  lesson_package_products: '机构课包产品独立保留,创建者账号随删除置空',
  student_packages: '学员购买课包与产品快照属于机构履约凭证,创建者账号随删除置空',
  teaching_sessions: '课堂履约历史属于机构,创建者账号随删除置空',
  session_teachers: '课堂教师保留姓名与账号 ID 快照,活动账号引用在删除前显式置空',
  attendance_records: '课堂考勤属于机构履约历史,记录者账号随删除置空',
  lesson_credit_ledger: '课时余额流水不可变保留,操作者账号随删除置空且保留姓名快照',
  session_events: '课堂事件不可变保留,操作者账号随删除置空且保留姓名快照',
  leave_requests: '请假申请与处理历史不可删除,申请人和处理人账号随删除置空且保留身份快照',
  makeup_attempts: '补课安排与履约历史不可删除,创建人和处理人账号随删除置空且保留身份快照',
  lesson_feedback: '课后反馈修订历史属于机构,作者账号随删除置空且保留姓名与角色快照',
  teaching_weekly_reports: '教学周报修订属于机构,生成与发布账号随删除置空且保留姓名与角色快照',
  training_templates: '机构训练模板独立保留,创建者账号随删除置空',
  training_template_versions: '已发布训练模板版本不可变保留,创建与发布账号随删除置空',
  training_assignments: '训练任务及发布时内容快照属于机构,操作者账号随删除置空',
  training_assignment_targets: '任务目标是发布时学员范围与提交汇总快照,不随账号删除',
  training_assignment_goal_metrics: '任务目标指标随机构任务保留,不承载账号资料',
  training_evidence: '原始训练证据不可变保留,提交账号随删除置空',
  training_evidence_assignments: '证据与任务目标的不可变关联不承载账号资料',
  training_submission_reviews: '批改版本保留稳定审核人账号、姓名与角色快照,活动账号引用在删除前显式置空',
  daily_training_rollups: '每日训练汇总由机构原始证据重建,不承载账号资料',
  student_account_binding_invites: '学员账号绑定邀请只存令牌哈希并保留终态,操作者账号随删除置空',
  guardian_account_binding_invites: '监护人账号绑定邀请只存令牌哈希并保留终态,操作者账号随删除置空',
  teaching_conversations: '家校沟通会话属于机构,创建账号随删除置空且保留身份快照',
  teaching_conversation_participants: '家校沟通参与记录属于机构,活动账号随删除置空且保留身份与已读快照',
  teaching_conversation_messages: '家校沟通消息不可变保留,作者账号随删除置空且保留身份快照',
  memberships: '会员权益状态:留着,同一个人重新绑 WCA 回来还认',
  membership_orders: '交易凭证,财务对账要;只有归属键,没有姓名邮箱',
  music_tracks: '曲库内容独立保留,上传账号随删除置空',
  contributors: '站方手录的致谢名单,单独处理(只把 wca_id 置 NULL,名字留着)',
  sponsors: '赞助名录保留,认领账号注销时解除关联',
  sponsor_claims: '申请随认领账号级联删除,审核与解除账号删除只置空',
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
  let driveStorageKeys: string[] = [];
  let driveUploads: { id: string; nodeId: string }[] = [];
  await sql.begin(async (tx) => {
    // 与教学沟通写事务共用 app_users 第一把锁。账号一旦进入删除流程,新消息、参与者
    // 与已读游标都必须先等待删除完成,不能在持有 conversation 锁后再反向等待账号行。
    const accounts = await tx`SELECT id FROM app_users WHERE id = ${userId} FOR UPDATE`;
    if (!accounts.length) return;

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

    const storedDriveFiles = await tx<{ storage_key: string }[]>`
      SELECT storage_key FROM drive_nodes
       WHERE owner_user_id = ${userId} AND storage_key IS NOT NULL`;
    const pendingDriveUploads = await tx<{ id: string; node_id: string }[]>`
      SELECT id, node_id FROM drive_uploads WHERE owner_user_id = ${userId}`;
    driveStorageKeys = storedDriveFiles.map((row) => row.storage_key);
    driveUploads = pendingDriveUploads.map((row) => ({ id: row.id, nodeId: row.node_id }));

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

    // 长期任教与单堂教师归属都必须保留历史快照,但其复合成员外键是 RESTRICT。
    // 先结束仍绑定账号的长期任教区间并切断活动引用,再清理单堂引用,最后才删账号。
    await tx`
      UPDATE teacher_assignments
      SET teacher_user_id = NULL,
          effective_to = LEAST(
            COALESCE(effective_to, GREATEST(NOW(), effective_from)),
            GREATEST(NOW(), effective_from)
          )
      WHERE teacher_user_id = ${userId}`;
    await tx`UPDATE session_teachers SET teacher_user_id = NULL WHERE teacher_user_id = ${userId}`;
    await tx`
      UPDATE leave_requests
      SET requested_by_user_id = CASE
            WHEN requested_by_user_id = ${userId} THEN NULL
            ELSE requested_by_user_id
          END,
          decided_by_user_id = CASE
            WHEN decided_by_user_id = ${userId} THEN NULL
            ELSE decided_by_user_id
          END
      WHERE requested_by_user_id = ${userId} OR decided_by_user_id = ${userId}`;
    await tx`
      UPDATE makeup_attempts
      SET created_by_user_id = CASE
            WHEN created_by_user_id = ${userId} THEN NULL
            ELSE created_by_user_id
          END,
          resolved_by_user_id = CASE
            WHEN resolved_by_user_id = ${userId} THEN NULL
            ELSE resolved_by_user_id
          END
      WHERE created_by_user_id = ${userId} OR resolved_by_user_id = ${userId}`;
    await tx`UPDATE lesson_feedback SET author_user_id = NULL WHERE author_user_id = ${userId}`;
    await tx`
      UPDATE teaching_weekly_reports
      SET generated_by_user_id = CASE
            WHEN generated_by_user_id = ${userId} THEN NULL
            ELSE generated_by_user_id
          END,
          published_by_user_id = CASE
            WHEN published_by_user_id = ${userId} THEN NULL
            ELSE published_by_user_id
          END
      WHERE generated_by_user_id = ${userId} OR published_by_user_id = ${userId}`;
    await tx`
      UPDATE training_submission_reviews
      SET reviewer_user_id = NULL
      WHERE reviewer_user_id = ${userId}`;
    await tx`
      UPDATE teaching_conversations
      SET created_by_user_id = NULL
      WHERE created_by_user_id = ${userId}`;
    await tx`
      UPDATE teaching_conversation_messages
      SET author_user_id = NULL
      WHERE author_user_id = ${userId}`;
    await tx`
      UPDATE teaching_conversation_participants
      SET participant_user_id = NULL
      WHERE participant_user_id = ${userId}`;
    // 账号绑定状态由账号外键与绑定时间共同表达,删除时必须在同一事务里成对清空。
    await tx`
      UPDATE student_profiles
      SET account_user_id = NULL, account_linked_at = NULL
      WHERE account_user_id = ${userId}`;
    await tx`
      UPDATE guardian_links
      SET guardian_user_id = NULL, account_linked_at = NULL
      WHERE guardian_user_id = ${userId}`;

    // 公开赞助记录继续保留,但账号注销后不能留下“已认领”的过期状态。
    await tx`
      UPDATE sponsors
      SET claimed_by_user_id = NULL, claimed_at = NULL
      WHERE claimed_by_user_id = ${userId}`;

    // 最后删账号本体。auth_identities 有 ON DELETE CASCADE(0064),Platform 由 0168
    // 的 BEFORE DELETE trigger 在同一事务内完整清理并匿名化。
    await tx`DELETE FROM app_users WHERE id = ${userId}`;
  });

  // 数据库提交后再清实体文件:事务失败时仍保留可用文件；成功后已没有账号可继续写这些路径。
  await removeDriveAccountFiles(driveStorageKeys, driveUploads);
}
