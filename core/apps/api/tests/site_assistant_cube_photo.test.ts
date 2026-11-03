import { expect, it, vi } from 'vitest';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import sharp from 'sharp';
import type { AssistantImage } from '@cuberoot/shared/site-assistant';
import { photoAlgGoal } from '@cuberoot/shared/cube-photo/lookup';
import { parseScramble } from '@cuberoot/puzzle-solvers/cube-moves';
import { applyMoves, fromFaceletString } from '@cuberoot/shared/timer/reconstruct/state';
import { cubePhotoFixture } from '@cuberoot/shared/testing/cube-photo';
import fixture from '@cuberoot/shared/testing/cube-photo-algs';
import { analyzeAssistantCubePhoto, cubePhotoImages, requiresCubePhotoEvidence, runCubePhotoTool } from '../src/utils/site_assistant_cube_photo.js';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { modelResponse } from './fixtures/site_assistant_model.js';

// The server test command builds the real worker; targeted runs require build:cube-photo first.
const libraries = fixture.libraries;
const read = async (url: string) => libraries[url.split('/').at(-1) as keyof typeof libraries];
async function photo(state: string): Promise<AssistantImage> {
  const bytes = await sharp(Buffer.from(cubePhotoFixture(true, 0.1, state).svg)).png().toBuffer();
  return { mediaType: 'image/png', data: bytes.toString('base64') };
}

it.each([
  ['oll', ['ollcp', '1lll', 'oll']], ['cross', ['zbll', 'oll', 'coll']], ['pll', ['pll']],
] as const)('recovers the exact %s state from pixels and verifies every formula', async (kind, sets) => {
  const state = fixture.states[kind];
  const result = await analyzeAssistantCubePhoto(await photo(state), undefined, read, AbortSignal.timeout(20_000));
  expect(result.status).toBe('ok');
  expect(result.recognition?.candidates[0].facelet).toBe(state);
  expect(result.results.map(r => r.set)).toEqual(sets);
  for (const r of result.results) {
    expect(r.status).toBe('found');
    expect(photoAlgGoal(r.set, applyMoves(fromFaceletString(state)!, 3, parseScramble(r.match!.alg)))).toBe(true);
    expect(r.match!.href).toMatch(new RegExp(`^/alg/3x3/${r.set}/`));
  }
}, 25_000);

it('keeps references turn-specific and rejects missing images before decoding', async () => {
  const image = await photo(fixture.states.pll);
  const refs = cubePhotoImages([image], [{ role: 'user', content: 'previous', images: [image] }, { role: 'assistant', content: 'answer' }]);
  expect([...refs.keys()]).toEqual(['history:0:0', 'current:0']);
  const analyze = vi.fn();
  expect(await runCubePhotoTool({ imageRef: 'history:1:0', sets: 'auto' }, refs, 'zh', read, new AbortController().signal, analyze)).toMatchObject({ artifacts: [], sources: [] });
  expect(analyze).not.toHaveBeenCalled();
});

it('filters requested sets and reports catalog failure without a substitute', async () => {
  const load = vi.fn(async () => { throw new Error('offline'); });
  const result = await analyzeAssistantCubePhoto(await photo(fixture.states.cross), ['pll', 'oll'], load, AbortSignal.timeout(20_000));
  expect(result.results).toEqual([{ set: 'oll', status: 'error' }]);
  expect(load).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledWith('https://api.cuberoot.me/v1/alg/sets/3x3/oll');
});

it('rejects malformed images and cancellation; blank photos never fetch catalogs', async () => {
  const load = vi.fn(), signal = new AbortController(); signal.abort();
  const bad: AssistantImage = { mediaType: 'image/png', data: 'bm90LWFuLWltYWdl' };
  await expect(analyzeAssistantCubePhoto(bad, undefined, load, signal.signal)).rejects.toThrow();
  await expect(analyzeAssistantCubePhoto(bad, undefined, load, AbortSignal.timeout(5000))).rejects.toThrow();
  const bytes = await sharp({ create: { width: 320, height: 240, channels: 3, background: '#bbb' } }).png().toBuffer();
  const result = await analyzeAssistantCubePhoto({ ...bad, data: bytes.toString('base64') }, undefined, load, AbortSignal.timeout(5000));
  expect(result.status).toBe('no-grid'); expect(result.results).toEqual([]); expect(load).not.toHaveBeenCalled();
});

it('round trips a native AI call with historical pixels and retains cards even without a model citation', async () => {
  const image = { ...await photo(fixture.states.pll), attachmentId: '11111111-1111-4111-8111-111111111111' };
  const config = { key: 'test', baseUrl: 'https://model.example/v1', model: 'qwen3.8-flash' };
  let calls = 0;
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (url === config.baseUrl + '/chat/completions') {
      const body = JSON.parse(String(init?.body));
      if (!calls++) {
        expect(body.tools.some((t: any) => t.function.name === 'lookup_cube_photo')).toBe(true);
        expect(JSON.stringify(body.messages)).toContain('history:0:0');
        expect(JSON.stringify(body.messages)).toContain('data:image/png;base64,');
        return modelResponse([{ tool: 'lookup_cube_photo', imageRef: 'history:0:0', sets: 'auto' }]);
      }
      const toolMessage = body.messages.find((m: any) => m.role === 'tool');
      expect(toolMessage.content).toContain('Simulation verifies the formula');
      expect(toolMessage.content).not.toContain(image.data);
      return modelResponse({ answerKind: 'image', answer: 'PLL 情况，已列出经过模拟验证的公式。', sourceIds: [] });
    }
    expect(url).toBe('https://api.cuberoot.me/v1/alg/sets/3x3/pll');
    return Response.json(libraries.pll);
  });
  const result = await answerSiteQuestion('查询刚才照片的公式', 'zh', config, AbortSignal.timeout(20_000), fetcher,
    [{ role: 'user', content: '前两层复原了', images: [image] }]);
  expect(calls).toBe(2);
  expect(result.artifacts).toHaveLength(1);
  expect(result.artifacts[0]).toMatchObject({ kind: 'cube-photo', status: 'ok', attachmentId: image.attachmentId,
    imageRef: 'history:0:0', results: [{ set: 'pll', status: 'found', match: { name: 'T' } }] });
  expect(JSON.stringify(result)).not.toContain(image.data);
}, 25_000);

it('runs the release worker outside the workspace, including its native dependencies', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cuberoot-photo-release-'));
  let worker: Worker | undefined;
  try {
    await cp('dist/photo-runtime', join(dir, 'photo-runtime'), { recursive: true });
    const bytes = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#fff' } }).png().toBuffer();
    worker = new Worker(join(dir, 'photo-runtime/worker.mjs'), { workerData: { image: { mediaType: 'image/png', data: bytes.toString('base64') } } });
    const current = worker;
    const message = await new Promise<any>((resolve, reject) => { current.once('message', resolve); current.once('error', reject); });
    expect(message).toMatchObject({ type: 'result', result: { status: 'no-grid', width: 64, height: 64, results: [] } });
  } finally { await worker?.terminate(); await rm(dir, { recursive: true, force: true }); }
});

it('requires actual tool evidence when the model prematurely claims a photo formula result', async () => {
  const image = await photo(fixture.states.pll), question = '查询这张魔方图片的公式';
  expect(requiresCubePhotoEvidence(question, [])).toBe(true);
  expect(requiresCubePhotoEvidence('解释图片中的数学公式', [])).toBe(false);
  expect(requiresCubePhotoEvidence('图片魔方前两层没复原，查询公式', [])).toBe(false);
  const config = { key: 'test', baseUrl: 'https://model.example/v1', model: 'qwen3.8-flash' };
  let calls = 0;
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    if (String(input).includes('/alg/sets/')) return Response.json(libraries.pll);
    if (calls++ === 0) return modelResponse({ answerKind: 'image', answer: '这是 OLL，公式已给出。', sourceIds: [] });
    if (calls === 2) {
      expect(JSON.parse(String(init?.body)).tool_choice).toEqual({ type: 'function', function: { name: 'lookup_cube_photo' } });
      return modelResponse([{ tool: 'lookup_cube_photo', imageRef: 'current:0', sets: 'auto' }]);
    }
    return modelResponse({ answerKind: 'image', answer: '已找到 PLL T 公式。', sourceIds: [] });
  });
  const answer = await answerSiteQuestion(question, 'zh', config, AbortSignal.timeout(20_000), fetcher, [], undefined, undefined, 'UTC', [image]);
  expect(calls).toBe(3);
  expect(answer.answer).toBe('已找到 PLL T 公式。');
  expect(answer.artifacts?.[0]).toMatchObject({ kind: 'cube-photo', status: 'ok', results: [{ set: 'pll', status: 'found' }] });
}, 25_000);
