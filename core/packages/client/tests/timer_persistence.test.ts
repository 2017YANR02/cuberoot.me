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
  it('round-trips a valid, chronologically normalized store', () => {
    const data = createTimerStoreData(100, 'session', 'zh');
    data.database.dataBySession.session['333'] = [
      { id: 'later', timeMs: 2_000, penalty: '+2', scramble: 'R', event: '333', ts: 20 },
      { id: 'first', timeMs: 1_000, penalty: 'ok', scramble: 'U', event: '333', ts: 10 },
    ];

    const parsed = parseTimerStoreJson(serializeTimerStoreData(data));
    expect(parsed?.settings.language).toBe('zh');
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

  it('rejects prototype-sensitive session keys', () => {
    const data = createTimerStoreData(0, 'safe');
    data.database.sessions[0].id = '__proto__';
    data.database.activeSessionId = '__proto__';
    expect(decodeTimerStoreData(data)).toBeNull();
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
    expect(activeTimerSolves(migrated!, '333')[0].id).toBe('solve');
    expect(JSON.parse(serializeTimerStoreData(migrated!))).toEqual(migrated);
  });

  it('refuses to serialize a mutated invalid store', () => {
    const data = createTimerStoreData(0, 'a');
    data.settings.holdMs = Number.NaN;
    expect(() => serializeTimerStoreData(data)).toThrow('invalid timer data');
  });
});
