import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { h2hEventIds, isH2hActivity } from '@/lib/comp-schedule';
import type { RoundInfo } from '@/lib/comp-schedule';

const read = (url: URL) => readFileSync(fileURLToPath(url), 'utf8');
const page = read(new URL('../app/[lang]/wca/comp/page.tsx', import.meta.url));
const sharedContract = read(new URL('../../shared/src/api/comps_json.ts', import.meta.url));
const pastGenerator = read(new URL('../../stats-build/src/bin/gen_all_comps.ts', import.meta.url));
const upcomingGenerator = read(new URL('../../stats-build/src/bin/fetch_upcoming_comps.ts', import.meta.url));
const scheduleView = read(new URL('../app/[lang]/wca/comp/[slug]/ScheduleView.tsx', import.meta.url));
const scheduleCalendar = read(new URL('../app/[lang]/wca/comp/[slug]/ScheduleCalendar.tsx', import.meta.url));

interface PastCompFixture {
  id: string;
  h2h_events?: string[];
}

const pastComps = JSON.parse(
  read(new URL('../../../../stats/all_past_comps.json', import.meta.url)),
) as PastCompFixture[];

const round = (id: string, eventId: string, format: string): RoundInfo => ({
  id,
  eventId,
  roundNumber: Number(id.match(/-r(\d+)/)?.[1] ?? 1),
  totalRounds: eventId === '333' ? 4 : 3,
  format,
  timeLimit: null,
  cutoff: null,
  advancementCondition: null,
});

describe('WCA competition H2H filter contract', () => {
  it('marks the two Xuzhou H2H events from format h', () => {
    expect(pastComps.find((comp) => comp.id === 'XuzhouZenith2026')?.h2h_events).toEqual(['3', '3bf']);
  });

  it('derives the shared marker from the authoritative format field in both pipelines', () => {
    expect(sharedContract.match(/h2h_events\?: string\[\];/g)).toHaveLength(2);
    expect(pastGenerator).toContain("WHERE r.format_id = 'h'");
    expect(upcomingGenerator).toContain("rs.some((r) => r.format === 'h')");
    expect(upcomingGenerator).toContain("'h2hEvents' in cached");
  });

  it('keeps the H2H switch shareable and in the competition predicate', () => {
    expect(page).toContain("const [h2hOnly, setH2hOnly] = useQueryState(");
    expect(page).toContain("'h2h'");
    expect(page).toContain("if (h2hOnly && !(comp.h2h_events && comp.h2h_events.length > 0)) return false;");
    expect(page).toContain("label={tr({ zh: 'H2H', en: 'H2H' })}");
  });

  it('lists H2H events once and marks only their exact scheduled rounds', () => {
    const rounds = {
      '333-r1': round('333-r1', '333', 'a'),
      '333-r4': round('333-r4', '333', 'h'),
      '333bf-r3': round('333bf-r3', '333bf', 'h'),
    };

    expect(h2hEventIds(rounds)).toEqual(['333', '333bf']);
    expect(isH2hActivity({ activityCode: '333-r4-g1' }, rounds)).toBe(true);
    expect(isH2hActivity({ activityCode: '333-r1-g1' }, rounds)).toBe(false);
  });

  it('shows the event summary and H2H marker in both schedule layouts', () => {
    expect(scheduleView).toContain('<H2hSummary data={data} isZh={isZh} />');
    expect(scheduleView).toContain("round?.format === 'h'");
    expect(scheduleCalendar).toContain('h2h: isH2hActivity(a, data.rounds)');
    expect(scheduleCalendar).toContain('arg.event.extendedProps.h2h && <H2hMarker />');
  });
});
