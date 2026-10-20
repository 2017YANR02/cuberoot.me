import { exportTimerSolvesCsv } from '@cuberoot/shared/timer/export-csv';
import { confirmNativeTimerLink } from './native-timer-link';
import { exportTimerCstimerJson } from '@cuberoot/shared/timer/export-cstimer';
import { exportSpeedstacks } from '@cuberoot/shared/timer/export-speedstacks';
import { TIMER_SESSION_UI_COPY, timerSessionDeleteConfirmation, timerSessionClearConfirmation } from '@cuberoot/shared/timer/session';
import { timerManualEntryCopy } from '@cuberoot/shared/timer/manual-entry';
import { TIMER_MANUAL_SCRAMBLE_EMPTY_COPY } from '@cuberoot/shared/timer/manual-scramble-queue';
import { TIMER_HISTORY_QUICK_ACTION_IDS, TIMER_HISTORY_QUICK_ACTION_COPY, TIMER_HISTORY_PENALTIES, timerHistoryQuickActionPenalty, timerHistoryMoveTargets, timerSolveDetailStageRows, timerSolveDetailBldTimes } from '@cuberoot/shared/timer/history';
import type { EventId, Solve } from '@cuberoot/shared/timer/types';
import { effectiveMs } from '@cuberoot/shared/timer/types';
import { TIMER_SCRAMBLE_CLICK_ACTIONS, TIMER_SCRAMBLE_CLICK_TITLE_COPY, timerScrambleClickEffect, TIMER_SETTING_FIELD_CONTRACTS, TIMER_SETTING_CATEGORY_CONTRACTS } from '@cuberoot/shared/timer/settings-contract';
import { timerHidesRunningUi } from '@cuberoot/shared/timer/display-settings';
import { TIMER_STATS_DATE_RANGES } from '@cuberoot/shared/timer/stats-buckets';
import { NativeTimer, nativeTimerEvents } from './native-timer';
import { createNativeWcaPool, nativeCompetitionCatalog, loadNativeCompetitionScrambles } from './native-timer-wca';
import { searchTimerWcaCompetitions, timerWcaRoundGroupOptions, timerWcaRoundShortLabel, type TimerWcaCompetition, type TimerWcaCompetitionScramble } from '@cuberoot/shared/timer/wca-source-config';
import { timerWcaScrambleEventId } from '@cuberoot/shared/timer/event-catalog';
import { miniProgramApi } from './platform';
import { applyNativeAppearance } from './appearance';
import { tr, getMiniProgramLocale } from './i18n';
import { getSmartCubeSession } from './smart-cube/session';
import { startExternalTimer, disconnectExternalTimer } from './external-timer/session';
import { nativeTimerPreview } from './native-timer-preview';
import { createTimerBackupClient } from '@cuberoot/shared/timer/backup-client';
import { getStoredSessionSnapshot, requestJson } from './auth';
import { nativeTimerFetch } from './native-timer-network';
import { formatSolveResult, formatEventMs, formatMs } from '@cuberoot/shared/timer/stats';
import { createTimerRankClient, toWcaEventForRank } from '@cuberoot/shared/timer/rank-client';
import { timerRankPills, timerPersonalOfficialRank, type TimerRankOfficialRow } from '@cuberoot/shared/timer/rank-presentation';
import { WCA_ID_REGEX } from '@cuberoot/shared/wca-person';
import { TIMER_RANK_SCOPES } from '@cuberoot/shared/timer/settings-contract';
import { searchCountries } from '@cuberoot/shared/country-search';
import { countryName } from '@cuberoot/shared/country-name';

const ranks = createTimerRankClient({ apiUrl: path => path, fetcher: nativeTimerFetch });
const rankCountries = ['', ...searchCountries('', { limit: 250 }).map(row => row.iso2.toUpperCase())];

// Only settings with a native effect. Labels and available values remain shared.
const nativeSettings = TIMER_SETTING_FIELD_CONTRACTS.filter(f => [
  'timingEnabled', 'hideTime', 'runningPrecision', 'precision', 'showCubePreview', 'autoSessionForEvent', 'autoEventForSession',
  'compactScramble', 'hideAllUiWhileRunning', 'timerFontScale', 'scrambleFontScale',
].includes(f.storagePath ?? ''));
const nativeCategories = TIMER_SETTING_CATEGORY_CONTRACTS.filter(c => ['timer', 'smart-cube', 'scramble', 'appearance', 'data'].includes(c.id));
function settingValues(f: typeof nativeSettings[number], current?: unknown): readonly (boolean | number | string)[] {
  if (f.value.kind === 'boolean') return [false, true];
  if ('values' in f.value) return f.value.values ?? [];
  if (f.value.kind === 'number-range') {
    const { min, max, step } = f.value;
    const values = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => Number((min + step * i).toFixed(2)));
    if (typeof current === 'number' && Number.isFinite(current) && current >= min && current <= max) values.push(current);
    return [...new Set(values)].sort((a, b) => a - b);
  }
  return [];
}
function settingRows(t: NativeTimer) {
  return nativeSettings.map(f => {
    const values = settingValues(f, t.settings[f.storagePath as keyof typeof t.settings]);
    const labels = values.map(value => typeof value === 'boolean' ? tr(value ? { en: 'On', zh: '开启' } : { en: 'Off', zh: '关闭' }) : f.value.kind === 'number-range' ? `${Math.round(Number(value) * 100)}%` : String(value));
    const index = values.indexOf(t.settings[f.storagePath as keyof typeof t.settings] as boolean | number | string);
    return { key: f.storagePath, category: f.category, boolean: f.value.kind === 'boolean', checked: index === 1, label: tr(f.copy), labels, index: Math.max(0, index), value: labels[index] };
  });
}

const holdField = TIMER_SETTING_FIELD_CONTRACTS.find(f => f.storagePath === 'holdMs')!;
const holdRange = holdField.value as { min: number; max: number; step: number };
const holdValues = Array.from({ length: (holdRange.max - holdRange.min) / holdRange.step + 1 }, (_, i) => holdRange.min + i * holdRange.step);
function holdChoices(current: number) { return [...new Set([...holdValues, current])].sort((a, b) => a - b); }
function copy() { return {
  title: tr({ en: 'Timer', zh: '计时器' }), bluetooth: tr({ en: 'Bluetooth', zh: '蓝牙' }), settings: tr({ en: 'Settings', zh: '设置' }),
  next: tr({ en: 'Next scramble', zh: '下一条打乱' }), results: tr({ en: 'Results', zh: '成绩' }), best: tr({ en: 'Best', zh: '最佳' }),
  previous: tr({ en: 'Previous scramble', zh: '上一条打乱' }), search: tr({ en: 'Search comments or scrambles', zh: '搜索备注或打乱' }), moveSession: tr({ en: 'Move to group', zh: '移至分组' }),
  hold: tr({ en: 'Hold, then release to start', zh: '按住，准备后松手开始' }), ready: tr({ en: 'Release to start', zh: '松手开始' }),
  stop: tr({ en: 'Tap to stop', zh: '点击停止' }), inspection: tr({ en: 'Inspection · hold to start', zh: '观察中 · 按住准备开始' }),
  loading: tr({ en: 'Generating scramble…', zh: '正在生成打乱…' }), retry: tr({ en: 'Retry', zh: '重试' }),
  cube: tr({ en: 'Follow the scramble; the first turn starts timing and solving stops it.', zh: '按打乱转动魔方，匹配后首转开始，还原自动停止。' }),
  close: tr({ en: 'Close', zh: '关闭' }), export: tr({ en: 'Copy CSV', zh: '复制 CSV' }),
  empty: tr({ en: 'No results yet', zh: '暂无成绩' }), local: tr({ en: 'Results are saved on this device. Load more to see older results; exports include the entire group.', zh: '成绩保存在本机，可加载更多；导出包含整个分组。' }),
  inspectionSetting: tr(TIMER_SETTING_FIELD_CONTRACTS.find(f => f.storagePath === 'inspectionSec')!.copy), holdSetting: tr(holdField.copy),
  tapSetting: tr(TIMER_SETTING_FIELD_CONTRACTS.find(f => f.storagePath === 'scrambleClickAction')!.copy),
  tapOptions: TIMER_SCRAMBLE_CLICK_ACTIONS.map(action => tr(TIMER_SCRAMBLE_CLICK_TITLE_COPY[action])),
  off: tr({ en: 'Off', zh: '关闭' }), cancel: tr({ en: 'Cancel attempt', zh: '取消本次' }),
  session: tr(TIMER_SESSION_UI_COPY.sessions), newSession: tr(TIMER_SESSION_UI_COPY.newSession),
  clear: tr(TIMER_SESSION_UI_COPY.clear),
  rename: tr(TIMER_SESSION_UI_COPY.rename), deleteSession: tr(TIMER_SESSION_UI_COPY.deleteSession), clearSession: tr(TIMER_SESSION_UI_COPY.clearSolves),
  manualEntry: timerManualEntryCopy(getMiniProgramLocale()).title,
  manualPlaceholder: timerManualEntryCopy(getMiniProgramLocale()).timePlaceholder,
  manualScrambles: tr({ en: 'Manual scrambles', zh: '手动打乱' }), queuePlaceholder: tr(TIMER_MANUAL_SCRAMBLE_EMPTY_COPY),
  random: tr({ en: 'Random scrambles', zh: '随机打乱' }), save: timerManualEntryCopy(getMiniProgramLocale()).save,
  source: tr({ en: 'Scramble source', zh: '打乱来源' }),
  sourceOptions: [tr({ en: 'Random', zh: '随机' }), tr({ en: 'Manual', zh: '手动' }), tr({ en: 'Official', zh: '真题' })],
  wca: tr({ en: 'Official scrambles', zh: '比赛真题' }),
  wcaModes: [tr({ en: 'Competition', zh: '按比赛' }), tr({ en: 'Date range', zh: '按日期' })],
  competitionSearch: tr({ en: 'Search competition', zh: '搜索比赛' }), all: tr({ en: 'All', zh: '全部' }),
  from: tr({ en: 'From', zh: '开始日期' }), to: tr({ en: 'To', zh: '结束日期' }), round: tr({ en: 'Round', zh: '轮次' }), group: tr({ en: 'Group', zh: '组别' }),
  externalTimer: tr({ en: 'Connect external timer', zh: '连接外接计时器' }), disconnect: tr({ en: 'Disconnect', zh: '断开连接' }),
  preview: tr({ en: 'Scramble state', zh: '打乱状态' }), live: tr({ en: 'Live cube', zh: '实况魔方' }),
  matched: tr({ en: 'Scramble matched', zh: '打乱已匹配' }), unmatched: tr({ en: 'Scramble not matched', zh: '打乱尚未匹配' }),
  unknown: tr({ en: 'Waiting for cube state', zh: '等待魔方状态' }),
  backup: tr({ en: 'Copy full backup', zh: '复制完整备份' }), restore: tr({ en: 'Restore backup', zh: '恢复备份' }),
  cloudUpload: tr({ en: 'Back up results to account', zh: '备份成绩到账户' }), cloudDownload: tr({ en: 'Restore account backup', zh: '恢复账户备份' }),
  import: tr({ en: 'Import csTimer JSON', zh: '导入 csTimer JSON' }), comment: tr(TIMER_HISTORY_QUICK_ACTION_COPY['history.quick.comment']),
  calibrate: tr({ en: 'Calibrate cube state', zh: '校准魔方状态' }),
  statistics: tr({ en: 'Statistics', zh: '统计' }), current: tr({ en: 'Current', zh: '当前' }), more: tr({ en: 'Load more', zh: '加载更多' }),
  mean: tr({ en: 'Mean', zh: '平均' }), worst: tr({ en: 'Worst', zh: '最差' }),
  count: tr({ en: 'Solved / total', zh: '成功 / 总次数' }), deviation: tr({ en: 'Standard deviation', zh: '标准差' }),
  distribution: tr({ en: 'Time distribution', zh: '成绩分布' }),
  distributionEmpty: tr({ en: 'Need 5+ solves to chart distribution', zh: '至少 5 次成绩才显示分布' }),
  noMatches: tr({ en: 'No matching results', zh: '没有匹配的成绩' }),
  detail: tr({ en: 'Result details', zh: '成绩详情' }), event: tr({ en: 'Event', zh: '项目' }),
  rawTime: tr({ en: 'Raw time', zh: '原始时间' }), penalty: tr({ en: 'Penalty', zh: '罚时' }),
  inspectionTime: tr({ en: 'Inspection', zh: '观察用时' }), device: tr({ en: 'Device', zh: '设备' }),
  stageSplits: tr({ en: 'Stage splits', zh: '分阶段成绩' }), memo: tr({ en: 'Memo', zh: '记忆' }), execution: tr({ en: 'Execution', zh: '执行' }),
  duration: tr({ en: 'Duration', zh: '耗时' }), cumulative: tr({ en: 'Cumulative', zh: '累计' }),
  statsRanges: [tr({ en: 'All', zh: '全部' }), tr({ en: '7d', zh: '近7天' }), tr({ en: '30d', zh: '近30天' }), tr({ en: '90d', zh: '近90天' }), tr({ en: '365d', zh: '近一年' })],
  rankHint: tr({ en: 'Compared with historical WCA results; not a live official rank', zh: '对比 WCA 历史成绩，非实时官方排名' }),
  rankScopes: tr(TIMER_SETTING_FIELD_CONTRACTS.find(f => f.storagePath === 'rankScopes')!.copy),
  rankCountry: tr(TIMER_SETTING_FIELD_CONTRACTS.find(f => f.storagePath === 'rankCountry')!.copy),
}; }
interface NativePage {
  setData(data: Record<string, unknown>): void;
  nativeTimer?: NativeTimer;
  holdTimer?: ReturnType<typeof setTimeout>;
  ticker?: ReturnType<typeof setInterval>;
  unsubscribe?: () => void;
  sheet?: string;
  active?: boolean;
  connecting?: boolean;
  generation?: number;
  previewKey?: string;
  livePreviewKey?: string;
  draft?: string;
  resultId?: string;
  historyLimit?: number;
  cloudBusy?: boolean;
  competitions?: readonly TimerWcaCompetition[];
  competitionRows?: TimerWcaCompetitionScramble[] | null;
  competitionQuery?: string;
  competitionRequest?: number;
  sheetGeneration?: number;
  rankKey?: string;
  rankOfficial?: { id: string; rows: TimerRankOfficialRow[] };
}
function refreshRank(p: NativePage) {
  const t = p.nativeTimer, solve = t?.state.phase === 'stopped' ? t.lastResult : null;
  const value = solve ? effectiveMs(solve) : null;
  if (!t || !solve || value === null || !Number.isFinite(value) || value <= 0) {
    if (p.rankKey) { p.rankKey = ''; p.setData({ rankLine: '' }); }
    return;
  }
  const scopes = t.settings.rankScopes, country = t.settings.rankCountry;
  const personId = (getStoredSessionSnapshot().session?.user.wcaId ?? '').trim().toUpperCase();
  const key = JSON.stringify([solve.id, value, scopes, country, personId]);
  if (p.rankKey === key) return;
  p.rankKey = key; p.setData({ rankLine: '' });
  const centis = Math.round(value / 10), event = toWcaEventForRank(solve.event);
  void Promise.all([
    scopes.some(scope => scope === 'WR' || ((scope === 'NR' || scope === 'CR') && country))
      ? ranks.fetchRankFor(solve.event, centis, 'single', country || undefined) : Promise.resolve(null),
    scopes.includes('PR') && WCA_ID_REGEX.test(personId) ? (p.rankOfficial?.id === personId ? Promise.resolve(p.rankOfficial.rows)
      : requestJson<{ results?: TimerRankOfficialRow[] }>(`/wca/person-page?wcaId=${encodeURIComponent(personId)}&v=1`).then(data => {
        const rows = Array.isArray(data.results) ? data.results : []; p.rankOfficial = { id: personId, rows }; return rows;
      }).catch(() => [])) : Promise.resolve([]),
  ]).then(([result, official]) => {
    if (!p.active || p.rankKey !== key) return;
    const personal = event ? timerPersonalOfficialRank(official, event, centis, 'single') : null;
    const pills = timerRankPills(scopes, personal, result, country);
    p.setData({ rankLine: pills.map(({ label, data }) => `${label}${data.rank === 1 ? '' : data.rank.toLocaleString('en-US')}`).join(' / ') });
  }).catch(() => { if (p.active && p.rankKey === key) p.setData({ rankLine: '' }); });
}
function refreshCompetitionOptions(p: NativePage) {
  const t = p.nativeTimer;
  if (!t) return;
  const options = timerWcaRoundGroupOptions(p.competitionRows ?? null, timerWcaScrambleEventId(t.event), t.settings.wcaRound);
  const rounds = ['', ...options.rounds], groups = ['', ...options.groups];
  p.setData({ rounds, groups, roundLabels: rounds.map(r => r ? timerWcaRoundShortLabel(r) : copy().all), groupLabels: groups.map(g => g || copy().all),
    roundIndex: Math.max(0, rounds.indexOf(t.settings.wcaRound)), groupIndex: Math.max(0, groups.indexOf(t.settings.wcaGroup)) });
}
async function loadCompetitionOptions(p: NativePage) {
  const id = p.nativeTimer?.settings.wcaComp ?? '';
  const request = p.competitionRequest = (p.competitionRequest ?? 0) + 1;
  p.competitionRows = null; refreshCompetitionOptions(p);
  if (!id) return;
  try {
    const rows = await loadNativeCompetitionScrambles(id);
    if (!p.active || p.sheet !== 'wca' || p.competitionRequest !== request) return;
    p.competitionRows = rows; refreshCompetitionOptions(p);
  } catch { if (p.active && p.sheet === 'wca' && p.competitionRequest === request) p.setData({ formError: tr({ en: 'Unable to load rounds. Reopen to retry.', zh: '轮次加载失败，请重新打开重试。' }) }); }
}
function refresh(page: NativePage, history = false) {
  const t = page.nativeTimer;
  if (!t || !page.active) return;
  const labels = copy();
  const previewKey = `${t.settings.showCubePreview}|${t.event}|${t.scramble}`;
  const liveKey = t.cubeConnected ? t.facelets ?? '' : '';
  const images: Record<string, unknown> = {};
  try {
    if (page.previewKey !== previewKey) {
      images.preview = t.settings.showCubePreview && t.scramble ? nativeTimerPreview(t.event, t.scramble) : '';
      images.previewError = '';
      page.previewKey = previewKey;
    }
    if (page.livePreviewKey !== liveKey) {
      images.livePreview = liveKey ? nativeTimerPreview(t.event, '', liveKey) : '';
      page.livePreviewKey = liveKey;
    }
  } catch { images.previewError = tr({ en: 'Unable to draw this state', zh: '无法绘制当前状态' }); }
  page.setData({ phase: t.state.phase, display: t.display(), scramble: t.scramble, error: t.error, busy: t.busy, generating: t.loading, sourceLine: t.sourceLine, canPrevious: t.canPrevious,
    ...images, guidance: !t.cubeKnown ? labels.unknown : t.guidance.match ? labels.matched : labels.unmatched,
    hideChrome: timerHidesRunningUi(t.state.phase, t.settings),
    compactScramble: t.settings.compactScramble,
    timerFontSize: Math.min(108 * t.settings.timerFontScale, 580 / Math.max(t.display().length * 0.65, 1)),
    scrambleFontSize: 36 * t.settings.scrambleFontScale,
    event: t.event, eventName: nativeTimerEvents().find(e => e.id === t.event)?.name,
    eventIndex: nativeTimerEvents().findIndex(e => e.id === t.event),
    sourceIndex: ['random', 'manual', 'wca'].indexOf(t.currentSource),
    hint: t.state.phase === 'running' ? labels.stop : t.state.phase === 'ready' ? labels.ready : t.state.phase === 'inspecting' ? labels.inspection : labels.hold,
    cubeConnected: t.cubeConnected, canResetCube: t.canResetCube, calibrating: t.calibrating,
    externalConnected: t.externalConnected, externalName: t.externalName,
    ...(history ? { summary: t.summary(page.historyLimit), settings: t.settings, settingRows: settingRows(t), sessions: t.sessions.sessions,
      rankScopes: TIMER_RANK_SCOPES.map(scope => ({ scope, selected: t.settings.rankScopes.includes(scope) })),
      rankCountries: rankCountries.map(code => code ? countryName(code, getMiniProgramLocale() === 'zh') : labels.off),
      rankCountryIndex: Math.max(0, rankCountries.indexOf(t.settings.rankCountry)),
      sessionIndex: t.sessions.sessions.findIndex(s => s.id === t.sessions.activeSessionId), source: t.currentSource,
      tapIndex: TIMER_SCRAMBLE_CLICK_ACTIONS.indexOf(t.settings.scrambleClickAction),
      holdOptions: holdChoices(t.settings.holdMs).map(ms => `${ms} ms`),
      holdIndex: holdChoices(t.settings.holdMs).indexOf(t.settings.holdMs), inspectionIndex: t.settings.inspectionSec ? 1 : 0 } : {}),
  });
  if (history) refreshRank(page);
}
function cancelHold(page: NativePage) { if (page.holdTimer !== undefined) clearTimeout(page.holdTimer); page.holdTimer = undefined; }
function showDetail(p: NativePage): boolean {
  const t = p.nativeTimer, solve = t?.records.find(s => s.id === p.resultId);
  if (!t || !solve) return false;
  let preview = '', previewError = '';
  try { preview = nativeTimerPreview(solve.event, solve.scramble); }
  catch { previewError = tr({ en: 'Unable to draw this state', zh: '无法绘制当前状态' }); }
  const labels = copy(), bld = timerSolveDetailBldTimes(solve);
  p.sheet = 'detail';
  p.setData({ sheet: 'detail', formError: '', detailPreview: preview, detailPreviewError: previewError,
    detail: { id: solve.id, scramble: solve.scramble, comment: solve.comment ?? '', penalty: solve.penalty, result: formatSolveResult(solve, t.settings.precision),
      rawTime: formatEventMs(solve.event, solve.timeMs, t.settings.precision),
      date: new Date(solve.ts).toLocaleString(getMiniProgramLocale() === 'zh' ? 'zh-CN' : 'en-US'),
      eventName: nativeTimerEvents().find(e => e.id === solve.event)?.name ?? solve.event,
      inspection: solve.inspectionMs === undefined ? '' : formatMs(solve.inspectionMs, t.settings.precision),
      source: solve.scrambleSource ? ({ random: labels.random, manual: labels.manualScrambles, wca: labels.wca })[solve.scrambleSource.kind] : '',
      deviceName: solve.device?.name || solve.device?.model || '',
      stages: timerSolveDetailStageRows(solve).map(row => ({ id: row.id, label: row.id === 'cross' ? tr({ en: 'Cross', zh: '十字' }) : row.id.toUpperCase(), duration: formatMs(row.durationMs, t.settings.precision), cumulative: formatMs(row.cumulativeMs, t.settings.precision) })),
      memo: bld ? formatMs(bld.memoMs, t.settings.precision) : '', execution: bld ? formatMs(bld.executionMs, t.settings.precision) : '',
    },
    penaltyIndex: TIMER_HISTORY_PENALTIES.indexOf(solve.penalty),
    penaltyLabels: [tr(TIMER_HISTORY_QUICK_ACTION_COPY['history.quick.penalty-ok']), '+2', 'DNF', 'DNS'],
    moveTargets: timerHistoryMoveTargets(t.sessions.sessions, t.sessions.activeSessionId),
    resultActions: TIMER_HISTORY_QUICK_ACTION_IDS.filter(action => !timerHistoryQuickActionPenalty(action)).map(action => ({ id: action, title: tr(TIMER_HISTORY_QUICK_ACTION_COPY[action]) })),
  });
  return true;
}
function generate(page: NativePage, event?: string) {
  const timer = page.nativeTimer;
  if (!timer || timer.busy) return;
  page.setData({ generating: true });
  const generation = page.generation = (page.generation ?? 0) + 1;
  setTimeout(() => {
    if (!page.active || generation !== page.generation) return;
    try { event ? timer.selectEvent(event) : timer.nextScramble(); }
    catch { timer.error = tr({ en: 'Unable to generate a scramble. Please retry.', zh: '生成打乱失败，请重试。' }); }
    page.setData({ generating: false }); refresh(page, true);
  }, 20);
}
export function createNativeTimerPageOptions(): WechatMiniprogram.Page.Options<Record<string, unknown>, WechatMiniprogram.Page.CustomOption> {
  return {
    data: { nativeTimerPage: true, appearanceStyle: '', copy: copy(), display: '0.000', phase: 'idle', scramble: '', generating: true, sheet: '', settingsCategory: 'timer', settingsCategoryIndex: 0, statsRangeIndex: 0, summary: { rows: [] } },
    onLoad() {
      const p = this as unknown as NativePage;
      p.nativeTimer = new NativeTimer(miniProgramApi(), undefined, createNativeWcaPool());
    },
    onShow() {
      const p = this as unknown as NativePage;
      p.active = true;
      p.rankKey = ''; p.rankOfficial = undefined;
      if (!p.nativeTimer) p.nativeTimer = new NativeTimer(miniProgramApi(), undefined, createNativeWcaPool());
      p.nativeTimer.onChange = () => refresh(p, true);
      p.nativeTimer.visible = true;
      this.setData({ copy: copy(), events: nativeTimerEvents(), inspectionOptions: [copy().off, '15 s'], settingsCategories: nativeCategories.map(c => tr(c.label)) });
      applyNativeAppearance(); miniProgramApi().setNavigationBarTitle({ title: copy().title });
      if (!p.nativeTimer.scramble) generate(p);
      refresh(p, true);
      const linkGeneration = p.generation;
      confirmNativeTimerLink(p.nativeTimer, () => !!p.active && p.generation === linkGeneration, () => refresh(p, true));
      if (p.ticker) clearInterval(p.ticker);
      p.ticker = setInterval(() => { if (p.nativeTimer?.busy) refresh(p); }, 50);
      p.unsubscribe?.();
      p.unsubscribe = getSmartCubeSession().subscribe(s => {
        if (p.active) { this.setData({ deviceName: s.phase === 'connected' ? s.deviceName : '', battery: s.battery }); refresh(p, true); }
      });
    },
    onHide() {
      const p = this as unknown as NativePage;
      p.nativeTimer?.hide(); p.active = false; p.generation = (p.generation ?? 0) + 1;
      p.competitionRequest = (p.competitionRequest ?? 0) + 1;
      p.sheetGeneration = (p.sheetGeneration ?? 0) + 1;
      void disconnectExternalTimer();
      cancelHold(p); if (p.ticker) clearInterval(p.ticker); p.ticker = undefined; p.unsubscribe?.(); p.unsubscribe = undefined;
      this.setData({ generating: false });
    },
    onUnload() { this.onHide?.(); const t = (this as unknown as NativePage).nativeTimer; if (t) { t.onChange = undefined; t.dispose(); } void getSmartCubeSession().stopLocal(); },
    timerDown() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || p.sheet || !t.scramble || this.data.generating) return;
      cancelHold(p); t.down();
      if (t.state.phase === 'holding') p.holdTimer = setTimeout(() => {
        t.dispatch({ type: 'hold-ready' }); refresh(p);
        try { miniProgramApi().vibrateShort({ type: 'light' }); } catch { /* optional */ }
      }, t.settings.holdMs);
      refresh(p, true);
    },
    timerUp() { const p = this as unknown as NativePage; cancelHold(p); p.nativeTimer?.up(); refresh(p, true); },
    timerCancel() { const p = this as unknown as NativePage; cancelHold(p); p.nativeTimer?.dispatch({ type: 'cancel-press' }); refresh(p); },
    scrambleDown() {
      const t = (this as unknown as NativePage).nativeTimer;
      if (t && timerScrambleClickEffect(t.settings.scrambleClickAction, Boolean(t.scramble), !this.data.generating, false) === 'start') this.timerDown();
    },
    scrambleUp() {
      const t = (this as unknown as NativePage).nativeTimer;
      if (t?.settings.scrambleClickAction === 'start') this.timerUp();
    },
    scrambleTap() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || this.data.generating || t.state.phase === 'running') return;
      const effect = timerScrambleClickEffect(t.settings.scrambleClickAction, Boolean(t.scramble), !this.data.generating, false);
      if (effect === 'copy') miniProgramApi().setClipboardData({ data: t.scramble });
      else if (effect === 'next') generate(p);
    },
    nextScramble() { generate(this as unknown as NativePage); },
    previousScramble() { const p = this as unknown as NativePage; p.nativeTimer?.previousScramble(); refresh(p, true); },
    selectEvent(e: WechatMiniprogram.PickerChange) { generate(this as unknown as NativePage, nativeTimerEvents()[Number(e.detail.value)]?.id); },
    selectSource(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage;
      if (!p.nativeTimer || p.nativeTimer.busy) return;
      const index = Number(e.detail.value);
      if (index === 0) this.randomScrambles();
      else if (index === 1 || index === 2) this.openSheet({ currentTarget: { dataset: { sheet: index === 1 ? 'scrambles' : 'wca' } } });
    },
    openSheet(e: { currentTarget: { dataset: { sheet?: string } } }) {
      const p = this as unknown as NativePage;
      if (p.nativeTimer?.busy) return;
      p.sheet = String(e.currentTarget.dataset.sheet);
      const sheetGeneration = p.sheetGeneration = (p.sheetGeneration ?? 0) + 1;
      p.draft = p.sheet === 'scrambles' ? p.nativeTimer?.settings.manualScrambles ?? '' : '';
      this.setData({ sheet: p.sheet, draft: p.draft, formError: '' }); refresh(p, true);
      if (p.sheet === 'statistics') this.setData({ statistics: p.nativeTimer?.statistics(TIMER_STATS_DATE_RANGES[Number(this.data.statsRangeIndex)] ?? 'all') });
      if (p.sheet === 'wca') {
        p.competitionQuery = ''; this.setData({ competitionQuery: '', competitionMatches: [] });
        void loadCompetitionOptions(p);
        if (!p.competitions) void nativeCompetitionCatalog.load(getMiniProgramLocale()).then(rows => {
          if (!p.active || p.sheet !== 'wca' || p.sheetGeneration !== sheetGeneration) return;
          p.competitions = rows;
          this.setData({ competitionMatches: searchTimerWcaCompetitions(p.competitionQuery ?? '', rows) });
        }).catch(() => { if (p.active && p.sheet === 'wca' && p.sheetGeneration === sheetGeneration) this.setData({ formError: tr({ en: 'Competition search is unavailable. Reopen to retry or select a date range.', zh: '比赛目录加载失败，可重新打开重试或按日期选择。' }) }); });
      }
    },
    closeSheet(e?: WechatMiniprogram.TouchEvent) {
      // Douyin catch handlers cancel native scrolling and input defaults as well as bubbling.
      // Dismiss only taps originating on the backdrop; inner controls retain their defaults.
      if (e?.currentTarget.id === 'nt-backdrop' && e.target.id !== 'nt-backdrop') return;
      const p = this as unknown as NativePage;
      if (p.sheet === 'comment' && showDetail(p)) return;
      if (p.sheet === 'detail') { this.openSheet({ currentTarget: { dataset: { sheet: 'history' } } }); return; }
      p.sheet = ''; p.sheetGeneration = (p.sheetGeneration ?? 0) + 1;
      p.competitionRequest = (p.competitionRequest ?? 0) + 1;
      this.setData({ sheet: '' });
    },
    loadMoreHistory() { const p = this as unknown as NativePage; p.historyLimit = (p.historyLimit ?? 100) + 100; refresh(p, true); },
    searchHistory(e: WechatMiniprogram.Input) {
      const p = this as unknown as NativePage;
      if (p.nativeTimer) p.nativeTimer.historyFilters.query = e.detail.value;
      this.setData({ historyQuery: e.detail.value }); p.historyLimit = 100; refresh(p, true);
    },
    clearHistorySearch() {
      const p = this as unknown as NativePage;
      if (p.nativeTimer) p.nativeTimer.historyFilters.query = '';
      this.setData({ historyQuery: '' }); refresh(p, true);
    },
    changeSetting(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy) return;
      const key = e.currentTarget.dataset.setting, index = Number(e.detail.value);
      if (key === 'inspection') t.updateSettings({ inspectionSec: index === 1 ? 15 : 0 });
      if (key === 'hold') t.updateSettings({ holdMs: holdChoices(t.settings.holdMs)[index] ?? t.settings.holdMs });
      if (key === 'tap') t.updateSettings({ scrambleClickAction: TIMER_SCRAMBLE_CLICK_ACTIONS[index] ?? 'start' });
      const field = nativeSettings.find(f => f.storagePath === key);
      if (field) {
        const values = settingValues(field, t.settings[field.storagePath as keyof typeof t.settings]);
        if (index >= 0 && index < values.length) t.updateSettings({ [String(key)]: values[index] });
      }
      refresh(p, true);
    },
    selectSettingsCategory(e: WechatMiniprogram.PickerChange) {
      const index = Number(e.detail.value), category = nativeCategories[index];
      if (category) this.setData({ settingsCategory: category.id, settingsCategoryIndex: index });
    },
    selectStatsRange(e: WechatMiniprogram.PickerChange) {
      const index = Number(e.detail.value), range = TIMER_STATS_DATE_RANGES[index];
      if (range) this.setData({ statsRangeIndex: index, statistics: (this as unknown as NativePage).nativeTimer?.statistics(range) });
    },
    toggleSetting(e: WechatMiniprogram.SwitchChange) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      const field = nativeSettings.find(f => f.storagePath === e.currentTarget.dataset.setting && f.value.kind === 'boolean');
      if (!t || t.busy || !field) return;
      t.updateSettings({ [field.storagePath!]: e.detail.value }); refresh(p, true);
    },
    toggleRankScope(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      const scope = TIMER_RANK_SCOPES.find(value => value === e.currentTarget.dataset.scope);
      if (!t || t.busy || !scope) return;
      t.updateSettings({ rankScopes: t.settings.rankScopes.includes(scope) ? t.settings.rankScopes.filter(value => value !== scope) : [...t.settings.rankScopes, scope] });
      refresh(p, true);
    },
    changeRankCountry(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage;
      const country = rankCountries[Number(e.detail.value)];
      if (country !== undefined) p.nativeTimer?.updateSettings({ rankCountry: country });
      refresh(p, true);
    },
    selectSession(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      const id = t?.sessions.sessions[Number(e.detail.value)]?.id;
      if (id) t?.selectSession(id); refresh(p, true);
    },
    sessionAction(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy) return;
      const action = String(e.currentTarget.dataset.action), active = t.sessions.sessions.find(s => s.id === t.sessions.activeSessionId)!;
      if (action === 'create' || action === 'rename') {
        p.sheet = action; p.draft = action === 'rename' ? active.name : '';
        this.setData({ sheet: action, draft: p.draft, formError: '' }); return;
      }
      miniProgramApi().showModal({ title: tr(action === 'delete' ? TIMER_SESSION_UI_COPY.deleteSession : TIMER_SESSION_UI_COPY.clearSolves),
        content: tr(action === 'delete' ? timerSessionDeleteConfirmation(active.name) : timerSessionClearConfirmation(active.name)),
        success: r => {
          if (!r.confirm || t.busy) return;
          const ok = action === 'delete' ? t.deleteSession() : t.clearSession();
          if (!ok) miniProgramApi().showToast({ icon: 'none', title: tr(TIMER_SESSION_UI_COPY.keepOneSession) });
          refresh(p, true);
        } });
    },
    draftInput(e: WechatMiniprogram.Input) { (this as unknown as NativePage).draft = e.detail.value; },
    clearDraft() { (this as unknown as NativePage).draft = ''; this.setData({ draft: '' }); },
    saveDraft() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy) return;
      const value = p.draft ?? '';
      if (p.sheet === 'manual' && !t.manualEntry(value)) {
        this.setData({ formError: timerManualEntryCopy(getMiniProgramLocale()).error('time-invalid') }); return;
      }
      if (p.sheet === 'scrambles') t.setManualScrambles(value);
      if (p.sheet === 'create') t.createSession(value);
      if (p.sheet === 'rename' && !t.renameSession(value)) return;
      if (p.sheet === 'comment' && p.resultId) { t.updateComment(p.resultId, value); showDetail(p); refresh(p, true); return; }
      if (p.sheet === 'import' && !t.importCstimer(value)) {
        this.setData({ formError: tr({ en: 'Invalid file or unresolved event. No data was imported.', zh: '格式无效或项目未识别，没有导入任何数据。' }) }); return;
      }
      if (p.sheet === 'restore') {
        miniProgramApi().showModal({ title: copy().restore,
          content: tr({ en: 'Replace local results and settings? A copy of the current data will be kept before restoring.', zh: '替换本机成绩和设置？恢复前会保留当前数据的副本。' }), success: r => {
            if (!r.confirm || t.busy) return;
            if (!t.restoreBackup(value)) { this.setData({ formError: tr({ en: 'Restore failed. Existing data was kept.', zh: '恢复失败，原有数据已保留。' }) }); return; }
            this.closeSheet(); refresh(p, true);
          } }); return;
      }
      this.closeSheet(); refresh(p, true);
    },
    exportBackup() {
      const t = (this as unknown as NativePage).nativeTimer;
      if (t) miniProgramApi().setClipboardData({ data: t.exportBackup() });
    },
    async cloudBackup(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy || p.cloudBusy) return;
      const session = getStoredSessionSnapshot().session;
      if (!session) { miniProgramApi().showToast({ icon: 'none', title: tr({ en: 'Sign in from My account first', zh: '请先到“我的”登录' }) }); return; }
      const upload = e.currentTarget.dataset.action === 'upload', token = session.token;
      const snapshot = t.exportBackup(), blob = t.exportCloudBackup();
      const current = () => p.active && !t.busy && getStoredSessionSnapshot().session?.token === token && t.exportBackup() === snapshot;
      const client = createTimerBackupClient({ apiUrl: path => path, fetcher: nativeTimerFetch, headers: () => ({ Authorization: `Bearer ${token}` }) });
      p.cloudBusy = true; this.setData({ cloudBusy: true });
      try {
        const remote = upload ? null : await client.download();
        if (!current()) return;
        if (!upload && !remote) { miniProgramApi().showToast({ icon: 'none', title: tr({ en: 'No account backup', zh: '账户暂无备份' }) }); return; }
        const confirm = await new Promise<boolean>(resolve => miniProgramApi().showModal({
          title: upload ? copy().cloudUpload : copy().cloudDownload,
          content: upload
            ? tr({ en: 'Replace this account’s cloud backup with the current local results?', zh: '用当前本机成绩替换该账户的云备份？' })
            : tr({ en: `Restore ${remote!.solveCount} results and replace local groups? Current local data will be kept in a recovery copy.`, zh: `恢复 ${remote!.solveCount} 条成绩并替换本机分组？恢复前会保留本机数据副本。` }),
          success: r => resolve(r.confirm), fail: () => resolve(false),
        }));
        if (!confirm || !current()) return;
        if (upload) await client.upload(blob);
        else if (!t.restoreBackup(remote!.blob)) throw new Error(tr({ en: 'Backup is invalid or storage is unavailable', zh: '备份无效或本机存储不可用' }));
        if (p.active && getStoredSessionSnapshot().session?.token === token) miniProgramApi().showToast({ icon: 'success', title: tr({ en: 'Completed', zh: '已完成' }) });
      } catch (error) {
        if (p.active) t.error = error instanceof Error ? error.message : String(error);
      } finally { p.cloudBusy = false; this.setData({ cloudBusy: false }); refresh(p, true); }
    },
    calibrateCube() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy || !t.canResetCube || t.calibrating) return;
      miniProgramApi().showModal({ title: copy().calibrate,
        content: tr({ en: 'First solve the physical cube. Confirm only when all six faces are solved; calibration resets the device state.', zh: '请先把实体魔方六面还原，再确认。校准会重置魔方内部状态。' }),
        success: r => { if (r.confirm && !t.busy && t.cubeConnected) void getSmartCubeSession().resetLocalDevice(); } });
    },
    randomScrambles() { const p = this as unknown as NativePage; p.nativeTimer?.useRandomScrambles(); refresh(p, true); },
    wcaScrambles() { const p = this as unknown as NativePage; p.nativeTimer?.useWcaScrambles(); this.closeSheet(); refresh(p, true); },
    wcaSearch(e: WechatMiniprogram.Input) {
      const p = this as unknown as NativePage; p.competitionQuery = e.detail.value;
      this.setData({ competitionQuery: e.detail.value, competitionMatches: searchTimerWcaCompetitions(e.detail.value, p.competitions ?? []) });
    },
    clearCompetitionSearch() { (this as unknown as NativePage).competitionQuery = ''; this.setData({ competitionQuery: '', competitionMatches: [] }); },
    pickCompetition(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, row = p.competitions?.find(c => c.id === e.currentTarget.dataset.id);
      if (!row) return;
      p.nativeTimer?.updateSettings({ wcaComp: row.id, wcaCompName: row.selectedDisplayName ?? row.name, wcaCompCountry: row.country, wcaRound: '', wcaGroup: '' });
      this.clearCompetitionSearch(); refresh(p, true); void loadCompetitionOptions(p);
    },
    changeWca(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t) return;
      const key = String(e.currentTarget.dataset.setting), index = Number(e.detail.value);
      if (key === 'mode') t.updateSettings({ wcaScrambleMode: index === 0 ? 'comp' : 'date' });
      if (key === 'from' || key === 'to') t.updateSettings({ [key === 'from' ? 'wcaDateFrom' : 'wcaDateTo']: String(e.detail.value) });
      if (key === 'round') t.updateSettings({ wcaRound: (this.data.rounds as string[])[index] ?? '', wcaGroup: '' });
      if (key === 'group') t.updateSettings({ wcaGroup: (this.data.groups as string[])[index] ?? '' });
      refreshCompetitionOptions(p); refresh(p, true);
    },
    clearWca(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, key = e.currentTarget.dataset.setting;
      p.nativeTimer?.updateSettings(key === 'comp' ? { wcaComp: '', wcaCompName: '', wcaRound: '', wcaGroup: '' } : { wcaDateFrom: '', wcaDateTo: '' });
      if (key === 'comp') { p.competitionRequest = (p.competitionRequest ?? 0) + 1; p.competitionRows = null; }
      refreshCompetitionOptions(p); refresh(p, true);
    },
    imageError() { this.setData({ previewError: tr({ en: 'Image could not be displayed', zh: '图示加载失败' }) }); },
    detailImageError() { this.setData({ detailPreviewError: tr({ en: 'Image could not be displayed', zh: '图示加载失败' }) }); },
    cancelAttempt() { const p = this as unknown as NativePage; p.nativeTimer?.dispatch({ type: 'cancel-arm' }); refresh(p); },
    async connectCube() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy || p.connecting) return;
      if (t.cubeConnected) { await getSmartCubeSession().disconnect(); refresh(p); return; }
      if (t.event !== '333' && t.event !== '333oh') {
        miniProgramApi().showToast({ icon: 'none', title: tr({ en: 'Select 3×3 or OH first', zh: '请先选择三阶或单手' }) }); return;
      }
      p.connecting = true;
      try {
        await disconnectExternalTimer();
        await getSmartCubeSession().startLocal(t.receiveCube);
        if (p.active) miniProgramApi().navigateTo({ url: '/pages/smart-cube/index?native=1' });
      } catch (err) { t.error = String(err); refresh(p); }
      finally { p.connecting = false; }
    },
    connectExternalTimer() {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || t.busy || p.connecting) return;
      if (t.externalConnected) { void disconnectExternalTimer(); return; }
      miniProgramApi().showActionSheet({ itemList: ['GAN', tr({ en: 'QiYi timer / adapter', zh: '奇艺计时器／适配器' })], success: async r => {
        if (p.connecting || t.busy || !p.active) return;
        p.connecting = true; this.closeSheet();
        try {
          await getSmartCubeSession().stopLocal();
          await startExternalTimer('', r.tapIndex === 0 ? 'gan-timer' : 'qiyi-timer', t.receiveExternal);
          if (!p.active) await disconnectExternalTimer();
        } catch (error) { t.error = error instanceof Error ? error.message : String(error); }
        finally { p.connecting = false; refresh(p, true); }
      } });
    },
    editResult(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer, id = String(e.currentTarget.dataset.id);
      if (!t || t.busy) return;
      const solve = t.records.find(s => s.id === id);
      if (!solve) return;
      p.resultId = id; showDetail(p);
    },
    changeDetailPenalty(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      const penalty = TIMER_HISTORY_PENALTIES[Number(e.detail.value)];
      if (!t || t.busy || !p.resultId || !penalty) return;
      t.updatePenalty(p.resultId, penalty); showDetail(p); refresh(p, true);
    },
    resultAction(e: WechatMiniprogram.TouchEvent) {
      const p = this as unknown as NativePage, t = p.nativeTimer, id = p.resultId;
      if (!t || t.busy || !id) return;
      const action = TIMER_HISTORY_QUICK_ACTION_IDS.find(a => a === e.currentTarget.dataset.action);
      if (!action) return;
      const penalty = timerHistoryQuickActionPenalty(action);
      if (penalty) { t.updatePenalty(id, penalty); showDetail(p); }
      else if (action === 'history.quick.comment') {
          p.resultId = id; p.sheet = 'comment'; p.draft = t.records.find(s => s.id === id)?.comment ?? '';
          this.setData({ sheet: p.sheet, draft: p.draft, formError: '' });
      } else if (action === 'history.quick.copy-scramble') miniProgramApi().setClipboardData({ data: t.records.find(s => s.id === id)?.scramble ?? '' });
      else miniProgramApi().showModal({ title: tr({ en: 'Delete this result?', zh: '删除这条成绩？' }), content: tr({ en: 'This cannot be undone.', zh: '删除后无法恢复。' }), success: r => { if (r.confirm && p.active && !t.busy && p.resultId === id && p.sheet === 'detail') { t.remove(id); this.closeSheet(); refresh(p, true); } } });
      refresh(p, true);
    },
    moveResult(e: WechatMiniprogram.PickerChange) {
      const p = this as unknown as NativePage, t = p.nativeTimer;
      if (!t || !p.resultId) return;
      const target = timerHistoryMoveTargets(t.sessions.sessions, t.sessions.activeSessionId)[Number(e.detail.value)];
      if (target && t.moveResult(p.resultId, target.id)) { this.closeSheet(); refresh(p, true); }
    },
    exportResults(e: WechatMiniprogram.TouchEvent) {
      const t = (this as unknown as NativePage).nativeTimer;
      if (!t) return;
      const byEvent: Partial<Record<EventId, Solve[]>> = {};
      for (const solve of t.records) (byEvent[solve.event] ??= []).push(solve);
      const format = e.currentTarget.dataset.format;
      const data = format === 'cstimer' ? exportTimerCstimerJson(byEvent).json : format === 'speedstacks' ? exportSpeedstacks(t.records) : exportTimerSolvesCsv(byEvent).csv;
      miniProgramApi().setClipboardData({ data });
    },
  };
}
