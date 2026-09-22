import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const battleModes = readFileSync(new URL('./BattleModes.tsx', import.meta.url), 'utf8');
const copy = readFileSync(new URL('./copy.ts', import.meta.url), 'utf8');

describe('Mobile capability surface guard', () => {
  it('routes every player option to shared in-app local or online modes', () => {
    const playersControl = app.match(/<TimerPlayersSelect[\s\S]*?\/>/)?.[0];

    expect(playersControl).toBeDefined();
    expect(playersControl).not.toContain('readOnly');
    expect(playersControl).toContain('onChange');
    expect(playersControl).toContain('value={1}');
    expect(app).toContain('<LocalBattleMode');
    expect(app).toContain('<NetBattleMode');
    expect(app).not.toMatch(/[?&]players=/);
    expect(app).not.toMatch(/openFullTimer|openTimerMode/);
    expect(app).toMatch(/timingRunningRef\.current\s*\|\|\s*battleModeActiveRef\.current/);
  });

  it('does not expose Stackmat without a native microphone adapter', () => {
    const deviceActions = app.match(/<TimerDeviceActions[\s\S]*?\/>/)?.[0];

    expect(deviceActions).toBeDefined();
    expect(deviceActions).not.toContain('onMicrophone');
    expect(deviceActions).not.toContain('microphoneAriaLabel');
    expect(copy).not.toMatch(/coming soon|即将推出|暂未开放/i);
  });

  it('routes clipboard writes through the installed host capability', () => {
    expect(app).toContain('host.writeClipboardText');
    expect(battleModes).toContain('writeClipboardText(room.code)');
    expect(`${app}\n${battleModes}`).not.toContain('navigator.clipboard');
  });

  it('routes Solo smart-cube timing through the shared controller', () => {
    const onMove = app.match(/onMove: \(move, timestamp, facelets, metadata\) => \{[\s\S]*?(?=\n    onSolved:)/)?.[0];
    const controller = app.match(/new SmartCubeSoloTimerController\(\{[\s\S]*?\n  \}\), \[attemptSplitRecorder\]\)/)?.[0];

    expect(onMove).toBeDefined();
    expect(controller).toBeDefined();
    expect(onMove).toContain('if (timerModeRef.current !== 1)');
    expect(onMove).toContain('const futureHistory = metadata?.futureHistory === true');
    expect(onMove).toContain('if (!futureHistory) battleSmartCubeHandlersRef.current?.onMove');
    expect(onMove).toContain('smartCubeSoloController.move({ facelets, metadata, move, timestamp })');
    expect(onMove).toContain('smartCubeAnchorController.move(move)');
    expect(onMove!.indexOf('smartCubeAnchorController.move(move)'))
      .toBeLessThan(onMove!.indexOf('smartCubeSoloController.move'));
    expect(controller).toContain('canStartAttempt: () => attemptCanStartRef.current');
    expect(controller).toContain('isTimingEnabled: () => timingEnabledRef.current');
    expect(controller).toContain("autoReadyOnScramble: () => storeRef.current?.settings.bluetoothAutoReady === 'scrambled'");
    expect(controller).toContain('startFromCube: (timestamp) => timerRef.current.startFromCube(timestamp)');
    expect(controller).toContain('smartCubeMoveRecorderRef.current.record(move, timestamp)');
    expect(controller).toContain('attemptSplitRecorder.observeMoves');
    expect(controller).toContain('smartCubeMoveSubscribersRef.current');
    expect(app).toContain('smartCubeMoveRecorderRef.current.begin(startedAtMs)');
    expect(app).toContain('new SmartCubeSoloTimerController');
    expect(app).toContain('id: currentScrambleEntry.id');
    expect(app).toContain('smartCubeSoloController.setConnected(connected)');
    expect(app).toContain("smartCubeSoloController.setRunning(timer.machine.phase === 'running')");
    expect(app).toContain('smartCubeSoloController.syncFacelets(smartCube.facelets)');
    expect(app).toMatch(/syncFacelets\(smartCube\.facelets\);[\s\S]*?currentScrambleEntry\?\.id,[\s\S]*?smartCube\.phase,[\s\S]*?smartCubeTarget,[\s\S]*?timer\.machine\.phase,[\s\S]*?timerMode,/);
    expect(app).toContain('hint={smartCubeGuidance.hint}');
    expect(app).toContain('correctionActive={smartCubeGuidance.correctionActive}');
    expect(app).not.toContain('createSmartCubeGuidanceController');
    expect(app).not.toContain('verifySmartCubeScramble');
    expect(app).not.toContain('createSmartCubeFixupRequester');
    expect(app).not.toContain('smartCubeGuidanceCompleteRef');
    expect(app).toMatch(/smartCubeMoveRecorderRef\.current\.take\(\)[\s\S]*?stageSegmentsFor\(solve\)[\s\S]*?repository\.addSolve\(solve, sessionId\)/);
    expect(app).toMatch(/repository\.addSolve\(solve, sessionId\)[\s\S]*?setPendingSolves/);
    expect(app).toContain('repository.addSolve(pending.solve, pending.sessionId)');
    expect(app).toContain('onUndo={retryPendingSolve}');
    expect(app).toContain('durationMs={null}');
    expect(app).toContain('actionBusy={retryingPendingSolve}');
    expect(app).toContain('copy.saveFailed(pendingSolves.length)');
    expect(app).toContain('smartCubeSoloController.solved(timestamp)');
    expect(controller).toContain('timerRef.current.stopFromCube(timestamp)');
    // Scramble verification and the shared still/double-flick gesture are the
    // two explicit ready sources; neither may bypass the shared controller.
    expect(controller).toContain('timerRef.current.armFromCube()');
    expect(app).toContain('useAutoReady({');
    expect(battleModes.match(/timer\.armFromCube\(\)/g)).toHaveLength(1);
  });
});
