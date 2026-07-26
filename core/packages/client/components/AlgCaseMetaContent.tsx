'use client';

/**
 * case 富元数据的**正文**(顶部关联缩略图 + 公式 + 编号 / 对称性 / 概率 / 最优解 …)。
 *
 * 同一份正文喂两个外壳:
 *   - {@link AlgCaseMetaModal} —— 训练页里的弹窗,点关联缩略图是**切弹窗**(`jump.onJump`)
 *   - `AlgCaseDetailClient` —— 独立详情页,点关联缩略图是**跳到那个 case 的详情页**(`jump.href`,真 <a>)
 *
 * 镜像 / 逆 / 镜像逆存的是**表编号**(`meta.no`),不是 DB id;三者关联全落在本 set 内,
 * 所以 `byNo` 一定查得到(查不到只显示编号,不猜)。背景见 AlgCaseMetaModal 顶部注释。
 */
import { useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import Link from '@/components/AppLink';
import type { AlgCase, AlgCaseMeta, AlgPuzzle } from '@cuberoot/shared';
import { stm } from '@cuberoot/shared/alg-notation';
import { CaseThumb } from '@/components/CaseThumb';
import { useCopy } from '@/hooks/useCopy';
import { ALG_SET_UNIVERSE, LL_UNIVERSE_TOTAL, caseOrbit, probabilityFraction } from '@/lib/alg_probability';
import { ALG_TAG_LABEL } from '@/lib/alg_tags';
import { primaryCaseName } from '@/lib/alg_case_display';
import { displayAlg } from '@/lib/alg_display';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
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

/** 关联缩略图点击后怎么走:弹窗切换(callback)还是跳详情页(link,真 <a>) */
export type RelatedJump =
  | { kind: 'callback'; onJump: (c: AlgCase) => void }
  | { kind: 'link'; href: (c: AlgCase) => string };

interface Props {
  caseObj: AlgCase;
  puzzle: AlgPuzzle;
  set: string;
  /** 同一个 set 里的 `meta.no` → case,用来把镜像/逆做成链接 */
  byNo: Map<number, AlgCase>;
  jump: RelatedJump;
  /**
   * 公式列表的外壳 / 每一行的外壳。默认原样返回 —— 只有 case 详情页的 admin 会传:
   * 它拿这两个口子把公式行包进 dnd-kit(DndContext + SortableAlgRow),好拖顺序。
   * 展示逻辑仍在这里,不在外面复制一份 AlgLine。
   */
  algsWrap?: (rows: React.ReactNode) => React.ReactNode;
  algRowWrap?: (row: React.ReactNode, index: number) => React.ReactNode;
}

export default function AlgCaseMetaContent({
  caseObj, puzzle, set, byNo, jump,
  algsWrap = (rows) => rows,
  algRowWrap = (row) => row,
}: Props) {
  const m = caseObj.meta as AlgCaseMeta;

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

  /**
   * 这一族:当前 case + 镜像 / 逆 / 镜像逆,拆成三堆。
   *   `family`    有图可贴的(含当前那张),按 `meta.no` 排 —— 这一族无论从哪张进来都是同一批,
   *               按编号排就得到同一个顺序,所以点来点去图不换位。
   *   `selfNotes` 该关联项就是当前 case 自己(自镜像 / 自逆),只标一句话。
   *   `missing`   编号在本 set 里查不到对应 case(数据缺口),只报编号。
   */
  const { family, selfNotes, missing } = useMemo(() => {
    const rels = [
      { key: 'mirror', label: tr({ zh: '镜像', en: 'Mirror' }), self: tr({ zh: '自镜像', en: 'self-mirror' }), no: m.mirror },
      { key: 'inv', label: tr({ zh: '逆', en: 'Inverse' }), self: tr({ zh: '自逆', en: 'self-inverse' }), no: m.inv },
      { key: 'im', label: tr({ zh: '镜像逆', en: 'Inv. mirror' }), self: tr({ zh: '自镜像逆', en: 'self-inv-mirror' }), no: m.im },
    ].filter(r => r.no != null);

    const fam: Array<{ key: string; label: string; case: AlgCase; no: number; current: boolean }> = [{
      key: 'self',
      label: tr({ zh: '原始', en: 'Origin' }),
      case: caseObj,
      no: m.no ?? -1,
      current: true,
    }];
    const notes: Array<{ key: string; text: string }> = [];
    const gone: Array<{ key: string; label: string; no: number }> = [];

    for (const r of rels) {
      if (r.no === m.no) { notes.push({ key: r.key, text: r.self }); continue; }
      const target = byNo.get(r.no!);
      if (!target) { gone.push({ key: r.key, label: r.label, no: r.no! }); continue; }
      fam.push({ key: r.key, label: r.label, case: target, no: r.no!, current: false });
    }
    fam.sort((a, b) => a.no - b.no);
    return { family: fam, selfNotes: notes, missing: gone };
  }, [m.mirror, m.inv, m.im, m.no, byNo, caseObj]);

  const sym = m.sym ?? {};
  const symFlags = [
    sym.selfMirror && tr({ zh: '自镜像', en: 'self-mirror' }),
    sym.selfInv && tr({ zh: '自逆', en: 'self-inverse' }),
    sym.full && tr({ zh: '全对称', en: 'full' }),
    sym.anti && tr({ zh: '反对称', en: 'anti' }),
  ].filter(Boolean) as string[];

  const optimal = Object.entries(m.optimal ?? {}) as Array<[string, { len: number; scramble?: string }]>;

  return (
    <>
      {/* 顶部一排缩略图:这一族(自己 + 镜像 / 逆 / 镜像逆)并排对比。
          点其中一张:弹窗里切成那个 case,详情页里跳到那个 case 的详情页。

          位置按 `meta.no` 排,**不按与当前 case 的关系排** —— 这一族四个 case 无论从哪一张
          进来都是同一批,按编号排就是同一个顺序,点来点去图不会互相换位。标签仍是相对当前
          case 说的(在镜像那张上,当前这张就标「镜像」),当前那张恒定加框。 */}
      <div className="alg-meta-related-grid alg-meta-top-grid">
        {family.map(f => {
          const inner = (
            <>
              <CaseThumb
                puzzle={puzzle}
                set={set}
                sticker={f.case.sticker}
                alg={f.case.algs[0]?.[0]?.alg || f.case.setup || ''}
                setup={f.case.setup}
                size={76}
              />
              <span className="alg-meta-related-label">{f.label}</span>
              <span className="alg-meta-related-name">{primaryCaseName(puzzle, set, f.case)}</span>
            </>
          );
          // 当前这张不是跳转目标,只是参照 —— 不给 hover、不可点。
          if (f.current) {
            return (
              <div key={f.key} className="alg-meta-related-card is-self is-current">{inner}</div>
            );
          }
          const title = tr({ zh: `跳到${f.label}`, en: `Go to ${f.label.toLowerCase()}` });
          if (jump.kind === 'link') {
            return (
              <Link key={f.key} href={jump.href(f.case)} className="alg-meta-related-card" prefetch={false} title={title}>
                {inner}
              </Link>
            );
          }
          return (
            <button key={f.key} type="button" className="alg-meta-related-card" onClick={() => jump.onJump(f.case)} title={title}>
              {inner}
            </button>
          );
        })}
        {/* 自镜像 / 自逆:那一项就是当前 case 本身,不重复贴一张一样的图,只标一句。
            上面的空占位把这行文字压到与带图卡片的 label 行同一条水平线上。 */}
        {selfNotes.map(n => (
          <div key={n.key} className="alg-meta-related-card is-plain">
            <span className="alg-meta-related-thumb-gap" aria-hidden="true" />
            <span className="alg-meta-related-label">{n.text}</span>
          </div>
        ))}
        {/* 关联编号在本 set 里找不到对应 case(数据缺口),只报编号。 */}
        {missing.map(x => (
          <div key={x.key} className="alg-meta-related-card is-plain">
            <span className="alg-meta-related-thumb-gap" aria-hidden="true" />
            <span className="alg-meta-related-label">{x.label}</span>
            <span className="alg-meta-related-name">#{x.no}</span>
          </div>
        ))}
      </div>

      <div className="alg-meta-case">
        <div className="alg-meta-case-algs">
          {algsWrap(algs.map((a, i) => algRowWrap(
            <AlgLine
              key={a.key}
              label={a.tags.map(t => ALG_TAG_LABEL[t]()).join(' ')}
              alg={a.text}
              len={a.len}
            />,
            i,
          )))}
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
    </>
  );
}
