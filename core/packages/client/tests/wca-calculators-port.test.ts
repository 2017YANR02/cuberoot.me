import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  averageKinchScoreX100,
  calculateKinchEvent,
  multiBlindKinchPoints,
} from '@cuberoot/shared/kinch';
import { calculatePersonalRecordStreak } from '@cuberoot/shared/pr-streak';
import { buildWcaPersonNameFilter } from '../../server/src/utils/wca_name_filter';

const CLIENT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORE_ROOT = join(CLIENT_ROOT, '..', '..');
const REPO_ROOT = join(CORE_ROOT, '..');

describe('Kinch shared formula', () => {
  it('uses record / personal for ordinary averages', () => {
    expect(calculateKinchEvent({
      eventId: '333', single: 0, average: 1_000,
      recordSingle: 0, recordAverage: 500,
    })).toEqual({ scoreX100: 5_000, value: 1_000, type: 'average' });
  });

  it('uses the better of single and average for special events', () => {
    expect(calculateKinchEvent({
      eventId: '333bf', single: 2_000, average: 2_000,
      recordSingle: 1_000, recordAverage: 1_500,
    })).toEqual({ scoreX100: 7_500, value: 2_000, type: 'average' });
  });

  it('uses personal / record points for a non-WR Multi-Blind result', () => {
    // WCA encoding:the smaller record value has 60 points in 60:00; the
    // personal result has 50 points in 30:00, or 50.5 Kinch points.
    const record = 390_360_000;
    const personal = 490_180_000;
    expect(record).toBeLessThan(personal); // MIN(encoded best) is the WCA ordering used by the builder.
    expect(multiBlindKinchPoints(record)).toBe(60);
    expect(multiBlindKinchPoints(personal)).toBe(50.5);
    expect(calculateKinchEvent({
      eventId: '333mbf', single: personal, average: 0,
      recordSingle: record, recordAverage: 0,
    }).scoreX100).toBe(8_417);
  });

  it('keeps missing events in the 17-event denominator', () => {
    expect(averageKinchScoreX100([
      { scoreX100: 5_000, value: 1_000, type: 'average' },
      { scoreX100: 0, value: 0, type: 'average' },
    ])).toBe(2_500);
  });
});

describe('personal-record competition streak', () => {
  it('counts one competition once, counts first PBs and ties, and ignores invalid results', () => {
    const result = calculatePersonalRecordStreak([
      { competitionId: 'A', competitionDate: '2020-01-01', eventId: '333', single: 1_000, average: 1_200 },
      { competitionId: 'A', competitionDate: '2020-01-01', eventId: '222', single: 300, average: 400 },
      { competitionId: 'B', competitionDate: '2020-02-01', eventId: '333', single: 1_000, average: 0 },
      { competitionId: 'C', competitionDate: '2020-03-01', eventId: '333', single: 1_100, average: 1_300 },
      { competitionId: 'D', competitionDate: '2020-04-01', eventId: '444', single: 4_000, average: 5_000 },
      { competitionId: 'E', competitionDate: '2020-05-01', eventId: '444', single: -1, average: -2 },
      { competitionId: 'E', competitionDate: '2020-05-01', eventId: '555', single: 0, average: 0 },
      { competitionId: 'F', competitionDate: '2020-06-01', eventId: '555', single: 8_000, average: 9_000 },
    ]);

    expect(result.longest).toEqual(['A', 'B']);
    expect(result.current).toEqual(['F']);
  });
});

describe('Name Ranks matching', () => {
  it('matches first and last names against the Latin main name', () => {
    const first = buildWcaPersonNameFilter('Max', 'first');
    const last = buildWcaPersonNameFilter('Park', 'last');
    expect(first.sql).toContain('REGEXP_REPLACE');
    expect(first.params).toEqual(['Max %', 'Max']);
    expect(last.sql).toContain('REGEXP_REPLACE');
    expect(last.params).toEqual(['% Park', 'Park']);
  });

  it('treats a one-word main name as both its first and last name', () => {
    expect(buildWcaPersonNameFilter('Madonna', 'first').params).toEqual(['Madonna %', 'Madonna']);
    expect(buildWcaPersonNameFilter('Madonna', 'last').params).toEqual(['% Madonna', 'Madonna']);
  });

  it('matches exact raw, Latin-main and parenthesized local names', () => {
    const exact = buildWcaPersonNameFilter('王艺衡', 'exact');
    expect(exact.sql).toContain('name ILIKE');
    expect(exact.sql).toContain('REGEXP_REPLACE');
    expect(exact.sql).toContain('SUBSTRING');
    expect(exact.params).toEqual(['王艺衡', '王艺衡', '王艺衡']);
  });

  it('escapes LIKE wildcard characters instead of treating them as patterns', () => {
    expect(buildWcaPersonNameFilter('A_100%', 'any').params).toEqual(['%A\\_100\\%%']);
  });
});

describe('wca_kinch stats deploy contract', () => {
  const builder = readFileSync(join(CORE_ROOT, 'packages', 'stats-build', 'src', 'bin', 'wca_stats_extra_build.ts'), 'utf8');
  const workflow = readFileSync(join(REPO_ROOT, '.github', 'workflows', 'stats.yml'), 'utf8');
  const serverRoute = readFileSync(join(CORE_ROOT, 'packages', 'server', 'src', 'routes', 'wca_stats_extra.ts'), 'utf8');
  const migration = readFileSync(join(CORE_ROOT, 'packages', 'server', 'migrations', '0111_wca_kinch.sql'), 'utf8');

  it('writes and loads the same Kinch TSV', () => {
    expect(builder).toContain("createWriteStream(resolve(outDir, 'wca_kinch.copy.tsv'))");
    expect(builder).toMatch(/\\copy wca_kinch[^;]+FROM 'wca_kinch\.copy\.tsv'/s);
    expect(builder).toContain('country: personCountry.get(pid) ?? a.country');
  });

  it('uploads the complete stats-extra output directory', () => {
    expect(workflow).toMatch(/working-directory: core\/packages\/stats-build\/output\/wca_stats_extra[\s\S]+?scp[^\n]+\.\/\*/);
  });

  it('can bootstrap stats-extra without duplicating or waiting for the full daily pipeline', () => {
    expect(workflow).toMatch(/pipeline:\s+[\s\S]*?- wca_stats_extra/);
    expect(workflow.match(/inputs\.pipeline != 'wca_stats_extra'/g)).toHaveLength(22);
    expect(workflow).toMatch(/name: Build WCA stats extra\s+working-directory:/);
    expect(workflow).toMatch(/name: Apply WCA stats extra on server\s+env:/);
  });

  it('uses SQL rank semantics so tied two-decimal scores keep the same rank', () => {
    const scores = [9_000, 8_500, 8_500, 8_000];
    const ranks = scores.map(score => 1 + scores.filter(other => other > score).length);
    expect(ranks).toEqual([1, 2, 2, 4]);
    expect(serverRoute).toContain('RANK() OVER (ORDER BY k.${scoreColumn} DESC) AS rank');
    expect(serverRoute).toContain('rank: Number(row.rank)');
    expect(serverRoute).not.toContain('rank: offset + index + 1');
  });

  it('ships migration 0111 with all three leaderboard indexes', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS wca_kinch');
    expect(migration.match(/CREATE INDEX IF NOT EXISTS kinch_/g)).toHaveLength(3);
  });
});

describe('calculator UI integrations', () => {
  const resultsPage = readFileSync(join(CLIENT_ROOT, 'app', '[lang]', 'wca', 'results', 'page.tsx'), 'utf8');
  const kinchPage = readFileSync(join(CLIENT_ROOT, 'app', '[lang]', 'wca', 'kinch', 'page.tsx'), 'utf8');
  const miscTab = readFileSync(join(CLIENT_ROOT, 'components', 'persons', 'sections', 'MiscTab.tsx'), 'utf8');

  it('sends every Name Ranks mode through the existing results page and API', () => {
    expect(resultsPage).toContain('qmode: parseAsString');
    expect(resultsPage).toContain("qs.set('nameMode', qMode)");
    expect(resultsPage).toContain('<option value="first">');
    expect(resultsPage).toContain('<option value="last">');
    expect(resultsPage).toContain('<option value="exact">');
  });

  it('uses the Kinch API and the canonical competition cell for PR streaks', () => {
    expect(kinchPage).toContain("apiUrl(`/v1/wca/kinch?");
    expect(kinchPage).toContain('<Suspense fallback={null}>');
    expect(miscTab).toContain('<CompCell compId={comp.compId}');
    expect(miscTab).toContain('misc.recordStreak.current');
    expect(miscTab).toContain('misc.recordStreak.longest');
  });
});
