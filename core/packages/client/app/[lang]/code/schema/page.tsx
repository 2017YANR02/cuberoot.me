'use client';

import { Fragment, useMemo } from 'react';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import Link from '@/components/AppLink';
import { SearchInput } from '@/components/SearchInput';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
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
  | 'comp' | 'studio' | 'commerce' | 'community' | 'analytics';

const DOMAINS: { key: DomainKey; dot: string; name: Bi; sub: Bi }[] = [
  { key: 'mirror', dot: '#5BA8FF', name: { zh: 'WCA 镜像', en: 'WCA mirror' }, sub: { zh: '每日开发者导出离线重建', en: 'rebuilt offline from the daily export' } },
  { key: 'derived', dot: '#7BD389', name: { zh: 'WCA 派生统计', en: 'WCA derived' }, sub: { zh: '排名 / 名次和 / 趣味统计', en: 'ranks, sum-of-ranks, fun-stats' } },
  { key: 'scramble', dot: '#F0A04B', name: { zh: '打乱', en: 'Scramble' }, sub: { zh: '真题语料 / 最优解 / 难度', en: 'corpus, optimal, difficulty' } },
  { key: 'recon', dot: '#E879A6', name: { zh: '复盘 & 成绩变更', en: 'Recon & changes' }, sub: { zh: '还原 / 变更链 / 直播成绩', en: 'reconstructions & change log' } },
  { key: 'alg', dot: '#D97757', name: { zh: '公式库', en: 'Algorithms' }, sub: { zh: 'alg_sets / alg_cases 公式', en: 'alg sets & cases' } },
  { key: 'comp', dot: '#4A90D9', name: { zh: '比赛 & 缓存 & 状态机', en: 'Comp & caches' }, sub: { zh: '关注 / 直播缓存 / dump 增量', en: 'follows, live cache, dump state' } },
  { key: 'studio', dot: '#67C18E', name: { zh: '用户产物', en: 'User artifacts' }, sub: { zh: '计时 / 训练 / 绘图', en: 'timer, trainer, paint' } },
  { key: 'commerce', dot: '#A78BFA', name: { zh: '会员 & 赞助 & 反馈', en: 'Commerce & feedback' }, sub: { zh: '订阅 / 致谢 / 反馈', en: 'membership, sponsors, feedback' } },
  { key: 'community', dot: '#4FC3DC', name: { zh: '社区内容 & 站务', en: 'Community & ops' }, sub: { zh: '长文 / wiki / 导航 / runbook', en: 'articles, wiki, nav, runbook' } },
  { key: 'analytics', dot: '#E0B341', name: { zh: '流量', en: 'Analytics' }, sub: { zh: '自建,无第三方追踪', en: 'self-hosted, no 3rd-party' } },
];

const TABLES: Table[] = [
  // ── WCA mirror ──────────────────────────────────────────
  { name: 'wca_results_flat', domain: 'mirror', origin: '0042', evolved: [7, 42], purpose: { zh: '扁平化的全量成绩(每把一行),站内绝大多数 WCA 查询的主表', en: 'Flattened all-time results (one row per solve) — the main WCA query table' } },
  { name: 'wca_persons', domain: 'mirror', origin: 'snapshot', evolved: [52], purpose: { zh: '全部 WCA 选手(~25 万行小表)', en: 'Every WCA person (~250k-row lookup)' } },
  { name: 'wca_competitions', domain: 'mirror', origin: 'snapshot', purpose: { zh: '全部比赛元数据:名字 / 日期 / 地点 / 项目', en: 'All competition metadata: name, dates, place, events' } },
  { name: 'wca_countries', domain: 'mirror', origin: 'snapshot', purpose: { zh: '国家 / 地区码表', en: 'Country / region lookup' } },
  { name: 'wca_continents', domain: 'mirror', origin: 'snapshot', purpose: { zh: '洲际码表', en: 'Continent lookup' } },
  { name: 'wca_results_cache', domain: 'mirror', origin: 'snapshot', purpose: { zh: '选手页成绩读穿缓存', en: 'Per-person results read-through cache' } },
  { name: 'wca_scrambles_cache', domain: 'mirror', origin: 'snapshot', purpose: { zh: '打乱查询缓存', en: 'Scramble query cache' } },
  { name: 'cubing_attempts_cache', domain: 'mirror', origin: 'snapshot', purpose: { zh: 'cubing.com 成绩抓取缓存', en: 'Cached cubing.com attempts' } },

  // ── WCA derived ─────────────────────────────────────────
  { name: 'wca_person_ranks', domain: 'derived', origin: 'snapshot', evolved: [13, 38, 39, 40], purpose: { zh: '每选手每项的世界 / 国家 / 洲际排名,名次和的基础', en: 'Per-person world/country/continent ranks; basis for sum-of-ranks' } },
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
  { name: 'wca_scramble_steps', domain: 'scramble', origin: '0057', evolved: [61], purpose: { zh: '逐方法 / 阶段 / 底色的最优步数宽数组 + 热列,支撑按难度抽真题', en: 'Per-method/stage optimal step counts as a wide array + hot columns' }, cols: [
    { name: 'competition_id, event_id, round_type_id, group_id' }, { name: 'steps SMALLINT[]', note: { zh: '逐阶段最优步数宽数组', en: 'wide array of per-step optima' } }, { name: 'gm_cross6', note: { zh: '六色十字最优(热路径飞镖列)', en: 'std cross optimum (hot dart column)' } }, { name: 'gm_xcross6', note: { zh: '六色 xcross 最优(热列)', en: 'std xcross optimum (hot column)' } },
  ] },
  { name: 'wca_scramble_steps_meta', domain: 'scramble', origin: '0057', purpose: { zh: '步数槽位 layout 元表(单行,给 server 映射数组下标)', en: 'Single-row steps-layout meta mapping array slots' } },
  { name: 'scramble_marks', domain: 'scramble', origin: '0041', naturalKey: true, purpose: { zh: '计时器打乱公开标记 + feed', en: 'Public scramble marks + feed' }, cols: [
    { name: 'wca_id, name, country' }, { name: 'competition_id, event_id, round_type_id', note: { zh: '六元自然键,无 FK', en: 'six-part natural key, no FK' } },
  ] },

  // ── recon & result changes ──────────────────────────────
  { name: 'recons', domain: 'recon', origin: 'snapshot', evolved: [5, 29, 32], purpose: { zh: '复盘库:打乱 + 解法 + 视频 + 署名', en: 'Solve reconstructions: scramble + solution + video + credit' }, cols: [
    { name: 'id, official, event, method, date' }, { name: 'comp, comp_wca_id, country, city, round' }, { name: 'person, person_id, co_persons', note: { zh: '合作还原署名', en: 'co-solver credit' } }, { name: 'raw_time' },
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
  { name: 'alg_cases', domain: 'alg', origin: 'snapshot', purpose: { zh: '单条公式 case,position 定序(不加名字 UNIQUE,会重名)', en: 'Individual alg cases; ordered by position (no name UNIQUE)' }, cols: [
    { name: 'id (PK)' }, { name: 'puzzle, set_slug' }, { name: 'position', note: { zh: '从 JSON 数组下标导入定序', en: 'order from the source array' } }, { name: 'name, number' },
  ] },
  { name: 'alg_submissions', domain: 'alg', origin: 'snapshot', purpose: { zh: '用户公式投稿', en: 'User-submitted algorithms' } },
  { name: 'alg_submission_reads', domain: 'alg', origin: '0059', purpose: { zh: '投稿已读状态(admin 通知红点)', en: 'Per-admin read state for submissions (notification badge)' } },

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

  // ── user artifacts ──────────────────────────────────────
  { name: 'timer_backups', domain: 'studio', origin: '0020', purpose: { zh: '计时器成绩云备份(单快照覆盖)', en: 'Cloud backup of timer sessions (single overwrite snapshot)' }, cols: [
    { name: 'wca_id (PK)' }, { name: 'blob', note: { zh: '导出的 JSON', en: 'exported JSON' } }, { name: 'byte_size, solve_count, updated_at' },
  ] },
  { name: 'timer_sessions', domain: 'studio', origin: 'snapshot', purpose: { zh: '计时器分组 / 分段', en: 'Timer sessions / groups' } },
  { name: 'train_results', domain: 'studio', origin: 'snapshot', purpose: { zh: '公式计时训练成绩', en: 'Trainer (timed-alg) results' } },
  { name: 'paint_drawings', domain: 'studio', origin: '0055', purpose: { zh: '/paint 矢量画作云存(doc + 缩略图)', en: 'Cloud-stored /paint vector drawings' }, cols: [
    { name: 'wca_id, title' }, { name: 'doc', note: { zh: '扁平文档 JSON', en: 'flat document JSON' } }, { name: 'thumbnail, byte_size' },
  ] },

  // ── commerce & feedback ─────────────────────────────────
  { name: 'membership_plans', domain: 'commerce', origin: '0046', purpose: { zh: '会员套餐:月 / 年 / 永久 + perks', en: 'Membership plans: monthly / yearly / lifetime + perks' }, cols: [
    { name: 'slug (PK)', note: { zh: 'monthly | yearly | lifetime', en: 'monthly | yearly | lifetime' } }, { name: 'period, currency' }, { name: 'perks JSONB' },
  ] },
  { name: 'membership_orders', domain: 'commerce', origin: '0046', purpose: { zh: '会员订单(我方单号 + provider / channel)', en: 'Membership orders (out_trade_no + provider/channel)' } },
  { name: 'memberships', domain: 'commerce', origin: '0046', purpose: { zh: '会员有效期', en: 'Active membership validity' } },
  { name: 'sponsors', domain: 'commerce', origin: '0043', purpose: { zh: '/support 致谢 / 赞助墙(admin 手录)', en: 'Sponsor / support wall (admin-entered)' } },
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
  { name: 'nav_sites', domain: 'community', origin: '0001', evolved: [2], purpose: { zh: '/site 网址导航(group_id 避 SQL 关键字)', en: 'The /site link directory' } },
  { name: 'ops_commands', domain: 'community', origin: '0010', evolved: [11], purpose: { zh: '/code/ops runbook 命令 + 提示词模板', en: 'Commands + prompts behind the /code/ops runbook' } },

  // ── analytics ───────────────────────────────────────────
  { name: 'pageviews', domain: 'analytics', origin: '0008', purpose: { zh: 'PV 明细:按日轮换的访客 hash,无 cookie', en: 'Pageview events with a daily-rotating visitor hash, no cookie' }, cols: [
    { name: 'ts, path' }, { name: 'visitor_id BYTEA', note: { zh: '16 字节按日轮换 hash', en: '16-byte daily-rotating hash' } }, { name: 'ref_domain', note: { zh: '归一到 eTLD+1', en: 'normalised to eTLD+1' } }, { name: 'country, ua_class, dwell_ms' },
  ] },
  { name: 'traffic_daily', domain: 'analytics', origin: '0008', purpose: { zh: '日聚合:路径 / 来源 / 国家', en: 'Daily rollup by path / referrer / country' } },
];

const MIGRATIONS: { n: number; slug: string; desc: Bi }[] = [
  { n: 1, slug: 'nav_sites', desc: { zh: '/site 导航站表初建', en: 'Create nav_sites for the /site directory' } },
  { n: 2, slug: 'seed_nav_sites', desc: { zh: '从旧静态数组一次性导入导航数据', en: 'One-off seed of nav sites' } },
  { n: 3, slug: 'add_note_to_colpi_words', desc: { zh: 'colpi_words 加 note 列', en: 'Add note column to colpi_words' } },
  { n: 4, slug: 'backfill_colpi_notes', desc: { zh: '括号内容搬进 note,word 去括号', en: 'Move parenthesised text into note' } },
  { n: 5, slug: 'normalize_recon_solution_slashes', desc: { zh: '规范化 recons.solution 里 // 注释空格', en: 'Normalise // comment spacing in solutions' } },
  { n: 6, slug: 'historical_ranks_pb_context', desc: { zh: 'persons 排名补 PB 来源比赛 / 日期 / 五把 6 列', en: 'Add PB-context columns to persons ranks' } },
  { n: 7, slug: 'wrt_prior_pr_index', desc: { zh: '赛前 PR 查询专用索引,58s→105ms', en: 'Pre-comp PR lookup index, 58s→105ms' } },
  { n: 8, slug: 'traffic_analytics', desc: { zh: '自建流量:pageviews + traffic_daily', en: 'Self-hosted analytics tables' } },
  { n: 9, slug: 'wiki', desc: { zh: '/wiki 术语表 + 增补(713 条 seed)', en: 'Glossary wiki, 713 seeded terms' } },
  { n: 10, slug: 'ops_commands', desc: { zh: '/code/ops runbook 命令表', en: 'Table behind the ops runbook' } },
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
  { n: 62, slug: 'wca_persons_gender', desc: { zh: 'wca_persons 加 gender 列,支撑 /wca 排名页性别筛选', en: 'Add gender column to wca_persons for the rankings gender filter' } },
  { n: 63, slug: 'recons_dup_reason', desc: { zh: 'recons 加 dup_reason 列,支撑同选手+同打乱有理由重复提交', en: 'Add dup_reason column to recons for intentional duplicate submissions' } },
];

const DOMAIN_KEYS = ['all', ...DOMAINS.map((d) => d.key)] as const;

export default function SchemaPage() {
  const lang = useLang();
  useDocumentTitle('数据库 Schema', 'Database schema');

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
          <Link href="/code" className="schema-back">← /code</Link>
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
          <Link href="/code/wca-export" className="schema-trilogy-node">
            <div className="schema-trilogy-k">source</div>
            <div className="schema-trilogy-t">{tr({ zh: 'WST 数据导出', en: 'WCA export' })}</div>
            <div className="schema-trilogy-d">{tr({ zh: '每日只读快照', en: 'daily read-only dump' })}</div>
          </Link>
          <div className="schema-trilogy-arrow" aria-hidden>→</div>
          <Link href="/code/wcif" className="schema-trilogy-node">
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
              const latest = m.n === MIGRATIONS.length;
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
