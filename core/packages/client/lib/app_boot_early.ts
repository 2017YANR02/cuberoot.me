export const DEFAULT_TIMEOUT_MS = 20_000;
export const MAX_EVIDENCE = 4;
export const MAX_DETAIL_LENGTH = 500;
export const STORAGE_KEY = 'timer.boot.lastDiagnostic';
export const APP_STORAGE_KEY = 'app.boot.lastDiagnostic';
export const EARLY_STORAGE_KEY = 'app.boot.earlyEvidence';
export const MIN_SUPPORTED_CHROMIUM_MAJOR = 111;
const APP_BOOT_GRACE_MS = 5_000;

export const APP_BOOT_COPY = {
  title: { zh: '页面未能启动', en: 'Page failed to start' },
  message: {
    zh: '请检查网络后重试。如果仍然失败，请把下面的诊断信息发给我们。',
    en: 'Check your connection and retry. If it still fails, send us the diagnostic information below.',
  },
  outdatedWechatMessage: {
    zh: '当前微信内置浏览器无法打开此页面。即使微信和手机系统已是最新版，也可能仍使用较旧内核。请点击右上角菜单，选择“在浏览器打开”。',
    en: 'WeChat\'s built-in browser cannot open this page. It may still use an older engine even when WeChat and your phone\'s operating system are up to date. Use the top-right menu and choose “Open in Browser.”',
  },
  outdatedBrowserMessage: {
    zh: '当前浏览器版本过旧，无法打开此页面。请升级浏览器后重试。',
    en: 'This browser is too old to open this page. Update it and try again.',
  },
  diagnosticCode: { zh: '诊断编号', en: 'Diagnostic code' },
  retry: { zh: '重试', en: 'Retry' },
  copy: { zh: '复制诊断信息', en: 'Copy diagnostic info' },
  copied: { zh: '已复制', en: 'Copied' },
} as const;

export const TIMER_BOOT_COPY = {
  loading: { zh: '正在加载计时器…', en: 'Loading timer…' },
  title: { zh: '计时器未能启动', en: 'Timer failed to start' },
  message: {
    zh: '请检查网络后重试。如果仍然失败，请把下面的诊断信息发给我们。',
    en: 'Check your connection and retry. If it still fails, send us the diagnostic information below.',
  },
  outdatedWechatMessage: {
    zh: '当前微信内置浏览器无法启动计时器。即使微信和手机系统已是最新版，也可能仍使用较旧内核。请点击右上角菜单，选择“在浏览器打开”。',
    en: 'WeChat\'s built-in browser cannot start the timer. It may still use an older engine even when WeChat and your phone\'s operating system are up to date. Use the top-right menu and choose “Open in Browser.”',
  },
  outdatedBrowserMessage: {
    zh: '当前浏览器版本过旧，无法启动计时器。请升级浏览器后重试。',
    en: 'This browser is too old to start the timer. Update it and try again.',
  },
  diagnosticCode: { zh: '诊断编号', en: 'Diagnostic code' },
  retry: { zh: '重试', en: 'Retry' },
  copy: { zh: '复制诊断信息', en: 'Copy diagnostic info' },
  copied: { zh: '已复制', en: 'Copied' },
} as const;

const EARLY_COPY_JSON = JSON.stringify({ app: APP_BOOT_COPY, timer: TIMER_BOOT_COPY });

/**
 * Runs from the server HTML before React hydration. Keep this ES5-shaped: its
 * purpose is to show an actionable failure even when an old engine cannot
 * parse the shared Next.js runtime chunks that would normally render React.
 */
export const APP_BOOT_EARLY_SCRIPT = `(function () {
  var isTimer = /^\\/(?:zh\\/)?timer(?:\\/|$)/.test(window.location.pathname);
  document.documentElement.setAttribute('data-app-boot-guard', 'active');
  if (window.__appBootEarly && window.__appBootEarly.stop) window.__appBootEarly.stop();
  var allCopy = ${EARLY_COPY_JSON};
  var copy = isTimer ? allCopy.timer : allCopy.app;
  var evidence = [];
  var stopped = false;
  var rendered = false;
  var renderQueued = false;
  var timer = 0;
  var graceTimer = 0;
  try { window.sessionStorage.setItem('${EARLY_STORAGE_KEY}', '[]'); } catch (_) {}
  function compact(value) {
    return String(value || '').replace(/\\s+/g, ' ').replace(/^\\s+|\\s+$/g, '').slice(0, ${MAX_DETAIL_LENGTH});
  }
  function safeUrl(value) {
    if (!value) return '';
    try {
      var parsed = new URL(value, window.location.origin);
      return parsed.origin + parsed.pathname;
    } catch (_) {
      return compact(String(value).split(/[?#]/)[0]);
    }
  }
  function remember(item) {
    evidence.push(item);
    if (evidence.length > ${MAX_EVIDENCE}) evidence.shift();
    try { window.sessionStorage.setItem('${EARLY_STORAGE_KEY}', JSON.stringify(evidence)); } catch (_) {}
    if (isFatal(item)) queueFailure();
  }
  function isFatal(item) {
    var combined = item.name + ' ' + item.message + ' ' + (item.url || '');
    if (/_next\\/static\\/chunks/i.test(combined)) return true;
    return /ChunkLoadError|Loading chunk|dynamically imported module|module script|CSS_CHUNK_LOAD_FAILED/i.test(combined);
  }
  function queueFailure() {
    if (stopped || rendered || renderQueued) return;
    renderQueued = true;
    window.setTimeout(function () {
      renderQueued = false;
      renderFailure();
    }, 0);
  }
  function onError(event) {
    var target = event.target || {};
    var error = event.error || null;
    var url = safeUrl(event.filename || target.src || target.href || '');
    remember({
      source: 'error',
      name: compact((error && error.name) || (url ? 'ResourceError' : 'Error')),
      message: compact((error && error.message) || event.message || (url ? 'A startup resource failed to load.' : 'A startup error event was captured.')),
      url: url || undefined
    });
  }
  function onRejection(event) {
    var reason = event.reason;
    remember({
      source: 'unhandledrejection',
      name: compact((reason && reason.name) || 'Error'),
      message: compact((reason && reason.message) || reason || 'Unhandled startup rejection.')
    });
  }
  function classify() {
    if (navigator.onLine === false) return 'network';
    var combined = '';
    var hasScriptUrl = false;
    var hasUnhandled = false;
    for (var index = 0; index < evidence.length; index += 1) {
      var item = evidence[index];
      combined += ' ' + item.name + ' ' + item.message + ' ' + (item.url || '');
      if (item.url) hasScriptUrl = true;
      if (item.source === 'unhandledrejection') hasUnhandled = true;
    }
    if (/ChunkLoadError|Loading chunk|dynamically imported module|module script|CSS_CHUNK_LOAD_FAILED|_next\\/static\\/chunks/i.test(combined)) return 'chunk';
    if (/SyntaxError|Unexpected token|Script error|parse error|is not a function|is undefined/i.test(combined)) return 'script';
    if (hasScriptUrl) return 'script';
    if (hasUnhandled) return 'promise';
    return 'timeout';
  }
  function hash(value) {
    var result = 0x811c9dc5;
    for (var index = 0; index < value.length; index += 1) {
      result ^= value.charCodeAt(index);
      result = Math.imul(result, 0x01000193);
    }
    var encoded = (result >>> 0).toString(36).toUpperCase();
    while (encoded.length < 7) encoded = '0' + encoded;
    return encoded;
  }
  function diagnosticText(report) {
    var lines = [
      isTimer ? 'CubeRoot timer startup diagnostic' : 'CubeRoot page startup diagnostic',
      'Code: ' + report.code,
      'Type: ' + report.kind,
      'Time: ' + report.occurredAt,
      'Path: ' + report.path,
      'Online: ' + String(report.online),
      'Browser: ' + report.userAgent,
      'Error: ' + report.errorName + ' | ' + report.errorMessage
    ];
    for (var index = 0; index < report.evidence.length; index += 1) {
      var item = report.evidence[index];
      lines.push('Evidence ' + (index + 1) + ': ' + item.source + ' | ' + item.name + ' | ' + item.message + (item.url ? ' | ' + item.url : ''));
    }
    return lines.join('\\n');
  }
  function fallbackCopy(text, done) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    var copied = false;
    try {
      copied = typeof document.execCommand === 'function' && document.execCommand('copy');
    } catch (_) {}
    document.body.removeChild(textarea);
    done(copied);
  }
  function copyReport(report, done) {
    var text = diagnosticText(report);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }
  function messageKey(report) {
    var versionMatch = /(?:Chrome|Chromium|CriOS)\\/(\\d+)/i.exec(report.userAgent || '');
    if (!versionMatch || parseInt(versionMatch[1], 10) >= ${MIN_SUPPORTED_CHROMIUM_MAJOR}) return 'message';
    var combined = report.errorName + ' ' + report.errorMessage;
    for (var index = 0; index < report.evidence.length; index += 1) {
      combined += ' ' + report.evidence[index].name + ' ' + report.evidence[index].message;
    }
    if (!/SyntaxError|Unexpected token|parse error/i.test(combined)) return 'message';
    return /MicroMessenger/i.test(report.userAgent) ? 'outdatedWechatMessage' : 'outdatedBrowserMessage';
  }
  function renderFailure() {
    if (stopped || rendered) return;
    if (!document.body) {
      queueFailure();
      return;
    }
    var root = isTimer ? document.querySelector('[data-timer-bootstrap="loading"]') : null;
    var overlay = !root;
    if (!root) {
      root = document.querySelector('[data-app-bootstrap="error"]');
      if (!root) {
        root = document.createElement('main');
        document.body.insertBefore(root, document.body.firstChild);
      }
    }
    rendered = true;
    capture.stop();
    var kind = classify();
    var tags = { network: 'NET', chunk: 'CHUNK', script: 'SCRIPT', promise: 'PROMISE', timeout: 'TIMEOUT' };
    var last = evidence.length ? evidence[evidence.length - 1] : null;
    var fingerprint = kind;
    for (var index = 0; index < evidence.length; index += 1) {
      fingerprint += '|' + evidence[index].source + '|' + evidence[index].name + '|' + evidence[index].message + '|' + (evidence[index].url || '');
    }
    var report = {
      code: (isTimer ? 'TMR-' : 'APP-') + tags[kind] + '-' + hash(fingerprint),
      kind: kind,
      occurredAt: new Date().toISOString(),
      path: window.location.pathname,
      online: typeof navigator.onLine === 'boolean' ? navigator.onLine : null,
      userAgent: navigator.userAgent || '',
      errorName: last ? last.name : 'TimeoutError',
      errorMessage: last ? last.message : 'The page did not start before the timeout.',
      evidence: evidence.slice(0)
    };
    try { window.__appBootDiagnostic = report; } catch (_) {}
    if (isTimer) {
      try { window.__timerBootDiagnostic = report; } catch (_) {}
    }
    try { window.sessionStorage.setItem(isTimer ? '${STORAGE_KEY}' : '${APP_STORAGE_KEY}', JSON.stringify(report)); } catch (_) {}
    if (window.console && console.error) console.error(isTimer ? '[timer-bootstrap]' : '[app-bootstrap]', report);

    var language = document.documentElement.lang.indexOf('zh') === 0 ? 'zh' : 'en';
    function label(key) { return copy[key][language]; }
    function append(tag, className, text) {
      var element = document.createElement(tag);
      if (className) element.className = className;
      element.textContent = text;
      root.appendChild(element);
      return element;
    }
    root.textContent = '';
    root.className = 'app-startup app-startup-error ' + (overlay ? 'app-startup-overlay' : 'app-startup-page');
    root.setAttribute('data-app-bootstrap', 'error');
    if (isTimer) root.setAttribute('data-timer-bootstrap', 'error');
    root.setAttribute('role', 'alert');
    append('h1', 'app-startup-title', label('title'));
    append('p', 'app-startup-message', label(messageKey(report)));
    var diagnostic = append('p', 'app-startup-diagnostic', '');
    var diagnosticLabel = document.createElement('span');
    diagnosticLabel.textContent = label('diagnosticCode');
    diagnostic.appendChild(diagnosticLabel);
    var code = document.createElement('code');
    code.textContent = report.code;
    diagnostic.appendChild(code);
    var actions = append('div', 'app-startup-actions', '');
    var retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'app-startup-button app-startup-button-primary';
    retry.textContent = label('retry');
    retry.onclick = function () { window.location.reload(); };
    actions.appendChild(retry);
    var copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'app-startup-button';
    copyButton.textContent = label('copy');
    copyButton.onclick = function () {
      copyReport(report, function (copied) {
        if (copied && !root.querySelector('.app-startup-copied')) append('p', 'app-startup-copied', label('copied'));
      });
    };
    actions.appendChild(copyButton);
  }
  window.addEventListener('error', onError, true);
  window.addEventListener('unhandledrejection', onRejection);
  var capture = {
    evidence: evidence,
    stop: function () {
      if (stopped) return;
      stopped = true;
      window.clearTimeout(timer);
      window.clearTimeout(graceTimer);
      window.removeEventListener('error', onError, true);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('load', onLoad);
      window.removeEventListener('app-boot-stop', stopFromEvent);
      window.removeEventListener('timer-boot-stop', stopFromEvent);
      document.documentElement.setAttribute('data-app-boot-guard', 'stopped');
      try { window.sessionStorage.removeItem('${EARLY_STORAGE_KEY}'); } catch (_) {}
    }
  };
  function stopFromEvent() { capture.stop(); }
  function onLoad() {
    if (isTimer) return;
    graceTimer = window.setTimeout(function () { capture.stop(); }, ${APP_BOOT_GRACE_MS});
  }
  window.addEventListener('app-boot-stop', stopFromEvent);
  window.addEventListener('timer-boot-stop', stopFromEvent);
  window.addEventListener('load', onLoad);
  try { window.__appBootEarly = capture; } catch (_) {}
  if (!isTimer) {
    if (document.readyState === 'complete') onLoad();
  } else {
    try { window.__timerBootEarly = capture; } catch (_) {}
    timer = window.setTimeout(renderFailure, ${DEFAULT_TIMEOUT_MS});
  }
})();`;
