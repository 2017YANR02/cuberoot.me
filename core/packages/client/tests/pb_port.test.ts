import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PB_EVENT_IDS,
  PB_RECORD_OPTIONS,
  isPbRecordKey,
  isValidPbResultValue,
  pbRecordOptionLabel,
  parsePbResultInput,
} from '@cuberoot/shared/pb';
import { workspaceFixturePath } from './workspace-fixture-path';

const migration = readFileSync(
  workspaceFixturePath('@cuberoot/server', 'migrations', '0171_cube_pb.sql'),
  'utf8',
);
const ao10000Migration = readFileSync(
  workspaceFixturePath('@cuberoot/server', 'migrations', '0173_pb_ao10000.sql'),
  'utf8',
);
const schema = readFileSync(
  workspaceFixturePath('@cuberoot/server', 'src', 'db', 'schema.pg.sql'),
  'utf8',
);
const pbRoute = readFileSync(
  workspaceFixturePath('@cuberoot/server', 'src', 'routes', 'pb.ts'),
  'utf8',
);
const personPbTable = readFileSync(
  workspaceFixturePath('@cuberoot/client', 'components', 'persons', 'sections', 'PersonPbTable.tsx'),
  'utf8',
);
const personDetail = readFileSync(
  workspaceFixturePath('@cuberoot/client', 'app', '[lang]', 'wca', 'persons', '[wcaId]', 'PersonDetailClient.tsx'),
  'utf8',
);
const personHero = readFileSync(
  workspaceFixturePath('@cuberoot/client', 'components', 'persons', 'sections', 'PersonHero.tsx'),
  'utf8',
);
describe('CubePB shared result contract', () => {
  it('keeps the supported event and set-size scope exact', () => {
    expect(PB_EVENT_IDS).toHaveLength(17);
    expect(PB_RECORD_OPTIONS).toEqual([
      { recordType: 'single', setSize: 1 },
      { recordType: 'mean', setSize: 3 },
      { recordType: 'average', setSize: 5 },
      { recordType: 'average', setSize: 12 },
      { recordType: 'average', setSize: 50 },
      { recordType: 'average', setSize: 100 },
      { recordType: 'average', setSize: 1000 },
      { recordType: 'average', setSize: 10000 },
    ]);
    expect(isPbRecordKey('333', 'average', 1000)).toBe(true);
    expect(isPbRecordKey('333', 'average', 10000)).toBe(true);
    expect(isPbRecordKey('333', 'average', 10001)).toBe(false);
    expect(isPbRecordKey('333', 'mean', 5)).toBe(false);
    expect(isPbRecordKey('333mbf', 'average', 5)).toBe(false);
    expect(isPbRecordKey('unknown', 'single', 1)).toBe(false);
    expect(pbRecordOptionLabel('single', 1, 'Single')).toBe('Single');
    expect(pbRecordOptionLabel('mean', 3, 'Single')).toBe('Mo3');
    expect(pbRecordOptionLabel('average', 10000, 'Single')).toBe('Ao10000');
  });

  it('parses time results into WCA centiseconds and rejects malformed values', () => {
    expect(parsePbResultInput('12.34', '333', 'single')).toBe(1234);
    expect(parsePbResultInput('1:02.34', '333', 'average')).toBe(6234);
    expect(parsePbResultInput('1:01:02.3', '333bf', 'single')).toBe(366230);
    expect(parsePbResultInput('1:60.00', '333', 'single')).toBeNull();
    expect(parsePbResultInput('0', '333', 'single')).toBeNull();
  });

  it('parses FMC and MBLD without losing their WCA raw encodings', () => {
    expect(parsePbResultInput('24', '333fm', 'single')).toBe(24);
    expect(parsePbResultInput('24.33', '333fm', 'mean')).toBe(2433);
    expect(parsePbResultInput('8/10 53:20', '333mbf', 'single')).toBe(930320002);
    expect(parsePbResultInput('1/2 10:00', '333mbf', 'single')).toBeNull();
    expect(parsePbResultInput('8/7 10:00', '333mbf', 'single')).toBeNull();
    expect(isValidPbResultValue('333mbf', 'single', 930320002)).toBe(true);
  });
});

describe('CubePB WCA person integration', () => {
  it('only exposes current records from public profiles through the WCA ID route', () => {
    expect(pbRoute).toContain("pbRoutes.get('/pb/person/:wcaId'");
    expect(pbRoute).toContain('if (!account || !account.is_public)');
    expect(pbRoute).toContain('WHERE owner_key = ? AND is_current = TRUE');
  });

  it('uses the shared contracts and owns PB management on the person page', () => {
    expect(personPbTable).toContain('PB_EVENT_IDS.map');
    expect(personPbTable).toContain('PB_RECORD_OPTIONS.map');
    expect(personPbTable).toContain('await fetchMyPbs(signal)');
    expect(personPbTable).toContain('await fetchManagedPbs(wcaId, signal)');
    expect(personPbTable).toContain('formatWcaResult');
    expect(personPbTable).toContain('<EventIcon event={currentEventId} />');
    expect(personPbTable).toContain('createPbRecord(input, wcaId)');
    expect(personPbTable).toContain('updatePbRecord(editingRecord.id, input, wcaId)');
    expect(personPbTable).toContain('updatePbVisibility(isPublic, wcaId)');
    expect(personPbTable).toContain('deletePbRecord(record.id, wcaId)');
    expect(personPbTable).toContain('const canManage = isOwner || isAdmin');
    expect(pbRoute).toContain("pbRoutes.get('/pb/manage/:wcaId'");
    expect(pbRoute).toContain("pbRoutes.put('/pb/records/:id'");
  });

  it('defaults to PR and switches among PR, historical ranks, and PB', () => {
    expect(personDetail).toContain("parseAsStringEnum<'pr' | 'historical' | 'pb'>(['pr', 'historical', 'pb'])");
    expect(personDetail).toContain(".withDefault('pr')");
    expect(personDetail).toContain("withOptions({ history: 'push' })");
    expect(personDetail).toContain("resultView === 'pb'");
    expect(personDetail).toContain('<PersonPbTable wcaId={profile.person.wca_id} isZh={isZh} />');
    expect(personHero).toContain('<CompactSelect');
    expect(personHero).toContain("{ value: 'historical'");
    expect(personHero).toContain("resultView !== 'pb'");
  });
});

describe('CubePB persistence contract', () => {
  it('keeps the migration and schema snapshot constraints aligned', () => {
    for (const sql of [migration, schema]) {
      expect(sql).toContain('CREATE TABLE pb_profiles');
      expect(sql).toContain('CREATE TABLE pb_records');
      expect(sql).toContain("record_type IN ('single', 'mean', 'average')");
      expect(sql).toContain("event_id <> '333mbf'");
      expect(sql).toContain('CREATE UNIQUE INDEX uq_pb_records_current');
      for (const eventId of PB_EVENT_IDS) expect(sql).toContain(`'${eventId}'`);
    }
    expect(ao10000Migration).toContain('pb_records_set_size_check');
    expect(ao10000Migration).toContain('10000');
    expect(schema).toContain('5, 12, 50, 100, 1000, 10000');
  });
});
