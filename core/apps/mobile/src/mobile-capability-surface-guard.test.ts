import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const copy = readFileSync(new URL('./copy.ts', import.meta.url), 'utf8');

describe('Mobile capability surface guard', () => {
  it('exposes multiplayer honestly until the shared in-app modes exist', () => {
    const playersControl = app.match(/<TimerPlayersSelect[\s\S]*?\/>/)?.[0];

    expect(playersControl).toBeDefined();
    expect(playersControl).toContain('readOnly');
    expect(playersControl).toContain('value={1}');
    expect(app).not.toContain('openTimerMode');
    expect(app).not.toMatch(/[?&]players=/);
  });

  it('does not expose Stackmat without a native microphone adapter', () => {
    const deviceActions = app.match(/<TimerDeviceActions[\s\S]*?\/>/)?.[0];

    expect(deviceActions).toBeDefined();
    expect(deviceActions).not.toContain('onMicrophone');
    expect(deviceActions).not.toContain('microphoneAriaLabel');
    expect(copy).not.toMatch(/coming soon|即将推出|暂未开放/i);
  });
});
