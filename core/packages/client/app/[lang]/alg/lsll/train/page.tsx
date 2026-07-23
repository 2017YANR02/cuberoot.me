'use client';

/**
 * /alg/lsll/train — LSLL 训练器。
 *
 * 随机抽一个 LSLL case → 出打乱 → 自己在方块上解 → 揭示。
 * 取样范围三档(单一下拉):全部 583,284(按大类 count 加权,均匀落到 case)、
 * 只练 ZBLS 已收录(305,有真公式可看)、或指定某个大类。
 *
 * 公式单一数据源:本页不复制公式,揭示时指向 zbls 库案例(见 lib/lsll/zbls_overlay)。
 */
import { useCallback, useEffect, useState } from 'react';
import Link from '@/components/AppLink';
import { ArrowLeft, Dices, Eye } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr, T } from '@/i18n/tr';
import { FaceletsCube } from '@/components/FaceletsCube';
import {
  CATEGORIES, decodeKey, enumerateCategory, caseFacelets, keyToString, keyFromString,
  type LsllState,
} from '@/lib/lsll/model';
import { setupForCase } from '@/lib/lsll/setup';
import { invertMoveString } from '@cuberoot/shared/alg-notation';
import { zblsForKey, ZBLS_COVERED_KEYS, type ZblsRef } from '@/lib/lsll/zbls_overlay';
import '../../alg.css';
import '../lsll.css';

/** 按大类 count 加权抽一个 case key(等价于在全部 case 上均匀抽)。 */
function randomKeyAllCases(): number | null {
  const total = CATEGORIES.reduce((s, c) => s + c.count, 0);
  let r = Math.floor(Math.random() * total);
  for (const c of CATEGORIES) {
    if (r < c.count) return randomKeyInCategory(c.slug);
    r -= c.count;
  }
  return randomKeyInCategory(CATEGORIES[0].slug);
}

function randomKeyInCategory(slug: string): number | null {
  const keys = enumerateCategory(slug);
  if (!keys.length) return null;
  return keys[Math.floor(Math.random() * keys.length)];
}

function randomKeyCovered(): number | null {
  if (!ZBLS_COVERED_KEYS.length) return null;
  const s = ZBLS_COVERED_KEYS[Math.floor(Math.random() * ZBLS_COVERED_KEYS.length)];
  return keyFromString(s);
}

export default function LsllTrainPage() {
  useDocumentTitle('LSLL 训练', 'LSLL Trainer');

  const [scope, setScope] = useState<string>('all');
  const [key, setKey] = useState<number | null>(null);
  const [state, setState] = useState<LsllState | null>(null);
  const [scramble, setScramble] = useState<string>('');
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);

  const next = useCallback(() => {
    const k =
      scope === 'all' ? randomKeyAllCases()
      : scope === 'zbls' ? randomKeyCovered()
      : randomKeyInCategory(scope);
    if (k == null) return;
    const st = decodeKey(k);
    if (!st) return;
    setKey(k);
    setState(st);
    setRevealed(false);
    setScramble('');
    setBusy(true);
    setupForCase(st)
      .then((s) => setScramble(s))
      .catch(() => setScramble(''))
      .finally(() => setBusy(false));
  }, [scope]);

  // 首次进入 + 换范围时换题。
  useEffect(() => { next(); }, [next]);

  const keyStr = key == null ? '' : keyToString(key);
  const refs: ZblsRef[] | null = keyStr ? zblsForKey(keyStr) : null;
  // 打乱本身 = cubing.js 两阶段解取逆,故取逆回来就是一条有效解法(每个 case 都有)。
  let solution = '';
  if (scramble) {
    try { solution = invertMoveString(scramble); } catch { solution = ''; }
  }

  return (
    <div className="alg-root">
      <div className="alg-cat-header">
        <Link href="/alg/lsll" className="alg-back">
          <ArrowLeft size={14} /> {tr({ zh: '返回', en: 'Back' })}
        </Link>
        <h1 className="alg-cat-title">
          <span>{tr({ zh: 'LSLL 训练', en: 'LSLL Trainer' })}</span>
        </h1>
      </div>

      <div className="lsll-train-bar">
        <select
          className="lsll-train-scope"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          aria-label={tr({ zh: '训练范围', en: 'Training scope' })}
        >
          <option value="all">{tr({ zh: '全部 case', en: 'All cases' })}</option>
          <option value="zbls">
            {tr({ zh: `只练已收录公式(${ZBLS_COVERED_KEYS.length})`, en: `With algorithms only (${ZBLS_COVERED_KEYS.length})` })}
          </option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {tr({ zh: `大类 ${c.letter}`, en: `Family ${c.letter}` })}
            </option>
          ))}
        </select>
        <button type="button" className="lsll-train-next" onClick={next} disabled={busy}>
          <Dices size={15} /> {tr({ zh: '下一个', en: 'Next' })}
        </button>
        <button
          type="button"
          className="lsll-train-reveal"
          onClick={() => setRevealed(true)}
          disabled={revealed || !state}
        >
          <Eye size={15} /> {tr({ zh: '揭示', en: 'Reveal' })}
        </button>
      </div>

      {state && (
        <div className="lsll-train-card">
          <FaceletsCube fd={caseFacelets(state)} size={160} alt={keyStr} />
          <div className="lsll-train-body">
            <div className="lsll-train-label">{tr({ zh: '打乱', en: 'Scramble' })}</div>
            <div className="lsll-train-scramble">
              {busy ? tr({ zh: '生成中…', en: 'Generating…' }) : scramble || tr({ zh: '(生成失败)', en: '(failed)' })}
            </div>

            {revealed && (
              <div className="lsll-train-answer">
                <div className="lsll-train-label">{tr({ zh: '解法', en: 'Solution' })}</div>
                <div className="lsll-train-scramble">
                  {solution || tr({ zh: '(不可用)', en: '(unavailable)' })}
                </div>
                <div className="lsll-train-none">
                  <T
                    zh={<>机器两阶段解:能解开,但没优化步数和指法。最优解与 MCC 推荐公式由后台管道逐步回填。</>}
                    en={<>Machine two-phase solution: valid, but not move- or fingertrick-optimised. Optimal / MCC algs are being backfilled.</>}
                  />
                </div>

                {refs && refs.length > 0 && (
                  <div className="lsll-train-refs">
                    <div className="lsll-train-label">
                      {tr({ zh: '相关参考:ZBLS 最后一槽', en: 'Related: ZBLS last slot' })}
                    </div>
                    <div className="lsll-train-none">
                      <T
                        zh={<>ZBLS 公式只解<strong>最后一槽 + 翻正顶层棱</strong>,做完顶层还没解 —— 不是本 case 的解法,仅供对照槽的部分。</>}
                        en={<>ZBLS algs only solve the <strong>last slot and orient the LL edges</strong> — they do not finish this case; shown for the slot part only.</>}
                      />
                    </div>
                    {refs.map((r) => (
                      <Link key={r.slug} href={`/alg/3x3/zbls/${r.slug}`} className="lsll-zbls-ref" prefetch={false}>
                        <span className="lsll-zbls-name">{r.subgroup} {r.name}</span>
                        <span className="lsll-zbls-count">{r.algCount}</span>
                      </Link>
                    ))}
                  </div>
                )}

                <Link href={`/alg/lsll/case?k=${keyStr}`} className="lsll-train-caselink" prefetch={false}>
                  {tr({ zh: '打开 case 详情 →', en: 'Open case details →' })}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
