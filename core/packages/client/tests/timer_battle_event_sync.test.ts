/**
 * Pins the /timer solo event list against the 1v1 Battle puzzle list.
 *
 * The two used to be independent hand-written arrays and drifted: battle had
 * `fto` / `kilominx` that solo could not practise, and its BLD ids are spelled
 * `333bf` where solo says `333bld`. They are now reconciled by ONE table in
 * `timer/_lib/types.ts` (`BATTLE_EVENT_IDS` + `toWcaSpelling`), which
 * `_battle/engine/constants.ts` derives `PUZZLES` from.
 *
 * These assertions are what makes "added to one side only" a CI failure rather
 * than a silently half-shipped puzzle.
 */

import { describe, it, expect } from 'vitest';
import {
  EVENTS,
  BATTLE_EVENT_IDS,
  BATTLE_PUZZLE_IDS,
  toWcaSpelling,
  fromWcaSpelling,
  eventInfo,
  type EventId,
} from '@/app/[lang]/timer/_lib/types';
import { PUZZLES, EVENT_TO_CSTIMER } from '@/app/[lang]/timer/_battle/engine/constants';
import { NON_WCA_EVENT_IDS, cstimerKeyForEvent, isNonWcaEvent } from '@/app/[lang]/timer/_lib/scramble/nonwca';
import { ALL_EVENT_IDS } from '@/lib/event-constants';

const EVENT_IDS = new Set<string>(EVENTS.map((e) => e.id));

describe('timer EVENTS list', () => {
  it('has no duplicate ids', () => {
    expect(EVENTS.map((e) => e.id)).toHaveLength(EVENT_IDS.size);
  });

  it('gives every event a non-empty bilingual name', () => {
    for (const e of EVENTS) {
      expect(e.nameEn.length, e.id).toBeGreaterThan(0);
      expect(e.nameZh.length, e.id).toBeGreaterThan(0);
    }
  });
});

describe('battle puzzle list is derived, not duplicated', () => {
  it('PUZZLES matches BATTLE_EVENT_IDS one-for-one, in order', () => {
    expect(PUZZLES.map((p) => p.id)).toEqual([...BATTLE_PUZZLE_IDS]);
    expect(BATTLE_PUZZLE_IDS).toEqual(BATTLE_EVENT_IDS.map(toWcaSpelling));
  });

  it('offers exactly the 18 puzzles it shipped with (bump deliberately)', () => {
    // A baseline, not a ceiling: adding a puzzle to battle SHOULD fail here so
    // the change is reviewed together with its solo counterpart.
    expect(PUZZLES).toHaveLength(18);
  });

  it('every battle puzzle is a real timer event solo can also practise', () => {
    for (const eventId of BATTLE_EVENT_IDS) {
      expect(EVENT_IDS.has(eventId), `battle event ${eventId} missing from timer EVENTS`).toBe(true);
    }
  });

  it('every battle puzzle has a csTimer scrambler type', () => {
    for (const id of BATTLE_PUZZLE_IDS) {
      expect(EVENT_TO_CSTIMER[id], `no EVENT_TO_CSTIMER entry for ${id}`).toBeDefined();
    }
  });

  it('has no duplicate battle ids', () => {
    expect(new Set(BATTLE_PUZZLE_IDS).size).toBe(BATTLE_PUZZLE_IDS.length);
  });
});

describe('id spelling bridge', () => {
  it('round-trips every timer EventId', () => {
    for (const e of EVENTS) {
      expect(fromWcaSpelling(toWcaSpelling(e.id)), e.id).toBe(e.id);
    }
  });

  it('round-trips every battle puzzle id', () => {
    for (const id of BATTLE_PUZZLE_IDS) {
      expect(toWcaSpelling(fromWcaSpelling(id)), id).toBe(id);
    }
  });

  it('renames exactly the ids that genuinely differ', () => {
    const renamed = EVENTS.filter((e) => toWcaSpelling(e.id) !== e.id).map((e) => [e.id, toWcaSpelling(e.id)]);
    expect(renamed).toEqual([
      ['333bld', '333bf'],
      ['333mbld', '333mbf'],
      ['444bld', '444bf'],
      ['555bld', '555bf'],
      ['pyra', 'pyram'],
      ['mega', 'minx'],
    ]);
  });

  it('maps battle WCA ids onto ids the WCA icon grid knows', () => {
    // Everything battle offers is either a real WCA event (rendered in the icon
    // grid) or a non-WCA puzzle (rendered as an appendEvents button) — nothing
    // may fall between the two and disappear from the picker.
    for (const id of BATTLE_PUZZLE_IDS) {
      const info = eventInfo(fromWcaSpelling(id));
      const renderable = ALL_EVENT_IDS.includes(id) || !!info.icon;
      expect(renderable, `${id} would render as neither icon nor append button`).toBe(true);
    }
  });
});

describe('non-WCA puzzles', () => {
  it('every EVENTS entry in the nonwca group has a csTimer scrambler + icon', () => {
    const nonWca = EVENTS.filter((e) => e.group === 'nonwca');
    expect(nonWca.length).toBeGreaterThan(0);
    for (const e of nonWca) {
      expect(cstimerKeyForEvent(e.id), `${e.id} has no csTimer scrambler key`).toBeTruthy();
      expect(e.icon, `${e.id} has no picker icon`).toBeTruthy();
    }
  });

  it('every worker-backed event is listed in EVENTS as nonwca', () => {
    for (const id of NON_WCA_EVENT_IDS) {
      const info = EVENTS.find((e) => e.id === id);
      expect(info, `${id} is scrambled but not offered in EVENTS`).toBeDefined();
      expect(info!.group).toBe('nonwca');
    }
  });

  it('battle non-WCA puzzles are all practisable solo', () => {
    const battleNonWca = BATTLE_PUZZLE_IDS.filter((id) => !ALL_EVENT_IDS.includes(id));
    expect(battleNonWca).toEqual(['fto', 'kilominx']);
    for (const id of battleNonWca) {
      expect(isNonWcaEvent(fromWcaSpelling(id)), `${id} has no solo scramble source`).toBe(true);
    }
  });

  it('does not claim any WCA event is worker-backed', () => {
    for (const id of NON_WCA_EVENT_IDS) {
      expect(ALL_EVENT_IDS.includes(id as string)).toBe(false);
    }
  });
});

describe('storage round-trip covers every event', () => {
  it('exports a csTimer scrType for each EventId, and imports it back', async () => {
    // EVENT_TO_CSTIMER_SCRTYPE is a total Record<EventId, string>, so its keys
    // are the runtime enumeration of the EventId union — comparing against
    // EVENTS catches an id added to the type but forgotten in the picker list.
    const exportSrc = await import('node:fs').then((fs) =>
      fs.readFileSync(
        new URL('../app/[lang]/timer/_lib/storage/export_cstimer.ts', import.meta.url),
        'utf8',
      ),
    );
    const block = exportSrc.slice(
      exportSrc.indexOf('EVENT_TO_CSTIMER_SCRTYPE'),
      exportSrc.indexOf('};', exportSrc.indexOf('EVENT_TO_CSTIMER_SCRTYPE')),
    );
    const exported = new Set(
      [...block.matchAll(/^\s*'?([A-Za-z0-9]+)'?:\s*'/gm)].map((m) => m[1]),
    );
    for (const e of EVENTS) {
      expect(exported.has(e.id), `${e.id} has no csTimer export scrType`).toBe(true);
    }
    expect([...exported].filter((id) => !EVENT_IDS.has(id))).toEqual([]);
  });

  it('imports the csTimer scrType of every non-WCA puzzle back to its EventId', async () => {
    const { parseCstimerExport } = await import('@/app/[lang]/timer/_lib/storage/import_cstimer');
    for (const id of NON_WCA_EVENT_IDS) {
      const key = cstimerKeyForEvent(id as EventId)!;
      const json = JSON.stringify({
        session1: JSON.stringify([[[0, 12340], 'R U', '', 1700000000]]),
        properties: {
          sessionData: JSON.stringify({ 1: { name: id, opt: { scrType: key }, rank: 1 } }),
        },
      });
      const parsed = parseCstimerExport(json);
      expect(parsed, `${id}: import failed`).not.toBeNull();
      expect(parsed![0].event, `${key} did not import back to ${id}`).toBe(id);
    }
  });
});
