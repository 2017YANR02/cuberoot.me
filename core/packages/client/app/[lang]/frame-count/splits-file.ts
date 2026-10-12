export interface Solve {
  name: string;
  marks: { frame: number }[];
  time: string;
}

export type StartFrameMethod = 'fps' | 'timestamp';

export function isVideoFileName(name: string): boolean {
  return !name.startsWith('._') && /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(name);
}

/** A dropped File exposes no parent directory. Verify the selected directory's entry. */
export async function matchesVideoFile(a: File, b: File): Promise<boolean> {
  if (a.name !== b.name || a.size !== b.size || a.lastModified !== b.lastModified) return false;
  // Avoid accepting a different same-name/size video; only read small bounded samples.
  for (const start of new Set([0, Math.max(0, Math.floor(a.size / 2) - 32768), Math.max(0, a.size - 65536)])) {
    const [left, right] = await Promise.all([
      a.slice(start, start + 65536).arrayBuffer(), b.slice(start, start + 65536).arrayBuffer(),
    ]);
    const bytes = new Uint8Array(right);
    if (!new Uint8Array(left).every((value, i) => value === bytes[i])) return false;
  }
  return true;
}

export function serializeSplits(solves: Solve[], fps: number, startFrameMethod: StartFrameMethod): string {
  // Keep the readable legacy frame lines, with versioned metadata for lossless restoration.
  const metadata = { version: 1, startFrameMethod, times: solves.map(s => s.time) };
  return [
    `#frame-count ${JSON.stringify(metadata)}`,
    `fps:${fps}`,
    ...solves.map(s => `${s.name}:${s.marks.map(m => m.frame).join(':')}`),
    '',
  ].join('\n');
}

export function parseSplits(text: string): {
  solves: Solve[]; fps: number | null; startFrameMethod: StartFrameMethod; hasTimes: boolean;
} {
  const solves: Solve[] = [];
  let fps: number | null = null;
  let startFrameMethod: StartFrameMethod = 'fps';
  let times: string[] | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#frame-count ')) {
      const meta = JSON.parse(line.slice('#frame-count '.length));
      if (meta?.version !== 1 || !['fps', 'timestamp'].includes(meta.startFrameMethod)
        || !Array.isArray(meta.times) || !meta.times.every((v: unknown) => typeof v === 'string')) {
        throw new Error('Invalid splits metadata');
      }
      startFrameMethod = meta.startFrameMethod;
      times = meta.times;
      continue;
    }
    if (line.startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon <= 0) throw new Error('Invalid splits line');
    const key = line.slice(0, colon);
    const rest = line.slice(colon + 1);
    if (key === 'fps') {
      const value = Number(rest);
      if (!Number.isFinite(value) || value <= 0) throw new Error('Invalid splits FPS');
      fps = value;
    } else {
      const frames = rest.split(/[:|]/).map(s => s.trim()).filter(Boolean).map(Number);
      if (frames.some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error('Invalid split frame');
      solves.push({ name: key === 'splits' ? `Solve ${solves.length + 1}` : key, marks: frames.map(frame => ({ frame })), time: '' });
    }
  }
  if (!solves.length || (times && times.length !== solves.length)) throw new Error('Incomplete splits file');
  solves.forEach((solve, i) => { solve.time = times?.[i] ?? ''; });
  return { solves, fps, startFrameMethod, hasTimes: times !== undefined };
}
