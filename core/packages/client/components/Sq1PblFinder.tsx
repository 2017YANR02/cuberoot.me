'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import type { AlgSticker } from '@cuberoot/shared';
import { Check, Copy } from 'lucide-react';
import { parseAsString, useQueryState } from 'nuqs';
import AlgPlayer from '@/components/AlgPlayer';
import AppLink from '@/components/AppLink';
import { CaseThumb } from '@/components/CaseThumb';
import { CompactSelect } from '@/components/CompactSelect';
import PillToggle from '@/components/PillToggle/PillToggle';
import SearchInput from '@/components/SearchInput';
import { useCopy } from '@/hooks/useCopy';
import { tr } from '@/i18n/tr';
import { loadSq1PblFinderDefaults } from '@/lib/sq1-pbl-finder-data';
import { persistItem } from '@/lib/safe-storage';
import {
  normalizeSq1PblAuxiliary,
  parseSq1PblAuxiliaryInput,
  validateSq1PblAuxiliary,
  type Sq1PblAuxiliary,
  type Sq1PblFinderDefaults,
  type Sq1PblPll,
  type Sq1PblSearchInput,
  type Sq1PblSearchMode,
  type Sq1PblSearchResult,
  type Sq1PblSolution,
} from '@/lib/sq1-pbl';
import styles from './Sq1PblFinder.module.css';

type WorkerMessage =
  | { id: number; type: 'progress'; completed: number; total: number }
  | { id: number; type: 'result'; result: Sq1PblSearchResult }
  | { id: number; type: 'error'; error: string };

const PBL_STICKER: AlgSticker = { kind: 'raw', tag: 'sq1-pbl', attrs: {} };
const AUXILIARY_STORAGE_KEY = 'sq1:pbl:auxiliary:v1';
const MAX_AUXILIARY_IMPORT_BYTES = 2 * 1024 * 1024;

function parseAuxiliaryPayload(value: unknown): Sq1PblAuxiliary[] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const algorithms = (value as { auxiliaryAlgorithms?: unknown }).auxiliaryAlgorithms;
  if (!Array.isArray(algorithms)) return null;
  const parsed: Sq1PblAuxiliary[] = [];
  for (const item of algorithms) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const { name, sequence } = item as { name?: unknown; sequence?: unknown };
    if (typeof name !== 'string' || typeof sequence !== 'string') return null;
    const normalized = normalizeSq1PblAuxiliary(name, sequence);
    if (!normalized.ok) return null;
    parsed.push(normalized.value);
  }
  return validateSq1PblAuxiliary(parsed).length ? null : parsed;
}

function normalizeSearch(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

function pllKey(pll: Sq1PblPll): string {
  return `${pll.parity ? 'parity' : 'standard'}:${pll.name}`;
}

function auxiliaryProblemText(reason: string): string {
  switch (reason) {
    case 'missing-separator': return tr({ zh: '请输入“名称@公式”。', en: 'Enter “name@algorithm”.' });
    case 'empty-name': return tr({ zh: '辅助公式名称不能为空。', en: 'The auxiliary name cannot be empty.' });
    case 'empty-sequence': return tr({ zh: '辅助公式不能为空。', en: 'The auxiliary algorithm cannot be empty.' });
    case 'invalid-notation': return tr({ zh: '辅助公式含有无效的 SQ1 记号。', en: 'The auxiliary algorithm contains invalid Square-1 notation.' });
    case 'unsliceable': return tr({ zh: '辅助公式中有无法切层的状态。', en: 'The auxiliary algorithm reaches an unsliceable state.' });
    case 'duplicate-name': return tr({ zh: '这个辅助公式名称已经存在。', en: 'That auxiliary name already exists.' });
    case 'duplicate-sequence': return tr({ zh: '这条辅助公式已经存在。', en: 'That auxiliary algorithm already exists.' });
    default: return tr({ zh: '辅助公式无效。', en: 'The auxiliary algorithm is invalid.' });
  }
}

export default function Sq1PblFinder() {
  const [defaults, setDefaults] = useState<Sq1PblFinderDefaults | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [topKey, setTopKey] = useState('');
  const [bottomKey, setBottomKey] = useState('');
  const [auxiliary, setAuxiliary] = useState<Sq1PblAuxiliary[]>([]);
  const [auxiliarySearch, setAuxiliarySearch] = useQueryState(
    'aux',
    parseAsString.withDefault('').withOptions({ history: 'replace', scroll: false }),
  );
  const [selectedAuxiliary, setSelectedAuxiliary] = useState('');
  const [newAuxiliary, setNewAuxiliary] = useState('');
  const [inputError, setInputError] = useState('');
  const [auxiliaryReady, setAuxiliaryReady] = useState(false);
  const [manageStatus, setManageStatus] = useState<'imported' | 'restored' | ''>('');
  const [mode, setMode] = useState<Sq1PblSearchMode>('legacy');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [runError, setRunError] = useState(false);
  const [result, setResult] = useState<Sq1PblSearchResult | null>(null);
  const [selectedSolution, setSelectedSolution] = useState<Sq1PblSolution | null>(null);
  const [searchDurationMs, setSearchDurationMs] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);
  const searchStartedAtRef = useRef(0);
  const { copied: solutionCopied, copy: copySolution } = useCopy();

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(false);
    loadSq1PblFinderDefaults(controller.signal)
      .then(data => {
        let nextAuxiliary = data.auxiliaryAlgorithms;
        try {
          const stored = localStorage.getItem(AUXILIARY_STORAGE_KEY);
          const parsed = stored ? parseAuxiliaryPayload(JSON.parse(stored)) : null;
          if (parsed) nextAuxiliary = parsed;
        } catch {
          // Ignore unavailable or malformed browser storage and retain defaults.
        }
        setDefaults(data);
        setTopKey('');
        setBottomKey('');
        setAuxiliary(nextAuxiliary);
        setSelectedAuxiliary(nextAuxiliary[0]?.name ?? '');
        setAuxiliaryReady(true);
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => () => {
    requestRef.current += 1;
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => {
    if (!auxiliaryReady) return;
    persistItem(AUXILIARY_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      auxiliaryAlgorithms: auxiliary,
    }));
  }, [auxiliary, auxiliaryReady]);

  const allPlls = defaults ? [...defaults.plls.standard, ...defaults.plls.parity] : [];
  const top = allPlls.find(item => pllKey(item) === topKey) ?? null;
  const bottom = allPlls.find(item => pllKey(item) === bottomKey) ?? null;
  const query = normalizeSearch(auxiliarySearch);
  const filteredAuxiliary = query
    ? auxiliary.filter(item => normalizeSearch(`${item.name} ${item.sequence}`).includes(query))
    : auxiliary;
  const auxiliaryExportHref = useMemo(() => (
    `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({
      schemaVersion: 1,
      auxiliaryAlgorithms: auxiliary,
    }, null, 2))}`
  ), [auxiliary]);

  const clearResult = () => {
    requestRef.current += 1;
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
    setProgress({ completed: 0, total: 0 });
    setResult(null);
    setSelectedSolution(null);
    setSearchDurationMs(0);
    setRunError(false);
    setCancelled(false);
  };

  const cancelFinder = () => {
    requestRef.current += 1;
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
    setProgress({ completed: 0, total: 0 });
    setCancelled(true);
  };

  const updateTop = (value: string) => {
    setTopKey(value);
    clearResult();
  };

  const updateBottom = (value: string) => {
    setBottomKey(value);
    clearResult();
  };

  const addAuxiliary = () => {
    setInputError('');
    const parsed = parseSq1PblAuxiliaryInput(newAuxiliary);
    if (!parsed.ok) {
      setInputError(auxiliaryProblemText(parsed.reason));
      return;
    }
    const next = [...auxiliary, parsed.value];
    const problem = validateSq1PblAuxiliary(next).find(item => item.index === next.length - 1);
    if (problem) {
      setInputError(auxiliaryProblemText(problem.reason));
      return;
    }
    setAuxiliary(next);
    setSelectedAuxiliary(parsed.value.name);
    setNewAuxiliary('');
    setManageStatus('');
    clearResult();
  };

  const removeAuxiliary = () => {
    if (!selectedAuxiliary) return;
    const next = auxiliary.filter(item => item.name !== selectedAuxiliary);
    setAuxiliary(next);
    setSelectedAuxiliary(next[0]?.name ?? '');
    setManageStatus('');
    clearResult();
  };

  const restoreAuxiliary = () => {
    const next = [...defaults!.auxiliaryAlgorithms];
    setAuxiliary(next);
    setSelectedAuxiliary(next[0]?.name ?? '');
    setInputError('');
    clearResult();
    setManageStatus('restored');
  };

  const importAuxiliary = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_AUXILIARY_IMPORT_BYTES) throw new Error('too-large');
      const parsed = parseAuxiliaryPayload(JSON.parse(await file.text()));
      if (!parsed) throw new Error('invalid');
      setAuxiliary(parsed);
      setSelectedAuxiliary(parsed[0]?.name ?? '');
      setInputError('');
      clearResult();
      setManageStatus('imported');
    } catch {
      setManageStatus('');
      setInputError(tr({
        zh: 'JSON 无效或超过 2 MB：需要 auxiliaryAlgorithms 数组，且每项包含有效的 name 与 sequence。',
        en: 'The JSON is invalid or exceeds 2 MB: auxiliaryAlgorithms must contain valid name and sequence entries.',
      }));
    }
  };

  const runFinder = () => {
    if (!top || !bottom || auxiliary.length === 0) return;
    clearResult();
    const problems = validateSq1PblAuxiliary(auxiliary);
    if (problems.length) {
      setInputError(auxiliaryProblemText(problems[0].reason));
      return;
    }
    setInputError('');
    setRunning(true);
    searchStartedAtRef.current = performance.now();
    const id = requestRef.current + 1;
    requestRef.current = id;
    let worker: Worker;
    try {
      worker = new Worker(new URL('../lib/sq1-pbl.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      if (requestRef.current === id) {
        setRunning(false);
        setRunError(true);
      }
      return;
    }
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.id !== id || requestRef.current !== id) return;
      if (message.type === 'progress') {
        setProgress({ completed: message.completed, total: message.total });
        return;
      }
      setRunning(false);
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      if (message.type === 'result') {
        setResult(message.result);
        setSelectedSolution(message.result.solutions[0] ?? null);
        setSearchDurationMs(Math.max(1, Math.round(performance.now() - searchStartedAtRef.current)));
      } else {
        setRunError(true);
      }
    };
    worker.onerror = () => {
      if (requestRef.current !== id) return;
      setRunning(false);
      setRunError(true);
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
    const input: Sq1PblSearchInput = { top, bottom, auxiliary, mode };
    try {
      worker.postMessage({ id, input });
    } catch {
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      if (requestRef.current === id) {
        setRunning(false);
        setRunError(true);
      }
    }
  };

  if (loadError) {
    return <p className={styles.error} role="alert">{tr({ zh: 'PBL Finder 默认数据加载失败，请稍后重试。', en: 'The PBL Finder defaults could not be loaded. Please try again later.' })}</p>;
  }
  if (!defaults) {
    return <p className={styles.status} role="status">{tr({ zh: '正在加载 PBL Finder…', en: 'Loading the PBL Finder…' })}</p>;
  }

  const pllItems = allPlls.map(item => ({
    value: pllKey(item),
    label: item.parity
      ? tr({ zh: `${item.name}（奇偶）`, en: `${item.name} (parity)` })
      : item.name,
  }));
  const searchDuration = searchDurationMs < 1000
    ? `${searchDurationMs} ms`
    : `${(searchDurationMs / 1000).toFixed(1)} s`;

  return (
    <section className={styles.finderSection} aria-label={tr({ zh: 'PBL 公式查找器', en: 'PBL algorithm finder' })}>
      <div className={styles.searchControls}>
        <div className={styles.pickerField}>
          <span>{tr({ zh: '上层 PLL', en: 'Top PLL' })}</span>
          <CompactSelect
            variant="plain"
            value={topKey}
            label={top?.name ?? tr({ zh: '请选择', en: 'Choose' })}
            items={pllItems}
            onChange={updateTop}
            ariaLabel={tr({ zh: '选择上层 PLL', en: 'Choose the top PLL' })}
          />
        </div>
        <div className={styles.pickerField}>
          <span>{tr({ zh: '下层 PLL', en: 'Bottom PLL' })}</span>
          <CompactSelect
            variant="plain"
            value={bottomKey}
            label={bottom?.name ?? tr({ zh: '请选择', en: 'Choose' })}
            items={pllItems}
            onChange={updateBottom}
            ariaLabel={tr({ zh: '选择下层 PLL', en: 'Choose the bottom PLL' })}
          />
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={runFinder}
          disabled={running || !top || !bottom || auxiliary.length === 0}
        >
          {running ? tr({ zh: '正在查找…', en: 'Finding…' }) : tr({ zh: '查找公式', en: 'Find algorithms' })}
        </button>
        {running && <button type="button" className={styles.button} onClick={cancelFinder}>{tr({ zh: '取消', en: 'Cancel' })}</button>}
      </div>

      {running && (
        <label className={styles.progressLabel}>
          <span>{tr({ zh: '搜索进度', en: 'Search progress' })}</span>
          <progress value={progress.completed} max={progress.total || 1} />
          <span>{progress.total ? `${Math.floor(progress.completed / progress.total * 100)}%` : '0%'}</span>
        </label>
      )}

      {!top || !bottom ? (
        <p className={styles.selectorHint}>{tr({ zh: '选择上层和下层 PLL 后即可查找。', en: 'Choose the top and bottom PLL to search.' })}</p>
      ) : null}

      <details className={styles.advancedSettings}>
        <summary>
          <span>{tr({ zh: '高级设置', en: 'Advanced settings' })}</span>
          <span>{mode === 'legacy'
            ? tr({ zh: '旧版兼容', en: 'Legacy' })
            : tr({ zh: '严格', en: 'Strict' })}</span>
        </summary>
        <div className={styles.advancedContent}>
          <label className={styles.modeControl}>
            <span>{tr({ zh: '搜索口径', en: 'Search mode' })}</span>
            <PillToggle
              value={mode === 'legacy'}
              offLabel={tr({ zh: '严格', en: 'Strict' })}
              onLabel={tr({ zh: '旧版兼容', en: 'Legacy' })}
              ariaLabel={tr({ zh: '切换严格或旧版兼容搜索', en: 'Toggle strict or legacy-compatible search' })}
              onChange={legacy => {
                setMode(legacy ? 'legacy' : 'strict');
                clearResult();
              }}
            />
          </label>
          <p className={styles.sourceLine}>
            {tr({ zh: '旧版兼容模式复现原工具行为；严格模式额外检查中层状态。', en: 'Legacy mode reproduces the original tool; strict mode also checks the middle layer.' })}
            {' '}<AppLink href="/about" prefetch={false}>{tr({ zh: '来源与致谢', en: 'Sources and credits' })}</AppLink>
          </p>
          <div className={styles.auxiliarySection}>
            <div className={styles.auxiliaryHeading}>
              <h3>{tr({ zh: '辅助公式', en: 'Auxiliary algorithms' })}</h3>
              <span>{tr({ zh: `${auxiliary.length} 条`, en: `${auxiliary.length} algorithms` })}</span>
            </div>
            <label className={styles.searchField}>
              <span>{tr({ zh: '筛选辅助公式', en: 'Filter auxiliary algorithms' })}</span>
              <SearchInput
                type="search"
                value={auxiliarySearch}
                onChange={value => void setAuxiliarySearch(value)}
                className={styles.inputWithClear}
                placeholder={tr({ zh: '名称或记号', en: 'Name or notation' })}
                ariaLabel={tr({ zh: '筛选辅助公式', en: 'Filter auxiliary algorithms' })}
              />
            </label>
            <label className={styles.auxiliaryListLabel}>
              <span className={styles.srOnly}>{tr({ zh: '辅助公式列表', en: 'Auxiliary algorithm list' })}</span>
              <select
                className={styles.auxiliaryList}
                size={8}
                value={selectedAuxiliary}
                onChange={event => setSelectedAuxiliary(event.target.value)}
              >
                {filteredAuxiliary.map(item => (
                  <option value={item.name} key={item.name}>{item.name}: {item.sequence}</option>
                ))}
              </select>
            </label>
            <div className={styles.auxiliaryEdit}>
              <label>
                <span>{tr({ zh: '新增辅助公式', en: 'New auxiliary algorithm' })}</span>
                <input
                  className={styles.auxiliaryInput}
                  value={newAuxiliary}
                  onChange={event => setNewAuxiliary(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addAuxiliary();
                    }
                  }}
                  placeholder={tr({ zh: '名称@公式', en: 'name@algorithm' })}
                />
              </label>
              <div className={styles.editButtons}>
                <button type="button" className={styles.button} onClick={addAuxiliary} disabled={!newAuxiliary.trim()}>{tr({ zh: '添加', en: 'Add' })}</button>
                <button type="button" className={styles.button} onClick={removeAuxiliary} disabled={!selectedAuxiliary}>{tr({ zh: '移除所选', en: 'Remove selected' })}</button>
              </div>
            </div>
            <div className={styles.finderDataActions}>
              <button type="button" className={styles.button} onClick={restoreAuxiliary}>{tr({ zh: '还原默认', en: 'Restore defaults' })}</button>
              <label className={`${styles.button} ${styles.fileButton}`}>
                {tr({ zh: '导入 JSON', en: 'Import JSON' })}
                <input type="file" accept="application/json,.json" onChange={importAuxiliary} />
              </label>
              <a
                className={styles.button}
                href={auxiliaryExportHref}
                download="sq1-pbl-auxiliary.json"
              >
                {tr({ zh: '导出 JSON', en: 'Export JSON' })}
              </a>
            </div>
            {manageStatus && (
              <p className={styles.manageStatus} role="status">
                {manageStatus === 'imported'
                  ? tr({ zh: '辅助公式已导入并保存在此浏览器。', en: 'Auxiliary algorithms imported and saved in this browser.' })
                  : tr({ zh: '已还原默认辅助公式。', en: 'Default auxiliary algorithms restored.' })}
              </p>
            )}
            {inputError && <p className={styles.error} role="alert">{inputError}</p>}
          </div>
        </div>
      </details>

      {cancelled && <p className={styles.status} role="status">{tr({ zh: '搜索已取消。', en: 'Search cancelled.' })}</p>}

      {runError && <p className={styles.error} role="alert">{tr({ zh: '查找失败，请检查辅助公式后重试。', en: 'The search failed. Check the auxiliary algorithms and try again.' })}</p>}
      {result && (
        <section className={styles.outputSection} aria-labelledby="sq1-pbl-output-heading">
          <div className={styles.outputHeading}>
            <h3 id="sq1-pbl-output-heading">{result.target}</h3>
            <span>{tr({
              zh: `${result.solutions.length} 条结果，耗时 ${searchDuration}`,
              en: `${result.solutions.length} results in ${searchDuration}`,
            })}</span>
          </div>
          {result.solutions.length === 0 ? (
            <p className={styles.status}>{tr({ zh: '当前辅助公式表中没有找到解。', en: 'No solution was found with the current auxiliary list.' })}</p>
          ) : (
            null
          )}
          {selectedSolution && (
            <div className={styles.selectedPreview}>
              <div className={styles.caseThumb}>
                <CaseThumb
                  puzzle="sq1"
                  set="pbl"
                  sticker={PBL_STICKER}
                  alg={selectedSolution.algorithm}
                  setup={result.setup}
                  size={150}
                  alt={tr({ zh: `${result.target} PBL 情况`, en: `${result.target} PBL case` })}
                />
              </div>
              <div className={styles.playerPane}>
                <AlgPlayer
                  puzzle="sq1"
                  set="pbl"
                  alg={selectedSolution.algorithm}
                  setup={result.setup}
                  size={270}
                />
              </div>
              <div className={styles.selectedDetails}>
                <h4>{tr({ zh: '当前公式', en: 'Current algorithm' })}</h4>
                <div className={styles.selectedAlgorithmRow}>
                  <code>{selectedSolution.algorithm}</code>
                  <button
                    type="button"
                    className={styles.copyButton}
                    onClick={() => copySolution(selectedSolution.algorithm)}
                    title={solutionCopied
                      ? tr({ zh: '已复制', en: 'Copied' })
                      : tr({ zh: '复制公式', en: 'Copy algorithm' })}
                    aria-label={solutionCopied
                      ? tr({ zh: '公式已复制', en: 'Algorithm copied' })
                      : tr({ zh: '复制所选公式', en: 'Copy selected algorithm' })}
                  >
                    {solutionCopied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                  </button>
                  <span className={styles.srOnly} aria-live="polite">
                    {solutionCopied ? tr({ zh: '公式已复制', en: 'Algorithm copied' }) : ''}
                  </span>
                </div>
                <p>{selectedSolution.stm} STM / {selectedSolution.ftm} FTM</p>
                <p>{tr({ zh: `辅助公式：${selectedSolution.auxiliary.join(' + ')}`, en: `Auxiliary algorithms: ${selectedSolution.auxiliary.join(' + ')}` })}</p>
              </div>
            </div>
          )}
          {result.solutions.length > 0 && (
            <div className={styles.resultGroup}>
              <h4>{tr({ zh: '全部结果', en: 'All results' })}</h4>
              <div className={styles.resultList}>
                {result.solutions.map((solution, index) => (
                  <button
                    type="button"
                    className={`${styles.resultRow}${selectedSolution === solution ? ` ${styles.resultRowActive}` : ''}`}
                    onClick={() => setSelectedSolution(solution)}
                    aria-pressed={selectedSolution === solution}
                    key={`${solution.algorithm}-${solution.auxiliary.join('-')}-${index}`}
                  >
                    <span className={styles.resultOrdinal}>{index + 1}</span>
                    <code>{solution.algorithm}</code>
                    <span>{solution.stm} STM / {solution.ftm} FTM</span>
                    <span>{solution.auxiliary.join(' + ')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
