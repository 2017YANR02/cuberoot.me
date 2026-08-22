export const DEFAULT_TIMEOUT_MS = 20_000;
export const MAX_EVIDENCE = 4;
export const MAX_DETAIL_LENGTH = 500;
export const STORAGE_KEY = 'timer.boot.lastDiagnostic';
export const EARLY_STORAGE_KEY = 'timer.boot.earlyEvidence';
export const MIN_SUPPORTED_CHROMIUM_MAJOR = 91;

export const TIMER_BOOT_COPY = {
  loading: { zh: '正在加载计时器…', en: 'Loading timer…' },
  title: { zh: '计时器未能启动', en: 'Timer failed to start' },
  message: {
    zh: '请检查网络后重试。如果仍然失败，请把下面的诊断信息发给我们。',
    en: 'Check your connection and retry. If it still fails, send us the diagnostic information below.',
  },
  outdatedWechatMessage: {
    zh: '当前微信内置浏览器版本过旧，无法启动计时器。请先升级微信；如果仍然失败，请点击右上角菜单，选择“在浏览器打开”。',
    en: 'The browser built into WeChat is too old to start the timer. Update WeChat first. If it still fails, use the top-right menu to open this page in your browser.',
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

const EARLY_COPY_JSON = JSON.stringify(TIMER_BOOT_COPY);

/**
 * Runs from the server HTML before React hydration. Keep this ES5-shaped: its
 * purpose is to replace the loading shell even when an old WebKit cannot parse
 * the route chunk that contains TimerBootstrap itself.
 */
export const TIMER_BOOT_EARLY_SCRIPT = `(function () {
  if (!/^\\/(?:zh\\/)?timer(?:\\/|$)/.test(window.location.pathname)) return;
  document.documentElement.setAttribute('data-timer-boot-guard', 'active');
  if (window.__timerBootEarly && window.__timerBootEarly.stop) window.__timerBootEarly.stop();
  var copy = ${EARLY_COPY_JSON};
  var evidence = [];
  var stopped = false;
  var timer = 0;
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
      'CubeRoot timer startup diagnostic',
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
    var root = document.querySelector('[data-timer-bootstrap="loading"]');
    if (!root) return;
    capture.stop();
    var kind = classify();
    var tags = { network: 'NET', chunk: 'CHUNK', script: 'SCRIPT', promise: 'PROMISE', timeout: 'TIMEOUT' };
    var last = evidence.length ? evidence[evidence.length - 1] : null;
    var fingerprint = kind;
    for (var index = 0; index < evidence.length; index += 1) {
      fingerprint += '|' + evidence[index].source + '|' + evidence[index].name + '|' + evidence[index].message + '|' + (evidence[index].url || '');
    }
    var report = {
      code: 'TMR-' + tags[kind] + '-' + hash(fingerprint),
      kind: kind,
      occurredAt: new Date().toISOString(),
      path: window.location.pathname,
      online: typeof navigator.onLine === 'boolean' ? navigator.onLine : null,
      userAgent: navigator.userAgent || '',
      errorName: last ? last.name : 'TimeoutError',
      errorMessage: last ? last.message : 'Timer shell did not start before the timeout.',
      evidence: evidence.slice(0)
    };
    try { window.__timerBootDiagnostic = report; } catch (_) {}
    try { window.sessionStorage.setItem('${STORAGE_KEY}', JSON.stringify(report)); } catch (_) {}
    if (window.console && console.error) console.error('[timer-bootstrap]', report);

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
    root.className = 'timer-bootstrap timer-bootstrap-error';
    root.setAttribute('data-timer-bootstrap', 'error');
    root.setAttribute('role', 'alert');
    append('h1', 'timer-bootstrap-title', label('title'));
    append('p', 'timer-bootstrap-message', label(messageKey(report)));
    var diagnostic = append('p', 'timer-bootstrap-diagnostic', '');
    var diagnosticLabel = document.createElement('span');
    diagnosticLabel.textContent = label('diagnosticCode');
    diagnostic.appendChild(diagnosticLabel);
    var code = document.createElement('code');
    code.textContent = report.code;
    diagnostic.appendChild(code);
    var actions = append('div', 'timer-bootstrap-actions', '');
    var retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'timer-bootstrap-button timer-bootstrap-button-primary';
    retry.textContent = label('retry');
    retry.onclick = function () { window.location.reload(); };
    actions.appendChild(retry);
    var copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'timer-bootstrap-button';
    copyButton.textContent = label('copy');
    copyButton.onclick = function () {
      copyReport(report, function (copied) {
        if (copied && !root.querySelector('.timer-bootstrap-copied')) append('p', 'timer-bootstrap-copied', label('copied'));
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
      window.removeEventListener('error', onError, true);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('timer-boot-stop', stopFromEvent);
      document.documentElement.setAttribute('data-timer-boot-guard', 'stopped');
      try { window.sessionStorage.removeItem('${EARLY_STORAGE_KEY}'); } catch (_) {}
    }
  };
  function stopFromEvent() { capture.stop(); }
  window.addEventListener('timer-boot-stop', stopFromEvent);
  try { window.__timerBootEarly = capture; } catch (_) {}
  timer = window.setTimeout(renderFailure, ${DEFAULT_TIMEOUT_MS});
})();`;
