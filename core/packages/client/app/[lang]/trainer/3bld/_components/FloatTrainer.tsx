'use client';

// Shared edge/corner FLOAT trainer — faithful port of spooncuber
// edgefloat.html+edgefloat.js and cornerfloat.html+cornerfloat.js
// (structurally identical; only piece type / casing / loop bounds / the
// opposite-piece parity helpers differ).
//
// Two modes, dispatched on the 浮动顺序 (float order) input:
//   normalfloat (浮动顺序 non-empty): main(codes[1]) + sub(codes[0]) buffer alg
//     sets, both = algSetGenerator(floatOrder + ejectPos) shuffled; up to 10000
//     iterations greedily packing non-colliding training codes into each
//     scramble, with parity options; stops once the main set is exhausted.
//   ejectfloat (浮动顺序 empty): eject mode, 500 scrambles via randomEdge1 /
//     randomCorner1 over the eject positions + mergeState with the opposite
//     piece's parity state.
//
// Only edge-float exposes the timer handoff (per upstream — cornerfloat.html has
// no #jumpBtn / #gotoTimer). The handoff writes the (optionally percentage-
// padded + shuffled) scramble list to localStorage and links to the timer page.

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type JSX,
} from 'react';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { Play, Timer, X } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ClearButton } from '@/components/ClearButton';
import { BldConfigBar } from './BldConfigBar';
import { ScrambleOutput } from './ScrambleOutput';
import { useBldConfigHydrated } from '../_store/bld-config-store';
import {
  algSetGenerator,
  codeTrans,
  randomEdge,
  randomEdge1,
  randomCorner,
  randomCorner1,
  mergeState,
  shuffle,
  posChichu,
  globalState,
} from '../_lib/state-gen';
import { m2pSolve, prewarm } from '../_lib/m2p-bridge';
import '../3bld.css';
import { tr } from '@/i18n/tr';

export type FloatPiece = 'edge' | 'corner';

interface FloatTrainerProps {
  piece: FloatPiece;
}

// localStorage key the timer page reads. Upstream used 'scrListString'; we use a
// descriptive key (and store a real string[] JSON, not the HTML innerHTML hack).
export const BLD_TIMER_SCRAMBLES_KEY = 'bld-timer-scrambles';

type ParityMode = 0 | 1 | 2;

// Resolve the parity select value to a concrete 0/1 (mode 2 = random per draw).
function resolveParity(mode: ParityMode): 0 | 1 {
  switch (mode) {
    case 0:
      return 0;
    case 1:
      return 1;
    default:
      return (Math.trunc(Math.random() * 2) as 0 | 1);
  }
}

export function FloatTrainer({ piece }: FloatTrainerProps): JSX.Element {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const isEdge = piece === 'edge';

  useDocumentTitle(
    isEdge ? '棱块浮动训练' : '角块浮动训练',
    isEdge ? 'Edge Float Trainer' : 'Corner Float Trainer',
  );

  const hydrated = useBldConfigHydrated();

  // Upstream defaults: edge AE / G, corner GD / J.
  const [floatOrder, setFloatOrder] = useState(isEdge ? 'AE' : 'GD');
  const [ejectPos, setEjectPos] = useState(isEdge ? 'G' : 'J');
  // Opposite-piece scramble: edge page = "打乱角块"; corner page = "打乱棱块".
  const [oppScramble, setOppScramble] = useState(false);
  const [parityMode, setParityMode] = useState<ParityMode>(0);

  const [scrambles, setScrambles] = useState<string[]>([]);
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  // Timer handoff popup (edge only).
  const [jumpOpen, setJumpOpen] = useState(false);
  const [percent, setPercent] = useState(100);
  const [jumpCorner, setJumpCorner] = useState(false);
  const [jumpEdge, setJumpEdge] = useState(true);
  const [jumpParity, setJumpParity] = useState<ParityMode>(0);

  useEffect(() => {
    prewarm();
  }, []);

  // ── normalfloat ──────────────────────────────────────────────────────────
  const normalfloat = useCallback(async (): Promise<string[]> => {
    // Upstream splits the float order to a char array and concatenates with the
    // eject string; algSetGenerator works on the resulting string verbatim.
    const bufferList = (isEdge ? floatOrder.toLowerCase() : floatOrder.toUpperCase()).split('');
    const ejectList = (isEdge ? ejectPos.toLowerCase() : ejectPos.toUpperCase()).split('');

    // Both worklists start as a shuffled copy of the full alg set.
    // Upstream passes `Array.from(bufferList + ejectList)` where `+` coerces the
    // arrays to comma-joined strings; replicate that coercion char-for-char.
    const coerced = Array.from(String(bufferList) + String(ejectList));
    const algAllList1: string[][] = [shuffle(algSetGenerator(coerced))];
    const algAllList0: string[][] = [shuffle(algSetGenerator(Array.from(String(bufferList) + String(ejectList))))];

    const out: string[] = [];
    let times = 0;

    for (let i = 0; i < 10000; i++) {
      const parity = resolveParity(parityMode);

      let state: string = globalState;
      if (oppScramble) {
        // edge page scrambles corners; corner page scrambles edges.
        state = isEdge ? randomCorner(parity) : randomEdge(parity);
      } else if (parity) {
        // bare opposite-piece swap installing the parity.
        state = codeTrans(isEdge ? 'JG' : 'ag', state);
      }

      const pos: number[] = [];
      const listtemp = bufferList.concat(ejectList);
      for (let k = 0; k < listtemp.length; k++) {
        pos.push(posChichu(String(listtemp[k])));
      }

      const codes = Array.from(bufferList); // codes[0] = sub buffer, codes[1] = main buffer

      // ── main-buffer fill (codes[1]) ──
      const mainBound = isEdge
        ? Math.trunc(Math.random() * (6 - Math.floor((ejectList.length + 1) / 2) - parity))
        : Math.trunc(Math.random() * (4 - Math.floor((ejectList.length + 1)) / 2 - parity));
      for (let j = 0; j < mainBound; j++) {
        let breakFlag = 0;
        for (let m = 0; m < algAllList1.length; m++) {
          for (let n = 0; n < algAllList1[m].length; n++) {
            const code = algAllList1[m][n];
            if (pos.indexOf(posChichu(code[0])) === -1 && pos.indexOf(posChichu(code[1])) === -1) {
              pos.push(posChichu(code[0]));
              pos.push(posChichu(code[1]));
              codes[1] += code;
              if (algAllList1.length === m + 1) algAllList1.push([]);
              algAllList1[m + 1].push(code);
              algAllList1[m].splice(algAllList1[m].indexOf(code), 1);
              breakFlag = 1;
              break;
            }
          }
          if (breakFlag === 1) break;
        }
      }

      // ── sub-buffer fill (codes[0]) ──
      const subBound = isEdge
        ? (11 - ejectList.length - codes[1].length) / 2 - parity
        : (7 - ejectList.length - codes[1].length) / 2 - parity;
      for (let j = 0; j < subBound; j++) {
        let breakFlag = 0;
        for (let m = 0; m < algAllList0.length; m++) {
          for (let n = 0; n < algAllList0[m].length; n++) {
            const code = algAllList0[m][n];
            if (pos.indexOf(posChichu(code[0])) === -1 && pos.indexOf(posChichu(code[1])) === -1) {
              pos.push(posChichu(code[0]));
              pos.push(posChichu(code[1]));
              codes[0] += code;
              if (algAllList0.length === m + 1) algAllList0.push([]);
              algAllList0[m + 1].push(code);
              algAllList0[m].splice(algAllList0[m].indexOf(code), 1);
              breakFlag = 1;
              break;
            }
          }
          if (breakFlag === 1) break;
        }
      }

      // ── parity-target injection ──
      if (parity === 1) {
        if (isEdge) {
          const allpos = Array.from({ length: 11 }, (_, k) => k + 1);
          const otherpos = allpos.filter((item) => !pos.includes(item));
          const choosepos = otherpos[Math.trunc(Math.random() * otherpos.length)];
          const paritycode = globalState[24 + choosepos * 2 + Math.trunc(Math.random() * 2)];
          codes[Math.trunc(Math.random() * 2)] += paritycode;
        } else {
          const allpos = Array.from({ length: 7 }, (_, k) => k + 1);
          const otherpos = allpos.filter((item) => !pos.includes(item));
          const choosepos = otherpos[Math.trunc(Math.random() * otherpos.length)];
          const paritycode = globalState[choosepos * 3 + Math.trunc(Math.random() * 3)];
          codes[Math.trunc(Math.random() * 2)] += paritycode;
        }
      }

      state = codeTrans(codes[1], state);
      state = codeTrans(codes[0], state);
      const scr = await m2pSolve(state);
      out.push(scr);
      setScrambles([...out]);
      times += 1;
      if (algAllList1[0].length === 0) break;
    }

    setInfo(
      (isZh
                ? `已生成遍历副缓冲 ${String(bufferList[1] ?? '').toUpperCase()} 全部公式的 ${times} 条打乱。`
                : `Generated ${times} scrambles covering every alg of sub-buffer ${String(bufferList[1] ?? '').toUpperCase()}.`),
    );
    return out;
  }, [isEdge, floatOrder, ejectPos, oppScramble, parityMode, isZh]);

  // ── ejectfloat ───────────────────────────────────────────────────────────
  const ejectfloat = useCallback(async (): Promise<string[]> => {
    const ejectList = (isEdge ? ejectPos.toLowerCase() : ejectPos.toUpperCase()).split('');
    const out: string[] = [];

    for (let i = 0; i < 500; i++) {
      const parity = resolveParity(parityMode);

      if (isEdge) {
        // state1 = corners (opposite piece), state2 = edges via randomEdge1.
        let state1: string = globalState;
        if (oppScramble) state1 = randomCorner(parity);
        else if (parity) state1 = codeTrans('JG', state1);
        const state2 = randomEdge1(parity, ejectList, globalState);
        const state = mergeState(state1, state2);
        out.push(await m2pSolve(state));
      } else {
        // state1 = edges (opposite piece), state2 = corners via randomCorner1.
        let state1: string = globalState;
        if (oppScramble) state1 = randomEdge(parity);
        else if (parity) state1 = codeTrans('ag', state1);
        const state2 = randomCorner1(parity, ejectList, globalState);
        const state = mergeState(state2, state1);
        out.push(await m2pSolve(state));
      }
      setScrambles([...out]);
    }

    setInfo(
      tr({ zh: '已生成排除模式的 500 条打乱。', en: 'Generated 500 eject-mode scrambles.'
    }),
    );
    return out;
  }, [isEdge, ejectPos, oppScramble, parityMode, isZh]);

  const generate = useCallback(async () => {
    setBusy(true);
    setScrambles([]);
    setInfo('');
    try {
      if (floatOrder.trim() === '') {
        await ejectfloat();
      } else {
        await normalfloat();
      }
    } finally {
      setBusy(false);
    }
  }, [floatOrder, ejectfloat, normalfloat]);

  // ── timer handoff (edge only) ─────────────────────────────────────────────
  const openJump = useCallback(() => {
    setPercent(100);
    setJumpCorner(oppScramble);
    setJumpEdge(true);
    setJumpParity(parityMode);
    setJumpOpen(true);
  }, [oppScramble, parityMode]);

  // Build the final scramble list: pad with `otherNum` non-training-set scrambles
  // so the training set is `percent`% of the total, then shuffle. Verbatim
  // edgefloat.js #gotoTimer handler. Writes to localStorage; caller navigates.
  const buildAndStoreTimerList = useCallback(async (): Promise<number> => {
    const perc = percent;
    const otherNum = perc > 0 ? Math.trunc((scrambles.length / perc) * (100 - perc)) : 0;
    const padded = [...scrambles];

    for (let i = 0; i < otherNum; i++) {
      const parity = resolveParity(jumpParity);
      let state1: string = globalState;
      if (jumpCorner) state1 = randomCorner(parity);
      else if (parity) state1 = codeTrans('JG', state1);
      let state2: string = globalState;
      if (jumpEdge) state2 = randomEdge(parity);
      else if (parity) state2 = codeTrans('ag', state2);
      const state = mergeState(state1, state2);
      padded.push(await m2pSolve(state));
    }

    const finalList = shuffle(padded);
    localStorage.setItem(BLD_TIMER_SCRAMBLES_KEY, JSON.stringify(finalList));
    return finalList.length;
  }, [percent, scrambles, jumpParity, jumpCorner, jumpEdge]);

  const [navReady, setNavReady] = useState(false);
  const confirmJump = useCallback(async () => {
    setBusy(true);
    try {
      await buildAndStoreTimerList();
      setJumpOpen(false);
      setNavReady(true);
    } finally {
      setBusy(false);
    }
  }, [buildAndStoreTimerList]);

  const title = useMemo(
    () =>
      isEdge
        ? { zh: '棱块浮动训练', en: 'Edge Float Trainer'
        }
        : { zh: '角块浮动训练', en: 'Corner Float Trainer'
        },
    [isEdge],
  );

  if (!hydrated) return <div className="bld-trainer-root" />;

  const orderLabel = tr({ zh: '浮动顺序', en: 'Float order'
});
  const ejectLabel = tr({ zh: '排除位置', en: 'Eject positions' });

  return (
    <div className="bld-trainer-root">
      <div className="bld-topbar">
        <h1>{tr(title)}</h1>
      </div>

      <div className="bld-section">
        <BldConfigBar show={isEdge ? { corner: false } : { edge: false }} />
      </div>

      <div className="bld-section">
        <div className="bld-field" style={{ maxWidth: 240 }}>
          <label className="bld-field-label" htmlFor="bld-floatorder">{orderLabel}</label>
          <div className="bld-input-wrap">
            <input
              id="bld-floatorder"
              className="bld-input"
              value={floatOrder}
              maxLength={2}
              onChange={(e) => setFloatOrder(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              spellCheck={false}
              autoCapitalize="characters"
              style={{ textAlign: 'center' }}
            />
            {floatOrder && (
              <ClearButton isZh={isZh} onClick={() => setFloatOrder('')} preserveFocus />
            )}
          </div>
        </div>

        <div className="bld-field" style={{ maxWidth: 240, marginTop: 12 }}>
          <label className="bld-field-label" htmlFor="bld-ejectpos">{ejectLabel}</label>
          <div className="bld-input-wrap">
            <input
              id="bld-ejectpos"
              className="bld-input"
              value={ejectPos}
              maxLength={isEdge ? 9 : 5}
              onChange={(e) => setEjectPos(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              spellCheck={false}
              autoCapitalize="characters"
              style={{ textAlign: 'center' }}
            />
            {ejectPos && (
              <ClearButton isZh={isZh} onClick={() => setEjectPos('')} preserveFocus />
            )}
          </div>
        </div>

        <div className="bld-field" style={{ maxWidth: 240, marginTop: 12 }}>
          <label className="bld-field-label" htmlFor="bld-parity">{tr({ zh: '奇偶状态', en: 'Parity'
        })}</label>
          <select
            id="bld-parity"
            className="bld-select"
            value={parityMode}
            onChange={(e) => setParityMode(Number(e.target.value) as ParityMode)}
          >
            <option value={0}>{tr({ zh: '无奇偶', en: 'No parity'
            })}</option>
            <option value={1}>{tr({ zh: '有奇偶', en: 'With parity' })}</option>
            <option value={2}>{tr({ zh: '随机', en: 'Random'
            })}</option>
          </select>
        </div>

        <div className="bld-options" style={{ marginTop: 14, marginBottom: 0 }}>
          <label className="bld-check">
            <input
              type="checkbox"
              checked={oppScramble}
              onChange={(e) => setOppScramble(e.target.checked)}
            />
            {isEdge
              ? tr({ zh: '打乱角块', en: 'Scramble corners'
            })
              : tr({ zh: '打乱棱块', en: 'Scramble edges'
            })}
          </label>
        </div>
        <p className="bld-input-summary" style={{ marginTop: 8, marginBottom: 0 }}>
          {floatOrder.trim() === ''
            ? tr({ zh: '浮动顺序留空 = 排除模式（生成 500 条打乱）。', en: 'Empty float order = eject mode (500 scrambles).'
                                  })
            : tr({ zh: '浮动顺序非空 = 正常浮动（遍历副缓冲全部公式）。', en: 'Non-empty float order = normal float (covers every sub-buffer alg).'
                                  })}
        </p>
      </div>

      <div className="bld-section">
        <div className="bld-generate-row" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className="bld-btn bld-btn-primary"
            onClick={() => void generate()}
            disabled={busy}
          >
            <Play size={15} />
            {tr({ zh: '生成浮动训练', en: 'Generate float training'
            })}
          </button>

          {isEdge && (
            <button
              type="button"
              className="bld-btn"
              onClick={openJump}
              disabled={busy || scrambles.length === 0}
            >
              <Timer size={15} />
              {tr({ zh: '练习计时', en: 'Practice timer'
            })}
            </button>
          )}

          {isEdge && navReady && (
            <Link
              href="/trainer/3bld/timer"
              className="bld-btn bld-btn-primary"
            >
              <Timer size={15} />
              {tr({ zh: '打开计时器', en: 'Open timer'
            })}
            </Link>
          )}
        </div>
      </div>

      <div className="bld-section">
        <ScrambleOutput scrambles={scrambles} info={info || undefined} busy={busy} />
      </div>

      {/* timer handoff popup (edge only) */}
      {isEdge && jumpOpen && (
        <div
          className="bld-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setJumpOpen(false);
          }}
        >
          <div className="bld-modal" role="dialog" aria-modal="true">
            <div className="bld-modal-header">
              <h3 className="bld-modal-title">{tr({ zh: '练习计时', en: 'Practice timer'
            })}</h3>
              <button
                type="button"
                className="bld-modal-close"
                onClick={() => setJumpOpen(false)}
                aria-label={tr({ zh: '关闭', en: 'Close'
                })}
              >
                <X size={18} />
              </button>
            </div>

            <div className="bld-field">
              <label className="bld-field-label" htmlFor="bld-percent">
                {tr({ zh: '训练集公式占比', en: 'Training-set ratio'
                })}: {percent}%
              </label>
              <input
                id="bld-percent"
                type="range"
                min={20}
                max={100}
                step={5}
                value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
              />
            </div>

            <div className="bld-options" style={{ marginBottom: 4 }}>
              <label className="bld-check">
                <input type="checkbox" checked={jumpCorner} onChange={(e) => setJumpCorner(e.target.checked)} />
                {tr({ zh: '其他打乱含角块', en: 'Pad scrambles include corners'
                })}
              </label>
              <label className="bld-check">
                <input type="checkbox" checked={jumpEdge} onChange={(e) => setJumpEdge(e.target.checked)} />
                {tr({ zh: '其他打乱含棱块', en: 'Pad scrambles include edges'
                })}
              </label>
            </div>

            <div className="bld-field" style={{ maxWidth: 220 }}>
              <label className="bld-field-label" htmlFor="bld-jumpparity">{tr({ zh: '奇偶状态', en: 'Parity'
            })}</label>
              <select
                id="bld-jumpparity"
                className="bld-select"
                value={jumpParity}
                onChange={(e) => setJumpParity(Number(e.target.value) as ParityMode)}
              >
                <option value={0}>{tr({ zh: '无奇偶', en: 'No parity'
                })}</option>
                <option value={1}>{tr({ zh: '有奇偶', en: 'With parity' })}</option>
                <option value={2}>{tr({ zh: '随机', en: 'Random'
                })}</option>
              </select>
            </div>

            <div className="bld-modal-actions">
              <button type="button" className="bld-btn" onClick={() => setJumpOpen(false)}>
                {tr({ zh: '取消', en: 'Cancel' })}
              </button>
              <button
                type="button"
                className="bld-btn bld-btn-primary"
                onClick={() => void confirmJump()}
                disabled={busy}
              >
                <Timer size={15} />
                {tr({ zh: '生成并进入计时器', en: 'Build & go to timer'
                })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
