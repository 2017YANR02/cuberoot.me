'use client';

/**
 * WcaSourceConfig — settings sub-panel shown when scrambleSource === 'wca'.
 * Lets the user pick HOW real WCA scrambles are drawn:
 *   - 'date': uniformly random across all official scrambles in a date range.
 *   - 'comp': one specific competition, optionally narrowed to a round / group.
 * Writes its state into TimerSettings; the wca_pool reads those to fetch.
 */
import { useEffect, useMemo, useState } from 'react';
import { CompPicker } from '@/components/CompPicker';
import { ClearButton } from '@/components/ClearButton';
import PillToggle from '@/components/PillToggle/PillToggle';
import { Flag } from '@/components/Flag';
import { localizeCompName } from '@/lib/comp-localize';
import type { Comp } from '@/lib/comp-search';
import { fetchWcaScrambles, type WcaScrambleRow } from '@/lib/wca-results-api';
import { roundTypeShort } from '@/lib/comp-schedule';
import { ROUND_ORDER } from '@/lib/wca-round-meta';
import { wcaEventId } from '../_lib/scramble/wca_pool';
import type { EventId } from '../_lib/types';
import type { TimerSettings } from '../_lib/settings';
import { tr } from '@/i18n/tr';
import './wca-source.css';

// WCA history floor (WC1982) — see CLAUDE.md. No scrambles exist before it.
const WCA_MIN_DATE = '1982-06-05';

// 同态项目:打乱可由 God's-number 最优等态打乱作真题的等价替身(同一魔方态,更短)。
// 3x3 纯面转族(333/oh/ft/fm)+ 二阶/金字塔/斜转(各自精确最优 solver)。
// 盲拧/多盲带宽块定向(本地求解的是剥定向后的态,非同态)、sq1(近最优,无 solver 解列)、
// 魔表/五魔(无 solver)都没有最优打乱数据。
const OPTIMAL_EVENTS = new Set(['333', '333oh', '333ft', '333fm', '222', 'pyram', 'skewb']);

interface Props {
  isZh: boolean;
  event: EventId;
  settings: TimerSettings;
  updateSettings: (patch: Partial<TimerSettings>) => void;
}

export default function WcaSourceConfig({ isZh, event, settings, updateSettings }: Props) {
  const wev = wcaEventId(event);
  const hasOptimal = !!wev && OPTIMAL_EVENTS.has(wev); // 同态项目才显示「最优打乱」开关
  const mode = settings.wcaScrambleMode;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // comp mode: fetch the picked comp's scrambles (cached) → which rounds / groups
  // exist for the *current* event. evRows = null until loaded; [] = no such event.
  const [evRows, setEvRows] = useState<WcaScrambleRow[] | null>(null);
  useEffect(() => {
    if (mode !== 'comp' || !settings.wcaComp || !wev) { setEvRows(null); return; }
    let cancelled = false;
    setEvRows(null);
    void fetchWcaScrambles(settings.wcaComp).then((rows) => {
      if (!cancelled) setEvRows((rows ?? []).filter((r) => r.event_id === wev));
    });
    return () => { cancelled = true; };
  }, [mode, settings.wcaComp, wev]);

  const rounds = useMemo(
    () => (evRows
      ? [...new Set(evRows.map((r) => r.round_type_id))].sort((a, b) => (ROUND_ORDER[a] ?? 9) - (ROUND_ORDER[b] ?? 9))
      : []),
    [evRows],
  );
  const groups = useMemo(() => {
    if (!evRows) return [];
    const inRound = evRows.filter((r) => !settings.wcaRound || r.round_type_id === settings.wcaRound);
    return [...new Set(inRound.map((r) => r.group_id).filter(Boolean))].sort();
  }, [evRows, settings.wcaRound]);
  const hasEvent = evRows === null ? null : evRows.length > 0;

  // Reset round/group when they fall outside the loaded comp's options.
  useEffect(() => {
    if (settings.wcaRound && rounds.length > 0 && !rounds.includes(settings.wcaRound)) {
      updateSettings({ wcaRound: '', wcaGroup: '' });
    }
  }, [rounds, settings.wcaRound, updateSettings]);
  useEffect(() => {
    if (settings.wcaGroup && groups.length > 0 && !groups.includes(settings.wcaGroup)) {
      updateSettings({ wcaGroup: '' });
    }
  }, [groups, settings.wcaGroup, updateSettings]);

  const onPick = (c: Comp) => updateSettings({ wcaComp: c.id, wcaCompName: c.name, wcaCompCountry: c.country, wcaRound: '', wcaGroup: '' });
  const onCompText = (v: string) => {
    // typing/clearing the box; clearing also drops the locked-in comp id.
    updateSettings(v ? { wcaCompName: v } : { wcaComp: '', wcaCompName: '', wcaCompCountry: '', wcaRound: '', wcaGroup: '' });
  };
  const clearComp = () => updateSettings({ wcaComp: '', wcaCompName: '', wcaCompCountry: '', wcaRound: '', wcaGroup: '' });

  return (
    <div className="wca-src-config">
      <div className="settings-row">
        <span className="settings-row-label">{tr({ zh: '选源方式', en: 'Draw by' })}</span>
        <span className="settings-row-control">
          <select
            value={mode}
            onChange={(e) => updateSettings({ wcaScrambleMode: e.target.value as 'date' | 'comp' })}
          >
            <option value="date">{tr({ zh: '按日期范围(随机)', en: 'Date range (random)' })}</option>
            <option value="comp">{tr({ zh: '指定比赛', en: 'Specific competition' })}</option>
          </select>
        </span>
      </div>

      {mode === 'date' ? (
        <>
          <div className="settings-row">
            <span className="settings-row-label">{tr({ zh: '日期范围', en: 'Date range' })}</span>
            <span className="settings-row-control wca-src-dates">
              <input
                type="date"
                value={settings.wcaDateFrom}
                min={WCA_MIN_DATE}
                max={settings.wcaDateTo || today}
                onChange={(e) => updateSettings({ wcaDateFrom: e.target.value })}
                aria-label={tr({ zh: '起始日期', en: 'From date' })}
              />
              <span className="wca-src-dash">–</span>
              <input
                type="date"
                value={settings.wcaDateTo}
                min={settings.wcaDateFrom || WCA_MIN_DATE}
                max={today}
                onChange={(e) => updateSettings({ wcaDateTo: e.target.value })}
                aria-label={tr({ zh: '结束日期', en: 'To date' })}
              />
            </span>
          </div>
          <p className="wca-src-hint">
            {(settings.wcaDateFrom || settings.wcaDateTo)
              ? tr({ zh: '在该时间段内的官方打乱中完全随机抽取。', en: 'Uniformly random among official scrambles in this range.' })
              : tr({ zh: '留空 = 全部年份。在所选时间段的官方打乱中完全随机。', en: 'Empty = all years. Uniformly random among official scrambles in the range.' })}
          </p>
        </>
      ) : (
        <>
          <div className="settings-row wca-src-comprow">
            <span className="settings-row-label">{tr({ zh: '比赛', en: 'Competition' })}</span>
            <span className="settings-row-control wca-src-comppick">
              {settings.wcaComp ? (
                // 已锁定一场:展示「国旗 + 比赛名(省略号截断)+ 清除」,避免长名溢出。
                <span className="wca-src-comp-selected">
                  <Flag iso2={settings.wcaCompCountry} className="wca-src-comp-flag" />
                  <span className="wca-src-comp-name">{localizeCompName(settings.wcaComp, settings.wcaCompName, isZh)}</span>
                  <ClearButton
                    variant="standalone"
                    onClick={clearComp}
                    isZh={isZh}
                    ariaLabel={tr({ zh: '清除比赛', en: 'Clear competition' })}
                  />
                </span>
              ) : (
                <CompPicker
                  value={settings.wcaCompName}
                  onChange={onCompText}
                  onPick={onPick}
                  isZh={isZh}
                  hideFuture
                  placeholder={tr({ zh: '搜索 WCA 比赛', en: 'Search a WCA competition' })}
                />
              )}
            </span>
          </div>

          {settings.wcaComp && hasEvent === false && (
            <p className="wca-src-hint wca-src-warn">
              {tr({ zh: '该比赛没有当前项目的打乱,会回退到随机生成。', en: 'This competition has no scrambles for the current event — falls back to generated.' })}
            </p>
          )}

          {settings.wcaComp && hasEvent && (
            <>
              <div className="settings-row">
                <span className="settings-row-label">{tr({ zh: '轮次', en: 'Round' })}</span>
                <span className="settings-row-control">
                  <select
                    value={settings.wcaRound}
                    onChange={(e) => updateSettings({ wcaRound: e.target.value, wcaGroup: '' })}
                  >
                    <option value="">{tr({ zh: '全部轮次', en: 'All rounds' })}</option>
                    {rounds.map((rt) => (
                      <option key={rt} value={rt}>{roundTypeShort(rt, isZh)}</option>
                    ))}
                  </select>
                </span>
              </div>
              <div className="settings-row">
                <span className="settings-row-label">{tr({ zh: '组别', en: 'Group' })}</span>
                <span className="settings-row-control">
                  <select
                    value={settings.wcaGroup}
                    onChange={(e) => updateSettings({ wcaGroup: e.target.value })}
                    disabled={groups.length === 0}
                  >
                    <option value="">{tr({ zh: '全部组别', en: 'All groups' })}</option>
                    {groups.map((g) => (
                      <option key={g} value={g}>{isZh ? `${g} 组` : `Group ${g}`}</option>
                    ))}
                  </select>
                </span>
              </div>
            </>
          )}
        </>
      )}

      {hasOptimal && (
        <>
          <div className="settings-row">
            <span className="settings-row-label">{tr({ zh: '最优打乱', en: 'Optimal scramble'
            })}</span>
            <span className="settings-row-control">
              <PillToggle
                value={settings.wcaUseOptimal}
                onChange={(v) => updateSettings({ wcaUseOptimal: v })}
              />
            </span>
          </div>
          <p className="wca-src-hint">
            {tr({ zh: '用到达同一状态的最短打乱(最优解步数,通常比原始真题短)替代:同一个魔方态,步数更少。三阶/单手/脚拧/最少步、二阶/金字塔/斜转有。', en: 'Use the shortest sequence reaching the same state (optimal length, usually shorter than the original) — same cube, fewer moves. Available for 3×3 / OH / feet / FMC, 2×2, pyraminx and skewb.'
            })}
          </p>
        </>
      )}

      <div className="settings-row wca-src-automark">
        <span className="settings-row-label">{tr({ zh: '自动打卡', en: 'Auto-mark done'
        })}</span>
        <span className="settings-row-control">
          <PillToggle
            value={settings.autoMarkWcaScramble}
            onChange={(v) => updateSettings({ autoMarkWcaScramble: v })}
          />
        </span>
      </div>
      <p className="wca-src-hint">
        {tr({ zh: '做完一把后自动把这条真实打乱标记为「做过」(公开,带成绩),省去每把手动点击。需登录。', en: 'After each solve, auto-mark this real scramble as done (public, with your time) — no manual click per solve. Sign-in required.'
        })}
      </p>
    </div>
  );
}
