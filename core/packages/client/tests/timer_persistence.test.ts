import { describe, expect, it } from 'vitest';

import {
  activeTimerSolves,
  createTimerStoreData,
  decodeTimerDatabase,
  decodeTimerStoreData,
  parseTimerDatabaseJson,
  parseTimerStoreJson,
  serializeTimerStoreData,
} from '@cuberoot/shared/timer';

describe('shared timer persistence schema', () => {
  it('uses canonical Web timing defaults and migrates the wider legacy Mobile range', () => {
    const fresh = createTimerStoreData(0, 'fresh');
    expect(fresh.settings).toMatchObject({
      timingEnabled: true,
      inspectionSec: 0,
      holdMs: 550,
      autoSessionForEvent: false,
      autoEventForSession: false,
      hideTime: false,
      runningPrecision: 3,
      precision: 3,
    });

    const deliberateLegacyChoice = createTimerStoreData(0, 'choice');
    deliberateLegacyChoice.settings.holdMs = 300;
    expect(decodeTimerStoreData(deliberateLegacyChoice)?.settings.holdMs).toBe(300);

    const legacyWideRange = createTimerStoreData(0, 'legacy');
    legacyWideRange.settings.inspectionSec = 8;
    legacyWideRange.settings.holdMs = 5_000;
    expect(decodeTimerStoreData(legacyWideRange)?.settings).toMatchObject({
      inspectionSec: 15,
      holdMs: 2_000,
    });

    legacyWideRange.settings.inspectionSec = 0;
    legacyWideRange.settings.holdMs = 0;
    expect(decodeTimerStoreData(legacyWideRange)?.settings).toMatchObject({
      inspectionSec: 0,
      holdMs: 550,
    });
  });

  it('round-trips a valid, chronologically normalized store', () => {
    const data = createTimerStoreData(100, 'session', 'zh');
    data.settings.manualScrambles = "R U R'\nF2";
    data.database.dataBySession.session['333'] = [
      { id: 'later', timeMs: 2_000, penalty: '+2', scramble: 'R', event: '333', ts: 20 },
      { id: 'first', timeMs: 1_000, penalty: 'ok', scramble: 'U', event: '333', ts: 10 },
    ];

    const parsed = parseTimerStoreJson(serializeTimerStoreData(data));
    expect(parsed?.settings.language).toBe('zh');
    expect(parsed?.settings.manualScrambles).toBe("R U R'\nF2");
    expect(parsed?.settings.scramble222Mode).toBe('optimal');
    expect(parsed?.settings.scramble222Type).toBe('full');
    expect(activeTimerSolves(parsed!, '333').map((solve) => solve.id)).toEqual(['first', 'later']);
  });

  it('rejects invalid JSON, unknown versions and missing sessions', () => {
    expect(parseTimerStoreJson('{')).toBeNull();
    expect(decodeTimerStoreData({ schemaVersion: 3 })).toBeNull();
    expect(decodeTimerStoreData({ schemaVersion: 2, database: { version: 3, sessions: [] } })).toBeNull();
  });

  it('rejects orphaned active sessions and duplicate ids', () => {
    const orphaned = createTimerStoreData(0, 'a');
    orphaned.database.activeSessionId = 'missing';
    expect(decodeTimerStoreData(orphaned)).toBeNull();

    const duplicated = createTimerStoreData(0, 'a');
    duplicated.database.sessions.push({ ...duplicated.database.sessions[0] });
    expect(decodeTimerStoreData(duplicated)).toBeNull();

    const duplicateSolves = createTimerStoreData(0, 'a');
    duplicateSolves.database.dataBySession.a['333'] = [
      { id: 'x', timeMs: 1, penalty: 'ok', scramble: '', event: '333', ts: 0 },
      { id: 'x', timeMs: 2, penalty: 'ok', scramble: '', event: '333', ts: 1 },
    ];
    expect(decodeTimerStoreData(duplicateSolves)).toBeNull();
  });

  it('rejects invalid solve ranges and event mismatches', () => {
    const negative = createTimerStoreData(0, 'a');
    negative.database.dataBySession.a['333'] = [
      { id: 'x', timeMs: -1, penalty: 'ok', scramble: '', event: '333', ts: 0 },
    ];
    expect(decodeTimerStoreData(negative)).toBeNull();

    const mismatched = createTimerStoreData(0, 'a');
    mismatched.database.dataBySession.a['333'] = [
      { id: 'x', timeMs: 1, penalty: 'ok', scramble: '', event: '222', ts: 0 },
    ];
    expect(decodeTimerStoreData(mismatched)).toBeNull();

    const invalidDate = createTimerStoreData(0, 'a');
    invalidDate.database.dataBySession.a['333'] = [
      { id: 'x', timeMs: 1, penalty: 'ok', scramble: '', event: '333', ts: 1e308 },
    ];
    expect(decodeTimerStoreData(invalidDate)).toBeNull();

    const invalidOptional = createTimerStoreData(0, 'a');
    invalidOptional.database.dataBySession.a['333'] = [{
      id: 'x', timeMs: 1, penalty: 'ok', scramble: '', event: '333', ts: 0,
      moves: [{ m: '', ts: 0 }],
    }];
    expect(decodeTimerStoreData(invalidOptional)).toBeNull();
  });

  it('round-trips a frozen scramble-source identity and rejects malformed snapshots', () => {
    const data = createTimerStoreData(0, 'a');
    data.database.dataBySession.a['333'] = [{
      id: 'x',
      timeMs: 1,
      penalty: 'ok',
      scramble: 'R',
      scrambleSource: { kind: 'wca', identity: 'wca|d|333|333||' },
      event: '333',
      ts: 0,
    }];
    expect(decodeTimerStoreData(data)?.database.dataBySession.a['333']?.[0].scrambleSource)
      .toEqual({ kind: 'wca', identity: 'wca|d|333|333||' });

    const invalid = structuredClone(data) as unknown as {
      database: { dataBySession: { a: { '333': Array<{ scrambleSource: unknown }> } } };
    };
    invalid.database.dataBySession.a['333'][0].scrambleSource = {
      kind: 'real',
      identity: '',
    };
    expect(decodeTimerStoreData(invalid)).toBeNull();
  });

  it('rejects prototype-sensitive session keys', () => {
    const data = createTimerStoreData(0, 'safe');
    data.database.sessions[0].id = '__proto__';
    data.database.activeSessionId = '__proto__';
    expect(decodeTimerStoreData(data)).toBeNull();
  });

  it('round-trips a session event association and rejects unknown events', () => {
    const data = createTimerStoreData(0, 'a');
    data.database.sessions[0].event = '333';
    expect(decodeTimerStoreData(data)?.database.sessions[0].event).toBe('333');

    const invalid = structuredClone(data) as unknown as {
      database: { sessions: Array<{ event: string }> };
    };
    invalid.database.sessions[0].event = 'unknown';
    expect(decodeTimerStoreData(invalid)).toBeNull();
  });

  it('uses one migration chain for website and app backups', () => {
    const environment = { nowMs: 100, sessionId: 'migrated', language: 'en' as const };
    const legacyV2 = JSON.stringify({
      version: 2,
      byEvent: {
        '333': [{ id: 'x', timeMs: 1_000, penalty: 'ok', scramble: 'R', event: '333', ts: 10 }],
      },
    });
    const website = parseTimerDatabaseJson(legacyV2, environment);
    expect(website?.version).toBe(3);
    expect(website?.dataBySession.migrated['333']).toHaveLength(1);

    const app = createTimerStoreData(0, 'app');
    app.database.dataBySession.app['333'] = [
      { id: 'app-solve', timeMs: 2_000, penalty: 'ok', scramble: 'U', event: '333', ts: 20 },
    ];
    const websiteFromApp = decodeTimerDatabase(app, environment);
    expect(websiteFromApp?.dataBySession.app['333']?.[0].id).toBe('app-solve');

    const appFromWebsite = parseTimerStoreJson(JSON.stringify(websiteFromApp), app.settings, environment);
    expect(appFromWebsite?.settings).toEqual(app.settings);
    expect(activeTimerSolves(appFromWebsite!, '333')[0].id).toBe('app-solve');
  });

  it('migrates the flat v1 app envelope without losing its v3 database', () => {
    const legacy = {
      schemaVersion: 1,
      sessions: [{ id: 'legacy', name: 'Legacy', createdTs: 1 }],
      activeSessionId: 'legacy',
      dataBySession: {
        legacy: {
          '333': [{ id: 'solve', timeMs: 1_234, penalty: 'ok', scramble: 'R', event: '333', ts: 2 }],
        },
      },
      settings: {
        event: '333', inspectionSec: 0, holdMs: 300, language: 'en', theme: 'system',
      },
    };

    const migrated = decodeTimerStoreData(legacy);
    expect(migrated).toMatchObject({ schemaVersion: 2, database: { version: 3, activeSessionId: 'legacy' } });
    expect(migrated?.settings.manualScrambles).toBe('');
    expect(migrated?.settings.scramble222Mode).toBe('optimal');
    expect(migrated?.settings.scramble222Type).toBe('full');
    expect(migrated?.settings).toMatchObject({
      wcaScrambleMode: 'comp',
      wcaComp: '',
      wcaRound: '',
      wcaGroup: '',
      wcaDateFrom: '',
      wcaDateTo: '',
    });
    expect(activeTimerSolves(migrated!, '333')[0].id).toBe('solve');
    expect(JSON.parse(serializeTimerStoreData(migrated!))).toEqual(migrated);
  });

  it('migrates early v2 source settings and rejects corrupt values', () => {
    const earlyV2 = createTimerStoreData(0, 'a') as unknown as {
      schemaVersion: number;
      database: unknown;
      settings: Record<string, unknown>;
    };
    delete earlyV2.settings.manualScrambles;
    delete earlyV2.settings.timingEnabled;
    delete earlyV2.settings.autoSessionForEvent;
    delete earlyV2.settings.autoEventForSession;
    delete earlyV2.settings.hideTime;
    delete earlyV2.settings.runningPrecision;
    delete earlyV2.settings.precision;
    delete earlyV2.settings.scramble222Mode;
    delete earlyV2.settings.scramble222Type;
    delete earlyV2.settings.wcaScrambleMode;
    delete earlyV2.settings.wcaComp;
    delete earlyV2.settings.wcaCompName;
    delete earlyV2.settings.wcaCompCountry;
    delete earlyV2.settings.wcaRound;
    delete earlyV2.settings.wcaGroup;
    delete earlyV2.settings.wcaDateFrom;
    delete earlyV2.settings.wcaDateTo;
    delete earlyV2.settings.wcaUseOptimal;
    delete earlyV2.settings.wcaDifficultyOn;
    delete earlyV2.settings.wcaDiffVariant;
    delete earlyV2.settings.wcaDiffStage;
    delete earlyV2.settings.wcaDiffColors;
    delete earlyV2.settings.wcaDiffSteps;
    delete earlyV2.settings.wcaDiffMerged;
    expect(decodeTimerStoreData(earlyV2)?.settings).toMatchObject({
      timingEnabled: true,
      autoSessionForEvent: false,
      autoEventForSession: false,
      hideTime: false,
      runningPrecision: 3,
      precision: 3,
      manualScrambles: '',
      scramble222Mode: 'optimal',
      scramble222Type: 'full',
      wcaScrambleMode: 'comp',
      wcaComp: '',
      wcaRound: '',
      wcaGroup: '',
      wcaUseOptimal: true,
      wcaDifficultyOn: false,
      wcaDiffVariant: 'std',
      wcaDiffStage: 'cross',
      wcaDiffColors: 'BGORWY',
      wcaDiffSteps: [],
      wcaDiffMerged: true,
    });

    const invalidTiming = createTimerStoreData(0, 'timing') as unknown as {
      settings: Record<string, unknown>;
    };
    invalidTiming.settings.runningPrecision = 4;
    expect(decodeTimerStoreData(invalidTiming)).toBeNull();
    invalidTiming.settings.runningPrecision = 3;
    invalidTiming.settings.autoSessionForEvent = 'yes';
    expect(decodeTimerStoreData(invalidTiming)).toBeNull();

    earlyV2.settings.manualScrambles = ['R', 'U'];
    expect(decodeTimerStoreData(earlyV2)).toBeNull();

    earlyV2.settings.manualScrambles = '';
    earlyV2.settings.scramble222Mode = 'fastest';
    expect(decodeTimerStoreData(earlyV2)).toBeNull();

    delete earlyV2.settings.scramble222Mode;
    earlyV2.settings.scramble222Type = 'made-up';
    expect(decodeTimerStoreData(earlyV2)).toBeNull();

    earlyV2.settings.scramble222Type = 'full';
    earlyV2.settings.wcaDateFrom = '2026-99-99';
    expect(decodeTimerStoreData(earlyV2)).toBeNull();

    earlyV2.settings.wcaDateFrom = '';
    earlyV2.settings.wcaDifficultyOn = 'yes';
    expect(decodeTimerStoreData(earlyV2)).toBeNull();

    delete earlyV2.settings.wcaDifficultyOn;
    earlyV2.settings.wcaDiffSteps = [4, '5', 6];
    expect(decodeTimerStoreData(earlyV2)).toBeNull();
  });

  it('refuses to serialize a mutated invalid store', () => {
    const data = createTimerStoreData(0, 'a');
    data.settings.holdMs = Number.NaN;
    expect(() => serializeTimerStoreData(data)).toThrow('invalid timer data');
  });
});
