'use client';

/** Thin Web host for the shared WCA source + difficulty controls. */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DateRangeInput } from '@/components/DateRangeInput';
import { Flag } from '@/components/Flag';
import { CountryInput } from '@/components/CountryInput/CountryInput';
import { localizeCompName } from '@/lib/comp-localize';
import { loadComps } from '@/lib/comp-search';
import { localizeCity } from '@/lib/city-localize';
import { fetchWcaScrambles } from '@/lib/wca-results-api';
import { webTimerWcaDifficultyAdapter } from '@/lib/timer-wca-difficulty-adapter';
import type { EventId } from '@/app/[lang]/timer/_lib/types';
import { tr } from '@/i18n/tr';
import { toLocalIsoDate } from '@/lib/iso-date';
import {
  TIMER_WCA_MIN_DATE,
  stageLabel,
  timerWcaRoundShortLabel,
  timerWcaScrambleEventId,
  variantLabel,
  type TimerWcaSourceSettings,
} from '@cuberoot/shared/timer';
import {
  TimerWcaDifficultyConfig,
  TimerWcaSourceConfig,
  type TimerWcaSourceDataAdapter,
} from '@cuberoot/timer-ui';
import './wca-source.css';

export type WcaSourceSettings = TimerWcaSourceSettings;

interface Props {
  disabled?: boolean;
  event: EventId;
  isZh: boolean;
  settings: WcaSourceSettings;
  toggleSlot?: HTMLElement | null;
  mergeSlot?: HTMLElement | null;
  /** undefined renders inline; null waits for the WCA submenu to open. */
  sourceSlot?: HTMLElement | null;
  updateSettings: (patch: Partial<WcaSourceSettings>) => void;
}

export default function WcaSourceConfig({
  disabled,
  event,
  isZh,
  settings,
  toggleSlot,
  mergeSlot,
  sourceSlot,
  updateSettings,
}: Props) {
  const wcaEventId = timerWcaScrambleEventId(event);
  const [today, setToday] = useState('');
  useEffect(() => setToday(toLocalIsoDate()), []);
  const [period, setPeriod] = useState('all');
  const [country, setCountry] = useState('');
  const periodFrom = useMemo(() => {
    if (!today || period === 'all') return '';
    const [year, month, day] = today.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    // Inclusive calendar-day ranges; local fields avoid timezone/DST shifts.
    date.setDate(date.getDate() - Number(period) + 1);
    return toLocalIsoDate(date);
  }, [period, today]);
  const [topControlsSlot, setTopControlsSlot] = useState<HTMLSpanElement | null>(null);
  const sourceAdapter = useMemo<TimerWcaSourceDataAdapter>(() => ({
    async loadCompetitions() {
      const competitions = await loadComps();
      return competitions.map((competition) => ({
        id: competition.id,
        name: competition.name,
        displayName: localizeCompName(competition.id, competition.name, isZh, {
          date: competition.start_date,
        }),
        selectedDisplayName: localizeCompName(competition.id, competition.name, isZh),
        city: competition.city,
        displayCity: competition.city
          ? localizeCity(competition.city, isZh, competition.country)
          : undefined,
        country: competition.country,
        startDate: competition.start_date,
        endDate: competition.end_date,
      }));
    },
    async loadCompetitionScrambles(competitionId, signal) {
      const rows = await fetchWcaScrambles(competitionId, signal);
      return rows?.map((row) => ({
        eventId: row.event_id,
        groupId: row.group_id,
        roundTypeId: row.round_type_id,
      })) ?? null;
    },
  }), [isZh]);

  const sourceControls = (
      <TimerWcaSourceConfig
        popupContainer={sourceSlot ?? undefined}
        competitionFilters={{
          from: periodFrom,
          country,
          render: (countries) => (
            <fieldset className="wca-src-filters" disabled={disabled} aria-label={tr({ zh: '筛选比赛', en: 'Filter competitions' })}>
              <select
                className="timer-wca-source-select"
                aria-label={tr({ zh: '时间范围', en: 'Time range' })}
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              >
                <option value="all">{tr({ zh: '全部时间', en: 'All time' })}</option>
                <option value="7">{tr({ zh: '近一周', en: 'Past week' })}</option>
                <option value="30">{tr({ zh: '近一个月', en: 'Past month' })}</option>
                <option value="365">{tr({ zh: '近一年', en: 'Past year' })}</option>
              </select>
              <CountryInput
                ariaLabel={tr({ zh: '国家', en: 'Country' })}
                placeholder={tr({ zh: '全部国家', en: 'All countries' })}
                allLabel={tr({ zh: '全部国家', en: 'All countries' })}
                restrictTo={country ? [...new Set([...countries, country])] : countries}
                value={country}
                onChange={(iso2) => setCountry(iso2.toUpperCase())}
              />
            </fieldset>
          ),
        }}
        adapter={sourceAdapter}
        disabled={disabled}
        competitionDisplayName={(competitionId, canonicalName) => (
          localizeCompName(competitionId, canonicalName, isZh)
        )}
        labels={{
          all: tr({ zh: '全部', en: 'All' }),
          clearCompetition: tr({ zh: '清除比赛', en: 'Clear competition' }),
          comp: tr({ zh: '比赛', en: 'Comp' }),
          competitionListFailed: tr({ zh: '无法加载比赛列表。', en: 'Could not load competitions.' }),
          competitionListLoading: tr({ zh: '正在加载比赛…', en: 'Loading competitions…' }),
          competitionSearch: tr({ zh: '搜索比赛', en: 'Search competition' }),
          competitionScramblesFailed: tr({
            zh: '无法加载该比赛的轮次与组别。',
            en: 'Could not load this competition’s rounds and groups.',
          }),
          competitionScramblesLoading: tr({
            zh: '正在加载轮次与组别…',
            en: 'Loading rounds and groups…',
          }),
          date: tr({ zh: '日期', en: 'Date' }),
          dateRange: tr({ zh: '日期范围', en: 'Date range' }),
          group: tr({ zh: '组别', en: 'Group' }),
          groupOption: (group) => tr({ zh: `${group} 组`, en: `Group ${group}` }),
          noEventScrambles: tr({
            zh: '该比赛没有当前项目的打乱。',
            en: 'This competition has no scrambles for the current event.',
          }),
          noMatchingCompetitions: tr({ zh: '没有匹配的比赛。', en: 'No matching competitions.' }),
          retry: tr({ zh: '重试', en: 'Try again' }),
          round: tr({ zh: '轮次', en: 'Round' }),
          sourceMode: tr({ zh: '真题范围', en: 'Real-scramble range' }),
        }}
        maxDate={today}
        minDate={TIMER_WCA_MIN_DATE}
        onChange={updateSettings}
        renderCountry={(country) => <Flag iso2={country} />}
        renderDateRange={(props) => (
          <DateRangeInput
            ariaLabel={props.ariaLabel}
            className="settings-row-control wca-src-dates"
            disabled={props.disabled}
            from={props.from}
            max={props.max}
            min={props.min}
            onChange={props.onChange}
            size="compact"
            to={props.to}
          />
        )}
        roundLabel={timerWcaRoundShortLabel}
        settings={settings}
        trailingControls={<span className="wca-src-shared-controls" ref={setTopControlsSlot} />}
        wcaEventId={wcaEventId}
      />
  );
  return (
    <div className="wca-src-config">
      {sourceSlot === undefined ? sourceControls : sourceSlot && createPortal(sourceControls, sourceSlot)}
      <TimerWcaDifficultyConfig
        adapter={webTimerWcaDifficultyAdapter}
        disabled={disabled}
        language={isZh ? 'zh' : 'en'}
        labels={{
          colorSubsetAriaLabel: tr({ zh: '底色子集', en: 'Color subset' }),
          difficulty: tr({ zh: '难度', en: 'Difficulty' }),
          difficultyAriaLabel: tr({ zh: '难度过滤', en: 'Difficulty filter' }),
          merge: tr({ zh: '合并', en: 'Merge' }),
          mergeAriaLabel: tr({ zh: '合并 3×3 全族真题', en: 'Merge all 3×3-family scrambles' }),
          mergeHelp: tr({
            zh: '开启后，从整个 3×3 族的真题中按难度取题；关闭后只取当前项目。',
            en: 'On draws by difficulty from the whole 3×3 family; off uses only this event.',
          }),
          methodAriaLabel: tr({ zh: '方法', en: 'Method' }),
          methodLabel: (key) => variantLabel(key, isZh),
          rangeAriaLabel: tr({ zh: '步数范围', en: 'Step range' }),
          scrambleLengthRangeAriaLabel: tr({ zh: '打乱长度范围', en: 'Scramble length range' }),
          stageAriaLabel: tr({ zh: '阶段', en: 'Stage' }),
          stageLabel: (key) => stageLabel(key, isZh),
          unindexedCompetition: tr({
            zh: '该比赛阶段难度数据待更新。可将方法改为「打乱」，或选「不限难度」；也可关闭窗口，在「真题」中更换比赛。',
            en: 'Stage difficulty data is not ready for this competition. Choose Length or Any difficulty, or close this window and select another competition in the Real menu.',
          }),
        }}
        onChange={updateSettings}
        settings={settings}
        topControlsSlot={topControlsSlot}
        toggleSlot={toggleSlot}
        mergeSlot={mergeSlot}
        wcaEventId={wcaEventId}
      />
    </div>
  );
}
