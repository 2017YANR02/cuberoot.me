// @vitest-environment jsdom

import { act, createElement, type AnchorHTMLAttributes } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlgCase } from '@cuberoot/shared/alg';

const { loadAlgMock, scanCasesMock } = vi.hoisted(() => ({
  loadAlgMock: vi.fn(),
  scanCasesMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({}) }));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));
vi.mock('@/lib/alg_case_alignment', () => ({ loadAlg: loadAlgMock }));
vi.mock('@/lib/alg_validation_scan', () => ({
  allTargets: () => [],
  scanCases: scanCasesMock,
  scanTargets: vi.fn(async () => []),
}));
vi.mock('@/components/AppLink', () => ({
  default: ({ href, prefetch: _prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => (
    createElement('a', { href, ...props })
  ),
}));

import ValidationReportModal from '@/components/ValidationReportModal';

describe('ValidationReportModal failure links', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.clearAllMocks();
  });

  it('includes the external-link icon in the case link hit area', async () => {
    const caseObj = {
      id: 17,
      name: 'A-',
      subgroup: '',
      setup: '',
      sticker: { kind: 'f2l', fl: '' },
      algs: [[{ alg: "U' L' U L y'" }]],
    } as AlgCase;
    scanCasesMock.mockResolvedValue([{
      puzzle: '3x3',
      set: 'f2l',
      caseObj,
      oriIdx: 0,
      algIdx: 0,
      alg: "U' L' U L y'",
      reason: 'Duplicate',
    }]);
    loadAlgMock.mockResolvedValue({ cases: [caseObj] });

    await act(async () => {
      root.render(createElement(ValidationReportModal, {
        scope: { kind: 'case', puzzle: '3x3', set: 'f2l', caseObj },
        onClose: vi.fn(),
      }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const link = host.querySelector<HTMLAnchorElement>('a.alg-validation-name');
    const icon = host.querySelector<SVGElement>('.alg-validation-link');
    expect(link?.getAttribute('href')).toBe('/alg/3x3/f2l/a-');
    expect(icon?.closest('a')).toBe(link);

    const onLinkClick = vi.fn((event: Event) => event.preventDefault());
    link?.addEventListener('click', onLinkClick);
    icon?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onLinkClick).toHaveBeenCalledOnce();
  });
});
