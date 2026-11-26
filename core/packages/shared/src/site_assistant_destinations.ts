import { ASSISTANT_FEATURE_LINKS } from './site_assistant_feature_links';
import { SITE_DIRECTORY_GROUPS } from './site_directory';

export { ASSISTANT_FEATURE_LINKS };

// Exact UI modes that may be opened by a fresh navigation command. The server
// and browser consume the same list; arbitrary query parameters are not actions.
export const ASSISTANT_MODE_DESTINATIONS = [
  ['/timer?players=2','双人计时','Two-player timer'],
  ['/timer?players=3','三人计时','Three-player timer'],
  ['/timer?players=4','四人计时','Four-player timer'],
  ['/timer?players=net','联机对战','Online timer battle'],
  ['/sim?tool=draw','模拟器绘图','Simulator drawing tool'],
  ['/scramble/gen?mode=batch','批量生成打乱','Batch scramble generation'],
  ['/scramble/gen?mode=comp','比赛打乱排版','Competition scramble sheets'],
  ['/scramble/gen?mode=paste','粘贴已有打乱','Paste existing scrambles'],
  ['/frame-count?mode=record','录制复盘视频','Record a reconstruction video'],
  ['/frame-count?mode=detector','视频动作检测','Video move detection'],
  ['/recon?favorites=true','收藏的复盘','Favorite reconstructions'],
  ['/music?view=lyrics','歌词视图','Lyrics view'],
  ['/music?view=player','音乐播放器','Music player'],
  ['/admin/team?section=schedule','工作台排期','Workspace schedule'],
  ['/admin/team?section=checklists','工作台清单','Workspace checklists'],
  ['/admin/team?section=onboarding','员工入职手册','Employee onboarding'],
  ['/wca/results?tab=rank','选手成绩排名','Competitor rankings'],
  ['/wca/results?tab=medals','比赛奖牌榜','Competition medal standings'],
  ['/wca/results?view=metric','成绩指标排名','Results metric rankings'],
  ['/wca/comp?view=globe','比赛地球仪','Competition globe'],
  ['/wca/comp?view=list','比赛列表','Competition list'],
  ['/wca/comp?view=card','比赛卡片','Competition cards'],
  ['/cube-history?view=timeline','魔方历史时间线','Cube history timeline'],
  ['/cube-history?view=compare','魔方参数对比','Compare cube specifications'],
  ['/cube-history?view=sources','魔方历史资料来源','Cube history sources'],
  ['/meet?view=join','加入会议','Join a meeting'],
  ['/meet?view=schedule','预约会议','Schedule a meeting'],
  ['/meet?view=past','历史会议','Past meetings'],
  ['/tutorial/lbl?view=walkthrough','层先法完整演示','LBL walkthrough'],
  ['/admin/team?section=offboarding','员工离职手册','Employee offboarding'],
  ['/admin/team?section=sop','工作台开发规范','Workspace development standards'],
  ['/scramble/solver?event=222','二阶魔方求解器','2x2 cube solver'],
  ['/scramble/solver?event=333','三阶魔方求解器','3x3 cube solver'],
] as const;

const modes = new Set<string>([
  ...ASSISTANT_MODE_DESTINATIONS.map(([href]) => href),
  ...ASSISTANT_FEATURE_LINKS.map(([href]) => href).filter(href => href.includes('?')),
  ...SITE_DIRECTORY_GROUPS.flatMap(group => group.entries.filter(entry =>
    entry.internal && entry.href.includes('?') && !('lockedForNonAdmin' in entry && entry.lockedForNonAdmin)
    && !('adminOnly' in entry && entry.adminOnly)).map(entry => entry.href)),
]);
export function isAssistantNavigationTarget(href:string) {
  return /^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\/?$/.test(href) || modes.has(href);
}
