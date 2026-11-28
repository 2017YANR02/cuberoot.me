// Runs at document start in the two installed App frames. This keeps the
// bundled shell compatible with site builds that predate the chrome bridge.
if (window.parent === window || location.origin !== 'https://cuberoot.me') return;
const surface = /^cuberoot-mobile-(account|tools)(?:-no-generative-ai)?$/.exec(window.name)?.[1];
if (!surface) return;

const style = document.createElement('style');
style.textContent = styles;
const searchField = '.landing-page > .landing-search .landing-search-field';
const isInset = value => Number.isFinite(value) && value >= 0 && value <= 512;
let searchExpanded = false;
let shellOrigin;
const documentId = surface === 'account' ? crypto.randomUUID() : null;
let accountContentObserver;

function reportAccountContent(origin) {
  if (!document.querySelector('.account-identity-heading')) return false;
  window.parent.postMessage({ type: 'cuberoot:mobile:embedded-account-content-ready', documentId }, origin);
  return true;
}

if (surface === 'tools') {
  document.addEventListener('focusout', event => {
    if (!searchExpanded || !shellOrigin || !event.target?.matches?.(searchField)
      || !window.webkit?.messageHandlers?.cuberootSearchKeyboard) return;
    window.parent.postMessage({ type: 'cuberoot:mobile:embedded-search-blur' }, shellOrigin);
  });
}

window.addEventListener('message', ({ source, origin, data }) => {
  if (source !== window.parent || !parentOrigins.includes(origin)
    || data?.type !== 'cuberoot:mobile:init' || data.surface !== surface) return;
  shellOrigin = origin;

  const pathname = location.pathname.replace(/^\/(?:en|zh)(?=\/|$)/, '').replace(/\/$/, '') || '/';
  const supportedPage = pathname === (surface === 'tools' ? '/' : '/account');
  const root = document.documentElement;
  if (!style.isConnected) (document.head ?? root).append(style);
  const { bottom, top, insetByHost, toolsSearch } = data.chrome ?? {};
  // The membership reminder can appear on child routes as well as the frame home.
  root.toggleAttribute('data-embedded-bottom-nav', isInset(bottom) && bottom > 0);
  if (isInset(bottom)) root.style.setProperty('--embedded-nav-clearance', bottom + 'px');
  else root.style.removeProperty('--embedded-nav-clearance');
  if (supportedPage && isInset(bottom)) root.style.setProperty('--native-embed-bottom', bottom + 'px');
  else root.style.removeProperty('--native-embed-bottom');

  const search = surface === 'tools' && supportedPage && typeof toolsSearch?.expanded === 'boolean';
  if (surface === 'tools') {
    root.toggleAttribute('data-native-tools-insets', supportedPage && insetByHost === true);
    const wasExpanded = root.hasAttribute('data-embedded-search-open');
    const expanded = search && toolsSearch.expanded;
    const opening = expanded && !searchExpanded;
    const keyboard = window.webkit?.messageHandlers?.cuberootSearchKeyboard;
    root.toggleAttribute('data-embedded-ios-search', Boolean(search && keyboard));
    searchExpanded = expanded;
    root.toggleAttribute('data-embedded-search-button', search);
    root.toggleAttribute('data-embedded-search-open', expanded);
    root.toggleAttribute('data-embedded-search-keyboard', expanded && toolsSearch.keyboard === true);
    if (search && isInset(bottom)) root.style.setProperty('--embedded-search-clearance', bottom + 'px');
    else root.style.removeProperty('--embedded-search-clearance');
    if (opening) {
      if (keyboard) keyboard.postMessage(null);
      else if (!wasExpanded) document.querySelector(searchField)?.focus();
    }
    if (!expanded && wasExpanded && document.activeElement?.matches(searchField)) document.activeElement.blur();
  } else {
    root.toggleAttribute('data-native-account-frame', supportedPage);
    root.toggleAttribute('data-native-account-detail-frame', supportedPage && data.accountDetailNavigation === true);
  }

  const usesTop = supportedPage && isInset(top?.left) && isInset(top?.right);
  root.toggleAttribute('data-native-embed-top', usesTop);
  root.style.setProperty('--native-embed-left', usesTop ? top.left + 'px' : '0px');
  root.style.setProperty('--native-embed-right', usesTop ? top.right + 'px' : '0px');
  const accountDetail = surface === 'account' && supportedPage && data.accountDetailNavigation === true;
  window.parent.postMessage({
    type: 'cuberoot:mobile:embedded-top-ready', surface, top: usesTop, search,
    ...(accountDetail ? { accountDocumentId: documentId } : {}),
  }, origin);
  if (accountDetail && !accountContentObserver && !reportAccountContent(origin)) {
    accountContentObserver = new MutationObserver(() => {
      if (reportAccountContent(origin)) {
        accountContentObserver.disconnect();
        accountContentObserver = null;
      }
    });
    accountContentObserver.observe(root, { childList: true, subtree: true });
  }
});
