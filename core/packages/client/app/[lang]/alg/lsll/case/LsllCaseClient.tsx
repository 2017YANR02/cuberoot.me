'use client';

/**
 * /alg/lsll/case?k=<base36 key> — 单 case 页。
 * 现阶段:状态图 + 构型信息 + 打乱(cubing.js 两阶段现算)+ HTM 最优解(后端 lsll_cases)
 * + 公式自测(本地验证 + MCC)。MCC 推荐 / 用户提交仍待做(见 ../PLAN.md)。
 *
 * 最优解来自本地管道 `solver/lsll`,解的是**展示相位**那个代表元(语料生成时就钉死了),
 * 所以贴到页面上的图直接能用,不用再补 AUF。
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
  keyFromString, keyToString, decodeKey, canonicalKey, displayState, classify,
  caseFacelets, verifyCaseAlg,
} from '@/lib/lsll/model';
import { zblsForKey } from '@/lib/lsll/zbls_overlay';
import { mirrorKey, mirrorAlgForCase } from '@/lib/lsll/mirror';
import { algSpeed, getSTM } from '@/lib/mcc';
import { apiUrl } from '@/lib/api-base';
import '../../alg.css';
import '../lsll.css';

/**
 * `exhaustive=false` = 只拿到一条最优解(cubeopt/h48 的 wasm 吐不出全部最优解),
 * 此时 `qtm` 是**这一条**的 QTM,不是所有最优解里最小的 —— 页面必须照实说,别显得已经穷尽了。
 */
interface OptimalOk { status: 'ok'; htm: number; qtm: number; exhaustive: boolean; algs: string[] }
type OptimalResponse = OptimalOk | { status: 'pending' };
type OptimalState =
  | { kind: 'loading' } | { kind: 'pending' } | { kind: 'error' } | { kind: 'ok'; data: OptimalOk };

export default function LsllCaseClient() {
  const [kRaw] = useQueryState('k', parseAsString.withDefault(''));

  const decoded = useMemo(() => {
    const key = keyFromString(kRaw);
    if (key === null) return null;
    const state = decodeKey(key);
    if (!state) return null;
    // 图 / 打乱 / 自测都用展示相位(对子摆正的那一个代表元),编号仍是 canonical key。
    return { key: canonicalKey(state), state: displayState(state) };
  }, [kRaw]);

  const info = useMemo(() => (decoded ? classify(decoded.state) : null), [decoded]);
  const zbls = useMemo(() => (decoded ? zblsForKey(keyToString(decoded.key)) : null), [decoded]);
  // 镜像 case:纯前端现算(σ 作用在 canonical key 上),不进库、不占体积。
  const mirror = useMemo(() => {
    if (!decoded) return null;
    const mk = mirrorKey(decoded.key);
    const st = decodeKey(mk);
    if (!st) return null;
    return { key: mk, state: displayState(st), self: mk === decoded.key, cat: classify(st).category };
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

  // HTM 最优解:后端 lsll_cases(本地管道回填)。没回填到的 case 返 { status: 'pending' }。
  const [opt, setOpt] = useState<OptimalState>({ kind: 'loading' });
  useEffect(() => {
    let cancelled = false;
    setOpt({ kind: 'loading' });
    if (!decoded) return;
    fetch(apiUrl(`/v1/alg/lsll/case/${keyToString(decoded.key)}`))
      // 404 = 端点还没部署到这个环境(本地 dev 的 /v1 是反代线上的)—— 与「这个 case 还没算」
      // 对用户是同一件事:没数据。别红着脸说「读取失败」。
      .then((r) => (r.ok ? r.json() : r.status === 404 ? { status: 'pending' } : Promise.reject(new Error(String(r.status)))))
      .then((d: OptimalResponse) => {
        if (cancelled) return;
        setOpt(d.status === 'ok' ? { kind: 'ok', data: d } : { kind: 'pending' });
      })
      .catch(() => { if (!cancelled) setOpt({ kind: 'error' }); });
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
        {opt.kind === 'loading' && <div className="lsll-note">{tr({ zh: '读取中…', en: 'Loading…' })}</div>}
        {opt.kind === 'error' && <div className="lsll-note">{tr({ zh: '读取失败,刷新重试', en: 'Failed — refresh to retry' })}</div>}
        {opt.kind === 'pending' && (
          <div className="lsll-note">
            <T zh="计算中 —— 批量求解管道还没算到这个 case。" en="Computing — the batch solver pipeline has not reached this case yet." />
          </div>
        )}
        {opt.kind === 'ok' && (
          <>
            <div className="lsll-opt-head">
              {opt.data.htm} HTM · {opt.data.qtm} QTM
            </div>
            <div className="lsll-opt-algs">
              {opt.data.algs.map((a) => (
                <div className="lsll-alg-line" key={a}>
                  <span>{a}</span>
                  <span className="lsll-opt-metric">{getSTM(a, true)} STM</span>
                  <button type="button" className="lsll-copy-btn" onClick={() => { void navigator.clipboard?.writeText(a); }}>
                    {tr({ zh: '复制', en: 'Copy' })}
                  </button>
                </div>
              ))}
            </div>
            <p className="lsll-note">
              {opt.data.exhaustive
                ? <T zh="以上是全部「HTM 最优且其中 QTM 最小」的解。"
                     en="These are every solution that is HTM-optimal and, among those, QTM-minimal." />
                : <T zh={<>步数 {opt.data.htm} 是确定的最优值;这里只给出<strong>一条</strong>最优解,
                          QTM 并列还没穷尽,所以上面那个 QTM 是这一条的,未必是所有最优解里最小的。</>}
                     en={<>The length {opt.data.htm} is the proven optimum, but only <strong>one</strong> optimal
                          solution is stored — QTM ties are not exhausted, so the QTM shown is this solution&rsquo;s,
                          not necessarily the minimum across all optimal solutions.</>} />}
            </p>
          </>
        )}
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
