'use client';

// Shared edge/corner algorithm trainer — faithful port of spooncuber
// edge.html+edge.js and corner.html+corner.js (structurally identical, only
// piece type / casing / step differ). Two modes:
//   ACCURATE (精准生成模式): greedy layered packing of <=5 non-colliding training
//     codes per scramble (algSetGenerator other-code injection + optional
//     opposite-piece scramble), codeTrans state build, m2pSolve (async).
//   RANDOM (随机生成模式): 10000 random-move scrambles, read codes, rank top-100
//     by training-set hit count, output with hit-ratio stats.

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type JSX,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Play, FileText } from 'lucide-react';
import { BldConfigBar } from './BldConfigBar';
import { ScrambleOutput } from './ScrambleOutput';
import { CodeInputModal } from './CodeInputModal';
import {
  useBldConfigStore,
  useBldConfigHydrated,
} from '../_store/bld-config-store';
import {
  algSetGenerator,
  codeTrans,
  randomEdge,
  randomCorner,
  shuffle,
  posChichu,
  globalState,
} from '../_lib/state-gen';
import { readEdges, readCorners } from '../_lib/read-engine';
import { m2pSolve, prewarm } from '../_lib/m2p-bridge';
import type { BldConfig, LetterCell } from '../_lib/types';
import '../3bld.css';

type PieceType = 'edge' | 'corner';

interface CodeTrainerProps {
  pieceType: PieceType;
}

// Top-layer buffers + their U8-class partner stickers (upstream addSample).
const EDGE_SAMPLE = { primary: 'aceg', partner: 'plrtxz' };
const CORNER_SAMPLE = { primary: 'ADGJ', partner: 'MNYZPQST' };

function isAlphabet(ch: string): boolean {
  return /^[a-zA-Z]$/.test(ch);
}

// Port of scrambler.js getScramble(): 20-move random-move 3x3 scramble, rejecting
// a candidate that shares a face with the previously kept move OR the one before
// it. Gated on moveList.length (not the iteration counter) so rejected candidates
// never desync the second-previous lookback. Math.random() driven.
const SCRAMBLE_TEMPLATE = [
  'R', 'L', 'F', 'B', 'U', 'D', 'R2', 'L2', 'F2', 'B2', 'U2', 'D2',
  "R'", "L'", "F'", "B'", "U'", "D'",
];
function getScramble(): string {
  const moveList: string[] = [];
  let guard = 0;
  while (moveList.length < 20 && guard++ < 1000) {
    const randomPos = Math.floor(Math.random() * 18);
    const face = SCRAMBLE_TEMPLATE[randomPos][0];
    const n = moveList.length;
    if (n === 0) {
      moveList.push(SCRAMBLE_TEMPLATE[randomPos]);
    } else if (face !== moveList[n - 1][0]) {
      if (n < 2 || face !== moveList[n - 2][0]) {
        moveList.push(SCRAMBLE_TEMPLATE[randomPos]);
      }
    }
  }
  return moveList.join(' ');
}

// Re-group LetterCell[] back into upstream space-separated 2-letter codes (the
// reader emits one cell per letter; upstream inserted a space every 2 letters).
function cellsToCodes(cells: LetterCell[], lowercase: boolean): string[] {
  const codes: string[] = [];
  for (let i = 0; i + 1 < cells.length; i += 2) {
    const code = cells[i].letter + cells[i + 1].letter;
    codes.push(lowercase ? code.toLowerCase() : code);
  }
  return codes;
}

export function CodeTrainer({ pieceType }: CodeTrainerProps): JSX.Element {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const hydrated = useBldConfigHydrated();
  const config = useBldConfigStore((s) => s.config);

  const isEdge = pieceType === 'edge';

  const [mode, setMode] = useState<0 | 1>(0); // 0 accurate / 1 random
  // accurate-mode checkboxes
  const [otherCodeMode, setOtherCodeMode] = useState(false);
  const [oppScramble, setOppScramble] = useState(false); // scramble the opposite piece
  // random-mode keep-hue / skip-cycle override the config flags for the read.
  const [randKeepHue, setRandKeepHue] = useState(false);
  const [randSkipCycle, setRandSkipCycle] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [codesText, setCodesText] = useState('');
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [modalMsg, setModalMsg] = useState<{ text: string; kind?: 'error' | 'ok' } | undefined>();
  const [inputSummary, setInputSummary] = useState('');

  const [scrambles, setScrambles] = useState<string[]>([]);
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    prewarm();
  }, []);

  const buffer = isEdge ? config.eBuf : config.cBuf;

  // Validate the textarea into newCodes[] (verbatim edge/cornerInputCheck logic).
  const validateCodes = useCallback((): string[] | null => {
    const lines = codesText.split('\n');
    const codes: string[] = [];
    for (const line of lines) {
      if (line === '') continue;
      codes.push(isEdge ? line.toLowerCase() : line.toUpperCase());
    }

    const bufNorm = isEdge ? buffer.toLowerCase() : buffer;
    const bufPos = posChichu(isEdge ? bufNorm.toLowerCase() : bufNorm);

    let err = '';
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c.length !== 2) {
        err += `${isZh ? '第' : 'Line '}${i + 1}${isZh ? '行编码【' : ' code ['}${c}${isZh ? '】长度不符要求。' : '] length invalid.'}\n`;
        continue;
      }
      if (!isAlphabet(c[0]) || !isAlphabet(c[1])) {
        err += `${isZh ? '第' : 'Line '}${i + 1}${isZh ? '行编码【' : ' code ['}${c}${isZh ? '】不是合法编码。' : '] not a valid code.'}\n`;
        continue;
      }
      const p0 = posChichu(isEdge ? c[0].toLowerCase() : c[0]);
      const p1 = posChichu(isEdge ? c[1].toLowerCase() : c[1]);
      if (p0 === bufPos || p1 === bufPos) {
        err += `${isZh ? '第' : 'Line '}${i + 1}${isZh ? '行编码【' : ' code ['}${c}${isZh ? '】包含缓冲编码。' : '] contains the buffer.'}\n`;
      }
      if (p0 === p1) {
        err += `${isZh ? '第' : 'Line '}${i + 1}${isZh ? '行编码【' : ' code ['}${c}${isZh ? '】存在位置冲突。' : '] position conflict.'}\n`;
      }
    }
    if (codes.length < 5) {
      err += isZh ? '请您至少输入5组编码。\n' : 'Please enter at least 5 codes.\n';
    }

    if (err === '') return codes;
    setModalMsg({ text: err.trim(), kind: 'error' });
    return null;
  }, [codesText, buffer, isEdge, isZh]);

  const confirmCodes = useCallback(() => {
    const codes = validateCodes();
    if (!codes) return;
    setNewCodes(codes);
    setModalOpen(false);
    setModalMsg(undefined);
    setInputSummary(
      isZh
        ? `已输入 ${codes[0]}, ${codes[1]}, … , ${codes[codes.length - 2]}, ${codes[codes.length - 1]} 共 ${codes.length} 组编码。`
        : `Entered ${codes[0]}, ${codes[1]}, … , ${codes[codes.length - 2]}, ${codes[codes.length - 1]} (${codes.length} codes).`,
    );
  }, [validateCodes, isZh]);

  // U8-class sample (addSample): only valid for top-layer buffers.
  const addSample = useCallback(() => {
    const { primary, partner } = isEdge ? EDGE_SAMPLE : CORNER_SAMPLE;
    const bufKey = isEdge ? buffer.toLowerCase() : buffer;
    if (primary.indexOf(bufKey) === -1) {
      setModalMsg({
        text: isZh
          ? '非顶面缓冲暂不支持 U8 类样例输入。'
          : 'U8-class sample is only available for top-layer buffers.',
        kind: 'error',
      });
      return;
    }
    let add = '';
    for (let i = 0; i < primary.length; i++) {
      if (primary[i] !== bufKey) {
        for (let j = 0; j < partner.length; j++) {
          // Edge upstream uppercases sample letters; corner keeps as-is (already upper).
          const a = isEdge ? primary[i].toUpperCase() : primary[i];
          const b = isEdge ? partner[j].toUpperCase() : partner[j];
          add += `${a}${b}\n${b}${a}\n`;
        }
      }
    }
    setCodesText((t) => t + add);
  }, [buffer, isEdge, isZh]);

  // ── ACCURATE MODE (edgeAccurateCodes / cornerAccurateCodes) ──
  const generateAccurate = useCallback(async () => {
    setBusy(true);
    setScrambles([]);
    setInfo('');

    const bufNorm = isEdge ? buffer.toLowerCase() : buffer;
    // algSet for other-code injection (excludes the buffer piece).
    let algSet = algSetGenerator(Array.from(bufNorm));
    // Layered worklist: layer 0 = shuffled training codes (copy so state survives).
    const algAllList: string[][] = [shuffle(Array.from(newCodes))];

    let srcNum = 0;
    let inputCodeNum = 0;
    let otherCodeNum = 0;
    const out: string[] = [];

    for (let i = 0; i < 10000; i++) {
      let state: string | string[] = oppScramble
        ? isEdge
          ? randomCorner(0)
          : randomEdge(0)
        : globalState;

      const pos: number[] = [posChichu(bufNorm)];
      let codes = bufNorm;

      for (let j = 0; j < 5; j++) {
        let breakFlag = 0;
        for (let m = 0; m < algAllList.length; m++) {
          for (let n = 0; n < algAllList[m].length; n++) {
            const code = algAllList[m][n];
            if (pos.indexOf(posChichu(code[0])) === -1 && pos.indexOf(posChichu(code[1])) === -1) {
              pos.push(posChichu(code[0]));
              pos.push(posChichu(code[1]));
              codes += code;
              if (algAllList.length === m + 1) algAllList.push([]);
              algAllList[m + 1].push(code);
              algAllList[m].splice(algAllList[m].indexOf(code), 1);
              breakFlag = 1;
              inputCodeNum += 1;
              break;
            }
          }
          if (breakFlag === 1) break;
        }

        if (otherCodeMode) {
          algSet = shuffle(Array.from(algSet));
          for (let n = 0; n < algSet.length; n++) {
            const code = algSet[n];
            if (pos.indexOf(posChichu(String(code[0]))) === -1 && pos.indexOf(posChichu(String(code[1]))) === -1) {
              pos.push(posChichu(String(code[0])));
              pos.push(posChichu(String(code[1])));
              codes += code;
              otherCodeNum += 1;
              break;
            }
          }
        }
      }

      state = codeTrans(codes, state);
      const scr = await m2pSolve(state);
      out.push(scr);
      setScrambles([...out]);
      srcNum += 1;
      if (algAllList[0].length === 0) break;
    }

    setScrambles(out);
    setInfo(
      isZh
        ? `已生成遍历训练集编码的 ${srcNum} 条打乱。出现 ${inputCodeNum} 次训练集编码，${otherCodeNum} 次其他编码。`
        : `Generated ${srcNum} scrambles covering the training set. ${inputCodeNum} training-code occurrences, ${otherCodeNum} other-code occurrences.`,
    );
    setBusy(false);
  }, [buffer, isEdge, newCodes, otherCodeMode, oppScramble, isZh]);

  // ── RANDOM MODE (edgeRandomScrs / cornerRandomScrs) ──
  const generateRandom = useCallback(() => {
    setBusy(true);
    setScrambles([]);
    setInfo('');

    // Apply random-mode keep-hue / skip-cycle as a read-time config override.
    const readCfg: BldConfig = {
      ...config,
      ...(isEdge
        ? { keepHueE: randKeepHue, skipE: (randSkipCycle ? 1 : 0) as 0 | 1 }
        : { keepHueC: randKeepHue, skipC: (randSkipCycle ? 1 : 0) as 0 | 1 }),
    };
    const read = (scr: string): string[] =>
      isEdge ? cellsToCodes(readEdges(scr, readCfg), true) : cellsToCodes(readCorners(scr, readCfg), false);

    const SCR_AMOUNT = 10000;
    const CHOOSE = 100;
    const candidates: { scr: string; codes: string[]; hits: number }[] = [];

    for (let i = 0; i < SCR_AMOUNT; i++) {
      const scr = getScramble();
      const codes = read(scr);
      let hits = 0;
      for (const code of codes) {
        if (newCodes.indexOf(code) > -1) hits += 1;
      }
      candidates.push({ scr, codes, hits });
    }

    candidates.sort((a, b) => b.hits - a.hits);

    const top = candidates.slice(0, CHOOSE);
    const out = top.map((c) => c.scr);
    let allHitNum = 0;
    let allAlgNum = 0;
    for (const c of top) {
      allHitNum += c.hits;
      allAlgNum += c.codes.length;
    }
    const perc = allAlgNum > 0 ? allHitNum / allAlgNum : 0;

    setScrambles(out);
    const pieceZh = isEdge ? '棱块' : '角块';
    const pieceEn = isEdge ? 'edge' : 'corner';
    setInfo(
      isZh
        ? `共生成 100 条打乱，共出现${pieceZh}公式 ${allAlgNum} 条，其中训练集公式共 ${allHitNum} 条，训练集公式比例为 ${perc.toFixed(3)}。`
        : `Generated 100 scrambles with ${allAlgNum} ${pieceEn} algs total; ${allHitNum} are training-set algs (ratio ${perc.toFixed(3)}).`,
    );
    setBusy(false);
  }, [config, isEdge, randKeepHue, randSkipCycle, newCodes, isZh]);

  const generate = useCallback(() => {
    if (mode === 0) {
      if (newCodes.length < 5) {
        setInfo(isZh ? '请先输入至少 5 组训练编码。' : 'Please enter at least 5 training codes first.');
        return;
      }
      void generateAccurate();
    } else {
      generateRandom();
    }
  }, [mode, newCodes.length, generateAccurate, generateRandom, isZh]);

  const title = useMemo(
    () =>
      isEdge
        ? { zh: '棱块公式训练', en: 'Edge Algorithm Trainer' }
        : { zh: '角块公式训练', en: 'Corner Algorithm Trainer' },
    [isEdge],
  );

  if (!hydrated) return <div className="bld-trainer-root" />;

  return (
    <div className="bld-trainer-root">
      <div className="bld-topbar">
        <h1>{isZh ? title.zh : title.en}</h1>
      </div>

      <div className="bld-section">
        <BldConfigBar show={isEdge ? { corner: false } : { edge: false }} />
      </div>

      {/* mode select */}
      <div className="bld-section">
        <div className="bld-field" style={{ maxWidth: 240 }}>
          <label className="bld-field-label" htmlFor="bld-mode">
            {isZh ? '生成模式' : 'Generation mode'}
          </label>
          <select
            id="bld-mode"
            className="bld-select"
            value={mode}
            onChange={(e) => setMode(Number(e.target.value) as 0 | 1)}
          >
            <option value={0}>{isZh ? '精准生成模式' : 'Accurate'}</option>
            <option value={1}>{isZh ? '随机生成模式' : 'Random'}</option>
          </select>
        </div>
      </div>

      {mode === 0 ? (
        <>
          <div className="bld-section">
            <div className="bld-options">
              <label className="bld-check">
                <input
                  type="checkbox"
                  checked={otherCodeMode}
                  onChange={(e) => setOtherCodeMode(e.target.checked)}
                />
                {isZh ? '允许出现其他编码' : 'Allow other codes'}
              </label>
              <label className="bld-check">
                <input
                  type="checkbox"
                  checked={oppScramble}
                  onChange={(e) => setOppScramble(e.target.checked)}
                />
                {isEdge
                  ? isZh ? '打乱角块' : 'Scramble corners'
                  : isZh ? '打乱棱块' : 'Scramble edges'}
              </label>
            </div>

            <button
              type="button"
              className="bld-btn"
              onClick={() => {
                setModalMsg(undefined);
                setModalOpen(true);
              }}
            >
              <FileText size={15} />
              {isZh ? '输入训练编码' : 'Enter training codes'}
            </button>

            {inputSummary && <p className="bld-input-summary">{inputSummary}</p>}
          </div>
        </>
      ) : (
        <div className="bld-section">
          <div className="bld-options">
            <label className="bld-check">
              <input
                type="checkbox"
                checked={randKeepHue}
                onChange={(e) => setRandKeepHue(e.target.checked)}
              />
              {isEdge
                ? isZh ? '棱块保持色相借位' : 'Edge keep hue'
                : isZh ? '角块保持色相借位' : 'Corner keep hue'}
            </label>
            <label className="bld-check">
              <input
                type="checkbox"
                checked={randSkipCycle}
                onChange={(e) => setRandSkipCycle(e.target.checked)}
              />
              {isEdge
                ? isZh ? '棱块跳编法' : 'Edge fixed-buffer'
                : isZh ? '角块跳编法' : 'Corner fixed-buffer'}
            </label>
          </div>
          {mode === 1 && newCodes.length < 5 && (
            <p className="bld-input-summary">
              {isZh
                ? '随机模式按训练编码命中数排序：可先用「精准模式」输入框录入一组编码。'
                : 'Random mode ranks scrambles by training-code hits — enter a code set via the accurate-mode input first.'}
            </p>
          )}
          {mode === 1 && (
            <button
              type="button"
              className="bld-btn"
              onClick={() => {
                setModalMsg(undefined);
                setModalOpen(true);
              }}
            >
              <FileText size={15} />
              {isZh ? '输入训练编码' : 'Enter training codes'}
            </button>
          )}
          {mode === 1 && inputSummary && <p className="bld-input-summary" style={{ marginTop: 10 }}>{inputSummary}</p>}
        </div>
      )}

      <div className="bld-section">
        <button
          type="button"
          className="bld-btn bld-btn-primary"
          onClick={generate}
          disabled={busy}
        >
          <Play size={15} />
          {isZh ? '生成训练打乱' : 'Generate scrambles'}
        </button>
      </div>

      <div className="bld-section">
        <ScrambleOutput scrambles={scrambles} info={info || undefined} busy={busy} />
      </div>

      <CodeInputModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        value={codesText}
        onChange={setCodesText}
        onConfirm={confirmCodes}
        message={modalMsg}
        title={isZh ? '输入训练编码' : 'Enter training codes'}
        placeholder={
          isZh
            ? '每行一个 2 字母编码（编码不会被保存），建议输入 50 组以上。'
            : 'One 2-letter code per line (codes are not saved); 50+ recommended.'
        }
        sampleButton={{
          label: isZh ? '添加输入样例（U8 类）' : 'Add U8-class sample',
          onClick: addSample,
        }}
      />
    </div>
  );
}
