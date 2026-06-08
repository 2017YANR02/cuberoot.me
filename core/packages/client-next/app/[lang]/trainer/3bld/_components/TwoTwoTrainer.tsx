'use client';

// Shared 2C2C / 2E2E trainer. Faithful port of spooncuber 2C2C.js
// twoCornerGenerator() / 2E2E.js twoEdgeGenerator() — the two are structurally
// identical, differing only in piece type, buffer source, the orientation count
// (corner 3 / edge 2), the fill stride and the twist/flip wording. Parameterized
// here so 2c2c/page.tsx and 2e2e/page.tsx are thin wrappers.

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Play, X } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { BldConfigBar } from './BldConfigBar';
import { ScrambleOutput } from './ScrambleOutput';
import { MatrixSelect } from './MatrixSelect';
import { useBldConfigStore, useBldConfigHydrated } from '../_store/bld-config-store';
import {
  algSetGenerator,
  codeTrans,
  posChichu,
  randomEdge,
  randomCorner,
  globalState,
  shuffle,
} from '../_lib/state-gen';
import { m2pSolve, prewarm } from '../_lib/m2p-bridge';
import '../3bld.css';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

type Piece = 'corner' | 'edge';

interface TwoTwoTrainerProps {
  piece: Piece;
}

// Per-piece constants matching upstream.
const SPEC = {
  corner: {
    titleZh: '2C2C 训练',
    titleEn: '2C2C Trainer',
    count: 8, // 8 corner positions
    div: 3, // 3 orientations per corner
    indexBase: 0, // corner stickers start at globalState[0]
    twiststateZh: '是否带翻',
    twiststateEn: 'Include twists',
    otherScrambleZh: '打乱棱块',
    otherScrambleEn: 'Scramble edges',
    caseLabel: '2C2C',
      titleZhHant: "2C2C 訓練",
      twiststateZhHant: "是否帶翻",
      otherScrambleZhHant: "打亂稜塊"
},
  edge: {
    titleZh: '2E2E 训练',
    titleEn: '2E2E Trainer',
    count: 12, // 12 edge positions
    div: 2, // 2 orientations per edge
    indexBase: 24, // edge stickers start at globalState[24]
    twiststateZh: '是否带翻',
    twiststateEn: 'Include flips',
    otherScrambleZh: '打乱角块',
    otherScrambleEn: 'Scramble corners',
    caseLabel: '2E2E',
      titleZhHant: "2E2E 訓練",
      twiststateZhHant: "是否帶翻",
      otherScrambleZhHant: "打亂角塊"
},
} as const;

export function TwoTwoTrainer({ piece }: TwoTwoTrainerProps): JSX.Element | null {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const spec = SPEC[piece];
  useDocumentTitle(spec.titleZh, spec.titleEn);

  const hydrated = useBldConfigHydrated();
  const config = useBldConfigStore((s) => s.config);

  const [picked, setPicked] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);

  const [otherScramble, setOtherScramble] = useState(false);
  const [twist, setTwist] = useState(false);
  const [excludeTop, setExcludeTop] = useState(false);

  const [scrambles, setScrambles] = useState<string[]>([]);
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    prewarm();
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  // Buffer: corner reads cBuf (upper), edge reads eBuf (lower) — matching upstream
  // .toUpperCase()/.toLowerCase() before all the posChichu/globalState lookups.
  const buffer = useMemo(
    () => (piece === 'corner' ? config.cBuf.toUpperCase() : config.eBuf.toLowerCase()),
    [piece, config.cBuf, config.eBuf],
  );

  // Matrix codes are emitted uppercase; lowercase them for edge math (upstream
  // input() stores inputcode[i].toLowerCase() for edges).
  const usableCodes = useMemo(() => {
    const norm = picked.map((c) => (piece === 'corner' ? c : c.toLowerCase()));
    return norm.filter((c) => posChichu(c) !== posChichu(buffer));
  }, [picked, piece, buffer]);

  const openModal = () => {
    setDraft(picked);
    setModalOpen(true);
  };
  const confirmModal = () => {
    setPicked(draft);
    setModalOpen(false);
  };

  const generate = async () => {
    if (busy) return;
    const codes = usableCodes;
    if (codes.length === 0) {
      setInfo(tr({ zh: '请至少选择 1 个编码', en: 'Select at least one code',
          zhHant: "請至少選擇 1 個編碼"
    }));
      return;
    }
    setBusy(true);
    setScrambles([]);
    setInfo('');
    await new Promise((r) => setTimeout(r, 0));

    try {
      const { count, div, indexBase } = spec;
      const inputcode = shuffle(Array.from(codes));
      let times = 0;
      const states: string[] = [];

      for (let i = 0; i < inputcode.length; i++) {
        const temparr: string[] = [buffer, inputcode[i]];

        if (excludeTop) {
          // Verbatim upstream quirk: poslist mixes a number with the raw code
          // letter; only the number (posChichu(buffer)) can exclude a position.
          const poslist: (number | string)[] = [posChichu(buffer), inputcode[i]];
          const allpos = Array.from({ length: 4 }, (_, k) => k);
          const otherpos = allpos.filter((item) => !poslist.includes(item));
          for (let x = 0; x < otherpos.length; x++) {
            temparr.push(globalState[indexBase + div * otherpos[x]]);
          }
        }

        let algSet = algSetGenerator(temparr);
        algSet = algSet.filter((pair) => posChichu(pair[0]) < posChichu(pair[1]));

        if (!twist) {
          // corner stride 3 (45 cases) / edge stride 2 keeps the unoriented case.
          const cut: string[] = [];
          for (let x = 0; x < algSet.length; x += div) cut.push(algSet[x]);
          algSet = cut;
        }
        algSet = shuffle(Array.from(algSet));

        for (let j = 0; j < algSet.length; j++) {
          let codelist = buffer;
          const poslist: number[] = [];

          const otherState = otherScramble
            ? piece === 'corner'
              ? randomEdge(0)
              : randomCorner(0)
            : globalState;

          poslist.push(posChichu(buffer));
          poslist.push(posChichu(inputcode[i]));
          poslist.push(posChichu(algSet[j][0]));
          poslist.push(posChichu(algSet[j][1]));

          const allpos = Array.from({ length: count }, (_, k) => k);
          let otherpos = allpos.filter((item) => !poslist.includes(item));
          otherpos = shuffle(Array.from(otherpos));

          for (let k = 0; k < otherpos.length; k++) {
            codelist += globalState[indexBase + div * otherpos[k] + Math.trunc(Math.random() * div)];
          }

          codelist += inputcode[i];
          codelist += globalState[indexBase + div * posChichu(algSet[j][1])];
          codelist += algSet[j][0];
          codelist += algSet[j][1];

          const state = codeTrans(codelist, otherState);
          times += 1;
          states.push(state);
        }
      }

      const solved = await Promise.all(states.map((s) => m2pSolve(s)));
      const shuffled = shuffle(Array.from(solved));
      setScrambles(shuffled);
      setInfo(
        i18n.language === 'zh-Hant' ? (`隨機生成 ${times} 條打亂，遍歷輸入編碼的所有 ${spec.caseLabel} 情況。`) : (isZh
                    ? `随机生成 ${times} 条打乱，遍历输入编码的所有 ${spec.caseLabel} 情况。`
                    : `Generated ${times} scrambles, covering all ${spec.caseLabel} cases for the chosen codes.`),
      );
    } finally {
      setBusy(false);
    }
  };

  if (!hydrated) return null;

  const displayCodes = usableCodes.map((c) => c.toUpperCase()).join('');
  const inputSummary =
    usableCodes.length > 0
      ? i18n.language === 'zh-Hant' ? (`已選擇 ${displayCodes} 共 ${usableCodes.length} 個編碼`) : (isZh
                  ? `已选择 ${displayCodes} 共 ${usableCodes.length} 个编码`
                  : `Selected ${displayCodes} (${usableCodes.length} codes)`)
      : tr({ zh: '尚未选择训练编码', en: 'No training codes selected yet',
          zhHant: "尚未選擇訓練編碼"
    });

  return (
    <div className="bld-trainer-root">
      <div className="bld-topbar">
        <h1>{isZh ? spec.titleZh : spec.titleEn}</h1>
      </div>

      <BldConfigBar
        show={{
          corner: piece === 'corner',
          edge: piece === 'edge',
          scheme: true,
          orientation: false,
          hueSkip: false,
        }}
      />

      <div className="bld-section">
        <button type="button" className="bld-btn" onClick={openModal}>
          <Plus size={15} />
          {tr({ zh: '选择训练编码', en: 'Pick training codes',
              zhHant: "選擇訓練編碼"
        })}
        </button>
        <p className="bld-input-summary" style={{ marginTop: 12 }}>{inputSummary}</p>

        <div className="bld-options">
          <label className="bld-check">
            <input type="checkbox" checked={otherScramble} onChange={(e) => setOtherScramble(e.target.checked)} />
            {isZh ? spec.otherScrambleZh : spec.otherScrambleEn}
          </label>
          <label className="bld-check">
            <input type="checkbox" checked={twist} onChange={(e) => setTwist(e.target.checked)} />
            {isZh ? spec.twiststateZh : spec.twiststateEn}
          </label>
          <label className="bld-check">
            <input type="checkbox" checked={excludeTop} onChange={(e) => setExcludeTop(e.target.checked)} />
            {tr({ zh: '是否排除顶层', en: 'Exclude top layer',
                zhHant: "是否排除頂層"
            })}
          </label>
        </div>

        <div className="bld-generate-row">
          <button
            type="button"
            className="bld-btn bld-btn-primary"
            onClick={generate}
            disabled={busy || usableCodes.length === 0}
          >
            <Play size={15} />
            {tr({ zh: '生成训练打乱', en: 'Generate scrambles',
                zhHant: "生成訓練打亂"
            })}
          </button>
        </div>
      </div>

      <div className="bld-section">
        <h2 className="bld-section-title">{tr({ zh: '输出训练打乱', en: 'Output scrambles',
            zhHant: "輸出訓練打亂"
        })}</h2>
        <ScrambleOutput scrambles={scrambles} info={info || undefined} busy={busy} />
      </div>

      {modalOpen && (
        <div
          className="bld-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="bld-modal" role="dialog" aria-modal="true">
            <div className="bld-modal-header">
              <h3 className="bld-modal-title">{tr({ zh: '请选择训练编码', en: 'Pick training codes',
                  zhHant: "請選擇訓練編碼"
            })}</h3>
              <button
                type="button"
                className="bld-modal-close"
                onClick={() => setModalOpen(false)}
                aria-label={tr({ zh: '关闭', en: 'Close',
                    zhHant: "關閉"
                })}
              >
                <X size={18} />
              </button>
            </div>

            <MatrixSelect pieceType={piece} value={draft} onChange={setDraft} />

            <div className="bld-modal-actions">
              <button type="button" className="bld-btn" onClick={() => setModalOpen(false)}>
                {tr({ zh: '取消', en: 'Cancel' })}
              </button>
              <button type="button" className="bld-btn bld-btn-primary" onClick={confirmModal}>
                {tr({ zh: '确认', en: 'Confirm',
                    zhHant: "確認"
                })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
