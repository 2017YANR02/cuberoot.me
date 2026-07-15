'use client';

/**
 * 统一求解面板(共享):单条 / 批量按输入行数自动判定,不再有独立 tab。
 *
 * 输入框永远是同一个多行 textarea:0/1 行 → 调用方通过 renderSingle 渲染它自己的
 * 「单条」结果视图(预览图/步数/最优解等,各 puzzle 展示不同,故不在本组件里做);
 * ≥2 行 → 本组件接管,并发求解 → 汇总(数量/平均/min/max/步数直方图)+ 逐条结果表
 * (# / 打乱 / 步数 / 一条最优解)+ 复制·下载 CSV。
 *
 * 随机按钮带一个条数输入:N=1 直接替换整个输入框(等价于「再随机一条」,留在单条视图);
 * N>1 追加到已有内容后面(建批量用),自然地把视图切到批量。
 *
 * 与具体 puzzle 解耦:调用方传 BatchSpec(solveOne / validate / randomOne / 度量名)。
 * 222 / 金字塔 / 斜转 走 rust-cross worker 池(solveOne 内并发,池自身限流),SQ1 走纯 TS
 * 同步引擎(concurrency=1,solveOne 内 setTimeout 让出主线程)。两者同一套 UI。
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Trash2, Copy, Download, Check } from 'lucide-react';
import { tr } from '@/i18n/tr';
import './batch_solve.css';

export interface BatchSpec {
  event: string;
  /** 度量名(HTM / WCA 12c4 等),结果表与汇总展示 */
  metricLabel: string;
  placeholder: { zh: string; en: string };
  /** 逐行轻校验:返回非法 token(将整行标错),合法返回 null。深层合法性交给 solveOne 抛错。 */
  validate: (line: string) => string | null;
  /** 单条求解:返回步数 + 一条解;不合法/无法解时抛错。 */
  solveOne: (scramble: string) => Promise<{ len: number; solution: string }>;
  /** 生成一条随机打乱(随机按钮用) */
  randomOne: () => Promise<string | null>;
  /** 并发度:池类 puzzle 4,SQ1 同步引擎 1 */
  concurrency: number;
}

interface Row {
  i: number;
  scramble: string;
  len: number | null;
  solution: string;
  error: string | null;
}

const MAX_LINES = 2000;
const MAX_GEN = 200;
const tick = () => new Promise<void>((r) => window.setTimeout(r, 0));

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function SolvePanel({
  spec,
  scramble,
  onScrambleChange,
  renderSingle,
}: {
  spec: BatchSpec;
  scramble: string;
  onScrambleChange: (v: string) => void;
  /** 0/1 行(单条模式)时的结果视图,调用方自己渲染(各 puzzle 展示不同) */
  renderSingle: (trimmed: string) => ReactNode;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [genN, setGenN] = useState(1);
  const [copied, setCopied] = useState(false);
  const cancelRef = useRef(false);

  const lines = useMemo(
    () => scramble.split('\n').map((s) => s.trim()).filter(Boolean),
    [scramble],
  );
  const lineCount = lines.length;
  const isBatch = lineCount > 1;

  const stats = useMemo(() => {
    const ok = rows.filter((r) => r.error === null && r.len !== null);
    const lens = ok.map((r) => r.len as number);
    const hist = new Map<number, number>();
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const v of lens) {
      hist.set(v, (hist.get(v) ?? 0) + 1);
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    return {
      total: rows.length,
      ok: ok.length,
      err: rows.length - ok.length,
      avg: lens.length ? sum / lens.length : 0,
      min: lens.length ? min : 0,
      max: lens.length ? max : 0,
      hist,
    };
  }, [rows]);

  async function runAll() {
    if (!lines.length || running) return;
    const capped = lines.slice(0, MAX_LINES);
    cancelRef.current = false;
    setRunning(true);
    setRows([]);
    setProgress({ done: 0, total: capped.length });

    const out: Row[] = new Array(capped.length);
    let next = 0;
    let done = 0;
    const worker = async () => {
      for (;;) {
        const idx = next++;
        if (idx >= capped.length || cancelRef.current) return;
        const scr = capped[idx];
        const bad = spec.validate(scr);
        if (bad) {
          out[idx] = { i: idx + 1, scramble: scr, len: null, solution: '', error: `bad: ${bad}` };
        } else {
          try {
            const r = await spec.solveOne(scr);
            out[idx] = { i: idx + 1, scramble: scr, len: r.len, solution: r.solution, error: null };
          } catch (e) {
            out[idx] = { i: idx + 1, scramble: scr, len: null, solution: '', error: String((e as Error)?.message ?? e) };
          }
        }
        done++;
        setProgress({ done, total: capped.length });
        if (done % 25 === 0) {
          setRows(out.filter(Boolean));
          await tick();
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, spec.concurrency) }, worker));
    setRows(out.filter(Boolean));
    setRunning(false);
  }

  async function genRandom() {
    if (generating || running) return;
    setGenerating(true);
    cancelRef.current = false;
    const n = Math.max(1, Math.min(MAX_GEN, Math.floor(genN) || 1));
    const got: string[] = [];
    for (let k = 0; k < n; k++) {
      if (cancelRef.current) break;
      try {
        const s = await spec.randomOne();
        if (s) got.push(s.trim());
      } catch { /* 跳过失败的一条 */ }
    }
    // 单条(N=1):替换整框,像「再随机一条」;批量(N>1):追加到已有内容后建批量。
    onScrambleChange(n === 1 ? got.join('\n') : (scramble.trim() ? `${scramble.trim()}\n` : '') + got.join('\n'));
    setGenerating(false);
  }

  function cancel() {
    cancelRef.current = true;
    setGenerating(false);
    setRunning(false);
  }

  function clearAll() {
    cancelRef.current = true;
    onScrambleChange('');
    setRows([]);
    setProgress({ done: 0, total: 0 });
  }

  const csv = useMemo(() => {
    const head = 'index,scramble,length,solution';
    const body = rows.map((r) =>
      [r.i, csvCell(r.scramble), r.error === null ? r.len : '', csvCell(r.error === null ? r.solution : `ERROR: ${r.error}`)].join(','),
    );
    return [head, ...body].join('\n');
  }, [rows]);

  async function copyCsv() {
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard 不可用时静默 */ }
  }

  function downloadCsv() {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${spec.event}-batch-solutions.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const histRows = useMemo(() => {
    const out: { len: number; n: number; pct: number }[] = [];
    if (stats.ok === 0) return out;
    const maxN = Math.max(...stats.hist.values());
    for (let v = stats.min; v <= stats.max; v++) {
      const n = stats.hist.get(v) ?? 0;
      out.push({ len: v, n, pct: maxN ? (n / maxN) * 100 : 0 });
    }
    return out;
  }, [stats]);

  return (
    <div className="bsp">
      <div className="bsp-input-block">
        <textarea
          className="bsp-textarea"
          value={scramble}
          onChange={(e) => onScrambleChange(e.target.value)}
          placeholder={tr(spec.placeholder)}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          rows={Math.min(6, Math.max(1, lineCount || 1))}
        />
        {isBatch && (
          <div className="bsp-input-meta">
            {tr({ zh: `${lineCount} 条打乱`, en: `${lineCount} scrambles` })}
            {lineCount > MAX_LINES && (
              <span className="bsp-warn"> {tr({ zh: `(只取前 ${MAX_LINES} 条)`, en: `(first ${MAX_LINES} only)` })}</span>
            )}
          </div>
        )}
      </div>

      <div className="bsp-toolbar">
        <div className="bsp-gen">
          <button type="button" className="bsp-btn bsp-btn-primary" onClick={() => void genRandom()} disabled={generating || running}>
            {tr({ zh: '打乱', en: 'Scramble' })}
          </button>
          <input
            className="bsp-gen-n"
            type="number"
            min={1}
            max={MAX_GEN}
            value={genN}
            onChange={(e) => setGenN(Number(e.target.value))}
            aria-label={tr({ zh: '随机条数', en: 'count' })}
          />
          <span className="bsp-gen-unit">{tr({ zh: '条', en: '' })}</span>
        </div>

        {isBatch && (
          running ? (
            <button type="button" className="bsp-btn" onClick={cancel}>
              {tr({ zh: `停止 (${progress.done}/${progress.total})`, en: `Stop (${progress.done}/${progress.total})` })}
            </button>
          ) : (
            <button type="button" className="bsp-btn" onClick={() => void runAll()} disabled={lineCount === 0}>
              {tr({ zh: '求解', en: 'Solve' })}
            </button>
          )
        )}

        {(scramble || rows.length > 0) && (
          <button type="button" className="bsp-btn bsp-btn-ghost" onClick={clearAll} aria-label={tr({ zh: '清空', en: 'Clear' })}>
            <Trash2 size={15} aria-hidden />
          </button>
        )}
      </div>

      {isBatch && running && (
        <div className="bsp-progress" aria-hidden>
          <div className="bsp-progress-bar" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
        </div>
      )}

      {!isBatch && renderSingle(lines[0] ?? '')}

      {isBatch && rows.length > 0 && (
        <>
          <div className="bsp-summary">
            <div className="bsp-stat">
              <span className="bsp-stat-num">{stats.ok}</span>
              <span className="bsp-stat-lbl">{tr({ zh: '已解', en: 'solved' })}</span>
            </div>
            {stats.err > 0 && (
              <div className="bsp-stat bsp-stat-err">
                <span className="bsp-stat-num">{stats.err}</span>
                <span className="bsp-stat-lbl">{tr({ zh: '出错', en: 'errors' })}</span>
              </div>
            )}
            <div className="bsp-stat">
              <span className="bsp-stat-num">{stats.avg.toFixed(2)}</span>
              <span className="bsp-stat-lbl">{tr({ zh: '平均步数', en: 'avg' })}</span>
            </div>
            <div className="bsp-stat">
              <span className="bsp-stat-num">{stats.min}–{stats.max}</span>
              <span className="bsp-stat-lbl">{tr({ zh: `步数 (${spec.metricLabel})`, en: `range (${spec.metricLabel})` })}</span>
            </div>
          </div>

          {histRows.length > 0 && (
            <div className="bsp-hist" aria-hidden>
              {histRows.map((d) => (
                <div key={d.len} className="bsp-hist-row">
                  <span className="bsp-hist-len">{d.len}</span>
                  <span className="bsp-hist-track"><span className="bsp-hist-fill" style={{ width: `${d.pct}%` }} /></span>
                  <span className="bsp-hist-n">{d.n}</span>
                </div>
              ))}
            </div>
          )}

          <div className="bsp-export">
            <button type="button" className="bsp-btn bsp-btn-ghost" onClick={() => void copyCsv()}>
              {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
              {copied ? tr({ zh: '已复制', en: 'Copied' }) : tr({ zh: '复制 CSV', en: 'Copy CSV' })}
            </button>
            <button type="button" className="bsp-btn bsp-btn-ghost" onClick={downloadCsv}>
              <Download size={15} aria-hidden />
              {tr({ zh: '下载 CSV', en: 'Download CSV' })}
            </button>
          </div>

          <div className="bsp-table-wrap">
            <table className="bsp-table">
              <thead>
                <tr>
                  <th className="bsp-col-i">#</th>
                  <th className="bsp-col-scr">{tr({ zh: '打乱', en: 'Scramble' })}</th>
                  <th className="bsp-col-len">{tr({ zh: '步数', en: 'Len' })}</th>
                  <th className="bsp-col-sol">{tr({ zh: '一条最优解', en: 'Solution' })}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.i} className={r.error ? 'bsp-row-err' : undefined}>
                    <td className="bsp-col-i">{r.i}</td>
                    <td className="bsp-col-scr">{r.scramble}</td>
                    <td className="bsp-col-len">{r.error === null ? r.len : '—'}</td>
                    <td className="bsp-col-sol">
                      {r.error === null
                        ? (r.solution || tr({ zh: '已还原', en: 'solved' }))
                        : <span className="bsp-err-msg">{tr({ zh: '无法识别', en: 'invalid' })}: {r.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
