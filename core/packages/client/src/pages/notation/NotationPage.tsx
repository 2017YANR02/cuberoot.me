/**
 * /notation — interactive sandbox for 3x3 algorithms.
 *
 * Type an alg, get simplified / inverse / mirror outputs and a live HTM/QTM/STM/ETM
 * breakdown. Below: TwistyPlayer (lazy-loaded via TwistySection) showing the
 * scramble → solve animation.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wand2, Copy, Check } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import TwistySection from '../../components/TwistySection';
import { simplifyAlg, invertAlg, mirrorM, mirrorS, countMoves } from './alg_ops';
import './notation.css';

const PRESETS = [
  { id: 'sune',    label: 'Sune',         alg: "R U R' U R U2 R'" },
  { id: 'tperm',   label: 'T-Perm',       alg: "R U R' U' R' F R2 U' R' U' R U R' F'" },
  { id: 'jperm',   label: 'J-Perm',       alg: "R U R' F' R U R' U' R' F R2 U' R'" },
  { id: 'sexy',    label: 'Sexy×6',       alg: "R U R' U' R U R' U' R U R' U' R U R' U' R U R' U' R U R' U'" },
  { id: 'super',   label: 'Superflip',    alg: "R L U2 F U' D F2 R2 B2 L U2 F' B' U R2 D F2 U R2 U" },
  { id: 'cic',     label: 'Cube in Cube', alg: "F L F U' R U F2 L2 U' L' B D' B' L2 U" },
];

export default function NotationPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  const [input, setInput] = useState<string>(PRESETS[0].alg);

  const simplified = useMemo(() => simplifyAlg(input), [input]);
  const inverse = useMemo(() => invertAlg(input), [input]);
  const mirrorMAlg = useMemo(() => mirrorM(input), [input]);
  const mirrorSAlg = useMemo(() => mirrorS(input), [input]);
  const counts = useMemo(() => countMoves(input), [input]);

  return (
    <div className="not-page">
      <header className="not-header">
        <div className="not-title">
          <Wand2 size={20} className="not-title-icon" />
          <h1>{t('记号沙盒', 'Notation Sandbox')}</h1>
          <span className="not-title-sub">3×3 · Alg playground</span>
        </div>
        <LangToggle variant="inline" />
      </header>

      <main className="not-main">
        <section className="not-input-pane">
          <div className="not-input-toolbar">
            <span className="not-label">{t('公式', 'Algorithm')}</span>
            <div className="not-presets">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="not-preset-chip"
                  onClick={() => setInput(p.alg)}
                  title={p.alg}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            className="not-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="R U R' U' …"
            spellCheck={false}
            rows={3}
          />
          <div className="not-counts">
            <CountChip label="HTM" v={counts.htm} accent />
            <CountChip label="QTM" v={counts.qtm} />
            <CountChip label="STM" v={counts.stm} />
            <CountChip label="ETM" v={counts.etm} />
          </div>
        </section>

        <section className="not-output-pane">
          <OutputRow label={t('化简', 'Simplified')} value={simplified} />
          <OutputRow label={t('逆向', 'Inverse')} value={inverse} />
          <OutputRow label={t('镜像 M', 'Mirror (M)')} value={mirrorMAlg} />
          <OutputRow label={t('镜像 S', 'Mirror (S)')} value={mirrorSAlg} />
        </section>

        <section className="not-twisty-pane">
          <h2 className="not-section-title">{t('3D 演示', '3D playback')}</h2>
          <TwistySection puzzle="3x3x3" scramble={inverse} alg={input} />
          <p className="not-twisty-hint">
            {t('上面应用 alg 还原；setupAlg 用 alg 的逆向预处理，所以 0 帧 = 该 alg 还要解的状态。',
               'Player applies the alg from the inverse setup state — frame 0 is the case the alg solves.')}
          </p>
        </section>
      </main>
    </div>
  );
}

function CountChip({ label, v, accent }: { label: string; v: number; accent?: boolean }) {
  return (
    <div className={`not-count${accent ? ' is-accent' : ''}`}>
      <span className="not-count-label">{label}</span>
      <span className="not-count-value">{v}</span>
    </div>
  );
}

function OutputRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* swallow */ }
  };
  return (
    <div className="not-output-row">
      <div className="not-output-label">{label}</div>
      <code className="not-output-value">{value || '—'}</code>
      <button
        type="button"
        className="not-copy-btn"
        onClick={copy}
        disabled={!value}
        aria-label="copy"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}
