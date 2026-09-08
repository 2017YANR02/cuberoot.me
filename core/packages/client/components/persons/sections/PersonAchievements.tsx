import { useEffect, useState } from 'react';
import { Crown, Trophy } from 'lucide-react';
import { RecordBadge } from '@/components/RecordBadge';
import AppLink from '@/components/AppLink';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { useT } from '@/hooks/useT';
import { apiUrl } from '@/lib/api-base';
import { eventDisplayName } from '@/lib/wca-events';
import { CANCELLED_EVENT_IDS } from '@/lib/event-constants';
import { fetchWcaPersonChampionshipPodiums, type ChampionshipPodiumRow, type WcaPersonProfile } from '@/lib/wca-person-api';
import './person-achievements.css';

interface Achievement {
  wcaId: string;
  eventId: string;
  isOnlyFirst: boolean;
}

export function GrandSlamBadges({ rows, wcaId, isZh, records = {}, podiums = [] }: {
  rows: Achievement[]; wcaId: string; isZh: boolean;
  records?: WcaPersonProfile['personal_records'];
  podiums?: Pick<ChampionshipPodiumRow, 'level' | 'place' | 'eventId'>[];
}) {
  const t = useT();
  const achievements = rows.filter(row => row.wcaId === wcaId);
  const champions = [...new Set(podiums.filter(row => row.level === 'world' && row.place === 1).map(row => row.eventId))];
  const currentRecords = Object.entries(records).flatMap(([event, results]) =>
    CANCELLED_EVENT_IDS.has(event) ? [] : (['single', 'average'] as const)
      .filter(type => results[type]?.world_rank === 1 && results[type]!.best > 0)
      .map(type => `${eventDisplayName(event, isZh)} ${type === 'single' ? t('单次', 'Single') : t('平均', 'Average')}`));
  const awards = [
    { label: t('世界冠军', 'World champion'), icon: <Trophy size={36} strokeWidth={1.5} />, details: champions.map(event => eventDisplayName(event, isZh)) },
    { label: t('当前世界纪录保持者', 'Current world record holder'), icon: <RecordBadge record="WR" />, details: currentRecords },
  ].filter(award => award.details.length);
  if (!achievements.length && !awards.length) return null;
  return (
    <section className="wp-achievements" aria-label={t('成就', 'Achievements')}>
      <div className="wp-achievements-list">
        {awards.map(({ label, icon, details }) => (
          <details className="wp-achievement-details" key={label}>
            <summary className="wp-achievement" title={`${label}: ${details.join(', ')}`}>
              <span className="wp-achievement-medal" aria-hidden="true">{icon}</span>
              <span className="wp-achievement-label">{label}</span>
            </summary>
            <div className="wp-achievement-detail-text">{details.join(', ')}</div>
          </details>
        ))}
        {achievements.map(row => {
          const name = eventDisplayName(row.eventId, isZh);
          const label = row.isOnlyFirst ? t('全金大满贯', 'All-gold Grand Slam') : t('大满贯', 'Grand Slam');
          const detail = row.isOnlyFirst
            ? t('世锦赛、洲际赛、国家赛冠军，并打破过世界纪录', 'World, continental and national champion, and a world record breaker')
            : t('世锦赛、洲际赛、国家赛领奖台，并打破过世界纪录', 'World, continental and national podiums, and a world record breaker');
          return (
            <AppLink key={row.eventId} href={`/wca/grand-slam?event=${row.eventId}`} prefetch={false}
              className="wp-achievement" title={`${name} ${label}: ${detail}`} aria-label={`${name} ${label}: ${detail}`}>
              <span className={`wp-achievement-medal${row.isOnlyFirst ? ' is-gold' : ''}`} aria-hidden="true">
                <Crown size={19} strokeWidth={1.7} />
                <EventIcon event={row.eventId} />
                <span className="wp-achievement-wr">WR</span>
              </span>
              <span className="wp-achievement-label">{label}</span>
            </AppLink>
          );
        })}
      </div>
    </section>
  );
}

export default function PersonAchievements({ wcaId, isZh, records }: { wcaId: string; isZh: boolean; records: WcaPersonProfile['personal_records'] }) {
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
  return <GrandSlamBadges rows={rows} wcaId={wcaId} isZh={isZh} records={records} podiums={podiums?.wcaId === wcaId ? podiums.rows : []} />;
}
