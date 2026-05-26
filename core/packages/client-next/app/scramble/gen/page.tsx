'use client';

/**
 * /scramble/gen — minimal port. Generates one random scramble for a chosen WCA
 * event via cubing.js. The full QuickMode/TNoodleMode/Sheet experience from
 * the Vite SPA is deferred (see TODO below) because it pulls in 12+ shared
 * components and 8 utils that have not yet been ported into client-next.
 *
 * TODO(scramble-gen): full port requires
 *   - QuickMode.tsx, TNoodleMode.tsx, SheetView.tsx, ScrambleLines.tsx
 *   - LiquidGlassChips, NumberCommitInput, HighOrderNxNInput,
 *     Scramble{333,555}ModePicker, ScramblePreview2D, CompPicker
 *   - utils: cubingScramble.prewarm, scramble_333_mode, scramble_555_mode,
 *     comp_wcif, comp_no_scrambles, wca_results_api, country_flags,
 *     tnoodle_translate, tnoodle_pdf, tnoodle_i18n, visualcube_link
 *   - per-puzzle SVG renderers (clock_svg / mega_svg / etc.)
 *   - liquid-glass-react dep
 *
 * Source: packages/client/src/pages/gen/GenPage.tsx + 19 sibling files.
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Shuffle, HelpCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LangToggle from '@/components/LangToggle';
import ThemeToggle from '@/components/ThemeToggle';
import WcaEventSelector from '@/components/WcaEventSelector';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './gen.css';

const WCA_EVENTS = [
  '333', '222', '444', '555', '666', '777',
  '333bf', '333fm', '333oh', 'minx', 'pyram', 'clock',
  'skewb', 'sq1', '444bf', '555bf', '333mbf',
];

export default function GenPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('打乱生成器', 'Scramble Generator');

  const [event, setEvent] = useState('333');
  const [scramble, setScramble] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const generate = useCallback(async () => {
    setBusy(true);
    setScramble('');
    try {
      const { randomScrambleForEvent } = await import('cubing/scramble');
      const alg = await randomScrambleForEvent(event);
      setScramble(alg.toString());
    } catch (err) {
      setScramble(`Error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [event]);

  return (
    <div className="gen-page" style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        <LangToggle variant="inline" />
        <ThemeToggle />
      </div>

      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isZh ? '打乱生成器' : 'Scramble Generator'}
        <Link href="/scramble/gen-about" aria-label={isZh ? '说明' : 'About'}>
          <HelpCircle size={18} strokeWidth={1.75} />
        </Link>
      </h1>

      <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>
        {isZh
          ? '最小可用版本: 选项目 → 生成一条 WCA 随机打乱。完整版(批量/PDF/比赛轮次)正在迁移。'
          : 'Minimal build: pick event → one WCA-random scramble. Full version (batch / PDF / competition rounds) is in progress.'}
      </p>

      <div style={{ margin: '16px 0' }}>
        <WcaEventSelector
          availableEvents={new Set(WCA_EVENTS)}
          selectedEvent={event}
          onSelect={setEvent}
          isZh={isZh}
        />
      </div>

      <button
        type="button"
        onClick={generate}
        disabled={busy}
        style={{
          padding: '10px 20px',
          fontSize: '1rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? <Loader2 size={16} /> : <Shuffle size={16} />}
        {isZh ? '生成' : 'Generate'}
      </button>

      {scramble && (
        <pre
          style={{
            marginTop: 16,
            padding: 12,
            background: 'var(--muted)',
            borderRadius: 6,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {scramble}
        </pre>
      )}
    </div>
  );
}
