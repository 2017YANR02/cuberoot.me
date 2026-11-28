// Injected at document start in an isolated WebKit world on iOS and macOS.
// WebKit only retains the cross-site frame’s guest marker for this session.
if (window.parent === window || location.origin !== 'https://cuberoot.me'
  || !/^cuberoot-mobile-tools(?:-no-generative-ai)?$/.test(window.name)) return;
const key = 'cuberoot_guided';
try {
  if (seen) {
    localStorage.setItem(key, 'true');
    return;
  }
  const events = ['click', 'keydown', 'cancel'];
  const sync = () => {
    try {
      if (localStorage.getItem(key) !== 'true') return;
      window.webkit.messageHandlers.cuberootGuestTourSeen.postMessage(true);
      events.forEach(type => window.removeEventListener(type, afterAction, true));
      window.removeEventListener('pagehide', sync);
    } catch { /* The website still owns onboarding when storage is unavailable. */ }
  };
  // Read after the website's close, skip or finish handler updates storage.
  const afterAction = () => setTimeout(sync, 0);
  events.forEach(type => window.addEventListener(type, afterAction, true));
  window.addEventListener('pagehide', sync);
  sync();
} catch { /* Ignore unavailable storage. */ }
