import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { startWebSurfaceHandshake } from './web-surface-handshake';

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

describe('installed website surfaces', () => {
  afterEach(() => vi.useRealTimers());

  it('uses one shared iframe lifecycle for Tools and Account', () => {
    expect(app).toContain("const MOBILE_EMBED_SURFACES = ['tools', 'account'] as const");
    expect(app.match(/<iframe/g)).toHaveLength(1);
    expect(app).toContain('MOBILE_EMBED_SURFACES.map((surface) =>');
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
    expect(app).toContain('MOBILE_EMBED_AUTH_TIMEOUT_MS');
    expect(app).toContain('accountLoginRequestedRef.current = true');
  });

  it('keeps both browsing contexts mounted and gates Android Back on a live bridge', () => {
    expect(app).toContain('aria-hidden={showState}');
    expect(app).toContain('tabIndex={showState ? -1 : undefined}');
    expect(app).toContain("if (previous === 'online' || connection !== 'online') return");
    expect(app).toMatch(/onLoad=\{\(\) => \{\s*webBridgeReadyRef\.current\[surface\] = false;\s*if \(connection === 'offline'\) \{\s*webSurfaceLoadedRef\.current\[surface\] = false;/);
    expect(app).toMatch(/} else if \(connection !== 'online'\) \{\s*clearWebSurfaceHandshake\(surface\);\s*webBridgeReadyRef\.current\[surface\] = false;/);
    expect(app).toContain('webBridgeReadyRef.current[current] ? webDepthRef.current[current] : 0');
    expect(app).not.toContain('{showFrame && (');
  });
});
