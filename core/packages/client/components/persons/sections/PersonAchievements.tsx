import { useEffect, useState } from 'react';
import { Crown, Trophy } from 'lucide-react';
import { RecordBadge } from '@/components/RecordBadge';
import AppLink from '@/components/AppLink';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { useT } from '@/hooks/useT';
import { apiUrl } from '@/lib/api-base';
import { eventDisplayName } from '@/lib/wca-events';
import { CANCELLED_EVENT_IDS } from '@/lib/event-constants';
import { CONTINENT_RECORD_ABBR } from '@/lib/continent';
import { fetchWcaPersonChampionshipPodiums, type ChampionshipPodiumRow, type WcaPersonProfile, type WcaResultRow } from '@/lib/wca-person-api';
import './person-achievements.css';

interface Achievement {
  wcaId: string;
  eventId: string;
  isOnlyFirst: boolean;
}

export const ACHIEVEMENT_TITLES = {
  champion: { zh: '世界冠军', en: 'World champion' },
  wr: { zh: '当前世界纪录保持者', en: 'Current world record holder' },
  historicalWR: { zh: '曾获世界纪录', en: 'Historical world record' },
  historicalCR: { zh: '曾获洲际纪录', en: 'Historical continental record' },
  historicalNR: { zh: '曾获国家纪录', en: 'Historical national record' },
  slam: { zh: '大满贯', en: 'Grand Slam' },
  gold: { zh: '全金大满贯', en: 'All-gold Grand Slam' },
};

export function AchievementMedal({ kind, event = '333' }: { kind: keyof typeof ACHIEVEMENT_TITLES; event?: string }) {
  return (
    <span className={`wp-achievement-medal${kind === 'gold' ? ' is-gold' : ''}`} aria-hidden="true">
      {kind === 'champion' ? <Trophy size={36} strokeWidth={1.5} /> : kind === 'wr' ? <RecordBadge record="WR" /> : kind.startsWith('historical') ? <>
        <EventIcon event={event} />
        <RecordBadge record={kind.slice('historical'.length)} />
      </> : <>
        <Crown size={19} strokeWidth={1.7} />
        <EventIcon event={event} />
        <span className="wp-achievement-wr">WR</span>
      </>}
    </span>
  );
}

export function GrandSlamBadges({ rows, wcaId, isZh, records = {}, podiums = [], results = [] }: {
  rows: Achievement[]; wcaId: string; isZh: boolean;
  records?: WcaPersonProfile['personal_records'];
  podiums?: Pick<ChampionshipPodiumRow, 'level' | 'place' | 'eventId'>[];
  results?: WcaResultRow[];
}) {
  const t = useT();
  const achievements = rows.filter(row => row.wcaId === wcaId);
  // Only official, positive results with recognized record markers qualify.
  // Keep historical retired events; deduplicate singles, averages and repeat records.
  const historical = new Map<string, { event: string; kind: 'historicalWR' | 'historicalCR' | 'historicalNR' }>();
  for (const row of results) {
    if (row.live || !row.event_id) continue;
    for (const [value, marker] of [[row.best, row.regional_single_record], [row.average, row.regional_average_record]] as const) {
      if (!(value > 0) || !marker) continue;
      const level = marker === 'WR' || marker === 'NR' ? marker
        : marker === 'CR' || Object.values(CONTINENT_RECORD_ABBR).includes(marker) ? 'CR' : null;
      if (!level) continue;
      const kind = `historical${level}` as const;
      historical.set(`${row.event_id}:${kind}`, { event: row.event_id, kind });
    }
  }
  const champions = [...new Set(podiums.filter(row => row.level === 'world' && row.place === 1).map(row => row.eventId))];
  const currentRecords = Object.entries(records).flatMap(([event, results]) =>
    CANCELLED_EVENT_IDS.has(event) ? [] : (['single', 'average'] as const)
      .filter(type => results[type]?.world_rank === 1 && results[type]!.best > 0)
      .map(type => `${eventDisplayName(event, isZh)} ${type === 'single' ? t('单次', 'Single') : t('平均', 'Average')}`));
  const awards = [
    { label: t(ACHIEVEMENT_TITLES.champion.zh, ACHIEVEMENT_TITLES.champion.en), icon: <AchievementMedal kind="champion" />, details: champions.map(event => eventDisplayName(event, isZh)) },
    { label: t(ACHIEVEMENT_TITLES.wr.zh, ACHIEVEMENT_TITLES.wr.en), icon: <AchievementMedal kind="wr" />, details: currentRecords },
  ].filter(award => award.details.length);
  if (!achievements.length && !awards.length && !historical.size) return null;
  return (
    <section className="wp-achievements" aria-label={t('成就', 'Achievements')}>
      <div className="wp-achievements-list">
        {awards.map(({ label, icon, details }) => (
          <details className="wp-achievement-details" key={label}>
            <summary className="wp-achievement" title={`${label}: ${details.join(', ')}`}>
              {icon}
              <span className="wp-achievement-label">{label}</span>
            </summary>
            <div className="wp-achievement-detail-text">{details.join(', ')}</div>
          </details>
        ))}
        {[...historical.values()].sort((a, b) => a.event.localeCompare(b.event) || ['historicalWR', 'historicalCR', 'historicalNR'].indexOf(a.kind) - ['historicalWR', 'historicalCR', 'historicalNR'].indexOf(b.kind)).map(({ event, kind }) => {
          const label = t(ACHIEVEMENT_TITLES[kind].zh, ACHIEVEMENT_TITLES[kind].en);
          const name = eventDisplayName(event, isZh);
          return (
            <details className="wp-achievement-details" key={`${event}:${kind}`}>
              <summary className="wp-achievement" title={`${name} ${label}`} aria-label={`${name} ${label}`}>
                <AchievementMedal kind={kind} event={event} />
                <span className="wp-achievement-label">{label}</span>
              </summary>
              <div className="wp-achievement-detail-text">{name}</div>
            </details>
          );
        })}
        {achievements.map(row => {
          const name = eventDisplayName(row.eventId, isZh);
          const kind = row.isOnlyFirst ? 'gold' : 'slam';
          const label = t(ACHIEVEMENT_TITLES[kind].zh, ACHIEVEMENT_TITLES[kind].en);
          const detail = row.isOnlyFirst
            ? t('世锦赛、洲际赛、国家赛冠军，并打破过世界纪录', 'World, continental and national champion, and a world record breaker')
            : t('世锦赛、洲际赛、国家赛领奖台，并打破过世界纪录', 'World, continental and national podiums, and a world record breaker');
          return (
            <AppLink key={row.eventId} href={`/wca/grand-slam?event=${row.eventId}`} prefetch={false}
              className="wp-achievement" title={`${name} ${label}: ${detail}`} aria-label={`${name} ${label}: ${detail}`}>
              <AchievementMedal kind={kind} event={row.eventId} />
              <span className="wp-achievement-label">{label}</span>
            </AppLink>
          );
        })}
      </div>
    </section>
  );
}

export default function PersonAchievements({ wcaId, isZh, records, results }: { wcaId: string; isZh: boolean; records: WcaPersonProfile['personal_records']; results: WcaResultRow[] | null }) {
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
  return <GrandSlamBadges rows={rows} wcaId={wcaId} isZh={isZh} records={records} results={results ?? []} podiums={podiums?.wcaId === wcaId ? podiums.rows : []} />;
}
