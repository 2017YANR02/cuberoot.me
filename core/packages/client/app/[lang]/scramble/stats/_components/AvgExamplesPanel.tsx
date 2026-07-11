'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { Flag } from '@/components/Flag';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { compFlagIso2 } from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';
import { roundTypeShort } from '@/lib/comp-schedule';
import { COLOR_HEX, type ColorLetter } from '@/components/SubsetColorPicker/SubsetColorPicker';
import { tr } from '@/i18n/tr';

// 一条「示例组」:某 (comp,event,round,group) 的成员打乱 + 该阶段/子集下的组平均。
// mean/cnt 由页面按当前 (variant,stage,subset,备打) 从成员步数重算得来(与直方图同口径)。
export interface AvgGroupCase {
  comp: string;
  event: string;
  round: string;
  group: string;
  mean: number;
  cnt: number;
  members: { scr: string; num: number; extra: boolean; val: number; bottomColor: ColorLetter }[];
}

const MEMBERS_SHOWN = 12; // 大组(多盲数十条)只展示前 N 条,平均仍按全部算
const CASES_INITIAL = 24; // 先展示前 N 个组,更多点「展开全部」

export default function AvgExamplesPanel({
  cases, comps, lang, isZh, selectedBin, fullCount, loading, errorText, eventLabel,
}: {
  cases: AvgGroupCase[] | null;
  comps: Record<string, [string, string]> | undefined;
  lang: 'zh' | 'en';
  isZh: boolean;
  selectedBin: number | null;
  fullCount: number;           // 该 bin 全量组数(直方图口径),判定「完整 / 抽样」
  loading: boolean;
  errorText: string | null;
  eventLabel: (e: string) => string;
}) {
  const analyzerHref = (scr: string) =>
    `/${lang}/scramble/analyzer?${new URLSearchParams({ scramble: scr.trim().replace(/ /g, '_') })}`;

  const [showAll, setShowAll] = useState(false);
  useEffect(() => { setShowAll(false); }, [selectedBin]);
  // 分片里该 bin 的组是否 = 全量(完整)。稀有头尾 bin 完整;常见中间 bin 是抽样(分片少于全量)。
  const matched = cases?.length ?? 0;
  const isComplete = matched >= fullCount;
  const shownCases = cases ? (showAll ? cases : cases.slice(0, CASES_INITIAL)) : null;

  return (
    <div className="scramble-stats-panel scramble-stats-avg-cases-panel">
      <div className="scramble-stats-examples-header">
        <span className="scramble-stats-panel-title">
          {selectedBin !== null && !loading && !errorText && cases && cases.length > 0
            ? (isComplete
                ? tr({ zh: `共 ${matched} 组,全部列出`, en: `All ${matched} groups` })
                : tr({ zh: `示例 ${matched} / ${fullCount} 组`, en: `${matched} of ${fullCount} groups` }))
            : tr({ zh: '示例组', en: 'Example groups' })}
        </span>
      </div>

      {selectedBin === null && (
        <div className="scramble-stats-examples-hint">{tr({ zh: '点柱子看该平均值的比赛组', en: 'Click a bar to see competition groups at that average' })}</div>
      )}
      {selectedBin !== null && loading && (
        <div className="scramble-stats-examples-hint">{tr({ zh: '加载中…', en: 'Loading…' })}</div>
      )}
      {selectedBin !== null && errorText && (
        <div className="scramble-stats-examples-hint">{tr({ zh: '加载失败', en: 'Load failed' })}: {errorText}</div>
      )}
      {selectedBin !== null && !loading && !errorText && cases && cases.length === 0 && (
        <div className="scramble-stats-examples-hint">{tr({ zh: '此平均值下暂无比赛组', en: 'No competition groups at this average' })}</div>
      )}

      {selectedBin !== null && !loading && !errorText && shownCases && shownCases.length > 0 && (
        <div className="scramble-stats-avg-cases">
          {shownCases.map((c, ci) => {
            const comp = comps?.[c.comp];
            const iso2 = compFlagIso2(c.comp);
            const grpLabel = c.group ? tr({ zh: ` ${c.group}组`, en: ` ${c.group}` }) : '';
            const roundGrp = `${roundTypeShort(c.round, isZh)}${grpLabel}`;
            const shown = c.members.slice(0, MEMBERS_SHOWN);
            const hidden = c.members.length - shown.length;
            return (
              <div className="scramble-stats-avg-case" key={ci}>
                <div className="scramble-stats-avg-case-head">
                  <Link
                    className="scramble-stats-examples-comp"
                    href={`/${lang}/scramble/gen?comp=${encodeURIComponent(c.comp)}`}
                    prefetch={false}
                    title={comp?.[0] ?? c.comp}
                  >
                    {iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                    <span className="scramble-stats-examples-comp-name">{localizeCompName(c.comp, comp?.[0] ?? c.comp, isZh)}</span>
                    <span className="scramble-stats-examples-comp-meta">
                      <EventIcon event={c.event} className="scramble-stats-examples-evt" title={eventLabel(c.event)} />
                      <span>{roundGrp}</span>
                    </span>
                  </Link>
                </div>
                <ul className="scramble-stats-avg-members">
                  {shown.map((m, mi) => {
                    const disp = m.scr.trim();
                    return (
                      <li key={mi}>
                        <span
                          className="scramble-stats-examples-chip"
                          style={{ background: COLOR_HEX[m.bottomColor] ?? '#888' }}
                          title={tr({ zh: '朝下的底色', en: 'Bottom color' })}
                        />
                        <Link className="scramble-stats-examples-cube" href={analyzerHref(disp)} prefetch={false} aria-label={tr({ zh: '打乱图', en: 'Scramble image' })}>
                          <ScramblePreview2D event="333" scramble={disp} size={24} />
                        </Link>
                        <Link className="scramble-stats-examples-scramble scramble-stats-avg-mscr" href={analyzerHref(disp)} prefetch={false}>
                          {disp}
                        </Link>
                        <span className="scramble-stats-avg-mval" title={tr({ zh: '该成员步数', en: 'Member move count' })}>{m.val}</span>
                      </li>
                    );
                  })}
                  {hidden > 0 && (
                    <li className="scramble-stats-avg-more">{tr({ zh: `… 另 ${hidden} 条`, en: `… ${hidden} more` })}</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {selectedBin !== null && !loading && !errorText && cases && cases.length > CASES_INITIAL && !showAll && (
        <button type="button" className="scramble-stats-avg-expand" onClick={() => setShowAll(true)}>
          {tr({ zh: `展开全部 ${cases.length} 组`, en: `Show all ${cases.length} groups` })}
        </button>
      )}
    </div>
  );
}
