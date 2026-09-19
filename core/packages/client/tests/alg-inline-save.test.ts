// @vitest-environment jsdom
import { act, createElement, Fragment } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlgCase } from '@cuberoot/shared/alg';

const mocks = vi.hoisted(() => ({
  update: vi.fn(), validate: vi.fn(), stored: vi.fn(), markInvalid: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({}) }));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/i18n/tr', () => ({ tr: (value: { en: string }) => value.en }));
vi.mock('nuqs', () => ({
  parseAsStringEnum: () => ({ withDefault: (value: string) => value }),
  useQueryState: (_key: string, value: string) => [value],
}));
vi.mock('@/lib/alg_sets_api', () => ({ updateCase: mocks.update, createCase: vi.fn(), deleteCase: vi.fn() }));
vi.mock('@/lib/alg_validation', () => ({ validateAlgCase: mocks.validate, validateStoredAlgCase: mocks.stored }));
vi.mock('@/lib/alg_case_alignment', () => ({ commonCaseSetup: (_p: string, _s: string, c: AlgCase) => c.setup }));
vi.mock('@/components/AlgPlayer', () => ({ default: () => null }));
vi.mock('@/components/CubeKeyboardSection', () => ({ default: () => null }));
vi.mock('@/components/AlgEditor', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return { default: forwardRef(({ initialValue }: { initialValue: AlgCase['algs'] }, ref) => {
    useImperativeHandle(ref, () => ({ getValue: () => initialValue, markInvalid: mocks.markInvalid }));
    return null;
  }) };
});

import AdminCaseEditor, { type InlineCaseEditorParts } from '@/components/AdminCaseEditor';

describe('inline case save pipeline', () => {
  let host: HTMLDivElement;
  let root: Root;
  const onClose = vi.fn<() => void>();
  const onSaved = vi.fn<() => void | Promise<void>>();
  const original: AlgCase = {
    id: 42, name: 'A+', subgroup: 'Adj Swap', setup: "R U R'",
    standard: 'R', trainerKey: 'key', oriNames: ['FR', 'FL'],
    sticker: { kind: 'face', us: 'yyyyyyyyy', ub: '', uf: '', ul: '', ur: '' },
    algs: [[{ alg: 'R', algHtml: '<u>R</u>', tags: ['oh'] }, { alg: '' }, { alg: 'F' }], [{ alg: 'L' }]],
  };
  const render = async () => act(async () => root.render(createElement(AdminCaseEditor, {
    puzzle: '3x3', setSlug: 'pll', state: { mode: 'edit', existing: original }, onClose, onSaved,
    children: (parts: InlineCaseEditorParts) => createElement(Fragment, null,
      parts.name, parts.subgroup, parts.setup, parts.algorithms, parts.advanced, parts.error, parts.actions),
  })));
  const click = async (text: string) => act(async () => {
    const button = [...host.querySelectorAll('button')].find(el => el.textContent?.trim() === text);
    expect(button, text).toBeTruthy();
    button!.click();
  });
  const fill = async (label: string, value: string) => act(async () => {
    const field = [...host.querySelectorAll('label')].find(el => el.textContent?.startsWith(label))!.querySelector('input,textarea')!;
    const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    mocks.validate.mockResolvedValue({ ok: true });
    mocks.stored.mockResolvedValue({ ok: true });
    mocks.update.mockResolvedValue(original);
    onClose.mockReset(); onSaved.mockReset();
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

  it('saves every orientation and advanced field, preserving marks and completing AUF', async () => {
    mocks.validate.mockResolvedValue({ ok: true, auf: "U'" });
    await render(); await click('Save');
    const body = mocks.update.mock.calls[0][3];
    expect(body).toMatchObject({ caseName: 'A+', subgroup: 'Adj Swap', standard: 'R', trainerKey: 'key', oriNames: ['FR', 'FL'], sticker: original.sticker });
    expect(body.algs).toEqual([
      [{ alg: "R U'", algHtml: "<u>R</u> U'", tags: ['oh'], setup: original.setup }, { alg: "F U'", setup: original.setup }],
      [{ alg: "L U'", setup: original.setup }],
    ]);
    expect(mocks.stored).toHaveBeenCalledTimes(3);
    expect(onSaved).toHaveBeenCalledWith({ type: 'update', updated: original });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('maps validation failures past blank rows and never sends invalid data', async () => {
    mocks.validate.mockImplementation(async (_setup, alg) => alg === 'F' ? { ok: false, reason: 'wrong case' } : { ok: true });
    await render(); await click('Save');
    expect(mocks.markInvalid).toHaveBeenCalledWith([{ oi: 0, ai: 2, reason: 'wrong case' }]);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('edits setup directly and sends the same draft through validation and saving', async () => {
    await render();
    const field = host.querySelector('.alg-admin-setup-textarea')!;
    expect(field.closest('details')).toBeNull();
    expect(host.querySelectorAll('.alg-admin-setup-textarea')).toHaveLength(1);
    await fill('Setup', "F R U R' F'");
    await click('Save');
    expect(mocks.update.mock.calls[0][3].setup).toBe("F R U R' F'");
    expect(mocks.validate.mock.calls[0][0]).toBe("F R U R' F'");
  });
  it('honors advanced algorithm JSON even after collapsing the section', async () => {
    await render(); await click('Advanced');
    await fill('Algs 2D JSON', JSON.stringify([[{ alg: 'B', tags: ['oh'] }], [{ alg: 'D' }]]));
    await fill('oriNames', '["Right","Left"]');
    await click('Advanced'); await click('Save');
    expect(mocks.update.mock.calls[0][3]).toMatchObject({ algs: [[{ alg: 'B', tags: ['oh'] }], [{ alg: 'D' }]], oriNames: ['Right', 'Left'] });
  });
  it('rejects malformed nested JSON before calling validation or the API', async () => {
    await render(); await click('Advanced'); await fill('Algs 2D JSON', '[42]'); await click('Save');
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Advanced algs JSON invalid');
    expect(mocks.validate).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it('keeps drafts on API failure and waits for asynchronous saved state before resetting', async () => {
    mocks.update.mockRejectedValueOnce(new Error('Save failed'));
    await render(); await click('Save');
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Save failed');
    expect(onClose).not.toHaveBeenCalled();
    let finish!: () => void;
    onSaved.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    await click('Save');
    expect(onClose).not.toHaveBeenCalled();
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
    await act(async () => finish());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
