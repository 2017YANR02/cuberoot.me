import { useEffect, useMemo, useState } from 'react';
import { RecordBadge } from '@/components/RecordBadge';
import AppLink from '@/components/AppLink';
import { AchievementBadge } from './AchievementBadge';
import { formatWcaResult } from '@/lib/wca-format-result';
import { formatDateRangeIso } from '@/lib/wca-date';
import { CompCell } from '@/components/CompCell/CompCell';
import { useT } from '@/hooks/useT';
import { apiUrl } from '@/lib/api-base';
import { eventDisplayName } from '@/lib/wca-events';
import { ALL_EVENT_IDS, CANCELLED_EVENT_IDS } from '@/lib/event-constants';
import { CONTINENT_RECORD_ABBR } from '@/lib/continent';
import { fetchWcaPersonChampionshipPodiums, type ChampionshipPodiumRow, type WcaCompetition, type WcaPersonProfile, type WcaResultRow } from '@/lib/wca-person-api';
import './person-achievements.css';
import { EXPLORER_ACHIEVEMENTS, personalExplorerAchievements, fetchExplorerAchievements, type ExplorerAchievement } from '@/lib/person-achievements';

interface Achievement {
  wcaId: string;
  eventId: string;
  isOnlyFirst: boolean;
}

export function GrandSlamBadges({ rows, wcaId, isZh, records = {}, podiums = [], results = [], comps = [], countryIso2 = '', extraAchievements = [] }: {
  rows: Achievement[]; wcaId: string; isZh: boolean;
  records?: WcaPersonProfile['personal_records'];
  podiums?: (Pick<ChampionshipPodiumRow, 'level' | 'place' | 'eventId'> & Partial<ChampionshipPodiumRow>)[];
  results?: WcaResultRow[];
  comps?: WcaCompetition[];
  countryIso2?: string;
  extraAchievements?: ExplorerAchievement[];
}) {
  const t = useT();
  const explorer = useMemo(() => [...personalExplorerAchievements(results, comps, countryIso2, podiums), ...extraAchievements], [results, comps, countryIso2, podiums, extraAchievements]);
  const achievements = rows.filter(row => row.wcaId === wcaId);
  const compNames = new Map(comps.map(comp => [comp.id, comp.name]));
  const official = results.filter(row => !row.live && row.competition_id && row.event_id);
  // A DNF is a participation; DNS-only rows are not. Multiple rounds count once.
  const attended = new Set(official.filter(row => row.best > 0 || row.best === -1).map(row => row.competition_id));
  const completed = new Set(official.filter(row => row.best > 0).map(row => row.event_id));
  const activeEvents = ALL_EVENT_IDS.filter(event => !CANCELLED_EVENT_IDS.has(event));
  const allEvents = activeEvents.every(event => completed.has(event));
  const hundred = attended.size >= 100;
  // Only official, positive results with recognized record markers qualify.
  // Keep historical retired events; deduplicate singles, averages and repeat records.
  const historical = new Map<string, { event: string; kind: 'historicalWR' | 'historicalCR' | 'historicalNR'; history: { row: WcaResultRow; type: 'single' | 'average'; marker: string; value: number }[] }>();
  for (const row of results) {
    if (row.live || !row.event_id) continue;
    for (const [value, marker, type] of [[row.best, row.regional_single_record, 'single'], [row.average, row.regional_average_record, 'average']] as const) {
      if (!(value > 0) || !marker) continue;
      const level = marker === 'WR' || marker === 'NR' ? marker
        : marker === 'CR' || Object.values(CONTINENT_RECORD_ABBR).includes(marker) ? 'CR' : null;
      if (!level) continue;
      const kind = `historical${level}` as const;
      const key = `${row.event_id}:${kind}`;
      const entry = historical.get(key) ?? { event: row.event_id, kind, history: [] };
      entry.history.push({ row, type, marker, value });
      historical.set(key, entry);
    }
  }
  const champions = [...new Set(podiums.filter(row => row.level === 'world' && row.place === 1).map(row => row.eventId))];
  const currentRecords = Object.entries(records).flatMap(([event, results]) =>
    CANCELLED_EVENT_IDS.has(event) ? [] : (['single', 'average'] as const)
      .filter(type => results[type]?.world_rank === 1 && results[type]!.best > 0)
      .map(type => `${eventDisplayName(event, isZh)} ${type === 'single' ? t('单次', 'Single') : t('平均', 'Average')} ${formatWcaResult(results[type]!.best, event, type)}`));
  if (!achievements.length && !champions.length && !currentRecords.length && !historical.size && !hundred && !allEvents && !explorer.length) return null;
  return (
    <section className="wp-achievements" aria-label={t('成就', 'Achievements')}>
      <div className="wp-achievements-list">
        {explorer.map(a => <AchievementBadge key={`${a.kind}:${a.event}:${a.record}`} kind={a.kind} event={a.event} achievement={a}
          name={[a.event ? eventDisplayName(a.event, isZh) : '', a.record].filter(Boolean).join(' ')}
          description={t(EXPLORER_ACHIEVEMENTS[a.kind].description.zh, EXPLORER_ACHIEVEMENTS[a.kind].description.en)}>
          {!!a.evidence.length && <ol>{a.evidence.map((e, i) => <li key={i}>
            {e.event && <strong>{eventDisplayName(e.event, isZh)} </strong>}
            {e.value && e.event && <span>{formatWcaResult(e.value, e.event, e.type ?? 'single')} </span>}
            {e.text && <span>{e.text} </span>}
            {e.place && <span>{t(`第 ${e.place} 名`, `Place ${e.place}`)} </span>}
            {e.date && <time>{formatDateRangeIso(e.date, e.endDate)}</time>}
            {e.compId && <div><AppLink href={`/wca/comp/${e.compId}`} prefetch={false}><CompCell compId={e.compId} compName={compNames.get(e.compId)} isZh={isZh} noFlag date={null} /></AppLink></div>}
          </li>)}</ol>}
          <AppLink href={`/wca/${EXPLORER_ACHIEVEMENTS[a.kind].stat}`} prefetch={false}>{t('查看相关统计', 'View related statistics')}</AppLink>
        </AchievementBadge>)}
        {hundred && <AchievementBadge kind="hundred" description={t('参加过至少 100 场正式 WCA 比赛。', 'Participated in at least 100 official WCA competitions.')}>
          <p>{t(`已参加 ${attended.size} 场比赛`, `${attended.size} competitions attended`)}</p>
        </AchievementBadge>}
        {allEvents && <AchievementBadge kind="allEvents" description={t('所有现役 WCA 项目均有正式有效单次成绩。', 'An official successful single in every active WCA event.')}>
          <ul>{activeEvents.map(event => <li key={event}>{eventDisplayName(event, isZh)}</li>)}</ul>
        </AchievementBadge>}
        {!!champions.length && <AchievementBadge kind="champion" description={t('在 WCA 世锦赛中获得项目冠军。', 'Won an event at a WCA World Championship.')}>
          <ul>{champions.map(event => <li key={event}>{eventDisplayName(event, isZh)}</li>)}</ul>
          <AppLink href="/wca/world_championship_podiums_by_person" prefetch={false}>{t('世锦赛奖牌榜', 'World Championship medals')}</AppLink>
        </AchievementBadge>}
        {!!currentRecords.length && <AchievementBadge kind="wr" description={t('当前单次或平均世界排名第一。', 'Currently ranked first in the world for single or average.')}>
          <ul>{currentRecords.map(detail => <li key={detail}>{detail}</li>)}</ul>
        </AchievementBadge>}
        {[...historical.values()].sort((a, b) => a.event.localeCompare(b.event) || ['historicalWR', 'historicalCR', 'historicalNR'].indexOf(a.kind) - ['historicalWR', 'historicalCR', 'historicalNR'].indexOf(b.kind)).map(({ event, kind, history }) => (
          <AchievementBadge key={event + kind} kind={kind} event={event} recordCount={history.length} name={eventDisplayName(event, isZh)} description={t('正式比赛中获得过的纪录。', 'Records achieved in official competitions.')}>
            <h4>{t('纪录历程', 'Record history')}</h4>
            <ol>{history.map(({ row, type, marker, value }, index) => <li key={index}>
              <div className="wp-achievement-result"><RecordBadge record={marker} /><strong>{formatWcaResult(value, event, type)}</strong><span>{type === 'single' ? t('单次', 'Single') : t('平均', 'Average')}</span></div>
              <AppLink href={`/wca/comp/${row.competition_id}`} prefetch={false}><CompCell compId={row.competition_id} compName={compNames.get(row.competition_id)} isZh={isZh} noFlag date={null} /></AppLink>
            </li>)}</ol>
          </AchievementBadge>
        ))}
        {achievements.map(row => {
          const name = eventDisplayName(row.eventId, isZh);
          const kind = row.isOnlyFirst ? 'gold' : 'slam';
          const detail = row.isOnlyFirst
            ? t('世锦赛、洲际赛、国家赛冠军，并打破过世界纪录', 'World, continental and national champion, and a world record breaker')
            : t('世锦赛、洲际赛、国家赛领奖台，并打破过世界纪录', 'World, continental and national podiums, and a world record breaker');
          return (
            <AchievementBadge key={row.eventId} kind={kind} event={row.eventId} name={name} description={detail}>
              <AppLink href={`/wca/grand-slam?event=${row.eventId}`} prefetch={false}>{t('查看大满贯榜', 'View Grand Slam leaderboard')}</AppLink>
            </AchievementBadge>
          );
        })}
      </div>
    </section>
  );
}

export default function PersonAchievements({ wcaId, isZh, records, results, comps, countryIso2 }: { wcaId: string; isZh: boolean; records: WcaPersonProfile['personal_records']; results: WcaResultRow[] | null; comps: WcaCompetition[] | null; countryIso2?: string }) {
  const [extra, setExtra] = useState<{ wcaId: string; rows: ExplorerAchievement[] } | null>(null);
  const markers = results === null ? null : [...new Set(results.filter(r => !r.live).flatMap(r => [r.regional_single_record, r.regional_average_record]).filter((v): v is string => !!v))].sort().join(',');
  useEffect(() => {
    if (markers === null) return;
    const controller = new AbortController();
    fetchExplorerAchievements(wcaId, markers.split(','), controller.signal).then(rows => { if (!controller.signal.aborted) setExtra({ wcaId, rows }); });
    return () => controller.abort();
  }, [wcaId, markers]);
  const [rows, setRows] = useState<Achievement[]>([]);
  const [podiums, setPodiums] = useState<{ wcaId: string; rows: ChampionshipPodiumRow[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchWcaPersonChampionshipPodiums(wcaId)
      .then(rows => { if (!cancelled) setPodiums({ wcaId, rows }); })
      .catch(() => { /* Missing championship data must not block other achievements. */ });
    return () => { cancelled = true; };
  }, [wcaId]);
  useEffect(() => {
    const controller = new AbortController();
    // Use the same small leaderboard as /wca/grand-slam; never infer this from all-events milestones.
    fetch(apiUrl('/v1/wca/grand-slam'), { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then((data: { rows: Achievement[] }) => setRows(data.rows))
      .catch(() => { /* An unavailable achievement feed must not block the person profile. */ });
    return () => controller.abort();
  }, []);
  return <GrandSlamBadges rows={rows} wcaId={wcaId} isZh={isZh} records={records} results={results ?? []} comps={comps ?? []} countryIso2={countryIso2} extraAchievements={extra?.wcaId === wcaId ? extra.rows : []} podiums={podiums?.wcaId === wcaId ? podiums.rows : []} />;
}
