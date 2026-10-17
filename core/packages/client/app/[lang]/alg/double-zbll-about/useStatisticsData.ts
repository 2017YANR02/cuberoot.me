'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AlgCase } from '@cuberoot/shared/alg';
import { countMoves, type Metric } from '@cuberoot/shared/alg-notation';
import { loadTrainingAlg } from '@/lib/alg_case_alignment';
import { availableKinds, generateScramble, purifyScramble, cstimerStyleScramble, type ScrambleKind } from '@/lib/trainer-scramble';

export type Sample = { name: string; scramble: string; fallback: boolean };
export const singleModes = ['htm', 'inv', 'stm', 'sqtm', 'qtm', 'coep', 'cstimer'] as const;
export type Mode = typeof singleModes[number] | 'double-zbll';

export function useStatisticsData(pll: boolean) {
  const [cases, setCases] = useState<AlgCase[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    let active = true;
    setCases([]); setSamples([]); setError(false); setProgress(0); setFailed(0); setRunning(true);
    void (async () => {
      try {
        const files = await Promise.all([loadTrainingAlg('3x3', 'zbll'), ...(pll ? [loadTrainingAlg('3x3', 'pll')] : [])]);
        if (!active) return;
        const loaded = files.flatMap(file => file.cases);
        setCases(loaded);
        const rows: Sample[] = [];
        let failures = 0;
        for (const c of loaded) {
          if (!active) return;
          const base = generateScramble(c, '3x3', 'inv', { preAuf: false, postAuf: false });
          const scramble = await cstimerStyleScramble(base);
          if (!active) return;
          if (scramble) rows.push({ name: c.name, scramble: purifyScramble('3x3', scramble), fallback: false });
          else failures++;
          setProgress(rows.length + failures);
        }
        if (active) { setSamples(rows); setFailed(failures); setRunning(false); }
      } catch {
        if (active) { setError(true); setRunning(false); }
      }
    })();
    return () => { active = false; };
  }, [pll, attempt]);
  const rows = useMemo(() => Object.fromEntries(singleModes.map(kind => [kind, kind === 'cstimer' ? samples : cases.map(c => ({
    name: c.name,
    scramble: purifyScramble('3x3', generateScramble(c, '3x3', kind, { preAuf: false, postAuf: false })),
    fallback: !availableKinds(c).includes(kind),
  })).filter(row => row.scramble)])) as Record<ScrambleKind, Sample[]>, [cases, samples]);
  return { cases, rows, error, running, progress, failed, retry: () => setAttempt(value => value + 1) };
}
export type StatisticsData = ReturnType<typeof useStatisticsData>;

export function histogramFor(rows: Sample[], metric: Metric): number[] {
  const histogram: number[] = [];
  for (const row of rows) {
    const length = countMoves(row.scramble, metric);
    histogram[length] = (histogram[length] ?? 0) + 1;
  }
  return Array.from({ length: histogram.length }, (_, i) => histogram[i] ?? 0);
}

export function summarizeHistogram(histogram: number[]) {
  const count = histogram.reduce((sum, n) => sum + n, 0);
  const min = histogram.findIndex(n => n > 0);
  const max = histogram.findLastIndex(n => n > 0);
  const mean = count ? histogram.reduce((sum, n, i) => sum + n * i, 0) / count : 0;
  const quantile = (fraction: number) => {
    let cumulative = 0;
    return histogram.findIndex(n => { cumulative += n; return cumulative >= Math.max(1, Math.ceil(count * fraction)); });
  };
  return { count, min, max, mean, median: quantile(.5), p90: quantile(.9) };
}
