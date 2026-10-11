// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { armedFakeCube, installFakeCube } from '@/lib/bluetooth/fake_cube';
const access = vi.hoisted(() => ({ admin: false }));
vi.mock('@/lib/auth-store', () => ({ isAdmin: () => access.admin }));
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); cleanup = undefined; access.admin = false; vi.unstubAllEnvs(); });

describe('fake cube access', () => {
  it('rejects non-admin installation and defaults to disabled for admins', () => {
    expect(installFakeCube(() => '', true)).toBeUndefined();
    expect(window.__cuberootFakeCube).toBeUndefined();
    access.admin = true;
    expect(installFakeCube(() => '')).toBeUndefined();
    expect(armedFakeCube()).toBeNull();
  });
  it('works in production when enabled, revokes connection access and cleans up', () => {
    vi.stubEnv('NODE_ENV', 'production');
    access.admin = true;
    cleanup = installFakeCube(() => 'R U', true);
    window.__cuberootFakeCube!.arm();
    const fake = armedFakeCube()!;
    expect(fake.device.id).toBe('fake-smart-cube');
    const disconnected = vi.fn();
    fake.device.addEventListener('gattserverdisconnected', disconnected);
    access.admin = false;
    expect(armedFakeCube()).toBeNull();
    cleanup!();
    cleanup = undefined;
    expect(disconnected).toHaveBeenCalledOnce();
    expect(fake.device.gatt!.connected).toBe(false);
    expect(window.__cuberootFakeCube).toBeUndefined();
  });
});
