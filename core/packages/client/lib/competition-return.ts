export function safeCompetitionReturn(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/wca/comp';
  try {
    const url = new URL(value, 'https://cuberoot.me');
    if (url.origin !== 'https://cuberoot.me' || /^\/(?:zh\/|en\/)?competition-verify(?:\/|$)/.test(url.pathname) || url.pathname.startsWith('/api/')) return '/wca/comp';
    return url.pathname + url.search + url.hash;
  } catch { return '/wca/comp'; }
}
