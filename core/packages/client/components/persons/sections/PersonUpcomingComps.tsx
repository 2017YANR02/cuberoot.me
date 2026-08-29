'use client';

// 报名关系与比赛详情分别复用比赛中心已有的数据入口，确保两页口径一致。
import { useEffect, useState } from 'react';
import AppLink from '@/components/AppLink';
import { CompCell } from '@/components/CompCell/CompCell';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { useT } from '@/hooks/useT';
import { localizeCity } from '@/lib/city-localize';
import { compLinkProps } from '@/lib/comp-link';
import { loadLandingComps, type Comp } from '@/lib/comp-search';
import { fetchCompPersonEventIds } from '@/lib/comp-wcif';
import { countryName } from '@/lib/country-name';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { fetchPersonUpcomingCompetitionIds } from '@/lib/person-upcoming';
import { formatDateRangeIso } from '@/lib/wca-date';
import { eventDisplayName } from '@/lib/wca-events';

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

      <ul className="wp-upcoming-list">
        {competitions.map((competition) => {
          const city = competition.city
            ? localizeCity(competition.city, isZh, competition.country)
            : '';
          const registeredEvents = new Set(eventIdsByCompetition[competition.id] ?? []);

          return (
            <li key={competition.id} className="wp-upcoming-row">
              <time className="wp-upcoming-date" dateTime={competition.start_date}>
                {formatDateRangeIso(competition.start_date, competition.end_date)}
              </time>

              <AppLink {...compLinkProps(competition.id)} className="wp-link-comp wp-upcoming-comp">
                <CompCell
                  compId={competition.id}
                  compName={competition.name}
                  date={competition.start_date}
                  isZh={isZh}
                />
              </AppLink>

              <span className="wp-upcoming-place">
                <span>{countryName(competition.country, isZh)}</span>
                {city && <span>{city}</span>}
              </span>

              <span className="wp-event-strip wp-upcoming-events">
                {ALL_EVENT_IDS.map((eventId) => registeredEvents.has(eventId) ? (
                  <EventIcon
                    key={eventId}
                    event={eventId}
                    className="wp-event-icon-sm"
                    title={eventDisplayName(eventId, isZh)}
                  />
                ) : null)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
