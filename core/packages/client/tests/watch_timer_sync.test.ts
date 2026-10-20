import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTimerStoreData } from '@cuberoot/shared/timer';
import { startWatchTimerSync } from '../../app-ui/src/watch-timer-sync';
import type { TimerRepository } from '../../app-ui/src/data/timer-repository';
import { watchTimerSlot, type WatchTimerPort, type WatchTimerRecord } from '../../app-ui/src/watch-timer';
const generator = vi.hoisted(() => ({ next: vi.fn(), reset: vi.fn() }));
vi.mock('@cuberoot/timer-ui/random-scramble', () => ({ createRandomScrambleClient: () => generator }));
vi.mock('@cuberoot/timer-ui/scramble-preview', () => ({ renderTimerScrambleSvg: async () => null }));
let stop: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
  generator.next.mockResolvedValue({ ok:true, event:'333', kind:'generated', scramble:"R U R'" });
});
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });
function setup() {
  const data = createTimerStoreData(100, 'session', 'en');
  const record: WatchTimerRecord = { version:1, id:'watch-record', slot:watchTimerSlot(data,"R U R'"),
    ts:100, timeMs:12345, penalty:'ok', inspectionMs:0 };
  const port: WatchTimerPort = { read:vi.fn().mockResolvedValue({installed:true, records:[record], requestId:'request', configuration:''}),
    publish:vi.fn().mockResolvedValue(undefined), acknowledge:vi.fn().mockResolvedValue(undefined) };
  const repo = { load:vi.fn().mockResolvedValue(data), importWatchSolve:vi.fn().mockResolvedValue(data) };
  return {data, record, port, repo};
}
describe('watch delivery pump', () => {
  it('acknowledges only after the repository operation commits', async () => {
    const {repo, port, data} = setup();
    let commit!: (v:typeof data) => void;
    repo.importWatchSolve.mockImplementationOnce(() => new Promise(resolve => { commit = resolve; }));
    stop = startWatchTimerSync(port, repo as unknown as TimerRepository, async op => { await op(); });
    await vi.advanceTimersByTimeAsync(0);
    expect(port.acknowledge).not.toHaveBeenCalled();
    commit(data); await vi.advanceTimersByTimeAsync(0);
    expect(port.acknowledge).toHaveBeenCalledWith(['watch-record']);
    expect(port.publish).toHaveBeenCalledOnce();
    const batch = vi.mocked(port.publish).mock.calls[0][0];
    expect(batch.slots).toHaveLength(10);
    expect(new Set(batch.slots.map(s => s.id)).size).toBe(10);
    expect(batch.slots[0].sessionId).toBe('session');
  });
  it('keeps failed imports unacknowledged and retries on the next pump', async () => {
    const {repo, port} = setup();
    repo.importWatchSolve.mockRejectedValueOnce(new Error('disk full'));
    stop = startWatchTimerSync(port, repo as unknown as TimerRepository, async op => { await op(); });
    await vi.advanceTimersByTimeAsync(0);
    expect(port.acknowledge).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(port.acknowledge).toHaveBeenCalledOnce();
  });
  it('does not publish a batch generated for a group which changed while generation ran', async () => {
    const {repo, port, data} = setup();
    repo.load.mockResolvedValueOnce(data).mockResolvedValue({...data, settings:{...data.settings, event:'222'}});
    stop = startWatchTimerSync(port, repo as unknown as TimerRepository, async op => { await op(); });
    await vi.advanceTimersByTimeAsync(0);
    expect(port.publish).not.toHaveBeenCalled();
  });
  it('imports an old inbox without generating or publishing when no watch is installed', async () => {
    const {repo, port, record} = setup();
    vi.mocked(port.read).mockResolvedValue({installed:false, records:[record], requestId:'', configuration:''});
    stop = startWatchTimerSync(port, repo as unknown as TimerRepository, async op => { await op(); });
    await vi.advanceTimersByTimeAsync(0);
    expect(port.acknowledge).toHaveBeenCalledOnce();
    expect(generator.next).not.toHaveBeenCalled();
  });
});
