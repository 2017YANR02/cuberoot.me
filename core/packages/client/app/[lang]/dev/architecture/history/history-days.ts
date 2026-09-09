import DAYS from '../timeline_commits.json';
import { EARLY_DESIGNS } from './history-designs-early';
import { MIDDLE_DESIGNS } from './history-designs-middle';
import { LATE_DESIGNS } from './history-designs-late';

// Short map annotations are condensed from the canonical daily changelog and TIMELINE.
const PLACES = [
  { date: '2026-09-01', zh: '藏于山中', en: 'A mountain keepsake',
    note: { zh: { title: '私密保险箱上线', detail: '抖音小程序与课程订单接入' }, en: { title: 'An encrypted private vault', detail: 'Douyin app target and course orders' } },
    caption: { zh: '保险箱化作山间藏阁，桥与门连接新的入口。', en: 'A hillside vault keeps its treasures; bridges and gates welcome new connections.' } },
  { date: '2026-09-02', zh: '水上有回声', en: 'Echoes on the water',
    note: { zh: { title: '全站音乐播放器上线', detail: '颜色训练、教学二维码卡片' }, en: { title: 'Music across the site', detail: 'Colour drills and teaching QR cards' } },
    caption: { zh: '音乐来到水亭，唱片与涟漪轻轻相和。', en: 'Music finds a waterside pavilion, where a record meets the ripples.' } },
  { date: '2026-09-03', zh: '天地有脉络', en: 'A world connected',
    note: { zh: { title: '架构交互地图展开', detail: '音乐上传、旧教程归档' }, en: { title: 'An interactive architecture map', detail: 'Music uploads and tutorial archives' } },
    caption: { zh: '交互地图成为立体沙盘，旧教程安放在书阁。', en: 'The architecture map becomes a miniature landscape beside an archive of tutorials.' } },
  { date: '2026-09-04', zh: '枫林留影', en: 'Memories in the maples',
    note: { zh: { title: '会员相册与枫叶教程上线', detail: '账号合并、个人纪录统计' }, en: { title: 'A photo gallery and Ivy lessons', detail: 'Account merging and PR streaks' } },
    caption: { zh: '相册展开成林间画廊，枫叶教程藏在树影里。', en: 'An album unfolds as a woodland gallery, with an Ivy tutorial among the leaves.' } },
  { date: '2026-09-05', zh: '走入另一重山', en: 'Through another world',
    note: { zh: { title: '三维空间上线', detail: '选手页加入个人纪录' }, en: { title: 'Step into the new 3D space', detail: 'Personal records on WCA profiles' } },
    caption: { zh: '三维空间打开一扇门，台阶通向悬浮的庭院。', en: 'The new 3D space opens a portal to a suspended courtyard.' } },
  { date: '2026-09-06', zh: '云间藏书', en: 'An archive in the clouds',
    note: { zh: { title: '云盘文件夹可以共享了', detail: '视频压缩、大满贯奖章' }, en: { title: 'Shared folders in Drive', detail: 'Video compression and grand slams' } },
    caption: { zh: '共享文件夹成为云中书架，奖章留在山路旁。', en: 'Shared folders become a cloud archive, with an achievement medal beside the path.' } },
  { date: '2026-09-07', zh: '江畔见新城', en: 'A city by the river',
    note: { zh: { title: '上海场景与成就图鉴上线', detail: '课程接入云盘视频与章节' }, en: { title: 'Shanghai and achievement medals', detail: 'Drive videos and course chapters' } },
    caption: { zh: '上海场景沿江展开，成就图鉴陈列在临水展馆。', en: 'Shanghai unfolds along the river, beside a gallery of achievements.' } },
  { date: '2026-09-08', zh: '一层一重天地', en: 'A world, layer by layer',
    note: { zh: { title: '层先法教程上线', detail: '成就里程碑、滨江灯光' }, en: { title: 'Interactive layer-by-layer guide', detail: 'Record milestones and riverside lights' } },
    caption: { zh: '层先法教程拾级而上，滨江灯火延续昨天的风景。', en: 'The layer-by-layer tutorial rises in terraces as riverside lights continue yesterday’s view.' } },
] as const;

// Only lightweight names reach the page; each date has its own explicitly authored sculpture.
const DESIGNS: Record<string, { zh: string; en: string }> = { ...EARLY_DESIGNS, ...MIDDLE_DESIGNS, ...LATE_DESIGNS };

function shortNote(text: string, limit: number) {
  const compact = text.trim();
  if (compact.length <= limit) return compact;
  const head = compact.slice(0, limit - 1);
  // Keep English words intact; the full original is always available in the reader.
  return `${/[a-z]$/i.test(head) ? head.replace(/\s+\S*$/, '') : head}…`;
}

// Editorial headings for records whose first sentence is too long to serve as a map label.
const HEADINGS: Record<string, { zh: string; en: string }> = {
  '2025-12-13': { zh: '项目诞生', en: 'The project begins' },
  '2026-05-21': { zh: '手机 App 脚手架搭起', en: 'A foundation for the mobile app' },
  '2026-05-22': { zh: '全站统一搜索上线', en: 'Unified site search' },
  '2026-05-26': { zh: '全站迁入 Next.js', en: 'The site moves to Next.js' },
  '2026-05-29': { zh: '分析器加入变体解法', en: 'Variant solutions in the analyzer' },
  '2026-05-30': { zh: '纪录快讯纳入中国纪录推断', en: 'Inferred Chinese records in the news' },
  '2026-06-02': { zh: '历史名人堂年度普查', en: 'A yearly hall-of-fame census' },
  '2026-06-07': { zh: '比赛结果与个人排名可以复制了', en: 'Copy competition names and PR ranks' },
  '2026-06-10': { zh: '阶段求解器扩充', en: 'More stage solvers' },
  '2026-06-20': { zh: '异形魔方求解器起步', en: 'Solvers for more puzzle shapes' },
  '2026-06-21': { zh: '立方体魔方求解器扩充', en: 'More cuboid solvers' },
  '2026-06-29': { zh: '官方规则全文镜像上线', en: 'The complete official regulations' },
  '2026-07-04': { zh: '内部账号与多身份绑定上线', en: 'Accounts with linked identities' },
  '2026-07-07': { zh: '复盘表单带出选手历史资料', en: 'Cuber history in the recon form' },
  '2026-07-09': { zh: '社区论坛上线', en: 'The community forum opens' },
  '2026-07-10': { zh: '复盘加入单轮均值与整解复制', en: 'Round averages and full-solve copying' },
  '2026-07-12': { zh: '模拟器手模精修', en: 'Refining the simulator’s hands' },
  '2026-07-14': { zh: '站内通知系统上线', en: 'In-site notifications arrive' },
  '2026-07-17': { zh: '跨公式集学习进度上线', en: 'Learning progress across alg sets' },
  '2026-07-18': { zh: '世界与国家排名接入实时纪录', en: 'Live records in world and national ranks' },
  '2026-07-20': { zh: '步数系数与批量求解上线', en: 'Move-count coefficients and batch solves' },
  '2026-07-21': { zh: '模拟器伴图由本站引擎绘制', en: 'Native rendering for simulator diagrams' },
  '2026-07-22': { zh: '伴图与 VisualCube 并排校准', en: 'Diagram comparison with VisualCube' },
  '2026-07-23': { zh: '跨设备在线对战房间上线', en: 'Battle rooms across devices' },
  '2026-07-24': { zh: '计时器接入更多蓝牙设备', en: 'More Bluetooth devices for the timer' },
  '2026-07-27': { zh: 'LSLL 最优解覆盖全部状态', en: 'Optimal LSLL solutions for every state' },
  '2026-07-28': { zh: '全站加载优化', en: 'Faster loading across the site' },
  '2026-08-01': { zh: '可分享日程与时区换算上线', en: 'Shared calendars and time-zone conversion' },
  '2026-08-02': { zh: '计时训练可以选择难度了', en: 'Choose a difficulty for timer training' },
  '2026-08-03': { zh: '日程加入 Google 日历导入', en: 'Google Calendar import' },
  '2026-08-05': { zh: '二阶公式工具接入站内', en: 'More 2×2 algorithm tools' },
  '2026-08-08': { zh: '复盘署名与成绩历史修正', en: 'Recon authorship and result-history fixes' },
  '2026-08-11': { zh: '最优求解加入入门阶段', en: 'Optimal solvers for beginner stages' },
  '2026-08-12': { zh: 'Android 应用加入离线计时', en: 'Offline timing in the Android app' },
  '2026-08-13': { zh: '课程平台与协作工具上线', en: 'Courses and collaborative tools launch' },
  '2026-08-14': { zh: '课程试听介绍支持后台编辑', en: 'Editable course previews' },
  '2026-08-16': { zh: '微信小程序复用网站计时器', en: 'The web timer in the WeChat Mini Program' },
  '2026-08-17': { zh: '教学平台加入班级与课次流程', en: 'Classes and lesson workflows' },
  '2026-08-20': { zh: '教学管理加入补课与经营概览', en: 'Make-up lessons and business overviews' },
  '2026-08-22': { zh: '教学平台并入主站', en: 'The teaching platform joins the main site' },
  '2026-08-25': { zh: '核心工作区按职责重组', en: 'Reorganizing the core workspace' },
};

function note(text: string, titleLimit: number, detailLimit: number, heading?: string) {
  const parts = text.split(/\s+\+\s*|\s*\+\s+|[；;]/).map(part => part.trim()).filter(Boolean);
  return { title: heading ?? shortNote(parts[0] ?? text, titleLimit), detail: shortNote(parts[1] ?? '', detailLimit) };
}

export const HISTORY_PLACES = DAYS.map((day, index) => {
  const authored = PLACES.findIndex(place => place.date === day.date);
  let seed = 2166136261;
  for (const char of day.date) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const design = authored >= 0 ? PLACES[authored] : DESIGNS[day.date];
  if (!design) throw new Error(`Missing history sculpture design for ${day.date}`);
  const motif = authored >= 0 ? authored : null;
  return {
    date: day.date, zh: design.zh, en: design.en,
    caption: authored >= 0 ? PLACES[authored].caption : null,
    note: { zh: note(day.zh, 24, 30, HEADINGS[day.date]?.zh), en: note(day.en, 58, 68, HEADINGS[day.date]?.en) },
    ...(authored >= 0 ? PLACES[authored] : {}),
    day, motif, seed, authored: authored >= 0,
    biome: authored >= 0 ? authored : (Math.floor(index / 3) * 5 + Math.floor(index / 24)) % 8,
  };
});
export const HISTORY_SPACING = 28;
export const HISTORY_LAST = HISTORY_PLACES.length - 1;

export function clampHistoryPosition(position: number): number {
  return Number.isFinite(position) ? Math.min(HISTORY_LAST, Math.max(0, position)) : 0;
}

/** Only the current passage and its neighbours need GPU resources, however long the archive grows. */
export function historyWindow(position: number): number[] {
  const center = Math.round(clampHistoryPosition(position));
  return Array.from({ length: Math.min(HISTORY_LAST, center + 2) - Math.max(0, center - 2) + 1 },
    (_, i) => Math.max(0, center - 2) + i);
}
