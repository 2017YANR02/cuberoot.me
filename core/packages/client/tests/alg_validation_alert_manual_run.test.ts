// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { scanAllMock } = vi.hoisted(() => ({
  scanAllMock: vi.fn(async () => []),
}));

vi.mock('@/lib/auth-store', () => ({
  useIsAdmin: () => true,
}));

vi.mock('@/lib/alg_validation_scan', () => ({
  scanAll: scanAllMock,
}));

vi.mock('@/components/AppLink', () => ({
  default: () => null,
}));

import AlgValidationAlert from '@/components/AlgValidationAlert';

describe('AlgValidationAlert manual validation', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    sessionStorage.clear();
    scanAllMock.mockClear();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('waits for the refresh button before scanning all formulas', async () => {
    await act(async () => root.render(createElement(AlgValidationAlert)));

    expect(scanAllMock).not.toHaveBeenCalled();

    const refresh = host.querySelector<HTMLButtonElement>('.ava-rescan');
    expect(refresh).not.toBeNull();
    await act(async () => refresh?.click());

    expect(scanAllMock).toHaveBeenCalledTimes(1);
  });
});
