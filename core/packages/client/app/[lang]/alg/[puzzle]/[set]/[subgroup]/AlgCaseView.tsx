'use client';
import { alignAlgFile, caseAlgIssue, loadAlg } from '@/lib/alg_case_alignment';

/**
 * 单张 case 的**独立详情页**正文(短链 `/alg/<puzzle>/<set>/<slug>`,如 `/alg/3x3/zbll/ur3`)。
 *
 * 由 {@link AlgSubOrCaseClient} 在「slug 不是子组、是某张 case」时渲染,数据(整个 set)
 * 已在上层加载好,原样传进来 —— 不重复拉。
 *
 * 两种正文,按有没有富元数据分流:
 *  - 有 `meta`(zbll / 1lll / pll / ell):复用 {@link AlgCaseMetaContent}(镜像/逆/概率/最优解…),
 *    关联缩略图走 `jump:'link'`(真 <a>,中键可新开),slug 从全集唯一表拿。
 *  - 无 `meta`(f2l / oll / coll / cmll / zbls …):精简正文 —— 槽位魔方图 + 可播放公式行。
 *  - 两者都挂社区公式(登录用户可加/改自己的)。
 *
 * AdminCaseEditor supplies editable fields directly to this layout; no separate edit screen.
 */
import { Fragment, useEffect, useMemo, useState, useRef, useId, type ReactNode } from 'react';
import { useAlgCaseEntryTransition } from '@/hooks/useAlgViewTransition';
import Link from '@/components/AppLink';
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Copy, Check, Shuffle, FlipHorizontal2, HelpCircle, AlertTriangle } from '@app-foundation/icons/lucide';
import type { AlgCase, AlgEntry, AlgFile, AlgPuzzle, AlgSubmission } from '@cuberoot/shared';
import { displayedAlgorithmStm } from '@/lib/alg-metrics';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import AlgCaseMetaContent from '@/components/AlgCaseMetaContent';
import { AlgCaseRelationCards, type AlgCaseRelationCardItem } from '@/components/AlgCaseRelationCards';
import CubeOrientationSelect from '@/components/CubeOrientationSelect';
import F2lSolutionGroups from '@/components/F2lSolutionGroups';
import { isF2lStandard } from '@/lib/f2l-solution-groups';
import AlgPlayer from '@/components/AlgPlayer';
import CommunityAlgs from '@/components/CommunityAlgs';
import AdminCaseEditor, { type InlineCaseEditorParts } from '@/components/AdminCaseEditor';
import type { AlgInvalidMark } from '@/components/AlgEditor';
import AlgAdminValidate from '@/components/AlgAdminValidate';
import { SettingsPopover } from '@/components/TrainingSettings';
import AlgImageDownloadButton from '@/components/AlgImageDownloadButton';
import { CaseThumb } from '@/components/CaseThumb';
import { caseImageBatch } from '@/lib/alg-case-images';
import AlgPdfButton from '@/components/AlgPdfButton';
import { algSheetFromCases } from '@/lib/alg_pdf/from_cases';
import {
  cubeThumbParams,
  DEFAULT_ALG_CUBE_ORIENTATION,
  supportsCaseViewAngle,
  supportsCubeOrientation,
} from '@/lib/alg_thumb_plan';
import AlgMirrorPanel, { hasMirror } from '@/components/AlgMirrorPanel';
import { algCaseHref, algCaseDetailHref, buildCaseSlugMap } from '@/lib/alg_case_link';
import { primaryCaseName, displayAlgCaseName } from '@/lib/alg_case_display';
import { compareAlgGroupLabel } from '@/lib/alg_group_order';
import { adjacentAlgCases } from '@/lib/alg_case_navigation';
import {
  CASE_VIEW_ANGLES,
  caseViewAlg,
  caseViewSetup,
  displayCaseScramble,
  displayCaseAlg,
  displayCaseAlgHtml,
  oriAdjustSetup,
  shortOriName,
  type CaseViewAngle,
} from '@/lib/alg_display';
import { listSubmissions } from '@/lib/alg_api';
import { sanitizeAlgHtml } from '@/lib/alg_html';
import { rotateCaseClockwise } from '@/lib/alg_sets_api';
import { useIsAdmin } from '@/lib/auth-store';
import { useCopy } from '@/hooks/useCopy';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { algTagLabel } from '@/lib/alg_tags';
import AlgTagLabel from '@/components/AlgTagLabel';
import { tr } from '@/i18n/tr';
import BoolToggle from '@/components/BoolToggle';
import Sq1NotationSelect from '@/components/Sq1NotationSelect';
import {
  SQ1_NOTATION_MODES,
  sq1NotationText,
  type Sq1NotationMode,
} from '@/lib/sq1-pbl-notation';
import { SCRAMBLE_KINDS, type ScrambleKind } from '@/lib/trainer-scramble';
import { CUBE_ORIENTATIONS } from '@/lib/cube-orientation';
import { parseAsBoolean, parseAsStringEnum } from 'nuqs';
import { useTrainingQueryState as useQueryState } from '@/lib/training-host';

const F2L_DETAIL_ORIENTATION_ORDER = new Map([
  ['FR', 0],
  ['FL', 1],
  ['BR', 2],
  ['BL', 3],
]);

/** 打乱行(和列表卡片同款,sq1 之类会重排格式)。 */
function SetupLine({ puzzle, setup, sq1NotationMode = 'compact' }: {
  puzzle: string;
  setup: string;
  sq1NotationMode?: Sq1NotationMode;
}) {
  const { copied, copy } = useCopy();
  const sq1Text = puzzle === 'sq1' ? sq1NotationText(setup, sq1NotationMode) : null;
  const text = sq1Text ? tr(sq1Text) : formatScrambleForEvent(puzzle, setup);
  return (
    <div className="alg-case-standard alg-case-standard-detail">
      <Shuffle size={13} className="alg-case-icon" aria-label={tr({ zh: '打乱', en: 'Setup' })} />
      <code>{text}</code>
      <button type="button" className="alg-alg-copy-btn alg-case-setup-copy" onClick={() => copy(text)} title={tr({ zh: '复制打乱', en: 'Copy setup' })}>
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}

/** 可播放的公式行:切换同一朝向旁边的共享播放器。 */
function PlayableAlgRow({ entry, puzzle, set, mirror, ori = 0, viewAngle, sq1NotationMode = 'compact', sourceKarnaukh, invalid, selected, onSelect }: {
  entry: AlgEntry; puzzle: AlgPuzzle;
  set: string;
  /** 有值 = 这个 set 吃镜像系统,行尾出 ⧉;`partner` 是伙伴 case 名(没建链时为 null) */
  mirror?: { partner: string | null; self: string };
  /** 这条公式在第几个视角(0=FR),镜像面板要拿它算落点 */
  ori?: number;
  viewAngle: CaseViewAngle;
  sq1NotationMode?: Sq1NotationMode;
  /** PBL 的 note 是原表卡脑壳记号；其他套系的 note 仍是普通说明。 */
  sourceKarnaukh?: boolean;
  invalid?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const [mirrorOpen, setMirrorOpen] = useState(false);
  const { copied, copy } = useCopy();
  const angledAlg = displayCaseAlg(puzzle, set, caseViewAlg(entry.alg, viewAngle));
  const issue = caseAlgIssue(entry);
  const invalidReason = invalid ?? issue;
  const shown = formatScrambleForEvent(puzzle, angledAlg);
  const sq1Notation = puzzle === 'sq1'
    ? sq1NotationText(angledAlg, sq1NotationMode, sourceKarnaukh ? entry.note : undefined)
    : null;
  const shownText = sq1Notation ? tr(sq1Notation) : shown;
  const isKarnaukh = puzzle === 'sq1' && sq1NotationMode === 'karnaukh';
  const len = displayedAlgorithmStm(puzzle, angledAlg);
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={`alg-alg-row${selected ? ' is-expanded' : ''}${invalidReason ? ' is-invalid' : ''}`}
        title={invalidReason}
        aria-disabled={!!issue}
        aria-pressed={selected}
        onClick={() => { if (!issue) onSelect(); }}
        onKeyDown={(e) => { if (!issue && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(); } }}
      >
        {invalidReason && <AlertTriangle size={13} className="alg-alg-invalid-icon" aria-label={invalidReason} />}
        <span className={`alg-alg-text${isKarnaukh ? ' is-karnaukh' : ''}`}>
          {sq1Notation
            ? shownText
            : entry.algHtml && viewAngle === 'default' && puzzle !== 'sq1'
            ? <span dangerouslySetInnerHTML={{ __html: sanitizeAlgHtml(displayCaseAlgHtml(puzzle, set, entry.algHtml)) }} />
            : shown}
          {!sourceKarnaukh && entry.note && <span className="alg-alg-note">({tr(entry.note)})</span>}
          {issue && <span className="alg-alg-note">{tr({ zh: '（原公式与本图不匹配）', en: '(Source algorithm does not match this case)' })}</span>}
        </span>
        {entry.tags?.map(tag => (
          <span key={tag} className={`alg-tag alg-tag-${tag}`}>
            <AlgTagLabel tag={tag} label={algTagLabel(tag)} />
          </span>
        ))}
        {len != null && <span className="alg-alg-len" title="STM">{len}</span>}
        {mirror && !issue && (
          <button
            type="button"
            className={`alg-mirror-toggle${mirrorOpen ? ' is-on' : ''}`}
            aria-expanded={mirrorOpen}
            onClick={(e) => { e.stopPropagation(); setMirrorOpen(o => !o); }}
            title={tr({ zh: '镜像公式', en: 'Mirrored algs' })}
          >
            <FlipHorizontal2 size={14} />
          </button>
        )}
        <button type="button" className="alg-alg-copy-btn" disabled={!!issue} onClick={(e) => { e.stopPropagation(); copy(shownText); }} title="copy">
          {copied ? <Check size={14} /> : <Copy size={14} className="alg-alg-copy-icon" />}
        </button>
      </div>
      {mirror && mirrorOpen && (
        <AlgMirrorPanel alg={angledAlg} puzzle={puzzle} mirrorName={mirror.partner} selfName={mirror.self} ori={ori} />
      )}
    </>
  );
}

function CaseDetailsTabs({ metadata, advanced }: { metadata: ReactNode; advanced?: ReactNode }) {
  const [active, setActive] = useState(0);
  const id = useId();
  const tabs = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const labels = [tr({ zh: '元信息', en: 'Metadata' }), ...(advanced ? [tr({ zh: '高级', en: 'Advanced' })] : [])];
  const selected = Math.min(active, labels.length - 1);
  return <section className="alg-case-details-tabs">
    <div ref={tabs} role="tablist" aria-label={tr({ zh: 'Case 信息', en: 'Case details' })}>
      {labels.map((label, index) => <button key={index} type="button" role="tab" id={`${id}-tab-${index}`}
        aria-controls={`${id}-panel-${index}`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1}
        onClick={() => setActive(index)} onKeyDown={event => {
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? labels.length - 1
            : event.key === 'ArrowRight' ? (index + 1) % labels.length
              : event.key === 'ArrowLeft' ? (index + labels.length - 1) % labels.length : null;
          if (next === null) return;
          event.preventDefault();
          setActive(next);
          tabs.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
        }}>{label}</button>)}
    </div>
    <div className="alg-case-details-viewport" onTouchStart={event => {
      if ((event.target as HTMLElement).closest('input, textarea, select, button, a')) return;
      const point = event.touches[0];
      touch.current = point ? { x: point.clientX, y: point.clientY } : null;
    }} onTouchCancel={() => { touch.current = null; }} onTouchEnd={event => {
      const start = touch.current;
      touch.current = null;
      const point = event.changedTouches[0];
      if (!start || !point) return;
      const dx = point.clientX - start.x;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(point.clientY - start.y) * 1.5) return;
      setActive(current => Math.max(0, Math.min(labels.length - 1, current + (dx < 0 ? 1 : -1))));
    }}>
      <div className="alg-case-details-track" style={{ transform: `translateX(-${selected * 50}%)` }}>
        {[metadata, ...(advanced ? [advanced] : [])].map((content, index) => <div key={index} role="tabpanel"
          id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} tabIndex={0}
          aria-hidden={selected !== index} inert={selected !== index} className={selected === index ? 'is-active' : undefined}>
          {content}
        </div>)}
      </div>
    </div>
  </section>;
}

export default function AlgCaseView({ puzzle, set, caseObj: caseProp, data, embedded = false, onEmbeddedCaseChange }: { puzzle: AlgPuzzle; set: string; caseObj: AlgCase; data: AlgFile; embedded?: boolean; onEmbeddedCaseChange?: (href: string) => void; }) {
  /**
   * 显示的这张 case 自己拿一份 —— admin 改完 / 拖完就地更新,不回写上层的 `data`:
   * 上层是按 **slug** 解析出这张 case 的,改了名字再回写会当场解析失败(整页变「没找到」)。
   * 代价是关联缩略图(镜像/逆)那份 `data` 会短暂过期,刷新即一致。
   */
  const [caseObj, setCaseObj] = useState(caseProp);
  const motionRoot = useRef<HTMLDivElement>(null);
  useAlgCaseEntryTransition(motionRoot, String(caseObj.id ?? caseObj.name), !embedded);
  const [insertionCases, setInsertionCases] = useState(data.cases);
  useEffect(() => { setInsertionCases(data.cases); }, [data.cases]);
  useEffect(() => {
    if (puzzle !== '3x3' || set !== 'f2l') return;
    let live = true;
    let reading = false;
    const refresh = async () => {
      if (reading || document.visibilityState === 'hidden') return;
      reading = true;
      try {
        const fresh = await loadAlg('3x3', 'f2l', { fresh: true });
        if (live) setInsertionCases(fresh.cases);
      } catch { /* Keep the last verified library while offline. */ }
      finally { reading = false; }
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      live = false;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [puzzle, set]);
  const f2lLibrary = useMemo(() => puzzle === '3x3' && set === 'f2l'
    ? insertionCases.map(c => c.id === caseObj.id ? caseObj : c) : undefined,
  [puzzle, set, insertionCases, caseObj]);
  const [composedByOri, setComposedByOri] = useState<Record<number, AlgEntry>>({});
  const [validationInvalid, setValidationInvalid] = useState<AlgInvalidMark[]>([]);
  const [validationTriggerContainer, setValidationTriggerContainer] = useState<HTMLDivElement | null>(null);
  const [selectedAlgByOri, setSelectedAlgByOri] = useState<Record<number, number>>({});
  const [playRequestByOri, setPlayRequestByOri] = useState<Record<number, number>>({});
  useEffect(() => {
    setCaseObj(caseProp);
    setComposedByOri({});
    setValidationInvalid([]);
    setSelectedAlgByOri({});
    setPlayRequestByOri({});
  }, [caseProp]);
  const [deleted, setDeleted] = useState(false);
  const [sq1BlackTop, setSq1BlackTop] = useQueryState(
    'black',
    parseAsBoolean.withDefault(true),
  );
  const isSq1Pbl = puzzle === 'sq1' && set === 'pbl';
  const [sq1NotationMode, setSq1NotationMode] = useQueryState(
    'sq1-notation',
    parseAsStringEnum<Sq1NotationMode>([...SQ1_NOTATION_MODES]).withDefault('compact'),
  );
  const [scrambleKind, setScrambleKind] = useQueryState(
    'scramble',
    parseAsStringEnum<ScrambleKind>(SCRAMBLE_KINDS.map(kind => kind.id)).withDefault('inv'),
  );
  const [viewAngle, setViewAngle] = useQueryState(
    'angle',
    parseAsStringEnum<CaseViewAngle>([...CASE_VIEW_ANGLES]).withDefault('default'),
  );
  const [orientation, setOrientation] = useQueryState(
    'orientation',
    parseAsStringEnum<string>(CUBE_ORIENTATIONS.map(option => option.value))
      .withDefault(DEFAULT_ALG_CUBE_ORIENTATION),
  );
  const isAdmin = useIsAdmin();
  const [editorRevision, setEditorRevision] = useState(0);
  const editorArea = useRef<HTMLDivElement>(null);
  const m = caseObj.meta;
  const primary = primaryCaseName(puzzle, set, caseObj);
  // 副名:meta case 的原始站名(`ZBLL U 1`)、非 meta 的原始名 —— 和主名不同才显示,免重复。
  const sub = displayAlgCaseName(puzzle, set, caseObj.name);
  const showSub = sub && sub !== primary;
  // Embedded case dialogs share the host document; only the page owns its title.
  useDocumentTitle(primary, primary, !embedded);
  const thumbParams = cubeThumbParams(puzzle, set, caseObj.sticker);
  const canChooseViewAngle = supportsCaseViewAngle(thumbParams);
  const canChooseOrientation = supportsCubeOrientation(puzzle, thumbParams);
  const effectiveViewAngle: CaseViewAngle = canChooseViewAngle ? viewAngle : 'default';
  const effectiveOrientation = canChooseOrientation ? orientation : DEFAULT_ALG_CUBE_ORIENTATION;
  const invalidMarks = useMemo(() => {
    const marks = new Map<string, AlgInvalidMark>();
    for (const mark of validationInvalid) marks.set(`${mark.oi}:${mark.ai}`, mark);
    for (const [oi, entries] of caseObj.algs.entries()) {
      for (const [ai, entry] of entries.entries()) {
        const reason = caseAlgIssue(entry);
        if (reason) marks.set(`${oi}:${ai}`, { oi, ai, reason });
      }
    }
    return [...marks.values()];
  }, [caseObj.algs, validationInvalid]);
  const invalidReasonByRow = useMemo(
    () => new Map(invalidMarks.map(mark => [`${mark.oi}:${mark.ai}`, mark.reason])),
    [invalidMarks],
  );

  const keepSq1Top = (href: string) => {
    if (puzzle !== 'sq1' || sq1BlackTop) return href;
    const hashAt = href.indexOf('#');
    const path = hashAt < 0 ? href : href.slice(0, hashAt);
    const hash = hashAt < 0 ? '' : href.slice(hashAt);
    return `${path}${path.includes('?') ? '&' : '?'}black=false${hash}`;
  };

  const keepSq1Notation = (href: string) => {
    if (puzzle !== 'sq1' || sq1NotationMode === 'compact') return href;
    const hashAt = href.indexOf('#');
    const path = hashAt < 0 ? href : href.slice(0, hashAt);
    const hash = hashAt < 0 ? '' : href.slice(hashAt);
    return `${path}${path.includes('?') ? '&' : '?'}sq1-notation=${sq1NotationMode}${hash}`;
  };

  /** 在关联 case 之间切换时保留用户刚选的打乱类型;默认值不写进 URL。 */
  const keepScrambleKind = (href: string) => {
    if (scrambleKind === 'inv') return href;
    const hashAt = href.indexOf('#');
    const path = hashAt < 0 ? href : href.slice(0, hashAt);
    const hash = hashAt < 0 ? '' : href.slice(hashAt);
    return `${path}${path.includes('?') ? '&' : '?'}scramble=${encodeURIComponent(scrambleKind)}${hash}`;
  };

  const keepViewAngle = (href: string) => {
    if (effectiveViewAngle === 'default') return href;
    const hashAt = href.indexOf('#');
    const path = hashAt < 0 ? href : href.slice(0, hashAt);
    const hash = hashAt < 0 ? '' : href.slice(hashAt);
    return `${path}${path.includes('?') ? '&' : '?'}angle=${effectiveViewAngle}${hash}`;
  };

  const keepOrientation = (href: string) => {
    if (effectiveOrientation === DEFAULT_ALG_CUBE_ORIENTATION) return href;
    const hashAt = href.indexOf('#');
    const path = hashAt < 0 ? href : href.slice(0, hashAt);
    const hash = hashAt < 0 ? '' : href.slice(hashAt);
    return `${path}${path.includes('?') ? '&' : '?'}orientation=${encodeURIComponent(effectiveOrientation)}${hash}`;
  };

  // 返回拥有该 case 的一级列表；更细的分组只在列表内作为分区标题。
  const rawBackHref = algCaseHref(puzzle, set, caseObj);
  const backHref = keepOrientation(keepViewAngle(keepSq1Notation(keepSq1Top(rawBackHref))));

  /** meta.no → case,给镜像/逆做详情页之间的链接(表编号,不是 DB id)。 */
  const byNo = useMemo(() => {
    const map = new Map<number, AlgCase>();
    for (const c of data.cases) if (c.meta?.no != null) map.set(c.meta.no, c);
    if (caseObj.meta?.no != null) map.set(caseObj.meta.no, caseObj);
    return map;
  }, [data, caseObj]);

  /** 全集唯一 slug 表(生成关联链接 / 社区区都要);和列表页、落地解析同一份算法。 */
  const slugMap = useMemo(() => buildCaseSlugMap(data.cases, set), [data, set]);
  const hrefFor = (c: AlgCase) => {
    const href = algCaseDetailHref(puzzle, set, (c.id != null && slugMap.byId.get(c.id)) || '');
    return keepOrientation(keepViewAngle(keepScrambleKind(keepSq1Notation(keepSq1Top(href)))));
  };
  const adjacent = useMemo(() => adjacentAlgCases(puzzle, set, data.cases, caseObj), [puzzle, set, data.cases, caseObj]);

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
  const useF2lOrientationGrid = puzzle === '3x3'
    && (set === 'f2l' || set === 'adv-f2l')
    && multiOri;
  const displayedOrientations = caseObj.algs
    .map((oriAlgs, oi) => ({ oriAlgs, oi }))
    .sort((a, b) => {
      if (!useF2lOrientationGrid) return a.oi - b.oi;
      const aRank = F2L_DETAIL_ORIENTATION_ORDER.get(shortOriName(oriNames?.[a.oi] ?? '')) ?? 4 + a.oi;
      const bRank = F2L_DETAIL_ORIENTATION_ORDER.get(shortOriName(oriNames?.[b.oi] ?? '')) ?? 4 + b.oi;
      return aRank - bRank;
    });

  /**
   * 镜像伙伴(issue #40 T5)。三份镜像公式是纯重写,**不依赖建链**,所以只要这个 set
   * 在名单里就能展开;`mirror_case_id` 落库之后才多出上面那张伙伴缩略卡。
   * 自镜像(指向自己)不出卡 —— 点过去还是本页,只在公式行里标一句。
   */
  const mirror = useMemo(() => {
    if (!hasMirror(puzzle, set)) return null;
    const id = caseObj.mirrorCaseId;
    if (id == null) return { partner: null, self: primary, card: null };
    if (caseObj.id != null && id === caseObj.id) return { partner: primary, self: primary, card: null };
    const c = data.cases.find(x => x.id === id);
    if (!c) return { partner: null, self: primary, card: null };
    return { partner: primaryCaseName(puzzle, set, c), self: primary, card: c };
  }, [puzzle, set, caseObj.mirrorCaseId, caseObj.id, data, primary]);

  const rotateCurrentCase = isAdmin && caseObj.id != null && canChooseViewAngle ? async () => {
    const next = await rotateCaseClockwise(data, caseObj, effectiveViewAngle);
    setCaseObj(next.cases.find(c => c.id === caseObj.id)!);
    setEditorRevision(current => current + 1);
    void setViewAngle('default');
  } : undefined;

  // 关系卡使用家族的固定顺序，跳转只移动当前态，不能把当前 case 插到第一位。
  // 同组沿用 /alg 的统一规则：`+` 固定在 `-` 前；同名时以原始名和 DB id 保序。
  const leanRelationCards = (editor?: InlineCaseEditorParts): AlgCaseRelationCardItem[] => ([
    { caseObj, name: primary, current: true },
    ...(mirror?.card ? [{ caseObj: mirror.card, name: mirror.partner, current: false }] : []),
  ]).sort((a, b) => (
    compareAlgGroupLabel(a.name, b.name)
    || compareAlgGroupLabel(a.caseObj.name, b.caseObj.name)
    || (a.caseObj.id ?? Number.MAX_SAFE_INTEGER) - (b.caseObj.id ?? Number.MAX_SAFE_INTEGER)
  )).map((member, index): AlgCaseRelationCardItem => ({
    key: index === 0 ? 'origin' : 'mirror',
    label: index === 0
      ? tr({ zh: '原始', en: 'Origin' })
      : tr({ zh: '镜像', en: 'Mirror' }),
    name: member.name,
    caseObj: member.caseObj,
    current: member.current,
    href: member.current || onEmbeddedCaseChange ? undefined : hrefFor(member.caseObj),
    onSelect: !member.current && onEmbeddedCaseChange ? () => {
      if (!editor || editor.confirmDiscard()) onEmbeddedCaseChange(hrefFor(member.caseObj));
    } : undefined,
    onRotate: member.current && rotateCurrentCase ? async () => {
      if (!editor || editor.confirmDiscard()) await rotateCurrentCase();
    } : undefined,
  }));

  const renderCommunityAlgs = (allowAdd: boolean) => (
    <CommunityAlgs
      puzzle={puzzle}
      setSlug={set}
      caseName={caseObj.name}
      sticker={caseObj.sticker}
      setup={caseObj.setup}
      firstAlg={caseObj.algs[0]?.[0]?.alg}
      standardAlgs={caseObj.algs.flat()}
      submissions={submissions}
      allowAdd={allowAdd}
      redundantNote={oriNames?.[0] ? shortOriName(oriNames[0]) : undefined}
      viewAngle={effectiveViewAngle}
      onPatch={(action) => {
        setSubmissions(prev => {
          if (action.type === 'add') return [...prev, action.submission];
          if (action.type === 'update') return prev.map(s => s.id === action.submission.id ? action.submission : s);
          return prev.filter(s => s.id !== action.id);
        });
      }}
    />
  );

  if (deleted) {
    return (
      <div className="alg-case-detail">
        <p className="alg-case-detail-msg">{tr({ zh: '这张 case 已删除。', en: 'This case has been deleted.' })}</p>
        <p className="alg-case-detail-msg">
          <Link href={backHref} prefetch={false}>{tr({ zh: '回到列表', en: 'Back to the list' })}</Link>
        </p>
      </div>
    );
  }

  const renderDetail = (editor?: InlineCaseEditorParts) => (
    <div ref={motionRoot} className={`alg-case-detail${editor ? ' alg-case-inline-editor' : ''}${useF2lOrientationGrid ? ' is-f2l-orientation-grid' : ''}`}>
      <div className="alg-case-detail-head">
        <Link href={backHref} className="alg-case-detail-back" prefetch={false}>
          <ArrowLeft size={16} />
          <span className="sr-only">{tr({ zh: '返回', en: 'Back' })}</span>
        </Link>
        <h1 className="alg-case-detail-title">
          {editor ? editor.name : <span data-alg-shared-title={primary}>{primary}</span>}
          {showSub && <span className="alg-meta-head-sub">{sub}</span>}
          <Link href={backHref} className="alg-meta-head-open" prefetch={false} title={tr({ zh: '在列表中打开', en: 'Open in the list' })}>
            <ExternalLink size={14} />
          </Link>
        </h1>
        <SettingsPopover label={tr({ zh: '公式设置', en: 'Algorithm settings' })}>
          {puzzle === 'sq1' && (
            <BoolToggle
              value={sq1BlackTop}
              onChange={setSq1BlackTop}
              label={tr({ zh: '黑顶', en: 'Black top' })}
            />
          )}
          {puzzle === 'sq1' && (
            <Sq1NotationSelect
              value={sq1NotationMode}
              onChange={value => void setSq1NotationMode(value)}
            />
          )}
          {puzzle === 'sq1' && set === 'pbl' && (
            <Link href="/alg/sq1/karnaukh-notation" className="alg-recog-cta" prefetch={false}>
              {tr({ zh: '卡脑壳记号', en: 'Karnaukh notation' })}
            </Link>
          )}
          {puzzle === 'fto' && (
            <Link href="/alg/fto/notation" className="alg-recog-cta" prefetch={false}>
              <HelpCircle size={15} aria-hidden="true" />
              {tr({ zh: '转动记号', en: 'Move notation' })}
            </Link>
          )}
          {canChooseViewAngle && (
            <label className="alg-view-angle">
              <span>{tr({ zh: '角度', en: 'Angle' })}</span>
              <select
                className="alg-header-select"
                value={effectiveViewAngle}
                onChange={event => setViewAngle(event.target.value as CaseViewAngle)}
              >
                <option value="default">{tr({ zh: '默认', en: 'Default' })}</option>
                <option value="u">U</option>
                <option value="u2">U2</option>
                <option value="up">U&apos;</option>
              </select>
            </label>
          )}
          {canChooseOrientation && (
            <label className="alg-view-angle">
              <span>{tr({ zh: '朝向', en: 'Holding' })}</span>
              <CubeOrientationSelect
                className="alg-header-select"
                value={effectiveOrientation}
                onChange={value => void setOrientation(value)}
                ariaLabel={tr({ zh: '魔方朝向', en: 'Cube holding orientation' })}
              />
            </label>
          )}
          {/* 单张也能印:每个视角各一份(这页本来就把视角都列出来了) */}
          <AlgPdfButton
            build={() => algSheetFromCases({
              puzzle,
              set,
              cases: [caseObj],
              title: `${puzzle} ${set.toUpperCase()} ${primary}`,
              sourcePath: `/alg/${puzzle}/${set}`,
              filename: `${puzzle}-${set}-${primary.replace(/\s+/g, '-').toLowerCase()}`,
              allOris: true,
              maxAlgs: Infinity,  // 单张 case 的表,备选公式正是它的价值
              sq1BlackTop,
              viewAngle: effectiveViewAngle,
              orientation: effectiveOrientation,
            })}
          />
          {isAdmin && <div ref={setValidationTriggerContainer} />}
        </SettingsPopover>
        {/* 校验只扫这一张 —— 报告里点失败项就开上面同一个编辑器,不再叠第二个 */}
        <AlgAdminValidate
          triggerContainer={validationTriggerContainer}
          scope={{ kind: 'case', puzzle, set, caseObj }}
          onPickCase={() => editorArea.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          onResults={failures => setValidationInvalid(failures.map(({ oriIdx, algIdx, reason }) => ({
            oi: oriIdx,
            ai: algIdx,
            reason,
          })))}
        />
        {editor?.actions && <div className="alg-case-inline-actions">{editor.actions}</div>}
      </div>

      {!embedded && <nav className="alg-case-navigation" aria-label={tr({ zh: '切换 case', en: 'Navigate cases' })}>
        {([['previous', adjacent.previous], ['next', adjacent.next]] as const).map(([direction, target]) => {
          const label = direction === 'previous' ? tr({ zh: '上一条', en: 'Previous' }) : tr({ zh: '下一条', en: 'Next' });
          const content = <>{direction === 'previous' && <ChevronLeft size={16} />}{label}{direction === 'next' && <ChevronRight size={16} />}</>;
          return target ? <Link key={direction} href={hrefFor(target)} prefetch={false} className="alg-case-navigation-link"
            onClick={event => { if (editor && !editor.confirmDiscard()) event.preventDefault(); }}
            aria-label={`${label}: ${primaryCaseName(puzzle, set, target)}`}>{content}</Link>
            : <span key={direction} className="alg-case-navigation-link" aria-disabled="true">{content}</span>;
        })}
      </nav>}

      {editor?.error && <div className="alg-case-inline-status">{editor.error}</div>}
      {editor && effectiveViewAngle !== 'default' && <p>{tr({ zh: '切回默认角度可编辑公式，未保存的修改会保留。', en: 'Return to the default angle to edit algorithms. Your unsaved changes are kept.' })}</p>}
      <div ref={editorArea}>
      {m ? (
        <div className="alg-meta-body alg-case-detail-body">
          <AlgCaseMetaContent
            onRotate={rotateCurrentCase ? async () => { if (!editor || editor.confirmDiscard()) await rotateCurrentCase(); } : undefined}
            caseObj={caseObj}
            puzzle={puzzle}
            set={set}
            playable
            editorAlgorithms={editor?.algorithms}
            subgroupEditor={editor?.subgroup}
            editing={!!editor && effectiveViewAngle === 'default'}
            setupEditor={editor?.setup}
            byNo={byNo}
            jump={onEmbeddedCaseChange ? { kind: 'callback', onJump: target => {
              if (!editor || editor.confirmDiscard()) onEmbeddedCaseChange(hrefFor(target));
            } } : { kind: 'link', href: hrefFor }}
            scrambleKind={scrambleKind}
            onScrambleKindChange={setScrambleKind}
            viewAngle={effectiveViewAngle}
            orientation={effectiveOrientation}
            algsAfter={(!editor || effectiveViewAngle !== 'default') ? renderCommunityAlgs(!editor) : undefined}
            renderMetadata={metadata => <CaseDetailsTabs metadata={metadata} advanced={editor &&
              <fieldset className="alg-case-inline-fields alg-admin-modal-body" disabled={editor.busy}>{editor.advanced}</fieldset>} />}
          />
        </div>
      ) : (
        <div className="alg-case-detail-lean is-paired-player">
          <div className={`alg-case-detail-lean-algs is-paired-player${useF2lOrientationGrid ? ' is-f2l-orientation-grid' : ''}${editor ? ' is-editing' : ''}`}>
            {editor && <div hidden={effectiveViewAngle !== 'default'}>{editor.algorithms(
              <AlgCaseRelationCards items={leanRelationCards(editor)} puzzle={puzzle} set={set}
                sq1BlackTop={sq1BlackTop} viewAngle={effectiveViewAngle} orientation={effectiveOrientation} />,
            )}</div>}
            {(!editor || effectiveViewAngle !== 'default') && displayedOrientations.map(({ oriAlgs, oi }) => {
              const orientedSetup = oriAdjustSetup(caseObj.setup, oi);
              const requestedAlgIdx = selectedAlgByOri[oi] ?? 0;
              const selectedAlgIdx = requestedAlgIdx < oriAlgs.length ? requestedAlgIdx : 0;
              const candidateEntry = composedByOri[oi] ?? oriAlgs[selectedAlgIdx];
              const selectedEntry = candidateEntry && !caseAlgIssue(candidateEntry)
                ? candidateEntry : oriAlgs.find(entry => !caseAlgIssue(entry));
              const selectedAlg = caseViewAlg(selectedEntry?.alg ?? '', effectiveViewAngle);
              const orientationSetup = caseViewSetup(orientedSetup, effectiveViewAngle);
              const playRequest = playRequestByOri[oi] ?? 0;
              const rows = oriAlgs.map((entry, i) => {
                // setup 必须跟着朝向走 —— 四个槽共用一条原始 setup 时,FL/BL/BR 演的是别的 case
                const row = (
                  <PlayableAlgRow
                    entry={entry} puzzle={puzzle} set={set} ori={oi}
                    mirror={mirror ? { partner: mirror.partner, self: mirror.self } : undefined}
                    viewAngle={effectiveViewAngle}
                    sq1NotationMode={sq1NotationMode}
                    sourceKarnaukh={isSq1Pbl}
                    invalid={invalidReasonByRow.get(`${oi}:${i}`)}
                    selected={i === selectedAlgIdx}
                    onSelect={() => {
                      setComposedByOri(current => { const next = { ...current }; delete next[oi]; return next; });
                      setSelectedAlgByOri(current => ({ ...current, [oi]: i }));
                      setPlayRequestByOri(current => ({ ...current, [oi]: (current[oi] ?? 0) + 1 }));
                    }}
                  />
                );
                return <Fragment key={`${oi}:${i}`}>{row}</Fragment>;
              });
              return (
                <div key={oi} data-alg-motion-ori={oi} className="alg-case-detail-ori">
                  {multiOri && <div className="alg-case-detail-ori-label">
                    <AlgImageDownloadButton build={() => caseImageBatch({
                      puzzle, set, cases: [caseObj], title: primary,
                      filename: `${puzzle}-${set}-${caseObj.name}-ori-${oi + 1}`,
                      oriOf: () => oi, sq1BlackTop, viewAngle: effectiveViewAngle, orientation: effectiveOrientation,
                    })}>
                    <CaseThumb local puzzle={puzzle} set={set} sticker={caseObj.sticker}
                      alg={oriAlgs[0]?.alg ?? caseObj.standard ?? ''} setup={orientedSetup}
                      viewAngle={effectiveViewAngle} orientation={effectiveOrientation} sq1BlackTop={sq1BlackTop} />
                    </AlgImageDownloadButton>
                    {shortOriName(oriNames![oi])}
                  </div>}
                  <div className="alg-case-detail-ori-main alg-player-list-layout">
                    {(selectedEntry || oi === 0) && (
                      <div className="alg-case-detail-ori-player alg-player-list-player">
                        {selectedEntry && <AlgPlayer
                          alg={selectedAlg}
                          puzzle={puzzle}
                          set={set}
                          setup={orientationSetup}
                          orientation={effectiveOrientation}
                          size={useF2lOrientationGrid ? 220 : 260}
                          autoPlay={playRequest > 0}
                          playRequest={playRequest}
                        />}
                        {oi === 0 && <AlgCaseRelationCards items={leanRelationCards(editor)} puzzle={puzzle} set={set}
                          sq1BlackTop={sq1BlackTop} viewAngle={effectiveViewAngle} orientation={effectiveOrientation} />}
                      </div>
                    )}
                    <div className="alg-case-detail-ori-algs alg-player-list-options">
                      {orientationSetup && (
                        <SetupLine
                          puzzle={puzzle}
                          setup={displayCaseScramble(puzzle, set, orientationSetup)}
                          sq1NotationMode={sq1NotationMode}
                        />
                      )}
                      {f2lLibrary && !isF2lStandard(caseObj) && effectiveViewAngle === 'default' ? <F2lSolutionGroups
                        cases={f2lLibrary} entries={oriAlgs} setup={orientationSetup} orientation={oi}
                        onSelect={entry => {
                          setComposedByOri(current => ({ ...current, [oi]: entry }));
                          setPlayRequestByOri(current => ({ ...current, [oi]: (current[oi] ?? 0) + 1 }));
                        }}
                      >{rows}</F2lSolutionGroups> : rows}
                      {oi === 0 && renderCommunityAlgs(!editor)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      </div>
      {!m && <CaseDetailsTabs metadata={<div className="alg-meta-facts">
        {editor?.subgroup ? <div className="alg-meta-subgroup-editor">{editor.subgroup}</div>
          : caseObj.subgroup && <div className="alg-meta-row"><span className="alg-meta-key">{tr({ zh: '子集', en: 'Subset' })}</span><span className="alg-meta-val">{caseObj.subgroup}</span></div>}
      </div>} advanced={editor && <fieldset className="alg-case-inline-fields alg-admin-modal-body" disabled={editor.busy}>{editor.advanced}</fieldset>} />}
    </div>
  );

  return isAdmin && caseObj.id != null ? (
    <AdminCaseEditor
      key={`${caseObj.id}:${editorRevision}`}
      puzzle={puzzle}
      setSlug={set}
      state={{ mode: 'edit', existing: caseObj }}
      algorithmsAfter={renderCommunityAlgs(false)}
      f2lLibrary={f2lLibrary}
      renderOrientationSetup={m ? undefined : (setup) => (
        <SetupLine
          puzzle={puzzle}
          setup={displayCaseScramble(puzzle, set, caseViewSetup(setup, effectiveViewAngle))}
          sq1NotationMode={sq1NotationMode}
        />
      )}
      initialInvalid={invalidMarks}
      onClose={() => setEditorRevision(current => current + 1)}
      onSaved={async action => {
        if (action.type === 'update') {
          setValidationInvalid([]);
          setCaseObj((await alignAlgFile({ ...data, cases: [action.updated] })).cases[0]);
        }
        else if (action.type === 'delete') setDeleted(true);
      }}
    >{renderDetail}</AdminCaseEditor>
  ) : renderDetail();
}
