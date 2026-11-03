// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import type { CubePhotoArtifact } from '@cuberoot/shared/cube-photo/result';
import { findPhotoAlg } from '@cuberoot/shared/cube-photo/lookup';
import { classifyPhotoColors, COLOR_RGB, standardColorFrames } from '@cuberoot/shared/cube-photo/recognize';
import type { AlgFile } from '@cuberoot/shared/alg';
import fixture from '@cuberoot/shared/testing/cube-photo-algs';
import PhotoChatResult from '@/components/cube-photo/PhotoChatResult';
import { assistantAnswerText } from '@/lib/assistant-answer-export';
import { assistantPdfDocument } from '@/lib/assistant-pdf';
import { documentExportText } from '@/lib/document-export';

vi.mock('@/i18n/tr', () => ({ tr: ({ zh }: { zh: string }) => zh }));
vi.mock('@/components/AppLink', () => ({ default: ({ prefetch: _, children, ...props }: any) => createElement('a', props, children) }));
vi.mock('@cuberoot/shared/alg', async original => ({ ...await original<object>(), loadAlg: async () => fixture.libraries.pll }));
vi.mock('@/app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView', () => ({ default: ({ embedded }: { embedded: boolean }) => createElement('div', { 'data-embedded': embedded }, 'case view') }));

const state = fixture.states.pll;
const frame = standardColorFrames().find(f => f.U === 'yellow' && f.F === 'blue')!;
const match = findPhotoAlg(state, 'pll', fixture.libraries.pll as AlgFile)!;
const centers = classifyPhotoColors([COLOR_RGB.blue, COLOR_RGB.red]);
const result: CubePhotoArtifact = {
  kind: 'cube-photo', title: '拍照查公式', imageRef: 'current:0', attachmentId: '11111111-1111-4111-8111-111111111111',
  width: 640, height: 540, status: 'ok', assumptions: { f2lSolved: true, standardColorScheme: true },
  recognition: { status: 'ok', samples: [], centers: { F: centers[0], R: centers[1] }, candidates: [{ facelet: state, frame }] },
  results: [{ set: 'pll', status: 'found', match }],
};
const roots: ReturnType<typeof createRoot>[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await act(async () => root.unmount()); document.body.replaceChildren(); vi.unstubAllGlobals(); });

it('renders and copies the exact verified moves, opens the existing case modal and preserves the host title', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  document.title = 'Chat';
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host); roots.push(root);
  await act(async () => root.render(createElement(PhotoChatResult, { result })));
  expect(host.querySelectorAll('[data-alg-set]')).toHaveLength(1);
  expect(host.querySelector('code')?.textContent).toBe(match.alg);
  expect(host.querySelector('a[href*="attachment="]')?.getAttribute('href')).toBe(`/alg/photo?attachment=${result.attachmentId}`);
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="复制 PLL 公式"]')!.click());
  expect(writeText).toHaveBeenCalledWith(match.alg);
  await act(async () => host.querySelector<HTMLAnchorElement>(`a[href="${match.href}"]`)!.click());
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"] [data-embedded="true"]')).not.toBeNull());
  expect(document.title).toBe('Chat');
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(host.querySelector('code')?.textContent).toBe(match.alg);
});

it('exports exact AUF, orientation and case links without exposing the private image reference', async () => {
  const answer = { answer: '已验证', sources: [], artifacts: [result] };
  const text = assistantAnswerText(answer, 'https://www.cuberoot.me');
  expect(text).toContain(match.alg); expect(text).toContain('U: yellow');
  expect(text).toContain('https://www.cuberoot.me' + match.href);
  expect(text).not.toContain(result.attachmentId!);
  const pdf = documentExportText(await assistantPdfDocument('查询公式', '已验证', 'zh', [result]));
  expect(pdf).toContain(match.alg); expect(pdf).toContain('https://www.cuberoot.me' + match.href);
  expect(pdf).not.toContain(result.attachmentId!);
});

it('renders partial formulas without an invalid-state error or a fabricated unique frame', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const oll = findPhotoAlg(fixture.states.oll, 'oll', fixture.libraries.oll as AlgFile)!;
  const partial: CubePhotoArtifact = { ...result, status: 'partial',
    recognition: { ...result.recognition!, status: 'partial' }, results: [{ set: 'oll', status: 'found', match: oll }] };
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host); roots.push(root);
  await act(async () => root.render(createElement(PhotoChatResult, { result: partial })));
  expect(host.querySelector('code')?.textContent).toBe(oll.alg);
  expect(host.textContent).toContain('完整状态尚不唯一');
  expect(host.textContent).not.toContain('无法组成合法顶层');
  const text = assistantAnswerText({ answer: '', sources: [], artifacts: [partial] }, 'https://www.cuberoot.me');
  expect(text).toContain('complete state is ambiguous');
  expect(text).not.toContain('U: yellow');
  const pdf = documentExportText(await assistantPdfDocument('查询公式', '', 'zh', [partial]));
  expect(pdf).toContain('完整状态尚不唯一');
  expect(pdf).not.toContain('U: yellow');
});

it('shows preloaded alternatives immediately, expands only one category and never starts a lookup on click', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const worker = vi.fn();
  vi.stubGlobal('Worker', worker);
  const writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const cross = fixture.states.cross;
  const crossResults = (['zbll', 'oll', 'coll'] as const).map(set => {
    const match = findPhotoAlg(cross, set, fixture.libraries[set] as AlgFile)!;
    return { set, status: 'found' as const, match, alternatives: [{ ...match, alg: match.alg + " R L R' L'" }] };
  });
  const crossArtifact: CubePhotoArtifact = { ...result, recognition: { ...result.recognition!, candidates: [{ facelet: cross, frame }] }, results: crossResults };
  const alternative = crossResults[1].alternatives[0];
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host); roots.push(root);
  await act(async () => root.render(createElement(PhotoChatResult, { result: crossArtifact })));
  const toggle = (set: string) => host.querySelector<HTMLButtonElement>('[data-alg-set="' + set + '"] .cube-photo-expand')!;
  const panel = (set: string) => host.querySelector('[data-alg-set="' + set + '"] [role="region"]')!;
  expect(panel('oll').querySelector('code')?.textContent).toBe(alternative.alg);
  expect(panel('oll').hasAttribute('inert')).toBe(true);
  await act(async () => toggle('zbll').click());
  await act(async () => toggle('oll').click());
  expect(host.querySelectorAll('.cube-photo-expand[aria-expanded="true"]')).toHaveLength(1);
  expect(toggle('oll').getAttribute('aria-expanded')).toBe('true');
  expect(panel('zbll').hasAttribute('inert')).toBe(true);
  expect(panel('oll').hasAttribute('inert')).toBe(false);
  expect(panel('oll').querySelector('code')?.textContent).toBe(alternative.alg);
  expect(panel('oll').textContent).not.toContain('正在查找');
  await act(async () => panel('oll').querySelector<HTMLButtonElement>('[aria-label="复制 OLL 其他公式 1"]')!.click());
  expect(writeText).toHaveBeenCalledWith(alternative.alg);
  await act(async () => toggle('oll').click());
  expect(host.querySelectorAll('.cube-photo-expand[aria-expanded="true"]')).toHaveLength(0);
  expect(panel('oll').hasAttribute('inert')).toBe(true);
  await act(async () => toggle('oll').click());
  expect(panel('oll').querySelector('code')?.textContent).toBe(alternative.alg);
  expect(worker).not.toHaveBeenCalled();
  await act(async () => root.render(createElement(PhotoChatResult, { result })));
  expect(host.querySelectorAll('.cube-photo-expand')).toHaveLength(0);
  expect(host.textContent).not.toContain(alternative.alg);
});
