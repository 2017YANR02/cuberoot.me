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

  it('reuses the shared smart-cube guide and consumes an armed first turn before verification', () => {
    const onMove = app.match(/onMove: \(move, timestamp, facelets\) => \{[\s\S]*?console\.info\('\[smart-cube\] move'/)?.[0];

    expect(onMove).toBeDefined();
    expect(onMove).toContain('if (timerModeRef.current !== 1)');
    expect(onMove).toContain('battleSmartCubeHandlersRef.current?.onMove');
    expect(onMove).toContain('timer.startFromCube(timestamp)');
    expect(onMove).not.toContain('updateSmartCubeVerification(facelets)');
    expect(onMove).not.toContain('!timingEnabled ||');
    expect(onMove).toContain('smartCubeGuidanceCompleteRef.current = true');
    expect(app).toContain('&& smartCubeConnectedRef.current');
    expect(app).toContain('updateSmartCubeVerification(smartCube.facelets)');
    expect(app).toContain('hint={smartCubeHint}');
    expect(app).toContain('correctionActive={smartCubeCorrectionActive}');
    expect(app).not.toContain('if (!verification.needsFixup) smartCubeFixupGenerationRef.current++');
    expect(app.match(/timer\.armFromCube\(\)/g)).toHaveLength(1);
    expect(battleModes.match(/timer\.armFromCube\(\)/g)).toHaveLength(1);
  });
});
