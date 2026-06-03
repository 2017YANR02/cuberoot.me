'use client';

// 翻棱公式训练 (flip) — faithful port of spooncuber flip.html + flip.js.
// Minimal trainer: enumerate non-buffer edge pairs, retry-until-exactly-2-flips
// state build (randomEdge1 + exCode), m2pSolve each, output scramble list.

import { useCallback, useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { BldConfigBar } from '../_components/BldConfigBar';
import { ScrambleOutput } from '../_components/ScrambleOutput';
import {
  useBldConfigStore,
  useBldConfigHydrated,
} from '../_store/bld-config-store';
import {
  exCode,
  randomEdge1,
  randomCorner,
  shuffle,
} from '../_lib/state-gen';
import { posChichu, eglobalState, globalState } from '../_lib/lettering';
import { m2pSolve, prewarm } from '../_lib/m2p-bridge';
import '../3bld.css';

// 12 non-buffer-default edge stickers, one per edge piece (upstream inputCodeStr).
const INPUT_CODE_STR = 'bdfhjlnprtxz';

export default function FlipTrainerPage(): JSX.Element {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('翻棱公式训练', 'Edge Flip Trainer');

  const hydrated = useBldConfigHydrated();
  const config = useBldConfigStore((s) => s.config);

  const [cornerScramble, setCornerScramble] = useState(false);
  const [scrambles, setScrambles] = useState<string[]>([]);
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    prewarm();
  }, []);

  const generate = useCallback(async () => {
    setBusy(true);
    setScrambles([]);
    setInfo('');

    // Upstream lowercases the edge-buffer select value.
    const eBuffer = config.eBuf.toLowerCase();
    const bufPos = posChichu(eBuffer);

    // Enumerate distinct-piece edge pairs (verbatim nested loop).
    const inputCodeList: [string, string][] = [];
    for (let m = 0; m < INPUT_CODE_STR.length; m++) {
      for (let n = 0; n < m; n++) {
        if (posChichu(INPUT_CODE_STR[m]) !== posChichu(INPUT_CODE_STR[n])) {
          inputCodeList.push([INPUT_CODE_STR[m], INPUT_CODE_STR[n]]);
        }
      }
    }

    const shuffled = shuffle(inputCodeList);
    const out: string[] = [];

    for (let i = 0; i < shuffled.length; i++) {
      const pair = shuffled[i];
      // Skip pairs touching the buffer piece.
      if (posChichu(pair[0]) === bufPos || posChichu(pair[1]) === bufPos) {
        continue;
      }

      let flipnum = 0;
      let eState = '';
      // Retry until exactly two flipped edges outside the buffer result.
      while (flipnum !== 2) {
        const cState = cornerScramble ? randomCorner(0) : globalState;
        eState = randomEdge1(0, pair, cState);
        eState = exCode([eBuffer, pair[0]], eState);
        eState = exCode([eBuffer, eglobalState[2 * posChichu(pair[0])]], eState);
        eState = exCode([eBuffer, pair[1]], eState);
        eState = exCode([eBuffer, eglobalState[2 * posChichu(pair[1])]], eState);

        flipnum = 0;
        for (let j = 0; j < 24; j += 2) {
          if (posChichu(eState[24 + j]) === posChichu(eglobalState[j])) {
            flipnum += 1;
          }
        }
      }

      const scr = await m2pSolve(eState);
      out.push(scr);
      // Stream partial output so the list fills in as solves complete.
      setScrambles([...out]);
    }

    setScrambles(out);
    setInfo(
      isZh
        ? `随机生成 ${out.length} 条打乱，遍历缓冲外存在两个翻棱的情况。`
        : `Generated ${out.length} scrambles, covering every pair of flipped edges outside the buffer.`,
    );
    setBusy(false);
  }, [config.eBuf, cornerScramble, isZh]);

  if (!hydrated) return <div className="bld-trainer-root" />;

  return (
    <div className="bld-trainer-root">
      <div className="bld-topbar">
        <h1>{isZh ? '翻棱公式训练' : 'Edge Flip Trainer'}</h1>
      </div>

      <div className="bld-section">
        <BldConfigBar show={{ corner: false, scheme: false, orientation: false, hueSkip: false }} />
      </div>

      <div className="bld-section">
        <div className="bld-check-row">
          <label className="bld-check">
            <input
              type="checkbox"
              checked={cornerScramble}
              onChange={(e) => setCornerScramble(e.target.checked)}
            />
            {isZh ? '打乱角块' : 'Scramble corners'}
          </label>
        </div>
      </div>

      <div className="bld-section">
        <button
          type="button"
          className="bld-btn bld-btn-primary"
          onClick={generate}
          disabled={busy}
        >
          <Play size={15} />
          {isZh ? '生成翻棱训练' : 'Generate flip training'}
        </button>
      </div>

      <div className="bld-section">
        <ScrambleOutput scrambles={scrambles} info={info || undefined} busy={busy} />
      </div>
    </div>
  );
}
