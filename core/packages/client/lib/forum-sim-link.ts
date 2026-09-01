import type { AlgPlayerPuzzle } from '@/components/AlgPlayer/player-setup';

export interface ForumSimLink {
  href: string;
  puzzle: AlgPlayerPuzzle;
  puzzleOrder: number;
  alg: string;
  setup: string;
  stickering: string;
  orientation: string;
}

const PUZZLES: Partial<Record<string, AlgPlayerPuzzle>> = {
  '2': '2x2',
  '3': '3x3',
  '4': '4x4',
  '5': '5x5',
};
const ALLOWED_HOSTS = new Set(['cuberoot.me', 'www.cuberoot.me', 'localhost', '127.0.0.1']);
const ALG_RE = /^[RUFLDBMESxyzw0-9'\s]*$/;
const ORIENTATION_RE = /^(?:[xyz](?:2|')?(?:\s+|$))*$/;
const STICKERING_RE = /^[A-Za-z0-9_-]{1,32}$/;

/** Parse a trusted-shape CubeRoot /sim URL; all other links stay ordinary Markdown links. */
export function parseForumSimLink(raw: string): ForumSimLink | null {
  if (!raw || raw.length > 4096) return null;

  let url: URL;
  try {
    url = new URL(raw, 'https://cuberoot.me');
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || !ALLOWED_HOSTS.has(url.hostname)) return null;

  const path = url.pathname.replace(/^\/(?:en|zh)(?=\/)/, '');
  if (path !== '/sim') return null;

  const orderText = url.searchParams.get('puzzle') ?? '3';
  const puzzle = PUZZLES[orderText];
  const puzzleOrder = Number(orderText);
  const alg = (url.searchParams.get('alg') ?? '').trim();
  const setup = (url.searchParams.get('setup') ?? '').trim();
  const stickering = url.searchParams.get('stickering') ?? 'full';
  const orientation = (url.searchParams.get('stickeringRot') ?? '').trim();
  if (
    !puzzle ||
    alg.length > 512 ||
    setup.length > 512 ||
    !ALG_RE.test(alg) ||
    !ALG_RE.test(setup) ||
    !STICKERING_RE.test(stickering) ||
    !ORIENTATION_RE.test(orientation)
  ) {
    return null;
  }

  return {
    href: `/sim${url.search}`,
    puzzle,
    puzzleOrder,
    alg,
    setup,
    stickering,
    orientation,
  };
}
