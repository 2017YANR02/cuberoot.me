'use client';

// Backgrounds affect the whole site; palette previews keep their local token scope.

import { useEffect, useRef, useState } from 'react';
import { Check, Play, RotateCcw } from 'lucide-react';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import { previewBackground, endBackgroundPreview } from '@/components/SiteBackground';
import { useHomeBackgroundChoice } from '@/hooks/useHomeBackgroundChoice';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { HOME_BACKGROUNDS, HOME_BACKGROUND_ASSETS, resolveHomeBackground } from '@/lib/home-backgrounds';
import {
  CONTRAST_LEVELS,
  applyContrast,
  applyPalette,
  readContrast,
  readPalette,
  useEffectiveTheme,
  type ContrastLevel,
} from '@/lib/theme';
import { PALETTES } from '@/lib/palettes';
import { tr } from '@/i18n/tr';
import '@/components/PillToggle/PillToggle.css';
import './appearance.css';

interface Card {
  id: string | null;
  scope: string;
  zh: string;
  en: string;
  scheme: 'light' | 'dark';
}

const CARDS: Card[] = [
  { id: null, scope: 'classic', zh: '经典', en: 'Classic', scheme: 'light' },
  ...PALETTES.map((p) => ({ id: p.id, scope: p.id, zh: p.zh, en: p.en, scheme: p.scheme })),
];

function BackgroundPreview({ scene, onClose }: { scene: (typeof HOME_BACKGROUNDS)[number]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdropProps = useModalDismiss(onClose);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} className="ac-image-dialog" aria-label={tr(scene)} {...backdropProps}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <figure className="ac-image-preview" data-site-surface="popover">
        {/* eslint-disable-next-line @next/next/no-img-element -- Original landscape loads only when the preview opens. */}
        <img src={`${HOME_BACKGROUND_ASSETS}/original/${scene.id}.png`} alt={tr(scene)} width={1672} height={941}
          onError={(event) => {
            const fallback = `${HOME_BACKGROUND_ASSETS}/${scene.id}.webp`;
            if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
          }} />
      </figure>
    </dialog>
  );
}

export default function AppearancePage() {
  const effectiveTheme = useEffectiveTheme();
  const [background, setBackground] = useHomeBackgroundChoice(effectiveTheme);
  const [preview, setPreview] = useState<(typeof HOME_BACKGROUNDS)[number] | null>(null);
  const activeScene = resolveHomeBackground(background, effectiveTheme);
  const [current, setCurrent] = useState<string | null>(null);
  const [contrast, setContrast] = useState<ContrastLevel>('normal');
  useEffect(() => endBackgroundPreview, [effectiveTheme]);
  useEffect(() => {
    const r = () => {
      setCurrent(readPalette());
      setContrast(readContrast());
    };
    r();
    window.addEventListener('theme-change', r);
    window.addEventListener('storage', r);
    return () => {
      window.removeEventListener('theme-change', r);
      window.removeEventListener('storage', r);
    };
  }, []);

  const name = (c: Card) => tr(c);

  return (
    <div className="ac-page">
      <header className="ac-heading">
        <h1 className="ac-h1">{tr({ zh: '外观', en: 'Appearance' })}</h1>
        <HeaderToggles />
      </header>

      <section id="backgrounds" className="ac-section" aria-labelledby="ac-background-title">
        <h2 id="ac-background-title" className="ac-h2">{tr({ zh: '全站背景', en: 'Site backgrounds' })}</h2>
        <div className="ac-background-current">
          <span role="status">{tr({ zh: '当前背景：', en: 'Current background: ' })}{activeScene ? tr(activeScene) : tr({ zh: '无背景', en: 'None' })}</span>
          <AppLink href="/">{tr({ zh: '查看主页效果', en: 'See it on your homepage' })}</AppLink>
        </div>

        <div className="ac-background-grid">
          {HOME_BACKGROUNDS.map((scene) => {
            const selected = activeScene?.id === scene.id;
            return <article key={scene.id} className={`ac-background-item${selected ? ' is-current' : ''}`}>
              <button type="button" className="ac-background-image"
                onPointerEnter={(event) => { if (event.pointerType !== 'touch') previewBackground({ theme: effectiveTheme, choice: scene.id }); }}
                onPointerLeave={endBackgroundPreview}
                onFocus={() => previewBackground({ theme: effectiveTheme, choice: scene.id })}
                onBlur={endBackgroundPreview}
                onClick={() => { endBackgroundPreview(); setPreview(scene); }} aria-haspopup="dialog"
                aria-label={tr({ zh: `放大预览：${scene.zh}`, en: `Preview: ${scene.en}` })}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Existing compact WebP previews; originals load only on demand. */}
                <img src={`${HOME_BACKGROUND_ASSETS}/${scene.id}.webp`} alt={tr(scene)} width={1672} height={941} loading="lazy" />
              </button>
              <div className="ac-background-caption">
                <h3>{tr(scene)}</h3>
                <button type="button" className="ac-background-apply" aria-pressed={selected}
                  aria-label={tr({ zh: `应用：${scene.zh}`, en: `Apply: ${scene.en}` })}
                  onClick={() => setBackground(scene.id)}>
                  {selected && <Check size={14} />}
                  {selected ? tr({ zh: '已应用', en: 'Applied' }) : tr({ zh: '应用', en: 'Apply' })}
                </button>
              </div>
              <p className="ac-background-family">{scene.family}</p>
              <p className="ac-background-description">{tr(scene.description)}</p>
            </article>;
          })}
        </div>
        <footer className="ac-background-credits">
          <p>{tr({ zh: 'AI 生成的原创场景。风格参考：', en: 'Original AI-generated scenes. Style references: ' })}
            <a href="https://www.altosadventure.com/" target="_blank" rel="noopener noreferrer">Alto’s Adventure</a>{', '}
            <a href="https://www.altosodyssey.com/" target="_blank" rel="noopener noreferrer">Alto’s Odyssey</a>{', '}
            <a href="https://ustwogames.co.uk/our-games/monument-valley/" target="_blank" rel="noopener noreferrer">Monument Valley</a>
          </p>
          <a href={`${HOME_BACKGROUND_ASSETS}/prompts.json`} download="cuberoot-background-prompts.json">{tr({ zh: '下载完整生成提示词', en: 'Download all generation prompts' })}</a>
        </footer>
      </section>

      <section id="palettes" className="ac-section" aria-labelledby="ac-palette-title">
      <h2 id="ac-palette-title" className="ac-h2">{tr({ zh: '配色主题', en: 'Color themes' })}</h2>
      <p className="ac-lead">
        {tr({
          zh: '给整站换一套中国传统色。「经典」是默认的赭陶配色;其余取自中国色,点任意一张即整站淡入预览,随时可换回经典。',
          en: 'Dress the whole site in a Chinese traditional-color palette. "Classic" is the default terracotta; the rest are drawn from 中国色 — tap any card to fade the whole site into it, switch back to Classic anytime.'
        })}
      </p>

      <div className="ac-soften">
        <span className="ac-soften-label">{tr({ zh: '柔和度', en: 'Softness' })}</span>
        <div className="appearance-chips" role="group" aria-label={tr({ zh: '柔和度', en: 'Softness' })}>
          {CONTRAST_LEVELS.map((c) => {
            const on = c.id === contrast;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                className={`appearance-chip${on ? ' is-active' : ''}`}
                onClick={() => {
                  applyContrast(c.id, true);
                  setContrast(c.id);
                }}
              >
                {tr(c)}
              </button>
            );
          })}
        </div>
        <span className="ac-soften-hint">
          {tr({
            zh: '整站降低对比度,配色和明暗照旧,长时间看更省眼。',
            en: 'Lowers contrast site-wide — same palette, same light/dark, easier on the eyes for long sessions.',
          })}
        </span>
      </div>

      <div className="ac-grid">
        {CARDS.map((c) => {
          const active = c.id === current;
          return (
            <button
              key={c.scope}
              type="button"
              className={`ac-card${active ? ' is-current' : ''}`}
              onClick={() => {
                applyPalette(c.id, true);
                setCurrent(c.id);
              }}
              aria-pressed={active}
            >
              <span className="ac-meta">
                <span className="ac-name">{name(c)}</span>
                <span className="ac-tags">
                  <span className="ac-scheme">
                    {c.scheme === 'dark' ? tr({ zh: '深', en: 'Dark' }) : tr({ zh: '浅', en: 'Light'
                    })}
                  </span>
                  {active && <Check size={15} className="ac-check" />}
                </span>
              </span>

              <span className="palette-scope ac-preview-scope" data-palette={c.scope}>
                <span className="ac-preview contrast-scope">
                  <span className="ac-pv-top">
                    <span className="ac-pv-dot" />
                    <span className="ac-pv-title">小根根</span>
                    <span className="ac-pv-faint">Ao5 12.34</span>
                  </span>
                  <span className="ac-pv-sub">Solve. Train. Analyze.</span>
                  <span className="ac-pv-panel">
                    <span className="ac-pv-mono">R U R&#39; U&#39; R&#39; F R F&#39;</span>
                  </span>
                  <span className="ac-pv-actions">
                    <span className="ac-pv-btn">{tr({ zh: '应用', en: 'Apply'
                  })}</span>
                    <span className="ac-pv-btn-primary" aria-hidden="true"><Play size={12} /></span>
                    <span className="ac-pv-btn-secondary" aria-hidden="true"><RotateCcw size={12} /></span>
                    <span className="pill-toggle pill-toggle--switch is-on" aria-hidden="true">
                      <span className="pill-toggle-dot" />
                    </span>
                  </span>
                  <span className="ac-pv-chips">
                    <span className="ac-pv-chip">OLL</span>
                    <span className="ac-pv-chip-muted">F2L</span>
                  </span>
                  <span className="ac-pv-pop">
                    <span className="ac-pv-pop-label">CFOP</span>
                    <Check size={13} className="ac-pv-pop-check" />
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      </section>
      {preview && <BackgroundPreview scene={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
