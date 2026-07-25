'use client';

/**
 * /scramble/pattern/search — Cube Explorer "Pattern Editor" 图案搜索(issue #39)。
 *
 * 功能 1:1 对应 Cube Explorer 5.x 的 Pattern Editor tab(hkociemba/CubeExplorer):
 * 5 个 3×3 抽象图案 + 每图案 U R F D L B 面分配 + All、Continuous、Find Generators、
 * Clear Patterns、Start/Stop Search。搜索算法见 _pattern_core.ts(忠实移植)。
 *
 * 图案语义:同色格 = 实际同色,异色格 = 实际异色(色类双射);灰也是一种色类,
 * 全灰图案视为空。搜索结果按魔方 48 对称做 isomorphic 去重,上限 MAX_RESULTS。
 */

import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { useQueryState } from 'nuqs';
import {
  Search, Square as StopIcon, Eraser, Copy, Check,
  Plus, Pencil, Trash2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { renderCubeSVG } from '@cuberoot/visualcube';
import BoolToggle from '@/components/BoolToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/hooks/useT';
import { FACE_COLORS } from '@/lib/recon-utils';
import { useAuthStore, ADMIN_WCA_IDS } from '@/lib/auth-store';
import {
  listPatternExamples, createPatternExample, updatePatternExample,
  deletePatternExample, reorderPatternExamples, type PatternExample,
} from '@/lib/pattern-examples-api';
import { isEmptyPattern } from './_pattern_core';
import {
  DEFAULT_Q, decodeQ, defaultAssign, defaultPatterns, encodeQ, miniCells,
  type Assign, type Patterns,
} from './_q';
import type { WorkerRes } from './_search.worker';
import './search.css';

const MAX_RESULTS = 500;
const FACE_LABELS = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

/** 色板(UI 顺序照 Cube Explorer:红 黄 绿 蓝 白 灰);类值 0..5,GRAY=5。 */
const PALETTE: string[] = [
  FACE_COLORS.R, FACE_COLORS.Y, FACE_COLORS.G, FACE_COLORS.B, FACE_COLORS.W,
  'var(--psc-gray)',
];

interface ResultItem {
  facelet: string;
  generator?: string;
}

//──────────────────────── 结果卡 ────────────────────────

const ResultCard = memo(function ResultCard({ item, index, t }: {
  item: ResultItem;
  index: number;
  t: (zh: string, en: string) => string;
}) {
  const [copied, setCopied] = useState(false);
  const svg = useMemo(
    () => renderCubeSVG({ facelets: item.facelet.toLowerCase().split(''), width: 96, height: 96 }),
    [item.facelet],
  );
  const copy = async () => {
    if (!item.generator) return;
    try {
      await navigator.clipboard.writeText(item.generator);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* swallow */ }
  };
  const moveCount = item.generator ? item.generator.split(/\s+/).filter(Boolean).length : 0;
  return (
    <li className="psc-result">
      <div className="psc-result-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="psc-result-body">
        <div className="psc-result-head">#{index + 1}</div>
        {item.generator ? (
          <>
            <code className="psc-result-alg">{item.generator}</code>
            <div className="psc-result-foot">
              <span className="psc-result-count">{moveCount} {t('步', 'moves')}</span>
              <button type="button" className="psc-copy" onClick={copy} aria-label={t('复制', 'Copy')}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? t('已复制', 'Copied') : t('复制', 'Copy')}</span>
              </button>
            </div>
          </>
        ) : null}
      </div>
    </li>
  );
});

//──────────────────────── 页面 ────────────────────────

export default function PatternSearchPage() {
  useDocumentTitle('图案搜索', 'Pattern Search');
  const t = useT();

  const [q, setQ] = useQueryState('q');
  const initial = useMemo(() => decodeQ(q), []); // eslint-disable-line react-hooks/exhaustive-deps -- 仅首载解析
  const [patterns, setPatterns] = useState<Patterns>(() => initial?.patterns ?? defaultPatterns());
  const [assign, setAssign] = useState<Assign>(() => initial?.assign ?? defaultAssign());
  const [selColor, setSelColor] = useState(0);
  const [continuous, setContinuous] = useState(false);
  const [findGenerators, setFindGenerators] = useState(false);

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'tables' | 'searching' | 'done'>('idle');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [nodes, setNodes] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // 示例预设(DB,管理员自维护)。null = 还没拉到 / 拉失败 → 整排不渲染
  const user = useAuthStore((s) => s.user);
  const isAdmin = !!user && ADMIN_WCA_IDS.includes(user.wcaId);
  const [examples, setExamples] = useState<PatternExample[] | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const [form, setForm] = useState<null | { id: number | null; nameZh: string; nameEn: string; useCurrent: boolean }>(null);
  const [adminErr, setAdminErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const curQ = encodeQ(patterns, assign);
  const curEmpty = patterns.every(isEmptyPattern);

  const reloadExamples = useCallback(async () => {
    try {
      setExamples(await listPatternExamples());
    } catch {
      setExamples((prev) => prev ?? []); // 拉不到就当空表,不挡搜索功能
    }
  }, []);

  useEffect(() => { void reloadExamples(); }, [reloadExamples]);

  // 编辑状态 → URL(replace,可分享)
  useEffect(() => {
    setQ(curQ === DEFAULT_Q ? null : curQ);
  }, [curQ, setQ]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const paint = (j: number, i: number) => {
    setPatterns((prev) => {
      const next = prev.map((row) => row.slice());
      next[j][i] = selColor;
      return next;
    });
  };

  const toggleFace = (j: number, f: number) => {
    setAssign((prev) => {
      const next = prev.map((row) => row.slice());
      next[j][f] = !next[j][f];
      return next;
    });
  };

  const toggleAll = (j: number) => {
    setAssign((prev) => {
      const next = prev.map((row) => row.slice());
      const allOn = next[j].every(Boolean);
      next[j] = next[j].map(() => !allOn);
      return next;
    });
  };

  const clearPatterns = () => {
    // 上游 Clear Patterns:只重置格子颜色,不动面分配
    setPatterns(defaultPatterns());
  };

  const loadExample = (ex: PatternExample) => {
    const d = decodeQ(ex.q);
    if (!d) return; // 坏数据不动现场
    setPatterns(d.patterns);
    setAssign(d.assign);
    setContinuous(ex.continuous);
  };

  //── 管理员:示例增删改排序 ──
  const runAdmin = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setAdminErr(null);
    try {
      await fn();
      await reloadExamples();
    } catch (e) {
      setAdminErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const submitForm = () => {
    if (!form) return;
    const target = form.id === null ? null : examples?.find((x) => x.id === form.id);
    const body = {
      nameZh: form.nameZh.trim(),
      nameEn: form.nameEn.trim(),
      q: form.useCurrent || !target ? curQ : target.q,
      continuous: form.useCurrent || !target ? continuous : target.continuous,
    };
    if (!body.nameZh || !body.nameEn) return;
    void runAdmin(async () => {
      if (form.id === null) await createPatternExample(body);
      else await updatePatternExample(form.id, body);
      setForm(null);
    });
  };

  const removeExample = (ex: PatternExample) => {
    if (!window.confirm(t(`删除示例「${ex.nameZh}」?`, `Delete example “${ex.nameEn}”?`))) return;
    void runAdmin(() => deletePatternExample(ex.id));
  };

  const moveExample = (index: number, delta: number) => {
    if (!examples) return;
    const to = index + delta;
    if (to < 0 || to >= examples.length) return;
    const ids = examples.map((x) => x.id);
    [ids[index], ids[to]] = [ids[to], ids[index]];
    void runAdmin(() => reorderPatternExamples(ids));
  };

  // 每面需至少分配一个非空图案,否则无解(上游会静默空转;这里入口拦截并给原因)
  const uncoveredFaces = useMemo(() => {
    const out: string[] = [];
    for (let f = 0; f < 6; f++) {
      const covered = patterns.some((p, j) => assign[j][f] && !isEmptyPattern(p));
      if (!covered) out.push(FACE_LABELS[f]);
    }
    return out;
  }, [patterns, assign]);

  const start = useCallback(() => {
    if (running || uncoveredFaces.length > 0) return;
    // 空图案自动摘除面分配(上游 FindPatterns 行为,UI 同步)
    setAssign((prev) => prev.map((row, j) => (isEmptyPattern(patterns[j]) ? row.map(() => false) : row)));
    setResults([]);
    setNodes(0);
    setTruncated(false);
    setWorkerError(null);
    setRunning(true);
    setPhase(findGenerators ? 'tables' : 'searching');

    const worker = new Worker(new URL('./_search.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (ev: MessageEvent<WorkerRes>) => {
      const msg = ev.data;
      if (msg.type === 'phase') setPhase('tables');
      else if (msg.type === 'result') {
        setPhase('searching');
        setResults((prev) => [...prev, { facelet: msg.facelet, generator: msg.generator }]);
      } else if (msg.type === 'progress') {
        setPhase('searching');
        setNodes(msg.nodes);
      } else if (msg.type === 'done') {
        setNodes(msg.nodes);
        setTruncated(msg.truncated);
        setPhase('done');
        setRunning(false);
        worker.terminate();
        workerRef.current = null;
      } else if (msg.type === 'error') {
        setWorkerError(msg.message);
        setPhase('done');
        setRunning(false);
        worker.terminate();
        workerRef.current = null;
      }
    };
    worker.postMessage({
      op: 'start',
      patterns,
      faceAssign: assign,
      continuous,
      findGenerators,
      maxResults: MAX_RESULTS,
    });
  }, [running, uncoveredFaces, patterns, assign, continuous, findGenerators]);

  const stop = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
    setPhase('done');
  }, []);

  const nodesLabel = nodes >= 1e6 ? `${(nodes / 1e6).toFixed(0)}M` : String(nodes);

  return (
    <div className="psc-page">
      <header className="psc-header">
        <h1>{t('图案搜索', 'Pattern Search')}</h1>
        <p className="psc-sub">
          {t(
            '在 3×3 上搜索满足抽象图案约束的所有魔方状态。图案里同色 = 实际同色、异色 = 实际异色(灰也是一种颜色);每个图案可分配到任意几个面,每面需至少匹配一个图案。移植自 Herbert Kociemba 的 Cube Explorer。',
            'Search for all cube states matching abstract face patterns. Same color in a pattern = same color on the cube, different = different (gray is a color too). Assign each pattern to any set of faces; every face must match one assigned pattern. Ported from Herbert Kociemba\'s Cube Explorer.',
          )}
        </p>
      </header>

      {examples && (examples.length > 0 || isAdmin) && (
        <section className="psc-examples" aria-label={t('示例', 'Examples')}>
          <div className="psc-examples-row">
            <span className="psc-label">{t('示例', 'Examples')}</span>
            {examples.map((ex, i) => (
              <span className="psc-example-wrap" key={ex.id}>
                <button
                  type="button"
                  className="psc-example"
                  onClick={() => loadExample(ex)}
                  disabled={running}
                >
                  <span className="psc-example-mini" aria-hidden>
                    {miniCells(ex.q).map((c, k) => (
                      <i key={k} style={{ background: PALETTE[c] }} />
                    ))}
                  </span>
                  {t(ex.nameZh, ex.nameEn)}
                </button>
                {adminMode && (
                  <span className="psc-ex-ctl">
                    <button type="button" className="psc-ex-btn" onClick={() => moveExample(i, -1)} disabled={busy || i === 0} aria-label={t('左移', 'Move left')} title={t('左移', 'Move left')}>
                      <ChevronLeft size={13} />
                    </button>
                    <button type="button" className="psc-ex-btn" onClick={() => moveExample(i, 1)} disabled={busy || i === examples.length - 1} aria-label={t('右移', 'Move right')} title={t('右移', 'Move right')}>
                      <ChevronRight size={13} />
                    </button>
                    <button
                      type="button"
                      className="psc-ex-btn"
                      onClick={() => { setAdminErr(null); setForm({ id: ex.id, nameZh: ex.nameZh, nameEn: ex.nameEn, useCurrent: false }); }}
                      disabled={busy}
                      aria-label={t('重命名', 'Rename')}
                      title={t('重命名', 'Rename')}
                    >
                      <Pencil size={13} />
                    </button>
                    <button type="button" className="psc-ex-btn" onClick={() => removeExample(ex)} disabled={busy} aria-label={t('删除', 'Delete')} title={t('删除', 'Delete')}>
                      <Trash2 size={13} />
                    </button>
                  </span>
                )}
              </span>
            ))}
            {isAdmin && (
              adminMode ? (
                <>
                  <button
                    type="button"
                    className="psc-example psc-ex-add"
                    onClick={() => { setAdminErr(null); setForm({ id: null, nameZh: '', nameEn: '', useCurrent: true }); }}
                    disabled={busy || curEmpty}
                    title={curEmpty ? t('先在下面摆一个图案', 'Lay out a pattern below first') : undefined}
                  >
                    <Plus size={14} />
                    {t('把当前图案存为示例', 'Save current as example')}
                  </button>
                  <button type="button" className="psc-ex-manage" onClick={() => { setAdminMode(false); setForm(null); }}>
                    {t('完成', 'Done')}
                  </button>
                </>
              ) : (
                <button type="button" className="psc-ex-manage" onClick={() => setAdminMode(true)}>
                  <Pencil size={13} />
                  {t('管理示例', 'Manage')}
                </button>
              )
            )}
          </div>

          {form && (
            <div className="psc-ex-form">
              <input
                className="psc-input"
                value={form.nameZh}
                onChange={(e) => setForm({ ...form, nameZh: e.target.value })}
                placeholder={t('中文名', 'Chinese name')}
                maxLength={60}
              />
              <input
                className="psc-input"
                value={form.nameEn}
                onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                placeholder={t('英文名', 'English name')}
                maxLength={60}
              />
              {form.id !== null && (
                <BoolToggle
                  value={form.useCurrent}
                  onChange={(v) => setForm({ ...form, useCurrent: v })}
                  label={t('替换成当前图案', 'Replace with current pattern')}
                />
              )}
              <button
                type="button"
                className="psc-btn psc-btn-primary"
                onClick={submitForm}
                disabled={busy || !form.nameZh.trim() || !form.nameEn.trim() || (form.useCurrent && curEmpty)}
              >
                {t('保存', 'Save')}
              </button>
              <button type="button" className="psc-btn" onClick={() => setForm(null)} disabled={busy}>
                {t('取消', 'Cancel')}
              </button>
            </div>
          )}

          {adminErr && <div className="psc-error psc-ex-error">{adminErr}</div>}
        </section>
      )}

      <section className="psc-palette-row" aria-label={t('图案颜色', 'Pattern type')}>
        <span className="psc-label">{t('图案颜色', 'Pattern type')}</span>
        {PALETTE.map((c, i) => (
          <button
            key={i}
            type="button"
            className={`psc-swatch${selColor === i ? ' is-active' : ''}`}
            style={{ background: c }}
            onClick={() => setSelColor(i)}
            aria-label={`${t('颜色', 'color')} ${i + 1}`}
            aria-pressed={selColor === i}
          />
        ))}
      </section>

      <section className="psc-editors">
        {patterns.map((p, j) => (
          <div className="psc-editor" key={j}>
            <div className="psc-grid" role="group" aria-label={`${t('图案', 'Pattern')} ${j + 1}`}>
              {p.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  className="psc-cell"
                  style={{ background: PALETTE[c] }}
                  onClick={() => paint(j, i)}
                  disabled={running}
                  aria-label={`${t('图案', 'Pattern')} ${j + 1} ${t('格', 'cell')} ${i + 1}`}
                />
              ))}
            </div>
            <div className="psc-faces">
              {FACE_LABELS.map((fl, f) => (
                <button
                  key={fl}
                  type="button"
                  className={`psc-face${assign[j][f] ? ' is-on' : ''}`}
                  onClick={() => toggleFace(j, f)}
                  disabled={running}
                  aria-pressed={assign[j][f]}
                >
                  {fl}
                </button>
              ))}
              <button
                type="button"
                className={`psc-face psc-face-all${assign[j].every(Boolean) ? ' is-on' : assign[j].some(Boolean) ? ' is-partial' : ''}`}
                onClick={() => toggleAll(j)}
                disabled={running}
              >
                {t('全', 'All')}
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="psc-options">
        <BoolToggle
          value={continuous}
          onChange={setContinuous}
          disabled={running}
          label={t('图案连续(跨棱不断开)', 'Continuous (patterns join across edges)')}
        />
        <BoolToggle
          value={findGenerators}
          onChange={setFindGenerators}
          disabled={running}
          label={t('求生成公式', 'Find generators')}
        />
      </section>

      <section className="psc-actions">
        <button type="button" className="psc-btn" onClick={clearPatterns} disabled={running}>
          <Eraser size={15} />
          {t('清空图案', 'Clear patterns')}
        </button>
        {running ? (
          <button type="button" className="psc-btn psc-btn-primary" onClick={stop}>
            <StopIcon size={15} />
            {t('停止搜索', 'Stop search')}
          </button>
        ) : (
          <button
            type="button"
            className="psc-btn psc-btn-primary"
            onClick={start}
            disabled={uncoveredFaces.length > 0}
          >
            <Search size={15} />
            {t('开始搜索', 'Start search')}
          </button>
        )}
        {uncoveredFaces.length > 0 && (
          <span className="psc-hint">
            {t(
              `这些面还没有分配图案:${uncoveredFaces.join(' ')}(每面需至少一个非空图案)`,
              `Faces without a pattern: ${uncoveredFaces.join(' ')} (every face needs a non-empty pattern)`,
            )}
          </span>
        )}
      </section>

      {(phase !== 'idle' || results.length > 0) && (
        <section className="psc-status" aria-live="polite">
          {phase === 'tables' && <span>{t('正在构建求解表(首次约几秒)…', 'Building solver tables (a few seconds on first run)…')}</span>}
          {phase === 'searching' && (
            <span>{t('搜索中', 'Searching')} — {t('已找到', 'found')} {results.length}{nodes > 0 ? ` / ${nodesLabel} ${t('节点', 'nodes')}` : ''}</span>
          )}
          {phase === 'done' && !workerError && (
            <span>
              {t('完成', 'Done')} — {results.length} {t('个结果', 'results')}
              {truncated ? t('(已达上限,提前停止)', ' (limit reached, stopped early)') : ''}
            </span>
          )}
          {workerError && <span className="psc-error">{t('搜索出错:', 'Search error: ')}{workerError}</span>}
        </section>
      )}

      {results.length > 0 && (
        <ul className="psc-results">
          {results.map((r, i) => (
            <ResultCard key={r.facelet} item={r} index={i} t={t} />
          ))}
        </ul>
      )}
    </div>
  );
}
