'use client';

/** Receive a public tab's one-time ticket without navigating away from the page. */
export function listenForMiniProgramTabSession(tab: 'tools' | 'timer') {
  let generation = 0;
  let stopLogoutListener: (() => void) | undefined;
  async function syncSession() {
    const { hash } = window.location;
    const match = /(?:^#|&)ticket=([A-Za-z0-9_-]{43})$/.exec(hash);
    if (!match) return;
    const attempt = ++generation;
    const current = () => generation === attempt;
    const [bridge, auth, handoff] = await Promise.all([
      import('@/lib/miniprogram-bridge'), import('@/lib/auth-store'), import('@/lib/miniprogram-auth-handoff'),
    ]);
    if (!current() || window.location.hash !== hash || bridge.miniProgramTab() !== tab) return;
    stopLogoutListener?.();
    stopLogoutListener = auth.subscribeExplicitAuthLogout(() => { generation++; });
    if (!await bridge.isConfirmedMiniProgramWebView() || !current() || window.location.hash !== hash) return;
    const url = new URL(window.location.href);
    url.hash = hash.slice(0, match.index);
    // eslint-disable-next-line no-restricted-syntax, no-restricted-globals -- Remove the one-time ticket before exchanging it.
    window.history.replaceState(window.history.state, '', url);
    const session = await handoff.exchangeMiniProgramWebSession(match[1]!);
    if (current()) await auth.applySession(session.token, session.user, current);
  }
  const consume = () => { void syncSession().catch(() => { /* Public pages remain usable if account services are unavailable. */ }); };
  // The native tab delivers fresh session tickets in the fragment while retaining the document.
  window.addEventListener('hashchange', consume);
  consume();
  return () => {
    generation++;
    stopLogoutListener?.();
    window.removeEventListener('hashchange', consume);
  };
}
