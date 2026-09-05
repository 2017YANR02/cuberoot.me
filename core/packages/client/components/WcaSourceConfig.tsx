'use client';

/** Thin Web host for the shared WCA source + difficulty controls. */
import { useMemo, useState } from 'react';
import { DateRangeInput } from '@/components/DateRangeInput';
import { Flag } from '@/components/Flag';
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
  updateSettings: (patch: Partial<WcaSourceSettings>) => void;
}

export default function WcaSourceConfig({
  disabled,
  event,
  isZh,
  settings,
  toggleSlot,
  updateSettings,
}: Props) {
  const wcaEventId = timerWcaScrambleEventId(event);
  const today = useMemo(() => toLocalIsoDate(), []);
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

  return (
    <div className="wca-src-config">
      <TimerWcaSourceConfig
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
            zh: '该比赛的阶段难度库尚未更新；整体与打乱长度仍可使用。',
            en: 'This competition is not in the stage-difficulty index yet; Full and Length remain available.',
          }),
        }}
        onChange={updateSettings}
        settings={settings}
        topControlsSlot={topControlsSlot}
        toggleSlot={toggleSlot}
        wcaEventId={wcaEventId}
      />
    </div>
  );
}
