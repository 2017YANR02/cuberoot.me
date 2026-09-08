import { useEffect, useState } from 'react';
import { RecordBadge } from '@/components/RecordBadge';
import AppLink from '@/components/AppLink';
import { AchievementBadge } from './AchievementBadge';
import { formatWcaResult } from '@/lib/wca-format-result';
import { CompCell } from '@/components/CompCell/CompCell';
import { useT } from '@/hooks/useT';
import { apiUrl } from '@/lib/api-base';
import { eventDisplayName } from '@/lib/wca-events';
import { CANCELLED_EVENT_IDS } from '@/lib/event-constants';
import { CONTINENT_RECORD_ABBR } from '@/lib/continent';
import { fetchWcaPersonChampionshipPodiums, type ChampionshipPodiumRow, type WcaCompetition, type WcaPersonProfile, type WcaResultRow } from '@/lib/wca-person-api';
import './person-achievements.css';

interface Achievement {
  wcaId: string;
  eventId: string;
  isOnlyFirst: boolean;
}

export function GrandSlamBadges({ rows, wcaId, isZh, records = {}, podiums = [], results = [], comps = [] }: {
  rows: Achievement[]; wcaId: string; isZh: boolean;
  records?: WcaPersonProfile['personal_records'];
  podiums?: Pick<ChampionshipPodiumRow, 'level' | 'place' | 'eventId'>[];
  results?: WcaResultRow[];
  comps?: WcaCompetition[];
}) {
  const t = useT();
  const achievements = rows.filter(row => row.wcaId === wcaId);
  const compNames = new Map(comps.map(comp => [comp.id, comp.name]));
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
  if (!achievements.length && !champions.length && !currentRecords.length && !historical.size) return null;
  return (
    <section className="wp-achievements" aria-label={t('成就', 'Achievements')}>
      <div className="wp-achievements-list">
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

export default function PersonAchievements({ wcaId, isZh, records, results, comps }: { wcaId: string; isZh: boolean; records: WcaPersonProfile['personal_records']; results: WcaResultRow[] | null; comps: WcaCompetition[] | null }) {
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
  return <GrandSlamBadges rows={rows} wcaId={wcaId} isZh={isZh} records={records} results={results ?? []} comps={comps ?? []} podiums={podiums?.wcaId === wcaId ? podiums.rows : []} />;
}
