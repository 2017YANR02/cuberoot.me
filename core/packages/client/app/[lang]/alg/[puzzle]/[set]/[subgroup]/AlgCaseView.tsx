'use client';

/**
 * 单张 case 的**独立详情页**正文(短链 `/alg/<puzzle>/<set>/<slug>`,如 `/alg/3x3/zbll/ur3`)。
 *
 * 由 {@link AlgSubOrCaseClient} 在「slug 不是子组、是某张 case」时渲染,数据(整个 set)
 * 已在上层加载好,原样传进来 —— 不重复拉。
 *
 * 两种正文,按有没有富元数据分流:
 *  - 有 `meta`(zbll / 1lll / pll / ell):复用 {@link AlgCaseMetaContent}(镜像/逆/概率/最优解…),
 *    关联缩略图走 `jump:'link'`(真 <a>,中键可新开),slug 从全集唯一表拿。
 *  - 无 `meta`(f2l / oll / coll / cmll / zbls …):精简正文 —— 大魔方图 + 可播放公式行。
 *  - 两者都挂社区公式(登录用户可加/改自己的)。
 */
import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { ArrowLeft, ExternalLink, Copy, Check, Shuffle } from 'lucide-react';
import type { AlgCase, AlgEntry, AlgFile, AlgPuzzle, AlgSubmission } from '@cuberoot/shared';
import { stm } from '@cuberoot/shared/alg-notation';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import AlgCaseMetaContent from '@/components/AlgCaseMetaContent';
import { CaseThumb } from '@/components/CaseThumb';
import AlgPlayer from '@/components/AlgPlayer';
import CommunityAlgs from '@/components/CommunityAlgs';
import { algCaseHref, algCaseDetailHref, buildCaseSlugMap } from '@/lib/alg_case_link';
import { primaryCaseName, displayAlgCaseName } from '@/lib/alg_case_display';
import { displayAlg } from '@/lib/alg_display';
import { listSubmissions } from '@/lib/alg_api';
import { useCopy } from '@/hooks/useCopy';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';

/** 打乱行(和列表卡片同款,sq1 之类会重排格式)。 */
function SetupLine({ puzzle, setup }: { puzzle: string; setup: string }) {
  const { copied, copy } = useCopy();
  const text = formatScrambleForEvent(puzzle, setup);
  return (
    <div className="alg-case-standard">
      <Shuffle size={13} className="alg-case-icon" aria-label={tr({ zh: '打乱', en: 'Setup' })} />
      <code>{text}</code>
      <button type="button" className="alg-alg-copy-btn alg-case-setup-copy" onClick={() => copy(text)} title={tr({ zh: '复制打乱', en: 'Copy setup' })}>
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}

/** 可播放的公式行(点一下展开 3D 动画)。非 meta 精简正文用,复用列表的 .alg-alg-* 样式。 */
function PlayableAlgRow({ entry, puzzle, set, setup }: { entry: AlgEntry; puzzle: AlgPuzzle; set: string; setup?: string }) {
  const [open, setOpen] = useState(false);
  const { copied, copy } = useCopy();
  const shown = formatScrambleForEvent(puzzle, displayAlg(entry.alg));
  const len = entry.stm == null ? null : stm(displayAlg(entry.alg));
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={`alg-alg-row${open ? ' is-expanded' : ''}`}
        onClick={() => setOpen(o => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
        title={open ? 'collapse' : 'play'}
      >
        <span className="alg-alg-text">{shown}</span>
        {len != null && <span className="alg-alg-len" title="STM">{len}</span>}
        <button type="button" className="alg-alg-copy-btn" onClick={(e) => { e.stopPropagation(); copy(shown); }} title="copy">
          {copied ? <Check size={14} /> : <Copy size={14} className="alg-alg-copy-icon" />}
        </button>
      </div>
      {open && <AlgPlayer alg={entry.alg} puzzle={puzzle} set={set} setup={setup} />}
    </>
  );
}

export default function AlgCaseView({ puzzle, set, caseObj, data }: { puzzle: AlgPuzzle; set: string; caseObj: AlgCase; data: AlgFile }) {
  const m = caseObj.meta;
  const primary = primaryCaseName(puzzle, set, caseObj);
  // 副名:meta case 的原始站名(`ZBLL U 1`)、非 meta 的原始名 —— 和主名不同才显示,免重复。
  const sub = displayAlgCaseName(puzzle, set, caseObj.name);
  const showSub = sub && sub !== primary;
  useDocumentTitle(primary, primary);

  // 「返回」→ case 所在的子组列表页(带 #name 高亮那张卡)。是有明确目标的导航,不是 history.back。
  const backHref = algCaseHref(puzzle, set, caseObj);

  /** meta.no → case,给镜像/逆做详情页之间的链接(表编号,不是 DB id)。 */
  const byNo = useMemo(() => {
    const map = new Map<number, AlgCase>();
    for (const c of data.cases) if (c.meta?.no != null) map.set(c.meta.no, c);
    return map;
  }, [data]);

  /** 全集唯一 slug 表(生成关联链接 / 社区区都要);和列表页、落地解析同一份算法。 */
  const slugMap = useMemo(() => buildCaseSlugMap(data.cases, set), [data, set]);
  const hrefFor = (c: AlgCase) =>
    algCaseDetailHref(puzzle, set, (c.id != null && slugMap.byId.get(c.id)) || '');

  // 社区公式:只这张 case 的。
  const [submissions, setSubmissions] = useState<AlgSubmission[]>([]);
  useEffect(() => {
    let live = true;
    listSubmissions(puzzle, set)
      .then(all => { if (live) setSubmissions(all.filter(s => s.caseName === caseObj.name)); })
      .catch(() => { if (live) setSubmissions([]); });
    return () => { live = false; };
  }, [puzzle, set, caseObj.name]);

  const oriNames = caseObj.oriNames;
  const multiOri = !!oriNames && oriNames.length > 1;

  return (
    <div className="alg-case-detail">
      <div className="alg-case-detail-head">
        <Link href={backHref} className="alg-case-detail-back" prefetch={false}>
          <ArrowLeft size={16} />
          <span>{tr({ zh: '返回', en: 'Back' })}</span>
        </Link>
        <h1 className="alg-case-detail-title">
          {primary}
          {showSub && <span className="alg-meta-head-sub">{sub}</span>}
          <Link href={backHref} className="alg-meta-head-open" prefetch={false} title={tr({ zh: '在列表中打开', en: 'Open in the list' })}>
            <ExternalLink size={14} />
          </Link>
        </h1>
      </div>

      {m ? (
        <div className="alg-meta-body alg-case-detail-body">
          <AlgCaseMetaContent
            caseObj={caseObj}
            puzzle={puzzle}
            set={set}
            byNo={byNo}
            jump={{ kind: 'link', href: hrefFor }}
          />
        </div>
      ) : (
        <div className="alg-case-detail-lean">
          <div className="alg-case-detail-lean-thumb">
            <CaseThumb puzzle={puzzle} set={set} sticker={caseObj.sticker} alg={caseObj.algs[0]?.[0]?.alg || caseObj.setup || ''} setup={caseObj.setup} size={150} />
          </div>
          {caseObj.setup && <SetupLine puzzle={puzzle} setup={caseObj.setup} />}
          <div className="alg-case-detail-lean-algs">
            {caseObj.algs.map((oriAlgs, oi) => (
              <div key={oi} className="alg-case-detail-ori">
                {multiOri && <div className="alg-case-detail-ori-label">{oriNames![oi]}</div>}
                {oriAlgs.map((entry, i) => (
                  <PlayableAlgRow key={`${oi}:${i}`} entry={entry} puzzle={puzzle} set={set} setup={caseObj.setup} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <CommunityAlgs
        puzzle={puzzle}
        setSlug={set}
        caseName={caseObj.name}
        sticker={caseObj.sticker}
        setup={caseObj.setup}
        firstAlg={caseObj.algs[0]?.[0]?.alg}
        submissions={submissions}
        onPatch={(action) => {
          setSubmissions(prev => {
            if (action.type === 'add') return [...prev, action.submission];
            if (action.type === 'update') return prev.map(s => s.id === action.submission.id ? action.submission : s);
            return prev.filter(s => s.id !== action.id);
          });
        }}
      />
    </div>
  );
}
