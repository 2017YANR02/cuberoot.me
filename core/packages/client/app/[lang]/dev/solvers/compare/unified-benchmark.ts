import type { Bilingual } from './comparison-data';
export type MachineId = 'mac';
export const BENCHMARK_MACHINES: readonly { id: MachineId; label: Bilingual; threads: number; note: Bilingual }[] = [
  { id: 'mac', threads: 18, label: { zh: 'Mac · M5 Pro · 18 线程', en: 'Mac · M5 Pro · 18 threads' },
    note: { zh: '100 条 · 单轮 · 不预热', en: '100 scrambles · one pass · no warmup' } },
];
export type MultithreadResult = { id: string; machineId: MachineId; threads: number; seconds: number; peakRssBytes: number };
/** Local 18-thread results only. Historical and server runs remain archived. */
export const WCA100 = {
  count: 100, passes: 1, warmup: 0,
  corpusSha256: '92171d593d13982924ed16723f099bd771a873aaa2c30a0e08f319c86b75dcde',
  results: [
    {
      "id": "rust-opt-9",
      "machineId": "mac",
      "threads": 18,
      "seconds": 6.385029209999999,
      "peakRssBytes": 15642624000
    },
    {
      "id": "rust-h7",
      "machineId": "mac",
      "threads": 18,
      "seconds": 25.372522463000006,
      "peakRssBytes": 3865968640
    }
  ] as MultithreadResult[],
};
