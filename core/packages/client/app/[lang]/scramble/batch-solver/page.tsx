'use client';

/**
 * /scramble/batch-solver — trangium Batch Solver 移植(引擎见 lib/batch-solver.ts,
 * 与上游 worker.js golden 对拍锁定;在 Web Worker 里跑,主线程 250ms 合并一次结果,
 * 与上游节奏一致)。UI 重设计:示例预设一键填表、内联错误横幅取代 alert、
 * CSV 导出取代 ExcelJS、图像走站内 VisualCube / sr-puzzlegen。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Minus, Plus } from 'lucide-react';
import BoolToggle from '@/components/BoolToggle';
import { ListSelect } from '@/components/ListSelect';
import NumberCommitInput from '@/components/NumberCommitInput';
import { MCC_SLIDERS, ParamSliders } from '@/components/ParamSliders';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/hooks/useT';
import { tr } from '@/i18n/tr';
import { algSpeed, MCC_DEFAULTS, type MccParams } from '@/lib/mcc';
import {
  BATCH_PUZZLE_NAMES,
  BATCH_PUZZLE_PRESETS,
  BATCH_RANK_ESQ_DEFAULT,
  BATCH_UOE_PRESETS,
  compareBufferElements,
  getMoveCount,
  moveEsq,
  moveSqtm,
  moveStm,
  parseESQ,
  removeParens,
  type BatchSolverInput,
  type BatchSolverMessage,
} from '@/lib/batch-solver';
import { createBatchSolverWorker } from '@/lib/batch-solver-client';
import CaseImage, { BATCH_IMAGE_KINDS, IMAGE_KIND_FOR_PUZZLE, type BatchImageKind } from './_CaseImage';
import UsageGuide from './_UsageGuide';
import './batch-solver.css';

type SortMetric = 'MCC' | 'STM' | 'SQTM' | 'ESQ';
const SORT_METRICS: SortMetric[] = ['MCC', 'STM', 'SQTM', 'ESQ'];

interface SubgroupRow {
  prune: string;
  search: string;
  subgroup: string;
}

interface SortingRow {
  type: string;
  pieces: string;
}

interface Sol {
  speed: number;
  text: string;
}

interface CaseResult {
  id: number;
  caseNum: number;
  setup: string;
  solutions: Sol[];
  done: boolean;
}

interface StatsView {
  done: number;
  failed: number[];
  rate: number;
  avgMcc: number;
  avgStm: number;
  avgSqtm: number;
  avgEsq: number;
}

const SORTING_TYPES = [
  { value: 'priority', zh: '设定优先级', en: 'Set priority' },
  { value: 'ori-of', zh: '朝向(按块)', en: 'Orientation of' },
  { value: 'ori-at', zh: '朝向(按位置)', en: 'Orientation at' },
  { value: 'perm-of', zh: '排列(按块)', en: 'Permutation of' },
  { value: 'perm-at', zh: '排列(按位置)', en: 'Permutation at' },
];

interface ExamplePreset {
  zh: string;
  en: string;
  puzzle: string;
  uoe: string;
  scramble: string;
  subgroups: SubgroupRow[];
  pre: string;
  post: string;
  sorting: SortingRow[];
  imgKind: BatchImageKind;
}

const EXAMPLES: ExamplePreset[] = [
  {
    zh: 'Sune 与反 Sune',
    en: 'Sune & Antisune',
    puzzle: '3x3x3',
    uoe: '',
    scramble: "[R U R' U R U2 R', R U2 R' U' R U' R']",
    subgroups: [{ prune: '5', search: '+', subgroup: 'R U' }],
    pre: 'U',
    post: 'U',
    sorting: [],
    imgKind: '3x3x3-top',
  },
  {
    zh: 'OCLL(生成元展开)',
    en: 'OCLL (from generators)',
    puzzle: '3x3x3',
    uoe: '{UF UR UB UL} {UFR UBR UBL UFL}\n1: UF UR UB UL',
    scramble: "<R U R' U R U2 R', U>",
    subgroups: [
      { prune: '6', search: '+', subgroup: 'R U' },
      { prune: '5', search: '=', subgroup: 'F R U' },
    ],
    pre: 'U',
    post: 'U',
    sorting: [{ type: 'ori-at', pieces: 'UFR UFL UBL UBR' }],
    imgKind: '3x3x3-top',
  },
  {
    zh: 'Pyraminx 顶棱(忽略小尖)',
    en: 'Pyraminx (tips ignored)',
    puzzle: 'Pyraminx',
    uoe: '1: TUU TRR TLL TBB',
    scramble: "[U R U' R', R U' R' U, L R L' R']",
    subgroups: [{ prune: '4', search: '4', subgroup: 'U R L B' }],
    pre: '',
    post: '',
    sorting: [],
    imgKind: 'pyraminx',
  },
];

/** 上游 mergeBuffer 的语义:两个有序列表归并,按去括号文本连续去重,截断到上限 */
function mergeSolutions(existing: Sol[], incoming: Sol[], max: number): Sol[] {
  const sorted = [...incoming].sort((a, b) => compareBufferElements([a.speed, a.text], [b.speed, b.text]));
  const out: Sol[] = [];
  let prev = '';
  let i = 0;
  let j = 0;
  while (out.length < max && (i < existing.length || j < sorted.length)) {
    let pick: Sol;
    if (i >= existing.length) pick = sorted[j++];
    else if (j >= sorted.length) pick = existing[i++];
    else if (compareBufferElements([sorted[j].speed, sorted[j].text], [existing[i].speed, existing[i].text]) === -1) pick = sorted[j++];
    else pick = existing[i++];
    const key = removeParens(pick.text);
    if (key !== prev) {
      out.push(pick);
      prev = key;
    }
  }
  return out;
}

const fmtMetric = (n: number) => (Number.isFinite(n) ? String(Math.round(n * 1000) / 1000) : '–');

export default function BatchSolverPage() {
  const t = useT();
  useDocumentTitle('批量求解器', 'Batch Solver');

  // ---- 表单 ----
  const [puzzle, setPuzzle] = useState('3x3x3');
  const [puzzleDef, setPuzzleDef] = useState(BATCH_PUZZLE_PRESETS['3x3x3']);
  const [showDef, setShowDef] = useState(false);
  const [uoe, setUoe] = useState('');
  const [scramble, setScramble] = useState('');
  const [preAdjust, setPreAdjust] = useState('U');
  const [postAdjust, setPostAdjust] = useState('U');
  const [subgroups, setSubgroups] = useState<SubgroupRow[]>([{ prune: '', search: '', subgroup: '' }]);
  const [sorting, setSorting] = useState<SortingRow[]>([{ type: 'priority', pieces: '' }]);
  const [sortBy, setSortBy] = useState<SortMetric>('MCC');
  const [secondary, setSecondary] = useState<'None' | SortMetric>('None');
  const [maxSolutions, setMaxSolutions] = useState(20);
  const [showPost, setShowPost] = useState(false);
  const [firstOnly, setFirstOnly] = useState(false);
  const [imgKind, setImgKind] = useState<BatchImageKind>('3x3x3-top');
  const [imgSize, setImgSize] = useState(96);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mccParams, setMccParams] = useState<MccParams>(MCC_DEFAULTS);
  const [showEsqOpts, setShowEsqOpts] = useState(false);
  const [rankEsq, setRankEsq] = useState(BATCH_RANK_ESQ_DEFAULT);
  const [genEsqMode, setGenEsqMode] = useState<'default' | 'match' | 'custom'>('default');
  const [genEsq, setGenEsq] = useState('');

  // ---- 运行态 ----
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState<CaseResult[]>([]);
  const [total, setTotal] = useState<number | string>(0);
  const [depth, setDepth] = useState(0);
  const [stats, setStats] = useState<StatsView | null>(null);
  const [copiedFails, setCopiedFails] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const casesRef = useRef<CaseResult[]>([]);
  const bufRef = useRef<Sol[]>([]);
  const maxSolutionsRef = useRef(maxSolutions);
  maxSolutionsRef.current = maxSolutions;

  useEffect(() => () => {
    workerRef.current?.terminate();
    if (flushTimerRef.current !== null) clearInterval(flushTimerRef.current);
  }, []);

  const selectPuzzle = (name: string) => {
    setPuzzle(name);
    setPuzzleDef(BATCH_PUZZLE_PRESETS[name] ?? '');
    setUoe(BATCH_UOE_PRESETS[name] ?? '');
    setImgKind(IMAGE_KIND_FOR_PUZZLE[name] ?? 'none');
    if (name === 'Custom') setShowDef(true);
  };

  const loadExample = (ex: ExamplePreset) => {
    setPuzzle(ex.puzzle);
    setPuzzleDef(BATCH_PUZZLE_PRESETS[ex.puzzle] ?? '');
    setUoe(ex.uoe);
    setScramble(ex.scramble);
    setPreAdjust(ex.pre);
    setPostAdjust(ex.post);
    setSubgroups(ex.subgroups.map((r) => ({ ...r })));
    setSorting(ex.sorting.length ? ex.sorting.map((r) => ({ ...r })) : [{ type: 'priority', pieces: '' }]);
    setImgKind(ex.imgKind);
    setError(null);
  };

  const renderCases = () => setCases(casesRef.current.slice());

  const flushBuffer = () => {
    if (bufRef.current.length === 0) return;
    const current = casesRef.current[casesRef.current.length - 1];
    if (!current) {
      bufRef.current = [];
      return;
    }
    current.solutions = mergeSolutions(current.solutions, bufRef.current, maxSolutionsRef.current);
    bufRef.current = [];
    renderCases();
  };

  const stopSearch = () => {
    flushBuffer();
    if (flushTimerRef.current !== null) clearInterval(flushTimerRef.current);
    flushTimerRef.current = null;
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
    setDepth(0);
  };

  const startSearch = () => {
    if (running) {
      stopSearch();
      return;
    }
    setError(null);
    setStats(null);
    setTotal(0);
    setDepth(0);
    setCopiedFails(false);
    casesRef.current = [];
    bufRef.current = [];
    renderCases();
    setRunning(true);

    // 捕获本次运行的指标配置(上游是搜索中实时读滑杆;这里以开搜时为准)
    const params = { ...mccParams };
    const rankWeights = parseESQ(rankEsq);
    const mccOf = (alg: string) => parseFloat(String(algSpeed(removeParens(alg), false, false, params)));
    const countOf = (alg: string, m: SortMetric) => {
      if (m === 'MCC') return mccOf(alg);
      if (m === 'STM') return getMoveCount(alg, moveStm);
      if (m === 'SQTM') return getMoveCount(alg, moveSqtm);
      return getMoveCount(alg, (mv) => moveEsq(mv, rankWeights));
    };
    const primary = sortBy;
    const secondaryMetric = secondary;
    const startTime = Date.now();
    const bk = { done: 0, failed: [] as number[], mcc: 0, stm: 0, sqtm: 0, esq: 0 };

    const finalizeCase = () => {
      flushBuffer();
      const c = casesRef.current[casesRef.current.length - 1];
      if (!c || c.done) return;
      c.done = true;
      const top = c.solutions[0]?.text ?? '';
      if (top === '') bk.failed.push(c.caseNum);
      bk.done++;
      bk.mcc += mccOf(top);
      bk.stm += getMoveCount(top, moveStm);
      bk.sqtm += getMoveCount(top, moveSqtm);
      bk.esq += getMoveCount(top, (mv) => moveEsq(mv, rankWeights));
      const ok = bk.done - bk.failed.length;
      setStats({
        done: bk.done,
        failed: bk.failed.slice(),
        rate: (Date.now() - startTime) / bk.done / 1000,
        avgMcc: bk.mcc / ok,
        avgStm: bk.stm / ok,
        avgSqtm: bk.sqtm / ok,
        avgEsq: bk.esq / ok,
      });
      renderCases();
    };

    const worker = createBatchSolverWorker();
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<BatchSolverMessage>) => {
      const msg = e.data;
      if (msg.type === 'stop') {
        if (msg.value === null) finalizeCase();
        else setError(msg.value);
        stopSearch();
      } else if (msg.type === 'solution') {
        let text = msg.value;
        if (secondaryMetric !== 'None') {
          text += ` [${fmtMetric(countOf(text, secondaryMetric))} ${secondaryMetric}]`;
        }
        bufRef.current.push({ speed: countOf(msg.value, primary), text });
      } else if (msg.type === 'next-state') {
        if (msg.value.index > 1) finalizeCase();
        casesRef.current.push({ id: msg.value.index, caseNum: msg.value.num, setup: msg.value.setup, solutions: [], done: false });
        renderCases();
      } else if (msg.type === 'num-states') {
        setTotal(msg.value);
      } else if (msg.type === 'depthUpdate') {
        setDepth((d) => d + 1);
      } else if (msg.type === 'set-depth') {
        setDepth(msg.value);
      }
    };

    const input: BatchSolverInput = {
      puzzle: puzzleDef,
      ignore: uoe,
      solve: scramble,
      preAdjust,
      postAdjust,
      subgroups: subgroups.map((r) => ({ subgroup: r.subgroup, prune: r.prune, search: r.search })),
      sorting: sorting.map((r) => ({ type: r.type, pieces: r.pieces })),
      esq: genEsqMode === 'match' ? rankEsq : genEsqMode === 'default' ? '' : genEsq,
      rankesq: rankEsq,
      showPost,
      optimise: firstOnly,
    };
    worker.postMessage(input);
    flushTimerRef.current = setInterval(flushBuffer, 250);
  };

  const exportCsv = () => {
    const list = casesRef.current;
    if (list.length === 0) return;
    const height = Math.max(...list.map((c) => c.solutions.length));
    const rows: string[][] = [];
    rows.push(list.flatMap((c) => [`#${c.caseNum}`, c.setup]));
    rows.push(list.flatMap(() => [sortBy, 'Solutions']));
    for (let i = 0; i < height; i++) {
      rows.push(list.flatMap((c) => (c.solutions[i] ? [fmtMetric(c.solutions[i].speed), c.solutions[i].text] : ['', ''])));
    }
    const csv = rows.map((r) => r.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'batch-solver-algs.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copyFails = () => {
    if (!stats || stats.failed.length === 0) return;
    void navigator.clipboard.writeText('#' + stats.failed.join(', '));
    setCopiedFails(true);
  };

  const metricItems = useMemo(() => SORT_METRICS.map((m) => ({ value: m, label: m })), []);
  const secondaryItems = useMemo(
    () => [{ value: 'None', label: tr({ zh: '无', en: 'None' }) }, ...SORT_METRICS.map((m) => ({ value: m, label: m }))],
    [],
  );
  const puzzleItems = useMemo(
    () => BATCH_PUZZLE_NAMES.map((p) => ({ value: p, label: p === 'Custom' ? tr({ zh: '自定义', en: 'Custom' }) : p })),
    [],
  );
  const imgItems = useMemo(
    () => BATCH_IMAGE_KINDS.map((k) => ({ value: k, label: k === 'none' ? tr({ zh: '无图像', en: 'No image' }) : k === 'pyraminx' ? 'Pyraminx' : k.replace('-top', tr({ zh: ' 顶视', en: ' top' })) })),
    [],
  );
  const genEsqItems = useMemo(
    () => [
      { value: 'default', label: tr({ zh: '默认(按 STM)', en: 'Default (by STM)' }) },
      { value: 'match', label: tr({ zh: '与 Rank ESQ 相同', en: 'Match Rank ESQ' }) },
      { value: 'custom', label: tr({ zh: '自定义', en: 'Custom' }) },
    ],
    [],
  );
  const sortingTypeItems = useMemo(() => SORTING_TYPES.map((s) => ({ value: s.value, label: tr(s) })), []);

  const lastCase = cases[cases.length - 1];
  const preparing = running && cases.length === 0;

  return (
    <div className="bsv-page">
      <header className="bsv-header">
        <h1>{t('批量求解器', 'Batch Solver')}</h1>
        <p className="bsv-lead">
          {t(
            '一次生成整套公式集:描述好目标状态与所有 case,自动为每个 case 枚举全部解并按手速(MCC)等指标排序。',
            'Generate whole algsets at once: describe the goal and the cases, and every case gets all its solutions enumerated and ranked by MCC and friends.',
          )}
        </p>
      </header>

      <div className="bsv-examples">
        <span className="bsv-examples-label">{t('示例', 'Examples')}</span>
        {EXAMPLES.map((ex) => (
          <button key={ex.en} type="button" className="bsv-chip" onClick={() => loadExample(ex)}>
            {tr(ex)}
          </button>
        ))}
      </div>

      <div className="bsv-form">
        <div className="bsv-field-row">
          <label className="bsv-label">{t('谜题', 'Puzzle')}</label>
          <ListSelect items={puzzleItems} value={puzzle} onChange={selectPuzzle} allLabel="3x3x3" clearable={false} />
          <button
            type="button"
            className={`bsv-collapse-toggle${showDef ? ' is-open' : ''}`}
            onClick={() => setShowDef((v) => !v)}
            aria-expanded={showDef}
          >
            {t('置换定义', 'Definition')}
            <ChevronDown size={14} className="bsv-collapse-chevron" aria-hidden="true" />
          </button>
        </div>
        {showDef && (
          <textarea
            className="bsv-textarea bsv-def"
            value={puzzleDef}
            onChange={(e) => setPuzzleDef(e.target.value)}
            rows={Math.min(18, puzzleDef.split('\n').length + 1)}
            readOnly={puzzle !== 'Custom'}
            spellCheck={false}
          />
        )}

        <div className="bsv-field">
          <label className="bsv-label" htmlFor="bsv-uoe">{t('唯一朝向与等价(什么算解好)', 'Unique orientations & equivalences (what counts as solved)')}</label>
          <textarea
            id="bsv-uoe"
            className="bsv-textarea"
            value={uoe}
            onChange={(e) => setUoe(e.target.value)}
            rows={2}
            spellCheck={false}
            placeholder={t('留空 = 完全还原;{A B} = 这些块不分彼此;1: A B = 不看朝向', 'Empty = fully solved; {A B} = interchangeable; 1: A B = ignore orientation')}
          />
        </div>

        <div className="bsv-field">
          <label className="bsv-label" htmlFor="bsv-scramble">{t('打乱(要解哪些状态)', 'Scramble (which states to solve)')}</label>
          <textarea
            id="bsv-scramble"
            className="bsv-textarea"
            value={scramble}
            onChange={(e) => setScramble(e.target.value)}
            rows={3}
            spellCheck={false}
            placeholder={t("步 = 执行;[A, B] = 两个分支;<A, B, U> = 生成元展开;末尾 #3-8 只跑部分 case", 'moves = apply; [A, B] = branches; <A, B, U> = generators; trailing #3-8 limits cases')}
          />
        </div>

        <div className="bsv-field-row">
          <label className="bsv-label" htmlFor="bsv-pre">{t('整层预转', 'Pre-adjust')}</label>
          <input id="bsv-pre" className="bsv-input bsv-input-short" value={preAdjust} onChange={(e) => setPreAdjust(e.target.value)} spellCheck={false} />
          <label className="bsv-label" htmlFor="bsv-post">{t('整层后转', 'Post-adjust')}</label>
          <input id="bsv-post" className="bsv-input bsv-input-short" value={postAdjust} onChange={(e) => setPostAdjust(e.target.value)} spellCheck={false} />
        </div>

        <div className="bsv-field">
          <span className="bsv-label">{t('步组(每行一轮搜索:允许的步 + 建表/搜索深度)', 'Subgroups (one search per row: allowed moves + prune/search depth)')}</span>
          {subgroups.map((row, i) => (
            <div key={i} className="bsv-subgroup-row">
              <input
                className="bsv-input bsv-input-num"
                value={row.prune}
                onChange={(e) => setSubgroups((rs) => rs.map((r, j) => (j === i ? { ...r, prune: e.target.value } : r)))}
                placeholder={t('建表', 'prune')}
                spellCheck={false}
              />
              <input
                className="bsv-input bsv-input-num"
                value={row.search}
                onChange={(e) => setSubgroups((rs) => rs.map((r, j) => (j === i ? { ...r, search: e.target.value } : r)))}
                placeholder={t('搜索', 'search')}
                spellCheck={false}
              />
              <input
                className="bsv-input bsv-input-grow"
                value={row.subgroup}
                onChange={(e) => setSubgroups((rs) => rs.map((r, j) => (j === i ? { ...r, subgroup: e.target.value } : r)))}
                placeholder={t('步组,如 R U F(空 = 全部步)', 'moves, e.g. R U F (empty = all)')}
                spellCheck={false}
              />
              {subgroups.length > 1 && (
                <button type="button" className="bsv-icon-btn" aria-label={t('删除此步组', 'Remove subgroup')} onClick={() => setSubgroups((rs) => rs.filter((_, j) => j !== i))}>
                  <Minus size={14} />
                </button>
              )}
              {i === subgroups.length - 1 && (
                <button type="button" className="bsv-icon-btn" aria-label={t('添加步组', 'Add subgroup')} onClick={() => setSubgroups((rs) => [...rs, { prune: '', search: '', subgroup: '' }])}>
                  <Plus size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="bsv-field">
          <span className="bsv-label">{t('case 排序(可选,多条依次当 tiebreaker)', 'Case sorting (optional; extra rows break ties)')}</span>
          {sorting.map((row, i) => (
            <div key={i} className="bsv-subgroup-row">
              <ListSelect
                items={sortingTypeItems}
                value={row.type}
                onChange={(v) => setSorting((rs) => rs.map((r, j) => (j === i ? { ...r, type: v } : r)))}
                allLabel=""
                clearable={false}
              />
              <input
                className="bsv-input bsv-input-grow"
                value={row.pieces}
                onChange={(e) => setSorting((rs) => rs.map((r, j) => (j === i ? { ...r, pieces: e.target.value } : r)))}
                placeholder={t('位置/块,如 UFR UFL UBL UBR', 'pieces, e.g. UFR UFL UBL UBR')}
                spellCheck={false}
              />
              {sorting.length > 1 && (
                <>
                  <button type="button" className="bsv-icon-btn" aria-label={t('上移', 'Move up')} disabled={i === 0} onClick={() => setSorting((rs) => { const n = rs.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" className="bsv-icon-btn" aria-label={t('下移', 'Move down')} disabled={i === sorting.length - 1} onClick={() => setSorting((rs) => { const n = rs.slice(); [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })}>
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" className="bsv-icon-btn" aria-label={t('删除此排序', 'Remove sorting row')} onClick={() => setSorting((rs) => rs.filter((_, j) => j !== i))}>
                    <Minus size={14} />
                  </button>
                </>
              )}
              {i === sorting.length - 1 && (
                <button type="button" className="bsv-icon-btn" aria-label={t('添加排序', 'Add sorting row')} onClick={() => setSorting((rs) => [...rs, { type: 'priority', pieces: '' }])}>
                  <Plus size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="bsv-field-row bsv-options">
          <label className="bsv-label">{t('解按', 'Sort algs by')}</label>
          <ListSelect items={metricItems} value={sortBy} onChange={(v) => setSortBy(v as SortMetric)} allLabel="MCC" clearable={false} />
          <label className="bsv-label">{t('次指标', 'Secondary')}</label>
          <ListSelect items={secondaryItems} value={secondary} onChange={(v) => setSecondary(v as 'None' | SortMetric)} allLabel={tr({ zh: '无', en: 'None' })} clearable={false} />
          <label className="bsv-label" htmlFor="bsv-max">{t('每题保留', 'Top')}</label>
          <NumberCommitInput id="bsv-max" className="bsv-input bsv-input-num" value={maxSolutions} min={1} max={500} onCommit={setMaxSolutions} />
          <span className="bsv-label">{t('条', 'per case')}</span>
        </div>

        <div className="bsv-field-row bsv-options">
          <BoolToggle value={showPost} onChange={setShowPost} label={t('显示收尾整层转', 'Show ending adjustments')} />
          <BoolToggle value={firstOnly} onChange={setFirstOnly} label={t('每题只要最快出的一条', 'First solution per case only')} />
        </div>

        <div className="bsv-field-row bsv-options">
          <label className="bsv-label">{t('图像', 'Images')}</label>
          <ListSelect items={imgItems} value={imgKind} onChange={(v) => setImgKind(v as BatchImageKind)} allLabel={tr({ zh: '无图像', en: 'No image' })} clearable={false} />
          {imgKind !== 'none' && (
            <>
              <label className="bsv-label" htmlFor="bsv-imgsize">{t('尺寸', 'Size')}</label>
              <NumberCommitInput id="bsv-imgsize" className="bsv-input bsv-input-num" value={imgSize} min={40} max={300} onCommit={setImgSize} />
            </>
          )}
        </div>

        <div className="bsv-field-row">
          <button
            type="button"
            className={`bsv-collapse-toggle${showAdvanced ? ' is-open' : ''}`}
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
          >
            {t('MCC 高级参数', 'Advanced MCC options')}
            <ChevronDown size={14} className="bsv-collapse-chevron" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`bsv-collapse-toggle${showEsqOpts ? ' is-open' : ''}`}
            onClick={() => setShowEsqOpts((v) => !v)}
            aria-expanded={showEsqOpts}
          >
            {t('ESQ 权重', 'ESQ options')}
            <ChevronDown size={14} className="bsv-collapse-chevron" aria-hidden="true" />
          </button>
        </div>
        {showAdvanced && <ParamSliders className="bsv-advanced" specs={MCC_SLIDERS} values={mccParams} defaults={MCC_DEFAULTS} onChange={setMccParams} />}
        {showEsqOpts && (
          <div className="bsv-esq">
            <div className="bsv-field">
              <label className="bsv-label" htmlFor="bsv-rankesq">{t('Rank ESQ(排序与统计用的每步权重)', 'Rank ESQ (per-move weights for ranking & stats)')}</label>
              <textarea id="bsv-rankesq" className="bsv-textarea" value={rankEsq} onChange={(e) => setRankEsq(e.target.value)} rows={4} spellCheck={false} />
            </div>
            <div className="bsv-field">
              <div className="bsv-field-row">
                <label className="bsv-label">{t('生成 ESQ(按加权深度生成)', 'Generation ESQ (weighted generation depth)')}</label>
                <ListSelect items={genEsqItems} value={genEsqMode} onChange={(v) => setGenEsqMode(v as 'default' | 'match' | 'custom')} allLabel="" clearable={false} />
              </div>
              {genEsqMode === 'custom' && (
                <textarea className="bsv-textarea" value={genEsq} onChange={(e) => setGenEsq(e.target.value)} rows={4} spellCheck={false} placeholder="_2: 2" />
              )}
            </div>
          </div>
        )}

        <div className="bsv-actions">
          <button type="button" className={`bsv-run${running ? ' is-running' : ''}`} onClick={startSearch}>
            {running ? t('停止搜索', 'End search') : t('开始搜索', 'Start search')}
          </button>
          {cases.length > 0 && !running && (
            <>
              <button type="button" className="bsv-secondary-btn" onClick={exportCsv}>{t('导出 CSV', 'Export CSV')}</button>
              <button type="button" className="bsv-secondary-btn" onClick={() => { casesRef.current = []; renderCases(); setStats(null); setError(null); }}>
                {t('清空结果', 'Clear output')}
              </button>
            </>
          )}
        </div>

        {error && <p className="bsv-error">{error}</p>}
      </div>

      {(stats || running) && (
        <p className="bsv-stats">
          {t(`进度 ${stats?.done ?? 0}/${total}`, `Case ${stats?.done ?? 0}/${total}`)}
          {stats && stats.failed.length > 0 && (
            <button type="button" className="bsv-fails" onClick={copyFails}>
              {copiedFails ? t('已复制', 'Copied') : t(`${stats.failed.length} 个失败(点击复制 # 列表)`, `${stats.failed.length} failed (click to copy #list)`)}
            </button>
          )}
          {stats && <span className="bsv-stats-sep" />}
          {stats && t(`${stats.rate.toFixed(2)} 秒/题`, `${stats.rate.toFixed(2)} sec/case`)}
          {stats && <span className="bsv-stats-sep" />}
          {stats && `MCC ${fmtAvg(stats.avgMcc)}`}
          {stats && <span className="bsv-stats-sep" />}
          {stats && `STM ${fmtAvg(stats.avgStm)}`}
          {stats && <span className="bsv-stats-sep" />}
          {stats && `SQTM ${fmtAvg(stats.avgSqtm)}`}
          {stats && <span className="bsv-stats-sep" />}
          {stats && `ESQ ${fmtAvg(stats.avgEsq)}`}
          {preparing && <span className="bsv-progress">{t(`建剪枝表中,深度 ${depth}`, `Building prune tables, depth ${depth}`)}</span>}
        </p>
      )}

      {cases.length > 0 && (
        <div className="bsv-output">
          {cases.map((c) => (
            <section key={c.id} className="bsv-case">
              <div className="bsv-case-head">
                {imgKind !== 'none'
                  ? <CaseImage kind={imgKind} setup={c.setup} size={imgSize} title={`#${c.caseNum}`} />
                  : <span className="bsv-case-num">#{c.caseNum}</span>}
                {!c.done && running && c.id === lastCase?.id && (
                  <span className="bsv-progress">{t(`搜索深度 ${depth}`, `depth ${depth}`)}</span>
                )}
              </div>
              {c.solutions.length > 0 && (
                <table className="bsv-sol-table">
                  <thead>
                    <tr>
                      <th className="bsv-sol-num">{sortBy}</th>
                      <th>{t('解', 'Solutions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.solutions.map((s, i) => (
                      <tr key={i}>
                        <td className="bsv-sol-num">{fmtMetric(s.speed)}</td>
                        <td className="bsv-sol-alg">{s.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {c.done && c.solutions.length === 0 && <p className="bsv-case-empty">{t('无解(加深或换步组)', 'No solution — raise depths or change subgroup')}</p>}
            </section>
          ))}
        </div>
      )}

      <UsageGuide />

      <p className="bsv-credit">
        {t('移植自 ', 'Ported from ')}
        <a href="https://github.com/trangium/trangium.github.io" target="_blank" rel="noreferrer">trangium/BatchSolver</a>
        {t('(MIT);讨论见 ', ' (MIT); discussion: ')}
        <a href="https://www.speedsolving.com/threads/the-batch-solver-generate-large-algorithm-sets-automatically.86934/" target="_blank" rel="noreferrer">speedsolving.com</a>
      </p>
    </div>
  );
}

const fmtAvg = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '–');
