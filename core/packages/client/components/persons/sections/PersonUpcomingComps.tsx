'use client';

// 报名关系与比赛详情分别复用比赛中心已有的数据入口，确保两页口径一致。
import { useEffect, useState } from 'react';
import { CompCardWithRounds, wcaRoundsSeed } from '@/components/CompCardWithRounds';
import { useT } from '@/hooks/useT';
import { loadLandingComps, type Comp } from '@/lib/comp-search';
import { fetchCompPersonEventIds } from '@/lib/comp-wcif';
import { fetchPersonUpcomingCompetitionIds } from '@/lib/person-upcoming';

interface Props {
  wcaId: string;
  isZh: boolean;
}

function selectUpcoming(competitionIds: readonly string[], competitions: readonly Comp[]): Comp[] {
  if (competitionIds.length === 0 || competitions.length === 0) return [];

  const wantedIds = new Set(competitionIds);
  return competitions
    .filter((competition) => wantedIds.has(competition.id))
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id.localeCompare(b.id));
}

export default function PersonUpcomingComps({ wcaId, isZh }: Props) {
  const t = useT();
  const [competitions, setCompetitions] = useState<Comp[] | null>(null);
  const [eventIdsByCompetition, setEventIdsByCompetition] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let cancelled = false;
    setEventIdsByCompetition({});

    Promise.all([fetchPersonUpcomingCompetitionIds(wcaId), loadLandingComps()])
      .then(async ([competitionIds, allCompetitions]) => {
        const upcoming = selectUpcoming(competitionIds, allCompetitions);
        if (cancelled) return;
        setCompetitions(upcoming);

        const entries = await Promise.all(upcoming.map(async (competition) => [
          competition.id,
          await fetchCompPersonEventIds(competition.id, wcaId),
        ] as const));
        if (!cancelled) setEventIdsByCompetition(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setCompetitions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [wcaId]);

  if (!competitions || competitions.length === 0) return null;

  return (
    <section className="wp-card wp-upcoming-card" aria-labelledby="wp-upcoming-title">
      <div className="wp-upcoming-head">
        <h2 id="wp-upcoming-title" className="wp-upcoming-title">
          {t('未来比赛', 'Upcoming Competitions')}
        </h2>
      </div>

      <div className="reg-cards">
        {competitions.map((competition) => (
          <CompCardWithRounds
            key={competition.id}
            comp={{ ...competition, events: eventIdsByCompetition[competition.id] ?? [] }}
            isZh={isZh}
            lang={isZh ? 'zh' : 'en'}
            roundsSeed={wcaRoundsSeed(competition.rounds)}
            fetchIfMissing
          />
        ))}
      </div>
    </section>
  );
}
