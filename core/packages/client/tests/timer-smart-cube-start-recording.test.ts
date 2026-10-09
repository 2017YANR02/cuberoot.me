import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { SmartCubeAttemptProducer } from '@cuberoot/shared/timer/smart-cube-attempt';
import { shouldAutoRecap } from '@cuberoot/shared/timer/reconstruct/recap';
import { timerSmartCubeAttemptScramble } from '@cuberoot/shared/timer';

const source = ts.createSourceFile('SoloView.tsx', readFileSync(
  new URL('../app/[lang]/timer/_shell/SoloView.tsx', import.meta.url), 'utf8',
), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

// Execute the Web adapter's own callbacks: producer-only tests cannot catch a
// host resetting the recording immediately after useTimer invokes onStart.
function callback(find: (node: ts.Node) => ts.Node | undefined, context: Record<string, unknown>) {
  let match: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    match ??= find(node);
    if (!match) ts.forEachChild(node, visit);
  };
  visit(source);
  if (!match) throw new Error('Web timer recording callback not found');
  const { outputText } = ts.transpileModule(`(${match.getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  });
  return runInNewContext(outputText, context) as (timestamp?: number) => unknown;
}

describe('Web solo attempt recording lifecycle', () => {
  it.each(['smart cube', 'external timer'])('preserves moves and auto recap after %s starts', (mode) => {
    const producer = new SmartCubeAttemptProducer();
    const ref = <T>(current: T) => ({ current });
    const entry = { scramble: 'R U', wca: null, scrambleSource: null, caseId: 'fixture' };
    const context: Record<string, unknown> = {
      performance: { now: () => 1_000 },
      competitionRef: ref({ enabled: false }),
      scrambleHistRef: ref({ list: [entry], idx: 0 }),
      scrambleAtStartRef: ref(''),
      wcaAtStartRef: ref(null),
      scrambleSourceAtStartRef: ref(null),
      caseIdAtStartRef: ref(null),
      eventAtStartRef: ref('333'),
      attemptStartedAtRef: ref(0),
      attemptSplitRecorder: { begin: vi.fn() },
      event: '333',
      settings: { bldMemo: false, multiStage: false },
      getSettings: () => ({ preScrT: 'z2' }),
      timerSmartCubeAttemptScramble,
      bluetoothCubeRef: ref({ status: { connected: true, brand: 'gan-v4', deviceName: 'GAN16ui' } }),
      smartCubeAttemptProducerRef: ref(producer),
      setLiveSolve: vi.fn(),
      phaseSnapshotRef: ref('ready'),
      cubeStartedRef: ref(false),
      gyroStartRef: ref(0),
      timer: { phase: 'running' },
    };
    const onStart = callback(node => ts.isCallExpression(node)
      && node.expression.getText(source) === 'useTimer' ? node.arguments[1] : undefined, context);
    context.timerHandleRef = ref({ startFromCube: (timestamp: number) => {
      onStart(timestamp); // useTimer dispatch runs onStart synchronously.
      return true;
    } });
    const startFromCube = callback(node => ts.isPropertyAssignment(node)
      && node.name.getText(source) === 'startFromCube' ? node.initializer : undefined, context);
    const runningEffect = callback(node => ts.isCallExpression(node)
      && node.expression.getText(source) === 'useEffect'
      && node.arguments[0]?.getText(source).includes('else if (!cubeStartedRef.current)')
      ? node.arguments[0] : undefined, context);

    for (const startedAt of [1_000, 2_000]) {
      if (mode === 'smart cube') expect(startFromCube(startedAt)).toBe(true);
      else onStart(startedAt);
      // A move can arrive before the running-phase effect has flushed.
      expect(producer.recordMove('R', startedAt)).toBe(true);
      runningEffect();
      expect(producer.recordMove('U', startedAt + 125)).toBe(true);
      const recording = producer.finish();
      expect(recording.moves).toEqual([{ m: 'R', ts: 0 }, { m: 'U', ts: 125 }]);
      expect(recording.device).toEqual({ model: 'gan-v4', name: 'GAN16ui' });
      expect(shouldAutoRecap(recording, { autoRecap: true })).toBe(true);
      expect(shouldAutoRecap(recording, { autoRecap: false })).toBe(false);
    }
  });
});
