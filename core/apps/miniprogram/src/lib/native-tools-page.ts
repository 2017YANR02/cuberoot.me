import { displayCuberName } from '@cuberoot/shared/cuber-name-display';
import { formatDateRangeIso } from '@cuberoot/shared/iso-date';
import { formatWcaResult } from '@cuberoot/shared/wca-format-result';
import { EVENTS, fromWcaSpelling } from '@cuberoot/shared/timer/types';
import { requestJson } from './auth';
import { applyNativeAppearance } from './appearance';
import { getMiniProgramLocale, tr } from './i18n';
import { miniProgramApi } from './platform';
import { WCA_ID_REGEX } from '@cuberoot/shared/wca-person';

interface Row { id: string; title: string; detail: string; result?: string }
interface PersonResponse {
  profile: { person: { name: string }; personal_records: Record<string, { single?: { best: number; world_rank: number }; average?: { best: number; world_rank: number } }> };
  comps: { id: string; name: string; city: string; start_date: string; end_date: string }[];
}
interface ToolPage { data: { mode: string; query: string; [key: string]: unknown }; setData(value: Record<string, unknown>): void; requestId?: number; active?: boolean }
function labels() { return {
  title: tr({ en: 'Tools', zh: '工具' }), timer: tr({ en: 'Timer', zh: '基础计时' }),
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
async function load(page: ToolPage) {
  const id = page.requestId = (page.requestId ?? 0) + 1;
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
    if (page.active && page.requestId === id) page.setData({ rows, personName, loading: false });
  } catch (error) {
    console.warn('[native-tools] Request failed', mode, error);
    if (page.active && page.requestId === id) page.setData({ loading: false, error: labels().fail });
  }
}
export function createNativeToolsPageOptions() {
  return {
    data: { nativeToolsPage: true, appearanceStyle: '', copy: labels(), mode: 'competitions', modeIndex: 0, query: '', rows: [] as Row[], error: '', loading: false, personName: '', searched: false },
    onShow() { this.active = true; this.setData({ copy: labels() }); applyNativeAppearance(); miniProgramApi().setNavigationBarTitle({ title: labels().title }); if (this.data.mode !== 'person' || this.data.query) void load(this); },
    onHide() { this.active = false; this.requestId = (this.requestId ?? 0) + 1; },
    onUnload() { this.onHide(); },
    active: false, requestId: 0,
    openTimer() { miniProgramApi().switchTab({ url: '/pages/timer/index' }); },
    changeMode(e: WechatMiniprogram.PickerChange) {
      const index = Number(e.detail.value);
      this.setData({ modeIndex: index, mode: ['competitions', 'records', 'person'][index] ?? 'competitions', rows: [], error: '', personName: '', loading: false, searched: false });
      ++this.requestId;
      if (this.data.mode !== 'person' || this.data.query) void load(this);
    },
    inputQuery(e: WechatMiniprogram.Input) { ++this.requestId; this.setData({ query: e.detail.value, rows: [], error: '', personName: '', loading: false, searched: false }); },
    clearQuery() { ++this.requestId; this.setData({ query: '', rows: [], error: '', loading: false, personName: '', searched: false }); },
    search() { void load(this); },
  } satisfies WechatMiniprogram.Page.Options<ToolPage['data'], WechatMiniprogram.Page.CustomOption>;
}
