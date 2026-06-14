'use client';

// 读码还原助手 (helper) — centerpiece, ported from spooncuber helper.html + helper.js.
//
// Full live recompute (debounced) of:
//   • a scramble textarea + 随机打乱 button (scramble333)
//   • read-code readouts via codereader(scramble, config):
//       棱块读码 / 角块读码 (LetterReadout) + 棱块翻色 / 角块翻色 (flips/twists)
//   • FIVE restore-code rows (棱块还原 / 角块还原 / 奇偶 / 翻棱 / 翻角) that are
//     HTML5-draggable to reorder execution order (upstream <li> drag/drop)
//   • from the typed restore codes build the solving comms via codeTrans + m2pSolve
//     (per upstream solver()), with commutator notation per pair via commutator.search
//   • a 3D cube view (<TwistySection puzzle="3x3x3">) animating
//     orientation-prefix + scramble (setup) and the derived comms (alg)
//   • "生成当前状态打乱 / Generate scramble from state" via mover2scr (ASYNC) + copy
//
// m2pSolve / mover2scr are ASYNC (WASM Kociemba) -> busy state + prewarm() on mount.
// Upstream emoji ⏰/📝 + spinner replaced with lucide icons + a clean loading state.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type JSX,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Shuffle, GripVertical, Loader2, Wand2 } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import dynamic from 'next/dynamic';
import { ClearButton } from '@/components/ClearButton';
import { BldConfigBar } from '../_components/BldConfigBar';
import { LetterReadout } from '../_components/LetterReadout';
import {
  useBldConfigStore,
  useBldConfigHydrated,
} from '../_store/bld-config-store';
import type { BldConfig, CodeReadResult } from '../_lib/types';
import { codereader } from '../_lib/read-engine';
import { posChichu, globalState } from '../_lib/lettering';
import { codeTrans } from '../_lib/state-gen';
import { m2pSolve, mover2scr, prewarm } from '../_lib/m2p-bridge';
import { commutator } from '@/app/[lang]/alg/commutator/engine';
import { scramble333 } from '@/app/[lang]/timer/_lib/scramble/nxnxn';
import '../3bld.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

// TwistySection pulls in cubing.js (heavy) — load it only on the client, lazily.
const TwistySection = dynamic(() => import('@/components/TwistySection'), {
  ssr: false,
  loading: () => (
    <div className="bld-cube-loading">
      <Loader2 size={18} />
    </div>
  ),
});

// ── the five restore rows ─────────────────────────────────────────────────
type RowId = 'edge' | 'corner' | 'parity' | 'flip' | 'twist';

interface RowDef {
  id: RowId;
  zh: string;
  en: string;
  hintZh: string;
  hintEn: string;
}

// Upstream li1..li5 order (edge / corner / parity / flip / twist).
const ROW_DEFS: RowDef[] = [
  { id: 'edge', zh: '棱块还原', en: 'Edges', hintZh: '例:XY 为缓冲块-X-Y 的三棱换', hintEn: 'e.g. XY = buffer-X-Y edge 3-cycle'
},
  { id: 'corner', zh: '角块还原', en: 'Corners', hintZh: '例:ZY 为缓冲块-Z-Y 的三角换', hintEn: 'e.g. ZY = buffer-Z-Y corner 3-cycle'
},
  { id: 'parity', zh: '奇偶还原', en: 'Parity', hintZh: '先棱后角,例:MX 为棱缓冲与 M 交换、角缓冲与 X 交换', hintEn: 'edge then corner, e.g. MX swaps edge-buffer↔M, corner-buffer↔X'
},
  { id: 'flip', zh: '翻棱编码', en: 'Edge flips', hintZh: '例:NM 为缓冲块与 MN 块翻棱', hintEn: 'e.g. NM = flip buffer with the MN edge'
},
  { id: 'twist', zh: '翻角编码', en: 'Corner twists', hintZh: '例:ZX 为缓冲块逆翻与 XYZ 块顺翻', hintEn: 'e.g. ZX = CCW-twist buffer, CW-twist the XYZ corner'
},
];

const isAlphabet = (c: string): boolean => /^[A-Za-z]$/.test(c);

/**
 * Map config.orientation (0-23) to the visual-player rotation prefix.
 * Verbatim helper.js cubeorientation() switch (does NOT pre-rotate the lettering
 * trace — visual only). Returns "" or a "y "/"x2 y "/... prefix.
 */
function orientationPrefix(o: number): string {
  switch (o) {
    case 1: return 'y ';
    case 2: return 'y2 ';
    case 3: return "y' ";
    case 4: return 'x2 ';
    case 5: return 'x2 y ';
    case 6: return 'x2 y2 ';
    case 7: return "x2 y' ";
    case 8: return 'x ';
    case 9: return 'x y ';
    case 10: return 'x y2 ';
    case 11: return "x y' ";
    case 12: return "x' ";
    case 13: return "x' y ";
    case 14: return "x' y2 ";
    case 15: return "x' y' ";
    case 16: return "z' ";
    case 17: return "z' y ";
    case 18: return "z' y2 ";
    case 19: return "z' y' ";
    case 20: return 'z ';
    case 21: return 'z y ';
    case 22: return 'z y2 ';
    case 23: return "z y' ";
    default: return '';
  }
}

// Filter a raw scramble like helperEnter(): strip whitespace, match valid tokens,
// rejoin with single spaces. Empty / unparseable -> "".
const SCRAMBLE_REGEX = /(([URFBLD])(w?)(['2]?))|([EMSxyzurfbld](['2]?))/g;
function normalizeScramble(raw: string): string {
  const compact = raw.replace(/\s+/g, '');
  const res = compact.match(SCRAMBLE_REGEX);
  return res === null ? '' : res.join(' ');
}

interface RowResult {
  /** concatenated solving moves for this row (one m2p solve per valid pair) */
  moves: string;
  /** commutator notation per pair (parallel to the pair count) */
  comms: string[];
  /** validation message for this row, if any */
  error?: string;
}

/**
 * Solve one restore row's typed code into moves + commutator notation.
 * Faithful port of the per-case switch inside upstream solver(); each pair builds
 * its own chichu state from globalState and is solved independently, then the move
 * strings are concatenated (matching upstream `comms += m2p(state)`).
 */
async function solveRow(
  id: RowId,
  raw: string,
  cfg: BldConfig,
  isZh: boolean,
): Promise<RowResult> {
  const code = raw.replace(/\s/g, '').toUpperCase();
  const eBuf = cfg.eBuf.toUpperCase();
  const cBuf = cfg.cBuf.toUpperCase();

  const moves: string[] = [];
  const comms: string[] = [];
  let error: string | undefined;

  const setErr = (zh: string, en: string) => {
    if (!error) error = isZh ? zh : en;
  };

  // Upstream loops i < ~~(len/2)*2 step 2, so a trailing odd char is ignored.
  if (code.length % 2 === 1) {
    setErr('不能出现单数编码', 'Odd number of letters');
  }

  const pairCount = Math.trunc(code.length / 2) * 2;
  for (let i = 0; i < pairCount; i += 2) {
    const a = code[i];
    const b = code[i + 1];

    if (!isAlphabet(a) || !isAlphabet(b)) {
      setErr('输入非法编码', 'Invalid letter');
      continue;
    }

    let state: string | null = null;

    if (id === 'edge' || id === 'flip') {
      const pa = posChichu(a.toLowerCase());
      const pb = posChichu(b.toLowerCase());
      const pBuf = posChichu(eBuf.toLowerCase());
      if (pa === pBuf || pb === pBuf) {
        setErr('不能出现缓冲块编码', 'Cannot contain the buffer');
        continue;
      }
      if (id === 'edge' && pa === pb) {
        setErr('不能出现同位置编码', 'Cannot contain same-position codes');
        continue;
      }
      if (id === 'flip' && pa !== pb) {
        setErr('翻棱只能出现同位置编码', 'Flips require same-position codes');
        continue;
      }
      // codeTrans((eBuf + b + a).toLowerCase(), globalState)
      state = codeTrans((eBuf + b + a).toLowerCase(), globalState);
    } else if (id === 'corner' || id === 'twist') {
      const pa = posChichu(a);
      const pb = posChichu(b);
      const pBuf = posChichu(cBuf);
      if (pa === pBuf || pb === pBuf) {
        setErr('不能出现缓冲块编码', 'Cannot contain the buffer');
        continue;
      }
      if (id === 'corner' && pa === pb) {
        setErr('不能出现同位置编码', 'Cannot contain same-position codes');
        continue;
      }
      if (id === 'twist' && pa !== pb) {
        setErr('翻角只能出现同位置编码', 'Twists require same-position codes');
        continue;
      }
      state = codeTrans(cBuf + b + a, globalState);
    } else {
      // parity: a -> edge, b -> corner (chained state1 -> state2)
      const pEdge = posChichu(a.toLowerCase());
      const pCorner = posChichu(b);
      if (pEdge === posChichu(eBuf.toLowerCase()) || pCorner === posChichu(cBuf)) {
        setErr('不能出现缓冲块编码', 'Cannot contain the buffer');
        continue;
      }
      const state1 = codeTrans((eBuf + a).toLowerCase(), globalState);
      state = codeTrans(cBuf + b, state1);
    }

    if (state == null) continue;

    // eslint-disable-next-line no-await-in-loop
    const solved = (await m2pSolve(state)).trim();
    if (solved.length > 0) {
      moves.push(solved);
      // commutator notation for this pair (fast = first found; degrade gracefully)
      let comm = solved;
      try {
        // limit:1 = clean post-processed [A,B] notation, first/best result only.
        const res = commutator.search({ algorithm: solved, limit: 1 });
        const first = res[0];
        if (first && first !== 'Not found.' && first !== '' &&
            !first.startsWith('Lack ')) {
          comm = first;
        }
      } catch {
        /* keep raw moves on failure */
      }
      comms.push(comm);
    }
  }

  return { moves: moves.join(' ').replace(/\s+/g, ' ').trim(), comms, error };
}

// Empty state for the read-out before any scramble.
const EMPTY_READ: CodeReadResult = { edges: [], corners: [], flips: '', twists: '' };

export default function HelperPage(): JSX.Element {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('读码还原助手', 'Read & Restore Helper');

  const hydrated = useBldConfigHydrated();
  const config = useBldConfigStore((s) => s.config);

  const [rawScramble, setRawScramble] = useState('');
  const [codes, setCodes] = useState<Record<RowId, string>>({
    edge: '', corner: '', parity: '', flip: '', twist: '',
  });
  // Execution order of the five rows (drag to reorder). Upstream uses DOM li order.
  const [order, setOrder] = useState<RowId[]>(ROW_DEFS.map((r) => r.id));

  const [read, setRead] = useState<CodeReadResult>(EMPTY_READ);
  const [rowResults, setRowResults] = useState<Partial<Record<RowId, RowResult>>>({});
  const [solving, setSolving] = useState(false);

  // generated scramble-from-state output
  const [genScramble, setGenScramble] = useState('');
  const [genBusy, setGenBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Warm the WASM tables (m2pSolve / mover2scr are async).
  useEffect(() => {
    prewarm();
  }, []);

  const scramble = useMemo(() => normalizeScramble(rawScramble), [rawScramble]);

  // ── read-code (synchronous, cheap) — recompute whenever scramble/config changes
  useEffect(() => {
    if (scramble.length === 0) {
      setRead(EMPTY_READ);
      return;
    }
    try {
      setRead(codereader(scramble, config));
    } catch {
      setRead(EMPTY_READ);
    }
  }, [scramble, config]);

  // ── comms solve (async WASM) — debounced, recompute on codes/order/config change
  const solveSeq = useRef(0);
  useEffect(() => {
    const anyCode = order.some((id) => codes[id].replace(/\s/g, '').length > 0);
    if (!anyCode) {
      setRowResults({});
      setSolving(false);
      return;
    }
    const seq = ++solveSeq.current;
    setSolving(true);
    const t = setTimeout(async () => {
      const results: Partial<Record<RowId, RowResult>> = {};
      for (const id of order) {
        const raw = codes[id];
        if (raw.replace(/\s/g, '').length === 0) continue;
        // eslint-disable-next-line no-await-in-loop
        const r = await solveRow(id, raw, config, isZh);
        if (seq !== solveSeq.current) return; // superseded by a newer edit
        results[id] = r;
      }
      if (seq !== solveSeq.current) return;
      setRowResults(results);
      setSolving(false);
    }, 280);
    return () => clearTimeout(t);
  }, [codes, order, config, isZh]);

  // Concatenated comms (moves) in execution order — drives the cube animation.
  const comms = useMemo(() => {
    const parts: string[] = [];
    for (const id of order) {
      const r = rowResults[id];
      if (r && r.moves.length > 0) parts.push(r.moves);
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }, [order, rowResults]);

  const orientPrefix = orientationPrefix(config.orientation);
  // setup = orientation prefix + scramble; alg = comms (restore moves)
  const setupAlg = useMemo(
    () => `${orientPrefix}${scramble}`.trim(),
    [orientPrefix, scramble],
  );

  const setCode = (id: RowId, v: string) =>
    setCodes((c) => ({ ...c, [id]: v.toUpperCase() }));

  // ── random scramble (clears codes, like upstream randomScramble())
  const randomScramble = useCallback(() => {
    setRawScramble(scramble333(Math.random));
    setCodes({ edge: '', corner: '', parity: '', flip: '', twist: '' });
    setGenScramble('');
  }, []);

  // ── generate scramble from current state (scramble + comms) via mover2scr
  const generateFromState = useCallback(async () => {
    setGenBusy(true);
    setGenScramble('');
    try {
      const moveSeq = `${scramble} ${comms}`.replace(/\s+/g, ' ').trim();
      const out = await mover2scr(moveSeq);
      setGenScramble(out.trim());
    } catch {
      setGenScramble(tr({ zh: '(生成失败)', en: '(failed)'
    }));
    } finally {
      setGenBusy(false);
    }
  }, [scramble, comms, isZh]);

  const copyGen = useCallback(async () => {
    if (!genScramble) return;
    try {
      await navigator.clipboard.writeText(genScramble);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt(tr({ zh: '复制下面的打乱:', en: 'Copy the scramble below:'
    }), genScramble);
    }
  }, [genScramble, isZh]);

  // ── drag reorder (HTML5 draggable, swap on drop — matches upstream drop())
  const dragId = useRef<RowId | null>(null);
  const onDragStart = (id: RowId) => (e: DragEvent) => {
    dragId.current = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const onDrop = (target: RowId) => (e: DragEvent) => {
    e.preventDefault();
    const src = dragId.current;
    dragId.current = null;
    if (!src || src === target) return;
    setOrder((prev) => {
      const next = [...prev];
      const si = next.indexOf(src);
      const ti = next.indexOf(target);
      if (si === -1 || ti === -1) return prev;
      // swap (upstream swaps the two li contents)
      [next[si], next[ti]] = [next[ti], next[si]];
      return next;
    });
  };

  // Aggregate validation errors (first per row).
  const errors = useMemo(
    () => order.map((id) => rowResults[id]?.error).filter(Boolean) as string[],
    [order, rowResults],
  );

  // Gate config-dependent render on hydration (persisted buffers/scheme).
  if (!hydrated) return <div className="bld-trainer-root" />;

  const rowByOrder = order.map((id) => ROW_DEFS.find((r) => r.id === id)!);

  return (
    <div className="bld-trainer-root">
      <div className="bld-topbar">
        <h1>{tr({ zh: '读码还原助手', en: 'Read & Restore Helper'
        })}</h1>
      </div>

      <BldConfigBar
        show={{ corner: true, edge: true, scheme: true, orientation: true, hueSkip: true }}
      />

      <div className="bld-helper-grid">
        {/* ── column 1: scramble input ── */}
        <section className="bld-helper-col">
          <div className="bld-helper-row-head">
            <span className="bld-section-title">{tr({ zh: '打乱公式', en: 'Scramble'
            })}</span>
            <button
              type="button"
              className="bld-btn bld-btn-ghost bld-helper-random"
              onClick={randomScramble}
            >
              <Shuffle size={14} />
              {tr({ zh: '随机打乱', en: 'Random'
            })}
            </button>
          </div>
          <div className="bld-input-wrap bld-helper-scr-wrap">
            <textarea
              className="bld-modal-textarea bld-helper-scr"
              value={rawScramble}
              onChange={(e) => setRawScramble(e.target.value)}
              placeholder={tr({ zh: "例: R U R' U' ...", en: "e.g. R U R' U' ..." })}
              spellCheck={false}
              rows={3}
            />
            {rawScramble && (
              <ClearButton
                isZh={isZh}
                className="bld-helper-scr-clear"
                onClick={() => setRawScramble('')}
                preserveFocus
              />
            )}
          </div>
          {scramble.length === 0 && rawScramble.length > 0 && (
            <p className="bld-modal-msg is-error">
              {tr({ zh: '无法识别打乱(检查空格或转动记号)', en: 'Unrecognized scramble (check spaces / move tokens)'
            })}
            </p>
          )}
        </section>

        {/* ── column 2: readouts + restore rows ── */}
        <section className="bld-helper-col">
          <span className="bld-section-title">{tr({ zh: '读码结果', en: 'Read-code'
        })}</span>
          <div className="bld-helper-reads">
            <LetterReadout label={tr({ zh: '棱块读码', en: 'Edges'
            })} cells={read.edges} />
            <div className="bld-readout">
              <span className="bld-readout-label">{tr({ zh: '棱块翻色', en: 'Edge flips'
            })}</span>
              <span className={read.flips ? 'bld-readout-cells' : 'bld-readout-empty'}>
                {read.flips || (tr({ zh: '无', en: 'none'
                }))}
              </span>
            </div>
            <LetterReadout label={tr({ zh: '角块读码', en: 'Corners'
            })} cells={read.corners} />
            <div className="bld-readout">
              <span className="bld-readout-label">{tr({ zh: '角块翻色', en: 'Corner twists'
            })}</span>
              <span className={read.twists ? 'bld-readout-cells' : 'bld-readout-empty'}>
                {read.twists || (tr({ zh: '无', en: 'none'
                }))}
              </span>
            </div>
          </div>

          <div className="bld-helper-restore-head">
            <span className="bld-section-title">
              {tr({ zh: '请输入还原编码', en: 'Restore codes'
            })}
            </span>
            <span className="bld-helper-restore-hint">
              {tr({ zh: '(拖拽可交换执行顺序)', en: '(drag to reorder execution)'
            })}
            </span>
          </div>

          <ol className="bld-restore-list">
            {rowByOrder.map((row) => {
              const r = rowResults[row.id];
              return (
                <li
                  key={row.id}
                  className="bld-restore-row"
                  draggable
                  onDragStart={onDragStart(row.id)}
                  onDragOver={onDragOver}
                  onDrop={onDrop(row.id)}
                >
                  <span className="bld-restore-grip" aria-hidden="true">
                    <GripVertical size={14} />
                  </span>
                  <div className="bld-restore-main">
                    <label className="bld-restore-label" title={(isZh ? row.hintZh : row.hintEn)}>
                      {((i18n.language.startsWith('zh') ? row.zh : row.en))}
                    </label>
                    <div className="bld-input-wrap">
                      <input
                        className="bld-input bld-restore-input"
                        value={codes[row.id]}
                        onChange={(e) => setCode(row.id, e.target.value)}
                        placeholder={tr({ zh: '编码', en: 'codes'
                        })}
                        spellCheck={false}
                        autoCapitalize="characters"
                        autoComplete="off"
                      />
                      {codes[row.id] && (
                        <ClearButton isZh={isZh} onClick={() => setCode(row.id, '')} preserveFocus />
                      )}
                    </div>
                    {r && r.comms.length > 0 && (
                      <div className="bld-restore-comms">
                        {r.comms.map((c, ci) => (
                          <code key={ci} className="bld-comm">{c}</code>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {solving && (
            <span className="bld-spinner">
              <Loader2 size={15} />
              {tr({ zh: '推导还原…', en: 'Solving…'
            })}
            </span>
          )}
          {errors.map((msg, i) => (
            <p key={i} className="bld-modal-msg is-error">{msg}</p>
          ))}
        </section>

        {/* ── column 3: 3D cube + generate scramble ── */}
        <section className="bld-helper-col">
          <span className="bld-section-title">{tr({ zh: '3D 预览', en: '3D preview'
        })}</span>
          <div className="bld-cube-wrap">
            <TwistySection puzzle="3x3x3" scramble={setupAlg} alg={comms} />
          </div>

          <div className="bld-helper-gen">
            <div className="bld-helper-gen-actions">
              <button
                type="button"
                className="bld-btn bld-btn-primary"
                onClick={generateFromState}
                disabled={genBusy || scramble.length === 0}
              >
                {genBusy ? <Loader2 size={15} className="bld-inline-spin" /> : <Wand2 size={15} />}
                {tr({ zh: '生成当前状态打乱', en: 'Generate scramble from state'
                })}
              </button>
              {genScramble && (
                <button type="button" className="bld-copy-btn" onClick={copyGen}>
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? (tr({ zh: '已复制', en: 'Copied'
                })) : (tr({ zh: '复制', en: 'Copy'
                }))}
                </button>
              )}
            </div>
            {genScramble && (
              <div className="bld-scramble-item bld-helper-gen-out">
                <span className="bld-scramble-text">{genScramble}</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
