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
let accountRestoreTimer;

function membershipContentReady(storeExpected) {
  const page = document.querySelector('.mem-page');
  if (!page || page.querySelector('.mem-loading')) return false;
  const store = page.querySelector('.mem-store');
  if (storeExpected || store) {
    if (!store || store.querySelector(':scope > button.mem-store-secondary')) return false;
    return Boolean(store.querySelector('.mem-store-catalog-status, .mem-store-actions button, :scope > p[role="status"]:not(.mem-store-message)'));
  }
  return Boolean(page.querySelector('.mem-plan-sections, .mem-empty'));
}

function watchAccountContent(origin, storeExpected = false) {
  accountContentObserver?.disconnect();
  window.clearTimeout(accountRestoreTimer);
  const report = () => {
    const url = new URL(location.href);
    const view = url.searchParams.get('view');
    const membership = url.pathname.replace(/\/$/, '').endsWith('/membership');
    const page = membership ? 'membership' : view === 'signin' ? 'security' : !view || view === 'main' ? 'profile' : null;
    if (!page || url.searchParams.has('settings')) return false;
    const selector = page === 'security' ? '.account-page-settings' : '.account-page-main';
    if (membership ? !membershipContentReady(storeExpected)
      : !document.querySelector(selector + ' .account-identity-heading')) return false;
    window.clearTimeout(accountRestoreTimer);
    window.parent.postMessage({
      type: 'cuberoot:mobile:embedded-account-content-ready', documentId, page, href: url.href,
    }, origin);
    return true;
  };
  if (report()) {
    accountContentObserver = null;
    return;
  }
  accountContentObserver = new MutationObserver(() => {
    if (report()) {
      accountContentObserver.disconnect();
      accountContentObserver = null;
    }
  });
  accountContentObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
  accountRestoreTimer = window.setTimeout(() => {
    if (document.querySelector('.settings-panel-page [data-mobile-auth-entry], .mem-store > button.mem-store-secondary')) {
      window.parent.postMessage({ type: 'cuberoot:mobile:embedded-account-restore-missing', documentId }, origin);
    }
  }, 1_500);
}

if (surface === 'tools') {
  document.addEventListener('focusout', event => {
    if (!searchExpanded || !shellOrigin || !event.target?.matches?.(searchField)
      || !window.webkit?.messageHandlers?.cuberootSearchKeyboard) return;
    window.parent.postMessage({ type: 'cuberoot:mobile:embedded-search-blur' }, shellOrigin);
  });
}

window.addEventListener('message', ({ source, origin, data }) => {
  if (source !== window.parent || !parentOrigins.includes(origin) || data?.surface !== surface) return;
  const pathname = location.pathname.replace(/^\/(?:en|zh)(?=\/|$)/, '').replace(/\/$/, '') || '/';
  const supportedPage = pathname === (surface === 'tools' ? '/' : '/account');
  const root = document.documentElement;
  if (data.type === 'cuberoot:mobile:embedded-account-switch') {
    if (surface !== 'account' || !supportedPage || shellOrigin !== origin || data.documentId !== documentId
      || !root.hasAttribute('data-native-account-detail-frame') || !['profile', 'security'].includes(data.page)) return;
    const previousState = window.history.state;
    window.history.replaceState(null, '', location.pathname + (data.page === 'security' ? '?view=signin' : ''));
    // WKUserScript runs outside the page's patched History methods. Restore
    // the router's existing state and notify its page-world popstate listener.
    if (previousState && window.history.state === null) {
      window.history.replaceState(previousState, '', location.href);
      window.dispatchEvent(new PopStateEvent('popstate', { state: previousState }));
    }
    watchAccountContent(origin);
    return;
  }
  if (data.type !== 'cuberoot:mobile:init') return;
  shellOrigin = origin;
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
    root.toggleAttribute('data-native-pro-frame', pathname === '/membership' && data.accountDetailNavigation === true);
  }

  const usesTop = supportedPage && isInset(top?.left) && isInset(top?.right);
  root.toggleAttribute('data-native-embed-top', usesTop);
  root.style.setProperty('--native-embed-left', usesTop ? top.left + 'px' : '0px');
  root.style.setProperty('--native-embed-right', usesTop ? top.right + 'px' : '0px');
  const accountDetail = surface === 'account' && (supportedPage || pathname === '/membership')
    && data.accountDetailNavigation === true;
  window.parent.postMessage({
    type: 'cuberoot:mobile:embedded-top-ready', surface, top: usesTop, search,
    ...(accountDetail ? { accountDocumentId: documentId } : {}),
  }, origin);
  if (accountDetail && !accountContentObserver) watchAccountContent(origin, data.appleMembership === true || data.googleMembership === true);
});
