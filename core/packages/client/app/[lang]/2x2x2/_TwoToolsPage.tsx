'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, ExternalLink, Search, Settings2 } from 'lucide-react';
import { parseAsString, useQueryState } from 'nuqs';
import { loadAlg, type AlgFile } from '@cuberoot/shared';
import AlgSimPlayer from '@/components/AlgPlayer/AlgSimPlayer';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import { ClearButton } from '@/components/ClearButton';
import { Spinner } from '@/components/Spinner/Spinner';
import { useT } from '@/hooks/useT';
import { CUBE_FILL } from '@/lib/cube-colors';
import { applyPocketAlg, solvedPocketState, type PocketFace } from '@/lib/pocket-facelet';
import { persistItem } from '@/lib/safe-storage';
import type {
  TwoToolsCaseInput,
  TwoToolsDepths,
  TwoToolsSolution,
} from '@/lib/two-tools-solver';
import './two-tools.css';

const METHOD_SPECS = [
  { slug: 'cll', method: 'CLL', group: 'EG' },
  { slug: 'eg1', method: 'EG-1', group: 'EG' },
  { slug: 'eg2', method: 'EG-2', group: 'EG' },
  { slug: 'leg1', method: 'LEG-1', group: 'EG' },
  { slug: 'tcll-plus', method: 'TCLL+', group: 'TCLL' },
  { slug: 'tcll-minus', method: 'TCLL-', group: 'TCLL' },
  ...Array.from({ length: 9 }, (_, i) => ({ slug: `ls${i + 1}`, method: `LS-${i + 1}`, group: 'LS' })),
] as const;

const DEFAULT_SELECTED = new Set(['CLL', 'EG-1', 'EG-2']);
const DEFAULT_DEPTHS: TwoToolsDepths = { EG: 5, TCLL: 4, LS: 3 };
const COLOR_ORDER: PocketFace[] = ['U', 'F', 'B', 'R', 'L', 'D'];
const COLOR_NAME: Record<PocketFace, readonly [string, string]> = {
  U: ['白', 'White'], D: ['黄', 'Yellow'], F: ['绿', 'Green'],
  B: ['蓝', 'Blue'], R: ['红', 'Red'], L: ['橙', 'Orange'],
};

function algCases(files: AlgFile[]): TwoToolsCaseInput[] {
  return files.flatMap((file) => {
    const spec = METHOD_SPECS.find((item) => item.slug === file.set);
    if (!spec) return [];
    return file.cases.map((c) => ({
      set: file.set,
      method: spec.method,
      name: c.name,
      subgroup: c.subgroup,
      setup: c.setup,
      algs: c.algs.flat().map((entry) => entry.alg).filter(Boolean),
    }));
  });
}

function validScramble(value: string): boolean {
  if (!value.trim()) return false;
  try { applyPocketAlg(solvedPocketState(), value); return true; } catch { return false; }
}

function createFinderWorker(): Worker {
  return new Worker(new URL('../../../lib/two-tools.worker.ts', import.meta.url), { type: 'module' });
}

export default function TwoToolsPage() {
  const t = useT();
  const [urlScramble, setUrlScramble] = useQueryState('scramble', parseAsString.withDefault(''));
  const [draft, setDraft] = useState(urlScramble);
  const [searched, setSearched] = useState(urlScramble);
  const [cases, setCases] = useState<TwoToolsCaseInput[]>([]);
  const [dataError, setDataError] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [searching, setSearching] = useState(false);
  const [solutions, setSolutions] = useState<TwoToolsSolution[]>([]);
  const [selectedSolution, setSelectedSolution] = useState<TwoToolsSolution | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(METHOD_SPECS.map((m) => [m.method, DEFAULT_SELECTED.has(m.method)])),
  );
  const [depths, setDepths] = useState<TwoToolsDepths>(DEFAULT_DEPTHS);
  const [algsPerCase, setAlgsPerCase] = useState(1);
  const [colors, setColors] = useState<Record<PocketFace, boolean>>(() =>
    Object.fromEntries(COLOR_ORDER.map((face) => [face, true])) as Record<PocketFace, boolean>,
  );
  const [copied, setCopied] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    try {
      const storedMethods = localStorage.getItem('two-tools-methods');
      const storedDepths = localStorage.getItem('two-tools-depths');
      if (storedMethods) setSelected((old) => ({ ...old, ...JSON.parse(storedMethods) }));
      if (storedDepths) setDepths((old) => ({ ...old, ...JSON.parse(storedDepths) }));
    } catch { /* 私密模式或旧值损坏时沿用默认值 */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingData(true);
    Promise.all(METHOD_SPECS.map((spec) => loadAlg('2x2', spec.slug)))
      .then((files) => { if (!cancelled) setCases(algCases(files)); })
      .catch((error) => { if (!cancelled) setDataError(error instanceof Error ? error.message : String(error)); })
      .finally(() => { if (!cancelled) setLoadingData(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const worker = createFinderWorker();
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<{ id: number; solutions?: TwoToolsSolution[]; error?: string }>) => {
      if (event.data.id !== requestRef.current) return;
      setSearching(false);
      if (event.data.error) { setDataError(event.data.error); return; }
      const next = event.data.solutions ?? [];
      setSolutions(next);
      setSelectedSolution(next[0] ?? null);
    };
    return () => { worker.terminate(); workerRef.current = null; };
  }, []);

  const runSearch = useCallback((scramble: string) => {
    const worker = workerRef.current;
    if (!worker || !cases.length || !validScramble(scramble)) return;
    const id = ++requestRef.current;
    setSearching(true);
    setDataError('');
    worker.postMessage({
      id,
      input: {
        scramble,
        cases,
        depths,
        selectedMethods: METHOD_SPECS.filter((m) => selected[m.method]).map((m) => m.method),
        algsPerCase,
      },
    });
  }, [algsPerCase, cases, depths, selected]);

  // 数据初次到齐，或用户改了方法 / 深度 / 每格公式数，都自动刷新当前结果。
  useEffect(() => {
    if (!searched || !cases.length || !validScramble(searched)) return;
    const id = setTimeout(() => runSearch(searched), 180);
    return () => clearTimeout(id);
  }, [algsPerCase, cases, depths, runSearch, searched, selected]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = draft.trim().replaceAll('’', "'").replace(/\s+/g, ' ');
    setDraft(normalized);
    if (!validScramble(normalized)) return;
    setSearched(normalized);
    void setUrlScramble(normalized);
    runSearch(normalized);
  };

  const filtered = useMemo(
    () => solutions.filter((solution) => colors[solution.color]).slice(0, 50),
    [colors, solutions],
  );
  const previewSetup = selectedSolution
    ? [searched, selectedSolution.inspection].filter(Boolean).join(' ')
    : searched;
  const previewAlg = selectedSolution?.solution ?? '';
  const invalid = draft.trim().length > 0 && !validScramble(draft.trim().replaceAll('’', "'"));

  const setMethod = (method: string, value: boolean) => {
    const next = { ...selected, [method]: value };
    setSelected(next);
    persistItem('two-tools-methods', JSON.stringify(next));
  };
  const setDepth = (group: keyof TwoToolsDepths, value: number) => {
    const next = { ...depths, [group]: value };
    setDepths(next);
    persistItem('two-tools-depths', JSON.stringify(next));
  };
  const copySolution = async (solution: TwoToolsSolution) => {
    const text = [
      searched,
      `${solution.inspection || '-'}\t// ${t('观察', 'inspection')}`,
      `${solution.face || '-'}\t// ${solution.method === 'CLL' ? t('做层', 'layer') : t('做面', 'face')}`,
      `${solution.alg}\t// ${solution.method}`,
    ].join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(solution.solution);
    setTimeout(() => setCopied(null), 900);
  };

  return (
    <main className="tt-page">
      <header className="tt-hero">
        <p className="tt-kicker">Two-Tools × CubeRoot</p>
        <h1>{t('二阶实战解法查找器', '2×2 practical solution finder')}</h1>
        <p>{t(
          '输入任意二阶打乱，比较不同底色、建面路径和 CLL / EG / TCLL / LS 收尾，并按预期手速排序。',
          'Enter any 2×2 scramble, compare bottom colors and CLL / EG / TCLL / LS finishes, then rank them by expected speed.',
        )}</p>
        <div className="tt-source-links">
          <a href="https://github.com/WACWCA/two-tool" target="_blank" rel="noreferrer">{t('上游源码', 'Upstream source')} <ExternalLink size={13} /></a>
          <a href="https://docs.google.com/spreadsheets/d/1OFXakCV85Mp2zsQBXMxiMX9a506JeAcLnUXZr8FgXAY/" target="_blank" rel="noreferrer">{t('公式表', 'Algorithm sheet')} <ExternalLink size={13} /></a>
        </div>
      </header>

      <form className="tt-search" onSubmit={submit}>
        <label htmlFor="two-tools-scramble">{t('打乱', 'Scramble')}</label>
        <div className={`tt-search-row${invalid ? ' is-invalid' : ''}`}>
          <input
            id="two-tools-scramble"
            className="tt-scramble-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="R U R' F2 U' R2"
            autoCapitalize="characters"
            spellCheck={false}
          />
          {draft && <ClearButton onClick={() => setDraft('')} preserveFocus />}
          <button type="submit" className="tt-search-submit" disabled={invalid || !draft.trim() || loadingData || searching}>
            {searching ? <Spinner size={16} label={t('正在搜索', 'Searching')} /> : <Search size={17} />}
            <span>{t('查找解法', 'Find solutions')}</span>
          </button>
        </div>
        {invalid && <p className="tt-error">{t('只支持 U / R / F / D / L / B 与 x / y / z，后缀可用 2 或撇号。', 'Use U / R / F / D / L / B and x / y / z, optionally followed by 2 or an apostrophe.')}</p>}
      </form>

      <div className="tt-workbench">
        <aside className="tt-cube-pane">
          <div className="tt-cube-heading">
            <span>{searched || t('等待打乱', 'Waiting for a scramble')}</span>
            <AppLink href="/sim?puzzle=2" prefetch={false}>{t('在模拟器中打开', 'Open in simulator')} <ExternalLink size={12} /></AppLink>
          </div>
          <AlgSimPlayer alg={previewAlg} setup={previewSetup} puzzle="2x2" set="" size={300} />
          {selectedSolution && (
            <div className="tt-now-playing">
              <span>{selectedSolution.method}</span>
              <code>{selectedSolution.solution}</code>
            </div>
          )}
        </aside>

        <section className="tt-results-pane">
          <details className="tt-settings">
            <summary><Settings2 size={16} /> {t('方法与搜索范围', 'Methods and search range')}</summary>
            <div className="tt-settings-body">
              {(['EG', 'TCLL', 'LS'] as const).map((group) => (
                <section className="tt-method-group" key={group}>
                  <div className="tt-group-head">
                    <h2>{group}</h2>
                    <label>
                      <span>{t('建面深度', 'Build depth')}: {depths[group]}</span>
                      <input className="tt-depth-range" type="range" min={1} max={6} value={depths[group]} onChange={(e) => setDepth(group, Number(e.target.value))} />
                    </label>
                  </div>
                  <div className="tt-method-toggles">
                    {METHOD_SPECS.filter((m) => m.group === group).map((method) => (
                      <BoolToggle key={method.method} value={selected[method.method]} onChange={(value) => setMethod(method.method, value)} label={method.method} />
                    ))}
                  </div>
                </section>
              ))}
              <label className="tt-alg-count">
                <span>{t('每个 case 的公式数', 'Algorithms per case')}: {algsPerCase === 3 ? '3+' : algsPerCase}</span>
                <input className="tt-alg-count-range" type="range" min={1} max={3} value={algsPerCase} onChange={(e) => setAlgsPerCase(Number(e.target.value))} />
              </label>
            </div>
          </details>

          <div className="tt-filter-row" aria-label={t('底色筛选', 'Bottom color filter')}>
            <span>{t('底色', 'Bottom')}</span>
            {COLOR_ORDER.map((face) => (
              <button
                type="button"
                key={face}
                className={`tt-color${colors[face] ? ' is-on' : ''}`}
                style={{ '--face-color': CUBE_FILL[face] } as React.CSSProperties}
                aria-pressed={colors[face]}
                aria-label={t(`${COLOR_NAME[face][0]}底`, `${COLOR_NAME[face][1]} bottom`)}
                onClick={() => setColors((old) => ({ ...old, [face]: !old[face] }))}
              />
            ))}
          </div>

          <div className="tt-result-head" aria-live="polite">
            <h2>{t('候选解法', 'Candidate solutions')}</h2>
            <span>{searching ? t('搜索中', 'Searching') : t(`显示 ${filtered.length} / ${solutions.length}`, `Showing ${filtered.length} / ${solutions.length}`)}</span>
          </div>

          {loadingData ? (
            <div className="tt-state"><Spinner size={22} label={t('正在加载二阶公式库', 'Loading the 2×2 algorithm library')} /></div>
          ) : dataError ? (
            <div className="tt-state is-error"><strong>{t('公式库或搜索器加载失败', 'The algorithm library or finder failed to load')}</strong><span>{dataError}</span></div>
          ) : !searched ? (
            <div className="tt-state">{t('输入打乱后，这里会列出可直接练习的分段解法。', 'Enter a scramble to list practical, drill-ready solutions here.')}</div>
          ) : !searching && filtered.length === 0 ? (
            <div className="tt-state">{t('当前范围内没有解法，请开启更多方法或加深搜索。', 'No solution in the current range. Enable more methods or increase the depth.')}</div>
          ) : (
            <div className="tt-solution-list">
              {filtered.map((solution, index) => (
                <article
                  key={`${solution.color}-${solution.method}-${solution.solution}-${index}`}
                  className={`tt-solution${selectedSolution === solution ? ' is-selected' : ''}`}
                  style={{ '--face-color': CUBE_FILL[solution.color] } as React.CSSProperties}
                >
                  <button type="button" className="tt-solution-main" onClick={() => setSelectedSolution(solution)}>
                    <span className="tt-solution-rank">{String(index + 1).padStart(2, '0')}</span>
                    <span className="tt-solution-body">
                      <span className="tt-solution-title"><strong>{solution.method}</strong><span>{solution.subset}</span><small>{solution.score.toFixed(2)}</small></span>
                      <span className="tt-solution-line"><i>{t('观察', 'Inspect')}</i><code>{solution.inspection || '—'}</code></span>
                      <span className="tt-solution-line"><i>{solution.method === 'CLL' ? t('做层', 'Layer') : t('做面', 'Face')}</i><code>{solution.face || '—'}</code></span>
                      <span className="tt-solution-line is-finish"><i>{solution.method}</i><code>{solution.alg}</code></span>
                    </span>
                  </button>
                  <button type="button" className="tt-copy" onClick={() => void copySolution(solution)} title={t('复制分段解法', 'Copy segmented solution')}>
                    <Copy size={15} />
                    <span>{copied === solution.solution ? t('已复制', 'Copied') : t('复制', 'Copy')}</span>
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
