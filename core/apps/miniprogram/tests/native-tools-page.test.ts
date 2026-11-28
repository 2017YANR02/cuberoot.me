import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNativeToolsPageOptions } from '../src/lib/native-tools-page';
import { requestJson } from '../src/lib/auth';

vi.mock('../src/lib/auth', () => ({ requestJson: vi.fn() }));
vi.mock('../src/lib/appearance', () => ({ applyNativeAppearance: vi.fn() }));

function fixture() {
  const options = createNativeToolsPageOptions();
  return {
    ...options, active: true,
    data: { ...options.data, mode: 'person' as const, query: '2017YANR02' },
    setData(data: Record<string, unknown>) { Object.assign(this.data, data); },
  };
}
const input = (value: string) => ({ detail: { value } }) as WechatMiniprogram.Input;
const tap = (dataset: Record<string, string>) => ({ currentTarget: { dataset } }) as WechatMiniprogram.TouchEvent;
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const person = { profile: { person: { name: 'Test Person' }, personal_records: {} }, comps: [] };

describe('native personal results query', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('keeps completed results visible when returning to the tools tab and supports manual refresh', async () => {
    vi.stubGlobal('wx', { setNavigationBarTitle: vi.fn() });
    try {
      vi.mocked(requestJson).mockResolvedValue(person);
      const page = fixture();
      page.onShow();
      await flush();
      page.onHide();
      page.onShow();
      expect(page.data).toMatchObject({ personName: 'Test Person', loading: false });
      expect(requestJson).toHaveBeenCalledTimes(1);
      page.search();
      await flush();
      expect(requestJson).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('clears the previous identity and results as soon as the query changes', async () => {
    vi.mocked(requestJson).mockResolvedValue(person);
    const page = fixture();
    page.search();
    await flush();
    expect(page.data.personName).toBe('Test Person');
    page.inputQuery(input('2017'));
    expect(page.data).toMatchObject({ personName: '', rows: [], error: '', searched: false });
    page.search();
    expect(page.data.error).not.toBe('');
    expect(requestJson).toHaveBeenCalledTimes(1);
    page.inputQuery(input('2017YANR02'));
    expect(page.data.error).toBe('');
  });

  it('ignores an old response after editing or clearing its query', async () => {
    let resolve!: (value: typeof person) => void;
    vi.mocked(requestJson).mockReturnValue(new Promise(r => { resolve = r; }));
    const page = fixture();
    page.search();
    page.clearQuery();
    resolve(person);
    await flush();
    expect(page.data).toMatchObject({ query: '', rows: [], personName: '', loading: false, searched: false });
  });

  it('distinguishes a completed empty result from a query not submitted yet', async () => {
    vi.mocked(requestJson).mockResolvedValue(person);
    const page = fixture();
    expect(page.data.searched).toBe(false);
    page.search();
    await flush();
    expect(page.data).toMatchObject({ rows: [], searched: true, loading: false });
  });

  it('ignores a personal response after switching to another tool', async () => {
    let resolve!: (value: typeof person) => void;
    vi.mocked(requestJson).mockReturnValueOnce(new Promise(r => { resolve = r; })).mockResolvedValueOnce({ records: [] });
    const page = fixture();
    page.search();
    page.changeMode({ detail: { value: '1' } } as WechatMiniprogram.PickerChange);
    await flush();
    resolve(person);
    await flush();
    expect(page.data).toMatchObject({ mode: 'records', personName: '', rows: [], loading: false });
  });
});

describe('native offline utilities', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calculates timed averages with shared DNF handling and clears stale results after edits', () => {
    const page = fixture();
    page.selectTool(tap({ section: 'average' }));
    page.inputAverage(input('12.34\n11.75\nDNF\n13.20\n10.95'));
    page.calculateAverage();
    expect(page.data.averageResults.map(result => result.value)).toEqual(['10.95', 'DNF', '12.43', '—']);

    page.inputAverage(input('12.34\ninvalid'));
    page.calculateAverage();
    expect(page.data.averageResults).toEqual([]);
    expect(page.data.averageError).not.toBe('');
    expect(requestJson).not.toHaveBeenCalled();
  });

  it('supports compact inverse notation and retains grouping in mirror transforms', () => {
    const page = fixture();
    page.selectTool(tap({ section: 'alg' }));
    page.inputAlg(input("RUR'U'"));
    page.transformAlg(tap({ action: 'inverse' }));
    expect(page.data.algOutput).toBe("U R U' R'");
    page.inputAlg(input('[R, U]'));
    page.transformAlg(tap({ action: 'M' }));
    expect(page.data.algOutput).toBe("[L', U']");
    expect(requestJson).not.toHaveBeenCalled();
  });
});
