const INTERNAL_REDIRECT_BASE = 'https://cuberoot.invalid';

/** Validate and normalize a same-origin path before assigning location.href. */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/')) return null;

  try {
    const target = new URL(raw, INTERNAL_REDIRECT_BASE);
    if (target.origin !== INTERNAL_REDIRECT_BASE) return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}
