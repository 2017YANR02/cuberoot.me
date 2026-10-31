'use client';

// 报名关系与比赛详情分别复用比赛中心已有的数据入口，确保两页口径一致。
import { useEffect, useMemo } from 'react';
import { useRetainedState } from '@/hooks/useRetainedState';
import { CompCardWithRounds, wcaRoundsSeed } from '@/components/CompCardWithRounds';
import { useT } from '@/hooks/useT';
import { loadLandingComps, type Comp } from '@/lib/comp-search';
import { fetchCompPersonEventIds } from '@/lib/comp-wcif';
import { fetchPersonUpcomingCompetitionIds, selectPersonUpcomingCompetitions } from '@/lib/person-upcoming';
import { toIsoDate } from '@/lib/wca-date';
import { countryToIso2, loadFlagData, personFlagIso2 } from '@/lib/country-flags';
import './person_upcoming_comps.css';

interface Props {
  wcaId?: string;
  isZh: boolean;
  title?: string | null;
  followedIds?: ReadonlySet<string>;
  emptyMessage?: string;
  compactDetails?: boolean;
  /** Homepage only: omit flags matching this logged-in person's WCA country. */
  hideHomeCountryFlag?: boolean;
  onReady?: () => void;
}

export default function PersonUpcomingComps({ wcaId, isZh, title, followedIds, emptyMessage, compactDetails, hideHomeCountryFlag = false, onReady }: Props) {
  const t = useT();
  const normalizedWcaId = wcaId?.trim().toUpperCase() ?? '';
  const cacheKey = `person-upcoming:${normalizedWcaId}:${Boolean(compactDetails)}`;
  const [catalog, setCatalog] = useRetainedState<Comp[] | null>(`${cacheKey}:catalog`, null);
  const [registeredIds, setRegisteredIds] = useRetainedState<string[]>(`${cacheKey}:registered`, []);
  const [eventIdsByCompetition, setEventIdsByCompetition] = useRetainedState<Record<string, string[]>>(`${cacheKey}:events`, {});
  const [wcaCountry, setWcaCountry] = useRetainedState(`${cacheKey}:country`, { id: '', iso2: '' });
  const hiddenCountry = hideHomeCountryFlag && normalizedWcaId && wcaCountry.id === normalizedWcaId ? wcaCountry.iso2 : '';

  useEffect(() => {
    if (!hideHomeCountryFlag || !normalizedWcaId) return;
    let cancelled = false;
    void loadFlagData().then(() => {
      if (!cancelled) setWcaCountry({ id: normalizedWcaId, iso2: countryToIso2(personFlagIso2(normalizedWcaId)) });
    });
    return () => { cancelled = true; };
  }, [hideHomeCountryFlag, normalizedWcaId, setWcaCountry]);

  useEffect(() => {
    let cancelled = false;
    // Returning to a page revalidates in the background without clearing it.

    Promise.all([wcaId ? fetchPersonUpcomingCompetitionIds(wcaId) : Promise.resolve([]), loadLandingComps()])
      .then(async ([competitionIds, allCompetitions]) => {
        const upcoming = selectPersonUpcomingCompetitions(competitionIds, allCompetitions, toIsoDate(new Date()));
        if (cancelled) return;
        setCatalog(allCompetitions);
        setRegisteredIds(competitionIds);

        if (!wcaId || compactDetails) return;
        const entries = await Promise.all(upcoming.map(async (competition) => [
          competition.id,
          await fetchCompPersonEventIds(competition.id, wcaId),
        ] as const));
        if (!cancelled) setEventIdsByCompetition(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setCatalog(previous => previous ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [wcaId, compactDetails, setCatalog, setRegisteredIds, setEventIdsByCompetition]);

  const competitions = useMemo(() => catalog && selectPersonUpcomingCompetitions(
    [...registeredIds, ...(followedIds ?? [])], catalog, toIsoDate(new Date()),
  ), [catalog, registeredIds, followedIds]);

  useEffect(() => {
    if (catalog !== null) onReady?.();
  }, [catalog, onReady]);

  if (!competitions) return null;
  if (competitions.length === 0) return emptyMessage ? <p className="landing-slot-message">{emptyMessage}</p> : null;

  return (
    <section className="wp-card wp-upcoming-card" aria-labelledby={title === null ? undefined : 'wp-upcoming-title'}>
      {title !== null && <div className="wp-upcoming-head">
        <h2 id="wp-upcoming-title" className="wp-upcoming-title">
          {title ?? t('未来比赛', 'Upcoming Competitions')}
        </h2>
      </div>}

      <div className="reg-cards">
        {competitions.map((competition) => (
          <CompCardWithRounds
            key={competition.id}
            comp={{ ...competition, events: registeredIds.includes(competition.id)
              ? eventIdsByCompetition[competition.id] ?? [] : competition.events }}
            isZh={isZh}
            compactDetails={compactDetails}
            showCountryFlag={!hiddenCountry || countryToIso2(competition.country) !== hiddenCountry}
            lang={isZh ? 'zh' : 'en'}
            roundsSeed={compactDetails ? undefined : wcaRoundsSeed(competition.rounds)}
            fetchIfMissing={!compactDetails}
          />
        ))}
      </div>
    </section>
  );
}
