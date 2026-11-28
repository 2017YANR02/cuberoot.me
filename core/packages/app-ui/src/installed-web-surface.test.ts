import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { startWebSurfaceHandshake } from './web-surface-handshake';

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');
const embeddedCss = readFileSync(new URL('./embedded-layout.css', import.meta.url), 'utf8');

describe('installed website surfaces', () => {
  afterEach(() => vi.useRealTimers());

  it('uses a bundled Account home and one shared iframe lifecycle for website details and tools', () => {
    expect(app).toContain("const MOBILE_EMBED_SURFACES = ['tools', 'account'] as const");
    expect(app.match(/<iframe/g)).toHaveLength(1);
    expect(app).toContain('MOBILE_EMBED_SURFACES.map((surface) =>');
    expect(app).toContain('<AccountHome auth={auth}');
    expect(app).toContain("hidden={view !== surface || (surface === 'account' && !accountDetails)}");
  });

  it('hides the pending Account frame and the legacy in-frame sign-in form visually', () => {
    expect(css).toMatch(/\.web-surface--account iframe\[aria-hidden="true"\] \{ visibility: hidden; \}/);
    expect(embeddedCss).toMatch(/:root\[data-native-account-detail-frame\] \.settings-panel-page \[data-mobile-auth-entry\] \{\s*display: none;/);
  });

  it('bounds init retries, lets a trusted acknowledgement stop early, and exposes recovery', () => {
    expect(app).toContain('MOBILE_EMBED_INIT_RETRY_MS');
    expect(app).toContain('MOBILE_EMBED_INIT_RETRIES = 25');
    expect(app).toContain('markWebSurfaceLoaded(surface)');
    expect(app).toContain('beginWebSurfaceHandshake(surface)');
    expect(app).toContain('finishWebSurfaceHandshake(navigation.surface)');
    expect(app).not.toContain('MOBILE_EMBED_READY_TIMEOUT_MS');
    expect(app).toContain("[surface]: 'error'");
    expect(app).toContain('retryWebSurface(surface)');
    expect(app).toContain('host.openExternal(frameUrl)');
    expect(css).toMatch(/\.web-surface-state \{[^}]*background: var\(--background\);/s);
  });

  it('bounds handshake retries and lets a trusted acknowledgement stop them', () => {
    vi.useFakeTimers();
    const postInit = vi.fn();
    const stop = startWebSurfaceHandshake(postInit, 400, 3);
    expect(postInit).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(800);
    expect(postInit).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(4_000);
    expect(postInit).toHaveBeenCalledTimes(3);

    const nextPost = vi.fn();
    const stopNext = startWebSurfaceHandshake(nextPost, 400, 3);
    stopNext();
    vi.advanceTimersByTime(4_000);
    expect(nextPost).toHaveBeenCalledTimes(1);
    stop();
  });

  it('correlates Account session handoff and exposes native login failures', () => {
    expect(app).toContain('pending.requestId !== webSessionResult.requestId');
    expect(app).toContain('MOBILE_EMBED_WEB_SESSION_ACK_TIMEOUT_MS');
    expect(app).toContain('if (authRequest.provider) void auth.login(authRequest.provider);');
    expect(app).toContain("else navigateAccount(authSessionRef.current ? 'home' : 'sign-in');");
    // Browser.open resolves before the callback: delayed login failures must
    // still reach the Account error state once the auth client is no longer busy.
    expect(app).toMatch(/if \(auth\.busy\) return;\s*if \(auth\.error\) \{[^}]*announce\(copy\.authError\);/);
  });

  it('expires closed web surfaces while allowing a response to the final handshake', () => {
    vi.useFakeTimers();
    const exhausted = vi.fn();
    startWebSurfaceHandshake(vi.fn(), 400, 3, exhausted);
    vi.advanceTimersByTime(1199);
    expect(exhausted).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(exhausted).toHaveBeenCalledTimes(1);
    const cancel = startWebSurfaceHandshake(vi.fn(), 400, 3, exhausted);
    vi.advanceTimersByTime(1000);
    cancel();
    vi.advanceTimersByTime(200);
    expect(exhausted).toHaveBeenCalledTimes(1);
  });

  it('keeps both browsing contexts mounted and gates Android Back on a live bridge', () => {
    expect(app).toContain('aria-hidden={showState}');
    expect(app).toContain('tabIndex={showState ? -1 : undefined}');
    expect(app).toContain("if (previous === 'online' || connection !== 'online') return");
    const frameLoad = app.match(/onLoad=\{\(\) => \{([\s\S]*?)\n\s*onError=/)?.[1];
    expect(frameLoad).toMatch(/if \(surface === 'account'\) \{[\s\S]*?return;\s*\}\s*void revokeToolsBle\(\);/);
    expect(frameLoad).toMatch(/webBridgeReadyRef\.current\[surface\] = false;[\s\S]*?if \(connection === 'offline'\) \{\s*webSurfaceLoadedRef\.current\[surface\] = false;\s*return;/);
    expect(app).toMatch(/} else if \(connection !== 'online'\) \{\s*clearWebSurfaceHandshake\(surface\);\s*webBridgeReadyRef\.current\[surface\] = false;/);
    expect(app).toContain('webBridgeReadyRef.current[current] ? webDepthRef.current[current] : 0');
    expect(app).not.toContain('{showFrame && (');
  });
});
