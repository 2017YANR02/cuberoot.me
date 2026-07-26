'use client';

/**
 * /alg/lsll/case?k=<base36 key> — 单 case 页。
 * 现阶段:状态图 + 构型信息 + 打乱(cubing.js 两阶段现算)+ 公式自测(本地验证 + MCC)。
 * 最优解 / MCC 推荐 / 用户提交等待后端管道与接口(见 ../PLAN.md)。
 */
import { useEffect, useMemo, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import Link from '@/components/AppLink';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr, T } from '@/i18n/tr';
import { FaceletsCube } from '@/components/FaceletsCube';
import { ClearButton } from '@/components/ClearButton';
import {
  keyFromString, keyToString, decodeKey, canonicalKey, canonicalState, classify,
  caseFacelets, verifyCaseAlg,
} from '@/lib/lsll/model';
import { zblsForKey } from '@/lib/lsll/zbls_overlay';
import { mirrorKey, mirrorAlgForCase } from '@/lib/lsll/mirror';
import { algSpeed, getSTM } from '@/lib/mcc';
import '../../alg.css';
import '../lsll.css';

export default function LsllCaseClient() {
  const [kRaw] = useQueryState('k', parseAsString.withDefault(''));

  const decoded = useMemo(() => {
    const key = keyFromString(kRaw);
    if (key === null) return null;
    const state = decodeKey(key);
    if (!state) return null;
    const canon = canonicalState(state);
    return { key: canonicalKey(state), state: canon };
  }, [kRaw]);

  const info = useMemo(() => (decoded ? classify(decoded.state) : null), [decoded]);
  const zbls = useMemo(() => (decoded ? zblsForKey(keyToString(decoded.key)) : null), [decoded]);
  // 镜像 case:纯前端现算(σ 作用在 canonical key 上),不进库、不占体积。
  const mirror = useMemo(() => {
    if (!decoded) return null;
    const mk = mirrorKey(decoded.key);
    const st = decodeKey(mk);
    if (!st) return null;
    return { key: mk, state: st, self: mk === decoded.key, cat: classify(st).category };
  }, [decoded]);
  useDocumentTitle(
    info ? `LSLL ${info.category.letter} #${keyToString(decoded!.key)}` : 'LSLL case',
    info ? `LSLL ${info.category.letter} #${keyToString(decoded!.key)}` : 'LSLL case',
  );

  // 打乱:进入页面即后台现算(两阶段,≈20 步)。
  const [setup, setSetup] = useState<string | null>(null);
  const [setupErr, setSetupErr] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setSetup(null); setSetupErr(false);
    if (!decoded) return;
    import('@/lib/lsll/setup')
      .then((m) => m.setupForCase(decoded.state))
      .then((s) => { if (!cancelled) setSetup(s); })
      .catch(() => { if (!cancelled) setSetupErr(true); });
    return () => { cancelled = true; };
  }, [decoded]);

  // 公式自测
  const [tryAlg, setTryAlg] = useState('');
  const verdict = useMemo(() => {
    if (!decoded || !tryAlg.trim()) return null;
    return verifyCaseAlg(decoded.state, tryAlg);
  }, [decoded, tryAlg]);
  const tryMcc = useMemo(() => {
    if (!verdict || !verdict.ok) return null;
    const v = algSpeed(tryAlg, false, true);
    return typeof v === 'number' ? v : null;
  }, [verdict, tryAlg]);
  const tryMirrored = useMemo(() => {
    if (!verdict || !verdict.ok || !decoded) return null;
    return mirrorAlgForCase(decoded.state, tryAlg);
  }, [verdict, tryAlg, decoded]);

  if (!decoded || !info) {
    return (
      <div className="alg-root">
        <div className="alg-empty">
          <T zh="无效的 case 编号" en="Invalid case id" />
          {' — '}
          <Link href="/alg/lsll">LSLL</Link>
        </div>
      </div>
    );
  }

  const ks = keyToString(decoded.key);
  return (
    <div className="alg-root">
      <div className="alg-cat-header">
        <Link href={`/alg/lsll/${info.category.slug}`} className="alg-back">
          <ArrowLeft size={14} /> {info.category.letter}
        </Link>
        <h1 className="alg-cat-title"><span>{info.category.letter} <span className="alg-cat-count">#{ks}</span></span></h1>
      </div>

      <div className="lsll-case-head">
        <FaceletsCube fd={caseFacelets(decoded.state)} size={200} alt={`case ${ks}`} />
        <dl className="lsll-meta">
          <dt>{tr({ zh: '大类', en: 'Family' })}</dt>
          <dd>{info.category.letter}</dd>
          <dt>{tr({ zh: '顶层翻棱', en: 'Bad edges' })}</dt>
          <dd>{info.eoBad}</dd>
          <dt>{tr({ zh: '顶层扭角', en: 'Twisted corners' })}</dt>
          <dd>{info.coTwisted}</dd>
          <dt>{tr({ zh: '编号', en: 'Case id' })}</dt>
          <dd><code>{ks}</code></dd>
        </dl>
      </div>

      {mirror && (
        <section className="lsll-section">
          <h2>{tr({ zh: '镜像', en: 'Mirror' })}</h2>
          {mirror.self ? (
            <div className="lsll-note">
              <T zh="自镜像 case —— 镜过去还是它自己(全库 432 个之一)。"
                 en="Self-mirror case — reflecting it gives itself back (one of 432 in the whole set)." />
            </div>
          ) : (
            <div className="lsll-mirror-row">
              <Link href={`/alg/lsll/case?k=${keyToString(mirror.key)}`} className="lsll-mirror-link">
                <FaceletsCube fd={caseFacelets(mirror.state)} size={96} alt={`mirror ${keyToString(mirror.key)}`} />
                <span className="lsll-mirror-name">
                  {mirror.cat.letter} <code>#{keyToString(mirror.key)}</code>
                </span>
              </Link>
              <p className="lsll-note">
                <T zh={<>沿过 FR 与 BL 两条棱的对角面镜过去的 case。它与本 case 步数相同,
                  会的公式逐招式重写(<code>U↔U&apos;</code>、<code>R↔F&apos;</code>、<code>L↔B&apos;</code>)就能直接用。</>}
                   en={<>The case across the diagonal plane through the FR and BL edges. Same move count as this one —
                  rewrite any alg you know move by move (<code>U↔U&apos;</code>, <code>R↔F&apos;</code>, <code>L↔B&apos;</code>) and it applies.</>} />
              </p>
            </div>
          )}
        </section>
      )}

      <section className="lsll-section">
        <h2>{tr({ zh: '打乱', en: 'Scramble' })}</h2>
        {setup && (
          <div className="lsll-alg-line">
            <span>{setup}</span>
            <button type="button" className="lsll-copy-btn" onClick={() => { void navigator.clipboard?.writeText(setup); }}>
              {tr({ zh: '复制', en: 'Copy' })}
            </button>
          </div>
        )}
        {!setup && !setupErr && <div className="lsll-note">{tr({ zh: '生成中…', en: 'Generating…' })}</div>}
        {setupErr && <div className="lsll-note">{tr({ zh: '生成失败,刷新重试', en: 'Failed — refresh to retry' })}</div>}
      </section>

      <section className="lsll-section">
        <h2>{tr({ zh: 'HTM 最优解', en: 'Optimal (HTM)' })}</h2>
        <div className="lsll-note">
          <T zh="待批量求解管道回填(全部最优解 + 次优候选)。" en="Pending the batch solver pipeline (all optimal solutions + near-optimal candidates)." />
        </div>
      </section>

      <section className="lsll-section">
        <h2>{tr({ zh: '人类公式', en: 'Human algs' })}</h2>
        {zbls && zbls.length > 0 ? (
          <div className="lsll-zbls-refs">
            {zbls.map((z) => (
              <Link key={z.slug || z.name} href={`/alg/3x3/zbls/${z.slug}`} prefetch={false} className="lsll-zbls-ref">
                <span className="lsll-zbls-name">ZBLS {z.name}</span>
                <span className="lsll-zbls-count">
                  {tr({ zh: `${z.algCount} 条公式`, en: `${z.algCount} alg${z.algCount === 1 ? '' : 's'}` })}
                </span>
              </Link>
            ))}
            <p className="lsll-note">
              <T zh="本 case 已收录于 ZBLS 公式库(精选人类公式 + 训练器);点开查看。全量 MCC 排序待批量管道。"
                 en="This case is in the ZBLS library (curated human algs + trainer) — open to view. Full MCC ranking pending the batch pipeline." />
            </p>
          </div>
        ) : (
          <div className="lsll-note">
            <T zh="暂无收录的人类公式;待批量管道按 MCC(忽略首尾 U 步)排序回填。"
               en="No curated human alg yet — pending the batch pipeline (ranked by MCC, ignoring leading/trailing U)." />
          </div>
        )}
      </section>

      <section className="lsll-section">
        <h2>{tr({ zh: '公式自测', en: 'Try your alg' })}</h2>
        <span className="lsll-locate-field" style={{ maxWidth: 420 }}>
          <input
            className="lsll-verify-input"
            value={tryAlg}
            onChange={(e) => setTryAlg(e.target.value)}
            placeholder={tr({ zh: '输入公式验证是否解掉该 case(允许结尾 AUF)', en: 'Type an alg — solved check allows final AUF' })}
            spellCheck={false}
          />
          {tryAlg && <ClearButton onClick={() => setTryAlg('')} />}
        </span>
        {verdict && verdict.ok && (
          <>
            <div className="lsll-verify-ok">
              ✓ {tr({ zh: '解掉了', en: 'Solved' })}
              {' · '}{getSTM(tryAlg, true)} STM
              {tryMcc !== null && <> · MCC {tryMcc}</>}
            </div>
            {tryMirrored && mirror && !mirror.self && (
              <div className="lsll-note">
                {tr({ zh: '镜像公式(解镜像 case):', en: 'Mirrored alg (solves the mirror case): ' })}
                <code>{tryMirrored}</code>
              </div>
            )}
          </>
        )}
        {verdict && !verdict.ok && (
          <div className="lsll-verify-bad">
            {verdict.reason === 'bad-token'
              ? <T zh={<>无法解析:{verdict.detail}(只支持 U R F D L B 面转)</>} en={<>Cannot parse: {verdict.detail} (face turns only)</>} />
              : <T zh="没有解掉该 case" en="Does not solve this case" />}
          </div>
        )}
      </section>

      <section className="lsll-section">
        <h2>{tr({ zh: '用户提交', en: 'Submissions' })}</h2>
        <div className="lsll-note">
          <T zh="提交通道开发中:登录后可为该 case 提交你的公式,入库前会自动验证 + 算 MCC。" en="Coming soon: submit your alg for this case after signing in — verified and MCC-scored automatically." />
        </div>
      </section>
    </div>
  );
}
