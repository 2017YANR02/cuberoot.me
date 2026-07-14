'use client';

import { useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { SearchInput } from '@/components/SearchInput';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import './api.css';

const ACCENT = '#22D3EE';
const BASE = 'api.cuberoot.me';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Gate = 'public' | 'login' | 'admin' | 'webhook';
type Cache = 'cdn' | 'no-store';

interface Ep {
  d: string;       // domain key
  m: Method;
  p: string;       // full path incl. /v1
  g: Gate;
  c?: Cache;
  zh: string;
  en: string;
}

// 域分组(渲染顺序 + 双语标签)。
const DOMAINS: { key: string; zh: string; en: string }[] = [
  { key: 'auth', zh: '登录与身份', en: 'Auth & identity' },
  { key: 'wca-stats', zh: 'WCA 统计', en: 'WCA stats' },
  { key: 'wca-fun', zh: 'WCA 趣味榜', en: 'WCA fun stats' },
  { key: 'wca-data', zh: 'WCA 数据与监控', en: 'WCA data & watch' },
  { key: 'scramble', zh: '打乱与求解', en: 'Scramble & solve' },
  { key: 'recon', zh: '复盘', en: 'Recon' },
  { key: 'comp', zh: '比赛', en: 'Competitions' },
  { key: 'nemesizer', zh: '宿敌分析', en: 'Nemesizer' },
  { key: 'live', zh: '实时成绩', en: 'Live results' },
  { key: 'alg', zh: '公式库与训练', en: 'Algs & training' },
  { key: 'membership', zh: '会员', en: 'Membership' },
  { key: 'feedback', zh: '反馈', en: 'Feedback' },
  { key: 'notification', zh: '通知', en: 'Notifications' },
  { key: 'forum', zh: '论坛', en: 'Forum' },
  { key: 'content', zh: '内容与运维', en: 'Content & ops' },
  { key: 'timer', zh: '计时器', en: 'Timer' },
  { key: 'analytics', zh: '访问统计', en: 'Analytics' },
  { key: 'system', zh: '系统与渲染', en: 'System & render' },
];

// 全部对外端点,前缀 /v1。method / path 据 packages/server/src/routes/* 真实定义抽取;
// 鉴权门据 requireAuth / requireAdmin(X-Admin-Key)/ 支付回调签名判定。
// ─ covers-routes-start ─ DRIFT-GUARD: route files documented by this catalog.
//   tests/code-schema-api-drift.test.ts asserts (tokens here ∩ on-disk route files)
//   equals the set mounted via app.route('/v1', …) in packages/server/src/index.ts.
//   CI red here = a newly-mounted route is undocumented: add its endpoints below,
//   then add the file stem to this list.
//   account_auth alg alg_sets analytics announced_comps article auth cn_comp_names colpi
//   comp_follows cube cubeopt_solve cubing_live feedback forum health historical_ranks
//   membership nav_sites nemesizer notifications ops paint progress recon scramble_555
//   scramble_marks sponsors timer_backups wca_format wca_fun_stats wca_proxy
//   wca_recent_records wca_result_watch wca_schedule wca_scrambles wca_stats_extra wiki
// ─ covers-routes-end ─
const ENDPOINTS: Ep[] = [
  // ---- auth ----
  { d: 'auth', m: 'GET', p: '/v1/auth/login', g: 'public', zh: '跳转 WCA OAuth 授权页', en: 'Redirect to WCA OAuth' },
  { d: 'auth', m: 'GET', p: '/v1/auth/callback', g: 'public', zh: 'OAuth 回调,建立登录态', en: 'OAuth callback, establish session' },
  { d: 'auth', m: 'POST', p: '/v1/auth/exchange', g: 'public', zh: '用授权码换取 JWT', en: 'Exchange auth code for JWT' },
  { d: 'auth', m: 'POST', p: '/v1/auth/refresh', g: 'login', zh: '刷新 JWT', en: 'Refresh JWT' },
  { d: 'auth', m: 'GET', p: '/v1/auth/me', g: 'login', zh: '当前登录用户信息', en: 'Current signed-in user' },

  // ---- account (邮箱 / 手机验证码登录 + 多身份绑定) ----
  { d: 'auth', m: 'GET', p: '/v1/auth/providers', g: 'public', zh: '已配置的登录方式(前端隐藏未开放 tab)', en: 'Configured login methods (client hides unavailable tabs)' },
  { d: 'auth', m: 'POST', p: '/v1/auth/email/send', g: 'public', zh: '发邮箱验证码(登录/注册)', en: 'Send email login code' },
  { d: 'auth', m: 'POST', p: '/v1/auth/email/verify', g: 'public', zh: '校验邮箱验证码,签发 JWT', en: 'Verify email code, issue JWT' },
  { d: 'auth', m: 'POST', p: '/v1/auth/email/password', g: 'public', zh: '邮箱 + 密码登录,签发 JWT', en: 'Sign in with email + password, issue JWT' },
  { d: 'auth', m: 'POST', p: '/v1/auth/phone/send', g: 'public', zh: '发手机验证码(仅 +86)', en: 'Send phone login code (+86 only)' },
  { d: 'auth', m: 'POST', p: '/v1/auth/phone/verify', g: 'public', zh: '校验手机验证码,签发 JWT', en: 'Verify phone code, issue JWT' },
  { d: 'auth', m: 'POST', p: '/v1/auth/link/email/send', g: 'login', zh: '给当前账号发绑定邮箱验证码', en: 'Send code to link an email' },
  { d: 'auth', m: 'POST', p: '/v1/auth/link/email/verify', g: 'login', zh: '绑定邮箱到当前账号', en: 'Link email to current account' },
  { d: 'auth', m: 'POST', p: '/v1/auth/link/phone/send', g: 'login', zh: '给当前账号发绑定手机验证码', en: 'Send code to link a phone' },
  { d: 'auth', m: 'POST', p: '/v1/auth/link/phone/verify', g: 'login', zh: '绑定手机到当前账号', en: 'Link phone to current account' },
  { d: 'auth', m: 'POST', p: '/v1/auth/link/wca', g: 'login', zh: '用 WCA token 绑定 WCA 身份', en: 'Link WCA identity via access token' },
  { d: 'auth', m: 'POST', p: '/v1/auth/google', g: 'public', zh: '用墙外中继签发的 Google 断言登录/注册', en: 'Sign in/up via relay-signed Google assertion' },
  { d: 'auth', m: 'POST', p: '/v1/auth/link/google', g: 'login', zh: '用墙外中继签发的 Google 断言绑定当前账号', en: 'Link Google identity via relay-signed assertion' },
  { d: 'auth', m: 'POST', p: '/v1/auth/unlink', g: 'login', zh: '解绑一个登录方式(拒绝最后一个)', en: 'Unlink a login method (not the last)' },
  { d: 'auth', m: 'POST', p: '/v1/auth/password/set', g: 'login', zh: '设置 / 修改密码(改密先验旧密)', en: 'Set / change password (change verifies the old one)' },
  { d: 'auth', m: 'GET', p: '/v1/auth/identities', g: 'login', zh: '当前账号已绑定的身份列表 + 是否已设密码', en: 'Linked identities of current account + whether a password is set' },

  // ---- wca-stats ----
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/grand-slam', g: 'public', c: 'cdn', zh: '大满贯榜', en: 'Grand-slam leaderboard' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/all-results', g: 'public', c: 'cdn', zh: '全成绩查询(姓名口径 / 项目筛选)', en: 'All-results query (name form / event filter)' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/persons-directory', g: 'public', c: 'cdn', zh: '选手名录', en: 'Persons directory' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/person-aka', g: 'public', zh: '曾用名 / 曾属国', en: 'Former names / nationalities' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/person-misc', g: 'public', zh: '选手杂项(魔友 / 省份)', en: 'Person misc (peers / provinces)' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/person-championship-podiums', g: 'public', zh: '冠军赛领奖台', en: 'Championship podiums' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/rank-for', g: 'public', zh: '某成绩在当下的名次', en: 'Live rank for a result' },
  { d: 'wca-stats', m: 'POST', p: '/v1/wca/rank-for-batch', g: 'public', zh: '批量算名次', en: 'Batch rank-for' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/cohort-ranks', g: 'public', zh: '同期选手名次', en: 'Cohort ranks' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/success-rate', g: 'public', zh: '成功率统计', en: 'Success rate' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/all-events-done', g: 'public', zh: '全项目完成者', en: 'All-events finishers' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/sum-of-ranks', g: 'public', c: 'cdn', zh: '名次和总表', en: 'Sum-of-ranks table' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/sum-of-ranks/census', g: 'public', zh: '名次和普查', en: 'Sum-of-ranks census' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/sum-of-ranks/player-best', g: 'public', zh: '选手最佳名次和', en: 'Player best SoR' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/sum-of-ranks/player-combos', g: 'public', zh: '项目组合名次和', en: 'Player event combos' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/sum-of-ranks/person-subset', g: 'public', zh: '子集名次和', en: 'Person-subset SoR' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/sum-of-ranks/person', g: 'public', zh: '个人名次和分解', en: 'Per-person SoR breakdown' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/person-best-ranks', g: 'public', zh: '个人各项最佳名次', en: 'Person best ranks' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/person-rank-history', g: 'public', zh: '名次历史曲线', en: 'Rank history' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/person-live-results', g: 'public', zh: '官方收录前的直播成绩', en: 'Pre-official live results' },

  // ---- wca-fun ----
  { d: 'wca-fun', m: 'GET', p: '/v1/wca/fun/country-sor', g: 'public', c: 'cdn', zh: '国家名次和', en: 'Country sum-of-ranks' },
  { d: 'wca-fun', m: 'GET', p: '/v1/wca/fun/medals', g: 'public', c: 'cdn', zh: '奖牌榜', en: 'Medals' },
  { d: 'wca-fun', m: 'GET', p: '/v1/wca/fun/placements', g: 'public', c: 'cdn', zh: '名次分布', en: 'Placements' },
  { d: 'wca-fun', m: 'GET', p: '/v1/wca/fun/best-podiums', g: 'public', c: 'cdn', zh: '最强领奖台', en: 'Best podiums' },
  { d: 'wca-fun', m: 'GET', p: '/v1/wca/fun/uncrowned-kings', g: 'public', c: 'cdn', zh: '无冕之王', en: 'Uncrowned kings' },
  { d: 'wca-fun', m: 'GET', p: '/v1/wca/fun/podium-missers', g: 'public', c: 'cdn', zh: '差点上台', en: 'Podium missers' },
  { d: 'wca-fun', m: 'GET', p: '/v1/wca/fun/record-missers', g: 'public', c: 'cdn', zh: '差点破纪录', en: 'Record missers' },
  { d: 'wca-fun', m: 'GET', p: '/v1/wca/fun/records-person', g: 'public', c: 'cdn', zh: '个人纪录数', en: 'Records per person' },
  { d: 'wca-fun', m: 'GET', p: '/v1/wca/fun/records-comp', g: 'public', c: 'cdn', zh: '单场纪录数', en: 'Records per comp' },
  { d: 'wca-fun', m: 'GET', p: '/v1/wca/fun/oldest-records', g: 'public', c: 'cdn', zh: '最古老的纪录', en: 'Oldest standing records' },
  { d: 'wca-fun', m: 'GET', p: '/v1/wca/fun/most-comps-person', g: 'public', c: 'cdn', zh: '参赛最多', en: 'Most comps' },
  { d: 'wca-fun', m: 'GET', p: '/v1/wca/fun/most-persons-comp', g: 'public', c: 'cdn', zh: '人数最多的比赛', en: 'Most attendees' },
  { d: 'wca-fun', m: 'GET', p: '/v1/wca/fun/most-solves-person-comp', g: 'public', c: 'cdn', zh: '单场最多还原', en: 'Most solves in one comp' },
  { d: 'wca-fun', m: 'GET', p: '/v1/wca/fun/most-solves-comp', g: 'public', c: 'cdn', zh: '比赛总还原数', en: 'Most solves per comp' },
  { d: 'wca-fun', m: 'GET', p: '/v1/wca/fun/most-solves-person', g: 'public', c: 'cdn', zh: '个人总还原数', en: 'Most solves per person' },
  { d: 'wca-fun', m: 'GET', p: '/v1/wca/fun/most-solves-person-year/years', g: 'public', c: 'cdn', zh: '可选年份列表', en: 'Available years' },
  { d: 'wca-fun', m: 'GET', p: '/v1/wca/fun/most-solves-person-year', g: 'public', c: 'cdn', zh: '年度个人还原数', en: 'Solves per person per year' },
  { d: 'wca-fun', m: 'GET', p: '/v1/wca/fun/top100-appearances', g: 'public', c: 'cdn', zh: 'Top100 上榜次数', en: 'Top-100 appearances' },

  // ---- wca-data ----
  { d: 'wca-data', m: 'GET', p: '/v1/wca/historical-ranks', g: 'public', c: 'cdn', zh: '历史名次时间线', en: 'Historical ranks timeline' },
  { d: 'wca-data', m: 'GET', p: '/v1/wca/historical-ranks/countries', g: 'public', c: 'cdn', zh: '国家列表', en: 'Country list' },
  { d: 'wca-data', m: 'GET', p: '/v1/wca/historical-ranks/meta', g: 'public', c: 'cdn', zh: '时间线元信息', en: 'Timeline meta' },
  { d: 'wca-data', m: 'GET', p: '/v1/wca/recent-records', g: 'public', zh: '近期纪录(WCA Live 轮询)', en: 'Recent records (WCA Live poll)' },
  { d: 'wca-data', m: 'GET', p: '/v1/wca/comp/:id/schedule', g: 'public', c: 'cdn', zh: '比赛赛程(服务端缓存)', en: 'Competition schedule (cached)' },
  { d: 'wca-data', m: 'POST', p: '/v1/wca/format-record', g: 'public', zh: '成绩值格式化', en: 'Format a raw result value' },
  { d: 'wca-data', m: 'GET', p: '/v1/wca/result-watch/status', g: 'public', zh: '往期成绩监控状态', en: 'Result-watch status' },
  { d: 'wca-data', m: 'GET', p: '/v1/wca/result-watch/changes', g: 'public', zh: '已记录的成绩变更', en: 'Recorded result changes' },
  { d: 'wca-data', m: 'POST', p: '/v1/wca/result-watch/changes', g: 'login', zh: '提交成绩变更标注', en: 'Submit a result change' },
  { d: 'wca-data', m: 'PUT', p: '/v1/wca/result-watch/changes/:id', g: 'admin', zh: '编辑变更', en: 'Edit a change' },
  { d: 'wca-data', m: 'DELETE', p: '/v1/wca/result-watch/changes/:id', g: 'admin', zh: '删除变更', en: 'Delete a change' },
  { d: 'wca-data', m: 'POST', p: '/v1/wca/result-watch/changes/:id/approve', g: 'admin', zh: '审核通过', en: 'Approve' },
  { d: 'wca-data', m: 'POST', p: '/v1/wca/result-watch/changes/:id/reject', g: 'admin', zh: '审核驳回', en: 'Reject' },
  { d: 'wca-data', m: 'GET', p: '/v1/wca-proxy/*', g: 'admin', zh: 'WCA 官方 API 代理(密钥门 + SSRF 白名单)', en: 'WCA API proxy (key-gated + SSRF allowlist)' },

  // ---- scramble ----
  { d: 'scramble', m: 'GET', p: '/v1/wca/scrambles', g: 'public', zh: '真题打乱(指定日期 / 比赛)', en: 'Real scrambles (by date / comp)' },
  { d: 'scramble', m: 'GET', p: '/v1/wca/scrambles/random', g: 'public', zh: '随机真题打乱', en: 'Random real scramble' },
  { d: 'scramble', m: 'GET', p: '/v1/wca/scrambles/by-difficulty', g: 'public', zh: '按难度抽真题打乱', en: 'Scrambles by difficulty' },
  { d: 'scramble', m: 'GET', p: '/v1/scramble/555-rs', g: 'public', zh: '5x5 打乱(原生 daemon)', en: '5x5 scramble (native daemon)' },
  { d: 'scramble', m: 'GET', p: '/v1/scramble/555-rs/ready', g: 'public', zh: '5x5 daemon 是否就绪', en: '5x5 daemon readiness' },
  { d: 'scramble', m: 'GET', p: '/v1/scramble/555-rs/batch', g: 'public', zh: '批量 5x5 打乱', en: 'Batch 5x5 scrambles' },
  { d: 'scramble', m: 'GET', p: '/v1/scramble/optimal-solve/ready', g: 'public', zh: '云端最优求解器是否就绪', en: 'Optimal-solver readiness' },
  { d: 'scramble', m: 'POST', p: '/v1/scramble/optimal-solve', g: 'login', zh: '3x3 最优解(SSE,登录 + 限流)', en: '3x3 optimal solve (SSE, login + rate-limit)' },
  { d: 'scramble', m: 'GET', p: '/v1/scramble-marks', g: 'public', zh: '某打乱的公开标记', en: 'Public marks for a scramble' },
  { d: 'scramble', m: 'GET', p: '/v1/scramble-marks/recent', g: 'public', zh: '最近标记 feed', en: 'Recent marks feed' },
  { d: 'scramble', m: 'POST', p: '/v1/scramble-marks', g: 'login', zh: '发布打乱标记', en: 'Post a scramble mark' },
  { d: 'scramble', m: 'DELETE', p: '/v1/scramble-marks', g: 'login', zh: '删除自己的标记', en: 'Delete own mark' },
  { d: 'scramble', m: 'DELETE', p: '/v1/scramble-marks/:id', g: 'login', zh: '按 id 删标记', en: 'Delete mark by id' },

  // ---- recon ----
  { d: 'recon', m: 'GET', p: '/v1/recon/list', g: 'public', c: 'cdn', zh: '复盘列表', en: 'Recon list' },
  { d: 'recon', m: 'GET', p: '/v1/recon/latest', g: 'public', zh: '最新复盘', en: 'Latest recons' },
  { d: 'recon', m: 'GET', p: '/v1/recon/today', g: 'public', zh: '今日复盘', en: "Today's recons" },
  { d: 'recon', m: 'GET', p: '/v1/recon/list-persons', g: 'public', zh: '复盘作者列表', en: 'Recon authors' },
  { d: 'recon', m: 'GET', p: '/v1/recon/search-solvers', g: 'public', zh: '按作者搜索', en: 'Search solvers' },
  { d: 'recon', m: 'GET', p: '/v1/recon/person/:wcaId', g: 'public', zh: '某选手的复盘', en: 'Recons by person' },
  { d: 'recon', m: 'GET', p: '/v1/recon/user-stats', g: 'public', zh: '作者统计', en: 'Author stats' },
  { d: 'recon', m: 'GET', p: '/v1/recon/check-duplicate', g: 'public', zh: '查重', en: 'Duplicate check' },
  { d: 'recon', m: 'GET', p: '/v1/recon/:id', g: 'public', zh: '单条复盘', en: 'Single recon' },
  { d: 'recon', m: 'GET', p: '/v1/recon/:id/same-scramble', g: 'public', zh: '同打乱的其它复盘', en: 'Same-scramble recons' },
  { d: 'recon', m: 'POST', p: '/v1/recon', g: 'login', zh: '新建复盘', en: 'Create recon' },
  { d: 'recon', m: 'PUT', p: '/v1/recon/:id', g: 'login', zh: '编辑复盘', en: 'Edit recon' },
  { d: 'recon', m: 'DELETE', p: '/v1/recon/:id', g: 'login', zh: '删除复盘', en: 'Delete recon' },
  { d: 'recon', m: 'POST', p: '/v1/recon/:id/alternatives', g: 'login', zh: '加替代解', en: 'Add alternative solution' },
  { d: 'recon', m: 'PUT', p: '/v1/recon/:id/alternatives/:idx', g: 'login', zh: '改替代解', en: 'Edit alternative' },
  { d: 'recon', m: 'DELETE', p: '/v1/recon/:id/alternatives/:idx', g: 'login', zh: '删替代解', en: 'Delete alternative' },
  { d: 'recon', m: 'GET', p: '/v1/recon/comments', g: 'public', zh: '复盘评论', en: 'Recon comments' },
  { d: 'recon', m: 'POST', p: '/v1/recon/comments', g: 'login', zh: '发评论', en: 'Post comment' },
  { d: 'recon', m: 'PUT', p: '/v1/recon/comments/:id', g: 'login', zh: '改评论', en: 'Edit comment' },
  { d: 'recon', m: 'DELETE', p: '/v1/recon/comments/:id', g: 'login', zh: '删评论', en: 'Delete comment' },
  { d: 'recon', m: 'PUT', p: '/v1/recon/comments/:id/pin', g: 'admin', zh: '置顶评论', en: 'Pin comment' },
  { d: 'recon', m: 'GET', p: '/v1/recon/edits', g: 'public', zh: '编辑记录', en: 'Edit log' },
  { d: 'recon', m: 'POST', p: '/v1/recon/save-edit', g: 'login', zh: '保存编辑', en: 'Save edit' },
  { d: 'recon', m: 'DELETE', p: '/v1/recon/edit/:id', g: 'admin', zh: '删编辑记录', en: 'Delete edit record' },
  { d: 'recon', m: 'GET', p: '/v1/recon/history', g: 'public', zh: '历史记录', en: 'History' },
  { d: 'recon', m: 'POST', p: '/v1/recon/save-history', g: 'login', zh: '保存历史', en: 'Save history' },
  { d: 'recon', m: 'GET', p: '/v1/recon/wca-attempts', g: 'public', zh: 'WCA 单次成绩明细', en: 'WCA attempt detail' },
  { d: 'recon', m: 'GET', p: '/v1/recon/cubing-attempts', g: 'public', zh: 'cubing.com 成绩明细', en: 'cubing.com attempt detail' },
  { d: 'recon', m: 'GET', p: '/v1/recon/wca-results', g: 'public', zh: 'WCA 结果', en: 'WCA results' },
  { d: 'recon', m: 'GET', p: '/v1/recon/bili-cover', g: 'public', zh: 'B 站封面代理', en: 'Bilibili cover proxy' },
  { d: 'recon', m: 'GET', p: '/v1/recon/douyin-cover', g: 'public', zh: '抖音封面代理', en: 'Douyin cover proxy' },
  { d: 'recon', m: 'GET', p: '/v1/recon/resolve-shorturl', g: 'public', zh: '短链解析', en: 'Resolve short URL' },

  // ---- comp ----
  { d: 'comp', m: 'GET', p: '/v1/comp/announced', g: 'public', zh: '今日公示比赛', en: "Today's announced comps" },
  { d: 'comp', m: 'GET', p: '/v1/cn-comp-names', g: 'public', c: 'cdn', zh: '中国比赛中文名', en: 'Chinese comp names' },
  { d: 'comp', m: 'GET', p: '/v1/comp/follows', g: 'login', zh: '我关注的比赛', en: 'My followed comps' },
  { d: 'comp', m: 'PUT', p: '/v1/comp/follows/:compId', g: 'login', zh: '关注比赛', en: 'Follow a comp' },
  { d: 'comp', m: 'DELETE', p: '/v1/comp/follows/:compId', g: 'login', zh: '取消关注', en: 'Unfollow' },

  // ---- nemesizer ----
  { d: 'nemesizer', m: 'GET', p: '/v1/nemesizer/meta', g: 'public', zh: '数据集元信息', en: 'Dataset meta' },
  { d: 'nemesizer', m: 'GET', p: '/v1/nemesizer/person', g: 'public', zh: '选手解析', en: 'Resolve person' },
  { d: 'nemesizer', m: 'GET', p: '/v1/nemesizer/nemeses', g: 'public', zh: '宿敌列表', en: 'Nemeses' },
  { d: 'nemesizer', m: 'GET', p: '/v1/nemesizer/h2h', g: 'public', zh: '正面交锋', en: 'Head-to-head' },
  { d: 'nemesizer', m: 'GET', p: '/v1/nemesizer/whatif', g: 'public', zh: '假设推演', en: 'What-if' },
  { d: 'nemesizer', m: 'GET', p: '/v1/nemesizer/stats', g: 'public', zh: '汇总统计', en: 'Stats' },

  // ---- live ----
  { d: 'live', m: 'GET', p: '/v1/cubing-live/:slug', g: 'public', zh: '比赛实时成绩(L2 缓存)', en: 'Live comp results (L2 cache)' },
  { d: 'live', m: 'GET', p: '/v1/cubing-live-stream/:slug', g: 'public', zh: '实时成绩流(SSE)', en: 'Live result stream (SSE)' },
  { d: 'live', m: 'GET', p: '/v1/cubing-zh/:wcaId', g: 'public', zh: '国内选手中文信息', en: 'CN cuber Chinese info' },

  // ---- alg ----
  { d: 'alg', m: 'GET', p: '/v1/alg/sets', g: 'public', c: 'cdn', zh: '全部公式集', en: 'All alg sets' },
  { d: 'alg', m: 'GET', p: '/v1/alg/sets/:puzzle/:set', g: 'public', c: 'cdn', zh: '一套公式的全部 case', en: 'All cases of a set' },
  { d: 'alg', m: 'POST', p: '/v1/alg/sets/:puzzle/:set/cases', g: 'admin', zh: '新增 case', en: 'Add case' },
  { d: 'alg', m: 'PUT', p: '/v1/alg/sets/:puzzle/:set/cases/:id', g: 'admin', zh: '编辑 case', en: 'Edit case' },
  { d: 'alg', m: 'PUT', p: '/v1/alg/sets/:puzzle/:set/reorder', g: 'admin', zh: '重排 case', en: 'Reorder cases' },
  { d: 'alg', m: 'DELETE', p: '/v1/alg/sets/:puzzle/:set/cases/:id', g: 'admin', zh: '删除 case', en: 'Delete case' },
  { d: 'alg', m: 'GET', p: '/v1/alg/:puzzle/:set/submissions', g: 'public', zh: '用户投稿的公式', en: 'User-submitted algs' },
  { d: 'alg', m: 'POST', p: '/v1/alg/:puzzle/:set/:case/submit', g: 'login', zh: '提交公式投稿', en: 'Submit an alg' },
  { d: 'alg', m: 'PUT', p: '/v1/alg/submissions/:id', g: 'admin', zh: '编辑投稿', en: 'Edit submission' },
  { d: 'alg', m: 'DELETE', p: '/v1/alg/submissions/:id', g: 'admin', zh: '删除投稿', en: 'Delete submission' },
  { d: 'alg', m: 'GET', p: '/v1/alg/submissions/admin/unread', g: 'admin', zh: '未读投稿', en: 'Unread submissions' },
  { d: 'alg', m: 'GET', p: '/v1/alg/submissions/admin/recent', g: 'admin', zh: '最近投稿', en: 'Recent submissions' },
  { d: 'alg', m: 'POST', p: '/v1/alg/submissions/admin/seen', g: 'admin', zh: '标记已读', en: 'Mark seen' },
  { d: 'alg', m: 'GET', p: '/v1/progress/:algSetId', g: 'login', zh: '读取训练进度', en: 'Read training progress' },
  { d: 'alg', m: 'POST', p: '/v1/progress/:algSetId', g: 'login', zh: '保存训练进度', en: 'Save training progress' },

  // ---- membership ----
  { d: 'membership', m: 'GET', p: '/v1/membership/plans', g: 'public', zh: '会员套餐', en: 'Membership plans' },
  { d: 'membership', m: 'GET', p: '/v1/membership/me', g: 'login', zh: '我的会员状态', en: 'My membership' },
  { d: 'membership', m: 'PUT', p: '/v1/membership/me/contact', g: 'login', zh: '改联系方式', en: 'Update contact' },
  { d: 'membership', m: 'POST', p: '/v1/membership/orders', g: 'login', zh: '创建订单', en: 'Create order' },
  { d: 'membership', m: 'GET', p: '/v1/membership/orders/:no', g: 'login', zh: '查订单状态', en: 'Order status' },
  { d: 'membership', m: 'POST', p: '/v1/membership/notify/alipay', g: 'webhook', c: 'no-store', zh: '支付宝异步回调(验签)', en: 'Alipay notify (signed)' },
  { d: 'membership', m: 'POST', p: '/v1/membership/notify/wechat', g: 'webhook', c: 'no-store', zh: '微信支付回调(验签)', en: 'WeChat Pay notify (signed)' },
  { d: 'membership', m: 'POST', p: '/v1/membership/notify/xunhupay', g: 'webhook', c: 'no-store', zh: '虎皮椒回调(验签)', en: 'Xunhupay notify (signed)' },
  { d: 'membership', m: 'POST', p: '/v1/membership/admin/grant', g: 'admin', zh: '手动开通会员', en: 'Manually grant membership' },
  { d: 'membership', m: 'GET', p: '/v1/membership/admin/list', g: 'admin', zh: '会员列表', en: 'Member list' },
  { d: 'membership', m: 'DELETE', p: '/v1/membership/admin/member/:wcaId', g: 'admin', zh: '删除会员', en: 'Remove member' },
  { d: 'membership', m: 'PUT', p: '/v1/membership/admin/plans/:slug', g: 'admin', zh: '改套餐', en: 'Edit plan' },

  // ---- feedback ----
  { d: 'feedback', m: 'POST', p: '/v1/feedback', g: 'login', zh: '提交反馈', en: 'Submit feedback' },
  { d: 'feedback', m: 'POST', p: '/v1/feedback/:id/image', g: 'login', zh: '上传截图', en: 'Upload screenshot' },
  { d: 'feedback', m: 'POST', p: '/v1/feedback/:id/video', g: 'login', zh: '上传短视频', en: 'Upload short video' },
  { d: 'feedback', m: 'GET', p: '/v1/feedback/media/:id', g: 'admin', zh: '取媒体附件', en: 'Fetch media' },
  { d: 'feedback', m: 'GET', p: '/v1/feedback/mine', g: 'login', zh: '我的反馈', en: 'My feedback' },
  { d: 'feedback', m: 'GET', p: '/v1/feedback/mine/unread', g: 'login', zh: '未读回复数', en: 'Unread reply count' },
  { d: 'feedback', m: 'GET', p: '/v1/feedback/:id/thread', g: 'login', zh: '反馈对话', en: 'Feedback thread' },
  { d: 'feedback', m: 'POST', p: '/v1/feedback/:id/reply', g: 'login', zh: '回复', en: 'Reply' },
  { d: 'feedback', m: 'DELETE', p: '/v1/feedback/:id/message/:mid', g: 'login', zh: '删消息', en: 'Delete message' },
  { d: 'feedback', m: 'GET', p: '/v1/feedback', g: 'admin', zh: '全部反馈', en: 'All feedback' },
  { d: 'feedback', m: 'PATCH', p: '/v1/feedback/:id', g: 'admin', zh: '改状态', en: 'Update status' },
  { d: 'feedback', m: 'DELETE', p: '/v1/feedback/:id', g: 'admin', zh: '删除反馈', en: 'Delete feedback' },

  // ---- notifications ----
  { d: 'notification', m: 'GET', p: '/v1/notifications', g: 'login', zh: '我的通知(recon 另解 / 评论 / 回复)', en: 'My notifications (recon alternatives / comments / replies)' },
  { d: 'notification', m: 'GET', p: '/v1/notifications/unread', g: 'login', zh: '未读数(桌宠红点)', en: 'Unread count (desk-pet badge)' },
  { d: 'notification', m: 'POST', p: '/v1/notifications/read', g: 'login', zh: '标记已读(不传 ids = 全部)', en: 'Mark read (no ids = all)' },

  // ---- forum ----
  { d: 'forum', m: 'GET', p: '/v1/forum/index', g: 'public', zh: '论坛首页:分类 → 子版 + 全站统计', en: 'Forum index: categories, boards, site stats' },
  { d: 'forum', m: 'GET', p: '/v1/forum/f/:slug', g: 'public', zh: '子版主题列表(置顶单列,分页)', en: 'Board thread list (pinned split, paged)' },
  { d: 'forum', m: 'GET', p: '/v1/forum/t/:id', g: 'public', zh: '主题帖子分页(登录附本人反应)', en: 'Thread posts (my reactions when signed in)' },
  { d: 'forum', m: 'GET', p: '/v1/forum/latest', g: 'public', zh: '全版最新活跃主题', en: 'Latest active threads' },
  { d: 'forum', m: 'GET', p: '/v1/forum/search', g: 'public', zh: '搜标题 + 正文,带摘录', en: 'Search titles + bodies with snippet' },
  { d: 'forum', m: 'POST', p: '/v1/forum/threads', g: 'login', zh: '发主题(公告版仅管理员)', en: 'Create thread (announcements admin-only)' },
  { d: 'forum', m: 'POST', p: '/v1/forum/posts', g: 'login', zh: '回帖(锁帖仅管理员)', en: 'Reply (locked threads admin-only)' },
  { d: 'forum', m: 'PATCH', p: '/v1/forum/posts/:id', g: 'login', zh: '编辑自己的帖子', en: 'Edit own post' },
  { d: 'forum', m: 'DELETE', p: '/v1/forum/posts/:id', g: 'login', zh: '软删帖子(首帖禁单删)', en: 'Soft-delete post (not the first post)' },
  { d: 'forum', m: 'PATCH', p: '/v1/forum/threads/:id', g: 'login', zh: '改标题;置顶 / 锁帖仅管理员', en: 'Edit title; pin/lock admin-only' },
  { d: 'forum', m: 'DELETE', p: '/v1/forum/threads/:id', g: 'login', zh: '软删主题', en: 'Soft-delete thread' },
  { d: 'forum', m: 'POST', p: '/v1/forum/posts/:id/react', g: 'login', zh: '反应(再点取消,可换类型)', en: 'React (toggle / switch kind)' },
  { d: 'forum', m: 'POST', p: '/v1/forum/t/:id/view', g: 'public', zh: '浏览计数 +1', en: 'Bump view count' },
  { d: 'forum', m: 'POST', p: '/v1/forum/posts/:id/report', g: 'login', zh: '举报帖子(一人一帖一条)', en: 'Report a post (one per user per post)' },
  { d: 'forum', m: 'GET', p: '/v1/forum/reports', g: 'admin', zh: '举报列表(默认待处理,?all=1 全部)', en: 'List reports (open by default, ?all=1 for all)' },
  { d: 'forum', m: 'POST', p: '/v1/forum/reports/:id/resolve', g: 'admin', zh: '标记举报已处理', en: 'Mark report resolved' },

  // ---- content ----
  { d: 'content', m: 'GET', p: '/v1/wiki/terms', g: 'public', c: 'cdn', zh: '术语表', en: 'Wiki terms' },
  { d: 'content', m: 'POST', p: '/v1/wiki/terms', g: 'login', zh: '加术语', en: 'Add term' },
  { d: 'content', m: 'PATCH', p: '/v1/wiki/terms/:id', g: 'admin', zh: '改术语', en: 'Edit term' },
  { d: 'content', m: 'DELETE', p: '/v1/wiki/terms/:id', g: 'admin', zh: '删术语', en: 'Delete term' },
  { d: 'content', m: 'POST', p: '/v1/wiki/terms/:id/additions', g: 'login', zh: '补充术语', en: 'Add addition' },
  { d: 'content', m: 'PATCH', p: '/v1/wiki/additions/:id', g: 'admin', zh: '改补充', en: 'Edit addition' },
  { d: 'content', m: 'DELETE', p: '/v1/wiki/additions/:id', g: 'admin', zh: '删补充', en: 'Delete addition' },
  { d: 'content', m: 'GET', p: '/v1/wiki/me', g: 'login', zh: '我的术语贡献', en: 'My wiki contributions' },
  { d: 'content', m: 'GET', p: '/v1/article', g: 'public', c: 'cdn', zh: '文章列表', en: 'Article list' },
  { d: 'content', m: 'GET', p: '/v1/article/:slug', g: 'public', c: 'cdn', zh: '单篇文章', en: 'Single article' },
  { d: 'content', m: 'GET', p: '/v1/article/me', g: 'login', zh: '我的文章', en: 'My articles' },
  { d: 'content', m: 'GET', p: '/v1/article/img/:id', g: 'public', zh: '文章配图', en: 'Article image' },
  { d: 'content', m: 'POST', p: '/v1/article/img', g: 'login', zh: '上传配图', en: 'Upload image' },
  { d: 'content', m: 'POST', p: '/v1/article', g: 'login', zh: '发表文章', en: 'Publish article' },
  { d: 'content', m: 'PATCH', p: '/v1/article/:slug', g: 'login', zh: '编辑文章', en: 'Edit article' },
  { d: 'content', m: 'DELETE', p: '/v1/article/:slug', g: 'login', zh: '删除文章', en: 'Delete article' },
  { d: 'content', m: 'POST', p: '/v1/article/:slug/report', g: 'login', zh: '举报文章', en: 'Report article' },
  { d: 'content', m: 'GET', p: '/v1/article/reports', g: 'admin', zh: '举报列表', en: 'Report queue' },
  { d: 'content', m: 'GET', p: '/v1/colpi/words', g: 'public', zh: 'COLL/PLL 助记词条', en: 'Colpi mnemonic words' },
  { d: 'content', m: 'GET', p: '/v1/colpi/lang-counts', g: 'public', zh: '各语言词条数', en: 'Word counts per language' },
  { d: 'content', m: 'GET', p: '/v1/colpi/recent', g: 'public', zh: '最近词条', en: 'Recent words' },
  { d: 'content', m: 'POST', p: '/v1/colpi/words', g: 'login', zh: '投稿词条', en: 'Submit word' },
  { d: 'content', m: 'PATCH', p: '/v1/colpi/words/:id', g: 'admin', zh: '改词条', en: 'Edit word' },
  { d: 'content', m: 'DELETE', p: '/v1/colpi/words/:id', g: 'admin', zh: '删词条', en: 'Delete word' },
  { d: 'content', m: 'PUT', p: '/v1/colpi/words/:id/vote', g: 'login', zh: '给词条投票', en: 'Vote a word' },
  { d: 'content', m: 'DELETE', p: '/v1/colpi/words/:id/vote', g: 'login', zh: '撤销投票', en: 'Remove vote' },
  { d: 'content', m: 'GET', p: '/v1/nav/sites', g: 'public', c: 'cdn', zh: '导航站点', en: 'Nav sites' },
  { d: 'content', m: 'POST', p: '/v1/nav/sites', g: 'admin', zh: '加站点', en: 'Add site' },
  { d: 'content', m: 'PUT', p: '/v1/nav/sites/reorder', g: 'admin', zh: '重排站点', en: 'Reorder sites' },
  { d: 'content', m: 'PUT', p: '/v1/nav/sites/:id', g: 'admin', zh: '改站点', en: 'Edit site' },
  { d: 'content', m: 'DELETE', p: '/v1/nav/sites/:id', g: 'admin', zh: '删站点', en: 'Delete site' },
  { d: 'content', m: 'GET', p: '/v1/sponsors', g: 'public', c: 'cdn', zh: '赞助墙', en: 'Sponsors wall' },
  { d: 'content', m: 'POST', p: '/v1/sponsors', g: 'admin', zh: '加赞助', en: 'Add sponsor' },
  { d: 'content', m: 'PUT', p: '/v1/sponsors/:id', g: 'admin', zh: '改赞助', en: 'Edit sponsor' },
  { d: 'content', m: 'DELETE', p: '/v1/sponsors/:id', g: 'admin', zh: '删赞助', en: 'Delete sponsor' },
  { d: 'content', m: 'GET', p: '/v1/ops/commands', g: 'public', zh: '运维命令手册', en: 'Ops runbook commands' },
  { d: 'content', m: 'POST', p: '/v1/ops/commands', g: 'admin', zh: '加命令', en: 'Add command' },
  { d: 'content', m: 'PUT', p: '/v1/ops/commands/reorder', g: 'admin', zh: '重排命令', en: 'Reorder commands' },
  { d: 'content', m: 'PUT', p: '/v1/ops/commands/:id', g: 'admin', zh: '改命令', en: 'Edit command' },
  { d: 'content', m: 'DELETE', p: '/v1/ops/commands/:id', g: 'admin', zh: '删命令', en: 'Delete command' },
  { d: 'content', m: 'GET', p: '/v1/paint/drawings', g: 'login', zh: '我的矢量画作', en: 'My paint drawings' },
  { d: 'content', m: 'GET', p: '/v1/paint/drawings/:id', g: 'public', zh: '单个画作', en: 'Single drawing' },
  { d: 'content', m: 'POST', p: '/v1/paint/drawings', g: 'login', zh: '保存画作', en: 'Save drawing' },
  { d: 'content', m: 'PUT', p: '/v1/paint/drawings/:id', g: 'login', zh: '更新画作', en: 'Update drawing' },
  { d: 'content', m: 'DELETE', p: '/v1/paint/drawings/:id', g: 'login', zh: '删画作', en: 'Delete drawing' },

  // ---- timer ----
  { d: 'timer', m: 'GET', p: '/v1/timer/backup', g: 'login', zh: '取计时器云备份', en: 'Fetch timer backup' },
  { d: 'timer', m: 'POST', p: '/v1/timer/backup', g: 'login', zh: '上传计时器备份', en: 'Upload timer backup' },
  { d: 'timer', m: 'DELETE', p: '/v1/timer/backup', g: 'login', zh: '删除备份', en: 'Delete backup' },

  // ---- analytics ----
  { d: 'analytics', m: 'POST', p: '/v1/analytics/pv', g: 'public', c: 'no-store', zh: '上报页面访问(beacon)', en: 'Report page view (beacon)' },
  { d: 'analytics', m: 'POST', p: '/v1/analytics/dwell', g: 'public', c: 'no-store', zh: '上报停留时长', en: 'Report dwell time' },
  { d: 'analytics', m: 'GET', p: '/v1/analytics/summary', g: 'admin', zh: '访问统计汇总', en: 'Traffic summary' },

  // ---- system ----
  { d: 'system', m: 'GET', p: '/v1/health', g: 'public', c: 'no-store', zh: '健康检查', en: 'Health check' },
  { d: 'system', m: 'GET', p: '/v1/visualcube.svg', g: 'public', c: 'cdn', zh: '服务端渲染魔方 SVG', en: 'Server-rendered cube SVG' },
];

const METHODS: Method[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const GATES: Gate[] = ['public', 'login', 'admin', 'webhook'];

const GATE_LABEL: Record<Gate, { zh: string; en: string }> = {
  public: { zh: '公开', en: 'Public' },
  login: { zh: '需登录', en: 'Login' },
  admin: { zh: '需 admin', en: 'Admin' },
  webhook: { zh: '支付回调', en: 'Webhook' },
};

const GATE_NOTE: Record<Gate, { zh: string; en: string }> = {
  public: { zh: '无需鉴权,任何人可调。', en: 'No auth — open to anyone.' },
  login: { zh: '需带 WCA 登录后的 Bearer JWT。', en: 'Requires a Bearer JWT from WCA login.' },
  admin: { zh: '需 admin 凭据(X-Admin-Key 或管理员账号)。', en: 'Requires admin credentials (X-Admin-Key or an admin account).' },
  webhook: { zh: '仅供支付服务商服务端回调,带网关签名,前端不调。', en: 'Server-to-server payment callback, gateway-signed — not called by the client.' },
};

const CACHE_LABEL: Record<Cache, { zh: string; en: string }> = {
  cdn: { zh: 'CDN 可缓存', en: 'CDN cacheable' },
  'no-store': { zh: '不缓存', en: 'no-store' },
};

const CACHE_NOTE: Record<Cache, { zh: string; en: string }> = {
  cdn: { zh: '天然不可变 / 慢变,nginx 走 s-maxage 长缓存,浏览器短缓存。', en: 'Immutable or slow-moving; long s-maxage at nginx, short browser cache.' },
  'no-store': { zh: '暂态或写操作,发 no-store,从不缓存。', en: 'Transient or a write — sent no-store, never cached.' },
};

function pathParams(p: string): string[] {
  return (p.match(/:([a-zA-Z]+)/g) ?? []).map((s) => s.slice(1));
}

export default function ApiCatalogPage() {
  const { i18n } = useTranslation();
  const lang = (['en', 'zh'] as const)[Number(i18n.language.startsWith('zh'))];

  useDocumentTitle('API 端点目录', 'API reference');

  const [q, setQ] = useQueryState('q', parseAsString.withDefault('').withOptions({ history: 'replace', scroll: false }));
  const [domain, setDomain] = useQueryState('domain', parseAsString.withDefault('').withOptions({ history: 'replace', scroll: false }));
  const [method, setMethod] = useQueryState('method', parseAsStringEnum<Method>(METHODS).withOptions({ history: 'replace', scroll: false }));
  const [gate, setGate] = useQueryState('gate', parseAsStringEnum<Gate>(GATES).withOptions({ history: 'replace', scroll: false }));

  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const needle = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      ENDPOINTS.filter((e) => {
        if (domain && e.d !== domain) return false;
        if (method && e.m !== method) return false;
        if (gate && e.g !== gate) return false;
        if (needle) {
          const hay = `${e.p} ${e.zh} ${e.en} ${e.d}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      }),
    [domain, method, gate, needle],
  );

  const groups = useMemo(
    () =>
      DOMAINS.map((dm) => ({ dm, items: filtered.filter((e) => e.d === dm.key) })).filter((g) => g.items.length > 0),
    [filtered],
  );

  const total = ENDPOINTS.length;
  const publicCount = ENDPOINTS.filter((e) => e.g === 'public').length;
  const hasFilter = Boolean(needle || domain || method || gate);
  const reset = () => { setQ(''); setDomain(''); setMethod(null); setGate(null); };

  return (
    <div className="api-page" style={{ ['--accent' as string]: ACCENT }}>
      <div className="api-bg" />
      <div className="api-inner">
        <div className="api-topbar">
          <Link href="/code" className="api-back">← /code</Link>
        </div>

        <header className="api-hero">
          <div className="api-eyebrow">{tr({ zh: 'REST 端点参考', en: 'REST endpoint reference' })}</div>
          <h1 className="api-title"><span className="api-title-slash">/</span>code/api</h1>
          <p className="api-lede">
            {tr({
              zh: 'CubeRoot 后端是一个 Hono 服务,全部端点挂在 /v1 下。这里把每个对外端点列全:方法、路径、用途、鉴权门、缓存策略。数据直接从路由源码抽出。',
              en: 'The CubeRoot backend is a single Hono service; every endpoint lives under /v1. This lists each public endpoint — method, path, purpose, auth gate, cache policy — extracted straight from the route source.',
            })}
          </p>
          <div className="api-base">
            <span className="api-base-label">{tr({ zh: '基地址', en: 'Base' })}</span>
            <code>https://{BASE}</code>
          </div>
          <div className="api-stats">
            <span><strong>{total}</strong> {tr({ zh: '个端点', en: 'endpoints' })}</span>
            <span><strong>{DOMAINS.length}</strong> {tr({ zh: '个域', en: 'domains' })}</span>
            <span><strong>{publicCount}</strong> {tr({ zh: '个公开', en: 'public' })}</span>
          </div>
        </header>

        <div className="api-controls">
          <div className="api-search">
            <svg className="api-search-icon" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M10.5 10.5 L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <SearchInput
              value={q}
              onChange={setQ}
              className="api-search-field"
              inputClassName="api-search-input"
              placeholder={tr({ zh: '搜路径或用途，如 sum-of-ranks / 打乱 / recon', en: 'Search path or purpose — sum-of-ranks / scramble / recon' })}
              ariaLabel={tr({ zh: '搜索端点', en: 'Search endpoints' })}
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <div className="api-filter-row">
            <label className="api-domain">
              <span className="api-filter-label">{tr({ zh: '域', en: 'Domain' })}</span>
              <select value={domain} onChange={(e) => setDomain(e.target.value)} className="api-select">
                <option value="">{tr({ zh: '全部', en: 'All' })}</option>
                {DOMAINS.map((dm) => (
                  <option key={dm.key} value={dm.key}>{dm[lang]}</option>
                ))}
              </select>
            </label>

            <div className="api-chiprow" role="group" aria-label={tr({ zh: '按方法过滤', en: 'Filter by method' })}>
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`api-chip api-m${method === m ? ' is-on' : ''}`}
                  data-method={m}
                  aria-pressed={method === m}
                  onClick={() => setMethod(method === m ? null : m)}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="api-chiprow" role="group" aria-label={tr({ zh: '按鉴权过滤', en: 'Filter by auth' })}>
              {GATES.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`api-chip api-g${gate === g ? ' is-on' : ''}`}
                  data-gate={g}
                  aria-pressed={gate === g}
                  onClick={() => setGate(gate === g ? null : g)}
                >
                  {GATE_LABEL[g][lang]}
                </button>
              ))}
            </div>
          </div>

          <div className="api-resultbar">
            <span>{tr({ zh: `匹配 ${filtered.length} / ${total}`, en: `${filtered.length} / ${total} match` })}</span>
            {hasFilter && (
              <button type="button" className="api-reset" onClick={reset}>
                {tr({ zh: '清除筛选', en: 'Clear filters' })}
              </button>
            )}
          </div>
        </div>

        <main className="api-groups">
          {groups.length === 0 && (
            <p className="api-empty">{tr({ zh: '没有匹配的端点。', en: 'No matching endpoints.' })}</p>
          )}
          {groups.map(({ dm, items }) => (
            <section key={dm.key} className="api-group">
              <div className="api-group-head">
                <h2>{dm[lang]}</h2>
                <span className="api-group-count">{items.length}</span>
                <code className="api-group-key">{dm.key}</code>
              </div>
              <ul className="api-list">
                {items.map((e) => {
                  const id = `${e.m} ${e.p}`;
                  const isOpen = open.has(id);
                  const params = pathParams(e.p);
                  return (
                    <li key={id} className={`api-row${isOpen ? ' is-open' : ''}`}>
                      <button type="button" className="api-row-main" onClick={() => toggle(id)} aria-expanded={isOpen}>
                        <span className="api-method" data-method={e.m}>{e.m}</span>
                        <code className="api-path">{e.p}</code>
                        <span className="api-row-right">
                          <span className="api-gate" data-gate={e.g}>{GATE_LABEL[e.g][lang]}</span>
                          {e.c && <span className="api-cache" data-cache={e.c}>{CACHE_LABEL[e.c][lang]}</span>}
                          <span className="api-caret" aria-hidden="true">▸</span>
                        </span>
                      </button>
                      <p className="api-summary">{e[lang]}</p>
                      {isOpen && (
                        <div className="api-detail">
                          <div className="api-detail-url">
                            <span className="api-method" data-method={e.m}>{e.m}</span>
                            <code>https://{BASE}{e.p}</code>
                          </div>
                          {params.length > 0 && (
                            <div className="api-detail-block">
                              <span className="api-detail-h">{tr({ zh: '路径参数', en: 'Path params' })}</span>
                              <span className="api-params">
                                {params.map((pp) => <code key={pp} className="api-param">{pp}</code>)}
                              </span>
                            </div>
                          )}
                          <div className="api-detail-block">
                            <span className="api-detail-h">{GATE_LABEL[e.g][lang]}</span>
                            <span className="api-detail-note">{GATE_NOTE[e.g][lang]}</span>
                          </div>
                          {e.c && (
                            <div className="api-detail-block">
                              <span className="api-detail-h">{CACHE_LABEL[e.c][lang]}</span>
                              <span className="api-detail-note">{CACHE_NOTE[e.c][lang]}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </main>

        <footer className="api-foot">
          <p>
            {tr({
              zh: '调本站接口请走前端的 apiUrl() 封装,别硬编码 origin。鉴权门只标到「需登录 / 需 admin」级别,不公开任何密钥。',
              en: 'From the frontend, always go through the apiUrl() helper — never hardcode an origin. Auth gates are shown only at the login / admin level; no secrets are exposed.',
            })}
          </p>
          <Link href="/code/architecture" className="api-foot-link">{tr({ zh: '架构总览 →', en: 'Architecture overview →' })}</Link>
        </footer>
      </div>
    </div>
  );
}
