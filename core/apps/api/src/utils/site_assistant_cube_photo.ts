import { Worker } from 'node:worker_threads';
import type { AssistantImage, AssistantMessage } from '@cuberoot/shared/site-assistant';
import { loadAlg, type AlgFile } from '@cuberoot/shared/alg';
import type { PhotoAlgSet } from '@cuberoot/shared/cube-photo/lookup';
import { photoRecognitionSets } from '@cuberoot/shared/cube-photo/lookup';
import type { CubePhotoResult, CubePhotoArtifact } from '@cuberoot/shared/cube-photo/result';
import { AssistantFailure } from './site_assistant_diagnostics.js';
import type { JsonReader, ToolResult } from './site_assistant_tools.js';

export function cubePhotoImages(images: AssistantImage[], history: AssistantMessage[]): Map<string, AssistantImage> {
  const refs = new Map<string, AssistantImage>();
  history.forEach((message, turn) => { if (message.role === 'user') message.images?.forEach((image, i) => refs.set(`history:${turn}:${i}`, image)); });
  images.forEach((image, i) => refs.set(`current:${i}`, image));
  return refs;
}

/** A narrow evidence backstop for explicit requests; the model still selects the image and sets. */
export function requiresCubePhotoEvidence(question: string, history: AssistantMessage[]): boolean {
  const context = [question, ...history.filter(m => m.role === 'user').slice(-2).map(m => m.content)].join('\n');
  if (!/\bCMLL\b/i.test(context) && /(?:前两层|F2L).{0,12}(?:未|没|不)(?:完全)?(?:复原|还原)|fully scrambled|F2L.{0,12}(?:unsolved|not solved)/i.test(context)) return false;
  return /魔方|cube|\b(?:OLL|PLL|COLL|ZBLL|OLLCP|1LLL|CMLL|ELL)\b/i.test(context)
    && /公式|算法|case|\b(?:OLL|PLL|COLL|ZBLL|OLLCP|1LLL|CMLL|ELL)\b/i.test(question)
    && /照片|图片|图|photo|picture|image|识别|判断|当前|this|current/i.test(question);
}

let active = 0;
/** The CPU job is cancellable and isolated from Hono's event loop. Catalogs use the existing bounded reader. */
export async function analyzeAssistantCubePhoto(image: AssistantImage, sets: PhotoAlgSet[] | undefined, read: JsonReader,
  signal: AbortSignal): Promise<CubePhotoResult> {
  signal.throwIfAborted();
  if (active >= 2) throw new AssistantFailure('busy');
  active++;
  let worker: Worker | undefined;
  try {
    const entry = new URL(import.meta.url.endsWith('/server.bundle.js') ? './photo-runtime/worker.mjs' : '../../dist/photo-runtime/worker.mjs', import.meta.url);
    worker = new Worker(entry, { workerData: { image, sets }, resourceLimits: { maxOldGenerationSizeMb: 128 } });
    const current = worker;
    return await new Promise<CubePhotoResult>((resolve, reject) => {
      let settled = false;
      const done = (error?: Error, result?: CubePhotoResult) => {
        if (settled) return;
        settled = true; clearTimeout(timer); signal.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(result!);
      };
      const abort = () => done(new AssistantFailure('timeout'));
      const timer = setTimeout(abort, 20_000);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) { abort(); return; }
      current.on('error', () => done(new AssistantFailure('unavailable')));
      current.on('exit', () => { if (!settled) done(new AssistantFailure('unavailable')); });
      current.on('message', async (message: { type: string; sets?: PhotoAlgSet[]; result?: CubePhotoResult }) => {
        if (settled) return;
        if (message.type === 'result') { done(undefined, message.result); return; }
        if (message.type === 'error') { done(new AssistantFailure('invalid_image')); return; }
        if (message.type === 'catalogs') {
          const libraries: Partial<Record<PhotoAlgSet, AlgFile>> = {};
          await Promise.all((message.sets ?? []).map(async set => {
            try { libraries[set] = await loadAlg('3x3', set, { loader: (puzzle, slug) => read(`https://api.cuberoot.me/v1/alg/sets/${puzzle}/${slug}`) }); } catch { /* Per-set failure is rendered, not replaced by a generated formula. */ }
          }));
          if (!settled) {
            try { current.postMessage(libraries); } catch { done(new AssistantFailure('unavailable')); }
          }
        }
      });
    });
  } finally { if (worker) await worker.terminate(); active--; }
}

export async function runCubePhotoTool(call: { imageRef: string; sets: 'auto' | PhotoAlgSet[] }, images: Map<string, AssistantImage>,
  lang: 'zh' | 'en', read: JsonReader, signal: AbortSignal, analyze = analyzeAssistantCubePhoto): Promise<ToolResult> {
  const image = images.get(call.imageRef);
  if (!image) return { evidence: { error: 'The image reference is unavailable. Use a listed imageRef or ask for the missing image.' }, sources: [], artifacts: [] };
  const result = await analyze(image, call.sets === 'auto' ? undefined : call.sets, read, signal);
  const title = { zh: '拍照查公式', en: 'Photo algorithm lookup' }[lang];
  const artifact: CubePhotoArtifact = { ...result, kind: 'cube-photo', title, imageRef: call.imageRef, attachmentId: image.attachmentId };
  const applicableSets = result.recognition ? photoRecognitionSets(result.recognition) : [];
  const stage = result.status === 'partial' ? 'partial' : result.status === 'corners-only' ? 'corners-only' : result.status !== 'ok' ? 'needs-correction' : applicableSets.includes('pll') ? 'oriented-top'
    : applicableSets.includes('zbll') ? 'oriented-cross' : applicableSets.length ? 'unoriented-cross' : 'solved';
  const matches = result.results.flatMap(r => r.match ? [r.match] : []);
  const sources = matches.map(match => ({ id: `photo:${call.imageRef}:${match.set}`, title: `${match.set.toUpperCase()} · ${match.name}`, href: match.href, read: true }));
  // One stable source also keeps a failed/solved result visible without inventing a case citation.
  sources.push({ id: `photo:${call.imageRef}`, title, href: '/alg/photo', read: true });
  return { sources, artifacts: [artifact], evidence: { status: result.status, stage, applicableSets, assumptions: result.assumptions,
    state: result.status === 'ok' ? result.recognition?.candidates : [], candidateCount: result.recognition?.candidates.length, corners: result.recognition?.cornerCandidates,
    inferredColors: result.recognition?.samples.flatMap((s, index) => s.inferred ? [{ index, observedColor: s.observedColor, color: s.color }] : []),
    requestedSets: result.requestedSets, results: result.results.map(({ alternatives: _, ...primary }) => primary),
    instruction: 'The UI renders the exact tool results, orientation and case links. For this lookup, write ONE short sentence using ONLY stage, matched case names and result status. Do not infer or describe corner/edge permutations, swap counts, bottom-layer observations, move counts or the cards\' screen position. Do not repeat or rewrite move sequences. F2L solved and standard colors are assumptions, not visually proven; when the user already confirmed them, do not question their statement. Simulation verifies the formula for the recovered state, not image accuracy. corners-only means only CMLL is available; do not claim a complete cube or edge state. partial means the complete state is not unique: only the returned categories have an algorithm verified against EVERY compatible completion, including its AUF. Never describe a partial result as a uniquely recovered cube. inferredColors are unique constraint completions, not directly observed colors. Uncertain/ambiguous/invalid/no-grid requires correction or a better photo; never invent missing stickers or formulas. All displayed formulas independently start from the photo state and include AUF.' } };
}
