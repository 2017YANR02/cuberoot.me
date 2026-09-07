import { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { useT } from '@/hooks/useT';
import { apiUrl } from '@/lib/api-base';
import { eventDisplayName } from '@/lib/wca-events';
import './person-achievements.css';

interface Achievement {
  wcaId: string;
  eventId: string;
  isOnlyFirst: boolean;
}

export function GrandSlamBadges({ rows, wcaId, isZh }: { rows: Achievement[]; wcaId: string; isZh: boolean }) {
  const t = useT();
  const achievements = rows.filter(row => row.wcaId === wcaId);
  if (!achievements.length) return null;
  return (
    <section className="wp-achievements" aria-label={t('成就', 'Achievements')}>
      <div className="wp-achievements-list">
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

export default function PersonAchievements({ wcaId, isZh }: { wcaId: string; isZh: boolean }) {
  const [rows, setRows] = useState<Achievement[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    // Use the same small leaderboard as /wca/grand-slam; never infer this from all-events milestones.
    fetch(apiUrl('/v1/wca/grand-slam'), { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then((data: { rows: Achievement[] }) => setRows(data.rows))
      .catch(() => { /* An unavailable achievement feed must not block the person profile. */ });
    return () => controller.abort();
  }, []);
  return <GrandSlamBadges rows={rows} wcaId={wcaId} isZh={isZh} />;
}
