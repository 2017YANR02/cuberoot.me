import { describe, expect, it } from 'vitest';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { initialTimerMachineState, transitionTimer, type SolveResult, type TimerPhase } from '@cuberoot/shared/timer';
import { MultiCubeTrainingController } from '@/app/[lang]/timer/_lib/multi-cube-training';

const faces = (alg: string) => smartCubeTargetFacelets(alg)!;
const ticket = (id: number, scramble: string) => ({ id, event: 'cross' as const, scramble,
  targetFacelets: faces(scramble), caseId: `case-${id}` });

function harness(ids = ['A', 'B']) {
  let phase: TimerPhase = 'idle';
  let nextCount = 0;
  let autoReady = true;
  const arms: (number | undefined)[] = [];
  const starts: string[] = [];
  const records: string[] = [];
  const stops: string[] = [];
  const displays: number[] = [];
  const controller = new MultiCubeTrainingController<ReturnType<typeof ticket>>({
    timer: {
      getPhase: () => phase,
      canStartAttempt: () => true,
      isTimingEnabled: () => true,
      autoReadyOnScramble: () => autoReady,
      armFromCube: at => {
        if (phase !== 'idle' && phase !== 'stopped') return false;
        phase = 'ready'; arms.push(at); return true;
      },
      startFromCube: () => {
        if (phase !== 'ready') return false;
        phase = 'running';
        const cube = controller.active()!;
        starts.push(`${cube.id}:${cube.context!.caseId}`);
        return true;
      },
      stopFromCube: () => {
        if (phase !== 'running') return false;
        phase = 'stopped';
        stops.push(`${controller.active()!.id}:${controller.active()!.context!.scramble}`);
        return true;
      },
      recordMove: ({ move }) => records.push(`${controller.active()!.id}:${move}`),
      solve: async () => null,
    },
    onChange: () => {},
    onActive: () => {},
    onCancelArm: () => { phase = 'idle'; },
    onDisplay: context => displays.push(context.id),
    onNeedScramble: () => { nextCount++; },
  });
  ids.forEach(id => controller.connect(id, true));
  const move = (id: string, alg: string, move: string, timestamp: number, futureHistory = false) =>
    controller.move(id, { facelets: faces(alg), move, timestamp, metadata: { futureHistory } });
  controller.setContext(ticket(1, 'R U'));
  return { controller, move, arms, starts, records, stops, displays,
    phase: () => phase, nextCount: () => nextCount,
    manual: () => { autoReady = false; },
    cancel: () => { phase = 'stopped'; controller.finishActive(); },
  };
}

describe('one athlete training with multiple smart cubes', () => {
  it.each([0, 15].flatMap(inspectionSec => ['before', 'after'].map(order => ({ inspectionSec, order }))))(
    'hands off full 3x3 solves with $inspectionSec-second inspection when B is prepared $order A stops', ({ inspectionSec, order }) => {
      let now = 0;
      let state = initialTimerMachineState();
      const completed: Array<SolveResult & { cube: string; scramble: string }> = [];
      const records: string[] = [];
      const fullTicket = (id: number, scramble: string) => ({ id, event: '333' as const, scramble, targetFacelets: faces(scramble) });
      const apply = (type: 'arm-from-cube' | 'start-from-cube' | 'stop-from-cube', atMs?: number) => {
        const result = transitionTimer(state, { type, nowMs: now, atMs }, { inspectionSec });
        state = result.state;
        if (result.solve) completed.push({ ...result.solve, cube: controller.active()!.id, scramble: controller.active()!.context!.scramble });
        return result.accepted === true;
      };
      const controller = new MultiCubeTrainingController<ReturnType<typeof fullTicket>>({
        timer: {
          getPhase: () => state.phase, canStartAttempt: () => true, isTimingEnabled: () => true,
          autoReadyOnScramble: () => true,
          armFromCube: at => apply('arm-from-cube', at),
          startFromCube: at => apply('start-from-cube', at),
          stopFromCube: at => apply('stop-from-cube', at),
          recordMove: ({ move }) => records.push(`${controller.active()!.id}:${move}`),
          solve: async () => null,
        },
        onChange() {}, onActive() {}, onNeedScramble() {}, onDisplay() {},
        onCancelArm: () => { state = transitionTimer(state, { type: 'cancel-arm' }, { inspectionSec }).state; },
      });
      const move = (id: string, alg: string, move: string, at: number) => {
        now = at;
        controller.move(id, { move, timestamp: at, facelets: faces(alg) });
      };
      controller.connect('A', true); controller.connect('B', true);
      controller.setContext(fullTicket(1, 'R U'));
      move('A', 'R U', 'U', 100);
      expect(state.phase).toBe(inspectionSec ? 'inspecting' : 'ready');
      controller.setContext(fullTicket(2, 'F U'));
      move('A', 'R', "U'", 1000);
      move('B', 'F', 'F', 1100);
      controller.solved('B', now); // A companion's solved notification cannot stop the athlete.
      expect(state.phase).toBe('running');
      if (order === 'before') {
        move('B', 'F U', 'U', 1200);
        expect(controller.snapshot().cubes.find(cube => cube.id === 'B')!.stage).toBe('queued');
      }
      move('A', '', "R'", 5000);
      expect(state.phase).toBe('running'); // Full solves stop on the transport's solved edge.
      controller.solved('A', now);
      if (order === 'after') {
        expect(state.phase).toBe('stopped');
        expect(controller.snapshot().cubes.find(cube => cube.id === 'B')!.context?.scramble).toBe('F U');
        move('B', 'F U', 'U', 5500);
      }
      const handoffAt = now;
      expect(controller.snapshot().activeId).toBe('B');
      expect(state.phase).toBe(inspectionSec ? 'inspecting' : 'ready');
      expect(state.inspectionStartedAtMs).toBe(inspectionSec ? handoffAt : null);
      controller.setContext(fullTicket(3, 'L U'));
      move('A', 'L', 'L', handoffAt + 100);
      controller.solved('A', now); // A late notification cannot finish B's new attempt.
      move('B', 'F', "U'", handoffAt + 16000);
      move('A', 'L U', 'U', handoffAt + 16500);
      expect(controller.snapshot().activeId).toBe('B');
      move('B', '', "F'", handoffAt + 17000);
      controller.solved('B', now);
      expect(completed).toEqual([
        { cube: 'A', scramble: 'R U', timeMs: 4000, inspectionMs: inspectionSec ? 900 : 0, autoPenalty: 'ok' },
        { cube: 'B', scramble: 'F U', timeMs: 1000, inspectionMs: inspectionSec ? 16000 : 0, autoPenalty: inspectionSec ? '+2' : 'ok' },
      ]);
      expect(records).toEqual(["A:U'", "A:R'", "B:U'", "B:F'"]);
      expect(controller.snapshot().activeId).toBe('A');
    },
  );

  it('keeps B scrambling through A ready, running, and stop without replacing B’s ticket', () => {
    const h = harness();
    h.move('A', 'R U', 'U', 100);
    expect(h.controller.snapshot().activeId).toBe('A');
    expect(h.controller.snapshot().scrambleId).toBe('B');
    h.controller.setContext(ticket(2, 'F U'));
    h.move('B', 'F', 'F', 110);
    expect(h.phase()).toBe('ready');
    expect(h.records).toEqual([]);
    h.move('A', 'R', "U'", 120);
    h.move('B', 'F U2', 'U2', 125);
    expect(h.phase()).toBe('running');
    h.move('A', '', "R'", 130);
    expect(h.stops).toEqual(['A:R U']);
    expect(h.records).toEqual(["A:U'", "A:R'"]);
    expect(h.controller.snapshot().scrambleId).toBe('B');
    expect(h.controller.snapshot().cubes.find(c => c.id === 'B')!.context!.id).toBe(2);
    expect(h.nextCount()).toBe(1);
    h.move('B', 'F U', "U'", 140);
    expect(h.controller.snapshot().activeId).toBe('B');
    expect(h.controller.snapshot().scrambleId).toBe('A');
    h.controller.setContext(ticket(3, 'L U'));
    h.move('B', 'F', "U'", 150);
    expect(h.starts).toEqual(['A:case-1', 'B:case-2']);
  });

  it('queues a cube completed early without stealing timing or backdating its observation', () => {
    const h = harness();
    h.move('A', 'R U', 'U', 100);
    h.controller.setContext(ticket(2, 'F U'));
    h.move('A', 'R', "U'", 110);
    h.move('B', 'F U', 'U', 120);
    expect(h.controller.snapshot().activeId).toBe('A');
    expect(h.controller.snapshot().cubes.find(c => c.id === 'B')!.stage).toBe('queued');
    expect(h.arms).toEqual([100]);
    h.move('A', '', "R'", 200);
    expect(h.controller.snapshot().activeId).toBe('B');
    expect(h.phase()).toBe('ready');
    expect(h.arms).toEqual([100, undefined]);
    expect(h.stops).toEqual(['A:R U']);
    h.controller.solved('A', 200);
    expect(h.phase()).toBe('ready');
    expect(h.stops).toEqual(['A:R U']);
  });

  it('assigns three cubes in connection order and then recycles the finished cube', () => {
    const h = harness(['A', 'B', 'C']);
    h.move('A', 'R U', 'U', 1);
    expect(h.controller.snapshot().scrambleId).toBe('B');
    h.controller.setContext(ticket(2, 'F U'));
    h.move('B', 'F U', 'U', 2);
    expect(h.controller.snapshot().scrambleId).toBe('C');
    h.controller.setContext(ticket(3, 'L U'));
    h.move('C', 'L U', 'U', 3);
    expect(h.controller.snapshot().scrambleId).toBe(null);
    h.move('A', 'R', "U'", 4);
    h.move('A', '', "R'", 5);
    expect(h.controller.snapshot().activeId).toBe('B');
    expect(h.controller.snapshot().scrambleId).toBe('A');
    expect(h.controller.snapshot().cubes.find(c => c.id === 'C')!.stage).toBe('queued');
  });

  it('revalidates a disturbed queued cube against its original ticket', () => {
    const h = harness();
    h.move('A', 'R U', 'U', 1);
    h.controller.setContext(ticket(2, 'F U'));
    h.move('B', 'F U', 'U', 2);
    h.move('B', 'F U2', 'U', 3);
    expect(h.controller.snapshot().scrambleId).toBe('B');
    expect(h.displays).toEqual([2]);
    expect(h.controller.snapshot().cubes.find(c => c.id === 'B')!.guidance.match).toBe(false);
    h.move('A', 'R', "U'", 4);
    h.move('A', '', "R'", 5);
    expect(h.controller.snapshot().activeId).toBe(null);
    h.move('B', 'F U', "U'", 6);
    expect(h.controller.snapshot().activeId).toBe('B');
    expect(h.nextCount()).toBe(2);
  });

  it('ignores stale history completion and state-only sync for queue promotion', () => {
    const h = harness();
    h.controller.syncFacelets('A', faces('R U'));
    h.move('A', 'R U', 'U', 1, true);
    expect(h.controller.snapshot().activeId).toBe(null);
    expect(h.arms).toEqual([]);
    h.move('A', 'R U', 'U', 2);
    expect(h.controller.snapshot().activeId).toBe('A');
  });

  it('pins a disconnected running cube; explicit cancellation advances the waiting queue', () => {
    const h = harness();
    h.move('A', 'R U', 'U', 1);
    h.controller.setContext(ticket(2, 'F U'));
    h.move('A', 'R', "U'", 2);
    h.controller.connect('A', false);
    h.move('B', 'F U', 'U', 3);
    h.move('A', '', "R'", 4);
    expect(h.controller.snapshot().activeId).toBe('A');
    expect(h.phase()).toBe('running');
    expect(h.stops).toEqual([]);
    h.cancel();
    expect(h.controller.snapshot().activeId).toBe('B');
    expect(h.phase()).toBe('ready');
  });

  it('does not let an old displayed ticket attach to the next scrambling cube', () => {
    const h = harness();
    h.move('A', 'R U', 'U', 1);
    h.controller.setContext(ticket(1, 'R U'));
    expect(h.controller.snapshot().cubes.find(c => c.id === 'B')!.context).toBe(null);
    h.move('B', 'R U', 'U', 2);
    expect(h.controller.snapshot().cubes.find(c => c.id === 'B')!.stage).toBe('preparing');
  });

  it('preserves manual start and does not arm merely because preparation finished', () => {
    const h = harness(); h.manual();
    h.move('A', 'R U', 'U', 1);
    h.controller.resume();
    expect(h.controller.snapshot().activeId).toBe('A');
    expect(h.arms).toEqual([]);
    h.move('A', 'R', "U'", 2);
    expect(h.starts).toEqual([]);
  });

  it('revokes ready when an authoritative state packet changes the active cube', () => {
    const h = harness();
    h.move('A', 'R U', 'U', 1);
    h.controller.setContext(ticket(2, 'F U'));
    h.controller.syncFacelets('A', faces('R U2'));
    expect(h.phase()).toBe('idle');
    expect(h.controller.snapshot().activeId).toBe(null);
    expect(h.controller.snapshot().scrambleId).toBe('B');
    h.move('A', 'R U', "U'", 2);
    expect(h.controller.snapshot().activeId).toBe('A');
    expect(h.phase()).toBe('ready');
  });

  it('cancels an unstarted disconnected cube and promotes the next verified cube', () => {
    const h = harness();
    h.move('A', 'R U', 'U', 1);
    h.controller.setContext(ticket(2, 'F U'));
    h.move('B', 'F U', 'U', 2);
    h.controller.connect('A', false);
    expect(h.controller.snapshot().activeId).toBe('B');
    expect(h.phase()).toBe('ready');
    expect(h.arms).toEqual([1, undefined]);
  });
});
