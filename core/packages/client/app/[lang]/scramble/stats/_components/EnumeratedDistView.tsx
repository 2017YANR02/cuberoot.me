'use client';

// Config-driven distribution view for the non-WCA "enumerated" puzzles — the
// single base that replaces ~28 near-identical *DistView copies. Two data
// sources, one render:
//   - 'js'   : distribution + example/enumeration generators ship in the
//              puzzle's solver module (small state spaces, exact full-space).
//              Its download closures live in the spec (each puzzle enumerates
//              its full space its own way).
//   - 'json' : distribution precomputed offline into stats/scramble/dist_*.json
//              (larger spaces, sampled near-optimal), fetched at runtime; the
//              "download sample" CSV is built here from the embedded samples.
// Per-puzzle differences live in EnumSpec (see enumerated-specs.ts).

import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { tr } from '@/i18n/tr';
import { statsUrl } from '@/lib/stats-base';
import { computeStats, modeOf, type DistStats } from '@/lib/scramble-dist/stats';
import { downloadCsv } from '@/lib/scramble-dist/download';
import type { DistJson } from '@/lib/scramble-dist/types';

export interface TrText { zh: string; en: string }

type ExampleMap = Record<number, string[]> | Map<number, string[]>;

/** JS-baked source: everything ships in the solver module, synchronous. Each
 *  puzzle's download closures are provided by the spec (they enumerate the full
 *  state space in puzzle-specific ways). */
export interface JsSource {
  kind: 'js';
  counts: Record<string, number>;
  examplesByLength: () => ExampleMap;
  downloadAll: () => void;
  downloadBin: ((d: number) => void) | null;
  downloadAllLabel: TrText;
  downloadAllTitle?: TrText;
}

/** JSON-fetched source: read the precomputed sampled distribution. */
export interface JsonSource {
  kind: 'json';
  url: string;                     // '/stats/scramble/dist_dino.json'
  v: string;                       // cache-bust token
  fallbackStateCount: string;      // used when the JSON omits stateCountStr
  downloadSampleName: string;      // 'dino_dinoso_sample.csv'
  sampleFormat: 'near_optimal' | 'optimal' | 'bounded';  // CSV header + row shape
  downloadSampleLabel: TrText;     // "下载样本 (CSV)"
}

export interface MetaCtx { stateCountStr: string; sampleCount: number; json: DistJson | null }

export interface EnumSpec {
  event: string;                   // ScramblePreview2D event + solver deep-link
  color: string;                   // histogram fill (data colour, not a UI grey)
  seriesName: TrText;
  spaceLabel: TrText;              // top-left descriptor
  moveUnitLabel: TrText;           // top-right metric
  meta: (ctx: MetaCtx) => TrText;  // bottom explanatory paragraph
  /** page.tsx "length" tab note; not rendered here, consumed by the registry */
  lengthNote: TrText;
  source: JsSource | JsonSource;
}

interface DistData {
  counts: Record<string, number>;
  stats: DistStats | null;
  examplesByLen: Map<number, string[]>;
  loading: boolean;
  error: string | null;
  metaCtx: MetaCtx;
  generatedAt?: string;
  downloadAll: () => void;
  downloadBin: ((d: number) => void) | null;
  downloadAllLabel: TrText;
  downloadAllTitle?: TrText;
  downloadAllDisabled: boolean;
}

function toMap(m: ExampleMap): Map<number, string[]> {
  return m instanceof Map ? m : new Map(Object.entries(m).map(([k, v]) => [Number(k), v]));
}

function useDistData(source: JsSource | JsonSource): DistData {
  const [json, setJson] = useState<DistJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  const jsonUrl = source.kind === 'json' ? source.url : null;
  const jsonV = source.kind === 'json' ? source.v : null;
  useEffect(() => {
    if (source.kind !== 'json') return;
    let alive = true;
    fetch(statsUrl(source.url) + `?v=${source.v}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<DistJson>; })
      .then((d) => { if (alive) setJson(d); })
      .catch((e) => { if (alive) setError(String(e)); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsonUrl, jsonV]);

  const base = useMemo(() => {
    if (source.kind === 'js') {
      return {
        counts: source.counts,
        stats: computeStats(source.counts),
        examplesByLen: toMap(source.examplesByLength()),
        loading: false,
        error: null,
        metaCtx: { stateCountStr: '', sampleCount: 0, json: null },
        generatedAt: undefined as string | undefined,
      };
    }
    if (error) return { counts: {}, stats: null, examplesByLen: new Map<number, string[]>(), loading: false, error, metaCtx: { stateCountStr: '', sampleCount: 0, json: null }, generatedAt: undefined };
    if (!json) return { counts: {}, stats: null, examplesByLen: new Map<number, string[]>(), loading: true, error: null, metaCtx: { stateCountStr: '', sampleCount: 0, json: null }, generatedAt: undefined };
    const counts = json.histogram;
    const examplesByLen = new Map<number, string[]>();
    for (const s of json.generatedSamples ?? []) {
      const arr = examplesByLen.get(s.length) ?? [];
      if (arr.length < 12) { arr.push(s.scramble); examplesByLen.set(s.length, arr); }
    }
    return {
      counts,
      stats: { mean: json.mean, median: json.median, mode: modeOf(counts, json.min), min: json.min, max: json.max },
      examplesByLen,
      loading: false,
      error: null,
      metaCtx: { stateCountStr: json.stateCountStr ?? source.fallbackStateCount, sampleCount: json.sampleCount ?? 0, json },
      generatedAt: json.generated_at,
    };
  }, [source, json, error]);

  if (source.kind === 'js') {
    return {
      ...base,
      downloadAll: source.downloadAll,
      downloadBin: source.downloadBin,
      downloadAllLabel: source.downloadAllLabel,
      downloadAllTitle: source.downloadAllTitle,
      downloadAllDisabled: false,
    };
  }
  return {
    ...base,
    downloadAll: () => {
      const samples = json?.generatedSamples ?? [];
      const bounded = source.sampleFormat === 'bounded';
      const header = bounded ? 'length,scramble,optimal'
        : source.sampleFormat === 'optimal' ? 'optimal_length,scramble'
          : 'near_optimal_length,scramble';
      const rows = bounded
        ? samples.map((s) => `${s.length},${s.scramble},${s.optimal ? 1 : 0}`)
        : samples.map((s) => `${s.length},${s.scramble}`);
      downloadCsv(source.downloadSampleName, header, rows);
    },
    downloadBin: null,
    downloadAllLabel: source.downloadSampleLabel,
    downloadAllDisabled: (json?.generatedSamples?.length ?? 0) === 0,
  };
}

export default function EnumeratedDistView({ spec, isZh }: { spec: EnumSpec; isZh: boolean }) {
  const [yMode, setYMode] = useState<'percent' | 'count'>('percent');
  const [chartMode, setChartMode] = useState<'pdf' | 'cdf'>('pdf');
  const [selectedBin, setSelectedBin] = useState<number | null>(null);

  const d = useDistData(spec.source);

  const exampleBins = useMemo(
    () => [...d.examplesByLen.keys()].sort((a, b) => a - b),
    [d.examplesByLen],
  );
  const effectiveBin = selectedBin
    ?? (d.stats && d.examplesByLen.has(d.stats.mode) ? d.stats.mode : exampleBins[0] ?? null);
  const shown = effectiveBin !== null ? (d.examplesByLen.get(effectiveBin) ?? []) : [];
  const solverHref = (scr: string) => `/scramble/solver?${new URLSearchParams({ event: spec.event, scramble: scr })}`;

  const series = useMemo<HistSeries[]>(() => [{
    name: tr(spec.seriesName),
    fillColors: [spec.color],
    counts: d.counts,
  }], [d.counts, spec]);

  if (d.error) {
    return <div className="scramble-stats-error">{tr({ zh: '加载失败', en: 'Load failed' })}: {d.error}</div>;
  }
  if (d.loading) {
    return <div className="scramble-stats-loading">{tr({ zh: '加载中…', en: 'Loading…' })}</div>;
  }

  const binCount = effectiveBin !== null ? Number(d.counts[String(effectiveBin)] ?? 0) : 0;

  return (
    <>
      <div className="scramble-stats-controls">
        <div className="scramble-stats-puzzle-meta">
          <span>{tr(spec.spaceLabel)}</span>
          <span className="scramble-stats-puzzle-metric">{tr(spec.moveUnitLabel)}</span>
        </div>
        <button
          type="button"
          className="ivy-dl-all"
          onClick={d.downloadAll}
          disabled={d.downloadAllDisabled}
          title={d.downloadAllTitle ? tr(d.downloadAllTitle) : undefined}
        >
          <Download size={14} aria-hidden />
          {tr(d.downloadAllLabel)}
        </button>
      </div>

      <div className="scramble-stats-chart-wrapper">
        <DiscreteHistogram
          series={series}
          isZh={isZh}
          yMode={yMode}
          chartMode={chartMode}
          hideLegendColors
          clickableBins={exampleBins}
          selectedBin={effectiveBin}
          onBarClick={(b) => setSelectedBin(b)}
          onChartModeToggle={() => setChartMode(chartMode === 'pdf' ? 'cdf' : 'pdf')}
          onYModeToggle={() => setYMode(yMode === 'percent' ? 'count' : 'percent')}
          meanValue={d.stats?.mean}
          medianValue={d.stats?.median}
        />
      </div>

      {effectiveBin !== null && (
        <div className="scramble-stats-panel scramble-stats-examples-panel">
          <div className="scramble-stats-examples-header">
            <div className="scramble-stats-panel-title">
              {tr({ zh: '{n} 步示例', en: '{n}-move examples' }).replace('{n}', String(effectiveBin))}
            </div>
            {d.downloadBin && (
              <button
                type="button"
                className="scramble-stats-download-btn"
                onClick={() => d.downloadBin!(effectiveBin)}
                title={tr({ zh: '下载该步数全部 {n} 条打乱 (txt)', en: 'Download all {n} scrambles of this length (txt)' }).replace('{n}', binCount.toLocaleString())}
                aria-label={tr({ zh: '下载该步数全部打乱', en: 'Download all scrambles of this length' })}
              >
                <Download size={14} aria-hidden />
              </button>
            )}
          </div>
          {shown.length > 0 ? (
            <ul className="scramble-stats-examples-list">
              {shown.map((scr, i) => (
                <li key={i}>
                  <Link
                    className="scramble-stats-examples-cube"
                    href={solverHref(scr)}
                    prefetch={false}
                    aria-label={tr({ zh: '在求解器中打开', en: 'Open in solver' })}
                  >
                    <ScramblePreview2D event={spec.event} scramble={scr} size={26} />
                  </Link>
                  <div className="scramble-stats-examples-body">
                    <Link className="scramble-stats-examples-scramble" href={solverHref(scr)} prefetch={false}>
                      {scr}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="scramble-stats-examples-hint">{tr({ zh: '此步数无示例', en: 'No examples for this length' })}</div>
          )}
        </div>
      )}

      <div className="scramble-stats-meta">
        <span>{tr(spec.meta(d.metaCtx))}</span>
        {d.generatedAt && <span>{tr({ zh: '生成时间', en: 'Generated' })}: {d.generatedAt}</span>}
      </div>
    </>
  );
}
