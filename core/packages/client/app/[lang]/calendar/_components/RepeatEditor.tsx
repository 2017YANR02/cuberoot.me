'use client';

// 重复规则编辑器 —— 上面一个下拉给常用档(不重复 / 每天 / 每周的今天 / 每月的这天 / 每年),
// 选「自定义」才展开细节。规则本身是 RFC 5545 的 RRULE 字符串,解析 / 序列化在
// @cuberoot/shared/recur,这里只做人话 ↔ 规则的双向翻译。

import { useMemo, useState } from 'react';
import { DateInput } from '@/components/DateInput';
import { ListSelect } from '@/components/ListSelect';
import { tr } from '@/i18n/tr';
import {
  formatRRule, parseRRule, WEEKDAY_CODES, weekdayOf,
  type Freq, type RRule,
} from '@cuberoot/shared/recur';
import { wallPartsIn } from '@cuberoot/shared/tz';

interface Props {
  /** 当前规则(空串 = 不重复) */
  value: string;
  onChange: (rrule: string) => void;
  /** 首次发生的时刻,决定「每周的今天」是周几 */
  start: number;
  tz: string;
}

const WEEKDAY_NARROW = [
  { zh: '日', en: 'S' }, { zh: '一', en: 'M' }, { zh: '二', en: 'T' }, { zh: '三', en: 'W' },
  { zh: '四', en: 'T' }, { zh: '五', en: 'F' }, { zh: '六', en: 'S' },
];
const WEEKDAY_FULL = [
  { zh: '周日', en: 'Sunday' }, { zh: '周一', en: 'Monday' }, { zh: '周二', en: 'Tuesday' },
  { zh: '周三', en: 'Wednesday' }, { zh: '周四', en: 'Thursday' }, { zh: '周五', en: 'Friday' },
  { zh: '周六', en: 'Saturday' },
];

/** 预设档的 key;custom 表示展开细节面板。 */
type Preset = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'weekday' | 'custom';

function presetRule(preset: Preset, start: number, tz: string): string {
  const w = wallPartsIn(tz, new Date(start));
  const wd = weekdayOf(w.y, w.mo, w.d);
  switch (preset) {
    case 'daily': return 'FREQ=DAILY';
    case 'weekly': return `FREQ=WEEKLY;BYDAY=${WEEKDAY_CODES[wd]}`;
    case 'weekday': return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    case 'monthly': return `FREQ=MONTHLY;BYMONTHDAY=${w.d}`;
    case 'yearly': return 'FREQ=YEARLY';
    default: return '';
  }
}

/** 现有规则落在哪个预设上;认不出就是「自定义」。 */
function detectPreset(rrule: string, start: number, tz: string): Preset {
  if (!rrule) return 'none';
  for (const p of ['daily', 'weekly', 'weekday', 'monthly', 'yearly'] as Preset[]) {
    if (presetRule(p, start, tz) === rrule) return p;
  }
  return 'custom';
}

/** 英文序数后缀:1st / 2nd / 3rd / 4th。 */
function ordinal(n: number): string {
  return `${n}${['st', 'nd', 'rd'][n - 1] ?? 'th'}`;
}

/** 规则 → 一句人话(下拉摘要与只读处共用)。 */
export function describeRule(rrule: string): string {
  const r = parseRRule(rrule);
  if (!r) return tr({ zh: '不重复', en: 'Does not repeat' });
  const unit: Record<Freq, { zh: string; en: string }> = {
    DAILY: { zh: '天', en: 'day' },
    WEEKLY: { zh: '周', en: 'week' },
    MONTHLY: { zh: '个月', en: 'month' },
    YEARLY: { zh: '年', en: 'year' },
  };
  // 间隔为 1 时中文说「每月」,带数量才说「每 2 个月」—— 「每个月」和预设里的「每月 1 号」不齐。
  const oneZh: Record<Freq, string> = { DAILY: '天', WEEKLY: '周', MONTHLY: '月', YEARLY: '年' };
  const everyZh = r.interval > 1 ? `每 ${r.interval} ${unit[r.freq].zh}` : `每${oneZh[r.freq]}`;
  const everyEn = r.interval > 1
    ? `Every ${r.interval} ${unit[r.freq].en}s`
    : `Every ${unit[r.freq].en}`;

  // 中文两处不能直译:每周 + 周六 要缩成「每周六」(间隔 >1 时才留「每 2 周 周六」),
  // 「第 N 个周一」前面是「的」不是空格。英文照 Google 的 "Every week on Mon, Wed"。
  let zh = everyZh;
  let en = everyEn;
  if (r.freq === 'WEEKLY' && r.byDay.length) {
    const days = r.byDay.map((b) => WEEKDAY_FULL[b.weekday].zh).join('、');
    zh = r.interval > 1 ? `${everyZh} ${days}` : `每${days}`;
    en = `${everyEn} on ${r.byDay.map((b) => WEEKDAY_FULL[b.weekday].en.slice(0, 3)).join(', ')}`;
  } else if (r.freq === 'MONTHLY' && r.byDay.some((b) => b.nth !== 0)) {
    const b = r.byDay[0];
    zh = `${everyZh}的${b.nth === -1 ? '最后一个' : `第 ${b.nth} 个`}${WEEKDAY_FULL[b.weekday].zh}`;
    en = `${everyEn} on the ${b.nth === -1 ? 'last' : ordinal(b.nth)} ${WEEKDAY_FULL[b.weekday].en}`;
  } else if (r.freq === 'MONTHLY' && r.byMonthDay.length) {
    zh = `${everyZh} ${r.byMonthDay.join('、')} 号`;
    en = `${everyEn} on day ${r.byMonthDay.join(', ')}`;
  }
  const every = tr({ zh, en });

  let end = '';
  if (r.count > 0) end = tr({ zh: `,共 ${r.count} 次`, en: `, ${r.count} times` });
  else if (r.until > 0) {
    const key = new Date(r.until).toISOString().slice(0, 10);
    end = tr({ zh: `,到 ${key}`, en: `, until ${key}` });
  }
  return `${every}${end}`;
}

export default function RepeatEditor({ value, onChange, start, tz }: Props) {
  // 「自定义」不能只靠规则串推:选它之后给的默认规则(每周的今天)本身就是一个预设,
  // detectPreset 会把它认回 'weekly',面板刚要展开就被收回去。所以「用户点开了自定义」
  // 是一份独立状态,只有再选回某个预设时才落下。
  const [forceCustom, setForceCustom] = useState(false);
  const detected = detectPreset(value, start, tz);
  const preset: Preset = forceCustom || detected === 'custom' ? 'custom' : detected;
  const rule = useMemo(() => parseRRule(value), [value]);
  const startWall = useMemo(() => wallPartsIn(tz, new Date(start)), [tz, start]);
  const startWd = weekdayOf(startWall.y, startWall.mo, startWall.d);
  const nthOfMonth = Math.floor((startWall.d - 1) / 7) + 1;

  const patch = (p: Partial<RRule>): void => {
    const base: RRule = rule ?? { freq: 'WEEKLY', interval: 1, byDay: [], byMonthDay: [], count: 0, until: 0 };
    onChange(formatRRule({ ...base, ...p }));
  };

  const items = [
    { value: 'none', label: tr({ zh: '不重复', en: 'Does not repeat' }) },
    { value: 'daily', label: tr({ zh: '每天', en: 'Daily' }) },
    {
      value: 'weekly',
      label: tr({
        zh: `每${WEEKDAY_FULL[startWd].zh}`,
        en: `Weekly on ${WEEKDAY_FULL[startWd].en}`,
      }),
    },
    { value: 'weekday', label: tr({ zh: '每个工作日(周一至周五)', en: 'Every weekday (Mon–Fri)' }) },
    { value: 'monthly', label: tr({ zh: `每月 ${startWall.d} 号`, en: `Monthly on day ${startWall.d}` }) },
    { value: 'yearly', label: tr({ zh: '每年', en: 'Annually' }) },
    { value: 'custom', label: tr({ zh: '自定义…', en: 'Custom…' }) },
  ];

  const endMode = rule && rule.count > 0 ? 'count' : rule && rule.until > 0 ? 'until' : 'never';
  const untilKey = rule && rule.until > 0 ? new Date(rule.until).toISOString().slice(0, 10) : '';

  return (
    <div className="cal-repeat">
      <ListSelect
        items={items}
        value={preset}
        allLabel={tr({ zh: '不重复', en: 'Does not repeat' })}
        clearable={false}
        onChange={(next) => {
          if (next === 'custom') {
            setForceCustom(true);
            // 从「不重复」直接切自定义:给一条每周的默认规则,免得面板全空。
            onChange(value || presetRule('weekly', start, tz));
            return;
          }
          setForceCustom(false);
          onChange(presetRule(next as Preset, start, tz));
        }}
      />

      {preset === 'custom' && rule && (
        <div className="cal-repeat-custom">
          <div className="cal-field-row">
            <span className="cal-field-label">{tr({ zh: '重复间隔', en: 'Repeat every' })}</span>
            <input
              type="number"
              min={1}
              max={99}
              className="cal-num"
              value={rule.interval}
              onChange={(e) => patch({ interval: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })}
            />
            <ListSelect
              items={[
                { value: 'DAILY', label: tr({ zh: '天', en: 'day' }) },
                { value: 'WEEKLY', label: tr({ zh: '周', en: 'week' }) },
                { value: 'MONTHLY', label: tr({ zh: '月', en: 'month' }) },
                { value: 'YEARLY', label: tr({ zh: '年', en: 'year' }) },
              ]}
              value={rule.freq}
              allLabel=""
              clearable={false}
              onChange={(f) => patch({ freq: f as Freq, byDay: [], byMonthDay: [] })}
            />
          </div>

          {rule.freq === 'WEEKLY' && (
            <div className="cal-field-row">
              <span className="cal-field-label">{tr({ zh: '在这些天', en: 'Repeat on' })}</span>
              <div className="cal-weekdays">
                {WEEKDAY_CODES.map((code, i) => {
                  const on = rule.byDay.some((b) => b.weekday === i);
                  return (
                    <button
                      key={code}
                      type="button"
                      className={`cal-weekday${on ? ' is-on' : ''}`}
                      aria-pressed={on}
                      aria-label={tr(WEEKDAY_FULL[i])}
                      onClick={() => {
                        const next = on
                          ? rule.byDay.filter((b) => b.weekday !== i)
                          : [...rule.byDay, { weekday: i, nth: 0 }].sort((a, b) => a.weekday - b.weekday);
                        // 一个都不留会退化成「按首次那天」,等价于点回原来那天。
                        patch({ byDay: next.length ? next : [{ weekday: startWd, nth: 0 }] });
                      }}
                    >
                      {tr(WEEKDAY_NARROW[i])}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {rule.freq === 'MONTHLY' && (
            <div className="cal-field-row">
              <span className="cal-field-label">{tr({ zh: '按', en: 'Repeat by' })}</span>
              <ListSelect
                items={[
                  { value: 'date', label: tr({ zh: `每月 ${startWall.d} 号`, en: `Day ${startWall.d} of the month` }) },
                  {
                    value: 'nth',
                    label: tr({
                      zh: `第 ${nthOfMonth} 个${WEEKDAY_FULL[startWd].zh}`,
                      en: `The ${ordinal(nthOfMonth)} ${WEEKDAY_FULL[startWd].en}`,
                    }),
                  },
                  {
                    value: 'last',
                    label: tr({
                      zh: `最后一个${WEEKDAY_FULL[startWd].zh}`,
                      en: `The last ${WEEKDAY_FULL[startWd].en}`,
                    }),
                  },
                ]}
                value={rule.byDay.some((b) => b.nth === -1) ? 'last' : rule.byDay.some((b) => b.nth > 0) ? 'nth' : 'date'}
                allLabel=""
                clearable={false}
                onChange={(mode) => {
                  if (mode === 'date') patch({ byDay: [], byMonthDay: [startWall.d] });
                  else if (mode === 'last') patch({ byDay: [{ weekday: startWd, nth: -1 }], byMonthDay: [] });
                  else patch({ byDay: [{ weekday: startWd, nth: nthOfMonth }], byMonthDay: [] });
                }}
              />
            </div>
          )}

          <div className="cal-field-row">
            <span className="cal-field-label">{tr({ zh: '结束', en: 'Ends' })}</span>
            <ListSelect
              items={[
                { value: 'never', label: tr({ zh: '永不', en: 'Never' }) },
                { value: 'until', label: tr({ zh: '在某天', en: 'On date' }) },
                { value: 'count', label: tr({ zh: '若干次后', en: 'After N times' }) },
              ]}
              value={endMode}
              allLabel=""
              clearable={false}
              onChange={(m) => {
                if (m === 'never') patch({ count: 0, until: 0 });
                else if (m === 'count') patch({ count: 10, until: 0 });
                else patch({ count: 0, until: start + 90 * 86_400_000 });
              }}
            />
            {endMode === 'until' && (
              <DateInput
                className="cal-date-field"
                value={untilKey}
                onChange={(value) => {
                  const [y, mo, d] = value.split('-').map(Number);
                  if (!y || !mo || !d) return;
                  // UNTIL 取当天 23:59:59Z,保证那天的最后一次也算在内。
                  patch({ count: 0, until: Date.UTC(y, mo - 1, d, 23, 59, 59) });
                }}
              />
            )}
            {endMode === 'count' && (
              <input
                type="number"
                min={1}
                max={730}
                className="cal-num"
                value={rule.count}
                onChange={(e) => patch({ count: Math.max(1, Math.min(730, Number(e.target.value) || 1)), until: 0 })}
              />
            )}
          </div>

          <p className="cal-repeat-summary">{describeRule(value)}</p>
        </div>
      )}
    </div>
  );
}
