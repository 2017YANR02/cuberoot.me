'use client';

import { Fragment, useMemo } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import Link from '@/components/AppLink';
import { SearchInput } from '@/components/SearchInput';
import { tr, useLang } from '@/i18n/tr';
import './schema.css';

interface Bi { zh: string; en: string }

interface Col { name: string; note?: Bi }
interface Table {
  name: string;
  domain: DomainKey;
  origin: string;            // migration number (e.g. '0042') or 'snapshot'
  purpose: Bi;
  cols?: Col[];
  evolved?: number[];        // later migrations that altered it
  naturalKey?: boolean;      // 业务自然键无 FK
  family?: string[];         // for the fun-stats roll-up entry
}

type DomainKey =
  | 'mirror' | 'derived' | 'scramble' | 'recon' | 'alg'
  | 'comp' | 'account' | 'storage' | 'teaching' | 'platform' | 'studio' | 'commerce' | 'community';

const DOMAINS: { key: DomainKey; dot: string; name: Bi; sub: Bi }[] = [
  { key: 'mirror', dot: '#5BA8FF', name: { zh: 'WCA 镜像', en: 'WCA mirror' }, sub: { zh: '每日开发者导出离线重建', en: 'rebuilt offline from the daily export' } },
  { key: 'derived', dot: '#7BD389', name: { zh: 'WCA 派生统计', en: 'WCA derived' }, sub: { zh: '排名 / 名次和 / 趣味统计', en: 'ranks, sum-of-ranks, fun-stats' } },
  { key: 'scramble', dot: '#F0A04B', name: { zh: '打乱', en: 'Scramble' }, sub: { zh: '真题语料 / 最优解 / 难度', en: 'corpus, optimal, difficulty' } },
  { key: 'recon', dot: '#E879A6', name: { zh: '复盘 & 成绩变更', en: 'Recon & changes' }, sub: { zh: '还原 / 变更链 / 直播成绩', en: 'reconstructions & change log' } },
  { key: 'alg', dot: '#D97757', name: { zh: '公式库', en: 'Algorithms' }, sub: { zh: 'alg_sets / alg_cases 公式', en: 'alg sets & cases' } },
  { key: 'comp', dot: '#4A90D9', name: { zh: '比赛 & 缓存 & 状态机', en: 'Comp & caches' }, sub: { zh: '关注 / 直播缓存 / dump 增量', en: 'follows, live cache, dump state' } },
  { key: 'account', dot: 'var(--accent)', name: { zh: '账号与登录', en: 'Accounts & auth' }, sub: { zh: '用户 / 身份 / 验证码 / 单次票据', en: 'users, identities, codes, single-use tickets' } },
  { key: 'storage', dot: 'var(--signal-success)', name: { zh: '文件存储', en: 'File storage' }, sub: { zh: '私人目录 / 断点上传 / 共享配额', en: 'private trees, resumable uploads, shared quota' } },
  { key: 'teaching', dot: 'var(--signal-info)', name: { zh: '教学 SaaS', en: 'Teaching SaaS' }, sub: { zh: '机构 / 学员 / 课包 / 课堂 / 审计', en: 'organizations, students, packages, sessions, audit' } },
  { key: 'platform', dot: 'var(--signal-warning)', name: { zh: 'Platform 主站业务', en: 'Main-site Platform' }, sub: { zh: '课程 / 学习 / 交易 / 内容 / 讲师 / QR', en: 'catalog, learning, commerce, content, instructors, QR' } },
  { key: 'studio', dot: '#67C18E', name: { zh: '用户产物', en: 'User artifacts' }, sub: { zh: '计时 / 训练 / 绘图', en: 'timer, trainer, paint' } },
  { key: 'commerce', dot: '#A78BFA', name: { zh: '会员 & 赞助 & 反馈', en: 'Commerce & feedback' }, sub: { zh: '订阅 / 致谢 / 反馈', en: 'membership, sponsors, feedback' } },
  { key: 'community', dot: '#4FC3DC', name: { zh: '社区内容 & 站务', en: 'Community & ops' }, sub: { zh: '长文 / wiki / 导航 / runbook', en: 'articles, wiki, nav, runbook' } },
];

const TABLES: Table[] = [
  // ── WCA mirror ──────────────────────────────────────────
  { name: 'wca_results_flat', domain: 'mirror', origin: '0042', evolved: [7, 42], purpose: { zh: '扁平化的全量成绩(每把一行),站内绝大多数 WCA 查询的主表', en: 'Flattened all-time results (one row per solve) — the main WCA query table' } },
  { name: 'wca_person_results', domain: 'mirror', origin: '0098', purpose: { zh: '选手页专用的全量成绩(一条成绩一行,含整轮 DNF 与轮次名次)', en: 'Person-page results (one row per result, DNF rounds and round position included)' }, cols: [
    { name: 'pos', note: { zh: '轮次名次 —— flat 里没有,里程碑首金/首银与成绩表排序要它', en: 'Round position — absent from flat; needed by medal milestones and results sorting' } },
    { name: 'best', note: { zh: 'WCA 编码:>0 有效 / -1 DNF / -2 DNS。负值正是 flat 丢掉的那批', en: 'WCA encoding: >0 valid, -1 DNF, -2 DNS — the negatives flat drops' } },
  ] },
  { name: 'wca_person_avatar', domain: 'mirror', origin: '0098', purpose: { zh: '头像 URL 懒缓存 —— 官方 dump 里唯一没有的一样,按访问回源一次', en: 'Lazy avatar-URL cache — the one field the official dump omits, fetched once per visit' } },
  { name: 'wca_persons', domain: 'mirror', origin: 'snapshot', evolved: [52], purpose: { zh: '全部 WCA 选手(~25 万行小表)', en: 'Every WCA person (~250k-row lookup)' } },
  { name: 'wca_competitions', domain: 'mirror', origin: 'snapshot', evolved: [98], purpose: { zh: '全部比赛元数据:名字 / 日期 / 地点 / 项目', en: 'All competition metadata: name, dates, place, events' } },
  { name: 'wca_countries', domain: 'mirror', origin: 'snapshot', purpose: { zh: '国家 / 地区码表', en: 'Country / region lookup' } },
  { name: 'wca_continents', domain: 'mirror', origin: 'snapshot', purpose: { zh: '洲际码表', en: 'Continent lookup' } },
  { name: 'wca_results_cache', domain: 'mirror', origin: 'snapshot', purpose: { zh: '选手页成绩读穿缓存', en: 'Per-person results read-through cache' } },
  { name: 'wca_scrambles_cache', domain: 'mirror', origin: 'snapshot', purpose: { zh: '打乱查询缓存', en: 'Scramble query cache' } },
  { name: 'cubing_attempts_cache', domain: 'mirror', origin: 'snapshot', purpose: { zh: 'cubing.com 成绩抓取缓存', en: 'Cached cubing.com attempts' } },

  // ── WCA derived ─────────────────────────────────────────
  { name: 'wca_person_ranks', domain: 'derived', origin: 'snapshot', evolved: [13, 38, 39, 40], purpose: { zh: '每选手每项的世界 / 国家 / 洲际排名,名次和的基础', en: 'Per-person world/country/continent ranks; basis for sum-of-ranks' } },
  { name: 'wca_kinch', domain: 'derived', origin: '0111', purpose: { zh: '每位活跃选手按世界 / 大洲 / 国家纪录计算的 Kinch 综合分', en: 'Per-active-person Kinch scores against world, continental and national records' } },
  { name: 'historical_best_ranks', domain: 'derived', origin: '0018', purpose: { zh: '选手生涯最佳名次(按比赛结束口径)', en: 'Career-best rank per (person, event), settled by comp end' } },
  { name: 'historical_ranks_snapshot', domain: 'derived', origin: 'snapshot', purpose: { zh: '历史排名时间序列快照', en: 'Time-series historical rank snapshots' } },
  { name: 'historical_ranks_monthly_snapshot', domain: 'derived', origin: 'snapshot', evolved: [19], purpose: { zh: '月级历史排名快照', en: 'Monthly historical rank snapshots' } },
  { name: 'meta_historical', domain: 'derived', origin: 'snapshot', purpose: { zh: '历史排名管道元信息', en: 'Historical-ranks pipeline metadata' } },
  { name: 'wca_cohort_ranks', domain: 'derived', origin: 'snapshot', purpose: { zh: '同期选手(cohort)排名', en: 'Cohort (same-debut-era) ranks' } },
  { name: 'wca_grand_slam', domain: 'derived', origin: 'snapshot', purpose: { zh: '大满贯统计', en: 'Grand-slam stats' } },
  { name: 'wca_success_rate', domain: 'derived', origin: 'snapshot', purpose: { zh: '各项成功率', en: 'Per-event success rate' } },
  { name: 'wca_all_events_done', domain: 'derived', origin: 'snapshot', purpose: { zh: '全项目完成(all-rounder)标记', en: 'All-events-completed flags' } },
  { name: 'wca_championship_podiums', domain: 'derived', origin: '0060', purpose: { zh: '锦标赛(世锦 / 洲际 / 国家)领奖台', en: 'Championship podiums (worlds / continental / national)' }, cols: [
    { name: 'wca_id, comp_id, event_id' }, { name: 'level', note: { zh: '锦标赛层级', en: 'championship level' } }, { name: 'place', note: { zh: '名次', en: 'placement' } }, { name: 'best, average, attempts[]' }, { name: 'single_record, average_record' },
  ] },
  { name: 'sor_census', domain: 'derived', origin: 'snapshot', evolved: [30], purpose: { zh: '名次和(Sum of Ranks)全员普查', en: 'Sum-of-ranks census across all cubers' } },
  { name: 'sor_census_yearly', domain: 'derived', origin: '0031', purpose: { zh: '名次和年度普查(含「无领奖台」口径)', en: 'Yearly SoR census, incl. a no-podium variant' } },
  { name: 'sor_player_best', domain: 'derived', origin: 'snapshot', evolved: [22], purpose: { zh: '选手名次和最佳组合', en: 'Per-player best sum-of-ranks combination' } },
  { name: 'sor_historical_best', domain: 'derived', origin: '0033', evolved: [34], purpose: { zh: '名次和历史最佳(总和 + 排名)', en: 'SoR historical best (total + rank)' } },
  { name: 'wca_fs_*', domain: 'derived', origin: '0028', purpose: { zh: '/wca/fun-stats 趣味统计的派生缓存家族,共 15 张', en: 'The 15-table derived family behind /wca/fun-stats' }, family: [
    'wca_fs_country_ranks', 'wca_fs_country_ranks_meta', 'wca_fs_medals', 'wca_fs_placements', 'wca_fs_best_podiums', 'wca_fs_misser', 'wca_fs_records_person', 'wca_fs_records_comp', 'wca_fs_current_records', 'wca_fs_person_comps', 'wca_fs_comp_persons', 'wca_fs_person_comp_solves', 'wca_fs_comp_solves', 'wca_fs_person_solves', 'wca_fs_person_year_solves',
  ] },

  // ── scramble ────────────────────────────────────────────
  { name: 'wca_scrambles', domain: 'scramble', origin: '0035', evolved: [36, 37], purpose: { zh: 'WCA 真实打乱语料(计时器 / 长度 / 难度都从这抽)', en: 'The real WCA scramble corpus (timer, length, difficulty)' } },
  { name: 'wca_scramble_optimal', domain: 'scramble', origin: '0047', purpose: { zh: '最优打乱 = invert(最优解),到达同态的最短打乱', en: 'Optimal scrambles: invert(optimal solve) reaching the same state' } },
  { name: 'wca_scramble_steps', domain: 'scramble', origin: '0057', evolved: [61, 62], purpose: { zh: '逐方法 / 阶段 / 底色的最优步数宽数组 + 热列,支撑按难度抽真题', en: 'Per-method/stage optimal step counts as a wide array + hot columns' }, cols: [
    { name: 'competition_id, event_id, round_type_id, group_id' }, { name: 'steps SMALLINT[]', note: { zh: '逐阶段最优步数宽数组', en: 'wide array of per-step optima' } }, { name: 'gm_cross6', note: { zh: '六色十字最优(热路径飞镖列)', en: 'std cross optimum (hot dart column)' } }, { name: 'gm_xcross6', note: { zh: '六色 xcross 最优(热列)', en: 'std xcross optimum (hot column)' } },
  ] },
  { name: 'wca_scramble_steps_meta', domain: 'scramble', origin: '0057', purpose: { zh: '步数槽位 layout 元表(单行,给 server 映射数组下标 + 稀有档 tails)', en: 'Single-row steps-layout meta mapping array slots + rare tails' } },
  { name: 'wca_scramble_steps_rare', domain: 'scramble', origin: '0062', naturalKey: true, purpose: { zh: '稀有难度档侧表:单槽位值计数 ≤ K 的尾部行,(slot,val) 直达免全表扫', en: 'Rare-difficulty side table: tail rows (per-slot count ≤ K), direct (slot,val) seek' }, cols: [
    { name: 'slot, val', note: { zh: '槽位 + 步数值(尾部值表在 meta.layout.tails)', en: 'slot + step value (tails in meta.layout)' } }, { name: 'stage6 SMALLINT[]', note: { zh: '同阶段 6 底色快照,分支兄弟色判据行内可判', en: 'same-stage 6-color snapshot for branch sibling checks' } },
  ] },
  { name: 'scramble_marks', domain: 'scramble', origin: '0041', naturalKey: true, purpose: { zh: '计时器打乱公开标记 + feed', en: 'Public scramble marks + feed' }, cols: [
    { name: 'wca_id, name, country' }, { name: 'competition_id, event_id, round_type_id', note: { zh: '六元自然键,无 FK', en: 'six-part natural key, no FK' } },
  ] },

  // ── personal bests ─────────────────────────────────────
  { name: 'pb_profiles', domain: 'studio', origin: '0171', naturalKey: true, purpose: { zh: 'CubePB 个人主页公开设置', en: 'CubePB public-profile settings' }, cols: [
    { name: 'owner_key (PK)' }, { name: 'is_public' }, { name: 'created_at, updated_at' },
  ] },
  { name: 'pb_records', domain: 'studio', origin: '0171', purpose: { zh: '个人纪录当前值与完整进步历史', en: 'Current personal bests and complete improvement history' }, cols: [
    { name: 'owner_key, event_id' }, { name: 'record_type, set_size', note: { zh: 'Single / Mo3 / Ao5、Ao12、Ao50、Ao100、Ao1000、Ao10000', en: 'Single / Mo3 / Ao5, Ao12, Ao50, Ao100, Ao1000, Ao10000' } },
    { name: 'result_value', note: { zh: 'WCA 原始成绩编码', en: 'Raw WCA result encoding' } }, { name: 'happened_on, cube_name, comments, is_current' },
  ] },

  // ── recon & result changes ──────────────────────────────
  { name: 'recons', domain: 'recon', origin: 'snapshot', evolved: [5, 29, 32], purpose: { zh: '复盘库:打乱 + 解法 + 视频 + 署名', en: 'Solve reconstructions: scramble + solution + video + credit' }, cols: [
    { name: 'id, official, event, method, date' }, { name: 'comp, comp_wca_id, country, city, round' }, { name: 'person, person_id, co_persons', note: { zh: '合作还原署名', en: 'co-solver credit' } }, { name: 'raw_time' },
  ] },
  { name: 'recon_videos', domain: 'recon', origin: '0162', purpose: { zh: '会员上传的复盘视频服务器文件元数据', en: 'Server-file metadata for member-uploaded recon videos' }, cols: [
    { name: 'id, owner_wca_id' }, { name: 'storage_key, mime, size_bytes' }, { name: 'created_at' },
  ] },
  { name: 'recon_ground_truth_cases', domain: 'recon', origin: '0105', naturalKey: true, purpose: { zh: '管理员逐条核对的复盘回归样本；confirmed 才导出，且保存来源快照以发现后续改动', en: 'Admin-reviewed reconstruction regression cases; only confirmed rows export, with source snapshots for later-change detection' }, cols: [
    { name: 'recon_id (PK)' }, { name: 'status', note: { zh: 'confirmed / discussion / rejected', en: 'confirmed / discussion / rejected' } }, { name: 'replay, truth, truth_mode' }, { name: 'source_event, source_added_by_id, source_scramble, source_solution' }, { name: 'created_by_id, updated_by_id, created_at, updated_at' },
  ] },
  { name: 'recon_ground_truth_candidate_checks', domain: 'recon', origin: '0106', naturalKey: true, purpose: { zh: '复盘候选资格缓存：直接排除 DNF、成绩或打乱异常、解法不完整复原的记录', en: 'Cached candidate eligibility: excludes DNFs, invalid results or scrambles, and solutions that do not fully solve the cube' }, cols: [
    { name: 'recon_id PK/FK' }, { name: 'source_event, source_added_by_id' }, { name: 'source_value, source_raw_time' },
    { name: 'source_scramble, source_solution' }, { name: 'eligible, blockers_json, checked_at' },
  ] },
  { name: 'wca_person_results_snapshot', domain: 'recon', origin: '0048', purpose: { zh: '选手全成绩 JSONB 快照,成绩变更监控的 diff 基线', en: 'Per-person results JSONB snapshot — baseline for change diff' }, cols: [
    { name: 'wca_id (PK)' }, { name: 'results_json JSONB' }, { name: 'content_hash', note: { zh: '内容指纹,变了才更新', en: 'fingerprint; refreshed only on change' } }, { name: 'checked_at, updated_at' },
  ] },
  { name: 'wca_result_changes', domain: 'recon', origin: '0048', evolved: [51, 56], naturalKey: true, purpose: { zh: 'append-only 成绩变更链:取消 / 修正 / 管理员手录', en: 'Append-only result-change log: removals, fixes, manual edits' } },
  { name: 'wca_live_person_results', domain: 'recon', origin: '0050', purpose: { zh: '官方收录前的直播成绩(WCA Live / cubing.com)', en: 'Live results before they land in the official export' } },
  { name: 'wca_person_aka', domain: 'recon', origin: '0053', evolved: [54], purpose: { zh: '选手曾用名 + 国籍变更', en: 'Former names + nationality changes' }, cols: [
    { name: 'wca_id (PK)' }, { name: 'former_names JSONB' }, { name: 'former_detail', note: { zh: '含国籍变更([{name,iso2}])', en: 'incl. nationality ([{name,iso2}])' } },
  ] },

  // ── alg ─────────────────────────────────────────────────
  { name: 'alg_sets', domain: 'alg', origin: 'snapshot', purpose: { zh: '公式集(主键 puzzle + set_slug)', en: 'Alg sets, keyed (puzzle, set_slug)' }, cols: [
    { name: 'puzzle, set_slug (PK)' }, { name: 'source, scraped_at, updated_at' },
  ] },
  { name: 'alg_cases', domain: 'alg', origin: 'snapshot', evolved: [69, 92, 153], purpose: { zh: '单条公式 case,position 定序(不加名字 UNIQUE,会重名)', en: 'Individual alg cases; ordered by position (no name UNIQUE)' }, cols: [
    { name: 'id (PK)' }, { name: 'puzzle, set_slug' }, { name: 'position', note: { zh: '从 JSON 数组下标导入定序', en: 'order from the source array' } }, { name: 'name, number' },
    { name: 'mirror_case_id', note: { zh: '镜像伙伴,互指;自镜像指自己', en: 'mirror partner; self-mirror points at itself' } },
  ] },
  { name: 'alg_submissions', domain: 'alg', origin: 'snapshot', purpose: { zh: '用户公式投稿', en: 'User-submitted algorithms' } },
  { name: 'alg_submission_reads', domain: 'alg', origin: '0059', purpose: { zh: '投稿已读状态(admin 通知红点)', en: 'Per-admin read state for submissions (notification badge)' } },
  { name: 'lsll_cases', domain: 'alg', origin: '0094', naturalKey: true, purpose: { zh: 'LSLL 每个 case 的整方 HTM 最优解(本地 solver/lsll 跑完增量灌库,不进 migration)', en: 'Whole-cube HTM-optimal solutions per LSLL case (bulk-loaded from the local solver/lsll run, never in a migration)' }, cols: [
    { name: 'canonical_key (PK)', note: { zh: 'base36,与 URL 的 ?k= 同一串', en: 'base36 — the same string as the URL ?k=' } },
    { name: 'htm, qtm' }, { name: 'optimal_algs (jsonb)' },
    { name: 'exhaustive', note: { zh: 'false = 只拿到一条最优解,QTM 并列未穷尽', en: 'false = only one optimal solution; QTM ties not exhausted' } },
  ] },

  // ── comp & caches & dump state ──────────────────────────
  { name: 'comp_follows', domain: 'comp', origin: '0045', naturalKey: true, purpose: { zh: '登录用户「盯一下」比赛关注', en: 'Logged-in users following a competition' }, cols: [
    { name: 'wca_id, comp_id', note: { zh: '自然键,无 FK', en: 'natural key, no FK' } }, { name: 'created_at' },
  ] },
  { name: 'comp_snapshots', domain: 'comp', origin: '0014', purpose: { zh: '直播比赛持久化 L2 缓存(进程重启不丢,schema_version 失效)', en: 'Persistent L2 cache for live comps (survives restart)' } },
  { name: 'comp_schedule_cache', domain: 'comp', origin: '0021', purpose: { zh: '赛程(日历 / 表格)服务端缓存,回客户端只几十 KB', en: 'Server-side comp-schedule cache (tens of KB to client)' } },
  { name: 'comp_dump_state', domain: 'comp', origin: '0015', evolved: [16], purpose: { zh: '比赛 dump 增量状态(已从时间戳改成内容指纹)', en: 'Per-comp dump state (now content-hash, not timestamp)' } },
  { name: 'person_dump_state', domain: 'comp', origin: '0017', purpose: { zh: '选手 dump 增量状态', en: 'Per-person dump incremental state' } },
  { name: 'monitor_pushed_state', domain: 'comp', origin: '0023', purpose: { zh: '监控推送去重状态', en: 'Dedup state for monitor push notifications' } },
  { name: 'watched_persons', domain: 'comp', origin: '0024', evolved: [25], purpose: { zh: '成绩监控对象(cubing.com 匹配键)', en: 'Watched persons for result monitoring' } },
  { name: 'watched_pr_baseline', domain: 'comp', origin: '0024', purpose: { zh: '监控 PR 基线快照', en: 'PR baseline snapshot for monitoring' } },
  { name: 'cn_comp_zh', domain: 'comp', origin: '0012', evolved: [44], purpose: { zh: '中国比赛中文地点 + 报名时间缓存', en: 'Cached Chinese comp localisation + registration times' } },
  { name: 'wca_users', domain: 'comp', origin: 'snapshot', purpose: { zh: 'WCA OAuth 登录用户(身份 / 头像 / admin)', en: 'WCA OAuth users (identity, avatar, admin flag)' } },

  // ── accounts & auth ────────────────────────────────────
  { name: 'app_users', domain: 'account', origin: '0064', evolved: [68, 71, 72, 172, 186], purpose: { zh: '站内统一账号；微信、WCA、邮箱和手机等身份最终都归到同一用户', en: 'Canonical site accounts shared by Weixin, WCA, email, phone, and other identities' } },
  { name: 'user_friendships', domain: 'account', origin: '0175', purpose: { zh: '好友申请与已接受的双向好友关系；每对账号只保留一条规范记录', en: 'Pending requests and accepted two-way friendships, with one canonical row per account pair' } },
  { name: 'user_blocks', domain: 'account', origin: '0175', purpose: { zh: '单向黑名单；拉黑时同步切断好友关系与待处理申请', en: 'Directed blocks; blocking also removes friendships and pending requests' } },
  { name: 'user_wca_friend_contacts', domain: 'account', origin: '0178', purpose: { zh: '账号私有的 WCA 好友条目；对方未注册时只保存在本人列表，不代表双向好友或已发送申请', en: 'Account-private WCA friend entries; an unregistered person is only saved to the owner\'s list and does not imply a mutual friendship or delivered request' } },
  { name: 'auth_identities', domain: 'account', origin: '0064', evolved: [78, 103], purpose: { zh: '账号与外部身份的唯一映射；微信小程序与网站扫码登录共用 UnionID', en: 'Unique account-to-provider identity mappings; Mini Program and website QR sign-in share the Weixin UnionID' } },
  { name: 'auth_codes', domain: 'account', origin: '0064', purpose: { zh: '邮箱与手机登录、绑定使用的短时验证码及核销状态', en: 'Short-lived email and phone verification codes with consumption state' } },
  { name: 'auth_web_session_tickets', domain: 'account', origin: '0139', evolved: [179], purpose: { zh: '小程序与原生 App 跨运行时换取会话的 90 秒单次票据；只存票据 SHA-256，移动端另绑 PKCE challenge', en: '90-second single-use cross-runtime session tickets; ticket hashes only, with mobile tickets additionally bound to a PKCE challenge' } },

  // ── file storage ───────────────────────────────────────
  { name: 'drive_members', domain: 'storage', origin: '0184', purpose: { zh: '管理员维护的小规模网盘访问白名单；管理员账号无需重复登记', en: 'Admin-managed access list for the small private Drive; admin accounts need no duplicate row' }, cols: [
    { name: 'user_id (PK/FK), enabled' }, { name: 'created_by_user_id, created_at, updated_at' },
  ] },
  { name: 'drive_nodes', domain: 'storage', origin: '0184', purpose: { zh: '每个账号私有的文件夹树与文件元数据；回收站仍计入共享 20 GB 配额', en: 'Per-account private folder trees and file metadata; Trash still counts toward the shared 20 GB quota' }, cols: [
    { name: 'id UUID (PK), owner_user_id, parent_id' }, { name: 'name, kind, mime_type, size_bytes' }, { name: 'storage_key, status, trashed_at, trash_root_id' },
  ] },
  { name: 'drive_uploads', domain: 'storage', origin: '0184', purpose: { zh: '7 天有效的顺序分块上传会话；保存已收偏移并为完整文件预留共享配额', en: 'Seven-day sequential chunk-upload sessions with persisted offsets and full-file shared-quota reservations' }, cols: [
    { name: 'id UUID (PK), node_id (UNIQUE/FK), owner_user_id' }, { name: 'expected_bytes, received_bytes, chunk_bytes' }, { name: 'client_last_modified, expires_at, created_at, updated_at' },
  ] },

  // ── teaching SaaS ──────────────────────────────────────
  { name: 'organizations', domain: 'teaching', origin: '0142', purpose: { zh: '机构租户根节点，保存唯一 slug、状态、时区与版本', en: 'Tenant root with a unique slug, lifecycle status, timezone, and version' }, cols: [
    { name: 'id UUID (PK), slug (UNIQUE), name' }, { name: 'timezone, status, settings, version' }, { name: 'created_by_user_id, created_at, updated_at' },
  ] },
  { name: 'organization_members', domain: 'teaching', origin: '0142', naturalKey: true, purpose: { zh: '账号在每个机构内的角色与有效状态；每个已提交机构至少保留一位有效 owner', en: 'Per-organization account roles and status; every committed organization retains an active owner' }, cols: [
    { name: 'organization_id, user_id (PK)' }, { name: 'role, status, invited_by_user_id, joined_at' },
  ] },
  { name: 'student_profiles', domain: 'teaching', origin: '0142', evolved: [150], purpose: { zh: '机构内学员档案；外部编号与关联站内账号都只在本租户内唯一', en: 'Tenant-scoped student profiles; external references and linked accounts are unique within an organization' }, cols: [
    { name: 'id UUID (PK), organization_id' }, { name: 'account_user_id, account_linked_at, external_ref, display_name, status' }, { name: 'profile JSONB, created_by_user_id' },
  ] },
  { name: 'guardian_links', domain: 'teaching', origin: '0142', evolved: [156], purpose: { zh: '机构内学员与监护账号关系，复合外键阻止跨租户关联', en: 'Tenant-scoped student-to-guardian relationships with composite foreign keys blocking cross-tenant links' }, cols: [
    { name: 'id UUID (PK), organization_id, student_id' }, { name: 'guardian_user_id, account_linked_at, relationship, status, visibility' },
  ] },
  { name: 'teaching_audit_events', domain: 'teaching', origin: '0142', purpose: { zh: '教学业务追加式审计日志；账号删除后保留操作者快照', en: 'Append-only teaching audit log retaining actor snapshots after account deletion' }, cols: [
    { name: 'id BIGINT (PK), organization_id, actor_user_id' }, { name: 'actor_role, actor_display_name, action, entity_type, entity_id' }, { name: 'outcome, request_id, metadata, created_at' },
  ] },
  { name: 'teaching_idempotency_requests', domain: 'teaching', origin: '0142', naturalKey: true, purpose: { zh: '按操作者、租户、操作与幂等键防止重复写入并保存原响应', en: 'Mutation deduplication by actor, tenant, operation, and idempotency key with stored responses' }, cols: [
    { name: 'actor_user_id, scope_key, operation, idempotency_key (UNIQUE)' }, { name: 'request_hash, state, response_status, response_body' }, { name: 'resource_type, resource_id, expires_at' },
  ] },
  { name: 'teaching_mutation_rate_limits', domain: 'teaching', origin: '0145', naturalKey: true, purpose: { zh: '按账号和写入操作持久记录限流窗口；业务事务回滚时失败尝试仍会计数', en: 'Durable per-account mutation windows that still count rejected attempts when the business transaction rolls back' }, cols: [
    { name: 'actor_user_id, operation (PK)' }, { name: 'window_started_at, attempts, updated_at' },
  ] },
  { name: 'teaching_platform_identities', domain: 'teaching', origin: '0143', naturalKey: true, purpose: { zh: '旧教学平台已验证手机号账号与站内统一账号的一对一映射', en: 'One-to-one mapping from verified legacy teaching-platform accounts to canonical site accounts' }, cols: [
    { name: 'platform_subject (PK), user_id (UNIQUE)' }, { name: 'created_at, last_seen_at' },
  ] },
  { name: 'teaching_platform_assertion_nonces', domain: 'teaching', origin: '0143', naturalKey: true, purpose: { zh: '教学平台短时登录断言的单次随机数，只保存 SHA-256 以阻止重放', en: 'Single-use nonces for short-lived teaching-platform assertions, stored only as SHA-256 hashes to prevent replay' }, cols: [
    { name: 'nonce_hash (PK), actor_user_id' }, { name: 'expires_at, created_at' },
  ] },
  { name: 'teaching_campuses', domain: 'teaching', origin: '0149', purpose: { zh: '机构校区；编码可选，仅非空时在机构内唯一，归档不可逆', en: 'Tenant campuses with optional codes that are unique only when present and terminal archival' }, cols: [
    { name: 'id UUID (PK), organization_id, code, name' }, { name: 'timezone, status, archived_at' }, { name: 'created_by_user_id, created_at, updated_at' },
  ] },
  { name: 'teaching_groups', domain: 'teaching', origin: '0149', purpose: { zh: '机构班级，可归属校区；复合外键阻止跨租户关联', en: 'Tenant groups optionally attached to a campus, with composite foreign keys blocking cross-tenant links' }, cols: [
    { name: 'id UUID (PK), organization_id, campus_id' }, { name: 'code, name, status, archived_at' }, { name: 'created_by_user_id, created_at, updated_at' },
  ] },
  { name: 'teaching_relation_locks', domain: 'teaching', origin: '0149', evolved: [150], naturalKey: true, purpose: { zh: '永久保留的教学关系与证据自然键并发锁行，串行化有效期和幂等检查', en: 'Permanent teaching-relation and evidence-key lock rows serializing effective-range and idempotency checks' }, cols: [
    { name: 'id UUID (PK), organization_id' }, { name: 'relation_kind, subject_key, target_key (tenant UNIQUE)' }, { name: 'revision, created_at, touched_at' },
  ] },
  { name: 'student_group_memberships', domain: 'teaching', origin: '0149', naturalKey: true, purpose: { zh: '学员与班级的只追加有效期关系；同一学员与班级的有效区间不可重叠', en: 'Append-only effective-dated student-to-group memberships with no overlap per student and group' }, cols: [
    { name: 'id UUID (PK), organization_id, group_id, student_id' }, { name: 'effective_from, effective_to' }, { name: 'created_by_user_id, created_at' },
  ] },
  { name: 'teacher_assignments', domain: 'teaching', origin: '0149', naturalKey: true, purpose: { zh: '老师对班级或个别学员的长期可见范围；账号注销后保留稳定身份、姓名和角色快照', en: 'Long-term teacher scope over one group or student, retaining stable identity, name, and role snapshots after account deletion' }, cols: [
    { name: 'id UUID (PK), organization_id, teacher_user_id' }, { name: 'teacher_user_id_snapshot, teacher_display_name_snapshot, teacher_role_snapshot' }, { name: 'group_id XOR student_id, effective_from, effective_to, created_by_user_id' },
  ] },
  { name: 'training_templates', domain: 'teaching', origin: '0150', purpose: { zh: '机构训练模板根记录；归档终态且内容版本另表保存', en: 'Organization training-template roots with terminal archival and separately versioned content' }, cols: [
    { name: 'id UUID (PK), organization_id, name, description' }, { name: 'status, archived_at, created_by_user_id, created_at, updated_at' },
  ] },
  { name: 'training_template_versions', domain: 'teaching', origin: '0150', naturalKey: true, purpose: { zh: '只追加的训练模板版本，固定工具、活动与有界配置', en: 'Append-only training-template versions freezing tool, activity, and bounded configuration' }, cols: [
    { name: 'id UUID (PK), organization_id, template_id, version_number' }, { name: 'source, activity, title, instructions, tool_config JSONB' }, { name: 'created_by_user_id, published_by_user_id, created_at' },
  ] },
  { name: 'training_assignments', domain: 'teaching', origin: '0150', purpose: { zh: '训练任务草稿、发布与关闭状态机；发布时间、频率、期望次数与时区发布后冻结', en: 'Training-assignment draft, publish, and close lifecycle with schedule, expected count, and timezone frozen at publication' }, cols: [
    { name: 'id UUID (PK), organization_id, template_version_id' }, { name: 'title, instructions, schedule_kind, expected_count, timezone_snapshot' }, { name: 'starts_at, ends_at, status, published_at, closed_at' },
  ] },
  { name: 'training_assignment_targets', domain: 'teaching', origin: '0150', naturalKey: true, purpose: { zh: '任务发布时展开并冻结的学员目标及提交、批改汇总', en: 'Publish-time student target snapshots with submission and review aggregates' }, cols: [
    { name: 'id UUID (PK), organization_id, assignment_id, target_kind' }, { name: 'group_id / student_id, source_group_id (NULL = direct student)' }, { name: 'display snapshots, evidence and latest-review aggregates' },
  ] },
  { name: 'training_assignment_goal_metrics', domain: 'teaching', origin: '0150', naturalKey: true, purpose: { zh: '按工具与活动注册表约束的任务目标指标', en: 'Assignment goal metrics constrained by the source-and-activity registry' }, cols: [
    { name: 'id UUID (PK), organization_id, assignment_id, metric_key (tenant UNIQUE)' }, { name: 'operator, target_value, created_at' },
  ] },
  { name: 'training_evidence', domain: 'teaching', origin: '0150', naturalKey: true, purpose: { zh: '只追加原始训练证据；永久自然幂等键、可信来源、时区与本地日期都由服务端约束', en: 'Append-only raw training evidence with permanent natural idempotency, provenance, timezone, and local-date constraints' }, cols: [
    { name: 'id UUID (PK), organization_id, student_id' }, { name: 'source, activity, source_event_id, payload_sha256' }, { name: 'trust_level, occurred_at, timezone_snapshot, local_date, bounded metrics / payload' },
  ] },
  { name: 'training_evidence_assignments', domain: 'teaching', origin: '0150', naturalKey: true, purpose: { zh: '证据与发布时学员目标的只追加复合关联', en: 'Append-only composite links from evidence to publish-time student targets' }, cols: [
    { name: 'id UUID (PK), organization_id, evidence_id, assignment_id, student_id' }, { name: 'organization_id, evidence_id, assignment_id (UNIQUE)' }, { name: 'created_at' },
  ] },
  { name: 'training_submission_reviews', domain: 'teaching', origin: '0150', naturalKey: true, purpose: { zh: '按任务学员目标递增版本的只追加批改，保留审核人快照', en: 'Append-only revisioned reviews per assignment target retaining reviewer snapshots' }, cols: [
    { name: 'id UUID (PK), organization_id, assignment_id, student_id, revision' }, { name: 'status, feedback, reviewer_user_id and snapshots, created_at' },
  ] },
  { name: 'daily_training_rollups', domain: 'teaching', origin: '0150', naturalKey: true, purpose: { zh: '按学员、本地日期、工具、活动与可信级别分行的可重建每日汇总', en: 'Rebuildable daily rollups by student, local date, source, activity, and trust level' }, cols: [
    { name: 'organization_id, student_id, local_date, source, activity, trust_level (PK)' }, { name: 'evidence_count, duration_ms, success_count, updated_at' },
  ] },
  { name: 'student_account_binding_invites', domain: 'teaching', origin: '0150', naturalKey: true, purpose: { zh: '学员账号绑定邀请，只保存令牌哈希并保留消费、撤销或过期终态', en: 'Student account-binding invitations storing only token hashes with consumed, revoked, or expired terminal states' }, cols: [
    { name: 'id UUID (PK), organization_id, student_id, token_hash (UNIQUE)' }, { name: 'expires_at, expired_at, consumed_at / by, revoked_at / by' }, { name: 'created_by_user_id, created_at' },
  ] },
  { name: 'guardian_account_binding_invites', domain: 'teaching', origin: '0156', naturalKey: true, purpose: { zh: '监护账号绑定邀请，只保存令牌哈希并保留消费账号快照与不可变终态', en: 'Guardian account-binding invitations storing only token hashes with consumer snapshots and immutable terminal states' }, cols: [
    { name: 'id UUID (PK), organization_id, guardian_link_id, token_hash (UNIQUE)' }, { name: 'expires_at, expired_at, consumed_at / by / by_snapshot, revoked_at / by' }, { name: 'created_by_user_id, created_at' },
  ] },
  { name: 'lesson_package_products', domain: 'teaching', origin: '0147', naturalKey: true, purpose: { zh: '机构课包产品定义；学员领取后以快照保留历史合同', en: 'Tenant package-product definitions whose terms are snapshotted when issued to a student' }, cols: [
    { name: 'id UUID (PK), organization_id, code (tenant UNIQUE), name, status' }, { name: 'credit_unit, credit_type, total_credits, validity_days' }, { name: 'price_amount_minor, currency, created_by_user_id' },
  ] },
  { name: 'student_packages', domain: 'teaching', origin: '0147', evolved: [164], purpose: { zh: '学员课包合同快照；余额始终由课时流水求和', en: 'Student package contract snapshots whose balances are always derived from the credit ledger' }, cols: [
    { name: 'id UUID (PK), organization_id, student_id, product_id' }, { name: 'product / credit / price snapshots, lifecycle_status, acquisition_type' }, { name: 'valid_from, valid_until, external source tuple, credit_ledger_revision' },
  ] },
  { name: 'teaching_sessions', domain: 'teaching', origin: '0147', evolved: [165], purpose: { zh: '机构课堂时间、时区与履约状态；取消课堂会原子释放目标补课', en: 'Tenant session schedule, timezone, and fulfilment state; cancellation atomically releases targeted makeups' }, cols: [
    { name: 'id UUID (PK), organization_id, title' }, { name: 'starts_at, ends_at, timezone, status, version' }, { name: 'started_at, completed_at, cancelled_at' },
  ] },
  { name: 'session_teachers', domain: 'teaching', origin: '0147', evolved: [149], naturalKey: true, purpose: { zh: '课堂教师分配；账号删除后仍保留教师 ID 与姓名快照', en: 'Session teacher assignments retaining ID and display-name snapshots after account deletion' }, cols: [
    { name: 'id UUID (PK), organization_id, session_id' }, { name: 'teacher_user_id, teacher_user_id_snapshot, teacher_display_name_snapshot' }, { name: 'role, created_at' },
  ] },
  { name: 'attendance_records', domain: 'teaching', origin: '0147', evolved: [165], naturalKey: true, purpose: { zh: '每位学员在每堂课的考勤与扣课规划；批准请假与 excused 状态必须同事务落地', en: 'Per-student session attendance and planned credit consumption; approved leave and excused status must commit together' }, cols: [
    { name: 'id UUID (PK), organization_id, session_id, student_id' }, { name: 'student_package_id, status, credit_cost, notes' }, { name: 'recorded_by_user_id, created_at, updated_at' },
  ] },
  { name: 'leave_requests', domain: 'teaching', origin: '0165', naturalKey: true, purpose: { zh: '按考勤留存待处理、批准、拒绝或取消的请假历史；批准与 excused 考勤原子同步', en: 'Auditable pending, approved, rejected, or cancelled leave history per attendance; approval atomically synchronizes excused attendance' }, cols: [
    { name: 'id UUID (PK), organization_id, session_id, attendance_id, student_id' }, { name: 'status, reason, decision_reason, decided_at' }, { name: 'requester / decider live ids and immutable identity snapshots, created_at, updated_at' },
  ] },
  { name: 'makeup_attempts', domain: 'teaching', origin: '0165', naturalKey: true, purpose: { zh: '把已批准请假的来源考勤映射到未来目标考勤，并跟踪已安排、已完成、失败或取消状态', en: 'Map approved-leave source attendance to future target attendance and track scheduled, fulfilled, failed, or cancelled outcomes' }, cols: [
    { name: 'id UUID (PK), organization_id, source / target session and attendance ids' }, { name: 'student_id, student_package_id, credit_cost, status, reason' }, { name: 'creator / resolver live ids and immutable identity snapshots, resolution_reason, timestamps' },
  ] },
  { name: 'lesson_credit_ledger', domain: 'teaching', origin: '0147', evolved: [164, 165], naturalKey: true, purpose: { zh: '只追加的课时账本；扣课、退款与等额撤销由课包父行串行保护，补课仅在到课完成时扣一次', en: 'Append-only credit ledger whose consumption, refunds, and exact reversals serialize on the package parent row; fulfilled makeup attendance consumes exactly once' }, cols: [
    { name: 'id BIGINT (PK), organization_id, student_package_id, student_id' }, { name: 'entry_type, delta, attendance_id, session_id, idempotency_key' }, { name: 'source / reversal references, actor snapshot, metadata, created_at' },
  ] },
  { name: 'session_events', domain: 'teaching', origin: '0147', evolved: [165], purpose: { zh: '只追加的课堂、考勤、请假与补课状态事件', en: 'Append-only session, attendance, leave, and makeup lifecycle events' }, cols: [
    { name: 'id BIGINT (PK), organization_id, session_id, event_type' }, { name: 'actor snapshot, request_id, metadata, created_at' },
  ] },
  { name: 'lesson_feedback', domain: 'teaching', origin: '0154', naturalKey: true, purpose: { zh: '已完课课堂按学员保存的只追加反馈修订历史', en: 'Append-only per-student feedback revisions for completed sessions' }, cols: [
    { name: 'id UUID (PK), organization_id, session_id, student_id, revision' }, { name: 'visibility, summary, strengths, challenges, next_goals, internal_notes' }, { name: 'student / attendance / credit snapshots, author snapshot, published_at, created_at' },
  ] },
  { name: 'teaching_weekly_reports', domain: 'teaching', origin: '0155', naturalKey: true, purpose: { zh: '按机构、学员和周保存可重算草稿与不可变发布修订', en: 'Recomputable drafts and immutable published revisions by organization, student, and week' }, cols: [
    { name: 'id UUID (PK), organization_id, student_id, week_start, week_end, revision' }, { name: 'status, visibility, teacher_summary, next_week_plan, aggregate JSONB' }, { name: 'student / timezone / generator / publisher snapshots, generated_at, published_at' },
  ] },
  { name: 'teaching_conversations', domain: 'teaching', origin: '0158', purpose: { zh: '按机构与学员隔离的家校沟通会话，父行原子分配连续消息序号', en: 'Tenant- and student-scoped family communication threads whose parent row atomically allocates continuous message sequences' }, cols: [
    { name: 'id UUID (PK), organization_id, student_id, subject' }, { name: 'last_message_sequence, last_message_at' }, { name: 'student / creator identity snapshots, created_at' },
  ] },
  { name: 'teaching_conversation_participants', domain: 'teaching', origin: '0158', naturalKey: true, purpose: { zh: '每账号每会话独立且只增不减的已读游标与参与身份快照', en: 'Independent monotonic read cursors and participant identity snapshots per account and conversation' }, cols: [
    { name: 'id UUID (PK), organization_id, conversation_id, student_id' }, { name: 'participant_user_id and identity snapshots' }, { name: 'last_read_sequence, joined_at' },
  ] },
  { name: 'teaching_conversation_messages', domain: 'teaching', origin: '0158', naturalKey: true, purpose: { zh: '正文与作者快照不可变的会话消息，按父行分配序号稳定分页', en: 'Append-only conversation messages with immutable author snapshots and parent-allocated sequence pagination' }, cols: [
    { name: 'id UUID (PK), organization_id, conversation_id, student_id' }, { name: 'sequence (conversation UNIQUE), body' }, { name: 'author_user_id and identity snapshots, created_at' },
  ] },

  // ── main-site Platform ─────────────────────────────────
  { name: 'platform_*', domain: 'platform', origin: '0167', purpose: { zh: '主站 Platform 的 62 表 PostgreSQL 底座：统一账号下的目录、学习、交易、内容、讲师、QR、隐私、审计、outbox 与幂等；不恢复旧 SQLite 双写，也不迁移少量 demo / 计时器历史数据', en: 'The 62-table PostgreSQL foundation for main-site Platform catalog, learning, commerce, content, instructors, QR, privacy, audit, outbox, and idempotency under canonical accounts; no legacy SQLite dual-write or small demo/timer-history migration' }, family: [
    'platform_instructors', 'platform_instructor_applications', 'platform_media_assets', 'platform_courses',
    'platform_course_owners', 'platform_course_revisions', 'platform_lessons', 'platform_lesson_revisions',
    'platform_learning_paths', 'platform_learning_path_items', 'platform_quizzes', 'platform_quiz_revisions',
    'platform_quiz_questions', 'platform_products', 'platform_product_variants', 'platform_events',
    'platform_event_ticket_types', 'platform_news_articles', 'platform_membership_plans', 'platform_coupons',
    'platform_shipping_addresses', 'platform_orders', 'platform_order_items', 'platform_coupon_redemptions',
    'platform_payment_attempts', 'platform_provider_events', 'platform_refunds', 'platform_inventory_ledger',
    'platform_fulfillment_ledger', 'platform_event_registrations', 'platform_course_entitlements',
    'platform_entitlement_ledger', 'platform_memberships', 'platform_membership_ledger',
    'platform_lesson_progress', 'platform_lesson_notes', 'platform_favorites', 'platform_quiz_attempts',
    'platform_course_reviews', 'platform_certificates', 'platform_checkins', 'platform_point_ledger',
    'platform_achievements', 'platform_user_achievements', 'platform_instructor_revenue_ledger',
    'platform_instructor_payouts', 'platform_instructor_payout_items', 'platform_invite_codes',
    'platform_invite_redemptions', 'platform_qr_codes', 'platform_qr_revisions', 'platform_qr_scans',
    'platform_qr_templates', 'platform_qr_card_jobs', 'platform_privacy_consents',
    'platform_analytics_events', 'platform_analytics_daily_aggregates', 'platform_retention_jobs',
    'platform_reconciliation_records', 'platform_audit_events', 'platform_outbox_events',
    'platform_idempotency_requests',
  ] },

  // ── user artifacts ──────────────────────────────────────
  { name: 'timer_backups', domain: 'studio', origin: '0020', purpose: { zh: '计时器成绩云备份(单快照覆盖)', en: 'Cloud backup of timer sessions (single overwrite snapshot)' }, cols: [
    { name: 'wca_id (PK)' }, { name: 'blob', note: { zh: '导出的 JSON', en: 'exported JSON' } }, { name: 'byte_size, solve_count, updated_at' },
  ] },
  { name: 'timer_boot_events', domain: 'studio', origin: '0166', purpose: { zh: '按单次打开去重统计计时页启动尝试、成功与失败，保留 90 天', en: 'Deduplicated timer startup attempts, successes, and failures retained for 90 days' }, cols: [
    { name: 'boot_id UUID (PK), path, outcome, failure_kind' },
    { name: 'engine_family / major, os_family / major, container, support_status', note: { zh: '仅粗粒度分桶，不保存完整 UA、IP、错误正文或账号', en: 'Coarse buckets only; no raw UA, IP, error text, or account' } },
    { name: 'attempted_at, updated_at' },
  ] },
  { name: 'timer_sessions', domain: 'studio', origin: 'snapshot', purpose: { zh: '计时器分组 / 分段', en: 'Timer sessions / groups' } },
  { name: 'train_results', domain: 'studio', origin: 'snapshot', purpose: { zh: '公式计时训练成绩', en: 'Trainer (timed-alg) results' } },
  { name: 'collaborative_documents', domain: 'studio', origin: '0122', evolved: [123], purpose: { zh: '通用协作文档与在线表格：标题、类型、所有者及可合并的 Yjs 状态', en: 'Collaborative docs and spreadsheets: title, kind, owner, and mergeable Yjs state' }, cols: [
    { name: 'id (UUID PK), title, kind, owner_key' }, { name: 'ydoc_state BYTEA', note: { zh: 'Yjs 二进制更新，保留并发编辑语义', en: 'Binary Yjs update preserving concurrent-edit semantics' } }, { name: 'created_at, updated_at' },
  ] },
  { name: 'collaborative_document_members', domain: 'studio', origin: '0122', naturalKey: true, purpose: { zh: '协作文档成员与 owner / editor / viewer 权限', en: 'Collaborative-document membership and owner / editor / viewer roles' }, cols: [
    { name: 'document_id, user_key (PK)' }, { name: 'role, added_by, created_at' },
  ] },
  { name: 'collaborative_document_subscriptions', domain: 'studio', origin: '0124', naturalKey: true, purpose: { zh: '协作资源按用户保存修改订阅、最后查看与通知节流时间', en: 'Per-user subscriptions, last-seen timestamps, and notification throttling for collaborative resources' }, cols: [
    { name: 'document_id, user_key (PK)' }, { name: 'subscribed, last_seen_at, last_notified_at, updated_at' },
  ] },
  { name: 'alg_case_marks', domain: 'studio', origin: '0076', naturalKey: true, purpose: { zh: '训练器 per-case 学习标记(不熟/已掌握)', en: 'Per-case learning marks in the alg trainer (shaky/mastered)' }, cols: [
    { name: 'wca_id, puzzle, set_slug, case_key', note: { zh: '自然键;case_key = subgroup|name', en: 'natural key; case_key = subgroup|name' } }, { name: 'status, updated_at' },
  ] },
  { name: 'alg_chain_orders', domain: 'studio', origin: '0129', naturalKey: true, purpose: { zh: '公式集连拧按用户、公式集和范围保存的自定义 case 顺序', en: 'Per-user custom case order for each algorithm set and time-attack scope' }, cols: [
    { name: 'wca_id, puzzle, set_slug, scope (PK)' },
    { name: 'case_keys JSONB', note: { zh: '只存 canonical key 数组，不复制公式内容', en: 'canonical-key array only; algorithm content is not duplicated' } },
    { name: 'updated_at', note: { zh: '本地与云端合并的 LWW 版本号', en: 'LWW version for local/cloud merging' } },
  ] },
  { name: 'alg_preferred_algs', domain: 'studio', origin: '0131', naturalKey: true, purpose: { zh: '公式记忆按用户和公式集保存的主公式偏好', en: 'Per-user primary algorithm preferences for each algorithm set' }, cols: [
    { name: 'wca_id, puzzle, set_slug (PK)' },
    { name: 'items JSONB', note: { zh: 'case 与朝向到稳定公式引用的映射，不复制公式内容', en: 'case-and-orientation map to stable algorithm references; algorithm content is not duplicated' } },
    { name: 'updated_at', note: { zh: '本地与云端整份合并的 LWW 版本号', en: 'whole-snapshot LWW version for local/cloud merging' } },
  ] },
  { name: 'alg_case_srs', domain: 'studio', origin: '0089', naturalKey: true, purpose: { zh: '公式记忆(间隔重复)per-case 调度状态:到期时刻 / 间隔 / 难度因子 / 遗忘次数 / 最近 12 次评分。与手动标记分表 —— 清标记不该抹掉记忆曲线', en: 'Per-case spaced-repetition schedule for algs: due, interval, ease, lapses, last 12 grades. Kept apart from manual marks — clearing a mark must not wipe the memory curve' }, cols: [
    { name: 'wca_id, puzzle, set_slug, case_key', note: { zh: '自然键;同 alg_case_marks', en: 'natural key; same shape as alg_case_marks' } }, { name: 'due, ivl, ease' }, { name: 'reps, lapses, streak' }, { name: 'hist', note: { zh: '最近 12 次评分,2bit/次', en: 'last 12 grades, 2 bits each' } }, { name: 'reviewed_at', note: { zh: '上次复习,兼作 LWW 版本号', en: 'last review; doubles as the LWW version' } },
  ] },
  { name: 'alg_set_progress', domain: 'studio', origin: '0096', naturalKey: true, purpose: { zh: '「过遍」进度:哪些范围整轮过完了 + 停在哪。上面两张是一 case 一行,LSLL 149,188 个 case 练满就是 29.8 万行、撞满每用户 20,000 条上限;而「这一轮 302 个过完了」一整轮只要一个数 —— 记在这里之后,那一轮里没有手动标记的记忆排期就能折叠掉', en: 'Sweep progress: which scopes have been taken all the way through, and where you stopped. The two tables above are one row per case, so LSLL’s 149,188 cases mean 298k rows and blow the 20,000-per-user ceiling; but “I finished this round of 302” needs a single number for the whole round — once it lives here, that round’s unmarked schedules can be folded away' }, cols: [
    { name: 'wca_id, puzzle, set_slug', note: { zh: '自然键;每用户每 set 一行', en: 'natural key; one row per user per set' } },
    { name: 'sweeps', note: { zh: '{ scope: 过完几遍 };合并逐 scope 取 max', en: '{ scope: times swept }; merged per scope by max' } },
    { name: 'cursor', note: { zh: '{ scope, pos, total },给「继续第 67 轮」', en: '{ scope, pos, total } — powers “resume round 67”' } },
    { name: 'folded_at', note: { zh: '最后一次折叠时刻;折叠是真删行,别的设备靠它判定本地陈旧记录该丢而不是回传', en: 'last fold; folding really deletes rows, so other devices use it to drop stale local recs instead of re-uploading them' } },
    { name: 'updated_at', note: { zh: 'cursor 的 LWW 版本号', en: 'LWW version for cursor' } },
  ] },
  { name: 'alg_srs_daily', domain: 'studio', origin: '0089', naturalKey: true, purpose: { zh: '每日复习量(热力图 / 连续天数);多设备离线各刷各的,合并取当天较大值', en: 'Daily review counts (heatmap / streak); offline devices merge by per-day max' }, cols: [
    { name: 'wca_id, day', note: { zh: '自然键', en: 'natural key' } }, { name: 'reviews, again' },
  ] },
  { name: 'battle_rooms', domain: 'studio', origin: '0086', purpose: { zh: '/timer 联机对战房间:每人可选自己项目(同项目共享打乱),当前轮各项目打乱 + 玩家实时状态 + 每轮战绩历史 + 胜场(1s 轮询 + jsonb 原子合并)', en: '/timer online battle rooms: each player picks their own event (same-event players share a scramble), per-event current scrambles + live status + per-round history + win tallies (1s polling, atomic jsonb merges)' }, cols: [
    { name: 'code (PK), event, round' }, { name: 'scrambles JSONB', note: { zh: '{event:scramble} 当前轮各项目打乱(同项目共享)', en: '{event:scramble} current-round scramble per event (shared)' } }, { name: 'players JSONB', note: { zh: '{pid:{name,seen,ph,at,event}} 心跳 + 实时状态 + 所选项目', en: '{pid:{name,seen,ph,at,event}} heartbeat + live phase + chosen event' } }, { name: 'results JSONB', note: { zh: '{round:{pid:{t,p}}} 当前轮成绩', en: '{round:{pid:{t,p}}} current-round results' } }, { name: 'history JSONB', note: { zh: '[{round,scrambles,playerEvents,results,winners}] 最近 50 轮', en: '[{round,scrambles,playerEvents,results,winners}], last 50 rounds' } }, { name: 'scores JSONB' }, { name: 'admin, sync_start, start_at', note: { zh: '房主 pid(离场回落最早加入者)+「同时开始计时」开关 + 本轮同时起表时刻', en: 'host pid (falls back to the earliest joiner) + synchronized-start toggle + this round’s shared start instant' } },
  ] },
  { name: 'paint_drawings', domain: 'studio', origin: '0055', purpose: { zh: '/paint 矢量画作云存(doc + 缩略图)', en: 'Cloud-stored /paint vector drawings' }, cols: [
    { name: 'wca_id, title' }, { name: 'doc', note: { zh: '扁平文档 JSON', en: 'flat document JSON' } }, { name: 'thumbnail, byte_size' },
  ] },
  { name: 'calendars', domain: 'studio', origin: '0099', purpose: { zh: '/calendar 的日历容器(名字 / 颜色 / 缺省时区);每人一个不可删的主日历', en: '/calendar containers (name, colour, default zone); one undeletable default per person' } },
  { name: 'calendar_events', domain: 'studio', origin: '0099', purpose: { zh: '日程。存的是「主事件 + 重复规则」而不是展开后的每一次 —— 无限重复本来就存不下,改一次规则也不该回改上万行;时刻用绝对毫秒 + 事件自己的 IANA 时区,因为重复必须按墙上钟点推进(每周三 9:00 换季后还是 9:00)', en: 'Events. Stored as “master + recurrence rule”, never as expanded occurrences — an unbounded series does not fit, and editing the rule must not rewrite thousands of rows. Times are absolute ms plus the event’s own IANA zone, because recurrence advances by wall-clock (a Wednesday 9:00 meeting stays 9:00 across a DST change)' }, cols: [
    { name: 'rrule, exdates', note: { zh: 'RFC 5545 规则 + 被删掉 / 被覆盖的那几次', en: 'RFC 5545 rule plus the occurrences deleted or overridden' } },
    { name: 'series_id, occurrence_ms', note: { zh: '「只改这一次」生成的覆盖行:指回主事件 + 替换的是哪一次', en: 'Override row from “this event only”: points back at the master and which occurrence it replaces' } },
    { name: 'reminders', note: { zh: '提前分钟数列表,提醒扫描器每分钟按它算该不该发', en: 'Minutes-before list; the sweep reads it every minute to decide what fires' } },
  ] },
  { name: 'calendar_imports', domain: 'studio', origin: '0101', purpose: { zh: '一次 .ics / .zip 导入记一行,事件和它新建的日历都挂这个 id。有它才能整批撤销 —— 否则只能按时间戳猜哪些是一起进来的,用户在导入前后手建的日程会被误伤', en: 'One row per .ics / .zip import; the events and any calendars it created carry the id. This is what makes a whole import undoable — without it you could only guess by timestamp which rows arrived together, and anything the user typed in around the import would be swept up with it' } },
  { name: 'calendar_shares', domain: 'studio', origin: '0099', purpose: { zh: '对外展示设置,一人一行。detail=busy 时服务端只发时间段,标题 / 说明 / 地点 / 参与者根本不出库 —— 脱敏在服务端做,不指望前端不渲染', en: 'Public-share settings, one row per person. With detail=busy the server sends only the time ranges; titles, notes, location and guests never leave the database — redaction happens server-side, not by hoping the front end skips them' } },
  { name: 'calendar_guests', domain: 'studio', origin: '0099', purpose: { zh: '站内嘉宾:被邀请者在自己的 /calendar 里看得到这条,并能接受 / 拒绝', en: 'In-site guests: invitees see the event on their own /calendar and can accept or decline' } },
  { name: 'calendar_reminder_log', domain: 'studio', origin: '0099', purpose: { zh: '提醒去重:(事件, 第几次, 提前几分钟, 收件人) 抢占式插入,进程重启与补发窗口重叠都不会轰炸两遍', en: 'Reminder dedupe: an insert race on (event, occurrence, minutes, recipient), so restarts and overlapping catch-up windows cannot double-fire' } },

  // ── commerce & feedback ─────────────────────────────────
  { name: 'membership_plans', domain: 'commerce', origin: '0046', purpose: { zh: '会员套餐:月 / 年 / 永久 + perks', en: 'Membership plans: monthly / yearly / lifetime + perks' }, cols: [
    { name: 'slug (PK)', note: { zh: 'monthly | yearly | lifetime', en: 'monthly | yearly | lifetime' } }, { name: 'period, currency' }, { name: 'perks JSONB' },
  ] },
  { name: 'membership_orders', domain: 'commerce', origin: '0046', purpose: { zh: '会员订单(我方单号 + provider / channel)', en: 'Membership orders (out_trade_no + provider/channel)' } },
  { name: 'memberships', domain: 'commerce', origin: '0046', purpose: { zh: '会员有效期', en: 'Active membership validity' } },
  { name: 'wca_teachers', domain: 'commerce', origin: '0114', evolved: [185], naturalKey: true, purpose: { zh: '选手按项目登记老师或自学：有效会员自报，管理员可代填', en: 'Per-event teacher or self-taught learning sources with member self-reporting and admin override' }, cols: [
    { name: 'student_wca_id + event_id (PK)' }, { name: 'teacher_wca_id, teacher_name', note: { zh: '两者同时为空表示自学', en: 'Both null means self-taught' } }, { name: 'created_by, updated_by' },
  ] },
  { name: 'wca_teacher_named_students + wca_teacher_named_student_events', domain: 'commerce', origin: '0174', evolved: [177], purpose: { zh: '尚无 WCA ID 的学生名册：姓名、必填国籍与老师教授的项目分别保存', en: 'Teacher rosters for students without WCA IDs, with names, required nationalities, and taught events stored separately' }, family: [
    'wca_teacher_named_students', 'wca_teacher_named_student_events',
  ] },
  { name: 'sponsors', domain: 'commerce', origin: '0043', purpose: { zh: '/support 致谢 / 赞助墙(admin 手录)', en: 'Sponsor / support wall (admin-entered)' } },
  { name: 'contributors', domain: 'commerce', origin: '0075', purpose: { zh: '/support 贡献者名单:score = 贡献次数(admin 点数字 +1),contributions = 每次贡献的内容明细 [{ zh, en, date? }]', en: 'Contributor wall on /support: score = contribution count (admin clicks to +1), contributions = per-contribution content details [{ zh, en, date? }]' } },
  { name: 'feedback', domain: 'commerce', origin: '0049', evolved: [58], purpose: { zh: '桌宠反馈帖:类型 / 正文 / 环境快照', en: 'Desk-pet feedback threads: kind, body, environment' }, cols: [
    { name: 'kind', note: { zh: 'need | bug | other', en: 'need | bug | other' } }, { name: 'body, wca_id, contact' }, { name: 'page_url, lang, theme, viewport' }, { name: 'status', note: { zh: 'new | triaged | done', en: 'new | triaged | done' } },
  ] },
  { name: 'feedback_media', domain: 'commerce', origin: '0049', purpose: { zh: '反馈媒体:截图存 bytea,视频落磁盘', en: 'Feedback media: screenshots in bytea, video on disk' } },
  { name: 'feedback_messages', domain: 'commerce', origin: '0058', purpose: { zh: '反馈多轮对话(body 是开帖,往来存这)', en: 'Threaded replies on a feedback item' } },

  // ── community & ops ─────────────────────────────────────
  { name: 'article', domain: 'community', origin: '0026', purpose: { zh: '/article 社区长文正文', en: 'Community long-form article body' } },
  { name: 'article_image', domain: 'community', origin: '0026', purpose: { zh: '长文配图', en: 'Article images' } },
  { name: 'article_report', domain: 'community', origin: '0027', purpose: { zh: '长文举报 / 审核(防滥用)', en: 'Article reports / moderation queue' } },
  { name: 'comments', domain: 'community', origin: 'snapshot', purpose: { zh: '评论', en: 'Comments' } },
  { name: 'edits', domain: 'community', origin: 'snapshot', purpose: { zh: '编辑记录', en: 'Edit records' } },
  { name: 'edit_history', domain: 'community', origin: 'snapshot', purpose: { zh: '编辑历史', en: 'Edit history' } },
  { name: 'wiki_terms', domain: 'community', origin: '0009', purpose: { zh: '/wiki 术语表(713 条 seed,软删审计)', en: 'Glossary terms (713 seeded, soft-delete)' } },
  { name: 'wiki_additions', domain: 'community', origin: '0009', purpose: { zh: '术语增补(他人在条目下补充)', en: 'User additions to a glossary term' } },
  { name: 'colpi_words', domain: 'community', origin: 'snapshot', evolved: [3, 4], purpose: { zh: '记忆训练词库(word + note)', en: 'Memo-training word bank (word + note)' } },
  { name: 'colpi_votes', domain: 'community', origin: 'snapshot', purpose: { zh: '词库投票', en: 'Word-bank votes' } },
  { name: 'forum_categories', domain: 'community', origin: '0066', purpose: { zh: '/forum 论坛分类(首页分组标题)', en: 'Forum categories (index group headers)' } },
  { name: 'forum_forums', domain: 'community', origin: '0066', purpose: { zh: '论坛子版(发帖目的地,seed 16 版)', en: 'Forum boards (16 seeded)' } },
  { name: 'forum_threads', domain: 'community', origin: '0066', purpose: { zh: '论坛主题(置顶 / 锁帖 / 软删 + 末帖缓存)', en: 'Forum threads (pin / lock / soft-delete + last-post cache)' } },
  { name: 'forum_posts', domain: 'community', origin: '0066', purpose: { zh: '论坛帖子(markdown 正文,软删保楼层号)', en: 'Forum posts (markdown body, soft-delete keeps post numbers)' } },
  { name: 'forum_videos', domain: 'community', origin: '0163', purpose: { zh: '论坛短视频上传元数据，发布前归属账号，发布时原子绑定首帖', en: 'Forum short-video upload metadata, owned before publishing and atomically attached to the first post' } },
  { name: 'forum_reactions', domain: 'community', origin: '0066', purpose: { zh: '帖子反应(一人一帖一条,可换类型)', en: 'Post reactions (one per user per post)' } },
  { name: 'forum_reports', domain: 'community', origin: '0066', purpose: { zh: '帖子举报(一人一帖一条,resolved_at 空 = 待处理)', en: 'Post reports (one per user per post, null resolved_at = open)' } },
  { name: 'quiz_questions', domain: 'community', origin: '0100', purpose: { zh: '/quiz 社区题:登录用户自己出的题,直接上线,与内置题库同池出场', en: '/quiz community questions — written by members, live immediately, drawn alongside the built-in bank' }, cols: [
    { name: 'status', note: { zh: 'published / hidden 两态。没有前置审核,把关靠举报', en: 'published / hidden only — no pre-moderation; reports do the policing' } },
    { name: 'q_zh / q_en', note: { zh: '成对语言列,允许一侧为空:缺的一侧答题页回落并标注,管理员后补', en: 'Paired language columns, either side may be empty: the missing one falls back with a note for an admin to translate' } },
    { name: 'accept', note: { zh: '问答题的判对关键词。作者自己的参考答案必须能被它判对(shared/quiz 校验)', en: 'Short-answer keywords — the author’s own reference answer must be accepted by them (validated in shared/quiz)' } },
  ] },
  { name: 'quiz_question_reports', domain: 'community', origin: '0100', purpose: { zh: '社区题举报(一人一题一条,resolved_at 空 = 待处理,同 forum_reports)', en: 'Community-question reports (one per user per question, null resolved_at = open, same shape as forum_reports)' } },
  { name: 'notifications', domain: 'community', origin: '0070', purpose: { zh: '站内通知（社区互动、好友申请与系统消息；read_at 空 = 未读）', en: 'Site notifications for community activity, friend requests, and system messages; null read_at means unread' }, cols: [
    { name: 'id (PK)' }, { name: 'user_key', note: { zh: '收件人 ownerKey,同 comments.author_id 语义', en: 'recipient ownerKey, same semantics as comments.author_id' } },
    { name: 'kind', note: { zh: '复盘、论坛、好友、日程等通知类型', en: 'Notification kind for recon, forum, friends, calendar, and other domains' } },
    { name: 'actor_key, actor_name' }, { name: 'title, excerpt, link' }, { name: 'created_at, read_at' },
  ] },
  { name: 'nav_sites', domain: 'community', origin: '0001', evolved: [2, 170], purpose: { zh: '/site 网址导航(group_id 避 SQL 关键字)', en: 'The /site link directory' } },
  { name: 'teacher_directory_entries', domain: 'community', origin: '0126', purpose: { zh: '/teachers 魔方老师与培训机构目录;登录用户维护自己的资料,管理员维护全部资料', en: 'The /teachers cube teacher and training-school directory; signed-in users maintain their own profiles and admins maintain all profiles' }, cols: [
    { name: 'kind', note: { zh: 'teacher / organization', en: 'teacher / organization' } },
    { name: 'name_zh / name_en, location_zh / location_en, description_zh / description_en' },
    { name: 'specialties_zh / specialties_en JSONB, teaching_mode, contacts JSONB, images JSONB, contact (legacy), website, wca_id' },
    { name: 'is_curated, is_visible', note: { zh: '管理员认证与作者控制的公开状态', en: 'admin curation and owner-controlled public visibility' } },
    { name: 'owner_key, owner_name', note: { zh: '作者身份与显示名;公开列表不返回 owner_key', en: 'author identity and display name; the public list omits owner_key' } },
  ] },
  { name: 'creator_gallery_captions', domain: 'community', origin: '0176', purpose: { zh: '/about/ruimin 个人图库的双语照片说明;图片本体作为前端静态资源保存', en: 'Bilingual captions for the /about/ruimin personal gallery; image files remain frontend static assets' }, cols: [
    { name: 'image_key', note: { zh: '固定对应 photo-01 至 photo-08', en: 'Fixed to photo-01 through photo-08' } },
    { name: 'caption_zh, caption_en' },
    { name: 'updated_at' },
  ] },
  { name: 'teacher_live_scripts', domain: 'community', origin: '0160', purpose: { zh: '老师与培训机构名下的结构化直播话术;公开读取同时受话术和资料可见性控制', en: 'Structured livestream scripts owned by teacher and school profiles; public reads require both the script and profile to be visible' }, cols: [
    { name: 'teacher_entry_id', note: { zh: '关联 teacher_directory_entries,删除资料时级联删除', en: 'References teacher_directory_entries and cascades when the profile is deleted' } },
    { name: 'title_zh / title_en, summary_zh / summary_en, duration_minutes' },
    { name: 'content JSONB', note: { zh: '准备清单、分段话术、提示、备注与参考链接', en: 'Preparation, sections, cues, notes, and reference links' } },
    { name: 'is_visible, created_at, updated_at' },
  ] },
  { name: 'teaching_advanced_lessons', domain: 'community', origin: '0127', purpose: { zh: '/courses 的 CFOP 后续课程池;管理员维护三阶和二阶路线的双语内容', en: 'Post-CFOP lesson pool for /courses; administrators maintain bilingual 3×3 and 2×2 tracks' }, cols: [
    { name: 'track, position', note: { zh: 'track 为 333 / 222,position 控制路线内顺序', en: 'track is 333 / 222; position controls order within a track' } },
    { name: 'title_zh / title_en', note: { zh: '两种语言标题均必填', en: 'both language titles are required' } },
    { name: 'description_zh / description_en', note: { zh: '课程说明或口播提纲,允许留空', en: 'optional lesson notes or narration outlines' } },
    { name: 'minutes', note: { zh: '管理员可调的预计时长,范围 1–60 分钟', en: 'administrator-editable estimate from 1 to 60 minutes' } },
  ] },
  { name: 'teaching_trial_lesson_overrides', domain: 'community', origin: '0133', evolved: [134], purpose: { zh: '/courses 试听课的双语覆盖层;管理员维护中文，AI 按待同步状态更新英文', en: 'Bilingual overrides for trial lessons on /courses; administrators maintain Chinese and AI updates English when marked stale' }, cols: [
    { name: 'lesson_id (PK)', note: { zh: '对应前端试听课稳定编号', en: 'stable identifier of the frontend trial lesson' } },
    { name: 'title_zh, outcome_zh, minutes', note: { zh: '可直接修改的中文标题、目标与时长', en: 'editable Chinese title, goal, and duration' } },
    { name: 'shots_zh JSONB, script_zh JSONB', note: { zh: '按顺序保存拍摄清单与完整口播段落', en: 'ordered shot-list items and complete narration paragraphs' } },
    { name: 'title_en, outcome_en, shots_en JSONB, script_en JSONB', note: { zh: 'AI 同步后的英文内容；英文数组与中文保持逐项对应', en: 'AI-synced English content; English arrays stay aligned item by item with Chinese' } },
    { name: 'english_stale', note: { zh: '中文保存后置为 true，英文同步成功后置为 false', en: 'set true after a Chinese save and false after a successful English sync' } },
    { name: 'content_revision', note: { zh: '每次中文保存递增，阻止旧翻译覆盖更新后的中文', en: 'increments on each Chinese save to stop stale translations from overwriting newer content' } },
  ] },
  { name: 'ops_commands', domain: 'community', origin: '0010', evolved: [11], purpose: { zh: '/dev/ops runbook 命令 + 提示词模板', en: 'Commands + prompts behind the /dev/ops runbook' } },
  { name: 'page_notices', domain: 'community', origin: '0073', purpose: { zh: '按路径与展示位管理顶部通知、首页焦点新闻及其生效时间窗', en: 'Manage top notices and homepage featured news by path and placement, including active windows' } },
  { name: 'pattern_examples', domain: 'community', origin: '0091', purpose: { zh: '/scramble/pattern/search 的示例预设:管理员在页面上摆好图案就能存一条,q 存的就是可分享的 ?q= 编码', en: 'Example presets for /scramble/pattern/search: an admin lays out a pattern and saves it; q holds the same shareable ?q= encoding the page uses' }, cols: [
    { name: 'position, name_zh, name_en' }, { name: 'q', note: { zh: '45 位色类 + 5×2 位面分配掩码', en: '45 class digits + 5 two-hex face masks' } }, { name: 'continuous' },
  ] },
  { name: 'sim_masks', domain: 'community', origin: '0095', purpose: { zh: '/sim 遮罩下拉的管理员覆盖层(改名 / 排序 / 隐藏)+ 点选贴纸存出来的自建遮罩', en: 'Admin override layer for the /sim mask select (label / order / hidden) plus admin-built masks saved from a sticker pick' }, cols: [
    { name: 'mask_key (UNIQUE)', note: { zh: '内置 = 下拉里的阶段名;自建 = preset:<slug>', en: 'builtin = the stage name in the select; custom = preset:<slug>' } },
    { name: 'kind, cube_size, position, hidden' }, { name: 'label_en, label_zh', note: { zh: '空 = 用代码里的默认标签', en: 'empty = keep the code default label' } },
    { name: 'sids, pick, rest', note: { zh: '自建遮罩的贴纸清单,同 ?stickeringMask= 编码', en: 'the sticker list of a custom mask — same encoding as ?stickeringMask=' } },
  ] },

];

const MIGRATIONS: { n: number; slug: string; desc: Bi }[] = [
  { n: 0, slug: 'bootstrap_updated_at_function', desc: { zh: '为全新数据库预先创建共用 updated_at trigger 函数，修复历史迁移 0001 早于 0010 引用它的重放缺口。', en: 'Bootstrap the shared updated_at trigger function so fresh replays can run historical migration 0001 before 0010.' } },
  { n: 1, slug: 'nav_sites', desc: { zh: '/site 导航站表初建', en: 'Create nav_sites for the /site directory' } },
  { n: 2, slug: 'seed_nav_sites', desc: { zh: '从旧静态数组一次性导入导航数据', en: 'One-off seed of nav sites' } },
  { n: 3, slug: 'add_note_to_colpi_words', desc: { zh: 'colpi_words 加 note 列', en: 'Add note column to colpi_words' } },
  { n: 4, slug: 'backfill_colpi_notes', desc: { zh: '括号内容搬进 note,word 去括号', en: 'Move parenthesised text into note' } },
  { n: 5, slug: 'normalize_recon_solution_slashes', desc: { zh: '规范化 recons.solution 里 // 注释空格', en: 'Normalise // comment spacing in solutions' } },
  { n: 6, slug: 'historical_ranks_pb_context', desc: { zh: 'persons 排名补 PB 来源比赛 / 日期 / 五把 6 列', en: 'Add PB-context columns to persons ranks' } },
  { n: 7, slug: 'wrt_prior_pr_index', desc: { zh: '赛前 PR 查询专用索引,58s→105ms', en: 'Pre-comp PR lookup index, 58s→105ms' } },
  { n: 8, slug: 'traffic_analytics', desc: { zh: '自建流量:pageviews + traffic_daily', en: 'Self-hosted analytics tables' } },
  { n: 9, slug: 'wiki', desc: { zh: '/wiki 术语表 + 增补(713 条 seed)', en: 'Glossary wiki, 713 seeded terms' } },
  { n: 10, slug: 'ops_commands', desc: { zh: '/dev/ops runbook 命令表', en: 'Table behind the ops runbook' } },
  { n: 11, slug: 'seed_ops_commands', desc: { zh: '导入初始 6 条命令 / 提示词', en: 'Seed the first 6 ops commands' } },
  { n: 12, slug: 'cn_comp_zh', desc: { zh: '中国比赛中文地点 + 报名时间缓存', en: 'Cache Chinese comp localisation' } },
  { n: 13, slug: 'person_ranks_best_final_pos', desc: { zh: '领奖台口径改为决赛实际名次', en: 'Fix podium semantics to real placement' } },
  { n: 14, slug: 'comp_snapshots', desc: { zh: '直播比赛持久化 L2 缓存', en: 'Persistent L2 cache for live results' } },
  { n: 15, slug: 'comp_dump_state', desc: { zh: '比赛 dump 增量水位状态机', en: 'Per-comp incremental dump watermark' } },
  { n: 16, slug: 'comp_dump_content_hash', desc: { zh: '增量决策改用成绩内容指纹', en: 'Switch dump diff to content hash' } },
  { n: 17, slug: 'person_dump_state', desc: { zh: '选手 dump 增量状态', en: 'Per-person dump state' } },
  { n: 18, slug: 'historical_best_ranks', desc: { zh: '选手生涯最佳名次专表', en: 'Career-best rank table' } },
  { n: 19, slug: 'drop_dead_monthly_indexes', desc: { zh: '清理已废弃的月级快照索引', en: 'Drop unused monthly-snapshot indexes' } },
  { n: 20, slug: 'timer_backups', desc: { zh: '计时器成绩云备份', en: 'Timer cloud backup' } },
  { n: 21, slug: 'comp_schedule_cache', desc: { zh: '比赛赛程服务端缓存', en: 'Server-side schedule cache' } },
  { n: 22, slug: 'sor_combo_count', desc: { zh: '名次和 best_events 改多组合列表', en: 'SoR best_events → multi-combo list' } },
  { n: 23, slug: 'monitor_pushed_state', desc: { zh: '监控推送去重状态', en: 'Monitor push dedup state' } },
  { n: 24, slug: 'watched_persons', desc: { zh: '成绩监控对象 + PR 基线表', en: 'Watched persons + PR baseline' } },
  { n: 25, slug: 'seed_watched_persons', desc: { zh: '导入初始监控选手', en: 'Seed initial watched persons' } },
  { n: 26, slug: 'article', desc: { zh: '/article 社区长文发布系统', en: 'Community article publishing' } },
  { n: 27, slug: 'article_report', desc: { zh: '长文举报 / 审核入口', en: 'Article reporting / moderation' } },
  { n: 28, slug: 'wca_fun_stats', desc: { zh: '/wca/fun-stats 趣味统计 15 张表', en: '15 fun-stats derived tables' } },
  { n: 29, slug: 'recons_add_city', desc: { zh: 'recons 加 city 列', en: 'Add city column to recons' } },
  { n: 30, slug: 'sor_pb_incl_cancelled', desc: { zh: '名次和区分是否含废止项', en: 'SoR: flag cancelled-events inclusion' } },
  { n: 31, slug: 'sor_census_yearly_no_podium', desc: { zh: '名次和年度普查加「无领奖台」口径', en: 'SoR census: no-podium variant' } },
  { n: 32, slug: 'recons_co_persons', desc: { zh: 'recons 加 co_persons 合作署名', en: 'Add co_persons (co-solver) to recons' } },
  { n: 33, slug: 'sor_historical_best', desc: { zh: '名次和历史最佳专表', en: 'SoR historical-best table' } },
  { n: 34, slug: 'sor_historical_best_total', desc: { zh: '历史最佳同存总和 + 排名', en: 'Store total + rank for SoR best' } },
  { n: 35, slug: 'wca_scrambles', desc: { zh: 'WCA 真实打乱语料表', en: 'Real WCA scramble corpus' } },
  { n: 36, slug: 'wca_scrambles_random_index', desc: { zh: '随机抽打乱索引(替 11.8s 全扫)', en: 'Index for random scramble sampling' } },
  { n: 37, slug: 'wca_scrambles_rnd_index', desc: { zh: '把洗牌烤进 (event,rnd,id) 索引', en: 'Bake shuffle into a dart-throw index' } },
  { n: 38, slug: 'person_ranks_continent', desc: { zh: '选手排名加洲际维度', en: 'Add continental dimension to ranks' } },
  { n: 39, slug: 'person_ranks_21', desc: { zh: '排名 21 项口径(缺项罚分)', en: '21-event rank parity with subsets' } },
  { n: 40, slug: 'person_ranks_continent_array', desc: { zh: '本洲口径自选组合求和数据基', en: 'Continental-scope custom-combo data' } },
  { n: 41, slug: 'scramble_marks', desc: { zh: '打乱公开标记 + feed(六元自然键)', en: 'Public scramble marks + feed' } },
  { n: 42, slug: 'rename_wca_results_top_to_flat', desc: { zh: '扁平成绩表改名 wca_results_flat', en: 'Rename the flat results table' } },
  { n: 43, slug: 'sponsors', desc: { zh: '/support 致谢 / 赞助墙', en: 'Sponsor / support wall' } },
  { n: 44, slug: 'cn_comp_zh_name', desc: { zh: '当天公示 CN 比赛中文标题即时缓存', en: 'Same-day Chinese title cache' } },
  { n: 45, slug: 'comp_follows', desc: { zh: '登录用户比赛关注', en: 'Logged-in comp follows' } },
  { n: 46, slug: 'membership', desc: { zh: '会员订阅:套餐 / 订单 / 会员三表', en: 'Membership: plans / orders / memberships' } },
  { n: 47, slug: 'wca_scramble_optimal', desc: { zh: '最优打乱(invert 最优解)表', en: 'Optimal scrambles table' } },
  { n: 48, slug: 'wca_result_changes', desc: { zh: '往期成绩变更:快照 + append-only 变更链', en: 'Past-result change monitor + change log' } },
  { n: 49, slug: 'feedback', desc: { zh: '桌宠反馈:正文 + 媒体', en: 'Desk-pet feedback: body + media' } },
  { n: 50, slug: 'wca_live_person_results', desc: { zh: '官方收录前的直播成绩', en: 'Pre-official live results' } },
  { n: 51, slug: 'wca_result_changes_manual', desc: { zh: '管理员手动标注成绩更改', en: 'Admin-curated manual result edits' } },
  { n: 52, slug: 'wca_persons_directory_sort', desc: { zh: '选手名录按首字母 / 名长排序', en: 'Person directory sort keys' } },
  { n: 53, slug: 'wca_person_aka', desc: { zh: '选手曾用名(former_names JSONB)', en: 'Person former names' } },
  { n: 54, slug: 'wca_person_aka_detail', desc: { zh: '曾用名细节(含国籍变更)另存', en: 'Former-name detail incl. nationality' } },
  { n: 55, slug: 'paint_drawings', desc: { zh: '/paint 矢量画作云存', en: 'Cloud-stored paint drawings' } },
  { n: 56, slug: 'wca_result_changes_status', desc: { zh: '成绩变更加 status 状态', en: 'Add status to result changes' } },
  { n: 57, slug: 'wca_scramble_steps', desc: { zh: '按难度抽真题:逐阶段最优步数 + 热列', en: 'Per-step optimal lengths for difficulty' } },
  { n: 58, slug: 'feedback_conversation', desc: { zh: '反馈加多轮对话', en: 'Threaded replies for feedback' } },
  { n: 59, slug: 'alg_submission_reads', desc: { zh: '公式投稿已读状态(admin 红点)', en: 'Read state for alg submissions' } },
  { n: 60, slug: 'wca_championship_podiums', desc: { zh: '锦标赛领奖台专表', en: 'Championship podium table' } },
  { n: 61, slug: 'wss_difficulty_indexes', desc: { zh: '打乱难度子集查询补索引', en: 'Indexes for difficulty subset queries' } },
  { n: 62, slug: 'wss_covering_and_rare', desc: { zh: '难度查询覆盖索引(index-only)+ 稀有档侧表', en: 'Covering index (index-only) + rare-bin side table for difficulty' } },
  { n: 62, slug: 'wca_persons_gender', desc: { zh: 'wca_persons 加 gender 列,支撑 /wca 排名页性别筛选', en: 'Add gender column to wca_persons for the rankings gender filter' } },
  { n: 63, slug: 'recons_dup_reason', desc: { zh: 'recons 加 dup_reason 列,支撑同选手+同打乱有理由重复提交', en: 'Add dup_reason column to recons for intentional duplicate submissions' } },
  { n: 64, slug: 'user_accounts', desc: { zh: '内部账号体系:app_users + auth_identities(多身份绑定)+ auth_codes(邮箱/手机验证码),从 wca_users 回填', en: 'Internal accounts: app_users + auth_identities (multi-provider) + auth_codes (email/phone), backfilled from wca_users' } },
  { n: 65, slug: 'recon_official_enum', desc: { zh: 'recons.official 从 0/1 布尔改为三值枚举 wca / non_wca / practice', en: 'Change recons.official from 0/1 boolean to three-value enum wca / non_wca / practice' } },
  { n: 66, slug: 'forum', desc: { zh: '论坛 6 表:分类 / 子版 / 主题 / 帖子 / 反应 / 举报 + 种子分类(6 类 16 版)', en: 'Forum: categories, boards, threads, posts, reactions, reports + seeded taxonomy (6 categories, 16 boards)' } },
  { n: 67, slug: 'forum_import_articles', desc: { zh: '已发布长文并入论坛「教程与指南」版(每篇 → 一主题 + 首帖),/article 前端退役', en: 'Import published articles into the forum tutorials board (one thread + first post each); retire the /article frontend' } },
  { n: 68, slug: 'account_password', desc: { zh: 'app_users 加可选密码(password_hash / password_updated_at,scrypt),支撑邮箱 + 密码登录', en: 'app_users gains an optional password (password_hash / password_updated_at, scrypt) for email + password sign-in' } },
  { n: 69, slug: 'alg_cases_meta', desc: { zh: 'alg_cases 加 meta JSONB:OLLCP 名 / 数字号 / 六套打乱 / 四套最优解 / 镜像·逆·镜像逆编号 / 对称性 / 生成元,供 1LLL 公式库迁移用', en: 'alg_cases gains meta JSONB: OLLCP name, numeric id, six scrambles, four optimal solutions, mirror/inverse/inverse-mirror ids, symmetry, generators — for the 1LLL migration' } },
  { n: 70, slug: 'notifications', desc: { zh: '站内通知:recon 另解 / 评论 / 回复 → 管理员 + 被回复者(未读红点 + Resend 邮件)', en: 'Site notifications: recon alternatives / comments / replies → admins + the person replied to (unread badge + Resend email)' } },
  { n: 71, slug: 'email_notify_pref', desc: { zh: 'app_users 加 email_notify:邮件通知开关(退订),默认开;只关邮件,站内红点照常', en: 'app_users gains email_notify: the email-notification opt-out (default on); mutes email only, in-site badge unaffected' } },
  { n: 72, slug: 'user_lang', desc: { zh: 'app_users 加 lang:通知邮件按收件人语言发;未读角标轮询搭车上报,NULL(没见过这人)回落双语', en: 'app_users gains lang: notification emails follow the recipient’s language; reported by the unread-badge poll, NULL (never seen) falls back to bilingual' } },
  { n: 73, slug: 'page_notices', desc: { zh: '新表 page_notices:每页顶部管理员通知条(维护中/WIP/bug),按路径匹配(精确/前缀 /*),分级 info/warning/维护', en: 'New page_notices table: per-page admin notice bars (maintenance/WIP/bug), matched by path (exact or /* prefix), levels info/warning/maintenance' } },
  { n: 74, slug: 'forum_review', desc: { zh: 'forum_threads / forum_posts 加 status(approved/pending/rejected)+ review_note:新用户前 N 帖先审后发,待审仅作者与管理员可见', en: 'forum_threads / forum_posts gain status (approved/pending/rejected) + review_note: new users’ first N posts are held for review, visible only to the author and admins' } },
  { n: 75, slug: 'contributors', desc: { zh: '新表 contributors:/support 贡献者名单,score = 贡献次数(admin 点数字 +1)', en: 'New contributors table: the /support contributor wall, score = contribution count (admin clicks the number to +1)' } },
  { n: 76, slug: 'alg_case_marks', desc: { zh: '新表 alg_case_marks:公式训练器 per-case 学习标记(学习中/已掌握/搁置 + 星标),登录用户跨设备同步', en: 'New alg_case_marks table: per-case learning marks in the alg trainer (learning/mastered/paused + star), synced across devices for signed-in users' } },
  { n: 77, slug: 'trainer_rooms', desc: { zh: '新表 trainer_rooms:公式训练器协同房间,多设备在线复习分工 —— 房间持有共享 case 队列 + 领取游标,原子出队保证不重不漏、支持乱序', en: 'New trainer_rooms table: online coop rooms for the alg trainer — the room holds a shared case queue + claim cursor, atomic dequeue guarantees no overlap/no gaps and supports shuffled order' } },
  { n: 78, slug: 'one_email_per_account', desc: { zh: 'auth_identities 加偏唯一索引 uq_auth_identity_one_email:一个账号只能绑一个邮箱(原先只有 (provider, provider_uid) 全局唯一,同一账号可绑多个邮箱)。手机仍可多绑,WCA 由 app_users.wca_id 镜像列保证单例', en: 'Partial unique index uq_auth_identity_one_email on auth_identities: one email per account (previously only (provider, provider_uid) was unique globally, so one account could bind several emails). Phone stays multi-bindable; WCA singularity is enforced by the app_users.wca_id mirror column' } },
  { n: 79, slug: 'wiki_bilingual', desc: { zh: 'wiki_terms 加 head_en/head_zh/body_en/body_zh 四列:词条从中英混排单字段升级为结构化双语,网页上分 en/zh 两框编辑,显示为中英对照;原 head/body 保留供搜索/slug/兜底', en: 'wiki_terms gains head_en/head_zh/body_en/body_zh: terms upgrade from a single mixed EN/ZH field to structured bilingual, edited via separate en/zh boxes and shown side-by-side; original head/body kept for search/slug/fallback' } },
  { n: 80, slug: 'wiki_backfill_bilingual', desc: { zh: '把 713 条 seed 词条的中英混排 head/body 自动拆分回填进 0079 的四个新列(首汉字切分,实测零误拆)', en: 'Backfill: auto-split the 713 seed terms’ mixed EN/ZH head/body into the four new columns from 0079 (split at first CJK char, zero mis-splits in testing)' } },
  { n: 81, slug: 'zbll_subgroup_direction_slugs', desc: { zh: 'ZBLL 子组 slug 数字制→方向制(U1→UR 等 40 组,取自子组内 ollcp 前缀方向),URL 从 /zbll/u1 变语义化的 /zbll/ur;旧数字 URL 靠 client 别名表兼容。CASE 幂等,已迁移的行走 ELSE 原样', en: 'ZBLL subgroup slugs go numeric→directional (U1→UR etc., 40 groups, from each subgroup’s ollcp direction prefix), so URLs become semantic (/zbll/u1 → /zbll/ur); old numeric URLs kept working via a client alias table. Idempotent CASE — already-migrated rows fall through ELSE' } },
  { n: 82, slug: 'wso_whole_solve_index', desc: { zh: 'wca_scramble_optimal 加 rnd 随机序列 + (event_id, htm, rnd) 索引:/timer 真题难度筛新增「整体」方法(整解最优 HTM),谓词落 htm 而非 steps[] 槽位,飞镖采样复用同款索引', en: 'wca_scramble_optimal gains a rnd sampling column + (event_id, htm, rnd) index: the /timer difficulty filter adds a whole-solve method (optimal HTM), predicating on htm instead of a steps[] slot and reusing the same dart-sampling index' } },
  { n: 83, slug: 'wca_scrambles_length_index', desc: { zh: 'wca_scrambles 加「打乱招式数」表达式索引(3x3 族 partial):/timer 真题难度筛新增「打乱」方法,按原始打乱长度取题;长度不落列(避免重写全表),查询谓词与索引同形', en: 'wca_scrambles gains an expression index on scramble move count (partial, 3x3 family): the /timer difficulty filter adds a length method drawing scrambles by raw length; length is not materialized as a column (avoids a full table rewrite) — the query predicate mirrors the index expression' } },
  { n: 84, slug: 'contributor_contributions', desc: { zh: 'contributors 加 contributions JSONB 明细列 [{ zh, en, date? }]:/support 贡献者卡片除了贡献次数,还能展开看每次贡献的具体内容;与 score 解耦(明细可空,+1 不必带文字)', en: 'contributors gains a contributions JSONB column [{ zh, en, date? }]: /support contributor cards can expand to show the content of each contribution, not just the count — decoupled from score (details are optional, a +1 need not carry text)' } },
  { n: 85, slug: 'recons_visibility', desc: { zh: 'recons 加 visibility 三态列(public / unlisted / private):YouTube 风格可见性——公开列出 / 不公开列出(仅直链)/ 私享(仅本人),列表过滤 + 详情鉴权在 routes/recon.ts', en: 'recons gains a three-state visibility column (public / unlisted / private): YouTube-style sharing — listed, unlisted (link-only), or private (owner-only); list filtering + detail auth live in routes/recon.ts' } },
  { n: 86, slug: 'battle_rooms', desc: { zh: '新表 battle_rooms:/timer 联机对战房间(多设备,各自设备计时,同一条打乱)—— 房间持有当前轮打乱 + 玩家实时状态(jsonb)+ 每轮成绩 + 累计胜场,1s 轮询 + 单行 jsonb 原子合并,开下一轮 CAS 结算胜者', en: 'New battle_rooms table: /timer online battle rooms (multi-device, everyone times on their own device with the same scramble) — the room holds the current scramble + live player status (jsonb) + per-round results + win tallies; 1s polling with single-row atomic jsonb merges, next-round CAS settles the winner' } },
  { n: 87, slug: 'page_notice_icon', desc: { zh: 'page_notices 增加可选图标键，空值继续按通知级别使用默认图标。', en: 'Add an optional icon key to page_notices while empty values continue to use the level default.' } },
  { n: 87, slug: 'page_notice_icon_color', desc: { zh: 'page_notices 加可选 icon + color 两列(空=按 level 回退):每页顶部通知条不再永远蓝色圆圈 i,预设与图标/色板选择器让每条通知带自己的语义图标与横幅颜色', en: 'page_notices gains optional icon + color columns (empty = fall back to the level defaults): the per-page notice bar is no longer always a blue circle-i — presets plus icon/color pickers let each notice carry its own semantic icon and banner color' } },
  { n: 88, slug: 'battle_rooms_admin', desc: { zh: 'battle_rooms 加 admin / sync_start / start_at 三列:联机对战有了房主(建房者首任,可转让、可踢人,离场自动由最早加入者接任)+ 房设「同时开始计时」——全员点准备后服务端落 start_at,各端按时钟偏移换算到本机同一时刻起表', en: 'battle_rooms gains admin / sync_start / start_at: online battles now have a host (the creator; transferable, can kick, and the earliest joiner takes over if they leave) plus a “synchronized start” room setting — once everyone taps ready the server stamps start_at and every device converts it through its clock offset to start at the same instant' } },
  { n: 89, slug: 'alg_case_srs', desc: { zh: '新表 alg_case_srs + alg_srs_daily:公式记忆(间隔重复)——per-case 到期时刻 / 间隔 / 难度因子 / 遗忘次数 / 最近 12 次评分,外加每日复习量日志(热力图与连续天数)。与手动标记(0076)分表:标记是人的判断,调度是算出来的状态,互不覆盖', en: 'New alg_case_srs + alg_srs_daily tables: spaced repetition for algs — per-case due/interval/ease/lapses/last-12-grades, plus a daily review log (heatmap and streak). Deliberately separate from the manual marks of 0076: marks are the user’s judgement, the schedule is computed state, and neither should clobber the other' } },
  { n: 90, slug: 'alg_3bld_comm', desc: { zh: '3BLD 换位子字典入库:两套 3x3 set(comm-corner 378 + comm-edge 440,共 818 条)从 client 里的静态 JSON 迁进 alg_sets / alg_cases —— 进了库 /alg/3bld/comm 才吃得上 admin 三件套(编辑 / 校验 / 拖拽换序)。顺带修掉上游 4 条打错一个 token 的公式(CG / DC / XF / XQ,原文照录在迁移头注),它们本来会扰动另一个 orbit', en: 'The 3BLD commutator dictionary moves into the DB: two 3x3 sets (comm-corner 378 + comm-edge 440, 818 entries) migrate from static JSON in the client into alg_sets / alg_cases — only in the DB can /alg/3bld/comm get the admin trio (edit / validate / drag-reorder). Also fixes 4 upstream algs with a single mistyped token (CG / DC / XF / XQ, originals recorded in the migration header); each of them disturbed the other orbit' } },
  { n: 91, slug: 'pattern_examples', desc: { zh: '新表 pattern_examples:/scramble/pattern/search 的「示例」按钮从 page.tsx 里的硬编码常量搬进库 —— 管理员在图案编辑器里摆好一个图案就能存成示例,并直接改名 / 删 / 排序,不用再发一次版。存的 q 就是页面 ?q= 那串可分享编码(45 位色类 + 5 个面分配掩码),连 continuous 一起存,因为同一图案开不开「连续」结果集不同;迁移自带原来那 4 个(棋盘 / 六点 / 十字 / 条纹)当种子', en: 'New pattern_examples table: the example buttons on /scramble/pattern/search move out of a hardcoded constant in page.tsx and into the DB — an admin lays out a pattern in the editor, saves it as an example, and can rename / delete / reorder it without shipping a release. The stored q is exactly the shareable ?q= encoding the page already uses (45 class digits + 5 face masks), and continuous rides along because the same pattern yields a different result set with it on; the migration seeds the original four (checkerboard / six spots / crosses / stripes)' } },
  { n: 92, slug: 'alg_case_mirror', desc: { zh: 'alg_cases 加 mirror_case_id:指向「把这个 case 左右镜过去、再把最后一槽转回 FR」得到的那个 case。互指,自镜像指自己。建链判据是状态指纹不是名字 —— 实测 f2l 的 ± 命名与状态判据 38/38 全对,zbls 只有 32/296 对得上。计划脚本 scripts/mirror-link-plan.mts 只算不写', en: 'alg_cases gains mirror_case_id: it points at the case you get by mirroring this one left-right and turning the last slot back to FR. The link is mutual; a self-mirror points at itself. Pairing is decided by state fingerprint, never by name — measured, f2l’s ± naming agrees 38/38 while zbls agrees only 32/296. The planning script scripts/mirror-link-plan.mts computes and writes nothing' } },
  { n: 93, slug: 'drop_paused_mark', desc: { zh: '退役 alg_case_marks 的「搁置」状态:勾选与否本身就是「练不练这个 case」的开关,再来一套搁置只是第二条互相打架的路径。存量只有状态的整行删掉(回到「未学」),带星标的留行清状态,updated_at 推到现在好让老设备本地那份在 LWW 里输掉;CHECK 收窄成 learning/mastered', en: 'Retire the paused status on alg_case_marks: whether a case is selected already decides whether you drill it, and a second, competing switch only fought with it. Existing rows carrying only that status are deleted (back to unseen), starred ones keep the row and lose the status, and updated_at is bumped so a stale device loses the last-write-wins race; the CHECK narrows to learning/mastered' } },
  { n: 94, slug: 'lsll_cases', desc: { zh: '新表 lsll_cases:LSLL 那 148,384 个 case 的整方 HTM 最优解落库,case 页那块「待批量求解管道回填」终于有东西可显示。数据不进 migration —— 本地 solver/lsll 用 cubeopt/h48 跑完,export_cases.mjs 出 CSV,update_lsll.ps1 按 sha1 行清单增量灌。关键是 exhaustive 这一列诚实:h48 的 wasm 吐不出全部最优解(它那个第三参数是「同时解几条」,不是解数上限),所以阶段 1 每个 case 只有一条最优解,qtm 是这一条的 qtm 而不是并列里最小的,前端照实说', en: 'New lsll_cases table: whole-cube HTM-optimal solutions for all 148,384 LSLL cases, so the case page’s “pending the batch pipeline” placeholder finally has something to show. The rows never ride in a migration — the local solver/lsll run (cubeopt/h48) produces them, export_cases.mjs writes a CSV, and update_lsll.ps1 loads only the lines whose sha1 changed. The load-bearing column is exhaustive: the h48 wasm cannot enumerate every optimal solution (its third argument is “how many at once”, not a solution cap), so stage 1 stores one solution per case and qtm is that solution’s, not the minimum across ties — and the page says so' } },
  { n: 95, slug: 'sim_masks', desc: { zh: '新表 sim_masks:/sim 阶段遮罩下拉的管理员覆盖层。清单本体仍是代码资产(引擎的坐标谓词 + visualcube 位串,单一源),表里只存差异 —— 改双语名字、组内顺序、藏起不想露的条目;删掉一行就等于该条恢复代码默认,所以不需要种子数据。另一类行是自建遮罩:管理员在 /sim 点选贴纸,存成一条带名字的遮罩(sids/pick/rest 就是 ?stickeringMask= 那套可分享编码),下拉里单独一组、URL 走 ?stickering=preset:…', en: 'New sim_masks table: an admin override layer over the /sim stage-mask select. The list itself stays a code asset (the engine’s coordinate predicates plus visualcube bit strings — one source), and the table stores only the differences: bilingual labels, order within a group, and which entries to hide. Deleting a row restores that entry’s code default, which is why no seed data is needed. The other kind of row is an admin-built mask: pick stickers in /sim and save them under a name (sids/pick/rest are the same shareable encoding as ?stickeringMask=), shown in its own optgroup and addressed by ?stickering=preset:…' } },
  { n: 96, slug: 'alg_set_progress', desc: { zh: '新表 alg_set_progress:训练器的「过遍」进度,每用户每 set 一行。alg_case_marks 与 alg_case_srs 都是一 case 一行 —— 1LLL 3915 个怎么存都行,LSLL 149,188 个练满就是 29.8 万行、~52 MB 一个人,而两条路由都卡每用户 20,000 条,按每天一轮 302 个算第 66 天就撞墙,撞了还只在 console 里 warn。但「这一轮 302 个我过完了」一整轮只要一个数:记在这里之后,那一轮里没有手动标记的记忆排期就可以折叠掉(POST /v1/alg/sweep/:p/:s/fold),存量掉到几千行。手动标过的永远不折 —— 那是用户自己的判断。folded_at 是多设备收敛的关键:折叠真删行,另一台设备本地还留着那批,不记这个时刻它下次合并就把它们原样传回去', en: 'New alg_set_progress table: the trainer’s sweep progress, one row per user per set. alg_case_marks and alg_case_srs are both one row per case — fine for 1LLL’s 3915, but LSLL’s 149,188 means 298k rows and ~52 MB for a single user, and both routes cap a user at 20,000 rows, so a round-a-day (302 cases) practice plan hits the wall on day 66 — silently, with only a console warning. Yet “I finished this round of 302” needs one number for the whole round: once it lives here, that round’s unmarked schedules can be folded away (POST /v1/alg/sweep/:p/:s/fold), cutting the footprint to a few thousand rows. Anything the user marked by hand is never folded — that is their own judgement. folded_at is what makes multi-device converge: folding really deletes rows, and without that timestamp the other device would just re-upload its stale copies on the next merge' } },
  { n: 97, slug: 'reset_lsll_progress', desc: { zh: '清空 LSLL 的 per-case 进度(alg_case_marks + alg_case_srs 里 3x3/lsll 那批)。训练器从这天起在一条两步路线的 ≤4 个 mid-AUF 变体里挑整方最优最短的那个出题 —— 同一条路线换了 canonical key,旧的标记 / 记忆全指向不再出题的 case,既迁不过去也没意义。本机那半由 client 的一次性重置删,且必须先于任何一次云端合并跑,否则本地那份会在 LWW 里原样飞回来。alg_set_progress 不动:「过遍」按 scope 计数,302 条路线本身一条没变', en: 'Wipe LSLL’s per-case progress (the 3x3/lsll rows in alg_case_marks and alg_case_srs). From this day the trainer drills, out of a two-look route’s ≤4 mid-AUF variants, the one whose whole-cube optimum is shortest — the route is the same but its canonical key is not, so every old mark and schedule points at a case that is no longer served, with nothing to migrate them to. The local half is cleared by a one-time reset in the client, which must run before any cloud merge or that copy would sail straight back up under last-write-wins. alg_set_progress is untouched: sweeps count scopes, and not one of the 302 routes changed' } },
  { n: 98, slug: 'wca_person_results', desc: { zh: '新表 wca_person_results:选手页那一整页数据从此出自本站库,不再由浏览器直连 WCA 官网。原来首屏三个源(资料 / 成绩 / 比赛)都是浏览器直接打官网,官网从国内不通时整页就卡在「加载中…」。为什么不复用已有的 wca_results_flat:那张表是排行榜口径,只写有效成绩、单次与平均拆成两行、且没有轮次名次 —— 而选手页恰好要它扔掉的那部分。实测一位选手官方 736 条成绩里有 7 条是整轮 DNF(3 条盲拧),flat 里一条都没有,连带 15 个尝试槽;名次则关系到里程碑的首金 / 首银和成绩表按名次排序。负值也绝不能塞回 flat:全站排行榜都是按成绩升序取,-1 会排到世界第一。所以另开一张「一条成绩一行」的表,flat 一个字节不动,灌数据复用同一套 per-comp 指纹增量。顺带给 wca_competitions 补 city 与 iso2,「点亮城市」和国旗也就不必再问官网', en: 'New wca_person_results table: the person page now gets its whole dataset from our own database instead of the browser calling the WCA site directly. All three first-paint sources (profile / results / competitions) used to be direct browser calls, so when that site is unreachable the page just sat at “Loading…”. Why not reuse the existing wca_results_flat: that table is built for leaderboards — valid results only, single and average split across two rows, no round position — and the person page needs precisely what it throws away. Measured on one competitor, 7 of 736 official results are whole-round DNFs (3 of them blindfolded), none of which exist in flat, taking 15 attempt slots with them; and position drives the first-gold / first-silver milestones and sorting the results table. Negatives can never go back into flat either: every leaderboard on the site reads results in ascending order, so a -1 would rank first in the world. Hence a separate one-row-per-result table, with flat untouched, loaded through the same per-competition fingerprint delta. wca_competitions also gains city and iso2, so lit-up cities and flags stop needing the upstream site as well' } },
  { n: 99, slug: 'calendar', desc: { zh: '新表 calendars / calendar_events / calendar_shares / calendar_guests / calendar_reminder_log:/calendar 个人日历。事件存的是「主事件 + RRULE」而不是展开后的每一次 —— 一条「每周三」没有终点,落地展开就是无限行,而且改一次规则要回改上万行;「只改这一次」另存一条 series_id 覆盖行,主事件把那一次记进 exdates。时刻用绝对毫秒 + 事件自己的 IANA 时区两列,不用 TIMESTAMPTZ:重复必须按墙上钟点推进(每周三 9:00 换季后仍是本地 9:00),写入时把时区折算掉就再也还原不出这条规则。对外展示是一人一行的 token + 档位,busy 档由服务端 redactBusy 抹掉标题 / 说明 / 地点 / 参与者,不指望前端不渲染。提醒扫描每分钟跑一次,靠 calendar_reminder_log 的主键抢占去重', en: 'New calendars / calendar_events / calendar_shares / calendar_guests / calendar_reminder_log tables for the /calendar personal calendar. Events are stored as “master + RRULE”, never as expanded occurrences — a weekly series has no end, so materialising it means unbounded rows, and one rule edit would have to rewrite thousands of them; “this event only” writes a separate override row via series_id while the master records that occurrence in exdates. Times are absolute milliseconds plus the event’s own IANA zone rather than TIMESTAMPTZ: recurrence advances by wall clock (a Wednesday 9:00 meeting is still local 9:00 after a DST change), and folding the zone away at write time would destroy the rule. Sharing is one token+level row per person, with the busy level redacted server-side (redactBusy strips title, notes, location and guests) instead of trusting the front end to skip them. The reminder sweep runs every minute and dedupes by racing an insert into calendar_reminder_log' } },
  { n: 100, slug: 'quiz_questions', desc: { zh: '新表 quiz_questions / quiz_question_reports:/quiz 允许登录用户自己出题并给答案。上线策略是「直接上线 + 举报」而不是先审后发 —— 一道题只有被答到才谈得上对错,压在审核队列里没人答,反而是举报把真正的错题挑出来最快,所以 status 只有 published / hidden 两态,下架时带理由并通知作者。语言列成对(q_zh/q_en、answer_zh/answer_en……)且允许一侧为空串:强制双语会劝退大半中文用户,而空的一侧在答题页回落到已有那侧并标注「仅中文 / English only」,管理员之后补译。校验不写成 DB 的 CHECK 而是放在 @cuberoot/shared/quiz,与出题表单同一份实现 —— 内置题库那条红线(参考答案自己得能被 accept 判对)社区题一样要过,而错误码要能翻成人话给用户看', en: 'New quiz_questions / quiz_question_reports tables: /quiz now lets signed-in members write their own questions and answers. They go live immediately and are policed by reports rather than pre-moderation — a question is only proved right or wrong by being answered, and one sitting in a queue is answered by nobody, so status has just two states, published and hidden, with a reason attached and the author notified on takedown. Language columns come in pairs (q_zh/q_en, answer_zh/answer_en, …) and either side may be empty: demanding both would turn away most Chinese-speaking contributors, while an empty side falls back to the written one at play time with a “Chinese only / English only” note for an admin to translate later. Validation lives in @cuberoot/shared/quiz rather than in DB CHECKs, shared verbatim with the authoring form — community questions must clear the same red line as the built-in bank (your own reference answer has to be accepted by your own keywords), and the error codes have to be translatable into something a person can read' } },
  { n: 101, slug: 'calendar_imports', desc: { zh: '新表 calendar_imports + calendar_events / calendars 各加一列 import_id:让一次 .ics / .zip 导入可以整批撤销。一次导入跨很多请求(每个日历一批、每批最多 500 条),所以批次先建出来、id 带在后续每个请求上,而不是事后按时间戳猜哪些是一起进来的 —— 猜的话用户在导入前后手建的日程会被误伤。撤销删事件,再删这次导入新建**且此刻仍然空着**的日历:人家后来往里写过东西就该留着,撤销导入不是清空日历。批次行本身不删,只记 undone_at,这样界面能说「这次已撤销」而不是记录凭空消失', en: 'New calendar_imports table plus an import_id column on calendar_events and calendars, so a whole .ics / .zip import can be undone in one go. An import spans many requests (one batch per calendar, up to 500 events each), so the batch is opened first and its id rides along on every later request rather than being inferred from timestamps afterwards — inferring it would sweep up anything the user typed in around the import. Undo deletes the events, then deletes only those calendars the import created **and** that are still empty: if someone has since written into one, it stays, because undoing an import is not emptying a calendar. The batch row itself is kept with undone_at set, so the UI can say “this one was undone” instead of the record vanishing' } },
  { n: 102, slug: 'fix_1lll_meta_assignment', desc: { zh: '数据修正,不动结构:8 张 1LLL case 的 meta 挂错了行。phase0 的 row→case 是状态轨道 join,但有 7 行一条对的公式都没有,只能靠组内消去 + CP 约束 + 多数派投票落位,这 8 张落错 —— 表现为 12 张 case 页顶上的「逆」「镜像」缩略图指错人,外加这 8 张的 OLLCP 名 / 角换 / 最优步数 / 出现概率全是别人的。搬 meta 时 gen 保留原值(它是本 case 首条公式的转动集合,跟着 case 不跟着行),每条打乱按新态重过一遍轨道判据,验不过的直接剔除。改完 Mirror / Inv / IM 三列在状态判据下残差为零,CP 标签在每个(朝向类, 角置换类)里唯一', en: 'Data correction, no schema change: eight 1LLL cases carried another row’s meta. The phase0 row→case mapping is a state-orbit join, but seven rows have no correct algorithm at all, so they could only be placed by within-group elimination, CP constraints and majority vote — and these eight landed wrong. The symptom was twelve case pages whose «inverse» and «mirror» thumbnails pointed at the wrong case, plus OLLCP name, corner permutation, optimal move count and probability all belonging to someone else on these eight. Moving the meta keeps gen at its original value (it describes the case’s first algorithm’s move set, so it follows the case rather than the row), and every scramble is re-checked against the new state, with the ones that fail dropped. Afterwards the Mirror / Inv / IM columns have zero residual under the state predicate and the CP label is unique within each (orientation class, corner-permutation class)' } },
  { n: 103, slug: 'one_phone_per_account', desc: { zh: '偏唯一索引 uq_auth_identity_one_phone:一个账号只能绑一个手机号。0078 给邮箱建过同形状的索引,当时特意留了「手机保持可多绑」—— 现在改口径,因为病症一模一样:账号面板会同时出现「手机 +86… 解绑」和「手机 绑定」两行,看着像重复渲染。索引必须带 WHERE provider = \'phone\',不带就退化成「每人至多一条身份」,邮箱 / WCA / 三方全绑不上。它也是这条规矩唯一的真保证:应用层的先行检查读完再写,并发两次绑定会双双通过,晚到的那条只能由索引在事务里拒掉。配套的出口是原地 UPDATE 的换绑(replaceCredentialIdentity):唯一凭据不许解绑,少了这个口子,只有手机号的账号就永远换不了号', en: 'Partial unique index uq_auth_identity_one_phone: one phone number per account. 0078 built the same shape for email and explicitly left phones multi-bindable — that changes here, because the symptom is identical: the account panel shows both a “Phone +86… Unlink” row and a “Phone Link” row, which reads as a double render. The WHERE provider = \'phone\' clause is not optional; without it the index degrades into “at most one identity per person” and email, WCA and social logins all become unbindable. It is also the only real guarantee behind the rule: the application-level pre-check reads before it writes, so two concurrent binds both pass it and only the index can reject the later one inside its transaction. The matching escape hatch is an in-place UPDATE (replaceCredentialIdentity) — your only login method cannot be unlinked, so without it an account holding just a phone number could never change that number' } },
  { n: 104, slug: 'best_2x2_algs', desc: { zh: '数据迁移:把 Best 2x2 Algs 的 17 张公式表并入二阶公式库。保留 CLL、EG、Ortega PBL 的原名称和用户进度键,新增 LEG-1、TCLL±、LS-1 至 LS-9、TEG2+;斜杠分支全部展开,每条公式经站内二阶状态模型对齐验证,17 条不能解本格的来源分支留在移植记录中而不进入训练器。', en: 'Data migration: merge all 17 Best 2x2 Algs sheets into the 2x2 library. Existing CLL, EG and Ortega PBL names and progress keys stay intact; LEG-1, TCLL±, LS-1 through LS-9 and TEG2+ are added. Slash branches are fully expanded and every formula is aligned and checked with the site’s 2x2 state model; 17 source branches that do not solve their listed case remain in the port log instead of entering the trainer.' } },
  { n: 105, slug: 'recon_ground_truth', desc: { zh: '新表 recon_ground_truth_cases:把复盘测试样本从工作簿迁到管理员管理器。候选范围由服务端固定为颜瑞民发布的标准三阶，只有文字解法与 replay 都完整复原、且人工确认的记录才进入确定性导出；来源快照用于提示复盘后来被编辑。', en: 'New recon_ground_truth_cases table: moves reconstruction regression cases from a workbook into an admin manager. The server fixes the candidate scope to standard 3x3 reconstructions published by Ruimin Yan; only manually confirmed rows whose source text and replay both solve completely enter the deterministic export, while source snapshots flag later edits.' } },
  { n: 106, slug: 'recon_ground_truth_candidates', desc: { zh: '新表 recon_ground_truth_candidate_checks:持久化候选复盘的元数据与真实魔方状态校验。DNF、DNS、Fail、成绩为空、打乱异常、解法缺失或不能完整复原的记录不进候选池；来源改动时自动重算。', en: 'New recon_ground_truth_candidate_checks table: persists metadata and real cube-state validation for candidate reconstructions. DNF, DNS, Fail, missing results, invalid scrambles, missing solutions, and solutions that do not fully solve are excluded; changed sources are recalculated automatically.' } },
  { n: 107, slug: 'sq1_cubingapp_csp', desc: { zh: '数据迁移：用 CubingApp 补齐 SQ1 CS 的 1 个缺失情况、修正 1 条左右重复公式并补 5 条备用公式；新增 CSP 全部 179 个情况、203 条公式。', en: 'Data migration: complete SQ1 CS from CubingApp with its one missing case, correct one duplicated left/right algorithm and add five alternatives; add all 179 CSP cases and 203 algorithms.' } },
  { n: 108, slug: 'sq1_cubingapp_stages', desc: { zh: '数据迁移：补齐 SQ1 CP、EO、EP 的 CubingApp 分类与缺项，保留本站已有情况 ID、名称和备用公式；新增 OBL 全部 185 个情况与 185 条公式。', en: 'Data migration: supplement SQ1 CP, EO and EP with CubingApp taxonomy and missing entries while preserving existing case ids, names and alternative algorithms; add all 185 OBL cases and 185 algorithms.' } },
  { n: 109, slug: 'cubingapp_beginner_ll', desc: { zh: '数据迁移：新增 CubingApp 的 2 步 OLL（9 个情况 / 9 条公式）和 2 步 PLL（6 个情况 / 10 条公式）；逐情况补入 4×4 PLL Parity 缺少的 17 条公式，原有 22 个情况、40 条公式和用户进度不覆盖。', en: 'Data migration: add CubingApp’s 2 Look OLL (9 cases / 9 algorithms) and 2 Look PLL (6 cases / 10 algorithms); merge the 17 missing 4×4 PLL Parity formulas case by case while preserving all 22 existing cases, 40 existing alternatives and user progress.' } },
  { n: 110, slug: 'cubingapp_roux_pyraminx', desc: { zh: '数据迁移：新增 2 步 CMLL（9 / 9）、经状态审计的单手 CMLL（42 / 99）与 LSE EOLR（46 / 48），逐状态补齐本站 CMLL 和 LSE EO；Pyraminx 末层的 5 条上游公式已包含于现有 L3E，并把 L4E 缺少的 12 个情况和 15 条公式并入原集合。', en: 'Data migration: add 2 Look CMLL (9/9), state-audited OH CMLL (42/99), and LSE EOLR (46/48), then merge state-audited CMLL and LSE EO gaps; all five upstream Pyraminx Last Layer formulas already exist in L3E, and 12 missing L4E cases plus 15 formulas are merged into the existing set.' } },
  { n: 111, slug: 'wca_kinch', desc: { zh: '新表 wca_kinch：统计管道按同一份共享公式预计算每位活跃选手的世界 / 大洲 / 国家 Kinch 综合分；逐项明细继续复用现有 PB 与当前纪录表。', en: 'New wca_kinch table: the stats pipeline precomputes every active person’s world, continental and national Kinch totals with the shared formula; per-event detail continues to reuse the existing PB and current-record tables.' } },
  { n: 112, slug: 'recons_unsolved_reason', desc: { zh: 'recons 加 unsolved_reason：服务端执行真实魔方状态校验；完整复原直接提交，未复原必须由提交者说明有意保留不完整复盘的原因。', en: 'recons gains unsolved_reason: the API evaluates the real puzzle end state; solved reconstructions submit normally, while incomplete ones require the submitter to explain why they are intentionally preserved.' } },
  { n: 113, slug: 'recons_completion_status', desc: { zh: 'recons 加 completion_status：全库复盘按项目审计终态，持久化已还原、未还原、记号无效和无法校验四种状态，供列表与详情页标记。', en: 'recons gains completion_status: audit every reconstruction by puzzle and persist solved, unsolved, invalid, or unchecked for list and detail markers.' } },
  { n: 114, slug: 'wca_teachers', desc: { zh: '新表 wca_teachers：每位选手每个项目可有不同老师；有效会员只能登记自己，管理员可指定或替换任意老师。', en: 'New wca_teachers table: each cuber may have a different teacher per event; active members may only register themselves, while admins may assign or replace any teacher.' } },
  { n: 115, slug: 'keep_sexy_in_english', desc: { zh: '数据修正：公式备注与 Wiki 术语中的 sexy 统一保留英文，不再翻译。', en: 'Data correction: keep sexy in English in algorithm notes and Wiki terminology instead of translating it.' } },
  { n: 116, slug: 'psf2l', desc: { zh: '数据迁移：把 PSF2L.docx 的 33 个伪槽情况与公式加入三阶公式库；每条 setup 由公式严格取逆并经三阶状态模型验证。', en: 'Data migration: add all 33 Pseudoslotting cases and algorithms from PSF2L.docx to the 3x3 library; every setup is the exact inverse of its algorithm and is verified with the 3x3 state model.' } },
  { n: 117, slug: 'psf2l_f2l_names', desc: { zh: '数据修正：伪槽情况改用首选解去掉首尾 D 层转动后所对应的 F2L 情况名，例如 PSF2L 01 改为 A+。', en: 'Data correction: name each Pseudoslotting case after the F2L case matched by its primary algorithm with the outer D turns removed, for example PSF2L 01 becomes A+.' } },
  { n: 118, slug: 'update_wrap_up_prompt_for_codex', desc: { zh: '数据修正：收尾审查提示词改用当前的 AGENTS.md、skill、memory 与 hook 交接约定。', en: 'Data correction: update the wrap-up prompt to use the current AGENTS.md, skill, memory, and hook handoff conventions.' } },
  { n: 119, slug: 'fix_zbls_mirror_auf', desc: { zh: '数据修正：为 3 个自镜像 ZBLS 的自动镜像公式补齐目标视角所需的起手 U 层调整。', en: 'Data correction: add the starting U-layer alignment required by three auto-mirrored self-symmetric ZBLS algorithms.' } },
  { n: 120, slug: 'drop_alg_mark_starred', desc: { zh: '退役公式训练器星标：删除纯星标记录，收紧 status 为非空，并移除 starred 列。', en: 'Retire alg-trainer stars: delete star-only rows, require a status, and remove the starred column.' } },
  { n: 121, slug: 'lowcubes_fto_megaminx', desc: { zh: '数据迁移：导入 LowCubes / Raul Low 的 216 个 FTO L3T 情况与 151 个 Megaminx Full PLL 情况，setup 按上游记号规则严格取逆。', en: 'Data migration: import 216 LowCubes / Raul Low FTO L3T cases and 151 Megaminx Full PLL cases, with each setup exactly inverted under the upstream notation rules.' } },
  { n: 122, slug: 'collaborative_documents', desc: { zh: '新增通用实时协作文档与成员权限表，正文以 Yjs 状态持久化。', en: 'Add general real-time collaborative documents and member roles, persisting body content as Yjs state.' } },
  { n: 123, slug: 'collaborative_resource_kinds', desc: { zh: '协作资源增加 document / spreadsheet 类型，在同一权限与 Yjs 实时同步底座上支持在线表格。', en: 'Add document / spreadsheet resource kinds so online spreadsheets share the existing permissions and Yjs real-time foundation.' } },
  { n: 124, slug: 'document_subscriptions', desc: { zh: '为协作文档与表格增加按用户保存的修改订阅、最后查看时间与通知节流。', en: 'Add per-user change subscriptions, last-seen timestamps, and throttled notifications for collaborative documents and spreadsheets.' } },
  { n: 125, slug: 'drop_traffic_analytics', desc: { zh: '退役自建流量统计并删除 pageviews 与 traffic_daily。', en: 'Retire self-hosted traffic analytics and drop pageviews and traffic_daily.' } },
  { n: 126, slug: 'teacher_directory', desc: { zh: '新增魔方老师与培训机构目录,预置颜瑞民老师资料,支持作者自主管理与管理员管理。', en: 'Add the cube teacher and training-school directory, seed Ruimin Yan’s profile, and support owner and admin management.' } },
  { n: 127, slug: 'teaching_advanced_lessons', desc: { zh: '新增 CFOP 后续课程表,预置 48 节三阶和 10 节二阶双语课程,由管理员增删改与排序。', en: 'Add the post-CFOP lesson table, seed 48 bilingual 3×3 lessons and 10 bilingual 2×2 lessons, and provide administrator CRUD and ordering.' } },
  { n: 128, slug: 'teacher_directory_visibility', desc: { zh: '老师与机构资料新增公开开关，作者可隐藏自己的资料；颜瑞民资料先设为仅本人可见。', en: 'Add owner-controlled visibility to teacher and school profiles, initially hiding Ruimin Yan’s entry from the public directory.' } },
  { n: 129, slug: 'alg_chain_orders', desc: { zh: '新增公式集连拧顺序表，登录用户可按公式集和子集跨设备保存自定义顺序。', en: 'Add per-set and per-subset time-attack orders so signed-in users can keep custom orders across devices.' } },
  { n: 130, slug: 'teacher_directory_contacts', desc: { zh: '老师与机构资料增加按平台存储的多种公开联系方式，并保留原有联系方式。', en: 'Add platform-specific public contact methods to teacher and school profiles while preserving existing contact data.' } },
  { n: 131, slug: 'alg_preferred_algs', desc: { zh: '新增公式记忆主公式偏好表，登录用户可跨设备同步每个 case 的主公式。', en: 'Add primary algorithm preferences so signed-in users can sync one primary algorithm per case across devices.' } },
  { n: 132, slug: 'alg_top_layer_no_leading_y', desc: { zh: '修正顶层公式开头的 y 转体，并由数据库阻止标准公式与用户投稿再次写入此类数据。', en: 'Rewrite leading y rotations in last-layer algorithms and prevent canonical or community data from reintroducing them.' } },
  { n: 133, slug: 'teaching_trial_lesson_overrides', desc: { zh: '新增试听课中文覆盖表，管理员可在课程页直接维护标题、目标、时长、拍摄清单与完整口播。', en: 'Add Chinese overrides for trial lessons so administrators can edit titles, goals, durations, shot lists, and full narration directly on the course page.' } },
  { n: 134, slug: 'teaching_trial_english_sync', desc: { zh: '为试听课覆盖表增加英文内容与待同步状态，支持 AI 在中文修改后按需翻译回写。', en: 'Add English content and a stale flag to trial lesson overrides so AI can translate and write back Chinese edits on demand.' } },
  { n: 135, slug: 'alg_3x3_lowercase_wide', desc: { zh: '把三阶公式的 Rw 等宽层记号统一为 r 等小写写法，并在数据库写入时自动规范化。', en: 'Normalize 3×3 wide moves such as Rw to lowercase notation such as r, including automatic normalization on database writes.' } },
  { n: 136, slug: 'alg_f2l_setup_required', desc: { zh: '要求 F2L 与非标 F2L case 保存非空且可解析的打乱，避免缩略图退回不完整的五面投影。', en: 'Require F2L and Advanced F2L cases to store a non-empty, parseable setup so thumbnails never fall back to incomplete five-face projections.' } },
  { n: 137, slug: 'sq1_cs_squanmate_alignment', desc: { zh: '把 SQ1 形状复原的 170 个 case 全量对齐 Squanmate，并迁移受影响的训练状态与公式偏好键。', en: 'Align all 170 SQ1 Cube Shape cases with Squanmate and migrate affected trainer-state and algorithm-preference keys.' } },
  { n: 138, slug: 'recon_generic_scramble', desc: { zh: '复盘增加普通打乱字段，用于既非 WCA 真实打乱也非最优打乱的输入。', en: 'Add a generic reconstruction scramble field for input that is neither a WCA real scramble nor an optimal scramble.' } },
  { n: 139, slug: 'auth_web_session_tickets', desc: { zh: '新增短时单次票据表，让小程序原生登录态安全衔接网站登录态；只保存 SHA-256，并在核销时原子删除。', en: 'Add short-lived single-use tickets to bridge Mini Program and website sessions safely; store only SHA-256 hashes and delete atomically on exchange.' } },
  { n: 140, slug: 'sq1_pbl', desc: { zh: '数据迁移：把 Daniel 的 967 个可执行 SQ1 PBL 情况导入标准公式库，并保留分类、推荐状态与来源助记。', en: 'Data migration: import Daniel’s 967 executable SQ1 PBL cases into the standard algorithm library, preserving categories, recommendation status, and source mnemonics.' } },
  { n: 141, slug: 'teacher_directory_images', desc: { zh: '老师与机构资料支持按顺序保存多张个人、机构与教学照片。', en: 'Let teacher and school profiles keep an ordered set of portrait, organization, and teaching photos.' } },
  { n: 142, slug: 'teaching_foundation', desc: { zh: '新增多租户教学底座：机构成员、学员、监护关系、追加式审计与幂等写入。', en: 'Add the multi-tenant teaching foundation: organization members, students, guardian links, append-only audit, and idempotent writes.' } },
  { n: 143, slug: 'teaching_platform_bridge', desc: { zh: '新增旧教学平台账号桥接与登录断言防重表，并允许账号注销时仅匿名化审计操作者。', en: 'Add the legacy teaching-platform account bridge and assertion replay guard, and allow only actor anonymization during account deletion.' } },
  { n: 144, slug: 'teaching_idempotency_rate_limit_index', desc: { zh: '为教学写入限流增加操作者、操作与创建时间的复合索引；过期清理由既有到期时间索引支持。', en: 'Add a composite actor, operation, and creation-time index for teaching mutation limits; expiry cleanup uses the existing expiration index.' } },
  { n: 145, slug: 'teaching_mutation_rate_limits', desc: { zh: '新增教学写入尝试限流表，使失败和回滚请求也进入原子计数窗口。', en: 'Add durable teaching mutation-attempt windows so rejected and rolled-back writes are still counted atomically.' } },
  { n: 146, slug: 'teaching_student_pagination_index', desc: { zh: '新增机构学员按姓名分页的匹配索引。', en: 'Add an index matching organization-wide student pagination by display name.' } },
  { n: 147, slug: 'teaching_packages_and_sessions', desc: { zh: '新增课包产品、学员课包与只追加课时账本，并以课堂、教师快照、考勤和只追加事件完成履约闭环。', en: 'Add package products, student-package snapshots, and an append-only credit ledger, then close the fulfilment loop with sessions, teacher snapshots, attendance, and append-only events.' } },
  { n: 148, slug: 'fix_teaching_owner_guard', desc: { zh: '修复机构 owner 延迟约束 trigger：按触发表安全读取 NEW/OLD，并锁定机构行以串行校验并发 owner 变更。', en: 'Fix the deferred organization-owner guard by safely branching before reading NEW or OLD and locking organization rows to serialize concurrent owner changes.' } },
  { n: 149, slug: 'teaching_campuses_groups_assignments', desc: { zh: '新增校区、班级、学员班级关系与老师负责范围；以复合租户外键、永久关系锁和有效期约束阻止跨租户引用与并发重叠。', en: 'Add campuses, groups, student memberships, and teacher scopes with composite tenant foreign keys, permanent relation locks, and effective-range guards against cross-tenant references and concurrent overlap.' } },
  { n: 150, slug: 'teaching_training_foundation', desc: { zh: '新增版本化训练模板、发布时任务目标、只追加证据与批改、可信来源每日汇总，以及哈希学员账号绑定邀请底座。', en: 'Add versioned training templates, publish-time assignment targets, append-only evidence and reviews, provenance-aware daily rollups, and hashed student account-binding invitations.' } },
  { n: 151, slug: 'wca_verified_display_names', desc: { zh: '把已绑定 WCA 的账号展示名回填为 WCA 官方姓名，统一实名展示。', en: 'Backfill WCA-linked account display names from verified WCA profiles.' } },
  { n: 152, slug: 'fold_recon_auf', desc: { zh: '把复盘中单独成行的 AUF 转动合并进上一条阶段公式，主解法与另解统一处理。', en: 'Fold standalone AUF moves into the preceding reconstruction stage for both primary and alternative solutions.' } },
  { n: 153, slug: 'oll_docx_import', desc: { zh: '按站长整理的 DOCX 重排 OLL 分类与情况，优先导入 269 条公式，并补齐 ETM、最优步数、打乱关系与状态镜像元数据。', en: 'Reorder OLL categories and cases from the owner-curated DOCX, prepend 269 algorithms, and add ETM, optimal-length, scramble-link, and state-mirror metadata.' } },
  { n: 154, slug: 'teaching_lesson_feedback', desc: { zh: '为已完课课堂增加按学员修订的只追加反馈历史、发布可见性与作者匿名化。', en: 'Add append-only per-student feedback revisions, publication visibility, and author anonymization for completed sessions.' } },
  { n: 155, slug: 'teaching_weekly_reports', desc: { zh: '新增按学员与周修订的教学周报，草稿可重算，发布后冻结聚合、总结、计划与可见性。', en: 'Add revisioned weekly teaching reports with recomputable drafts and immutable published aggregates, summaries, plans, and visibility.' } },
  { n: 156, slug: 'teaching_learner_portal', desc: { zh: '为监护关系增加账号绑定时间与哈希邀请，并建立按学员或监护身份读取已发布周报和课堂反馈的门户契约。', en: 'Add guardian account-link timestamps and hashed invitations, plus portal contracts for learners and guardians to read published weekly reports and lesson feedback.' } },
  { n: 157, slug: 'fix_fto_pair_formation_setups', desc: { zh: '修正 FTO Pair Formation 的阶段 setup，使公式结束于所有三元组已配对的 Top Layer 起始态，而不是整颗还原。', en: 'Correct FTO Pair Formation setups so algorithms finish at the all-triples-paired Top Layer starting state instead of a solved puzzle.' } },
  { n: 158, slug: 'teaching_conversations', desc: { zh: '新增家校沟通会话、连续消息序号、每账号单调已读游标，以及同事务去重的站内提醒。', en: 'Add family communication threads, continuous message sequences, per-account monotonic read cursors, and transactionally deduplicated inbox reminders.' } },
  { n: 159, slug: 'fix_fto_top_layer_setups', desc: { zh: '修正 FTO Top Layer 的阶段 setup，使公式结束于 Last Triangles 起始态，而不是整颗还原。', en: 'Correct FTO Top Layer setups so algorithms finish at the Last Triangles starting state instead of a solved puzzle.' } },
  { n: 160, slug: 'teacher_live_scripts', desc: { zh: '新增老师与培训机构名下的结构化直播话术，并迁移魔方根首次直播完整话术。', en: 'Add structured livestream scripts owned by teacher and school profiles, and migrate the complete first CubeRoot livestream script.' } },
  { n: 161, slug: 'expand_first_live_script', desc: { zh: '依据原直播字幕扩充魔方根首次直播中文整理稿，恢复个人经历、教学案例、直播幕后与未来规划。', en: 'Expand the first CubeRoot livestream script from its transcript, restoring personal history, teaching stories, behind-the-scenes details, and future plans.' } },
  { n: 162, slug: 'recon_video_uploads', desc: { zh: '新增会员复盘视频上传元数据，以归属、格式、大小和创建时间约束服务器文件。', en: 'Add member recon-video upload metadata, constraining server files by owner, format, size, and creation time.' } },
  { n: 163, slug: 'forum_videos', desc: { zh: '新增论坛短视频上传元数据；任意登录账号可上传，发布主题时原子绑定首帖，时长由服务端读取媒体容器并校验。', en: 'Add forum short-video upload metadata; any signed-in account may upload, thread creation atomically attaches it to the first post, and the server validates duration from the media container.' } },
  { n: 164, slug: 'teaching_credit_adjustments', desc: { zh: '强化课时账本：以课包父行串行化所有写入，约束退款来源与等额撤销，并禁止余额降至负数。', en: 'Harden the credit ledger by serializing every write on its package, constraining refund sources and exact reversals, and preventing negative balances.' } },
  { n: 165, slug: 'teaching_leave_makeups', desc: { zh: '新增可审计的请假与补课状态机：批准请假原子同步考勤，补课复用未来考勤且仅在到课完成时扣课，课堂取消会释放待履约补课。', en: 'Add auditable leave and makeup state machines: leave approval atomically synchronizes attendance, makeups reuse future attendance and consume only on attended completion, and session cancellation releases scheduled makeups.' } },
  { n: 166, slug: 'timer_boot_events', desc: { zh: '新增匿名计时器启动统计：按单次打开去重，只保留粗粒度运行环境分桶，并自动清理 90 天前数据。', en: 'Add anonymous timer startup telemetry deduplicated per opening, retaining only coarse runtime buckets and pruning data older than 90 days.' } },
  { n: 167, slug: 'platform_core', desc: { zh: '新增主站 Platform 的目录、学习、交易、内容、讲师、QR、隐私、审计、outbox 与幂等 PostgreSQL 底座；复用统一账号，不恢复旧 SQLite 双写。', en: 'Add the main-site Platform PostgreSQL foundation for catalog, learning, commerce, content, instructors, QR, privacy, audit, outbox, and idempotency on canonical accounts, without restoring legacy SQLite dual-write.' } },
  { n: 168, slug: 'platform_account_deletion', desc: { zh: '以账号删除触发器原子覆盖 Platform 的 48 张直接关联表：删除私有数据、擦除个人资料，并在 12 张只追加版本、账本和审计表中保留不可伪造的墓碑证据。', en: 'Atomically cover all 48 directly linked Platform tables from an account-delete trigger: purge private data, erase personal information, and retain unforgeable tombstoned evidence across 12 append-only revision, ledger, and audit tables.' } },
  { n: 169, slug: 'page_notice_placements', desc: { zh: 'page_notices 增加展示位、目标链接与生效时间窗，使同一路径可同时承载顶部运维通知和首页焦点新闻；并预置 WCA 4-pad 计时公告。', en: 'Add placement, target-link, and active-window fields to page_notices so one path can carry both a top operational notice and homepage featured news; seed the WCA 4-pad timing announcement.' } },
  { n: 170, slug: 'nav_sites_github', desc: { zh: 'nav_sites 增加 GitHub 链接', en: 'Add GitHub links to nav sites' } },
  { n: 171, slug: 'cube_pb', desc: { zh: '新增 CubePB 个人纪录主页、进步历史、公开分享设置与当前纪录排行榜。', en: 'Add CubePB personal-best profiles, improvement history, public sharing settings, and current-record leaderboards.' } },
  { n: 172, slug: 'account_avatars', desc: { zh: '新增账号头像来源契约，支持 Clawd 预设、自有上传与 WCA 官方头像自动刷新。', en: 'Add the account-avatar source contract for Clawd presets, owned uploads, and automatic WCA profile-photo refreshes.' } },
  { n: 173, slug: 'pb_ao10000', desc: { zh: '个人纪录新增 Ao10000 档位，并统一平均成绩的 Mo/Ao 简写。', en: 'Add the Ao10000 personal-best tier and standardize mean/average labels as Mo/Ao.' } },
  { n: 174, slug: 'wca_teacher_named_students', desc: { zh: '新增无 WCA ID 学生名册，老师或管理员可按姓名和授课项目登记，且不伪造 WCA 参赛身份。', en: 'Add teacher rosters for students without WCA IDs, stored by name and taught events without fabricating a WCA competition identity.' } },
  { n: 175, slug: 'friends', desc: { zh: '新增好友申请、双向好友和单向黑名单；拉黑会原子清理双方现有关系。', en: 'Add friend requests, two-way friendships, and directed blocks; blocking atomically clears the pair relationship.' } },
  { n: 176, slug: 'creator_gallery_captions', desc: { zh: '新增颜瑞民个人页图库的双语说明表，由管理员直接在前端维护。', en: 'Add bilingual captions for Ruimin Yan’s profile gallery, maintained by an admin directly in the frontend.' } },
  { n: 177, slug: 'named_student_nationality', desc: { zh: '无 WCA ID 学生名册增加必填国籍，以老师的 WCA 国籍回填已有记录，并阻止同一老师重复添加同名学生。', en: 'Require nationality for named student rosters, backfill existing entries from each teacher’s WCA nationality, and prevent duplicate names within one teacher’s roster.' } },
  { n: 178, slug: 'wca_friend_contacts', desc: { zh: '好友列表可保存尚未注册 CubeRoot 的 WCA 选手，并明确区分私有条目与双向好友关系。', en: 'Allow friend lists to save WCA cubers who have not registered for CubeRoot, while clearly separating private entries from mutual friendships.' } },
  { n: 179, slug: 'mobile_auth_pkce', desc: { zh: '复用短时单次票据表，为 Android/iOS 系统浏览器登录增加用途隔离与 PKCE challenge 绑定。', en: 'Reuse the short-lived ticket table for Android/iOS browser sign-in with purpose isolation and PKCE challenge binding.' } },
  { n: 180, slug: 'membership_auto_renew_plan', desc: { zh: '把尚未上线的连续包月和连续包年登记为独立套餐，默认不公开并复用会员后台的公开开关。', en: 'Register the unreleased monthly and annual auto-renewal offers as separate hidden plans controlled by the membership admin visibility toggles.' } },
  { n: 181, slug: 'enterprise_membership_plans', desc: { zh: '把现有月度和年度套餐标为个人用户，并增加沿用单账号开通流程的企业用户月度和年度套餐。', en: 'Label the existing monthly and annual offers as individual plans, then add enterprise plans using the single-account membership checkout.' } },
  { n: 182, slug: 'membership_plan_perks', desc: { zh: '统一个人套餐权益，并让企业套餐在个人权益基础上增加师生展示、企业介绍页、云端资料存储和课程方案定制。', en: 'Unify individual plan entitlements and add teacher-student presentation, an enterprise profile, cloud content storage, and course customization to enterprise plans.' } },
  { n: 183, slug: 'platform_physical_bundle_codes', desc: { zh: '为实体商品随包课程码增加批量生成、单次兑换、外部订单绑定和售后权益撤销审计。', en: 'Add batch generation, single redemption, external order binding, and audited after-sales entitlement reversal for course codes packed with physical goods.' } },
  { n: 184, slug: 'drive', desc: { zh: '新增 20 GB 共享配额的私人网盘、访问白名单、7 天断点上传会话、回收站与磁盘对象元数据。', en: 'Add a private Drive with a shared 20 GB quota, access list, seven-day resumable uploads, Trash, and disk-object metadata.' } },
  { n: 185, slug: 'wca_self_taught', desc: { zh: 'WCA 选手可按项目明确登记为自学，并与尚未填写老师区分。', en: 'Allow WCA cubers to mark individual events as self-taught, distinct from having no learning source set.' } },
  { n: 186, slug: 'account_basic_profile', desc: { zh: '账号增加私密生日、性别和国籍；WCA 绑定账号的国籍由认证资料同步。', en: 'Add private birth date, gender, and nationality fields, with WCA-linked nationality synced from the verified profile.' } },
];

const DOMAIN_KEYS = ['all', ...DOMAINS.map((d) => d.key)] as const;

export default function SchemaPage() {
  const lang = useLang();

  const [q, setQ] = useQueryState('q', parseAsString.withDefault('').withOptions({ history: 'replace', scroll: false }));
  const [domain, setDomain] = useQueryState(
    'domain',
    parseAsStringEnum([...DOMAIN_KEYS]).withDefault('all').withOptions({ history: 'replace', scroll: false }),
  );
  const [open, setOpen] = useQueryState('t', parseAsString.withDefault('').withOptions({ history: 'replace', scroll: false }));

  const query = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    return TABLES.filter((t) => {
      if (domain !== 'all' && t.domain !== domain) return false;
      if (!query) return true;
      if (t.name.toLowerCase().includes(query)) return true;
      if (t.purpose.zh.toLowerCase().includes(query) || t.purpose.en.toLowerCase().includes(query)) return true;
      if (t.family?.some((f) => f.toLowerCase().includes(query))) return true;
      return false;
    });
  }, [domain, query]);

  const totalTables = TABLES.reduce((s, t) => s + (t.family ? t.family.length : 1), 0);

  const groups = DOMAINS
    .map((d) => ({ d, tables: filtered.filter((t) => t.domain === d.key) }))
    .filter((g) => g.tables.length > 0);

  return (
    <div className="schema-page">
      <div className="schema-bg" />
      <div className="schema-inner">
        <div className="schema-topbar">
          <Link href="/dev" className="schema-back">← /dev</Link>
        </div>

        <header className="schema-hero">
          <div className="schema-hero-eyebrow">PostgreSQL 13 · our own database</div>
          <h1>{tr({ zh: '数据库 Schema', en: 'Database schema' })}</h1>
          <p>{tr({
            zh: 'CubeRoot 自己这套 PostgreSQL 库的全貌。WCA 官方导出是只读的源数据,这里则是站点亲手设计的表:复盘、公式、会员、反馈、流量,以及一堆把 WCA 原始成绩二次加工成排名与统计的派生表。',
            en: 'The full shape of CubeRoot’s own PostgreSQL database. The WCA export is read-only source data; this is the schema the site designed itself — reconstructions, algs, membership, feedback, traffic, plus the derived tables that turn raw WCA results into ranks and stats.',
          })}</p>

          <div className="schema-stats">
            <div>
              <div className="schema-stat-n">{totalTables}</div>
              <div className="schema-stat-l">{tr({ zh: '张表', en: 'tables' })}</div>
            </div>
            <div>
              <div className="schema-stat-n">{MIGRATIONS.length}</div>
              <div className="schema-stat-l">{tr({ zh: '条 migration', en: 'migrations' })}</div>
            </div>
            <div>
              <div className="schema-stat-n">{DOMAINS.length}</div>
              <div className="schema-stat-l">{tr({ zh: '个领域', en: 'domains' })}</div>
            </div>
            <div>
              <div className="schema-stat-n">append-only</div>
              <div className="schema-stat-l">{tr({ zh: '无 down migration', en: 'no down migrations' })}</div>
            </div>
          </div>
        </header>

        <nav className="schema-trilogy" aria-label={tr({ zh: '数据三部曲', en: 'data trilogy' })}>
          <Link href="/dev/wca-export" className="schema-trilogy-node">
            <div className="schema-trilogy-k">source</div>
            <div className="schema-trilogy-t">{tr({ zh: 'WST 数据导出', en: 'WCA export' })}</div>
            <div className="schema-trilogy-d">{tr({ zh: '每日只读快照', en: 'daily read-only dump' })}</div>
          </Link>
          <div className="schema-trilogy-arrow" aria-hidden>→</div>
          <Link href="/dev/wcif" className="schema-trilogy-node">
            <div className="schema-trilogy-k">format</div>
            <div className="schema-trilogy-t">WCIF</div>
            <div className="schema-trilogy-d">{tr({ zh: '比赛交换格式', en: 'comp interchange format' })}</div>
          </Link>
          <div className="schema-trilogy-arrow" aria-hidden>→</div>
          <div className="schema-trilogy-node is-self">
            <div className="schema-trilogy-k">our DB</div>
            <div className="schema-trilogy-t">{tr({ zh: '本页', en: 'this page' })}</div>
            <div className="schema-trilogy-d">{tr({ zh: '站点亲手设计的库', en: 'the schema we designed' })}</div>
          </div>
        </nav>

        <section className="schema-howto">
          <h2>{tr({ zh: 'migration 怎么跑', en: 'How migrations run' })}</h2>
          <div className="schema-howto-grid">
            <div>
              <div className="schema-howto-item-k">apply_migrations.sh</div>
              <div className="schema-howto-item-v">{tr({ zh: 'deploy 时自动跑没跑过的;每个文件 sha256 记进 _schema_migrations 账本,已应用的改了 hash 就 abort。', en: 'Runs the un-applied files on deploy; each file’s sha256 is recorded in a _schema_migrations ledger and a changed hash aborts.' })}</div>
            </div>
            <div>
              <div className="schema-howto-item-k">{tr({ zh: '部署顺序', en: 'deploy order' })}</div>
              <div className="schema-howto-item-v">{tr({ zh: 'CI 先把 migration 同步上服务器并应用,之后才重启进程 —— 不会出现「新代码上线却查不到列」的窗口。', en: 'CI syncs and applies migrations before restarting the process, so there’s never a window where new code queries a column that doesn’t exist yet.' })}</div>
            </div>
            <div>
              <div className="schema-howto-item-k">{tr({ zh: '失败即回滚', en: 'fail = rollback' })}</div>
              <div className="schema-howto-item-v">{tr({ zh: '每个 migration 单独事务 + ON_ERROR_STOP:任一语句出错就整条回滚、后续不跑,不会半灌。', en: 'Each migration is one transaction with ON_ERROR_STOP — any error rolls the whole file back and halts, never half-applied.' })}</div>
            </div>
            <div>
              <div className="schema-howto-item-k">{tr({ zh: '没有 down', en: 'no down' })}</div>
              <div className="schema-howto-item-v">{tr({ zh: '只前进,不写反向脚本。要回滚就写一条新的 DROP migration,或从每日备份恢复。', en: 'Forward-only — no reverse scripts. To roll back, write a new DROP migration or restore from the daily backup.' })}</div>
            </div>
            <div>
              <div className="schema-howto-item-k">schema.pg.sql</div>
              <div className="schema-howto-item-v">{tr({ zh: '人读的「当前 schema 全貌」快照;migrations/ 才是 CI 实际跑的权威,两者靠纪律同步。', en: 'A human-readable snapshot of the current schema; the migrations folder is the authoritative source CI actually runs.' })}</div>
            </div>
            <div>
              <div className="schema-howto-item-k">{tr({ zh: '自然键无 FK', en: 'natural keys, few FKs' })}</div>
              <div className="schema-howto-item-v">{tr({ zh: '很多表用业务自然键(wca_id、comp_id…)而不建外键约束,换取写入简单与跨数据源拼接的灵活。', en: 'Many tables key on business-natural fields (wca_id, comp_id…) without FK constraints, trading enforcement for simpler writes.' })}</div>
            </div>
          </div>
        </section>

        {/* ── table directory ── */}
        <h2 className="schema-section-head">{tr({ zh: '表目录', en: 'Table directory' })}</h2>

        <div className="schema-controls">
          <SearchInput
            className="schema-search"
            inputClassName="schema-search-input"
            value={q}
            onChange={(v) => setQ(v || null)}
            placeholder={tr({ zh: '搜表名 / 用途…', en: 'search tables…' })}
            ariaLabel={tr({ zh: '搜索表', en: 'search tables' })}
            spellCheck={false}
            autoComplete="off"
          />
          <div className="schema-domains" role="tablist">
            <button
              type="button"
              className={`schema-domain-pill${domain === 'all' ? ' is-active' : ''}`}
              onClick={() => setDomain(null)}
            >
              {tr({ zh: '全部', en: 'All' })}
            </button>
            {DOMAINS.map((d) => (
              <button
                key={d.key}
                type="button"
                className={`schema-domain-pill${domain === d.key ? ' is-active' : ''}`}
                style={{ ['--dot' as string]: d.dot }}
                onClick={() => setDomain(domain === d.key ? null : d.key)}
              >
                <span className="dot" aria-hidden />
                {d.name[lang]}
              </button>
            ))}
          </div>
        </div>

        {groups.length === 0 && (
          <p className="schema-empty">{tr({ zh: '没有匹配的表。', en: 'No matching tables.' })}</p>
        )}

        {groups.map(({ d, tables }) => (
          <div key={d.key} className="schema-domain-group">
            <div className="schema-domain-group-head" style={{ ['--dot' as string]: d.dot }}>
              <span className="bar" aria-hidden />
              <h3>{d.name[lang]}</h3>
              <span className="sub">{d.sub[lang]}</span>
              <span className="count">{tables.reduce((s, t) => s + (t.family ? t.family.length : 1), 0)}</span>
            </div>
            {tables.map((t) => {
              const isOpen = open === t.name;
              return (
                <div key={t.name} className="schema-table-row">
                  <button
                    type="button"
                    className="schema-table-btn"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : t.name)}
                  >
                    <span className="schema-table-name">{t.name}</span>
                    <span className="schema-table-purpose">{t.purpose[lang]}</span>
                    <span className="schema-table-tags">
                      {t.family && <span className="schema-tag family">{t.family.length} {tr({ zh: '张', en: 'tbls' })}</span>}
                      {t.naturalKey && <span className="schema-tag natural">{tr({ zh: '自然键', en: 'nat-key' })}</span>}
                      <span className="schema-tag origin">{t.origin === 'snapshot' ? tr({ zh: '快照', en: 'snapshot' }) : t.origin}</span>
                    </span>
                    <span className="schema-chevron" aria-hidden>›</span>
                  </button>
                  {isOpen && (
                    <div className="schema-detail">
                      {t.cols && (
                        <div className="schema-cols">
                          {t.cols.map((c, i) => (
                            <Fragment key={i}>
                              <div className="schema-col-name">{c.name}</div>
                              <div className="schema-col-note">{c.note ? c.note[lang] : ''}</div>
                            </Fragment>
                          ))}
                        </div>
                      )}
                      {t.family && (
                        <div className="schema-family-list">
                          {t.family.map((f) => <span key={f}>{f}</span>)}
                        </div>
                      )}
                      <div className="schema-detail-meta">
                        {t.origin !== 'snapshot'
                          ? <>{tr({ zh: '由 migration ', en: 'Created by migration ' })}<code>{t.origin}</code>{tr({ zh: ' 创建', en: '' })}</>
                          : <>{tr({ zh: '定义在 ', en: 'Defined in ' })}<code>schema.pg.sql</code></>}
                        {t.evolved && t.evolved.length > 0 && (
                          <>
                            {tr({ zh: ';后续 ', en: '; later evolved by ' })}
                            {t.evolved.map((e, i) => (
                              <Fragment key={e}>
                                {i > 0 && ' '}
                                <code>{String(e).padStart(4, '0')}</code>
                              </Fragment>
                            ))}
                            {tr({ zh: ' 演进', en: '' })}
                          </>
                        )}
                        {t.naturalKey && tr({ zh: ' · 业务自然键,无外键约束。', en: ' · keyed on business-natural fields, no FK.' })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* ── migration ledger ── */}
        <section className="schema-ledger">
          <h2 className="schema-section-head">{tr({ zh: 'Migration 账本', en: 'Migration ledger' })}</h2>
          <p className="schema-ledger-intro">{tr({
            zh: '从第一张导航表到最新的难度索引,schema 是一条 append-only 的演进链 —— 每一步都是一条不可改的 migration,部署时按编号顺序补齐。',
            en: 'From the first nav table to the latest difficulty index, the schema is an append-only chain — each step an immutable migration applied in order on deploy.',
          })}</p>
          <ol className="schema-mig-list">
            {MIGRATIONS.map((m) => {
              const latest = m.n === MIGRATIONS[MIGRATIONS.length - 1]?.n;
              return (
                <li key={m.n} className={`schema-mig${latest ? ' is-latest' : ''}`}>
                  <span className="schema-mig-num">{String(m.n).padStart(4, '0')}</span>
                  <span className="schema-mig-slug">{m.slug}</span>
                  <span className="schema-mig-desc">
                    {m.desc[lang]}
                    {latest && <span className="schema-mig-latest-badge">{tr({ zh: '最新', en: 'latest' })}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}
