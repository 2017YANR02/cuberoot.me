import type { Bilingual } from './comparison-data';
export type MachineId = 'mac';
export const BENCHMARK_MACHINES: readonly { id: MachineId; label: Bilingual; threads: number; note: Bilingual }[] = [
  { id: 'mac', threads: 16, label: { zh: 'Mac · M5 Pro · 16 线程', en: 'Mac · M5 Pro · 16 threads' },
    note: { zh: '1000 条 · 单轮 · 不预热', en: '1000 scrambles · one pass · no warmup' } },
];
export type MultithreadResult = { id: string; machineId: MachineId; threads: number; seconds: number; peakRssBytes: number };
/** Local 16-thread results only. Historical and server runs remain archived. */
export const WCA_BENCHMARK = {
  count: 1000, passes: 1, warmup: 0,
  corpusSha256: '5b42a18086b27e974115a73696702017b5dde0a19c9819a77c88c8014d67c8ea',
  results: [
    {
      "id": "rust-opt-9",
      "machineId": "mac",
      "threads": 16,
      // Official fixed-context release; prior local run, not a new comparative run.
      "seconds": 43.23124978399998,
      "peakRssBytes": 15638528000
    },
    // Approved Opt10 coset result; solver RSS from /usr/bin/time, not guard-tree RSS.
    // Evidence: .tmp/cubeopt-reverse/wca1000-mt16-rust-native-opt10-exp-coset-report.json
    {
      "id": "rust-opt-10",
      "machineId": "mac",
      "threads": 16,
      "seconds": 24.591098480000003,
      "peakRssBytes": 31207653376
    }
  ] as MultithreadResult[],
};
