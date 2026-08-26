import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PB_EVENT_IDS,
  PB_RECORD_OPTIONS,
  isPbRecordKey,
  isValidPbResultValue,
  parsePbResultInput,
} from '@cuberoot/shared/pb';
import { workspaceFixturePath } from './workspace-fixture-path';

const migration = readFileSync(
  workspaceFixturePath('@cuberoot/server', 'migrations', '0171_cube_pb.sql'),
  'utf8',
);
const schema = readFileSync(
  workspaceFixturePath('@cuberoot/server', 'src', 'db', 'schema.pg.sql'),
  'utf8',
);

describe('CubePB shared result contract', () => {
  it('keeps the authorized source event and set-size scope exact', () => {
    expect(PB_EVENT_IDS).toHaveLength(17);
    expect(PB_RECORD_OPTIONS).toEqual([
      { recordType: 'single', setSize: 1 },
      { recordType: 'mean', setSize: 3 },
      { recordType: 'average', setSize: 5 },
      { recordType: 'average', setSize: 12 },
      { recordType: 'average', setSize: 50 },
      { recordType: 'average', setSize: 100 },
      { recordType: 'average', setSize: 1000 },
    ]);
    expect(isPbRecordKey('333', 'average', 1000)).toBe(true);
    expect(isPbRecordKey('333', 'mean', 5)).toBe(false);
    expect(isPbRecordKey('333mbf', 'average', 5)).toBe(false);
    expect(isPbRecordKey('unknown', 'single', 1)).toBe(false);
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
  });
});
