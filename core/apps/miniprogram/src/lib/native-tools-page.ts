import { displayCuberName } from '@cuberoot/shared/cuber-name-display';
import { formatDateRangeIso } from '@cuberoot/shared/iso-date';
import { formatWcaResult } from '@cuberoot/shared/wca-format-result';
import { EVENTS, fromWcaSpelling } from '@cuberoot/shared/timer/types';
import { requestJson } from './auth';
import { applyNativeAppearance } from './appearance';
import { getMiniProgramLocale, tr } from './i18n';
import { miniProgramApi } from './platform';
import { WCA_ID_REGEX } from '@cuberoot/shared/wca-person';
import { mean, parseTimeToken, trimmedAverage } from '@cuberoot/shared/timer/average-calculator';
import { parseCubeAlg } from '@cuberoot/shared/alg-transform';
import { mirrorAlg } from '@cuberoot/shared/recon/cube3';

interface Row { id: string; title: string; detail: string; result?: string }
interface PersonResponse {
  profile: { person: { name: string }; personal_records: Record<string, { single?: { best: number; world_rank: number }; average?: { best: number; world_rank: number } }> };
  comps: { id: string; name: string; city: string; start_date: string; end_date: string }[];
}
const WCA_MODES = ['competitions', 'records', 'person'] as const;
type ToolSection = 'wca' | 'average' | 'alg';
interface ToolPage {
  data: {
    mode: typeof WCA_MODES[number]; query: string; section: ToolSection;
    averageInput: string; algInput: string; algOutput: string;
    [key: string]: unknown;
  };
  setData(value: Record<string, unknown>): void;
  requestId?: number;
  active?: boolean;
  loadedLocale?: string;
}
function labels() { return {
  title: tr({ en: 'Tools', zh: '工具' }),
  sections: [
    { id: 'wca', label: tr({ en: 'WCA', zh: 'WCA 查询' }) },
    { id: 'average', label: tr({ en: 'Average calculator', zh: '平均计算' }) },
    { id: 'alg', label: tr({ en: 'Alg transforms', zh: '公式变换' }) },
  ],
  averageInputLabel: tr({ en: 'Times', zh: '计时成绩' }),
  averageHelp: tr({ en: 'Enter times in order, one per line or separated by commas. DNF and DNS are supported.', zh: '按顺序输入成绩，每行一个或用逗号分隔。支持 DNF 和 DNS。' }),
  averageExample: '12.34\n11.75\nDNF\n13.20\n10.95',
  averageInvalid: tr({ en: 'Check the time format. Use 12.34, 1:23.45, DNF or DNS.', zh: '请检查成绩格式，可输入 12.34、1:23.45、DNF 或 DNS。' }),
  averageMissing: tr({ en: 'Enter the times to calculate.', zh: '请输入要计算的成绩。' }),
  best: tr({ en: 'Best single', zh: '最快单次' }),
  calculate: tr({ en: 'Calculate', zh: '计算' }),
  algInputLabel: tr({ en: 'Cube alg', zh: '魔方公式' }),
  algInvalid: tr({ en: 'Check the move notation.', zh: '请检查转动记号。' }),
  algInverse: tr({ en: 'Inverse', zh: '逆公式' }),
  algMirrorLeft: tr({ en: 'Left–right mirror', zh: '左右镜像' }),
  algMirrorFront: tr({ en: 'Front–back mirror', zh: '前后镜像' }),
  copyResult: tr({ en: 'Copy result', zh: '复制结果' }),
  choices: [tr({ en: 'Recent competitions', zh: '近期公示比赛' }), tr({ en: 'Recent records', zh: '近期纪录' }), tr({ en: 'Personal results & rankings', zh: '个人成绩与排名' })],
  search: tr({ en: 'Search', zh: '查询' }), clear: tr({ en: 'Clear', zh: '清除' }), retry: tr({ en: 'Refresh', zh: '刷新' }),
  placeholder: tr({ en: 'WCA ID, e.g. 2017YANR02', zh: 'WCA ID，例如 2017YANR02' }),
  loading: tr({ en: 'Loading…', zh: '加载中…' }), empty: tr({ en: 'No data available', zh: '暂无数据' }),
  source: tr({ en: 'WCA data · recent records may be provisional', zh: 'WCA 数据 · 近期纪录可能尚未正式确认' }),
  idRequired: tr({ en: 'Enter a valid WCA ID.', zh: '请输入有效的 WCA ID。' }),
  fail: tr({ en: 'Unable to load data. Please retry.', zh: '暂时无法获取数据，请重试。' }),
}; }
function eventName(event: string) {
  const found = EVENTS.find(e => e.id === fromWcaSpelling(event));
  return found ? tr({ en: found.nameEn, zh: found.nameZh }) : event;
}
function formatAverage(value: number, kind: 'single' | 'average' = 'average') {
  return Number.isFinite(value) ? formatWcaResult(value, '333', kind) : '—';
}

function calculateAverages(text: string) {
  const tokens = text.split(/[\n,，;；]+/).map(token => token.trim()).filter(Boolean);
  if (!tokens.length) return { averageError: labels().averageMissing };
  const values: number[] = [];
  for (const token of tokens) {
    const value = parseTimeToken(token);
    if (value === null || !Number.isSafeInteger(value) || value === 0) return { averageError: labels().averageInvalid };
    values.push(value);
  }
  const completed = values.filter(value => value > 0);
  return {
    averageError: '',
    averageResults: [
      { label: labels().best, value: formatAverage(completed.length ? Math.min(...completed) : NaN, 'single') },
      { label: 'Mo3', value: formatAverage(mean(values, 3)) },
      { label: 'Ao5', value: formatAverage(trimmedAverage(values, 5)) },
      { label: 'Ao12', value: formatAverage(trimmedAverage(values, 12)) },
    ],
  };
}

async function load(page: ToolPage) {
  if (page.data.section !== 'wca') return;
  const id = page.requestId = (page.requestId ?? 0) + 1;
  const locale = getMiniProgramLocale();
  const mode = page.data.mode;
  const query = page.data.query.trim().toUpperCase();
  if (mode === 'person' && !WCA_ID_REGEX.test(query)) {
    page.setData({ error: labels().idRequired, loading: false, rows: [], personName: '', searched: false }); return;
  }
  page.setData({ loading: true, rows: [], error: '', personName: '', searched: true });
  try {
    let rows: Row[];
    let personName = '';
    if (mode === 'person') {
      const data = await requestJson<PersonResponse>(`/wca/person-page?wcaId=${encodeURIComponent(query)}`);
      personName = displayCuberName(data.profile.person.name, getMiniProgramLocale() === 'zh');
      rows = Object.entries(data.profile.personal_records).map(([event, result]) => ({ id: event, title: eventName(event),
        detail: `${tr({ en: 'Single', zh: '单次' })} ${formatWcaResult(result.single?.best ?? 0, event, 'single')} · ${tr({ en: 'Average', zh: '平均' })} ${formatWcaResult(result.average?.best ?? 0, event, 'average')}`,
        result: `WR ${result.single?.world_rank || '—'} / ${result.average?.world_rank || '—'}`,
      }));
      rows.push(...data.comps.slice().sort((a, b) => b.start_date.localeCompare(a.start_date)).slice(0, 50).map(c => ({ id: c.id, title: c.name, detail: `${formatDateRangeIso(c.start_date, c.end_date)} · ${c.city}` })));
    } else if (mode === 'records') {
      const data = await requestJson<{ records: { id: string; formattedCn: string; formattedEn: string }[] }>('/wca/recent-records');
      rows = data.records.map(r => ({ id: r.id, title: tr({ en: r.formattedEn, zh: r.formattedCn }), detail: '' }));
    } else {
      const data = await requestJson<{ comps: { id: string; name: string; name_zh: string | null; city: string; start_date: string; end_date: string }[] }>('/comp/announced');
      rows = data.comps.map(c => ({ id: c.id, title: tr({ en: c.name, zh: c.name_zh || c.name }), detail: `${formatDateRangeIso(c.start_date, c.end_date)} · ${c.city}` }));
    }
    if (page.active && page.requestId === id) {
      page.loadedLocale = locale;
      page.setData({ rows, personName, loading: false });
    }
  } catch (error) {
    console.warn('[native-tools] Request failed', mode, error);
    if (page.active && page.requestId === id) page.setData({ loading: false, error: labels().fail });
  }
}
export function createNativeToolsPageOptions() {
  return {
    data: {
      nativeToolsPage: true, appearanceStyle: '', copy: labels(), section: 'wca', mode: 'competitions', modeIndex: 0, query: '',
      rows: [] as Row[], error: '', loading: false, personName: '', searched: false,
      averageInput: '', averageResults: [] as { label: string; value: string }[], averageError: '',
      algInput: '', algOutput: '', algError: '',
    },
    onShow() {
      this.active = true;
      const copy = labels();
      this.setData({ copy });
      applyNativeAppearance();
      miniProgramApi().setNavigationBarTitle({ title: copy.title });
      const needsLoad = !this.data.searched || this.data.loading || this.data.error
        || this.loadedLocale !== getMiniProgramLocale();
      if (needsLoad && (this.data.mode !== 'person' || this.data.query)) void load(this);
    },
    onHide() { this.active = false; this.requestId = (this.requestId ?? 0) + 1; },
    onUnload() { this.onHide(); },
    active: false, requestId: 0, loadedLocale: '',
    selectTool(event: WechatMiniprogram.TouchEvent) {
      const section: unknown = event.currentTarget.dataset.section;
      if (section !== 'wca' && section !== 'average' && section !== 'alg') return;
      if (section === this.data.section) return;
      ++this.requestId;
      this.setData({ section, loading: false });
      if (section === 'wca' && (this.data.mode !== 'person' || this.data.query)) void load(this);
    },
    changeMode(e: WechatMiniprogram.PickerChange) {
      const index = Number(e.detail.value);
      if (!WCA_MODES[index]) return;
      this.setData({ modeIndex: index, mode: WCA_MODES[index], rows: [], error: '', personName: '', loading: false, searched: false });
      ++this.requestId;
      if (this.data.mode !== 'person' || this.data.query) void load(this);
    },
    inputQuery(e: WechatMiniprogram.Input) { ++this.requestId; this.setData({ query: e.detail.value, rows: [], error: '', personName: '', loading: false, searched: false }); },
    clearQuery() { ++this.requestId; this.setData({ query: '', rows: [], error: '', loading: false, personName: '', searched: false }); },
    search() { void load(this); },
    inputAverage(event: WechatMiniprogram.Input) {
      this.setData({ averageInput: event.detail.value, averageResults: [], averageError: '' });
    },
    calculateAverage() { this.setData({ averageResults: [], ...calculateAverages(this.data.averageInput) }); },
    inputAlg(event: WechatMiniprogram.Input) {
      this.setData({ algInput: event.detail.value, algOutput: '', algError: '' });
    },
    transformAlg(event: WechatMiniprogram.TouchEvent) {
      const action: unknown = event.currentTarget.dataset.action;
      if (action !== 'inverse' && action !== 'M' && action !== 'S') return;
      try {
        const alg = parseCubeAlg(this.data.algInput.trim());
        const output = action === 'inverse' ? alg.invert().toString() : mirrorAlg(alg.toString(), action);
        this.setData({ algOutput: output, algError: output ? '' : labels().algInvalid });
      } catch {
        this.setData({ algOutput: '', algError: labels().algInvalid });
      }
    },
    copyAlg() {
      if (this.data.algOutput) miniProgramApi().setClipboardData({ data: this.data.algOutput });
    },
  } satisfies WechatMiniprogram.Page.Options<ToolPage['data'], WechatMiniprogram.Page.CustomOption>;
}
