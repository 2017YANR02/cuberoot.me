'use client';

// 奇偶带翻 (LTCT) — faithful port of spooncuber ltct.html + ltct.js.
//
// For each input corner code (after a shuffle), build a corner state that is a
// PLL parity (odd edge permutation) carrying a corner twist on the target piece:
//   1. parity setup state: randomEdge(1) (odd edge scramble) when "scramble edges"
//      is on, else the bare odd-edge swap exCode(["a","g"], globalState).
//   2. algSetGenerator(code + cBuffer) -> shuffle -> greedily pick 2 codes whose
//      pieces don't collide with each other or the buffer (other-corner noise).
//   3. optionally codeTrans those 2 picked codes into the state (scramble other
//      corners) when "scramble other corners" is on.
//   4. three exCode swaps anchored on the buffer:
//        [cBuf, code[0]], [cBuf, code[1]], [cBuf, globalState[3*posChichu(code[1])]]
//      the third targets the buffer-orientation sticker of code[1]'s piece, which
//      installs the corner twist (带翻) on top of the cycle.
//   5. m2pSolve(state) -> the scramble.
//
// Codes are typed via the newline-textarea CodeInputModal (supports B[H] / BH
// bracket form -> strip brackets; >=5 validation). Edge+corner buffers come from
// BldConfigBar (this module only uses the corner buffer).

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type JSX,
} from 'react';
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
  randomEdge,
  shuffle,
  posChichu,
  globalState,
} from '../_lib/state-gen';
import { m2pSolve, prewarm } from '../_lib/m2p-bridge';
import '../3bld.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

function isAlphabet(ch: string): boolean {
  return /^[a-zA-Z]$/.test(ch);
}

// Strip the optional bracket form: "B[H]" / "BH" -> "BH" (verbatim ltctInputCheck:
// remove first "[" and first "]"). Upstream does code.replace("[","").replace("]","").
function stripBrackets(code: string): string {
  return code.replace('[', '').replace(']', '');
}

export default function LtctTrainerPage(): JSX.Element {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('奇偶带翻训练', 'LTCT Parity-Twist Trainer', "奇偶帶翻訓練");

  const hydrated = useBldConfigHydrated();
  const config = useBldConfigStore((s) => s.config);

  // Upstream defaults both scramble checkboxes to checked.
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

  useEffect(() => {
    prewarm();
  }, []);

  const cBuffer = config.cBuf.toUpperCase();

  // Validate the textarea into newCodes[] (verbatim ltctInputCheck logic).
  const validateCodes = useCallback((): string[] | null => {
    const lines = codesText.split('\n');
    const codes: string[] = [];
    for (const line of lines) {
      if (line === '') continue;
      // Corner codes are uppercase A-Z in the chichu alphabet; uppercase here so
      // validation (posChichu) and generation agree (the corner buffer is upper).
      codes.push(stripBrackets(line).toUpperCase());
    }

    const bufPos = posChichu(cBuffer);

    let err = '';
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c.length !== 2) {
        err += `${tr({ zh: '第', en: 'Line ' })}${i + 1}${tr({ zh: '行编码【', en: ' code [',
            zhHant: "行編碼【"
        })}${c}${tr({ zh: '】长度不符要求。', en: '] length invalid.',
            zhHant: "】長度不符要求。"
        })}\n`;
        continue;
      }
      if (!isAlphabet(c[0]) || !isAlphabet(c[1])) {
        err += `${tr({ zh: '第', en: 'Line ' })}${i + 1}${tr({ zh: '行编码【', en: ' code [',
            zhHant: "行編碼【"
        })}${c}${tr({ zh: '】不是字母。', en: '] is not a letter.' })}\n`;
        continue;
      }
      if (posChichu(c[0]) === bufPos || posChichu(c[1]) === bufPos) {
        err += `${tr({ zh: '第', en: 'Line ' })}${i + 1}${tr({ zh: '行编码【', en: ' code [',
            zhHant: "行編碼【"
        })}${c}${tr({ zh: '】包含缓冲编码。', en: '] contains the buffer.',
            zhHant: "】包含緩衝編碼。"
        })}\n`;
      }
      if (posChichu(c[0]) === posChichu(c[1])) {
        err += `${tr({ zh: '第', en: 'Line ' })}${i + 1}${tr({ zh: '行编码【', en: ' code [',
            zhHant: "行編碼【"
        })}${c}${tr({ zh: '】存在位置冲突。', en: '] position conflict.',
            zhHant: "】存在位置衝突。"
        })}\n`;
      }
    }
    if (codes.length < 5) {
      err += tr({ zh: '请您至少输入5组编码。\n', en: 'Please enter at least 5 codes.\n',
          zhHant: "請您至少輸入5組編碼。\n\
"
    });
    }

    if (err === '') return codes;
    setModalMsg({ text: err.trim(), kind: 'error' });
    return null;
  }, [codesText, cBuffer, isZh]);

  const confirmCodes = useCallback(() => {
    const codes = validateCodes();
    if (!codes) return;
    setNewCodes(codes);
    setModalOpen(false);
    setModalMsg(undefined);
    // Upstream uppercases the corner codes at generation time; keep the entered
    // text verbatim in the summary (matches ltctInputCheck's slice display).
    setInputSummary(
      i18n.language === 'zh-Hant' ? (`已輸入 ${codes[0]}, ${codes[1]}, … , ${codes[codes.length - 2]}, ${codes[codes.length - 1]} 共 ${codes.length} 組編碼。`) : (isZh
                ? `已输入 ${codes[0]}, ${codes[1]}, … , ${codes[codes.length - 2]}, ${codes[codes.length - 1]} 共 ${codes.length} 组编码。`
                : `Entered ${codes[0]}, ${codes[1]}, … , ${codes[codes.length - 2]}, ${codes[codes.length - 1]} (${codes.length} codes).`),
    );
  }, [validateCodes, isZh]);

  const generate = useCallback(async () => {
    if (newCodes.length < 5) {
      setInfo(tr({ zh: '请先输入至少 5 组训练编码。', en: 'Please enter at least 5 training codes first.',
          zhHant: "請先輸入至少 5 組訓練編碼。"
    }));
      return;
    }
    setBusy(true);
    setScrambles([]);
    setInfo('');

    // newCodes are already uppercase (validateCodes uppercases corner codes).
    // shuffle() is destructive, so pass a copy to preserve newCodes for reruns.
    const codeList = shuffle(Array.from(newCodes));

    const out: string[] = [];
    let times = 0;

    for (let i = 0; i < codeList.length; i++) {
      const code = codeList[i];

      // 1. parity setup state.
      let state: string = edgeScramble
        ? randomEdge(1)
        : exCode(['a', 'g'], globalState);

      // 2. other-corner noise candidates excluding this code's pieces + the buffer.
      let algSet = algSetGenerator(Array.from(code + cBuffer));
      algSet = shuffle(algSet);

      // greedily pick 2 non-colliding corner codes.
      let codes = cBuffer;
      const posList: number[] = [];
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < algSet.length; k++) {
          if (
            posList.indexOf(posChichu(algSet[k][0])) === -1 &&
            posList.indexOf(posChichu(algSet[k][1])) === -1
          ) {
            posList.push(posChichu(algSet[k][0]));
            posList.push(posChichu(algSet[k][1]));
            codes += algSet[k];
            break;
          }
        }
      }

      // 3. optionally scramble the other corners.
      if (cornerScramble) {
        state = codeTrans(codes, state);
      }

      // 4. parity + twist swaps anchored on the buffer.
      state = exCode([cBuffer, code[0]], state);
      state = exCode([cBuffer, code[1]], state);
      state = exCode([cBuffer, globalState[3 * posChichu(code[1])]], state);

      // 5. solve.
      const scr = await m2pSolve(state);
      out.push(scr);
      setScrambles([...out]);
      times += 1;
    }

    setScrambles(out);
    setInfo(
      i18n.language === 'zh-Hant' ? (`隨機生成 ${times} 條打亂。`) : (isZh
                ? `随机生成 ${times} 条打乱。`
                : `Generated ${times} scrambles.`),
    );
    setBusy(false);
  }, [newCodes, cBuffer, edgeScramble, cornerScramble, isZh]);

  const title = useMemo(
    () => ({ zh: '奇偶带翻训练', en: 'LTCT Parity-Twist Trainer',
        zhHant: "奇偶帶翻訓練"
    }),
    [],
  );

  if (!hydrated) return <div className="bld-trainer-root" />;

  return (
    <div className="bld-trainer-root">
      <div className="bld-topbar">
        <h1>{(i18n.language === 'zh-Hant' ? (title.zhHant ?? title.zh) : (i18n.language.startsWith('zh') ? title.zh : title.en))}</h1>
      </div>

      <div className="bld-section">
        <BldConfigBar show={{ edge: false }} />
      </div>

      <div className="bld-section">
        <div className="bld-options">
          <label className="bld-check">
            <input
              type="checkbox"
              checked={edgeScramble}
              onChange={(e) => setEdgeScramble(e.target.checked)}
            />
            {tr({ zh: '打乱棱块', en: 'Scramble edges',
                zhHant: "打亂稜塊"
            })}
          </label>
          <label className="bld-check">
            <input
              type="checkbox"
              checked={cornerScramble}
              onChange={(e) => setCornerScramble(e.target.checked)}
            />
            {tr({ zh: '打乱其他角块', en: 'Scramble other corners',
                zhHant: "打亂其他角塊"
            })}
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
          {tr({ zh: '输入训练编码', en: 'Enter training codes',
              zhHant: "輸入訓練編碼"
        })}
        </button>

        {inputSummary && <p className="bld-input-summary">{inputSummary}</p>}
      </div>

      <div className="bld-section">
        <button
          type="button"
          className="bld-btn bld-btn-primary"
          onClick={() => void generate()}
          disabled={busy}
        >
          <Play size={15} />
          {tr({ zh: '生成训练打乱', en: 'Generate scrambles',
              zhHant: "生成訓練打亂"
        })}
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
        title={tr({ zh: '输入训练编码', en: 'Enter training codes',
            zhHant: "輸入訓練編碼"
        })}
        placeholder={
          tr({ zh: '编码以换行分隔。支持 BH 或 B[H]。可在 Excel 整理一列编码后粘贴。', en: 'One code per line. BH or B[H] bracket form supported. Paste a column from Excel.',
              zhHant: "編碼以換行分隔。支援 BH 或 B[H]。可在 Excel 整理一列編碼後貼上。"
        })
        }
      />
    </div>
  );
}
