'use client';

/**
 * case 的富元数据弹窗(1lll / zbll / pll / ell —— 从站长自编的那张 1LLL 表导入的才有)。
 *
 * 为什么是弹窗:元数据有 20 来个字段(6 套打乱、4 套最优解、对称性、镜像/逆的编号……),
 * 铺进 case 卡片会把主视图挤爆(docs/1lll-migration.md B10)。
 *
 * 镜像 / 逆 / 镜像逆存的是**表编号**(`meta.no`),不是 DB id。实测 3915 个 case 的这三个
 * 关联**全部落在本 set 内**(镜像、逆都保持「角是否已朝向」⟹ ZBLL 的镜像还是 ZBLL),
 * 所以链接一条都不死。真找不到也只显示编号,不去猜。
 *
 * 弹窗自带缩略图 + 公式:跳过去的那个 case 多半在**别的组**,身后的列表根本没渲染它 ——
 * 只给元数据的话,「跳到镜像」等于跳进一片空白。要看动画 / 训练走「在列表中打开」。
 */
import { useEffect, useMemo } from 'react';
import { X, Copy, Check, ExternalLink } from 'lucide-react';
import Link from '@/components/AppLink';
import type { AlgCase, AlgCaseMeta, AlgPuzzle } from '@cuberoot/shared';
import { stm } from '@cuberoot/shared/alg-notation';
import { CaseThumb } from '@/components/CaseThumb';
import { useCopy } from '@/hooks/useCopy';
import { ALG_SET_UNIVERSE, LL_UNIVERSE_TOTAL, caseOrbit, probabilityFraction } from '@/lib/alg_probability';
import { ALG_TAG_LABEL } from '@/lib/alg_tags';
import { primaryCaseName } from '@/lib/alg_case_display';
import { algCaseHref } from '@/lib/alg_case_link';
import { displayAlg } from '@/lib/alg_display';
import { formatScrambleForEvent } from '@/lib/sq1-svg';
import { tr } from '@/i18n/tr';

const METRIC_LABEL: Record<string, string> = { stm: 'STM', sqtm: 'SQTM', htm: 'HTM', qtm: 'QTM' };

/** 一行「标签 + 可复制的公式」(`len` 给了就在右边挂步数徽章) */
function AlgLine({ label, alg, len }: { label: string; alg: string; len?: number }) {
  const { copied, copy } = useCopy();
  return (
    <div className="alg-meta-algline">
      <span className="alg-meta-algline-label">{label}</span>
      <code className="alg-meta-algline-code">{alg}</code>
      {len != null && <span className="alg-meta-algline-len" title="STM">{len}</span>}
      <button
        type="button"
        className="alg-meta-copy"
        onClick={() => copy(alg)}
        title={tr({ zh: '复制', en: 'Copy' })}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="alg-meta-row">
      <span className="alg-meta-key">{label}</span>
      <span className="alg-meta-val">{children}</span>
    </div>
  );
}

interface Props {
  caseObj: AlgCase;
  puzzle: AlgPuzzle;
  set: string;
  /** 同一个 set 里的 `meta.no` → case,用来把镜像/逆做成链接 */
  byNo: Map<number, AlgCase>;
  onClose: () => void;
  onJump: (c: AlgCase) => void;
}

export default function AlgCaseMetaModal({ caseObj, puzzle, set, byNo, onClose, onJump }: Props) {
  const m = caseObj.meta as AlgCaseMeta;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /** 首个朝向的公式(1lll / zbll / pll / ell 都只有一个朝向)。显示 / 步数都剥掉收尾 AUF。 */
  const algs = useMemo(() => (caseObj.algs[0] ?? []).map(a => {
    const shown = displayAlg(a.alg);
    return {
      key: a.altId ?? shown,
      text: formatScrambleForEvent(puzzle, shown),
      len: a.stm == null ? undefined : stm(shown),
      tags: a.tags ?? [],
    };
  }), [caseObj.algs, puzzle]);

  /** 「在列表中打开」—— 真 <a>,中键能新开(CLAUDE.md「链接支持中键新开」) */
  const listHref = useMemo(
    () => algCaseHref(puzzle, set, caseObj),
    [caseObj, puzzle, set],
  );

  const related = useMemo(() => ([
    { label: tr({ zh: '镜像', en: 'Mirror' }), no: m.mirror },
    { label: tr({ zh: '逆', en: 'Inverse' }), no: m.inv },
    { label: tr({ zh: '镜像逆', en: 'Inv. mirror' }), no: m.im },
  ].filter(r => r.no != null)), [m.mirror, m.inv, m.im]);

  const sym = m.sym ?? {};
  const symFlags = [
    sym.selfMirror && tr({ zh: '自镜像', en: 'self-mirror' }),
    sym.selfInv && tr({ zh: '自逆', en: 'self-inverse' }),
    sym.full && tr({ zh: '全对称', en: 'full' }),
    sym.anti && tr({ zh: '反对称', en: 'anti' }),
  ].filter(Boolean) as string[];

  const optimal = Object.entries(m.optimal ?? {}) as Array<[string, { len: number; scramble?: string }]>;

  return (
    <div className="alg-admin-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="alg-admin-modal alg-meta-modal" onClick={e => e.stopPropagation()}>
        <div className="alg-admin-modal-head">
          <h2>
            {m.ollcp}
            <span className="alg-meta-head-sub">{caseObj.name}</span>
            {/* 标题旁直达 case 所在列表页(真 <a>,中键可新开) */}
            <Link href={listHref} className="alg-meta-head-open" prefetch={false} title={tr({ zh: '跳转到 case 所在页面', en: 'Open the case in its list page' })}>
              <ExternalLink size={14} />
            </Link>
          </h2>
          <button type="button" className="alg-admin-modal-head-btn" onClick={onClose} title={tr({ zh: '关闭', en: 'Close' })}>
            <X size={16} />
          </button>
        </div>

        <div className="alg-admin-modal-body alg-meta-body">
          {/* 跳到镜像 / 逆之后,这块就是你唯一能看到的「那个 case 长什么样」—— 它多半不在当前这一组里 */}
          <div className="alg-meta-case">
            <div className="alg-meta-case-thumb">
              <CaseThumb
                puzzle={puzzle}
                set={set}
                sticker={caseObj.sticker}
                alg={caseObj.algs[0]?.[0]?.alg || caseObj.setup || ''}
                setup={caseObj.setup}
                size={104}
              />
            </div>
            <div className="alg-meta-case-algs">
              {algs.map(a => (
                <AlgLine
                  key={a.key}
                  label={a.tags.map(t => ALG_TAG_LABEL[t]()).join(' ')}
                  alg={a.text}
                  len={a.len}
                />
              ))}
            </div>
          </div>

          <Row label={tr({ zh: '编号', en: 'No.' })}>{m.no}</Row>
          <Row label={tr({ zh: '子集', en: 'Subset' })}>{m.subset}</Row>
          <Row label="OLL">{m.oll}</Row>
          {m.cp && <Row label={tr({ zh: '角换', en: 'CP' })}>{m.cp}</Row>}
          {m.type && <Row label={tr({ zh: '叠加类型', en: 'Type' })}>{m.type}</Row>}
          {m.gen && <Row label={tr({ zh: '生成元', en: 'Generators' })}><code>{m.gen}</code></Row>}

          {(sym.cn || symFlags.length > 0) && (
            <Row label={tr({ zh: '对称性', en: 'Symmetry' })}>
              {sym.cn && <span className="alg-meta-chip">C{sym.cn}</span>}
              {symFlags.map(f => <span key={f} className="alg-meta-chip">{f}</span>)}
            </Row>
          )}

          {/* 出现概率:轨道大小(16/cn)÷ 全集状态数。非 1LLL set 同时给 1LLL 全集下的概率 ——
              练 ZBLL 的人想知道「ZZ 到了顶层抽到它多大概率」,练 1LLL 的人想知道全局概率。
              数学原理(轨道-稳定子)见 /math/probability。 */}
          {(() => {
            const orbit = caseOrbit(caseObj);
            const uni = ALG_SET_UNIVERSE[set];
            if (orbit == null || !uni) return null;
            return (
              <Row label={tr({ zh: '出现概率', en: 'Probability' })}>
                <span
                  className="alg-meta-chip"
                  title={tr({
                    zh: `${uni.label} 全集 ${uni.total} 个状态中占 ${orbit} 个`,
                    en: `${orbit} of ${uni.total} states in the ${uni.label} universe`,
                  })}
                >
                  {uni.label} {probabilityFraction(orbit, uni.total)}
                </span>
                {set !== '1lll' && (
                  <span
                    className="alg-meta-chip"
                    title={tr({
                      zh: `1LLL 全集 ${LL_UNIVERSE_TOTAL} 个状态中占 ${orbit} 个`,
                      en: `${orbit} of ${LL_UNIVERSE_TOTAL} states in the 1LLL universe`,
                    })}
                  >
                    1LLL {probabilityFraction(orbit, LL_UNIVERSE_TOTAL)}
                  </span>
                )}
                <Link href="/math/probability" className="alg-meta-prob-why" prefetch={false}>
                  {tr({ zh: '原理', en: 'Why?' })}
                </Link>
              </Row>
            );
          })()}

          {/* 镜像 / 逆 / 镜像逆:给图,不给编号 —— 光一个 `O+U7` 你还得先在脑子里把它画出来。
              点图直接把弹窗换成那个 case(它多半在别的组,列表里翻不到)。 */}
          {related.length > 0 && (
            <div className="alg-meta-section">
              <h3>{tr({ zh: '关联', en: 'Related' })}</h3>
              <div className="alg-meta-related-grid">
                {related.map(r => {
                  const target = byNo.get(r.no!);
                  if (!target) {
                    return (
                      <div key={r.label} className="alg-meta-related-card is-plain">
                        <span className="alg-meta-related-label">{r.label}</span>
                        <span className="alg-meta-related-name">#{r.no}</span>
                      </div>
                    );
                  }
                  return (
                    <button
                      key={r.label}
                      type="button"
                      className="alg-meta-related-card"
                      onClick={() => onJump(target)}
                      title={tr({ zh: `跳到${r.label}`, en: `Go to ${r.label.toLowerCase()}` })}
                    >
                      <CaseThumb
                        puzzle={puzzle}
                        set={set}
                        sticker={target.sticker}
                        alg={target.algs[0]?.[0]?.alg || target.setup || ''}
                        setup={target.setup}
                        size={76}
                      />
                      <span className="alg-meta-related-label">{r.label}</span>
                      <span className="alg-meta-related-name">{primaryCaseName(puzzle, set, target)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {m.scramble && (
            <div className="alg-meta-section">
              <h3>{tr({ zh: '打乱', en: 'Scramble' })}</h3>
              <AlgLine label={tr({ zh: '逆 case', en: 'Inv case' })} alg={m.scramble} />
            </div>
          )}

          {optimal.length > 0 && (
            <div className="alg-meta-section">
              <h3>{tr({ zh: '最优解', en: 'Optimal' })}</h3>
              {optimal.map(([metric, o]) => (
                <div key={metric} className="alg-meta-optimal">
                  <span className="alg-meta-optimal-len">
                    {METRIC_LABEL[metric] ?? metric} <strong>{o.len}</strong>
                  </span>
                  {o.scramble && <AlgLine label="" alg={o.scramble} />}
                </div>
              ))}
            </div>
          )}

          {(m.coep?.alg || m.coep?.scramble) && (
            <div className="alg-meta-section">
              <h3>COEP</h3>
              {m.coep.alg && <AlgLine label={tr({ zh: '公式', en: 'Alg' })} alg={m.coep.alg} />}
              {m.coep.scramble && <AlgLine label={tr({ zh: '打乱', en: 'Scramble' })} alg={m.coep.scramble} />}
            </div>
          )}

          {(m.sdbNo || m.docNo || m.oldNo) && (
            <div className="alg-meta-section alg-meta-refs">
              {m.sdbNo && <Row label="speedcubedb">{m.sdbNo}</Row>}
              {m.docNo && <Row label={tr({ zh: '旧编号 (doc)', en: 'Old no. (doc)' })}>{m.docNo}</Row>}
              {m.oldNo && <Row label={tr({ zh: '旧编号', en: 'Old no.' })}>{m.oldNo}</Row>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
