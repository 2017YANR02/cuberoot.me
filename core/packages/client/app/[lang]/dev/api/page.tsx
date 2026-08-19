'use client';

import { useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import { SearchInput } from '@/components/SearchInput';
import { tr } from '@/i18n/tr';
import './api.css';

const ACCENT = '#22D3EE';
const BASE = 'api.cuberoot.me';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Gate = 'public' | 'login' | 'admin' | 'webhook';
type Cache = 'cdn' | 'short' | 'no-store';

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
  { key: 'teaching-saas', zh: '教学机构', en: 'Teaching organizations' },
  { key: 'membership', zh: '会员', en: 'Membership' },
  { key: 'feedback', zh: '反馈', en: 'Feedback' },
  { key: 'notification', zh: '通知', en: 'Notifications' },
  { key: 'forum', zh: '论坛', en: 'Forum' },
  { key: 'documents', zh: '协作文档与表格', en: 'Collaborative docs & sheets' },
  { key: 'quiz', zh: '知识问答', en: 'Quiz' },
  { key: 'content', zh: '内容与运维', en: 'Content & ops' },
  { key: 'timer', zh: '计时器', en: 'Timer' },
  { key: 'smart-cube', zh: '智能魔方', en: 'Smart cube' },
  { key: 'calendar', zh: '日历', en: 'Calendar' },
  { key: 'system', zh: '系统与渲染', en: 'System & render' },
];

// 全部对外端点,前缀 /v1。method / path 据 packages/server/src/routes/* 真实定义抽取;
// 鉴权门据 requireAuth / requireAdmin(X-Admin-Key)/ 支付回调签名判定。
// ─ covers-routes-start ─ DRIFT-GUARD: route files documented by this catalog.
//   tests/dev-schema-api-drift.test.ts asserts (tokens here ∩ on-disk route files)
//   equals the set mounted via app.route('/v1', …) in packages/server/src/index.ts.
//   CI red here = a newly-mounted route is undocumented: add its endpoints below,
//   then add the file stem to this list.
//   account_auth alg alg_lsll alg_marks alg_preferred_algs alg_srs alg_sets alg_sweep alg_time_attack_order announced_comps article auth battle_rooms calendar cn_comp_names colpi
//   comp_follows cube cubeopt_solve cubing_live documents feedback forum health historical_ranks
//   membership nav_sites nemesizer notifications ops page_notices paint pattern_examples progress quiz recon recon_ground_truth scramble_555 teacher_directory teaching teaching_saas
//   scramble_marks sim_masks sms_receipt sponsors timer_backups timer_presence trainer_rooms wca_format wca_fun_stats wca_person wca_proxy
//   video_rooms wca_recent_records wca_result_watch wca_schedule wca_scrambles wca_stats_extra wca_teachers wechat_jssdk wiki
// ─ covers-routes-end ─
const ENDPOINTS: Ep[] = [
  // ---- auth ----
  { d: 'auth', m: 'GET', p: '/v1/auth/login', g: 'public', zh: '跳转 WCA OAuth 授权页', en: 'Redirect to WCA OAuth' },
  { d: 'auth', m: 'GET', p: '/v1/auth/callback', g: 'public', zh: 'OAuth 回调,建立登录态', en: 'OAuth callback, establish session' },
  { d: 'auth', m: 'POST', p: '/v1/auth/exchange', g: 'public', zh: '用授权码换取 JWT', en: 'Exchange auth code for JWT' },
  { d: 'auth', m: 'POST', p: '/v1/auth/refresh', g: 'login', zh: '刷新 JWT', en: 'Refresh JWT' },
  { d: 'auth', m: 'GET', p: '/v1/auth/me', g: 'login', zh: '当前登录用户信息', en: 'Current signed-in user' },
  { d: 'auth', m: 'POST', p: '/v1/auth/wechat/miniprogram', g: 'public', zh: '用小程序登录码换取 UnionID 并签发 JWT', en: 'Exchange a Mini Program login code for UnionID and issue a JWT' },
  { d: 'auth', m: 'POST', p: '/v1/auth/web-session/ticket', g: 'login', zh: '为小程序 web-view 签发 90 秒单次网页登录票据', en: 'Issue a 90-second single-use web session ticket for a Mini Program web-view' },
  { d: 'auth', m: 'POST', p: '/v1/auth/web-session/exchange', g: 'public', zh: '原子核销单次票据并签发网站 JWT', en: 'Atomically consume a single-use ticket and issue a website JWT' },

  // ---- account (邮箱 / 手机验证码登录 + 多身份绑定) ----
  { d: 'auth', m: 'GET', p: '/v1/auth/providers', g: 'public', zh: '已配置的登录方式(前端隐藏未开放 tab)', en: 'Configured login methods (client hides unavailable tabs)' },
  { d: 'auth', m: 'POST', p: '/v1/auth/email/send', g: 'public', zh: '发邮箱验证码(登录/注册)', en: 'Send email login code' },
  { d: 'auth', m: 'POST', p: '/v1/auth/email/verify', g: 'public', zh: '校验邮箱验证码,签发 JWT', en: 'Verify email code, issue JWT' },
  { d: 'auth', m: 'POST', p: '/v1/auth/email/password', g: 'public', zh: '邮箱 + 密码登录,签发 JWT', en: 'Sign in with email + password, issue JWT' },
  { d: 'auth', m: 'POST', p: '/v1/auth/phone/send', g: 'public', zh: '发手机验证码(仅 +86)', en: 'Send phone login code (+86 only)' },
  { d: 'auth', m: 'POST', p: '/v1/auth/phone/verify', g: 'public', zh: '校验手机验证码,签发 JWT', en: 'Verify phone code, issue JWT' },
  { d: 'auth', m: 'POST', p: '/v1/auth/link/email/send', g: 'login', zh: '给当前账号发绑定邮箱验证码', en: 'Send code to link an email' },
  { d: 'auth', m: 'POST', p: '/v1/auth/link/email/verify', g: 'login', zh: '绑定邮箱到当前账号(已有邮箱则 409,一个账号只能一个)', en: 'Link email to current account (409 if one already exists — one email per account)' },
  { d: 'auth', m: 'POST', p: '/v1/auth/email/replace', g: 'login', zh: '换绑邮箱:原地改掉那条身份(发码复用 link/email/send)。只有邮箱的账号换不了邮箱,靠它开口子', en: 'Change the account email in place (code comes from link/email/send). The escape hatch for accounts whose only identity is that email' },
  { d: 'auth', m: 'POST', p: '/v1/auth/link/phone/send', g: 'login', zh: '给当前账号发绑定手机验证码', en: 'Send code to link a phone' },
  { d: 'auth', m: 'POST', p: '/v1/auth/link/phone/verify', g: 'login', zh: '绑定手机到当前账号(已有手机号则 409,一个账号只能一个)', en: 'Link phone to current account (409 if one already exists — one phone per account)' },
  { d: 'auth', m: 'POST', p: '/v1/auth/phone/replace', g: 'login', zh: '换绑手机号:原地改掉那条身份(发码复用 link/phone/send)。只有手机号的账号换不了号,靠它开口子', en: 'Change the account phone in place (code comes from link/phone/send). The escape hatch for accounts whose only identity is that phone number' },
  { d: 'auth', m: 'POST', p: '/v1/sms/receipt/:token', g: 'public', zh: '短信送达回执落点(服务商 HTTP 推送)。同步 Code: OK 只代表受理,送达失败是异步回执,不接就永远看不见。token 走 env,没配则整个端点 404', en: 'Delivery-receipt sink for the SMS provider’s HTTP push. A synchronous Code: OK only means accepted — delivery failures arrive asynchronously and are invisible unless received here. The token comes from env; unset means the endpoint 404s' },
  { d: 'auth', m: 'POST', p: '/v1/auth/link/wca', g: 'login', zh: '用 WCA token 绑定 WCA 身份', en: 'Link WCA identity via access token' },
  { d: 'auth', m: 'POST', p: '/v1/auth/google', g: 'public', zh: '用墙外中继签发的 Google 断言登录/注册', en: 'Sign in/up via relay-signed Google assertion' },
  { d: 'auth', m: 'POST', p: '/v1/auth/link/google', g: 'login', zh: '用墙外中继签发的 Google 断言绑定当前账号', en: 'Link Google identity via relay-signed assertion' },
  { d: 'auth', m: 'POST', p: '/v1/auth/unlink', g: 'login', zh: '解绑一个登录方式(拒绝最后一个)', en: 'Unlink a login method (not the last)' },
  { d: 'auth', m: 'POST', p: '/v1/auth/profile', g: 'login', c: 'no-store', zh: '修改当前账号的站内用户名并换发 JWT', en: 'Update the current account username and reissue its JWT' },
  { d: 'auth', m: 'POST', p: '/v1/auth/password/set', g: 'login', zh: '设置 / 修改密码(改密先验旧密)', en: 'Set / change password (change verifies the old one)' },
  { d: 'auth', m: 'GET', p: '/v1/auth/identities', g: 'login', zh: '当前账号已绑定的身份列表 + 是否已设密码', en: 'Linked identities of current account + whether a password is set' },

  // ---- wca-stats ----
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/grand-slam', g: 'public', c: 'cdn', zh: '大满贯榜', en: 'Grand-slam leaderboard' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/all-results', g: 'public', c: 'cdn', zh: '全成绩查询(姓名口径 / 项目筛选)', en: 'All-results query (name form / event filter)' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/kinch', g: 'public', c: 'cdn', zh: 'Kinch 综合分榜单与选手逐项分', en: 'Kinch leaderboard and per-event person scores' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/persons-directory', g: 'public', c: 'cdn', zh: '选手名录', en: 'Persons directory' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/person-aka', g: 'public', zh: '曾用名 / 曾属国', en: 'Former names / nationalities' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/person-page', g: 'public', zh: '选手页首屏全量:资料 + 全部成绩 + 参赛比赛(自家库,不经官网)', en: 'Whole person page: profile + every result + competitions, from our mirror' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/person-avatar', g: 'public', zh: '头像 URL(懒回源 + 入库缓存)', en: 'Avatar URL (lazily fetched, cached)' },
  { d: 'wca-stats', m: 'GET', p: '/v1/wca/person-misc', g: 'public', zh: '选手杂项(魔友 / 省份 / 个人纪录连续场次)', en: 'Person misc (peers / provinces / personal-record streak)' },
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
  { d: 'wca-data', m: 'GET', p: '/v1/wca/teachers', g: 'public', c: 'cdn', zh: '按选手与项目批量读取老师', en: 'Batch-read teachers by cuber and event' },
  { d: 'wca-data', m: 'PUT', p: '/v1/wca/teachers/:studentId/:eventId', g: 'login', zh: '有效会员按项目登记自己；管理员可代填', en: 'Active member self-registration per event; admin assignment' },
  { d: 'wca-data', m: 'DELETE', p: '/v1/wca/teachers/:studentId/:eventId', g: 'login', zh: '老师本人或管理员按项目撤销关系', en: 'Teacher or admin removes an event relation' },
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
  { d: 'recon', m: 'GET', p: '/v1/recon-ground-truth/export', g: 'public', zh: '已确认复盘测试样本的确定性导出', en: 'Deterministic export of confirmed recon test cases' },
  { d: 'recon', m: 'GET', p: '/v1/recon-ground-truth/candidates', g: 'admin', zh: '管理员复盘测试候选池', en: 'Admin recon-test candidate pool' },
  { d: 'recon', m: 'GET', p: '/v1/recon-ground-truth/:reconId', g: 'admin', zh: '候选完整性检查与规范化预览', en: 'Candidate completeness check and normalized preview' },
  { d: 'recon', m: 'PUT', p: '/v1/recon-ground-truth/:reconId', g: 'admin', zh: '保存采用、讨论或不采用决定', en: 'Save include, discuss or reject decision' },

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
  { d: 'alg', m: 'GET', p: '/v1/alg/lsll/case/:key', g: 'public', c: 'cdn', zh: 'LSLL case 的整方 HTM 最优解;未回填返 pending', en: 'Whole-cube HTM-optimal solution for an LSLL case; pending until backfilled' },
  { d: 'alg', m: 'GET', p: '/v1/alg/lsll/dist', g: 'public', c: 'cdn', zh: 'LSLL 最优步数直方图 + 覆盖数', en: 'LSLL optimal-length histogram and coverage' },
  { d: 'alg', m: 'GET', p: '/v1/alg/:puzzle/:set/submissions', g: 'public', zh: '用户投稿的公式', en: 'User-submitted algs' },
  { d: 'alg', m: 'POST', p: '/v1/alg/:puzzle/:set/:case/submit', g: 'login', zh: '提交公式投稿', en: 'Submit an alg' },
  { d: 'alg', m: 'PUT', p: '/v1/alg/submissions/:id', g: 'admin', zh: '编辑投稿', en: 'Edit submission' },
  { d: 'alg', m: 'DELETE', p: '/v1/alg/submissions/:id', g: 'admin', zh: '删除投稿', en: 'Delete submission' },
  { d: 'alg', m: 'GET', p: '/v1/alg/submissions/admin/unread', g: 'admin', zh: '未读投稿', en: 'Unread submissions' },
  { d: 'alg', m: 'GET', p: '/v1/alg/submissions/admin/recent', g: 'admin', zh: '最近投稿', en: 'Recent submissions' },
  { d: 'alg', m: 'POST', p: '/v1/alg/submissions/admin/seen', g: 'admin', zh: '标记已读', en: 'Mark seen' },
  { d: 'alg', m: 'GET', p: '/v1/alg/marks', g: 'login', zh: '跨 set 标记聚合(进度总览)', en: 'Cross-set mark summary' },
  { d: 'alg', m: 'GET', p: '/v1/alg/marks/:puzzle/:set', g: 'login', zh: '我的 case 学习标记', en: 'My case learning marks' },
  { d: 'alg', m: 'PUT', p: '/v1/alg/marks/:puzzle/:set', g: 'login', zh: '批量写 case 标记', en: 'Bulk-write case marks' },
  { d: 'alg', m: 'GET', p: '/v1/alg/time-attack-order/:puzzle/:set', g: 'login', zh: '我的公式连拧顺序', en: 'My algorithm time attack order' },
  { d: 'alg', m: 'PUT', p: '/v1/alg/time-attack-order/:puzzle/:set', g: 'login', zh: '保存公式连拧顺序', en: 'Save an algorithm time attack order' },
  { d: 'alg', m: 'GET', p: '/v1/alg/preferred-algs/:puzzle/:set', g: 'login', zh: '我的主公式偏好', en: 'My primary algorithm preferences' },
  { d: 'alg', m: 'PUT', p: '/v1/alg/preferred-algs/:puzzle/:set', g: 'login', zh: '保存主公式偏好', en: 'Save primary algorithm preferences' },
  { d: 'alg', m: 'GET', p: '/v1/alg/srs', g: 'login', zh: '跨 set 记忆记录 + 每日复习量(进度总览)', en: 'Cross-set memory records + daily review log' },
  { d: 'alg', m: 'GET', p: '/v1/alg/srs/:puzzle/:set', g: 'login', zh: '我的 case 记忆调度状态', en: 'My per-case memory schedule' },
  { d: 'alg', m: 'PUT', p: '/v1/alg/srs/:puzzle/:set', g: 'login', zh: '批量写记忆调度状态', en: 'Bulk-write memory schedule' },
  { d: 'alg', m: 'PUT', p: '/v1/alg/srs/daily', g: 'login', zh: '合并每日复习量(同日取较大值)', en: 'Merge daily review counts (per-day max)' },
  { d: 'alg', m: 'DELETE', p: '/v1/alg/srs/daily', g: 'login', zh: '清空复习日历(重置全部进度)', en: 'Clear the review calendar (full progress reset)' },
  { d: 'alg', m: 'GET', p: '/v1/alg/sweep', g: 'login', zh: '跨 set 的「过遍」进度(哪些范围整轮过完了 + 停在哪)', en: 'Cross-set sweep progress (which scopes are done, and where you stopped)' },
  { d: 'alg', m: 'GET', p: '/v1/alg/sweep/:puzzle/:set', g: 'login', zh: '这一套的过遍进度 + 游标', en: 'This set’s sweep progress and cursor' },
  { d: 'alg', m: 'PUT', p: '/v1/alg/sweep/:puzzle/:set', g: 'login', zh: '写过遍进度:遍数逐范围取 max,游标按时间戳 LWW', en: 'Write sweep progress: counts merge per scope by max, cursor by last-write-wins' },
  { d: 'alg', m: 'POST', p: '/v1/alg/sweep/:puzzle/:set/fold', g: 'login', zh: '整轮过完后折叠:删这批 case 的记忆排期,有手动标记的一律留着', en: 'Fold a finished round: drop those cases’ memory schedules, always keeping anything marked by hand' },
  { d: 'alg', m: 'GET', p: '/v1/progress/:algSetId', g: 'login', zh: '读取训练进度', en: 'Read training progress' },
  { d: 'alg', m: 'POST', p: '/v1/progress/:algSetId', g: 'login', zh: '保存训练进度', en: 'Save training progress' },
  { d: 'alg', m: 'POST', p: '/v1/trainer/rooms', g: 'public', zh: '建协同房间(多设备复习分工),返回房间码', en: 'Create a coop room (multi-device recap split); returns a room code' },
  { d: 'alg', m: 'GET', p: '/v1/trainer/rooms/:code', g: 'public', zh: '房间状态(合并进度 / 当前轮)', en: 'Room status (combined progress / current round)' },
  { d: 'alg', m: 'POST', p: '/v1/trainer/rooms/:code/claim', g: 'public', zh: '原子领取下一题(不重不漏)', en: 'Atomically claim the next case (no overlap/gaps)' },
  { d: 'alg', m: 'POST', p: '/v1/trainer/rooms/:code/next-round', g: 'public', zh: '开下一轮(CAS,只第一个推进)', en: 'Start the next round (CAS; only the first advances)' },

  // ---- teaching-saas ----
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations', g: 'login', c: 'no-store', zh: '列出当前账号加入的机构', en: 'List organizations joined by the current account' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/me/learning-contexts', g: 'login', c: 'no-store', zh: '跨机构列出当前账号可用的学员与监护身份，不返回站内账号标识', en: 'List the signed-in account\'s learner and guardian contexts across organizations without exposing account identifiers' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations', g: 'login', c: 'no-store', zh: '创建机构并成为首位所有者，要求幂等键', en: 'Create an organization as its first owner; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug', g: 'login', c: 'no-store', zh: '读取有成员权限的机构', en: 'Read an organization where the account is a member' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/summary', g: 'login', c: 'no-store', zh: '读取按角色裁剪的机构聚合统计', en: 'Read role-filtered organization summary counts' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/members', g: 'login', c: 'no-store', zh: '按机构角色分页读取成员', en: 'List paginated members under organization-role authorization' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/members', g: 'login', c: 'no-store', zh: '按机构角色添加成员，要求幂等键', en: 'Add a member under organization-role authorization; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/students', g: 'login', c: 'no-store', zh: '按机构范围分页读取学员', en: 'List paginated students scoped to an organization' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/students', g: 'login', c: 'no-store', zh: '按机构权限创建学员，要求幂等键', en: 'Create a student under organization authorization; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/me/students', g: 'login', c: 'no-store', zh: '列出当前账号在指定机构内可作为学员本人或监护人访问的学员身份', en: 'List student identities accessible to the signed-in account as the learner or a guardian in the specified organization' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/students/:studentId/account-binding-invites', g: 'login', c: 'no-store', zh: '机构管理员签发一次性学员账号绑定口令；原始口令仅在本次响应返回，不进入通用幂等缓存', en: 'Issue a one-time student account-binding token; the raw token is returned only in this response and never enters generic idempotency storage' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/students/:studentId/account-binding-invite', g: 'login', c: 'no-store', zh: '机构管理员查看学员当前仍有效的待绑定邀请；没有时返回空值', en: 'Read the student\'s current unexpired pending account-binding invite, or null when none is available' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/students/:studentId/account-binding-invites/:inviteId/revoke', g: 'login', c: 'no-store', zh: '机构管理员幂等撤销待绑定邀请；需 Idempotency-Key', en: 'Idempotently revoke a pending account-binding invite; requires Idempotency-Key' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/me/student-account-binding/preview', g: 'login', c: 'no-store', zh: '当前登录账号仅按口令哈希预览机构、学员和到期时间；不可用口令统一返回 404', en: 'Preview the organization, student, and expiry by token hash only; unavailable tokens uniformly return 404' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/me/student-account-binding/consume', g: 'login', c: 'no-store', zh: '用户明确确认预览后，当前登录账号通过口令原子绑定学员身份；服务端仅按口令哈希查询。已绑定身份的更换需后续专门的管理员修复流程', en: 'After explicit preview confirmation, atomically bind the signed-in account using a hash-only token lookup. Replacing an existing binding requires a future dedicated administrator repair flow' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/students/:studentId/guardian-links/:guardianLinkId/account-binding-invites', g: 'login', c: 'no-store', zh: '机构管理员为未绑定账号的有效监护关系签发一次性口令；原始口令仅在本次响应返回', en: 'Issue a one-time token for an active guardian relationship without an account; the raw token is returned only in this response' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/students/:studentId/guardian-links/:guardianLinkId/account-binding-invite', g: 'login', c: 'no-store', zh: '机构管理员查看监护关系当前仍有效的待绑定邀请；没有时返回空值', en: 'Read the guardian relationship\'s current unexpired pending account-binding invite, or null when none is available' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/students/:studentId/guardian-links/:guardianLinkId/account-binding-invites/:inviteId/revoke', g: 'login', c: 'no-store', zh: '机构管理员幂等撤销监护账号待绑定邀请；需 Idempotency-Key', en: 'Idempotently revoke a pending guardian account-binding invite; requires Idempotency-Key' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/me/guardian-account-binding/preview', g: 'login', c: 'no-store', zh: '当前登录账号仅按口令哈希预览机构、学员、监护关系和到期时间；不可用口令统一返回 404', en: 'Preview the organization, student, guardian relationship, and expiry by token hash only; unavailable tokens uniformly return 404' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/me/guardian-account-binding/consume', g: 'login', c: 'no-store', zh: '用户确认预览后，通过口令原子绑定当前账号与监护关系；相同账号重试可安全复用结果', en: 'After preview confirmation, atomically bind the signed-in account to the guardian relationship with safe same-account replay' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/me/training/assignments', g: 'login', c: 'no-store', zh: '读取当前登录账号在指定机构绑定学员的训练任务快照', en: 'List training assignment snapshots for the student bound to the signed-in account in the specified organization' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/me/training/evidence', g: 'login', c: 'no-store', zh: '提交当前绑定学员的自报训练证据；身份、机构、可信等级和本地日期均由服务端派生', en: 'Submit self-reported evidence for the currently bound student; identity, organization, trust level, and local date are server-derived' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/me/students/:studentId/weekly-reports', g: 'login', c: 'no-store', zh: '按当前学员或监护关系分页读取可见的已发布周报，并按身份裁剪反馈聚合', en: 'List visible published weekly reports for the current learner or guardian relationship with role-filtered feedback aggregates' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/me/students/:studentId/weekly-reports/:reportId', g: 'login', c: 'no-store', zh: '读取当前学员或监护关系可见的已发布周报详情，并隐藏内部与账号字段', en: 'Read a published weekly report visible to the current learner or guardian relationship while omitting internal and account fields' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/me/students/:studentId/lesson-feedback', g: 'login', c: 'no-store', zh: '按当前学员或监护关系分页读取每堂课最新一版可见的已发布对外反馈，不返回内部备注', en: 'List the latest visible published outward feedback per session for the current learner or guardian relationship without internal notes' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/training/templates', g: 'login', c: 'no-store', zh: '分页读取机构训练模板', en: 'List organization training templates with pagination' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/training/templates', g: 'login', c: 'no-store', zh: '创建机构训练模板，要求幂等键', en: 'Create an organization training template; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/training/templates/:templateId', g: 'login', c: 'no-store', zh: '读取机构训练模板详情', en: 'Read an organization training template' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/training/templates/:templateId/versions', g: 'login', c: 'no-store', zh: '分页读取训练模板的不可变版本', en: 'List immutable training-template versions with pagination' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/training/templates/:templateId/versions', g: 'login', c: 'no-store', zh: '发布新的训练模板版本，要求幂等键', en: 'Publish a new training-template version; requires an idempotency key' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/training/templates/:templateId/archive', g: 'login', c: 'no-store', zh: '不可逆归档训练模板，要求幂等键', en: 'Terminally archive a training template; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/training/assignments', g: 'login', c: 'no-store', zh: '分页读取当前角色范围内的训练任务', en: 'List training assignments within the caller\'s current scope' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/training/assignments', g: 'login', c: 'no-store', zh: '创建完整训练任务草稿，要求幂等键', en: 'Create a complete training-assignment draft; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/training/assignments/:assignmentId', g: 'login', c: 'no-store', zh: '读取当前角色范围内的训练任务详情', en: 'Read a training assignment within the caller\'s current scope' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/training/assignments/:assignmentId/revise', g: 'login', c: 'no-store', zh: '完整替换训练任务草稿，要求幂等键', en: 'Completely replace a training-assignment draft; requires an idempotency key' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/training/assignments/:assignmentId/publish', g: 'login', c: 'no-store', zh: '按发布时有效范围展开并冻结学员目标，要求幂等键', en: 'Publish and materialize the exact active-student target set; requires an idempotency key' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/training/assignments/:assignmentId/close', g: 'login', c: 'no-store', zh: '关闭已发布训练任务，要求幂等键', en: 'Close a published training assignment; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/training/assignments/:assignmentId/targets', g: 'login', c: 'no-store', zh: '分页读取当前角色可见的任务目标', en: 'List assignment targets filtered to the caller\'s current scope' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/training/assignments/:assignmentId/targets/:studentId/evidence', g: 'login', c: 'no-store', zh: '分页读取当前负责学员关联的原始训练证据', en: 'List linked raw evidence for a currently scoped student target' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/training/assignments/:assignmentId/targets/:studentId/reviews', g: 'login', c: 'no-store', zh: '分页读取当前负责学员的不可变批改版本', en: 'List immutable review revisions for a currently scoped student target' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/training/assignments/:assignmentId/targets/:studentId/reviews', g: 'login', c: 'no-store', zh: '追加学员任务批改版本，要求幂等键', en: 'Append a student-target review revision; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/students/:studentId', g: 'login', c: 'no-store', zh: '读取机构管理员可见或老师当前负责范围内的学员', en: 'Read a student visible to tenant administrators or within the teacher\'s current scope' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/campuses', g: 'login', c: 'no-store', zh: '分页读取机构校区；老师仅能看到当前负责班级所在校区', en: 'List tenant campuses with teachers limited to campuses of currently assigned groups' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/campuses', g: 'login', c: 'no-store', zh: '创建机构校区，要求幂等键', en: 'Create a tenant campus; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/campuses/:campusId', g: 'login', c: 'no-store', zh: '读取有权访问的校区', en: 'Read a campus within the caller\'s resource scope' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/campuses/:campusId/archive', g: 'login', c: 'no-store', zh: '不可逆归档没有活动班级的校区，要求幂等键', en: 'Terminally archive a campus with no active groups; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/groups', g: 'login', c: 'no-store', zh: '分页读取班级；老师仅能看到当前负责的班级', en: 'List groups with teachers limited to their current assignments' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/groups', g: 'login', c: 'no-store', zh: '创建班级并可关联校区，要求幂等键', en: 'Create a group with an optional campus; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/groups/:groupId', g: 'login', c: 'no-store', zh: '读取有权访问的班级', en: 'Read a group within the caller\'s resource scope' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/groups/:groupId/archive', g: 'login', c: 'no-store', zh: '不可逆归档没有活动关系的班级，要求幂等键', en: 'Terminally archive a group with no active relations; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/groups/:groupId/students', g: 'login', c: 'no-store', zh: '分页读取班级学员关系；老师仅能读取当前负责班级的当前学员', en: 'List group memberships with teachers limited to current students in currently assigned groups' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/groups/:groupId/students', g: 'login', c: 'no-store', zh: '新增不重叠的学员班级有效期关系，要求幂等键', en: 'Create a non-overlapping effective-dated student membership; requires an idempotency key' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/student-group-memberships/:membershipId/revoke', g: 'login', c: 'no-store', zh: '结束或取消学员班级关系，要求幂等键', en: 'End or cancel a student-group membership; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/teacher-assignments', g: 'login', c: 'no-store', zh: '按单个班级或学员分页读取负责人历史', en: 'List teacher-assignment history for exactly one group or student' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/teacher-assignments', g: 'login', c: 'no-store', zh: '为班级或个别学员分配负责人，要求幂等键', en: 'Assign a teacher to one group or individual student; requires an idempotency key' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/teacher-assignments/:assignmentId/revoke', g: 'login', c: 'no-store', zh: '结束或取消负责人关系，要求幂等键', en: 'End or cancel a teacher assignment; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/package-products', g: 'login', c: 'no-store', zh: '分页读取机构课包产品', en: 'List organization package products with pagination' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/package-products', g: 'login', c: 'no-store', zh: '创建课包产品，要求幂等键', en: 'Create a package product; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/students/:studentId/packages', g: 'login', c: 'no-store', zh: '分页读取学员课包和流水汇总余额', en: 'List a student\'s packages with ledger-derived balances' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/students/:studentId/packages', g: 'login', c: 'no-store', zh: '发放学员课包并记录初始课时流水，要求幂等键', en: 'Issue a student package and its opening credit entry; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/student-packages/:studentPackageId/ledger', g: 'login', c: 'no-store', zh: '分页读取学员课包的不可变课时流水', en: 'List an immutable student-package credit ledger with pagination' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/sessions', g: 'login', c: 'no-store', zh: '分页读取机构课堂', en: 'List organization sessions with pagination' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/sessions', g: 'login', c: 'no-store', zh: '排课并可同时建立预期考勤，要求幂等键', en: 'Schedule a session and optionally create expected attendance; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/sessions/:sessionId', g: 'login', c: 'no-store', zh: '读取课堂、教师快照与考勤明细', en: 'Read a session with teacher snapshots and attendance details' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/batch', g: 'login', c: 'no-store', zh: '按考勤记录 ID 批量更新到课状态，要求幂等键', en: 'Batch-update attendance statuses by attendance-record ID; requires an idempotency key' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/sessions/:sessionId/complete', g: 'login', c: 'no-store', zh: '同一事务完成课堂并扣减到课课时，要求幂等键', en: 'Complete a session and consume attended credits atomically; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/sessions/:sessionId/feedback', g: 'login', c: 'no-store', zh: '分页读取已完课课堂的学员反馈修订历史', en: 'List per-student feedback revisions for a completed session' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/sessions/:sessionId/students/:studentId/feedback', g: 'login', c: 'no-store', zh: '为已完课课堂追加一版学员反馈，要求幂等键', en: 'Append a student feedback revision for a completed session; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/weekly-reports', g: 'login', c: 'no-store', zh: '分页读取当前角色范围内的学员周报修订', en: 'List weekly-report revisions within the caller\'s current student scope' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/weekly-reports/generate', g: 'login', c: 'no-store', zh: '生成或重算学员周报草稿，要求幂等键', en: 'Generate or recompute a student weekly-report draft; requires an idempotency key' },
  { d: 'teaching-saas', m: 'GET', p: '/v1/teaching/organizations/:orgSlug/weekly-reports/:reportId', g: 'login', c: 'no-store', zh: '读取当前角色范围内的周报聚合快照', en: 'Read a weekly-report aggregate snapshot within the caller\'s current student scope' },
  { d: 'teaching-saas', m: 'POST', p: '/v1/teaching/organizations/:orgSlug/weekly-reports/:reportId/publish', g: 'login', c: 'no-store', zh: '以总结、下周计划与可见性发布并冻结周报，要求幂等键', en: 'Publish and freeze a weekly report with summary, next-week plan, and visibility; requires an idempotency key' },

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
  { d: 'notification', m: 'GET', p: '/v1/notifications/prefs', g: 'login', zh: '邮件通知开关', en: 'Email-notification preference' },
  { d: 'notification', m: 'PUT', p: '/v1/notifications/prefs', g: 'login', zh: '开 / 关邮件通知', en: 'Toggle email notifications' },
  { d: 'notification', m: 'GET', p: '/v1/notifications/unsubscribe', g: 'public', zh: '邮件退订(签名令牌,免登录,回确认页)', en: 'Unsubscribe via signed token (no login, HTML page)' },
  { d: 'notification', m: 'POST', p: '/v1/notifications/unsubscribe', g: 'public', zh: '一键退订(RFC 8058,邮件客户端调)', en: 'One-click unsubscribe (RFC 8058)' },

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
  { d: 'forum', m: 'GET', p: '/v1/forum/review', g: 'admin', zh: '待审核队列(新用户主题 + 回帖)', en: 'Review queue (new users’ threads + replies)' },

  // ---- collaborative documents ----
  { d: 'documents', m: 'GET', p: '/v1/documents', g: 'login', c: 'no-store', zh: '按 kind 查询我的协作文档或表格', en: 'List my collaborative docs or sheets by kind' },
  { d: 'documents', m: 'POST', p: '/v1/documents', g: 'admin', c: 'no-store', zh: '新建协作文档或表格，可附初始表格数据', en: 'Create a collaborative document or spreadsheet, optionally with initial sheet data' },
  { d: 'documents', m: 'POST', p: '/v1/documents/import', g: 'admin', c: 'no-store', zh: '把 DOCX 导入协作文档', en: 'Import a DOCX as a collaborative document' },
  { d: 'documents', m: 'GET', p: '/v1/documents/people', g: 'login', c: 'no-store', zh: '搜索可邀请的站内用户', en: 'Search registered users to invite' },
  { d: 'documents', m: 'GET', p: '/v1/documents/:id', g: 'login', c: 'no-store', zh: '文档元数据、本人权限与成员', en: 'Document metadata, my role, and members' },
  { d: 'documents', m: 'PATCH', p: '/v1/documents/:id', g: 'login', c: 'no-store', zh: '所有者或管理员修改文档标题', en: 'Owner or admin updates the document title' },
  { d: 'documents', m: 'PUT', p: '/v1/documents/:id/subscription', g: 'login', c: 'no-store', zh: '订阅或取消订阅协作资源修改', en: 'Subscribe or unsubscribe from collaborative-resource changes' },
  { d: 'documents', m: 'POST', p: '/v1/documents/:id/seen', g: 'login', c: 'no-store', zh: '记录本人最后查看时间', en: 'Record the current user’s last-seen timestamp' },
  { d: 'documents', m: 'POST', p: '/v1/documents/:id/members', g: 'login', c: 'no-store', zh: '所有者或管理员添加成员', en: 'Owner or admin adds a member' },
  { d: 'documents', m: 'PATCH', p: '/v1/documents/:id/members/:userKey', g: 'login', c: 'no-store', zh: '所有者或管理员修改成员权限', en: 'Owner or admin changes a member role' },
  { d: 'documents', m: 'DELETE', p: '/v1/documents/:id/members/:userKey', g: 'login', c: 'no-store', zh: '所有者或管理员移除成员', en: 'Owner or admin removes a member' },
  { d: 'documents', m: 'GET', p: '/v1/documents/realtime', g: 'login', c: 'no-store', zh: 'Yjs 实时协作 WebSocket', en: 'Yjs real-time collaboration WebSocket' },
  { d: 'forum', m: 'POST', p: '/v1/forum/review/:type/:id/:action', g: 'admin', zh: '审核:通过 / 驳回(thread|post,驳回可附原因)', en: 'Moderate: approve / reject (thread|post, optional reject reason)' },

  // ---- quiz 社区题(登录用户出题,直接上线 + 举报) ----
  { d: 'quiz', m: 'GET', p: '/v1/quiz/questions', g: 'public', c: 'short', zh: '某一档的全部已发布社区题', en: 'Published community questions at one level' },
  { d: 'quiz', m: 'GET', p: '/v1/quiz/mine', g: 'login', c: 'no-store', zh: '我出的题(含被下架的,带理由)', en: 'My questions (including taken-down ones, with the reason)' },
  { d: 'quiz', m: 'POST', p: '/v1/quiz/questions', g: 'login', zh: '出一道题,直接上线(每人每日 30 道)', en: 'Write a question — live immediately (30/day per person)' },
  { d: 'quiz', m: 'PATCH', p: '/v1/quiz/questions/:id', g: 'login', zh: '改题:作者改自己的;管理员可补译 / 下架', en: 'Edit: authors their own; admins can translate or take down' },
  { d: 'quiz', m: 'DELETE', p: '/v1/quiz/questions/:id', g: 'login', zh: '删题:作者删自己的,管理员删任意', en: 'Delete: authors their own, admins any' },
  { d: 'quiz', m: 'POST', p: '/v1/quiz/questions/:id/report', g: 'login', zh: '举报一道题(一人一题一条,推送给管理员)', en: 'Report a question (one per person, pushed to admins)' },
  { d: 'quiz', m: 'GET', p: '/v1/quiz/admin/questions', g: 'admin', c: 'no-store', zh: '全部社区题(含已下架)', en: 'All community questions, taken-down included' },
  { d: 'quiz', m: 'GET', p: '/v1/quiz/admin/reports', g: 'admin', c: 'no-store', zh: '举报列表(默认只看待处理)', en: 'Reports (open ones by default)' },
  { d: 'quiz', m: 'POST', p: '/v1/quiz/admin/reports/:id/resolve', g: 'admin', zh: '标记举报已处理', en: 'Mark report resolved' },

  // ---- wechat ----
  { d: 'wechat', m: 'GET', p: '/v1/wechat/jssdk-signature', g: 'public', zh: '微信 JS-SDK wx.config 签名(朋友圈/会话分享卡片;未配公众号返回 disabled)', en: 'WeChat JS-SDK wx.config signature (Moments/chat share card; returns disabled when the MP account is unconfigured)' },

  // ---- content ----
  { d: 'content', m: 'GET', p: '/v1/teachers', g: 'public', c: 'cdn', zh: '魔方老师与培训机构目录', en: 'Cube teacher and training-school directory' },
  { d: 'content', m: 'GET', p: '/v1/teachers/mine', g: 'login', c: 'no-store', zh: '我发布的老师与机构资料', en: 'Teacher and school profiles I published' },
  { d: 'content', m: 'POST', p: '/v1/teachers', g: 'login', zh: '发布老师或机构资料', en: 'Publish a teacher or school profile' },
  { d: 'content', m: 'PUT', p: '/v1/teachers/:id', g: 'login', zh: '作者改自己的资料,管理员可改任意资料', en: 'Authors edit their own profiles; admins edit any' },
  { d: 'content', m: 'DELETE', p: '/v1/teachers/:id', g: 'login', zh: '作者删自己的资料,管理员可删任意资料', en: 'Authors delete their own profiles; admins delete any' },
  { d: 'content', m: 'GET', p: '/v1/teaching/advanced', g: 'public', c: 'no-store', zh: 'CFOP 后续三阶与二阶课程', en: 'Post-CFOP 3×3 and 2×2 lessons' },
  { d: 'content', m: 'POST', p: '/v1/teaching/advanced', g: 'admin', c: 'no-store', zh: '新增一节后续课程', en: 'Add a further-course lesson' },
  { d: 'content', m: 'PUT', p: '/v1/teaching/advanced/reorder', g: 'admin', c: 'no-store', zh: '调整一条课程路线的顺序', en: 'Reorder one course track' },
  { d: 'content', m: 'PUT', p: '/v1/teaching/advanced/:id', g: 'admin', c: 'no-store', zh: '修改后续课程标题、说明和时长', en: 'Edit a further-course title, notes, and duration' },
  { d: 'content', m: 'DELETE', p: '/v1/teaching/advanced/:id', g: 'admin', c: 'no-store', zh: '删除一节后续课程', en: 'Delete a further-course lesson' },
  { d: 'content', m: 'GET', p: '/v1/teaching/trial', g: 'public', c: 'no-store', zh: '试听课双语内容覆盖与英文待同步状态', en: 'Bilingual trial-lesson overrides and English sync status' },
  { d: 'content', m: 'PUT', p: '/v1/teaching/trial/:lessonId', g: 'admin', c: 'no-store', zh: '修改试听课中文内容并标记英文待同步', en: 'Edit Chinese trial-lesson content and mark its English as stale' },
  { d: 'content', m: 'PUT', p: '/v1/teaching/trial/:lessonId/english', g: 'admin', c: 'no-store', zh: '由 AI 回写试听课英文并完成同步', en: 'Let AI write back a trial lesson’s English translation and complete the sync' },
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
  { d: 'content', m: 'GET', p: '/v1/contributors', g: 'public', c: 'cdn', zh: '贡献者名单(score 降序)', en: 'Contributors wall (by score)' },
  { d: 'content', m: 'POST', p: '/v1/contributors', g: 'admin', zh: '加贡献者', en: 'Add contributor' },
  { d: 'content', m: 'PUT', p: '/v1/contributors/:id', g: 'admin', zh: '改贡献者', en: 'Edit contributor' },
  { d: 'content', m: 'POST', p: '/v1/contributors/:id/bump', g: 'admin', zh: '贡献次数 +1', en: 'Bump score +1' },
  { d: 'content', m: 'DELETE', p: '/v1/contributors/:id', g: 'admin', zh: '删贡献者', en: 'Delete contributor' },
  { d: 'content', m: 'GET', p: '/v1/ops/commands', g: 'public', zh: '运维命令手册', en: 'Ops runbook commands' },
  { d: 'content', m: 'POST', p: '/v1/ops/commands', g: 'admin', zh: '加命令', en: 'Add command' },
  { d: 'content', m: 'PUT', p: '/v1/ops/commands/reorder', g: 'admin', zh: '重排命令', en: 'Reorder commands' },
  { d: 'content', m: 'PUT', p: '/v1/ops/commands/:id', g: 'admin', zh: '改命令', en: 'Edit command' },
  { d: 'content', m: 'DELETE', p: '/v1/ops/commands/:id', g: 'admin', zh: '删命令', en: 'Delete command' },
  { d: 'content', m: 'GET', p: '/v1/page-notices', g: 'public', zh: '每页顶部通知条(enabled)', en: 'Per-page notice bars (enabled)' },
  { d: 'content', m: 'GET', p: '/v1/page-notices/manage', g: 'admin', zh: '全部通知(含停用)', en: 'All notices incl. disabled' },
  { d: 'content', m: 'PUT', p: '/v1/page-notices', g: 'admin', zh: '按路径新增/编辑通知', en: 'Upsert notice by path' },
  { d: 'content', m: 'DELETE', p: '/v1/page-notices/:id', g: 'admin', zh: '删通知', en: 'Delete notice' },
  { d: 'content', m: 'GET', p: '/v1/pattern-examples', g: 'public', zh: '图案搜索示例预设', en: 'Pattern-search example presets' },
  { d: 'content', m: 'POST', p: '/v1/pattern-examples', g: 'admin', zh: '新增示例预设', en: 'Add example preset' },
  { d: 'content', m: 'PUT', p: '/v1/pattern-examples/reorder', g: 'admin', zh: '示例重排', en: 'Reorder examples' },
  { d: 'content', m: 'PUT', p: '/v1/pattern-examples/:id', g: 'admin', zh: '编辑示例预设', en: 'Edit example preset' },
  { d: 'content', m: 'DELETE', p: '/v1/pattern-examples/:id', g: 'admin', zh: '删示例预设', en: 'Delete example preset' },
  { d: 'content', m: 'GET', p: '/v1/sim-masks', g: 'public', zh: '/sim 遮罩清单的管理员覆盖层 + 自建遮罩', en: '/sim mask-list overrides and admin-built masks' },
  { d: 'content', m: 'PUT', p: '/v1/sim-masks', g: 'admin', zh: '按 maskKey upsert(改名 / 显隐 / 存自建遮罩)', en: 'Upsert by maskKey (label, visibility, custom mask)' },
  { d: 'content', m: 'PUT', p: '/v1/sim-masks/reorder', g: 'admin', zh: '遮罩重排(该阶全量 keys)', en: 'Reorder masks (all keys of that cube size)' },
  { d: 'content', m: 'DELETE', p: '/v1/sim-masks/:key', g: 'admin', zh: '删覆盖行:内置=恢复默认,自建=删遮罩', en: 'Delete a row: builtin = reset to default, custom = delete mask' },
  { d: 'content', m: 'GET', p: '/v1/paint/drawings', g: 'login', zh: '我的矢量画作', en: 'My paint drawings' },
  { d: 'content', m: 'GET', p: '/v1/paint/drawings/:id', g: 'public', zh: '单个画作', en: 'Single drawing' },
  { d: 'content', m: 'POST', p: '/v1/paint/drawings', g: 'login', zh: '保存画作', en: 'Save drawing' },
  { d: 'content', m: 'PUT', p: '/v1/paint/drawings/:id', g: 'login', zh: '更新画作', en: 'Update drawing' },
  { d: 'content', m: 'DELETE', p: '/v1/paint/drawings/:id', g: 'login', zh: '删画作', en: 'Delete drawing' },

  // ---- timer ----
  { d: 'timer', m: 'GET', p: '/v1/timer/backup', g: 'login', zh: '取计时器云备份', en: 'Fetch timer backup' },
  { d: 'timer', m: 'POST', p: '/v1/timer/backup', g: 'login', zh: '上传计时器备份', en: 'Upload timer backup' },
  { d: 'timer', m: 'DELETE', p: '/v1/timer/backup', g: 'login', zh: '删除备份', en: 'Delete backup' },
  { d: 'timer', m: 'GET', p: '/v1/timer/presence', g: 'admin', c: 'no-store', zh: '管理员读取当前计时人数、账号、成绩、IP 与智能魔方设备', en: 'Admin live timer users, accounts, results, IPs, and smart-cube devices' },
  { d: 'timer', m: 'POST', p: '/v1/timer/presence', g: 'public', c: 'no-store', zh: '计时页短期心跳（登录可选，最多 4 人）', en: 'Short-lived timer heartbeat (optional login, up to four people)' },
  { d: 'smart-cube', m: 'GET', p: '/v1/smart-cube/relay', g: 'public', c: 'no-store', zh: '小程序原生蓝牙与网站计时器之间的临时 WebSocket 中继', en: 'Ephemeral WebSocket relay between Mini Program native BLE and the web timer' },
  { d: 'timer', m: 'POST', p: '/v1/battle/rooms', g: 'public', zh: '建联机对战房间(多设备同打乱各自计时),返回房间码', en: 'Create an online battle room (multi-device, same scramble); returns a room code' },
  { d: 'timer', m: 'POST', p: '/v1/battle/rooms/:code/join', g: 'public', zh: '加入对战房间', en: 'Join a battle room' },
  { d: 'timer', m: 'GET', p: '/v1/battle/rooms/:code', g: 'public', c: 'no-store', zh: '房间状态轮询(带 pid 刷心跳)', en: 'Poll room state (pid refreshes heartbeat)' },
  { d: 'timer', m: 'POST', p: '/v1/battle/rooms/:code/status', g: 'public', zh: '上报实时状态(准备/观察中/计时中);全员准备即落同时起表时刻', en: 'Report live phase (ready/inspecting/solving); stamps the shared start once everyone is ready' },
  { d: 'timer', m: 'POST', p: '/v1/battle/rooms/:code/event', g: 'public', zh: '改自己项目(顺带 lazy 填该项目打乱)', en: 'Change own event (lazily fills that event’s scramble)' },
  { d: 'timer', m: 'POST', p: '/v1/battle/rooms/:code/scramble', g: 'public', zh: 'lazy 填某项目当前轮打乱(set-if-absent)', en: 'Lazily set an event’s scramble for this round (set-if-absent)' },
  { d: 'timer', m: 'POST', p: '/v1/battle/rooms/:code/result', g: 'public', zh: '交本轮成绩(重复交 = 改罚时)', en: 'Submit round result (resubmit = adjust penalty)' },
  { d: 'timer', m: 'POST', p: '/v1/battle/rooms/:code/next', g: 'public', zh: '开下一轮(CAS,服务端结算胜者)', en: 'Start next round (CAS; server settles the winner)' },
  { d: 'timer', m: 'POST', p: '/v1/battle/rooms/:code/settings', g: 'public', zh: '房主改房设(同时开始计时)', en: 'Host updates room settings (synchronized start)' },
  { d: 'timer', m: 'POST', p: '/v1/battle/rooms/:code/admin', g: 'public', zh: '房主转让给房里另一位玩家', en: 'Transfer host to another player in the room' },
  { d: 'timer', m: 'POST', p: '/v1/battle/rooms/:code/kick', g: 'public', zh: '房主把某位玩家移出房间', en: 'Host removes a player from the room' },
  { d: 'timer', m: 'POST', p: '/v1/battle/rooms/:code/leave', g: 'public', zh: '离开房间(空房即删)', en: 'Leave the room (empty room is deleted)' },
  { d: 'timer', m: 'GET', p: '/v1/video/config', g: 'public', c: 'no-store', zh: '本站是否启用视频通话 + 单房人数/码率上限', en: 'Whether video calling is enabled, plus per-room participant and bitrate caps' },
  { d: 'timer', m: 'POST', p: '/v1/video/token', g: 'public', c: 'no-store', zh: '换取对战房视频的 LiveKit 凭证(校验 pid 在房内 + 带宽预算)', en: 'Mint a LiveKit token for a battle room’s video (verifies the pid is in the room and the bandwidth budget allows it)' },

  // ---- calendar ----
  { d: 'calendar', m: 'GET', p: '/v1/calendar/bootstrap', g: 'login', c: 'no-store', zh: '首屏:我的日历列表 + 对外展示设置(首访自动建主日历)', en: 'First paint: my calendars + share settings (creates the default calendar on first visit)' },
  { d: 'calendar', m: 'POST', p: '/v1/calendar/calendars', g: 'login', zh: '新建日历', en: 'Create a calendar' },
  { d: 'calendar', m: 'PATCH', p: '/v1/calendar/calendars/:id', g: 'login', zh: '改日历名字 / 颜色 / 时区', en: 'Rename / recolour / re-zone a calendar' },
  { d: 'calendar', m: 'DELETE', p: '/v1/calendar/calendars/:id', g: 'login', zh: '删日历(主日历不可删)', en: 'Delete a calendar (not the default one)' },
  { d: 'calendar', m: 'GET', p: '/v1/calendar/events', g: 'login', c: 'no-store', zh: '窗口内事件(含受邀的);重复事件整取,由前端展开', en: 'Events in a window (invitations included); recurring masters are returned whole and expanded client-side' },
  { d: 'calendar', m: 'POST', p: '/v1/calendar/events', g: 'login', zh: '新建日程', en: 'Create an event' },
  { d: 'calendar', m: 'PATCH', p: '/v1/calendar/events/:id', g: 'login', zh: '改日程,?scope=this|following|all 决定动这一次 / 此后 / 整条序列', en: 'Edit an event; ?scope=this|following|all picks this occurrence, the tail, or the whole series' },
  { d: 'calendar', m: 'DELETE', p: '/v1/calendar/events/:id', g: 'login', zh: '删日程(同样分 scope)', en: 'Delete an event (same scopes)' },
  { d: 'calendar', m: 'POST', p: '/v1/calendar/events/bulk', g: 'login', zh: 'ICS 导入(一次最多 500 条;带 importId 归入某个批次)', en: 'ICS import (up to 500 at a time; importId files them under a batch)' },
  { d: 'calendar', m: 'POST', p: '/v1/calendar/imports', g: 'login', c: 'no-store', zh: '开一个导入批次 —— 一次导入跨很多请求,后面的建日历 / 塞事件都挂它的 id', en: 'Open an import batch — one import spans many requests, and every calendar created or event inserted afterwards carries its id' },
  { d: 'calendar', m: 'GET', p: '/v1/calendar/imports', g: 'login', c: 'no-store', zh: '最近 10 次导入,给「撤销」用', en: 'The last 10 imports, for the undo list' },
  { d: 'calendar', m: 'DELETE', p: '/v1/calendar/imports/:id', g: 'login', zh: '整批撤销:删掉那次导入的全部事件,以及它新建且此刻仍然空着的日历', en: 'Undo a whole import: delete every event it brought in, plus any calendar it created that is still empty' },
  { d: 'calendar', m: 'POST', p: '/v1/calendar/events/:id/rsvp', g: 'login', zh: '受邀者接受 / 拒绝', en: 'Guest accepts or declines' },
  { d: 'calendar', m: 'GET', p: '/v1/calendar/people', g: 'login', c: 'no-store', zh: '加嘉宾时的站内用户搜索', en: 'Site-user search for adding guests' },
  { d: 'calendar', m: 'GET', p: '/v1/calendar/export', g: 'login', c: 'no-store', zh: '导出自己的全部日程为 .ics', en: 'Export all my events as .ics' },
  { d: 'calendar', m: 'PUT', p: '/v1/calendar/share', g: 'login', zh: '对外展示设置(开关 / 完整或仅忙碌 / 参与展示的日历)', en: 'Share settings (on-off, full or busy-only, which calendars)' },
  { d: 'calendar', m: 'POST', p: '/v1/calendar/share/rotate', g: 'login', zh: '换一条分享链接,旧的立刻失效', en: 'Reset the share link, invalidating the old one' },
  { d: 'calendar', m: 'GET', p: '/v1/calendar/public/:token', g: 'public', c: 'no-store', zh: '公开读;busy 档在服务端就抹掉标题 / 说明 / 地点 / 参与者', en: 'Public read; at the busy level titles, notes, location and guests are stripped server-side' },
  { d: 'calendar', m: 'GET', p: '/v1/calendar/public/:token/ics', g: 'public', c: 'short', zh: '公开订阅源,Google / Apple 日历可直接订阅', en: 'Public subscription feed for Google / Apple Calendar' },

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
  login: { zh: '需带 CubeRoot 登录后的 Bearer JWT；教学平台也可由受信服务端桥接。', en: 'Requires a CubeRoot Bearer JWT; the teaching platform may also use its trusted server bridge.' },
  admin: { zh: '需 admin 凭据(X-Admin-Key 或管理员账号)。', en: 'Requires admin credentials (X-Admin-Key or an admin account).' },
  webhook: { zh: '仅供支付服务商服务端回调,带网关签名,前端不调。', en: 'Server-to-server payment callback, gateway-signed — not called by the client.' },
};

const CACHE_LABEL: Record<Cache, { zh: string; en: string }> = {
  cdn: { zh: 'CDN 可缓存', en: 'CDN cacheable' },
  short: { zh: '短缓存', en: 'short cache' },
  'no-store': { zh: '不缓存', en: 'no-store' },
};

const CACHE_NOTE: Record<Cache, { zh: string; en: string }> = {
  cdn: { zh: '天然不可变 / 慢变,nginx 走 s-maxage 长缓存,浏览器短缓存。', en: 'Immutable or slow-moving; long s-maxage at nginx, short browser cache.' },
  short: { zh: '会变但不急,几分钟的 max-age 就够,过期即回源。', en: 'Changes, but not urgently — a few minutes of max-age, then revalidate.' },
  'no-store': { zh: '暂态或写操作,发 no-store,从不缓存。', en: 'Transient or a write — sent no-store, never cached.' },
};

function pathParams(p: string): string[] {
  return (p.match(/:([a-zA-Z]+)/g) ?? []).map((s) => s.slice(1));
}

export default function ApiCatalogPage() {
  const { i18n } = useTranslation();
  const lang = (['en', 'zh'] as const)[Number(i18n.language.startsWith('zh'))];

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
          <Link href="/dev" className="api-back">← /dev</Link>
        </div>

        <header className="api-hero">
          <div className="api-eyebrow">{tr({ zh: 'REST 端点参考', en: 'REST endpoint reference' })}</div>
          <h1 className="api-title"><span className="api-title-slash">/</span>dev/api</h1>
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
          <Link href="/dev/architecture" className="api-foot-link">{tr({ zh: '架构总览 →', en: 'Architecture overview →' })}</Link>
        </footer>
      </div>
    </div>
  );
}
