import { configureAlgFileLoader, loadAlg, type AlgFile } from '@cuberoot/shared/alg';
import { runReconstructionNotation } from '@cuberoot/timer-ui/reconstruct/analysis-notation';
import type { AnalysisRequest } from '@cuberoot/timer-ui/reconstruct/analysis-protocol';
import type { NativeLiveLibraryReply } from '../lib/native-timer-live-analysis';
import type { NativeTimerWorkerEnvelope } from '../lib/native-timer-worker';

const libraries = new Map<string, { file: AlgFile; at: number }>();
const pendingLibraries = new Map<number, (file?: AlgFile) => void>();
let nextLibraryId = 0;

export async function handleNativeLiveAnalysis(
  envelope: NativeTimerWorkerEnvelope,
  post: (reply: NativeTimerWorkerEnvelope) => void,
) {
  if (envelope.intermediate) {
    const reply = envelope.payload as NativeLiveLibraryReply;
    pendingLibraries.get(reply.libraryId)?.(reply.file);
    return;
  }
  const input = envelope.payload as AnalysisRequest;
  const library = async (set: string): Promise<AlgFile> => {
    const cached = libraries.get(set);
    if (cached && Date.now() - cached.at < 5 * 60_000) return cached.file;
    const libraryId = ++nextLibraryId;
    const file = await new Promise<AlgFile>((resolve, reject) => {
      const finish = (value?: AlgFile) => {
        clearTimeout(timeout);
        pendingLibraries.delete(libraryId);
        if (value) resolve(value);
        else reject(new Error(`Unable to load reconstruction library ${set}`));
      };
      const timeout = setTimeout(finish, 2500);
      pendingLibraries.set(libraryId, finish);
      post({ ...envelope, intermediate: true, payload: { type: 'library', libraryId, set } });
    });
    libraries.set(set, { file, at: Date.now() });
    return file;
  };
  configureAlgFileLoader((puzzle, set) => puzzle === '3x3' ? library(set) : Promise.reject(new Error('Unsupported reconstruction puzzle')));
  try {
    await runReconstructionNotation(input,
      response => post({ ...envelope, intermediate: true, payload: { ...response, id: input.id } }), set => loadAlg('3x3', set));
    post({ ...envelope, payload: { id: input.id, done: true } });
  } catch (error) {
    post({ ...envelope, payload: { id: input.id, done: true, error: String(error) } });
  } finally {
    configureAlgFileLoader(null);
  }
}
