'use client';

// Config-driven distribution view for the non-WCA "enumerated" puzzles — the
// single base that replaces ~28 near-identical *DistView copies. Two data
// sources, one render:
//   - 'js'   : exact counts with bounded precomputed samples or the existing
//              small-puzzle example helpers. Download behavior lives in the spec.
//   - 'json' : distribution precomputed offline into stats/scramble/dist_*.json
//              (larger spaces, sampled near-optimal), fetched at runtime; the
//              "download sample" CSV is built here from the embedded samples.
// Per-puzzle differences live in EnumSpec (see enumerated-specs.ts).

import { useEffect, useMemo, useState } from 'react';
import { Download } from '@app-foundation/icons/lucide';
import Link from '@/components/AppLink';
import DiscreteHistogram, { type HistSeries } from './DiscreteHistogram';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { tr } from '@/i18n/tr';
import { statsUrl } from '@/lib/stats-base';
import { computeStats, modeOf, type DistStats } from '@/lib/scramble-dist/stats';
import { downloadCsv } from '@/lib/scramble-dist/download';
import type { DistJson } from '@/lib/scramble-dist/types';
import { LoadingIndicator } from '@/components/LoadingIndicator';

export interface TrText { zh: string; en: string }

/** Pre-generated gzip files. Following a link never enumerates or expands them. */
export interface ExactDownloadAsset { url: string; bytes: number; rows: number; sha256: string }
export interface ExactDownloads {
  allStates?: ExactDownloadAsset;
  byDepth?: Record<string, ExactDownloadAsset>;
}

function assetSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

type ExampleMap = Record<number, string[]> | Map<number, string[]>;

/** Synchronous exact source. Precomputed entries need no browser solver;
 *  existing small-puzzle specs retain their own example/download helpers. */
export interface JsSource {
  kind: 'js';
  counts: Record<string, number>;
  examplesByLength: () => ExampleMap;
  /** Published count tables may have no exported witnesses, including depth zero. */
  examplesAvailable?: boolean;
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
  /** An author's complete table whose full independent validation remains unpublished. */
  sourceStatus?: 'published-unverified';
  puzzleDescription?: string;
  previewEvent?: string;
  previewLabel?: TrText;
  /** null disables links when the existing simulator uses a different physical model. */
  exampleLink?: { href: (scramble: string) => string; label: TrText } | null;
  solutionForScramble?: (scramble: string) => string | undefined;
  solvedLabel?: TrText;
  subgoal?: boolean;
  quotient?: boolean;
  downloadExamples?: { run: () => void; label: TrText };
  downloads?: ExactDownloads;
  references?: { href: string; label: TrText }[];
  showBarLabels?: boolean;
  xTickStep?: number;
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
      const examplesByLen = new Map(toMap(source.examplesByLength()));
      if (source.examplesAvailable !== false && source.counts['0'] > 0 && !examplesByLen.has(0)) examplesByLen.set(0, ['']);
      return {
        counts: source.counts,
        stats: computeStats(source.counts),
        examplesByLen,
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
  const solverHref = (scr: string) => spec.exampleLink === null ? null : (spec.exampleLink?.href(scr)
    ?? `/scramble/solver?${new URLSearchParams({ event: spec.event, scramble: scr })}`);
  const exampleLinkLabel = spec.exampleLink?.label ?? { zh: '在求解器中打开', en: 'Open in solver' };
  const solvedLabel = spec.solvedLabel ?? { zh: '已还原', en: 'Solved' };

  const series = useMemo<HistSeries[]>(() => [{
    name: tr(spec.seriesName),
    fillColors: [spec.color],
    counts: d.counts,
  }], [d.counts, spec]);

  if (d.error) {
    return <div className="scramble-stats-error">{tr({ zh: '加载失败', en: 'Load failed' })}: {d.error}</div>;
  }
  if (d.loading) {
    return <div className="scramble-stats-loading"><LoadingIndicator>{tr({ zh: '加载中…', en: 'Loading…' })}</LoadingIndicator></div>;
  }

  const binCount = effectiveBin !== null ? Number(d.counts[String(effectiveBin)] ?? 0) : 0;
  const binAsset = effectiveBin !== null ? spec.downloads?.byDepth?.[String(effectiveBin)] : undefined;

  return (
    <>
      <div className="scramble-stats-controls">
        <div className="scramble-stats-puzzle-meta">
          <span>{tr(spec.spaceLabel)}</span>
          {spec.source.kind === 'js' && d.stats && (
            <span>{tr(spec.sourceStatus === 'published-unverified'
              ? { zh: '作者报告上帝之数：{n}', en: "Author-reported God’s number: {n}" }
              : spec.subgoal || spec.quotient
              ? { zh: '子目标最大最优步数：{n}', en: 'Maximum optimal distance to the sub-goal: {n}' }
              : { zh: '上帝之数：{n}', en: "God’s number: {n}" }).replace('{n}', String(d.stats.max))}</span>
          )}
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
        {spec.downloadExamples && (
          <button type="button" className="ivy-dl-all" onClick={spec.downloadExamples.run}>
            <Download size={14} aria-hidden />
            {tr(spec.downloadExamples.label)}
          </button>
        )}
        {spec.downloads?.allStates && (
          <a className="ivy-dl-all" href={spec.downloads.allStates.url} download>
            <Download size={14} aria-hidden />
            {tr(spec.quotient
              ? { zh: '全部陪集代表 (CSV.gz)', en: 'All coset representatives (CSV.gz)' }
              : { zh: '全部状态 (CSV.gz)', en: 'All states (CSV.gz)' })}
            {' · '}{assetSize(spec.downloads.allStates.bytes)}
          </a>
        )}
      </div>

      <div className="scramble-stats-chart-wrapper">
        <DiscreteHistogram
          series={series}
          isZh={isZh}
          yMode={yMode}
          chartMode={chartMode}
          hideLegendColors
          showBarLabels={spec.showBarLabels}
          formatBin={spec.xTickStep ? depth => depth % spec.xTickStep! === 0 || depth === d.stats?.max ? String(depth) : '' : undefined}
          clickableBins={exampleBins}
          selectedBin={effectiveBin}
          onBarClick={(b) => setSelectedBin(b)}
          onChartModeToggle={() => setChartMode(chartMode === 'pdf' ? 'cdf' : 'pdf')}
          onYModeToggle={() => setYMode(yMode === 'percent' ? 'count' : 'percent')}
          meanValue={d.stats?.mean}
          medianValue={d.stats?.median}
          totalUnit={spec.quotient ? { zh: '个陪集', en: 'cosets' } : undefined}
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
            {binAsset && (
              <a className="ivy-dl-all" href={binAsset.url} download>
                <Download size={14} aria-hidden />
                {tr(spec.quotient
                  ? { zh: '本档全部 {n} 个陪集代表 (TXT.gz)', en: 'All {n} coset representatives at this depth (TXT.gz)' }
                  : { zh: '本档全部 {n} 态 (TXT.gz)', en: 'All {n} states at this depth (TXT.gz)' })
                  .replace('{n}', binAsset.rows.toLocaleString())}
                {' · '}{assetSize(binAsset.bytes)}
              </a>
            )}
          </div>
          {spec.previewLabel && <div className="scramble-stats-examples-hint">{tr(spec.previewLabel)}</div>}
          {shown.length > 0 ? (
            <ul className="scramble-stats-examples-list">
              {shown.map((scr, i) => {
                const href = scr ? solverHref(scr) : null;
                const solution = spec.solutionForScramble?.(scr);
                // Some trainer targets deliberately exclude the solved cube.
                // An empty scramble is still a valid nonzero-distance witness.
                const emptyScrambleLabel = effectiveBin === 0 ? solvedLabel : {
                  zh: '整颗还原状态', en: 'Fully solved starting state',
                };
                const preview = <ScramblePreview2D event={spec.previewEvent ?? spec.event} scramble={scr} size={26} puzzleDescription={spec.puzzleDescription} />;
                return (
                <li key={i}>
                  {href ? (
                    <Link
                      className="scramble-stats-examples-cube"
                      href={href}
                      prefetch={false}
                      aria-label={tr(exampleLinkLabel)}
                    >
                      {preview}
                    </Link>
                  ) : (
                    <div className="scramble-stats-examples-cube">
                      {preview}
                    </div>
                  )}
                  <div className="scramble-stats-examples-body">
                    {href ? (
                      <Link className="scramble-stats-examples-scramble" href={href} prefetch={false}>{scr}</Link>
                    ) : <span className="scramble-stats-examples-scramble">{scr || tr(emptyScrambleLabel)}</span>}
                    {solution !== undefined && (scr || solution) && (
                      <div className="scramble-stats-examples-scramble">
                        {tr({ zh: '最优解：', en: 'Optimal solution: ' })}
                        {solution || tr(solvedLabel)}
                      </div>
                    )}
                  </div>
                </li>
                );
              })}
            </ul>
          ) : (
            <div className="scramble-stats-examples-hint">{tr({ zh: '此步数无示例', en: 'No examples for this length' })}</div>
          )}
        </div>
      )}

      <div className="scramble-stats-meta">
        <span>{tr(spec.meta(d.metaCtx))}</span>
        {spec.references?.map(reference => (
          <a key={reference.href} href={reference.href} target="_blank" rel="noreferrer">{tr(reference.label)}</a>
        ))}
        {d.generatedAt && <span>{tr({ zh: '生成时间', en: 'Generated' })}: {d.generatedAt}</span>}
      </div>
    </>
  );
}
