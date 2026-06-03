'use client';

// 奇偶训练 (parity) — ported from spooncuber parity.html + parity.js.
// Dual buffer (corner + edge, from BldConfigBar). Newline-separated codes, each
// 2 letters in 先棱后角 order (code[0] = edge target, code[1] = corner target).
// Per code: optionally greedy-scramble the other edges (5 non-colliding pairs)
// and/or other corners (3 pairs) via algSetGenerator + codeTrans, then swap the
// edge buffer with the edge target and the corner buffer with the corner target
// (exCode x2) to build the parity state, and m2pSolve each (async WASM Kociemba).

import { useEffect, useState, useCallback, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, FileText } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { BldConfigBar } from '../_components/BldConfigBar';
import { ScrambleOutput } from '../_components/ScrambleOutput';
import { CodeInputModal } from '../_components/CodeInputModal';
import {
  useBldConfigStore,
  useBldConfigHydrated,
} from '../_store/bld-config-store';
import {
  algSetGenerator,
  codeTrans,
  exCode,
  shuffle,
  posChichu,
  globalState,
} from '../_lib/state-gen';
import { m2pSolve, prewarm } from '../_lib/m2p-bridge';
import '../3bld.css';

function isAlphabet(ch: string): boolean {
  return /^[a-zA-Z]$/.test(ch);
}

// addSample is only valid for top-face buffers (upstream eList1 / eList2).
const SAMPLE_EDGE = 'aceg';
const SAMPLE_CORNER = 'ADGJ';

export default function ParityTrainerPage(): JSX.Element {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('奇偶训练', 'Parity Trainer');

  const hydrated = useBldConfigHydrated();
  const config = useBldConfigStore((s) => s.config);

  // Upstream JS sets both checkboxes checked on load.
  const [edgeScramble, setEdgeScramble] = useState(true);
  const [cornerScramble, setCornerScramble] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [codesText, setCodesText] = useState('');
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [modalMsg, setModalMsg] = useState<{ text: string; kind?: 'error' | 'ok' } | undefined>();
  const [inputSummary, setInputSummary] = useState('');

  const [scrambles, setScrambles] = useState<string[]>([]);
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  // m2pSolve is async (WASM Kociemba) — warm it up on mount.
  useEffect(() => {
    prewarm();
  }, []);

  const edgeBuffer = config.eBuf.toLowerCase();
  const cornerBuffer = config.cBuf.toUpperCase();

  // Verbatim parityInputCheck(): codes stay in their raw (user-typed) casing;
  // the generator lowercases the edge letter and uses the corner letter as-is.
  const validateCodes = useCallback((): string[] | null => {
    const lines = codesText.split('\n');
    const codes: string[] = [];
    for (const line of lines) {
      if (line === '') continue;
      codes.push(line);
    }

    const eBufPos = posChichu(edgeBuffer.toLowerCase());
    const cBufPos = posChichu(cornerBuffer.toUpperCase());

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
      if (posChichu(c[0].toLowerCase()) === eBufPos || posChichu(c[1].toUpperCase()) === cBufPos) {
        err += `${isZh ? '第' : 'Line '}${i + 1}${isZh ? '行编码【' : ' code ['}${c}${isZh ? '】包含缓冲编码。' : '] contains the buffer.'}\n`;
      }
    }
    if (codes.length < 5) {
      err += isZh ? '请您至少输入5组编码。\n' : 'Please enter at least 5 codes.\n';
    }

    if (err === '') return codes;
    setModalMsg({ text: err.trim(), kind: 'error' });
    return null;
  }, [codesText, edgeBuffer, cornerBuffer, isZh]);

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

  // addSample(): enumerate the other top-face edge x corner pairs into the
  // textarea — only valid when both buffers are on the top face.
  const addSample = useCallback(() => {
    if (SAMPLE_EDGE.indexOf(edgeBuffer) === -1 || SAMPLE_CORNER.indexOf(cornerBuffer) === -1) {
      setModalMsg({
        text: isZh
          ? '非顶面缓冲暂不支持样例输入。'
          : 'Sample input is only available for top-face buffers.',
        kind: 'error',
      });
      return;
    }
    let add = '';
    for (let i = 0; i < SAMPLE_EDGE.length; i++) {
      if (SAMPLE_EDGE[i] !== edgeBuffer) {
        for (let j = 0; j < SAMPLE_CORNER.length; j++) {
          if (SAMPLE_CORNER[j] !== cornerBuffer) {
            add += `${SAMPLE_EDGE[i].toUpperCase()}${SAMPLE_CORNER[j].toUpperCase()}\n`;
          }
        }
      }
    }
    setCodesText((t) => t + add);
  }, [edgeBuffer, cornerBuffer, isZh]);

  // getParityScrs(): per (shuffled) code, build the parity state and solve.
  const generate = useCallback(async () => {
    const codes = validateCodes();
    if (!codes) {
      // Surface validation errors and reopen the input modal so the user can fix.
      setModalOpen(true);
      return;
    }
    setNewCodes(codes);

    setBusy(true);
    setScrambles([]);
    setInfo('');

    // Yield so the busy spinner paints before the WASM run.
    await new Promise((r) => setTimeout(r, 0));

    const shuffled = shuffle(Array.from(codes));

    let eSet = algSetGenerator(Array.from(edgeBuffer));
    let cSet = algSetGenerator(Array.from(cornerBuffer));

    const out: string[] = [];
    for (let i = 0; i < shuffled.length; i++) {
      eSet = shuffle(Array.from(eSet));
      cSet = shuffle(Array.from(cSet));
      let state: string = globalState;

      // ── other edges (5 non-colliding pairs) ──
      let posList: number[] = [];
      let packedCodes = edgeBuffer;
      posList.push(posChichu(shuffled[i][0].toLowerCase()));
      posList.push(posChichu(edgeBuffer));

      if (edgeScramble) {
        for (let j = 0; j < 5; j++) {
          for (let k = 0; k < eSet.length; k++) {
            if (
              posList.indexOf(posChichu(eSet[k][0])) === -1 &&
              posList.indexOf(posChichu(eSet[k][1])) === -1
            ) {
              posList.push(posChichu(eSet[k][0]));
              posList.push(posChichu(eSet[k][1]));
              packedCodes += eSet[k];
              break;
            }
          }
        }
        state = codeTrans(packedCodes, state);
      }

      // ── other corners (3 non-colliding pairs) ──
      posList = [];
      packedCodes = cornerBuffer;
      posList.push(posChichu(shuffled[i][1]));
      posList.push(posChichu(cornerBuffer));

      if (cornerScramble) {
        for (let j = 0; j < 3; j++) {
          for (let k = 0; k < cSet.length; k++) {
            if (
              posList.indexOf(posChichu(cSet[k][0])) === -1 &&
              posList.indexOf(posChichu(cSet[k][1])) === -1
            ) {
              posList.push(posChichu(cSet[k][0]));
              posList.push(posChichu(cSet[k][1]));
              packedCodes += cSet[k];
              break;
            }
          }
        }
        state = codeTrans(packedCodes, state);
      }

      // ── parity swaps: edge buffer <-> edge target, corner buffer <-> corner target ──
      state = exCode([edgeBuffer, shuffled[i][0].toLowerCase()], state);
      state = exCode([cornerBuffer, shuffled[i][1]], state);

      // eslint-disable-next-line no-await-in-loop
      const scr = await m2pSolve(state);
      out.push(scr);
    }

    setScrambles(out);
    setInfo(
      isZh
        ? `已生成遍历训练集编码的 ${shuffled.length} 条打乱。`
        : `Generated ${shuffled.length} scrambles covering the training set.`,
    );
    setBusy(false);
  }, [validateCodes, edgeBuffer, cornerBuffer, edgeScramble, cornerScramble, isZh]);

  // Gate on hydration so the persisted buffers render consistently.
  if (!hydrated) return <div className="bld-trainer-root" />;

  return (
    <div className="bld-trainer-root">
      <div className="bld-topbar">
        <h1>{isZh ? '奇偶训练' : 'Parity Trainer'}</h1>
      </div>

      <div className="bld-section">
        <BldConfigBar show={{ scheme: false, orientation: false, hueSkip: false }} />
      </div>

      <section className="bld-section">
        <div className="bld-options">
          <label className="bld-check">
            <input
              type="checkbox"
              checked={edgeScramble}
              onChange={(e) => setEdgeScramble(e.target.checked)}
            />
            {isZh ? '打乱其他棱块' : 'Scramble other edges'}
          </label>
          <label className="bld-check">
            <input
              type="checkbox"
              checked={cornerScramble}
              onChange={(e) => setCornerScramble(e.target.checked)}
            />
            {isZh ? '打乱其他角块' : 'Scramble other corners'}
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
      </section>

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
        title={isZh ? '请输入训练编码（先棱后角）' : 'Enter training codes (edge then corner)'}
        placeholder={
          isZh
            ? '页面不会保存输入编码，请自行保存！输入编码以换行分隔，先棱后角。可以在 Excel 或 txt 中整理一列编码后粘贴。'
            : 'Codes are not saved — keep your own copy. One 2-letter code per line, edge letter then corner letter. Paste a column from Excel or a text file.'
        }
        sampleButton={{
          label: isZh ? '添加输入样例' : 'Add sample',
          onClick: addSample,
        }}
      />
    </div>
  );
}
