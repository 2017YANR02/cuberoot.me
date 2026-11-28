import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ExternalLink } from '@app-foundation/icons/lucide';
import { CompactSelect } from '@/components/CompactSelect';
import AppLink from '@/components/AppLink';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import CubeOrientationSelect from '@/components/CubeOrientationSelect';
import { ReconNotationBlock } from '@/components/ReconNotationBlock';
import { ReconNotationToolbar, ReconSourceText, ReconStageSolver, type NotationView } from '@/components/recon/ReconNotationToolbar';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { buildCaptionHeader } from '@/lib/recon-stats';
import { encodeUrlAlg } from '@/lib/cubedb-url';
import { deriveScrambleFromSolution } from '@/lib/scramble-from-solution';
import { buildReconSubmitQuery } from '@/lib/sim-recon-link';
import { checkReconCompletion } from '@cuberoot/shared/recon-completion';
import { orientedFaceColors } from '@cuberoot/shared/timer';
import { formatReconLine } from '@cuberoot/shared/timer/reconstruct/recon-text';
import type { Quaternion } from '@/lib/video-recon/engine/cube-motion';
import { openingGripView } from '@/lib/video-recon/engine/cube-orientation';
import type { MoveStep } from '@/lib/video-recon/engine/move-search-types';
import type { MeasuredCubeFrame } from '@/lib/video-recon/engine/projected-cube';
import { timecode } from '@/lib/video-recon/engine/solve-range';
import {
  singleLayerCross, analyzeVideoSolve, matchVideoOpeningScramble, observeVideoSolve, playerGrip, videoGripOptions, videoNotationRanges, videoNotationTimeline, type VideoSolveObservation,
} from '@/lib/video-recon/solve-analysis';

import { measuredGestureTimes } from '@/lib/video-recon/gesture-times';
import { findTokenPositions } from '@/lib/recon-alg-utils';
import type { CaptionCue } from '@/lib/video-tools/recon-captions';

export interface VerifiedVideoDraft {
  cues?: CaptionCue[];
  solution: string;
  inferredScramble?: string;
}

export interface VideoSolveAnalysisProps {
  scramble: string;
  steps: readonly MoveStep[];
  measured: readonly MeasuredCubeFrame[];
  fps: number;
  clockFps?: number;
  start: number;
  end: number;
  position: number;
  onSeek: (timestamp: number) => void;
  onOpeningView: (view: Quaternion) => void;
  onAnalysisResolved?: (verified: boolean) => void;
  inferredScramble?: boolean;
  draftTarget?: {
    scramble: string;
    onReady?: (draft?: VerifiedVideoDraft) => void;
    onApply?: (draft: VerifiedVideoDraft) => void;
  };
}

type CrossMode = 'original' | 'rewrite' | 'single';
type Analysis = Awaited<ReturnType<typeof analyzeVideoSolve>>;

export function VideoSolveAnalysis({ scramble, steps, measured, fps, clockFps, start, end, position, onSeek, onOpeningView, onAnalysisResolved, draftTarget, inferredScramble,
  sourceAlgorithm, fallbackNotation,
}: VideoSolveAnalysisProps & { sourceAlgorithm: string; fallbackNotation?: ReactNode }) {
  const t = useT();
  const language = useLang();
  const observation = useMemo(() => observeVideoSolve(scramble, steps, measured, fps, start, end, clockFps),
    [scramble, steps, measured, fps, start, end, clockFps]);
  const [openingSelection, setOpeningSelection] = useState<{ observation: VideoSolveObservation; rotation: string }>();
  const selection = openingSelection?.observation === observation ? openingSelection.rotation : undefined;
  const [analysis, setAnalysis] = useState<{
    observation: VideoSolveObservation; grip?: string; language: typeof language; value?: Analysis;
    draftScramble?: string; draft?: VerifiedVideoDraft; inferred?: boolean; verifiedInferredScramble?: string;
  }>();
  const imageRef = useRef<HTMLDivElement>(null);
  const [selectedView, setSelectedView] = useState<{ observation: VideoSolveObservation; view: NotationView }>();
  const [crossChoice, setCrossChoice] = useState<{ analysis: NonNullable<Analysis>; mode: CrossMode }>();
  const notationView = selectedView?.observation === observation ? selectedView.view : 'recon';
  const draftScramble = draftTarget?.scramble;
  const current = analysis?.observation === observation && analysis.grip === selection && analysis.language === language
    && analysis.draftScramble === draftScramble && analysis.inferred === inferredScramble
    ? analysis : undefined;

  useEffect(() => {
    let active = true;
    void analyzeVideoSolve(observation, selection, language).then(async value => {
      let draft: VerifiedVideoDraft | undefined;
      let verifiedInferredScramble: string | undefined;
      const solution = value?.result.text;
      // analyzeVideoSolve replays raw turns and checks every published stage against them.
      // Verify that exact stage notation against the original state before deriving any replacement scramble.
      const original = inferredScramble ? observation.scramble : draftScramble;
      if (active && value?.solved && solution?.trim() && original) {
        const completion = await checkReconCompletion({ event: '3x3', scramble: original, solution });
        if (completion.status === 'solved' && active) {
          if (inferredScramble) {
            verifiedInferredScramble = original;
            try {
              const candidate = await deriveScrambleFromSolution(solution);
              if (active) verifiedInferredScramble = await matchVideoOpeningScramble(original, candidate);
            } catch { /* The recognized opening already passed verification. */ }
            if (draftScramble === '') draft = { solution, inferredScramble: verifiedInferredScramble };
          } else if (draftScramble) {
            draft = { solution };
          }
        }
      }
      if (draft && value) {
        const { result } = value;
        const gestureTimes = measuredGestureTimes(steps, measured, start, clockFps ?? fps);
        const ranges = new Map(videoNotationRanges(result, 0).map(range => [range.offset, range]));
        let offset = 0;
        const stages = result.text.split('\n').flatMap(text => {
          const marks = findTokenPositions(text).map(token => {
            const range = ranges.get(offset + token.end);
            if (!range) return null;
            const at = gestureTimes.get(range.startMs)?.start ?? start + range.startMs / 1000;
            const until = gestureTimes.get(range.timestampMs)?.end ?? start + range.timestampMs / 1000;
            return { start: at, end: until > at ? until : undefined, commit: until === at };
          });
          offset += text.length + 1;
          if (/\/\/\s*(?:insp(?:ection)?|观察)\s*$/i.test(text)) return [];
          const observed = marks.filter(m => m !== null);
          if (!observed.length) return [];
          return [{ text, marks, start: Math.min(...observed.map(m => m.start)),
            end: Math.max(...observed.map(m => m.end ?? m.start)) }];
        });
        const ordered = stages.flatMap(stage => stage.marks).filter(mark => mark !== null);
        for (let i = 0; i + 1 < ordered.length; i++) {
          const mark = ordered[i], next = ordered[i + 1];
          if (mark.end !== undefined && next.start > mark.start) mark.end = Math.min(mark.end, next.start);
        }
        // Include the last commit frame. Line-to-line cuts follow the next stage's first observed turn.
        if (stages.length === result.lines.length) draft.cues = stages.map((stage, i) => ({
          ...stage, end: Math.min(stages[i + 1]?.start ?? end, stage.end + 1 / fps),
        }));
      }
      if (active) setAnalysis({ observation, grip: selection, language, value, draftScramble, draft, inferred: inferredScramble, verifiedInferredScramble });
    }).catch(() => {
      if (active) setAnalysis({ observation, grip: selection, language, draftScramble, inferred: inferredScramble });
    });
    return () => { active = false; };
  }, [observation, selection, language, draftScramble, inferredScramble, start, end, fps, steps, measured, clockFps]);

  const value = current?.value;
  const { crossNotation, method, solved, fallback } = value ?? {};
  const original = crossNotation?.variants[0] ?? value?.result;
  const single = useMemo(() => original && singleLayerCross(original), [original]);
  const rewrite = crossNotation?.variants[crossNotation.preferred || 1];
  const mode = crossChoice && crossChoice.analysis === value ? crossChoice.mode : crossNotation?.preferred ? 'rewrite' : 'original';
  const result = (mode === 'single' ? single?.result : mode === 'rewrite' ? rewrite : original) ?? original;
  const crossModes = [{ value: 'original' as const, label: t('原始', 'Original') },
    { value: 'rewrite' as const, label: t('改写', 'Equivalent rewrite'), disabled: !rewrite },
    { value: 'single' as const, label: t('单层', 'Single-layer notation'), disabled: !single }];
  const crossLine = crossNotation?.lineIndex ?? 0;
  const verifiedDraft = useMemo(() => {
    const draft = current?.draft;
    if (!draft || !result || draft.solution === result.text) return draft;
    return { ...draft, solution: result.text, cues: draft.cues?.map((cue, index) => index === crossLine
      ? { ...cue, text: formatReconLine(result.lines[index]), marks: mode === 'single' && single
        ? single.sourceIndices.map(i => cue.marks?.[i] ?? null) : cue.marks } : cue) };
  }, [current?.draft, result, crossLine, mode, single]);
  const verified = !!current?.value?.solved && (draftScramble === undefined || !!verifiedDraft);
  useEffect(() => {
    if (current) onAnalysisResolved?.(verified);
  }, [current, verified, onAnalysisResolved]);
  const onDraftReady = draftTarget?.onReady;
  const onDraftApply = draftTarget?.onApply;
  const applyButton = onDraftApply && verifiedDraft && <button type="button" className="btn-primary" onClick={() => onDraftApply(verifiedDraft)}>
    {t('使用', 'Apply')}
  </button>;
  useEffect(() => {
    onDraftReady?.(verifiedDraft);
  }, [verifiedDraft, onDraftReady]);

  const openingRotation = selection ?? result?.openingRotation;
  const openingPose = observation.opening?.pose.rotation;
  useEffect(() => {
    if (openingPose && openingRotation !== undefined) onOpeningView(openingGripView(openingPose, openingRotation));
  }, [openingPose, openingRotation, onOpeningView]);
  const relativeMs = Math.round((position - start) * 1000);
  const openingMs = Math.round(((observation.opening?.timestamp ?? start) - start) * 1000);
  const timeline = useMemo(() => result ? videoNotationTimeline(result, openingMs) : [], [result, openingMs]);
  const activeOffset = timeline.findLast(move => move.timestampMs <= relativeMs)?.offset ?? null;
  const displayMethod = method === 'roux' ? 'Roux' : method?.toUpperCase();
  const displayScramble = current?.verifiedInferredScramble ?? result?.scramble ?? '';
  const captionHeader = useMemo(() => result ? buildCaptionHeader(result.text, result.seconds, '3x3') : '', [result]);
  const clipboard = result ? [captionHeader, displayScramble, result.text].filter(Boolean).join('\n') : '';
  const sourceText = [scramble, sourceAlgorithm].filter(Boolean).join('\n');
  const canSolve = Boolean(displayScramble.trim());
  const view = notationView === 'solver' && !canSolve ? 'recon' : notationView;
  let editorHref: string | undefined;
  if (!draftTarget && result && displayScramble && displayMethod && solved && (!inferredScramble || current?.verifiedInferredScramble)) {
    const params = new URLSearchParams(buildReconSubmitQuery('3x3', inferredScramble ? '' : displayScramble, result.text, { method: displayMethod }));
    if (inferredScramble) params.set('generic', encodeUrlAlg(displayScramble));
    editorHref = `/recon/submit?${params}`;
  }
  function applyOpeningGrip(rotation: string) {
    setOpeningSelection({ observation, rotation });
  }
  const options = useMemo(() => videoGripOptions(observation.centers), [observation.centers]);
  const initial = observation.estimatedGrip;
  const choice = options.find(option => option.grip.rotation === (openingRotation ?? initial?.rotation));
  const selected = choice?.grip ?? initial;
  const openingOrientation = observation.opening && selected ? (colors?: string) => (
    <span className="video-recon-grip-controls">
      <CubeOrientationSelect value={choice?.value ?? ''} triggerColors={colors} variant="plain"
        ariaLabel={t('起手朝向', 'Opening orientation')} layout="grid"
        onChange={value => {
          const grip = options.find(option => option.value === value)?.grip;
          if (grip) applyOpeningGrip(grip.rotation);
        }} />
      <button type="button" className="recon-annotation-badge" aria-label={t('转体 90°（y）', 'Rotate 90° (y)')} onClick={() => {
        const { U, F } = orientedFaceColors(`${selected.rotation} y`);
        const next = playerGrip(U, F);
        if (next) applyOpeningGrip(next.rotation);
      }}>y</button>
    </span>
  ) : undefined;
  return <div className="video-recon-notation">
    {!result?.text && openingOrientation?.()}
    {!openingOrientation && <span className="video-recon-muted">{t('起手姿态未拍清，按固定朝向分段。', 'The opening grip is unavailable. Stages use a fixed orientation.')}</span>}
    {!current && <ContentSkeleton variant="text" label={t('正在识别解法和分段…', 'Identifying the method and stages…')} />}
    {current && !result && <span role="status" className="video-recon-muted">{t('无法生成与识别状态一致的分段复盘。', 'Could not generate a reconstruction consistent with the recognized states.')}</span>}
    {current && !result && fallbackNotation}
    {draftTarget && solved && !verifiedDraft && <span role="status" className="video-recon-muted">
      {t('这份解法与打乱未通过还原校验。', 'The scramble and solution could not be verified together.')}
    </span>}
    {result && <>
      {fallback && <span className="video-recon-muted">{t('转体改写未通过状态校验，以下使用固定朝向。',
        'The reoriented moves failed state verification. The steps below use a fixed orientation.')}</span>}
      {!fallback && observation.uncertain.length > 0 && <details className="video-recon-muted">
        <summary>{t('有些区间的转体待核对', 'Some intervals need rotation review')}</summary>
        <div className="video-recon-actions">
          {observation.uncertain.map(({ startMs, endMs }, index) => (
            <button type="button" className="btn-secondary" key={index} onClick={() => onSeek(start + startMs / 1000)}>
              {timecode(startMs / 1000)}–{timecode(endMs / 1000)}
            </button>
          ))}
        </div>
      </details>}
      <ReconNotationToolbar view={view} canSolve={canSolve} onChange={view => setSelectedView({ observation, view })}
        formattedText={clipboard} sourceText={sourceText} copyKey={view === 'source' ? sourceText : clipboard}
        imageRef={imageRef} imageName="video-recon" />
      {view === 'source' && <ReconSourceText text={sourceText} />}
      {view === 'solver' && <ReconStageSolver scramble={displayScramble} lang={language} />}
      <div className="detail-scramble-solution" ref={imageRef} hidden={view !== 'recon'}>
        <ReconNotationBlock openingOrientation={openingOrientation} captionHeader={captionHeader} scramble={displayScramble} scrambleCubeOrder={3}
          displayScramble={displayScramble} solutionText={result.text} displayText={result.text} rawDisplayText={result.text}
          canToggle={!!(single || rewrite)} crossLineIdx={crossLine + Number(!!result.inspection)}
          crossControl={value && (single || rewrite) && <CompactSelect<CrossMode> ariaLabel={t('十字记法', 'Cross notation')}
            value={mode} showArrow={false} keyboardListNavigation unstyledTrigger triggerClassName="recon-annotation-badge"
            items={crossModes} label={crossModes.find(item => item.value === mode)?.label}
            onChange={mode => setCrossChoice({ analysis: value, mode })} />}
          solve={{ event: '3x3' }} playback={{ offset: activeOffset, onSeek: offset => {
            const move = timeline.findLast(item => item.offset <= offset);
            onSeek(start + (move?.timestampMs ?? openingMs) / 1000);
          } }} />
      </div>
      {(applyButton || editorHref) && <div className="video-recon-actions">
        {applyButton}
        {editorHref && <AppLink className="btn-secondary" href={editorHref} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={15} aria-hidden />{t('在复盘中编辑', 'Edit in Reconstruction')}
        </AppLink>}
      </div>}
    </>}
  </div>;
}
