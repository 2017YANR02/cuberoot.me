import type { AlgFile } from '@cuberoot/shared/alg';
import type { TimerLiveAttempt } from '@cuberoot/shared/timer/live-share';
import { prepareReconstruction } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { createReconstructionAnalyzer, type AnalysisWorker } from '@cuberoot/timer-ui/reconstruct/analysis-core';
import { createLiveReconstructionStream, liveReconstructionStage, TIMER_LIVE_SOLUTION_COPY } from '@cuberoot/timer-ui/reconstruct/analysis-live';
import type { AnalysisInput, AnalysisResponse, AnalysisSnapshot } from '@cuberoot/timer-ui/reconstruct/analysis-protocol';
import { prepareReportNotation, RECON_NOTATION_COPY } from '@cuberoot/timer-ui/reconstruct/report-notation';
import { projectReconComment, reconCommentFills } from '@cuberoot/timer-ui/reconstruct/report-presentation';
import { requestJson } from './auth';
import { getMiniProgramLocale, type MiniProgramLocale } from './i18n';
import { openNativeTimerWorkerPort } from './native-timer-worker';

export interface NativeLiveLibraryReply { libraryId: number; file?: AlgFile }
interface LibraryRequest { type: 'library'; libraryId: number; set: string }

function workerAdapter(): AnalysisWorker {
  const port = openNativeTimerWorkerPort('live-analysis');
  let stopped = false;
  const worker: AnalysisWorker = {
    onmessage: null, onerror: null, onmessageerror: null,
    postMessage(message) { port.postMessage(message); },
    terminate() { stopped = true; port.terminate(); },
  };
  port.addEventListener('message', ({ data }) => {
    const reply = data as AnalysisResponse | LibraryRequest;
    if ('type' in reply && reply.type === 'library') {
      const respond = (file?: AlgFile) => {
        if (stopped) return;
        try { port.respond({ libraryId: reply.libraryId, file } satisfies NativeLiveLibraryReply); }
        catch (error) { worker.onerror?.({ message: String(error) }); }
      };
      if (!/^[a-z0-9-]+$/.test(reply.set)) { respond(); return; }
      void requestJson<AlgFile>(`/alg/sets/3x3/${encodeURIComponent(reply.set)}`, { timeoutMs: 2400 }).then(respond, () => respond());
    } else worker.onmessage?.({ data: reply as AnalysisResponse });
  });
  port.addEventListener('error', ({ message }) => worker.onerror?.({ message: message ?? 'Native live analysis worker failed' }));
  return worker;
}

interface AnalysisResult { input: AnalysisInput; snapshot: AnalysisSnapshot }

function nativeLiveAnalysisView(attempt: TimerLiveAttempt, result: AnalysisResult | null, language: MiniProgramLocale, simplified: boolean) {
  const localize = (copy: { en: string; zh: string }) => copy[language];
  const recon = result?.snapshot.text ?? null;
  const method = result?.snapshot.method ?? 'cfop';
  const { projection, decorated, clipboard } = prepareReportNotation(recon, method, simplified);
  const textLines = decorated.split(/\r?\n/);
  const labels = recon?.lines.map(line => line.label) ?? [];
  const rows = projection.lines.map(({ line, moves, groupKey }, index) => ({
    key: line.key, moves: moves.join(' '), copyText: textLines[index + projection.inspectionOffset]?.trim() ?? '',
    groupStart: index > 0 && projection.lines[index - 1].groupKey !== groupKey,
    comment: projectReconComment(line.label ?? '', method, new Map()).map(part => ({
      text: part.text, fills: part.colors ? reconCommentFills(part.colors, labels) : [],
    })),
  }));
  const stage = liveReconstructionStage(method, result?.input.text.segs, recon, localize);
  return { title: localize(TIMER_LIVE_SOLUTION_COPY), stage, rows, scramble: recon?.scramble ?? '',
    inspection: projection.inspection, inspectionLabel: localize({ zh: '// 观察', en: '// inspection' }),
    raw: recon ? '' : (attempt.solve.moves ?? []).map(move => move.m).join(' '), clipboard,
    canToggle: projection.canToggle, simplified,
    toggleLabel: localize(simplified ? RECON_NOTATION_COPY.original : RECON_NOTATION_COPY.simplified),
    copyLabel: localize(RECON_NOTATION_COPY.copy),
  };
}

export type NativeLiveAnalysisView = ReturnType<typeof nativeLiveAnalysisView>;

export function createNativeTimerLiveAnalysis(publish: (view: NativeLiveAnalysisView | null) => void) {
  const analyzer = createReconstructionAnalyzer(workerAdapter);
  let pending: ReturnType<typeof setTimeout> | undefined;
  let stream: ReturnType<typeof createLiveReconstructionStream> | undefined;
  let attempt: TimerLiveAttempt | null = null;
  let result: AnalysisResult | null = null;
  let language = getMiniProgramLocale();
  let simplified = true;
  function draw() { if (attempt) publish(nativeLiveAnalysisView(attempt, result, language, simplified)); }
  function clear() {
    clearTimeout(pending);
    pending = undefined;
    stream?.dispose();
    stream = undefined;
    result = null;
    simplified = true;
    if (attempt) { attempt = null; publish(null); }
  }
  return {
    schedule(read: () => TimerLiveAttempt | null) {
      if (pending !== undefined) return;
      pending = setTimeout(() => {
        pending = undefined;
        const next = read();
        if (!next) { clear(); return; }
        const locale = getMiniProgramLocale();
        if (attempt?.solve.id !== next.solve.id || locale !== language) clear();
        language = locale;
        attempt = next;
        draw();
        let text: AnalysisInput['text'] | null;
        try { text = prepareReconstruction(next.solve, 'cfop', language, next.gyro.slice()).text; }
        catch { return; }
        if (!text) return;
        stream ??= createLiveReconstructionStream((input, snapshot) => {
          if (snapshot.text) { result = { input, snapshot }; draw(); }
        }, analyzer);
        stream.update({ text, scoreable: false, detectLiveMethod: true });
      }, 100);
    },
    toggleNotation() { simplified = !simplified; draw(); },
    clear,
    dispose() { clear(); analyzer.dispose(); },
  };
}
