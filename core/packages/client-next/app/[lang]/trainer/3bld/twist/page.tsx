'use client';

// 翻角公式训练 (twist) — ported from spooncuber twist.html + twist.js.
// Checkbox-driven combinatorial generator: enumerate non-buffer corner pairs,
// classify by position (top/bottom/mixed) + orientation parity (2-twist vs
// 3-twist), retry-until-exactly-2-twists state build, then m2pSolve each.

import { useEffect, useState, useCallback, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Wand2 } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { BldConfigBar } from '../_components/BldConfigBar';
import { ScrambleOutput } from '../_components/ScrambleOutput';
import {
  useBldConfigStore,
  useBldConfigHydrated,
} from '../_store/bld-config-store';
import {
  posChichu,
  globalState,
} from '../_lib/lettering';
import {
  exCode,
  randomEdge,
  randomCorner1,
  shuffle,
} from '../_lib/state-gen';
import { m2pSolve, prewarm } from '../_lib/m2p-bridge';
import '../3bld.css';
import { tr } from '@/i18n/tr';

// Upstream twist.js: 16 corner stickers (8 top-layer + 8 bottom-layer) used to
// enumerate twist pairs. Index < 8 = top layer, >= 8 = bottom layer.
const INPUT_CODE_STR = 'BCEFHIKLMNPQSTYZ';

interface TwistOptions {
  edgescramble: boolean;
  twotwist: boolean; // 缓冲外二角翻
  threetwist: boolean; // 带缓冲三角翻
  allup: boolean; // 纯顶层
  alldown: boolean; // 纯底层
  updown: boolean; // 顶层 + 底层
}

const DEFAULT_OPTIONS: TwistOptions = {
  edgescramble: false,
  twotwist: true,
  threetwist: true,
  allup: true,
  alldown: true,
  updown: true,
};

export default function TwistTrainerPage(): JSX.Element {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('翻角公式训练', 'Corner Twist Trainer');

  const hydrated = useBldConfigHydrated();
  const config = useBldConfigStore((s) => s.config);

  const [opts, setOpts] = useState<TwistOptions>(DEFAULT_OPTIONS);
  const [scrambles, setScrambles] = useState<string[]>([]);
  const [info, setInfo] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');

  // m2pSolve is async (WASM Kociemba) — warm it up on mount.
  useEffect(() => {
    prewarm();
  }, []);

  const setOpt = (k: keyof TwistOptions, v: boolean) =>
    setOpts((o) => ({ ...o, [k]: v }));

  const generate = useCallback(async () => {
    const cBuffer = config.cBuf.toUpperCase();
    const { edgescramble, twotwist, threetwist, allup, alldown, updown } = opts;

    if (!twotwist && !threetwist) {
      setError(tr({ zh: '请至少勾选一类方向状态', en: 'Select at least one orientation class',
          zhHant: "請至少勾選一類方向狀態"
    }));
      return;
    }
    if (!allup && !alldown && !updown) {
      setError(tr({ zh: '请至少勾选一类位置状态', en: 'Select at least one position class',
          zhHant: "請至少勾選一類位置狀態"
    }));
      return;
    }
    setError('');
    setBusy(true);
    setScrambles([]);
    setInfo('');

    // Yield so the busy spinner paints before the (potentially heavy) WASM run.
    await new Promise((r) => setTimeout(r, 0));

    // 1) Enumerate candidate twist pairs (verbatim twist.js classification).
    let inputCodeList: Array<[string, string]> = [];
    for (let m = 0; m < INPUT_CODE_STR.length; m++) {
      for (let n = 0; n < m; n++) {
        if (posChichu(INPUT_CODE_STR[m]) === posChichu(INPUT_CODE_STR[n])) continue;
        const pair: [string, string] = [INPUT_CODE_STR[m], INPUT_CODE_STR[n]];
        const three = threetwist && (m + n) % 2 === 0;
        const two = twotwist && (m + n) % 2 === 1;
        const pass = three || two;
        if (!pass) continue;
        if (m < 8 && n < 8) {
          if (allup) inputCodeList.push(pair);
        } else if (m >= 8 && n >= 8) {
          if (alldown) inputCodeList.push(pair);
        } else {
          if (updown) inputCodeList.push(pair);
        }
      }
    }

    inputCodeList = shuffle(Array.from(inputCodeList));

    // 2) Build a 2-twist corner state per pair, solve.
    const out: string[] = [];
    for (let i = 0; i < inputCodeList.length; i++) {
      const pair = inputCodeList[i];
      if (posChichu(pair[0]) === posChichu(cBuffer) || posChichu(pair[1]) === posChichu(cBuffer)) {
        continue;
      }

      let twistnum = 0;
      let cState = globalState;
      // Retry until the scramble has exactly two corners twisted-in-place
      // outside the buffer.
      while (twistnum !== 2) {
        const eState = edgescramble ? randomEdge(0) : globalState;
        cState = randomCorner1(0, pair, eState);
        cState = exCode([cBuffer, pair[0]], cState);
        cState = exCode([cBuffer, globalState[3 * posChichu(pair[0])]], cState);
        cState = exCode([cBuffer, pair[1]], cState);
        cState = exCode([cBuffer, globalState[3 * posChichu(pair[1])]], cState);

        twistnum = 0;
        for (let j = 0; j < 24; j += 3) {
          if (posChichu(cState[j]) === posChichu(globalState[j])) {
            twistnum += 1;
          }
        }
      }

      // eslint-disable-next-line no-await-in-loop
      const scr = await m2pSolve(cState);
      out.push(scr);
    }

    setScrambles(out);
    setInfo(
      isZh
        ? `随机生成 ${out.length} 条打乱，遍历缓冲外存在两个翻角的情况。`
        : `Generated ${out.length} scrambles, enumerating two-corner-twist cases outside the buffer.`,
    );
    setBusy(false);
  }, [config.cBuf, opts, isZh]);

  // Gate on hydration so the persisted corner buffer renders consistently.
  if (!hydrated) return <div className="bld-trainer-root" />;

  return (
    <div className="bld-trainer-root">
      <div className="bld-topbar">
        <h1>{tr({ zh: '翻角公式训练', en: 'Corner Twist Trainer',
            zhHant: "翻角公式訓練"
        })}</h1>
      </div>

      <BldConfigBar show={{ corner: true, edge: false, scheme: false, orientation: false, hueSkip: false }} />

      <section className="bld-section">
        <div className="bld-config-group">
          <span className="bld-config-group-title">{tr({ zh: '方向分类', en: 'Orientation class',
              zhHant: "方向分類"
        })}</span>
          <div className="bld-check-row">
            <label className="bld-check">
              <input
                type="checkbox"
                checked={opts.twotwist}
                onChange={(e) => setOpt('twotwist', e.target.checked)}
              />
              {tr({ zh: '缓冲外二角翻', en: '2 corners twisted (no buffer)',
                  zhHant: "緩衝外二角翻"
            })}
            </label>
            <label className="bld-check">
              <input
                type="checkbox"
                checked={opts.threetwist}
                onChange={(e) => setOpt('threetwist', e.target.checked)}
              />
              {tr({ zh: '带缓冲三角翻', en: '3 corners twisted (with buffer)',
                  zhHant: "帶緩衝三角翻"
            })}
            </label>
          </div>
        </div>

        <div className="bld-config-group">
          <span className="bld-config-group-title">{tr({ zh: '位置分类', en: 'Position class',
              zhHant: "位置分類"
        })}</span>
          <div className="bld-check-row">
            <label className="bld-check">
              <input
                type="checkbox"
                checked={opts.allup}
                onChange={(e) => setOpt('allup', e.target.checked)}
              />
              {tr({ zh: '纯顶层', en: 'Top layer only',
                  zhHant: "純頂層"
            })}
            </label>
            <label className="bld-check">
              <input
                type="checkbox"
                checked={opts.alldown}
                onChange={(e) => setOpt('alldown', e.target.checked)}
              />
              {tr({ zh: '纯底层', en: 'Bottom layer only',
                  zhHant: "純底層"
            })}
            </label>
            <label className="bld-check">
              <input
                type="checkbox"
                checked={opts.updown}
                onChange={(e) => setOpt('updown', e.target.checked)}
              />
              {tr({ zh: '顶层 + 底层', en: 'Top + bottom',
                  zhHant: "頂層 + 底層"
            })}
            </label>
          </div>
        </div>

        <div className="bld-config-group">
          <span className="bld-config-group-title">{tr({ zh: '其他', en: 'Other' })}</span>
          <div className="bld-check-row">
            <label className="bld-check">
              <input
                type="checkbox"
                checked={opts.edgescramble}
                onChange={(e) => setOpt('edgescramble', e.target.checked)}
              />
              {tr({ zh: '打乱棱块', en: 'Scramble edges',
                  zhHant: "打亂稜塊"
            })}
            </label>
          </div>
        </div>

        <button
          type="button"
          className="bld-btn bld-btn-primary"
          onClick={generate}
          disabled={busy}
          style={{ marginTop: 6 }}
        >
          <Wand2 size={15} />
          {tr({ zh: '生成翻角训练', en: 'Generate twist scrambles',
              zhHant: "生成翻角訓練"
        })}
        </button>

        {error && (
          <p className="bld-modal-msg is-error" style={{ marginTop: 10 }}>{error}</p>
        )}
      </section>

      <ScrambleOutput scrambles={scrambles} info={info || undefined} busy={busy} />
    </div>
  );
}
