'use client';

/**
 * /scramble/gen — batch scramble generator (Next.js port).
 *
 * Two modes:
 *   - batch:  pick one or more events + count → generate scrambles
 *   - paste:  paste your own scrambles per event (one per line, with optional
 *             "1. " / "1) " numbering prefix stripped)
 *
 * Ported from packages/client/src/pages/gen/GenPage.tsx + QuickMode.tsx, simplified:
 *   - DROPPED: comp mode (TNoodleMode/CompPicker/PDF/competition rounds)
 *   - DROPPED: per-attempt scramble preview SVG (ScramblePreview2D, visualcube)
 *   - DROPPED: per-scramble timing chips, sq1/skewb shape-mod, cstimer-only events,
 *              5x5 server-side mode, m2p 333 mode
 * The full feature set lives behind a TODO and the existing Vite site at
 * cuberoot.me/scramble/gen. This Next port covers the 80% "give me random
 * scrambles" use case.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Shuffle, HelpCircle, RefreshCw, Loader2, Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LangToggle from '@/components/LangToggle';
import ThemeToggle from '@/components/ThemeToggle';
import WcaEventSelector from '@/components/WcaEventSelector';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { eventDisplayName } from '@/lib/wca-events';
import './gen.css';

// Events the cubing.js bundled scrambler can produce. WCA + the popular non-WCA
// puzzles. Order matches WcaEventSelector internal ALL_EVENT_IDS, which already
// follows WCA ordering.
const SUPPORTED_EVENTS: ReadonlyArray<string> = [
  '333', '222', '444', '555', '666', '777',
  '333bf', '333fm', '333oh', '333mbf',
  'clock', 'minx', 'pyram', 'skewb', 'sq1',
  '444bf', '555bf',
];
const SUPPORTED_EVENT_SET = new Set(SUPPORTED_EVENTS);

const COUNT_PRESETS = [1, 5, 12, 25, 50];
const COUNT_MAX = 200;

type Mode = 'batch' | 'paste';
const VALID_MODES: ReadonlySet<Mode> = new Set(['batch', 'paste']);
const LEGACY_MODE_ALIAS: Record<string, Mode> = {
  mock: 'batch', wca: 'batch', tnoodle: 'batch', import: 'batch',
  comp: 'batch', gen: 'batch', practice: 'batch', quick: 'batch',
  text: 'paste',
};

function parsePastedScrambles(text: string): string[] {
  return text.split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+\s*[.)、:]\s*/, '').trim())
    .filter((line) => line.length > 0);
}

function GenPageInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);
  useDocumentTitle('打乱生成器', 'Scramble Generator');

  const searchParams = useSearchParams();
  const router = useRouter();

  const rawParam = searchParams.get('mode') ?? '';
  const aliased = (LEGACY_MODE_ALIAS[rawParam] ?? rawParam) as Mode;
  const mode: Mode = VALID_MODES.has(aliased) ? aliased : 'batch';

  const setMode = (next: Mode) => {
    const p = new URLSearchParams(Array.from(searchParams.entries()));
    p.set('mode', next);
    router.replace(`?${p.toString()}`, { scroll: false });
  };

  // Normalise legacy ?mode= values into the canonical name once on mount.
  useEffect(() => {
    if (rawParam && rawParam !== mode) {
      const p = new URLSearchParams(Array.from(searchParams.entries()));
      p.set('mode', mode);
      router.replace(`?${p.toString()}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [events, setEvents] = useState<Set<string>>(() => new Set(['333']));
  const [count, setCount] = useState<number>(5);
  const [generated, setGenerated] = useState<Record<string, string[]>>({});
  const [pasteTexts, setPasteTexts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const toggleEvent = useCallback((id: string) => {
    setEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const eventsOrdered = useMemo(
    () => SUPPORTED_EVENTS.filter((id) => events.has(id)),
    [events],
  );
  const eventsKey = eventsOrdered.join(',');

  // batch mode: regenerate on event/count/tick changes
  useEffect(() => {
    if (mode !== 'batch') return;
    if (eventsOrdered.length === 0) {
      setGenerated({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    setCopiedKey(null);
    const total = eventsOrdered.length * count;
    let done = 0;
    setProgress({ done: 0, total });
    const buckets: Record<string, string[]> = {};
    for (const ev of eventsOrdered) buckets[ev] = [];

    (async () => {
      try {
        const { randomScrambleForEvent } = await import('cubing/scramble');
        const promises: Promise<void>[] = [];
        for (const ev of eventsOrdered) {
          for (let i = 0; i < count; i++) {
            promises.push(
              randomScrambleForEvent(ev).then((alg) => {
                if (cancelled) return;
                buckets[ev].push(alg.toString());
                done++;
                setProgress({ done, total });
              }).catch((err) => {
                console.warn(`[gen] ${ev} scramble failed`, err);
                if (cancelled) return;
                buckets[ev].push(`(error: ${(err as Error).message})`);
                done++;
                setProgress({ done, total });
              }),
            );
          }
        }
        await Promise.all(promises);
        if (cancelled) return;
        setGenerated(buckets);
        setLoading(false);
        setProgress(null);
      } catch (err) {
        if (cancelled) return;
        console.error('[gen] batch failed', err);
        setLoading(false);
        setProgress(null);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, eventsKey, count, tick]);

  const regenerate = () => setTick((n) => n + 1);

  const scramblesByEvent = useMemo(() => {
    const m: Record<string, string[]> = {};
    if (mode === 'batch') {
      for (const ev of eventsOrdered) m[ev] = generated[ev] ?? [];
    } else {
      for (const ev of eventsOrdered) m[ev] = parsePastedScrambles(pasteTexts[ev] ?? '');
    }
    return m;
  }, [mode, eventsOrdered, generated, pasteTexts]);

  const totalScrambles = useMemo(
    () => Object.values(scramblesByEvent).reduce((sum, arr) => sum + arr.length, 0),
    [scramblesByEvent],
  );

  const copyOne = async (ev: string, idx: number, scramble: string) => {
    try {
      await navigator.clipboard.writeText(scramble);
      const key = `${ev}|${idx}`;
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 1200);
    } catch { /* swallow */ }
  };

  const copyAll = async (ev: string) => {
    const arr = scramblesByEvent[ev];
    if (!arr || arr.length === 0) return;
    const text = arr.map((s, i) => `${i + 1}. ${s}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      const key = `${ev}|all`;
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 1200);
    } catch { /* swallow */ }
  };

  return (
    <div className="gen-page">
      <header className="gen-header">
        <div className="gen-title">
          <Shuffle size={20} className="gen-title-icon" />
          <h1>
            {t('打乱生成器', 'Scramble Generator')}
            <Link
              href="/scramble/gen-about"
              className="gen-title-help"
              title={t('生成器是怎么工作的?', 'How does the generator work?')}
              aria-label={t('查看打乱生成器说明', 'About the scramble generator')}
            >
              <HelpCircle size={18} strokeWidth={1.75} />
            </Link>
          </h1>
        </div>
        <div className="gen-mode-chips" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'batch'}
            className={`gen-mode-chip${mode === 'batch' ? ' is-active' : ''}`}
            onClick={() => setMode('batch')}
          >
            {t('批量', 'Batch')}
          </button>
          <button
            role="tab"
            aria-selected={mode === 'paste'}
            className={`gen-mode-chip${mode === 'paste' ? ' is-active' : ''}`}
            onClick={() => setMode('paste')}
          >
            {t('输入', 'Paste')}
          </button>
        </div>
        <LangToggle variant="inline" />
        <ThemeToggle />
      </header>

      <main className="gen-main" style={{ padding: '0 16px 32px', maxWidth: 980, margin: '0 auto' }}>
        <div style={{ margin: '16px 0' }}>
          <WcaEventSelector
            availableEvents={SUPPORTED_EVENT_SET}
            selectedEvents={events}
            onToggle={toggleEvent}
            onRemove={toggleEvent}
            isZh={isZh}
            onlyAvailable
          />
        </div>

        {mode === 'batch' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, margin: '12px 0' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <span>{t('每项', 'Per event')}</span>
              <input
                type="number"
                min={1}
                max={COUNT_MAX}
                value={count}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (Number.isFinite(n) && n >= 1 && n <= COUNT_MAX) setCount(n);
                }}
                style={{
                  width: 70,
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: '1px solid var(--gen-border-strong, #d4d4d4)',
                  background: 'var(--gen-surface, #fff)',
                  color: 'var(--gen-text, #171717)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
            </label>
            {COUNT_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className={`gen-count-chip${count === n ? ' is-active' : ''}`}
                style={{
                  padding: '4px 10px',
                  border: count === n ? '1px solid var(--gen-accent, #c15f3c)' : '1px solid var(--gen-border-strong, #d4d4d4)',
                  background: count === n ? 'var(--gen-accent, #c15f3c)' : 'var(--gen-surface, #fff)',
                  color: count === n ? '#fff' : 'var(--gen-text-sub, #737373)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={regenerate}
              disabled={loading || eventsOrdered.length === 0}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px',
                fontSize: 14, fontWeight: 600,
                border: '1px solid var(--gen-accent, #c15f3c)',
                background: loading ? 'var(--gen-accent-soft, rgba(193,95,60,0.08))' : 'var(--gen-accent, #c15f3c)',
                color: loading ? 'var(--gen-accent, #c15f3c)' : '#fff',
                borderRadius: 4,
                cursor: loading ? 'wait' : 'pointer',
                marginLeft: 'auto',
              }}
            >
              {loading ? <Loader2 size={14} className="gen-spin" /> : <RefreshCw size={14} />}
              {loading
                ? `${progress?.done ?? 0}/${progress?.total ?? count}`
                : t(`生成 (${count}/项)`, `Generate (${count}/event)`)}
            </button>
          </div>
        )}

        {mode === 'paste' && (
          <p style={{ fontSize: 14, color: 'var(--gen-text-sub, #737373)', margin: '8px 0' }}>
            {t('粘贴打乱: 每个项目一个文本框,每行一条。开头 "1. " / "1) " 等编号会自动去掉。',
               'Paste mode: one textarea per event, one scramble per line. Leading "1. " / "1) " numbering is auto-stripped.')}
          </p>
        )}

        {eventsOrdered.length === 0 && (
          <p style={{ fontSize: 14, color: 'var(--gen-text-mute, #95938E)', margin: '24px 0', textAlign: 'center' }}>
            {t('请先选择项目', 'Pick at least one event')}
          </p>
        )}

        {mode === 'paste' && eventsOrdered.map((ev) => (
          <section key={ev} style={{ margin: '16px 0', padding: 12, background: 'var(--gen-surface, #fff)', border: '1px solid var(--gen-border, #e5e5e5)', borderRadius: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
              {eventDisplayName(ev, isZh)}
            </div>
            <textarea
              value={pasteTexts[ev] ?? ''}
              onChange={(e) => setPasteTexts((prev) => ({ ...prev, [ev]: e.target.value }))}
              placeholder={t('每行一条打乱', 'One scramble per line')}
              rows={5}
              spellCheck={false}
              style={{
                width: '100%', boxSizing: 'border-box',
                fontFamily: 'JetBrains Mono, Menlo, Consolas, monospace',
                fontSize: 13,
                padding: '6px 8px',
                border: '1px solid var(--gen-border-strong, #d4d4d4)',
                borderRadius: 4,
                background: 'var(--gen-bg, #fafafa)',
                color: 'var(--gen-text, #171717)',
                resize: 'vertical',
              }}
            />
          </section>
        ))}

        {totalScrambles > 0 && (
          <div className="gen-tn-sheets">
            {eventsOrdered.map((ev) => {
              const arr = scramblesByEvent[ev];
              if (!arr || arr.length === 0) return null;
              return (
                <section key={ev} className="gen-tn-sheet" style={{ margin: '16px 0', padding: 12, background: 'var(--gen-surface, #fff)', border: '1px solid var(--gen-border, #e5e5e5)', borderRadius: 6 }}>
                  <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{eventDisplayName(ev, isZh)}</span>
                    <span style={{ fontSize: 12, color: 'var(--gen-text-mute, #95938E)' }}>
                      {arr.length} {t('个', '')}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyAll(ev)}
                      style={{
                        marginLeft: 'auto',
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '4px 8px', fontSize: 12,
                        border: '1px solid var(--gen-border-strong, #d4d4d4)',
                        background: copiedKey === `${ev}|all` ? 'var(--gen-accent, #c15f3c)' : 'var(--gen-surface, #fff)',
                        color: copiedKey === `${ev}|all` ? '#fff' : 'var(--gen-text-sub, #737373)',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      {copiedKey === `${ev}|all` ? <Check size={12} /> : <Copy size={12} />}
                      {t('复制全部', 'Copy all')}
                    </button>
                  </header>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {arr.map((s, i) => {
                        const key = `${ev}|${i}`;
                        return (
                          <tr
                            key={`${i}-${s.slice(0, 4)}`}
                            onClick={() => copyOne(ev, i, s)}
                            title={t('点击复制', 'Click to copy')}
                            style={{ cursor: 'pointer' }}
                          >
                            <td style={{
                              width: 32, padding: '4px 6px',
                              fontVariantNumeric: 'tabular-nums', textAlign: 'right',
                              fontSize: 12, color: 'var(--gen-text-mute, #95938E)',
                              verticalAlign: 'top',
                            }}>{i + 1}.</td>
                            <td style={{
                              padding: '4px 8px',
                              fontFamily: 'JetBrains Mono, Menlo, Consolas, monospace',
                              fontSize: 13,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              color: copiedKey === key ? 'var(--gen-accent, #c15f3c)' : 'var(--gen-text, #171717)',
                            }}>{s}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>
              );
            })}
          </div>
        )}

        <footer style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--gen-border, #e5e5e5)', fontSize: 12, color: 'var(--gen-text-mute, #95938E)' }}>
          <p>
            {t('打乱由 ', 'Scrambles generated by ')}
            <a href="https://js.cubing.net/cubing/scramble" target="_blank" rel="noopener noreferrer">cubing.js</a>
            {t(' 生成,WCA 规则。', ' (WCA-spec).')}
          </p>
          <p>
            {t(
              '注: PDF 导出、比赛轮次、shape-mod / cstimer 专属项目仍在迁移。需要这些功能时用旧站 ',
              'Note: PDF export, competition rounds, shape-mod / cstimer-only events are still being migrated. For those use the legacy site at ',
            )}
            <a href="https://cuberoot.me/scramble/gen" target="_blank" rel="noopener noreferrer">cuberoot.me/scramble/gen</a>.
          </p>
        </footer>
      </main>
    </div>
  );
}

export default function GenPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <GenPageInner />
    </Suspense>
  );
}
