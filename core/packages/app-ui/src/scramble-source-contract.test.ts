import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  parseManualScrambleQueue,
  takeManualScramble,
} from '@cuberoot/shared/timer';

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');
const scrambleHistory = readFileSync(
  new URL('./mobile-scramble-history.ts', import.meta.url),
  'utf8',
);
const cube222Pool = readFileSync(
  new URL('./data/cube222-special-pool.ts', import.meta.url),
  'utf8',
);
const cube222Worker = readFileSync(
  new URL('./data/cube222-special.worker.ts', import.meta.url),
  'utf8',
);
const cstimerNonWcaPool = readFileSync(
  new URL('./data/cstimer-nonwca-pool.ts', import.meta.url),
  'utf8',
);
const cstimerNonWcaWorker = readFileSync(
  new URL('./data/cstimer-nonwca.worker.ts', import.meta.url),
  'utf8',
);
const cube222StepsPool = readFileSync(
  new URL('./data/cube222-steps-pool.ts', import.meta.url),
  'utf8',
);
const cube222StepsWorker = readFileSync(
  new URL('./data/cube222-steps.worker.ts', import.meta.url),
  'utf8',
);
const non222StepsPool = readFileSync(
  new URL('./data/non222-steps-pool.ts', import.meta.url),
  'utf8',
);
const non222StepsWorker = readFileSync(
  new URL('./data/non222-steps.worker.ts', import.meta.url),
  'utf8',
);

describe('mobile scramble-source parity contract', () => {
  it('uses the shared opaque manual queue and wraps in source order', () => {
    const queue = parseManualScrambleQueue("  R U R'  \n\nannotation is kept\n (1,0) / (-3,2)  ");
    expect(queue).toEqual(["R U R'", 'annotation is kept', '(1,0) / (-3,2)']);

    const first = takeManualScramble(queue, 0);
    const second = takeManualScramble(queue, first.nextCursor);
    const third = takeManualScramble(queue, second.nextCursor);
    const wrapped = takeManualScramble(queue, third.nextCursor);
    expect([first.scramble, second.scramble, third.scramble, wrapped.scramble]).toEqual([
      "R U R'",
      'annotation is kept',
      '(1,0) / (-3,2)',
      "R U R'",
    ]);
  });

  it('keeps all three sources and delegates manual UI and logic to shared code', () => {
    expect(scrambleHistory).toContain(
      'export type MobileScrambleSource = TimerScrambleSourceKind',
    );
    expect(app).toContain('<TimerScrambleSourceSelect');
    expect(app).toContain('realValue="wca"');
    expect(app).toContain('realOption: copy.realOption');
    expect(app).toContain('randomOption: copy.randomOption');
    expect(app).toContain('manualOption: copy.manualOption');
    expect(app).not.toContain('className="timer-source-select"');
    expect(app).toContain('<ManualScrambleQueueEditor');
    expect(app).toContain('parseManualScrambleQueue(manualScramblesRef.current)');
    expect(app).toContain('takeManualScramble(');
    expect(app).toContain('repository.updateSettings({ manualScrambles: value })');
    expect(app).toContain("previousScrambleEventRef.current !== activeEvent");
    expect(app).toContain('previousScrambleEventRef.current = activeEvent');
    expect(app).not.toContain('manualUnavailable');
  });

  it('isolates real pools by complete source spec and never falls back to 333', () => {
    expect(app).toContain('startRealScrambleFetchRetry(spec)');
    expect(app).toContain('readRealScrambleCache(spec)');
    expect(app).toContain('writeRealScrambleCache(realSpec, [next, ...realPoolFor(realSpec)])');
    expect(app).toContain('realScrambleSourceKey(spec)');
    expect(app).toContain('new Map<string, RealScramble[]>()');
    expect(app).toContain('new Map<string, RealPoolRequest>()');
    expect(app).not.toContain("if (event !== '333')");
    expect(app).not.toContain('scramble333');
  });

  it('uses the shared controlled 2x2 UI and persists mode plus type', () => {
    expect(app).toContain('<TimerScramble222Config');
    expect(app).toContain('SCRAMBLE_222_TYPES');
    expect(app).toContain('WCA_SCRAMBLE_222_TYPES');
    expect(app).toContain('updateSettings({ scramble222Mode: mode })');
    expect(app).toContain('updateSettings({ scramble222Type: type })');
    expect(app).not.toMatch(/(?:const|export\s+const)\s+SCRAMBLE_222_(?:TYPES|TYPE_CATALOG)\s*=/);
  });

  it('routes every non-full random 2x2 type through the shared worker provider', () => {
    expect(app).toContain("event === '222' && (requested222Type !== 'full' || use222BySteps)");
    expect(app).toContain('nextMobileCube222SpecialScramble(requested222Type, controller.signal)');
    expect(app).toContain('generateTimerScramble(request, specialistDependencies)');
    expect(cube222Worker).toContain("from '@cuberoot/puzzle-solvers/cube222'");
    expect(cube222Worker).toContain('generate222SpecialScramble(type)');
    expect(cube222Pool).toContain("from '@cuberoot/shared/timer'");
    expect(cube222Pool).toContain('createTimerAsyncScramblePool');
    expect(cube222Pool).toContain('createTimerWorkerRpc');
    expect(cube222Pool).toContain('pool.prefetch(type)');
    expect(cube222Pool).toContain('pool.next(type, signal)');
    expect(cube222Pool).not.toMatch(/new Map<.*(?:queue|pending|inFlight)/i);
    expect(cube222Pool).not.toContain('scramble_module.js');
  });

  it('keeps Kilominx and Master Pyraminx on one package provider and shared pool policy', () => {
    expect(app).toContain('nextMobileCstimerNonWcaScramble');
    expect(app).toContain("provider === 'cstimer-nonwca'");
    expect(cstimerNonWcaWorker).toContain(
      "from '@cuberoot/puzzle-solvers/cstimer-nonwca'",
    );
    expect(cstimerNonWcaWorker).toContain('generateCstimerNonWcaTimerScramble(event)');
    expect(cstimerNonWcaPool).toContain('createTimerAsyncScramblePool');
    expect(cstimerNonWcaPool).toContain('createTimerWorkerRpc');
    expect(cstimerNonWcaPool).toContain('pool.next(exactEvent, signal)');
    expect(cstimerNonWcaPool).not.toContain("getScramble('klmso'");
    expect(cstimerNonWcaPool).not.toContain("getScramble('mpyrso'");
  });

  it('shares by-steps UI, worker generation, persistence identity, and visible-slot cancellation', () => {
    expect(app).toContain('<TimerByStepsConfig');
    expect(app).toContain('timerByStepsIdentity(');
    expect(app).toContain('nextMobileCube222ByStepsScramble(requestedBySteps, requested222Mode, controller.signal)');
    expect(app).toContain('randomScrambleGateRef.current.begin()');
    expect(app).toContain('randomScrambleGateRef.current.cancel()');
    expect(cube222StepsPool).toContain('createTimerAsyncScramblePool');
    expect(cube222StepsPool).toContain("timerByStepsIdentity('222', 'random', settings, mode)");
    expect(cube222StepsPool).toContain('pool.next(key, signal)');
    expect(cube222StepsWorker).toContain('generateTimer222ByStepsScramble');
    expect(cube222StepsWorker).toContain('generate222ByMetric');
  });

  it('keeps every non-2x2 metric in one package engine behind the shared Worker host', () => {
    expect(app).toContain('const byStepsSourceSignature = timerByStepsIdentity(');
    expect(app).toMatch(
      /activeEvent,[\s\S]*?activeScrambleIdentity,[\s\S]*?byStepsSourceSignature,[\s\S]*?nextScramble,[\s\S]*?wcaSourceSignature/,
    );
    expect(app).toContain('nextMobileNon222ByStepsScramble(');
    expect(app).toContain('activeEventRef.current !== event');
    expect(app).toContain('scrambleIdentityFor(expectedSource, event) !== requestedIdentity');
    expect(non222StepsPool).toContain('createTimerNon222ByStepsWorkerHost');
    expect(non222StepsPool).toContain('host.next(event, settings, signal)');
    expect(non222StepsPool).toContain('host.filterScrambles(');
    expect(non222StepsWorker).toContain(
      "from '@cuberoot/puzzle-solvers/timer-by-steps'",
    );
    expect(non222StepsWorker).toContain('generateTimerNon222ByStepsScramble(request.filter)');
    expect(non222StepsWorker).toContain('filterTimerNon222Scrambles(request.scrambles, request.filter)');
  });

  it('matches the canonical Web fallback only for events without a real-pool mapping', () => {
    expect(app).toMatch(
      /if \(!timerSupportsRealWcaScrambles\(event\)\) \{\s*generateRandomScramble\(entry, requestId\);\s*return;/,
    );
    expect(app).toContain("scrambleSourceRef.current === 'wca'");
    expect(app).toContain(
      'realScrambleSourceKey(realSpecFor(activeEventRef.current)) === sourceKey',
    );
    expect(app).toContain("replaceScrambleHistoryEntry(entry.id, requestedIdentity, { availability: 'error' })");
    expect(app).not.toContain('<option disabled=');
  });

  it('allows canonical empty manual/custom attempts and freezes event plus scramble at start', () => {
    expect(app).toContain('timerScrambleAllowsEmptySlot(');
    expect(app).toContain('const attemptCanStart = timerCanStartAttempt({');
    expect(app).toContain("scrambleAvailability === 'loading' ? 'loading' : 'unavailable'");
    expect(app).toContain('sourceMatches: slotMatchesActiveSource');
    expect(app).toContain('canStart: attemptCanStart');
    expect(app).toContain("scrambleSource === 'manual' && scramble.length === 0");
    expect(app).toContain("activeEvent === 'custom' && scramble.length === 0");
    expect(app).toContain("? '—'");
    expect(app).toContain('mobileScrambleAttemptSnapshot(entry)');
    expect(scrambleHistory).toContain('scrambleSource: entry.sourceSnapshot,');
    expect(scrambleHistory).toContain('event: entry.event,');
    expect(scrambleHistory).toContain('scramble: entry.scramble,');
    expect(app).toContain('event: attempt.event,');
    expect(app).toContain('scramble: attempt.scramble,');
    expect(app).toContain('scrambleSource: attempt.scrambleSource,');
  });

  it('freezes and persists shared trainer case identity exactly where Web does', () => {
    expect(app).toContain(
      'timerTracksTrainerCase(event) ? result.metadata?.caseId ?? null : null',
    );
    expect(scrambleHistory).toContain('caseId: entry.caseId,');
    expect(app).toContain('...(attempt.caseId ? { caseId: attempt.caseId } : {}),');
  });

  it('uses the shared controlled WCA config and persists every source-key field', () => {
    expect(app).toContain('<TimerWcaSourceConfig');
    expect(app).toContain('<DateRangeInput');
    expect(app).toContain('labels={dateRangeLabels}');
    expect(app).toContain('maxDate={toLocalIsoDate()}');
    expect(app).not.toContain('function localIsoToday');
    expect(app).not.toContain('type="date"');
    expect(css).not.toMatch(/\.mobile-wca-date-range\s+input/);
    expect(app).toContain('loadMobileWcaCompetitions(language)');
    expect(app).toContain('<TimerWcaScrambleSource');
    expect(app).toContain('currentRealCompetition?.selectedDisplayName');
    expect(app).toContain('onNavigate={() => openToolsRoute(');
    expect(app).toContain('nonOptimal={currentReal?.nonOptimal');
    expect(css).not.toMatch(/\.mobile-scramble-source\s*\{/);
    expect(app).toContain('competition.id === competitionId');
    expect(app).toContain('loadMobileWcaCompetitionScrambles(competitionId, fetch, signal)');
    expect(app).toContain('...wcaSourceSettingsRef.current');
    expect(app).toContain('repository.updateSettings(next)');
    expect(app).toContain('wcaSourceSignature');
    expect(app).toContain('ref={setWcaTopControlsSlot}');
    expect(app).toContain('topControlsSlot={wcaTopControlsSlot}');
    expect(app).toContain('ref={setWcaDifficultyToggleSlot}');
    expect(app).toContain('toggleSlot={wcaDifficultyToggleSlot}');
    expect(app).toContain('trailingControls={(');
    expect(app).not.toContain('mobile-wca-controls-row');
    expect(app).toMatch(/view === 'settings'[\s\S]*?<TimerBooleanSettingRow/);
    expect(app).toContain("field={timerSettingFieldContract('settings.scramble.optimal')}");
    expect(app).toContain("const optimalAvailable = scrambleSource === 'wca'");
    expect(css).toMatch(/\.mobile-wca-shared-controls \{[^}]*display: contents;/s);
    expect(app).toMatch(/const wcaSourceSignature = `\$\{realScrambleSourceKey\(\{/);
    expect(app).not.toMatch(/const wcaSourceSignature = \[[\s\S]*?\]\.join\('\|'\)/);
  });

  it('invalidates the slot and cancels every pre-run arm on a source identity change', () => {
    expect(app).toContain('currentScrambleEntry.sourceIdentity === activeScrambleIdentity');
    expect(app).toContain('entry.sourceIdentity !== scrambleIdentityFor(entry.source, entry.event)');
    expect(app).toContain('timer.cancelArm();');
    expect(app).toContain('invalidateCurrentScramble();');
  });

  it('makes import and undo synchronous attempt boundaries before applying settings', () => {
    expect(app).toContain('const commitImportedStore = useCallback');
    expect(app).toMatch(
      /commitImportedStore[\s\S]*?previousIdentity[\s\S]*?applyStoreSnapshot\(latest\);[\s\S]*?nextIdentity[\s\S]*?previousIdentity !== nextIdentity/,
    );
    expect(app).toMatch(/previewImport[\s\S]*?timer\.cancelArm\(\);[\s\S]*?repository\.importJson/);
    expect(app).toMatch(/undoImport[\s\S]*?timer\.cancelArm\(\);[\s\S]*?restoreImportRecovery/);
    expect(app).toContain('if (!beginTimerContextMutation()) return;');
    expect(app).toContain('if (ownsContextMutation) endTimerContextMutation();');
    expect(app).not.toContain('applyStoreSnapshot(latest);\n    nextScramble(');
  });

  it('disables global timer input outside Timer and behind overlays or context writes', () => {
    expect(app).toMatch(
      /canStart: attemptCanStart,[\s\S]*?enabled: view === 'timer'[\s\S]*?&& !moreOpen[\s\S]*?&& !timerContextMutationBusy/,
    );
    expect(app).toContain('&& !manualEntryOpen');
    expect(app).toContain('&& openOverlay === null');
    expect(app).toMatch(
      /const sourceControlsEnabled = timer\.machine\.phase !== 'running'[\s\S]*?&& !timerContextMutationBusy/,
    );
    expect(app).toContain("disabled={timer.machine.phase === 'running' || timerContextMutationBusy}");
    expect(app).toMatch(/host\.addBackButtonListener\(\(\) => \{[\s\S]*?mobileBackAction\(\{/);
    expect(app).toContain('phase: timerPhaseRef.current');
    expect(app).toContain('mutationBusy: timerContextMutationBusyRef.current');
    expect(app).toContain("if (action === 'block-busy')");
  });

  it('opens one shared manual-result modal and persists through the repository', () => {
    expect(app).toContain('timerManualEntryCopy(language)');
    expect(app).toContain('<TimerManualEntryModal');
    expect(app).toContain('onSubmit={addManualSolve}');
    expect(app).toContain('repository.addSolve(value)');
    expect(app).toContain('setManualEntryOpen(true)');
    expect(app).not.toContain('function parseManualEntry');
    expect(app).not.toContain('function ManualEntryModal');
  });

  it('matches Web by locking source controls only while the timer is running', () => {
    expect(app).toContain(
      "const sourceControlsEnabled = timer.machine.phase !== 'running'",
    );
    expect(app).toContain('disabled={!sourceControlsEnabled}');
    expect(app).toContain('if (!sourceControlsEnabled) {');
    expect(app).toContain('announce(copy.finishAttemptFirst);');
    expect(css).toMatch(/\.mobile-scramble-source-config:disabled \.scramble-src-manual-input/);
  });

  it('keeps refresh available through hold and ready, matching the Web timer', () => {
    expect(app).toContain('disabled={!sourceControlsEnabled}');
    expect(app).toContain("'next-scramble': nextDisplayedScramble");
    expect(app).toContain('timerCanSwitchScramble(timerPhaseRef.current)');
    expect(app).toContain('histForward(scrambleHistoryRef.current)');
    expect(app).not.toContain("disabled={(timer.machine.phase !== 'idle' && timer.machine.phase !== 'stopped')");
  });

  it('cannot apply an older repository snapshot over newer manual input', () => {
    const manualUpdate = app.slice(
      app.indexOf('const updateManualScrambles'),
      app.indexOf('const selectTimerEvent'),
    );
    expect(manualUpdate.indexOf('beginMutation()')).toBeLessThan(
      manualUpdate.indexOf('manualScramblesRef.current = value'),
    );
    expect(manualUpdate).toContain('commitIfLatest(revision, data, applyStoreSnapshot)');
    expect(manualUpdate).toContain('recoverLatestStoreSnapshot(revision)');
    expect(app).not.toContain('.then(setStore)');
  });

  it('places the shared textarea before the timer stage without horizontal overflow', () => {
    expect(app.indexOf('mobile-scramble-source-config')).toBeLessThan(app.indexOf('mobile-timer-stage'));
    expect(css).toMatch(/\.mobile-scramble-source-config \{[^}]*min-width: 0;/s);
    expect(css).toMatch(/\.mobile-scramble-source-config \.scramble-src-manual \{[^}]*width: min\(100%, 44rem\);/s);
  });
});
