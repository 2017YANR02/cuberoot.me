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
