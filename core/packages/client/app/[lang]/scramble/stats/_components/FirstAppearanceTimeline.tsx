'use client';

// 「首次出现」时间线:对当前选择(项目 / 配色 / 方法 / 阶段 或 长度口径),
// 把每个步数 / 长度值**第一次**出现的那条打乱按比赛日期升序排成时间轴。
// 复用示例面板那套渲染件(国旗 / 比赛名 / 轮次 / 2D 打乱图),数据来自
// difficulty_first_appearance.json / event_length_first_appearance.json。

import Link from '@/components/AppLink';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { ScramblePreview2D, eventHasScramblePreview } from '@/components/ScramblePreview2D';
import { Flag } from '@/components/Flag';
import { compSourceLine } from '@/lib/comp-schedule';
import { localizeCompName } from '@/lib/comp-localize';
import { compFlagIso2 } from '@/lib/country-flags';
import { COLOR_HEX, type ColorLetter } from '@/components/SubsetColorPicker/SubsetColorPicker';
import { tr } from '@/i18n/tr';

// 复盘器能直接吃的三阶族(示例面板同款白名单)。
const ANALYZER_EVENTS = new Set(['333', '333oh', '333bf', '333fm', '333ft', '333mbf', '333mbo']);

export interface TimelineEntry {
  bin: number;          // 步数(难度)或长度(长度 tab)
  scramble: string;
  color?: string;       // 朝下底色(难度 tab 有)
  previewEvent: string; // ScramblePreview2D 用('333' 或所选项目)
  usageEvent: string;   // EventIcon 用(该打乱实际所属的 WCA 项目)
  compId: string;
  compName: string;
  date: string;         // 展示日期串(ISO 前缀,可带 ~ 范围)
  round: string;
  group: string;
  num: number;
  isExtra: boolean;
}

interface Props {
  entries: TimelineEntry[];
  isZh: boolean;
  lang: 'zh' | 'en';
  // 步数单位:zh 紧贴数字(如 '步'),en 自带前导空格(如 ' moves')。
  unit: { zh: string; en: string };
}

export default function FirstAppearanceTimeline({ entries, isZh, lang, unit }: Props) {
  // 时间轴:按比赛日期升序;同日按步数升序,读起来是「历史逐步解锁」。
  const sorted = [...entries].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.bin - b.bin;
  });

  return (
    <ul className="scramble-timeline">
      {sorted.map((e) => {
        const iso2 = compFlagIso2(e.compId);
        const disp = e.scramble.trim();
        const scrUrl = disp.replace(/ /g, '_');
        const isAnalyzer = ANALYZER_EVENTS.has(e.previewEvent);
        const scrHref = `/${lang}/scramble/analyzer?${new URLSearchParams({ scramble: scrUrl })}`;
        const compHref = `/${lang}/scramble/gen?comp=${encodeURIComponent(e.compId)}`;
        const hasPreview = eventHasScramblePreview(e.previewEvent);
        return (
          <li className="scramble-timeline-item" key={`${e.bin}-${e.compId}-${e.num}`}>
            <div className="scramble-timeline-rail" aria-hidden="true">
              <span className="scramble-timeline-dot" />
            </div>
            <div className="scramble-timeline-content">
              <div className="scramble-timeline-head">
                <span className="scramble-timeline-bin">
                  {e.bin}<span className="scramble-timeline-unit">{tr(unit)}</span>
                </span>
                <span className="scramble-timeline-date">{e.date || tr({ zh: '日期未知', en: 'date unknown' })}</span>
              </div>
              <Link className="scramble-timeline-comp" href={compHref} prefetch={false} title={e.compName}>
                {iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                <span className="scramble-timeline-comp-name">{localizeCompName(e.compId, e.compName, isZh)}</span>
                <span className="scramble-timeline-comp-meta">
                  <EventIcon event={e.usageEvent} className="scramble-timeline-evt" />
                  <span>{compSourceLine(e.round, e.group, e.num, isZh, e.isExtra)}</span>
                </span>
              </Link>
              <div className="scramble-timeline-scr-row">
                {e.color && (
                  <span
                    className="scramble-timeline-chip"
                    style={{ background: COLOR_HEX[e.color as ColorLetter] ?? '#888' }}
                    title={tr({ zh: '朝下的底色', en: 'Bottom color' })}
                  />
                )}
                {hasPreview && (
                  <Link
                    className="scramble-timeline-cube"
                    href={isAnalyzer ? scrHref : compHref}
                    prefetch={false}
                    aria-label={tr({ zh: '打乱图', en: 'Scramble image' })}
                  >
                    <ScramblePreview2D event={e.previewEvent} scramble={disp} size={26} />
                  </Link>
                )}
                {isAnalyzer ? (
                  <Link className="scramble-timeline-scramble" href={scrHref} prefetch={false}>{disp}</Link>
                ) : (
                  <span className="scramble-timeline-scramble">{disp}</span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
