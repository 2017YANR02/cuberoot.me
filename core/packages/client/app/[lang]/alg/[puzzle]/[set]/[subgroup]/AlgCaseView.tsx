'use client';
import { alignAlgFile, caseAlgIssue } from '@/lib/alg_case_alignment';

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
import { Fragment, useEffect, useMemo, useState, useRef } from 'react';
import Link from '@/components/AppLink';
import { ArrowLeft, ExternalLink, Copy, Check, Shuffle, FlipHorizontal2, HelpCircle } from 'lucide-react';
import type { AlgCase, AlgEntry, AlgFile, AlgPuzzle, AlgSubmission } from '@cuberoot/shared';
import { stm } from '@cuberoot/shared/alg-notation';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import AlgCaseMetaContent from '@/components/AlgCaseMetaContent';
import { CaseThumb } from '@/components/CaseThumb';
import CubeOrientationSelect from '@/components/CubeOrientationSelect';
import AlgPlayer from '@/components/AlgPlayer';
import CommunityAlgs from '@/components/CommunityAlgs';
import AdminCaseEditor, { type InlineCaseEditorParts } from '@/components/AdminCaseEditor';
import AlgAdminValidate from '@/components/AlgAdminValidate';
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
import { parseAsBoolean, parseAsStringEnum, useQueryState } from 'nuqs';

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
    <div className="alg-case-standard">
      <Shuffle size={13} className="alg-case-icon" aria-label={tr({ zh: '打乱', en: 'Setup' })} />
      <code>{text}</code>
      <button type="button" className="alg-alg-copy-btn alg-case-setup-copy" onClick={() => copy(text)} title={tr({ zh: '复制打乱', en: 'Copy setup' })}>
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}

/** 可播放的公式行:切换同一朝向旁边的共享播放器。 */
function PlayableAlgRow({ entry, puzzle, set, mirror, ori = 0, viewAngle, sq1NotationMode = 'compact', sourceKarnaukh, selected, onSelect }: {
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
  selected: boolean;
  onSelect: () => void;
}) {
  const [mirrorOpen, setMirrorOpen] = useState(false);
  const { copied, copy } = useCopy();
  const angledAlg = displayCaseAlg(puzzle, set, caseViewAlg(entry.alg, viewAngle));
  const issue = caseAlgIssue(entry);
  const shown = formatScrambleForEvent(puzzle, angledAlg);
  const sq1Notation = puzzle === 'sq1'
    ? sq1NotationText(angledAlg, sq1NotationMode, sourceKarnaukh ? entry.note : undefined)
    : null;
  const shownText = sq1Notation ? tr(sq1Notation) : shown;
  const isKarnaukh = puzzle === 'sq1' && sq1NotationMode === 'karnaukh';
  const len = entry.stm == null ? null : stm(angledAlg);
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={`alg-alg-row${selected ? ' is-expanded' : ''}${issue ? ' is-invalid' : ''}`}
        aria-disabled={!!issue}
        aria-pressed={selected}
        onClick={() => { if (!issue) onSelect(); }}
        onKeyDown={(e) => { if (!issue && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(); } }}
      >
        <span className={`alg-alg-text${isKarnaukh ? ' is-karnaukh' : ''}`}>
          {sq1Notation
            ? shownText
            : entry.algHtml && viewAngle === 'default' && puzzle !== 'sq1'
            ? <span dangerouslySetInnerHTML={{ __html: sanitizeAlgHtml(displayCaseAlgHtml(puzzle, set, entry.algHtml)) }} />
            : shown}
          {!sourceKarnaukh && entry.note && <span className="alg-alg-note">({tr(entry.note)})</span>}
          {issue && <span className="alg-alg-note">{tr({ zh: '（原公式与本图不匹配）', en: '(Source algorithm does not match this case)' })}</span>}
        </span>
        {!isKarnaukh && len != null && <span className="alg-alg-len" title="STM">{len}</span>}
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

export default function AlgCaseView({ puzzle, set, caseObj: caseProp, data }: { puzzle: AlgPuzzle; set: string; caseObj: AlgCase; data: AlgFile; }) {
  /**
   * 显示的这张 case 自己拿一份 —— admin 改完 / 拖完就地更新,不回写上层的 `data`:
   * 上层是按 **slug** 解析出这张 case 的,改了名字再回写会当场解析失败(整页变「没找到」)。
   * 代价是关联缩略图(镜像/逆)那份 `data` 会短暂过期,刷新即一致。
   */
  const [caseObj, setCaseObj] = useState(caseProp);
  const [selectedAlgByOri, setSelectedAlgByOri] = useState<Record<number, number>>({});
  const [playRequestByOri, setPlayRequestByOri] = useState<Record<number, number>>({});
  useEffect(() => {
    setCaseObj(caseProp);
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
  useDocumentTitle(primary, primary);
  const thumbParams = cubeThumbParams(puzzle, set, caseObj.sticker);
  const canChooseViewAngle = supportsCaseViewAngle(thumbParams);
  const canChooseOrientation = supportsCubeOrientation(puzzle, thumbParams);
  const effectiveViewAngle: CaseViewAngle = canChooseViewAngle ? viewAngle : 'default';
  const effectiveOrientation = canChooseOrientation ? orientation : DEFAULT_ALG_CUBE_ORIENTATION;

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

  // 「返回」→ case 所在的子组列表页(带 #name 高亮那张卡)。是有明确目标的导航,不是 history.back。
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

  const communityAlgs = (
    <CommunityAlgs
      puzzle={puzzle}
      setSlug={set}
      caseName={caseObj.name}
      sticker={caseObj.sticker}
      setup={caseObj.setup}
      firstAlg={caseObj.algs[0]?.[0]?.alg}
      standardAlgs={caseObj.algs.flat()}
      submissions={submissions}
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
    <div className={`alg-case-detail${editor ? ' alg-case-inline-editor' : ''}`}>
      <div className="alg-case-detail-head">
        <Link href={backHref} className="alg-case-detail-back" prefetch={false}>
          <ArrowLeft size={16} />
          <span>{tr({ zh: '返回', en: 'Back' })}</span>
        </Link>
        <h1 className="alg-case-detail-title">
          {editor ? editor.name : primary}
          {showSub && <span className="alg-meta-head-sub">{sub}</span>}
          <Link href={backHref} className="alg-meta-head-open" prefetch={false} title={tr({ zh: '在列表中打开', en: 'Open in the list' })}>
            <ExternalLink size={14} />
          </Link>
        </h1>
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
        {/* 校验只扫这一张 —— 报告里点失败项就开上面同一个编辑器,不再叠第二个 */}
        <AlgAdminValidate
          scope={{ kind: 'case', puzzle, set, caseObj }}
          onPickCase={() => editorArea.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />
      </div>

      {editor && <div className="alg-case-inline-status">{editor.error}{editor.actions}</div>}
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
            editing={!!editor && effectiveViewAngle === 'default'}
            setupEditor={editor?.setup}
            byNo={byNo}
            jump={{ kind: 'link', href: hrefFor }}
            scrambleKind={scrambleKind}
            onScrambleKindChange={setScrambleKind}
            viewAngle={effectiveViewAngle}
            orientation={effectiveOrientation}
            algsAfter={communityAlgs}
          />
        </div>
      ) : (
        <div className="alg-case-detail-lean is-paired-player">
          <div className="alg-case-detail-lean-aside">
            <div className="alg-case-detail-lean-thumb">
              <CaseThumb onRotate={rotateCurrentCase ? async () => { if (!editor || editor.confirmDiscard()) await rotateCurrentCase(); } : undefined} puzzle={puzzle} set={set} sticker={caseObj.sticker} alg={caseObj.algs[0]?.[0]?.alg || caseObj.setup || ''} setup={caseObj.setup} size={116} sq1BlackTop={sq1BlackTop} viewAngle={effectiveViewAngle} orientation={effectiveOrientation} />
            </div>
            {mirror?.card && (
              <div className="alg-mirror-row">
                <span className="alg-mirror-label">{tr({ zh: '镜像 case', en: 'Mirror case' })}</span>
                <Link href={hrefFor(mirror.card)} className="alg-mirror-link" prefetch={false}>
                  <CaseThumb
                    puzzle={puzzle}
                    set={set}
                    sticker={mirror.card.sticker}
                    alg={mirror.card.algs[0]?.[0]?.alg || mirror.card.setup || ''}
                    setup={mirror.card.setup}
                    size={36}
                    sq1BlackTop={sq1BlackTop}
                    viewAngle={effectiveViewAngle}
                    orientation={effectiveOrientation}
                  />
                  <span className="alg-mirror-name">{mirror.partner}</span>
                </Link>
              </div>
            )}
            {editor?.setup}
            {caseObj.setup && (
              <SetupLine
                puzzle={puzzle}
                setup={displayCaseScramble(puzzle, set, caseViewSetup(caseObj.setup, effectiveViewAngle))}
                sq1NotationMode={sq1NotationMode}
              />
            )}
          </div>
          <div className="alg-case-detail-lean-algs is-paired-player">
            {editor && <div hidden={effectiveViewAngle !== 'default'}>{editor.algorithms}</div>}
            {(!editor || effectiveViewAngle !== 'default') && caseObj.algs.map((oriAlgs, oi) => {
              const orientedSetup = oriAdjustSetup(caseObj.setup, oi);
              const requestedAlgIdx = selectedAlgByOri[oi] ?? 0;
              const selectedAlgIdx = requestedAlgIdx < oriAlgs.length ? requestedAlgIdx : 0;
              const candidateEntry = oriAlgs[selectedAlgIdx];
              const selectedEntry = candidateEntry && !caseAlgIssue(candidateEntry)
                ? candidateEntry : oriAlgs.find(entry => !caseAlgIssue(entry));
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
                    selected={i === selectedAlgIdx}
                    onSelect={() => {
                      setSelectedAlgByOri(current => ({ ...current, [oi]: i }));
                      setPlayRequestByOri(current => ({ ...current, [oi]: (current[oi] ?? 0) + 1 }));
                    }}
                  />
                );
                return <Fragment key={`${oi}:${i}`}>{row}</Fragment>;
              });
              return (
                <div key={oi} className="alg-case-detail-ori">
                  {multiOri && <div className="alg-case-detail-ori-label">{shortOriName(oriNames![oi])}</div>}
                  <div className="alg-case-detail-ori-main alg-player-list-layout">
                    {selectedEntry && (
                      <div className="alg-case-detail-ori-player alg-player-list-player">
                        <AlgPlayer
                          alg={caseViewAlg(selectedEntry.alg, effectiveViewAngle)}
                          puzzle={puzzle}
                          set={set}
                          setup={caseViewSetup(orientedSetup, effectiveViewAngle)}
                          orientation={effectiveOrientation}
                          size={260}
                          autoPlay={playRequest > 0}
                          playRequest={playRequest}
                        />
                      </div>
                    )}
                    <div className="alg-case-detail-ori-algs alg-player-list-options">
                      {rows}
                    </div>
                  </div>
                </div>
              );
            })}
            {communityAlgs}
          </div>
        </div>
      )}

      </div>
      {editor && <fieldset className="alg-case-inline-fields alg-admin-modal-body" disabled={editor.busy}>
        {editor.subgroup}
        {editor.advanced}
      </fieldset>}
    </div>
  );

  return isAdmin && caseObj.id != null ? (
    <AdminCaseEditor
      key={`${caseObj.id}:${editorRevision}`}
      puzzle={puzzle}
      setSlug={set}
      state={{ mode: 'edit', existing: caseObj }}
      initialInvalid={caseObj.algs.flatMap((entries, oi) => entries.flatMap((entry, ai) => {
        const reason = caseAlgIssue(entry);
        return reason ? [{ oi, ai, reason }] : [];
      }))}
      onClose={() => setEditorRevision(current => current + 1)}
      onSaved={async action => {
        if (action.type === 'update') setCaseObj((await alignAlgFile({ ...data, cases: [action.updated] })).cases[0]);
        else if (action.type === 'delete') setDeleted(true);
      }}
    >{renderDetail}</AdminCaseEditor>
  ) : renderDetail();
}
