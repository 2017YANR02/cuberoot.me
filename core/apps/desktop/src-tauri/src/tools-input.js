// Inside the canonical Tools frame, keyboard and mouse events do not bubble to the shell.
if (window === window.parent || location.origin !== 'https://cuberoot.me'
    || !/^cuberoot-mobile-tools(?:-no-generative-ai)?$/.test(window.name)) return;
let shellOrigin;
let searchExpanded = false;
let pendingFocus;
function focusSearch() {
  pendingFocus?.disconnect();
  const focusVisibleField = () => {
    if (!searchExpanded) return;
    const field = document.querySelector('.landing-page > .landing-search .landing-search-field');
    if (!field?.getBoundingClientRect().width || getComputedStyle(field).visibility !== 'visible') return;
    const native = window.webkit?.messageHandlers?.cuberootDesktopSearch;
    if (native) native.postMessage(null);
    else field.focus({ preventScroll: true });
    pendingFocus?.disconnect();
  };
  // The server can deliver the field inside a hidden React streaming boundary.
  pendingFocus = new MutationObserver(focusVisibleField);
  pendingFocus.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
  requestAnimationFrame(focusVisibleField);
}
window.addEventListener('message', event => {
  if (event.source !== window.parent || !parentOrigins.includes(event.origin)) return;
  if (event.data?.type === 'cuberoot:mobile:init' && event.data.surface === 'tools') {
    shellOrigin = event.origin;
    const expanded = event.data.chrome?.toolsSearch?.expanded === true;
    if (expanded && !searchExpanded) focusSearch();
    if (!expanded) pendingFocus?.disconnect();
    searchExpanded = expanded;
  }
  if (event.data?.type === 'cuberoot:desktop:focus-search' && searchExpanded) focusSearch();
  if (event.data?.type === 'cuberoot:desktop:reload-tool') location.reload();
});
function send(command) {
  if (shellOrigin) window.parent.postMessage({ type: 'cuberoot:desktop:tools-input', command }, shellOrigin);
}
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !event.isComposing && document.documentElement.hasAttribute('data-embedded-search-open')) {
    event.preventDefault();
    send('escape');
  }
}, true);
window.addEventListener('mouseup', event => {
  if (event.button === 3 && shellOrigin) {
    event.preventDefault();
    send('back');
  }
});
window.addEventListener('auxclick', event => {
  if (event.button === 3 && shellOrigin) event.preventDefault();
});
