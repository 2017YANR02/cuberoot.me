import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCRAMBLE_222_MODE,
  DEFAULT_SCRAMBLE_222_TYPE,
  SCRAMBLE_222_MODES,
  SCRAMBLE_222_TYPE_CATALOG,
  SCRAMBLE_222_TYPES,
  SCRAMBLE_222_UI_LABELS,
  WCA_SCRAMBLE_222_TYPES,
  cstimer222Spec,
  isCube222StateType,
} from '@cuberoot/shared/timer';
import { CUBE222_STATE_TYPES } from '@cuberoot/puzzle-solvers/cube222';

const CLIENT_ROOT = fileURLToPath(new URL('../', import.meta.url));
const CORE_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const source = (relativePath: string) => readFileSync(`${CLIENT_ROOT}${relativePath}`, 'utf8');

describe('shared 2x2 scramble contract', () => {
  it('locks the two modes and optimal default', () => {
    expect(SCRAMBLE_222_MODES).toEqual(['wca', 'optimal']);
    expect(DEFAULT_SCRAMBLE_222_MODE).toBe('optimal');
    expect(DEFAULT_SCRAMBLE_222_TYPE).toBe('full');
    expect(SCRAMBLE_222_UI_LABELS).toEqual({
      modeAriaLabel: { zh: '2x2 打乱口径', en: '2x2 scramble style' },
      modeLabel: { zh: '口径', en: 'style' },
      optimal: { zh: '最优', en: 'Optimal' },
      type: { zh: '类型', en: 'Type' },
      typeAriaLabel: { zh: '2x2 打乱类型', en: '2x2 scramble type' },
      wca11Move: { zh: 'WCA 11 步', en: 'WCA 11-move' },
    });
  });

  it('offers the exact random and WCA type sets', () => {
    expect(SCRAMBLE_222_TYPES).toEqual([
      'full', '3gen', 'eg', 'cll', 'eg1', 'eg2', 'tcllp', 'tclln', 'tcll', 'ls', 'nobar',
    ]);
    expect(WCA_SCRAMBLE_222_TYPES).toEqual([
      'full', 'eg', 'cll', 'eg1', 'eg2', 'tcllp', 'tclln', 'tcll', 'ls', 'nobar',
    ]);
    expect(SCRAMBLE_222_TYPES).toHaveLength(11);
    expect(WCA_SCRAMBLE_222_TYPES).toHaveLength(10);
    expect(WCA_SCRAMBLE_222_TYPES).not.toContain('3gen');
    expect(WCA_SCRAMBLE_222_TYPES.slice(1)).toEqual(CUBE222_STATE_TYPES);
    for (const type of SCRAMBLE_222_TYPES) {
      expect(isCube222StateType(type)).toBe(type !== 'full' && type !== '3gen');
    }
  });

  it('locks every bilingual label and csTimer spec to the catalog', () => {
    expect(SCRAMBLE_222_TYPE_CATALOG.map((item) => ({
      id: item.id,
      label: item.label,
      cstimer: 'cstimer' in item ? item.cstimer : undefined,
    }))).toEqual([
      { id: 'full', label: { zh: '完整状态', en: 'Full state' }, cstimer: undefined },
      { id: '3gen', label: { zh: '三面随机转', en: '3-gen' }, cstimer: { key: '2223', length: 25 } },
      { id: 'eg', label: { zh: 'EG', en: 'EG' }, cstimer: { key: '222eg' } },
      { id: 'cll', label: { zh: 'CLL', en: 'CLL' }, cstimer: { key: '222eg0' } },
      { id: 'eg1', label: { zh: 'EG1', en: 'EG1' }, cstimer: { key: '222eg1' } },
      { id: 'eg2', label: { zh: 'EG2', en: 'EG2' }, cstimer: { key: '222eg2' } },
      { id: 'tcllp', label: { zh: 'TCLL+', en: 'TCLL+' }, cstimer: { key: '222tcp' } },
      { id: 'tclln', label: { zh: 'TCLL-', en: 'TCLL-' }, cstimer: { key: '222tcn' } },
      { id: 'tcll', label: { zh: 'TCLL', en: 'TCLL' }, cstimer: { key: '222tc' } },
      { id: 'ls', label: { zh: 'LS', en: 'LS' }, cstimer: { key: '222lsall' } },
      { id: 'nobar', label: { zh: '无连色', en: 'No Bar' }, cstimer: { key: '222nb' } },
    ]);
    for (const item of SCRAMBLE_222_TYPE_CATALOG) {
      const spec = 'cstimer' in item ? item.cstimer : null;
      expect(cstimer222Spec(item.id)).toEqual(spec);
    }
  });
});

describe('2x2 single-source consumers', () => {
  it('keeps the client adapter limited to persistence and hooks', () => {
    const adapter = source('lib/scramble-222-mode.ts');
    expect(adapter).toContain("from '@cuberoot/shared/timer'");
    expect(adapter).not.toMatch(/const\s+TYPE_META\b/);
    expect(adapter).not.toMatch(/export\s+const\s+SCRAMBLE_222_TYPES\s*=/);
    expect(adapter).not.toContain("key: '2223'");
    expect(adapter).not.toContain("key: '222eg'");
  });

  it('renders the shared controlled UI instead of a second Web implementation', () => {
    const wrapper = source('components/Scramble222ModePicker.tsx');
    expect(wrapper).toContain('TimerScramble222Config');
    expect(wrapper).toContain("from '@cuberoot/timer-ui'");
    expect(wrapper).not.toMatch(/<(?:select|option)\b/);
    expect(wrapper).not.toContain('PillToggle');
    expect(wrapper).not.toContain('VariantSelect');
    expect(wrapper).not.toContain("zh: 'WCA 11 步'");
  });

  it('keeps the raw-11/optimal control visible when a real-WCA specialist filter uses it', () => {
    const sourceBar = source('app/[lang]/timer/_components/ScrambleSourceBar.tsx');
    expect(sourceBar).toContain("showModeWithSpecialType={src === 'wca'}");
  });

  it('does not toggle the shared mode switch when a pointer gesture is cancelled', () => {
    const sharedUi = readFileSync(
      `${CORE_ROOT}packages/timer-ui/src/TimerPillToggle.tsx`,
      'utf8',
    );
    expect(sharedUi).toContain('onPointerCancel={onPointerCancel}');
    expect(sharedUi).not.toContain('onPointerCancel={onPointerUp}');
  });

  it('does not define a second catalog in the native app', () => {
    const app = readFileSync(`${CORE_ROOT}apps/mobile/src/App.tsx`, 'utf8');
    expect(app).not.toMatch(/(?:const|export\s+const)\s+SCRAMBLE_222_(?:TYPES|TYPE_CATALOG)\s*=/);
    expect(app).not.toContain("key: '2223'");
    expect(app).not.toContain("key: '222eg'");
  });

  it('generates random-source special types through the shared provider worker', () => {
    const solo = source('app/[lang]/timer/_shell/SoloView.tsx');
    const worker = source('app/[lang]/timer/_lib/scramble/cube222-special.worker.ts');
    const pool = source('app/[lang]/timer/_lib/scramble/cube222-special-pool.ts');

    expect(solo).toContain('takeCube222SpecialScramble(special)');
    expect(solo).toContain('const waiter = new AbortController()');
    expect(solo).toContain('nextCube222SpecialScramble(special, waiter.signal)');
    expect(solo).toContain('waiter.abort()');
    expect(solo).not.toContain('cstimer222Spec');
    expect(worker).toContain("from '@cuberoot/puzzle-solvers/cube222'");
    expect(worker).toContain('generate222SpecialScramble(type)');
    expect(pool).toContain("new URL('./cube222-special.worker.ts', import.meta.url)");
    expect(pool).toContain('createTimerAsyncScramblePool');
    expect(pool).toContain('createTimerWorkerRpc');
    expect(pool).not.toMatch(/new Map<.*(?:queue|pending|inFlight)/i);
    expect(pool).not.toContain('scramble_module.js');
    expect(pool).not.toContain('cstimerWorkerScramble');
  });
});
