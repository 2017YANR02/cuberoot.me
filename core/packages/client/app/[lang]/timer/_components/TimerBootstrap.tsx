'use client';

import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useState,
} from 'react';
import { tr } from '@/i18n/tr';
import {
  DEFAULT_TIMEOUT_MS,
  EARLY_STORAGE_KEY,
  MAX_DETAIL_LENGTH,
  MAX_EVIDENCE,
  MIN_SUPPORTED_CHROMIUM_MAJOR,
  STORAGE_KEY,
  TIMER_BOOT_COPY,
} from '@/lib/app_boot_early';
import './timer-bootstrap.css';

export type TimerBootFailureKind =
  | 'network'
  | 'chunk'
  | 'script'
  | 'promise'
  | 'timeout'
  | 'runtime'
  | 'unknown';

export interface TimerBootEvidence {
  source: 'error' | 'unhandledrejection' | 'import' | 'runtime';
  name: string;
  message: string;
  url?: string;
}

export interface TimerBootDiagnostic {
  code: string;
  kind: TimerBootFailureKind;
  occurredAt: string;
  path: string;
  online: boolean | null;
  userAgent: string;
  errorName: string;
  errorMessage: string;
  evidence: TimerBootEvidence[];
}

declare global {
  interface Window {
    __appBootDiagnostic?: TimerBootDiagnostic;
    __appBootEarly?: {
      evidence: TimerBootEvidence[];
      stop: () => void;
    };
    __timerBootDiagnostic?: TimerBootDiagnostic;
    __timerBootEarly?: {
      evidence: TimerBootEvidence[];
      stop: () => void;
    };
  }
}

type TimerModule = { default: ComponentType };
type FailureStage = 'import' | 'timeout' | 'runtime';

interface TimerBootstrapProps {
  loadTimerShell?: () => Promise<TimerModule>;
  timeoutMs?: number;
  onRetry?: () => void;
}

interface TimerRuntimeBoundaryProps {
  children: ReactNode;
  onRetry: () => void;
}

interface TimerRuntimeBoundaryState {
  diagnostic: TimerBootDiagnostic | null;
}

function trimDetail(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.slice(0, MAX_DETAIL_LENGTH);
}

function describeReason(reason: unknown): { name: string; message: string } {
  if (reason instanceof Error) {
    return {
      name: trimDetail(reason.name || 'Error'),
      message: trimDetail(reason.message || String(reason)),
    };
  }
  if (typeof reason === 'string') {
    return { name: 'Error', message: trimDetail(reason) };
  }
  try {
    return { name: 'Error', message: trimDetail(JSON.stringify(reason) || String(reason)) };
  } catch {
    return { name: 'Error', message: trimDetail(String(reason)) };
  }
}

function safeSourceUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const base = typeof window === 'undefined' ? 'https://cuberoot.me' : window.location.origin;
    const parsed = new URL(value, base);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return trimDetail(value.split(/[?#]/, 1)[0]);
  }
}

function evidenceFromWindowError(event: Event): TimerBootEvidence {
  if (event instanceof ErrorEvent) {
    const reason = describeReason(event.error ?? event.message);
    return {
      source: 'error',
      name: reason.name,
      message: reason.message,
      url: safeSourceUrl(event.filename),
    };
  }

  const target = event.target;
  const url = target instanceof HTMLScriptElement
    ? target.src
    : target instanceof HTMLLinkElement
      ? target.href
      : undefined;
  return {
    source: 'error',
    name: 'ResourceError',
    message: url ? 'A startup resource failed to load.' : 'A startup error event was captured.',
    url: safeSourceUrl(url),
  };
}

function evidenceFromRejection(event: PromiseRejectionEvent): TimerBootEvidence {
  const reason = describeReason(event.reason);
  return {
    source: 'unhandledrejection',
    name: reason.name,
    message: reason.message,
  };
}

function classifyFailure(
  reason: { name: string; message: string },
  evidence: TimerBootEvidence[],
  stage: FailureStage,
): TimerBootFailureKind {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'network';

  const combined = [reason.name, reason.message, ...evidence.flatMap(item => [item.name, item.message])]
    .join(' ');
  if (/ChunkLoadError|Loading chunk|dynamically imported module|module script|CSS_CHUNK_LOAD_FAILED/i.test(combined)) {
    return 'chunk';
  }
  if (/SyntaxError|Unexpected token|Script error|parse error|is not a function|is undefined/i.test(combined)) {
    return 'script';
  }
  if (evidence.some(item => item.source === 'error' && item.url)) return 'script';
  if (stage === 'timeout') return 'timeout';
  if (stage === 'runtime') return 'runtime';
  if (stage === 'import' || evidence.some(item => item.source === 'unhandledrejection')) return 'promise';
  return 'unknown';
}

function diagnosticHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, '0');
}

const KIND_TAGS: Record<TimerBootFailureKind, string> = {
  network: 'NET',
  chunk: 'CHUNK',
  script: 'SCRIPT',
  promise: 'PROMISE',
  timeout: 'TIMEOUT',
  runtime: 'RUNTIME',
  unknown: 'UNKNOWN',
};

export function buildTimerBootDiagnostic(
  reasonValue: unknown,
  evidence: TimerBootEvidence[],
  stage: FailureStage,
): TimerBootDiagnostic {
  const reason = describeReason(reasonValue);
  const normalizedEvidence = evidence.slice(-MAX_EVIDENCE);
  const kind = classifyFailure(reason, normalizedEvidence, stage);
  const fingerprint = [
    kind,
    reason.name,
    reason.message,
    ...normalizedEvidence.flatMap(item => [item.source, item.name, item.message, item.url ?? '']),
  ].join('|');

  return {
    code: `TMR-${KIND_TAGS[kind]}-${diagnosticHash(fingerprint)}`,
    kind,
    occurredAt: new Date().toISOString(),
    path: typeof window === 'undefined' ? '/timer' : window.location.pathname,
    online: typeof navigator === 'undefined' ? null : navigator.onLine,
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
    errorName: reason.name,
    errorMessage: reason.message,
    evidence: normalizedEvidence,
  };
}

function persistDiagnostic(diagnostic: TimerBootDiagnostic): void {
  if (typeof window === 'undefined') return;
  try {
    window.__timerBootDiagnostic = diagnostic;
  } catch {
    // Some embedded browsers expose a non-extensible Window object.
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(diagnostic));
  } catch {
    // Private browsing and storage policies can reject sessionStorage writes.
  }
  console.error('[timer-bootstrap]', diagnostic);
}

function diagnosticText(diagnostic: TimerBootDiagnostic): string {
  const evidence = diagnostic.evidence.map((item, index) => (
    `Evidence ${index + 1}: ${item.source} | ${item.name} | ${item.message}${item.url ? ` | ${item.url}` : ''}`
  ));
  return [
    'CubeRoot timer startup diagnostic',
    `Code: ${diagnostic.code}`,
    `Type: ${diagnostic.kind}`,
    `Time: ${diagnostic.occurredAt}`,
    `Path: ${diagnostic.path}`,
    `Online: ${String(diagnostic.online)}`,
    `Browser: ${diagnostic.userAgent}`,
    `Error: ${diagnostic.errorName} | ${diagnostic.errorMessage}`,
    ...evidence,
  ].join('\n');
}

function failureMessage(diagnostic: TimerBootDiagnostic) {
  const versionMatch = /(?:Chrome|Chromium|CriOS)\/(\d+)/i.exec(diagnostic.userAgent);
  const chromiumMajor = versionMatch ? Number.parseInt(versionMatch[1], 10) : Number.NaN;
  if (!Number.isFinite(chromiumMajor) || chromiumMajor >= MIN_SUPPORTED_CHROMIUM_MAJOR) {
    return TIMER_BOOT_COPY.message;
  }

  const combined = [
    diagnostic.errorName,
    diagnostic.errorMessage,
    ...diagnostic.evidence.flatMap(item => [item.name, item.message]),
  ].join(' ');
  if (!/SyntaxError|Unexpected token|parse error/i.test(combined)) {
    return TIMER_BOOT_COPY.message;
  }

  return /MicroMessenger/i.test(diagnostic.userAgent)
    ? TIMER_BOOT_COPY.outdatedWechatMessage
    : TIMER_BOOT_COPY.outdatedBrowserMessage;
}

async function copyDiagnostic(diagnostic: TimerBootDiagnostic): Promise<boolean> {
  const text = diagnosticText(diagnostic);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to execCommand for older iOS WebKit and restricted contexts.
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = typeof document.execCommand === 'function' && document.execCommand('copy');
  } finally {
    textarea.remove();
  }
  return copied;
}

function TimerBootFailurePanel({
  diagnostic,
  onRetry,
}: {
  diagnostic: TimerBootDiagnostic;
  onRetry: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <main className="timer-bootstrap timer-bootstrap-error" data-timer-bootstrap="error" role="alert">
      <h1 className="timer-bootstrap-title">
        {tr(TIMER_BOOT_COPY.title)}
      </h1>
      <p className="timer-bootstrap-message">
        {tr(failureMessage(diagnostic))}
      </p>
      <p className="timer-bootstrap-diagnostic">
        <span>{tr(TIMER_BOOT_COPY.diagnosticCode)}</span>
        <code>{diagnostic.code}</code>
      </p>
      <div className="timer-bootstrap-actions">
        <button type="button" className="timer-bootstrap-button timer-bootstrap-button-primary" onClick={onRetry}>
          {tr(TIMER_BOOT_COPY.retry)}
        </button>
        <button
          type="button"
          className="timer-bootstrap-button"
          onClick={() => {
            void copyDiagnostic(diagnostic).then(setCopied).catch(() => setCopied(false));
          }}
        >
          {tr(TIMER_BOOT_COPY.copy)}
        </button>
      </div>
      {copied && (
        <p className="timer-bootstrap-copied" role="status">
          {tr(TIMER_BOOT_COPY.copied)}
        </p>
      )}
    </main>
  );
}

class TimerRuntimeBoundary extends Component<TimerRuntimeBoundaryProps, TimerRuntimeBoundaryState> {
  state: TimerRuntimeBoundaryState = { diagnostic: null };

  static getDerivedStateFromError(error: unknown): TimerRuntimeBoundaryState {
    return { diagnostic: buildTimerBootDiagnostic(error, [], 'runtime') };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    const diagnostic = buildTimerBootDiagnostic(error, [{
      source: 'runtime',
      name: 'ReactRenderError',
      message: trimDetail(info.componentStack ?? ''),
    }], 'runtime');
    persistDiagnostic(diagnostic);
    if (diagnostic.code !== this.state.diagnostic?.code) {
      this.setState({ diagnostic });
    }
  }

  render() {
    if (this.state.diagnostic) {
      return <TimerBootFailurePanel diagnostic={this.state.diagnostic} onRetry={this.props.onRetry} />;
    }
    return this.props.children;
  }
}

const importTimerShell = () => import('../_shell/TimerShell');

export default function TimerBootstrap({
  loadTimerShell = importTimerShell,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onRetry = () => window.location.reload(),
}: TimerBootstrapProps) {
  const [TimerShell, setTimerShell] = useState<ComponentType | null>(null);
  const [diagnostic, setDiagnostic] = useState<TimerBootDiagnostic | null>(null);

  useEffect(() => {
    let active = true;
    const earlyCapture = window.__timerBootEarly;
    let storedEvidence: TimerBootEvidence[] = [];
    try {
      const parsed: unknown = JSON.parse(window.sessionStorage.getItem(EARLY_STORAGE_KEY) ?? '[]');
      if (Array.isArray(parsed)) storedEvidence = parsed.slice(-MAX_EVIDENCE) as TimerBootEvidence[];
    } catch {
      // Ignore unavailable or malformed startup evidence.
    }
    const evidence = earlyCapture?.evidence.slice(-MAX_EVIDENCE) ?? storedEvidence;
    window.dispatchEvent(new Event('app-boot-stop'));
    earlyCapture?.stop();
    const recordEvidence = (item: TimerBootEvidence) => {
      evidence.push(item);
      if (evidence.length > MAX_EVIDENCE) evidence.shift();
    };
    const onWindowError = (event: Event) => recordEvidence(evidenceFromWindowError(event));
    const onUnhandledRejection = (event: PromiseRejectionEvent) => recordEvidence(evidenceFromRejection(event));

    window.addEventListener('error', onWindowError, true);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    let timeoutId = 0;
    const stopCapture = () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('error', onWindowError, true);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
    timeoutId = window.setTimeout(() => {
      if (!active) return;
      stopCapture();
      const next = buildTimerBootDiagnostic(new Error('Timer shell import timed out.'), evidence, 'timeout');
      persistDiagnostic(next);
      setDiagnostic(next);
    }, Math.max(1, timeoutMs));

    Promise.resolve()
      .then(loadTimerShell)
      .then(module => {
        if (!active) return;
        if (!module.default) throw new Error('TimerShell module has no default export.');
        stopCapture();
        setDiagnostic(null);
        setTimerShell(() => module.default);
      })
      .catch(error => {
        if (!active) return;
        stopCapture();
        const reason = describeReason(error);
        const next = buildTimerBootDiagnostic(error, [
          ...evidence,
          { source: 'import', name: reason.name, message: reason.message },
        ], 'import');
        persistDiagnostic(next);
        setDiagnostic(next);
      });

    return () => {
      active = false;
      stopCapture();
    };
  }, [loadTimerShell, timeoutMs]);

  if (TimerShell) {
    return (
      <TimerRuntimeBoundary onRetry={onRetry}>
        <TimerShell />
      </TimerRuntimeBoundary>
    );
  }

  if (diagnostic) {
    return <TimerBootFailurePanel diagnostic={diagnostic} onRetry={onRetry} />;
  }

  return (
    <main
      className="timer-bootstrap timer-bootstrap-loading"
      data-timer-bootstrap="loading"
      role="status"
      aria-live="polite"
    >
      <p>{tr(TIMER_BOOT_COPY.loading)}</p>
    </main>
  );
}
