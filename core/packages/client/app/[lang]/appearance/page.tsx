'use client';

// Backgrounds affect the whole site; palette previews keep their local token scope.

import { useEffect, useState } from 'react';
import { Check, Play, RotateCcw, Expand, SunMoon, ImageOff } from 'lucide-react';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import { useHomeBackgroundChoice } from '@/hooks/useHomeBackgroundChoice';
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

export default function AppearancePage() {
  const [background, setBackground] = useHomeBackgroundChoice();
  const effectiveTheme = useEffectiveTheme();
  const activeScene = resolveHomeBackground(background, effectiveTheme);
  const [current, setCurrent] = useState<string | null>(null);
  const [contrast, setContrast] = useState<ContrastLevel>('normal');
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
      <p className="ac-lead">
        {tr({ zh: '选一处喜欢的风景，配一套舒服的颜色。', en: 'Find a landscape you love and a palette that feels right.' })}
      </p>
      <nav className="ac-nav" aria-label={tr({ zh: '外观设置', en: 'Appearance settings' })}>
        <AppLink href="/appearance#backgrounds">{tr({ zh: '全站背景', en: 'Site backgrounds' })}</AppLink>
        <AppLink href="/appearance#palettes">{tr({ zh: '配色主题', en: 'Color themes' })}</AppLink>
      </nav>

      <section id="backgrounds" className="ac-section" aria-labelledby="ac-background-title">
        <h2 id="ac-background-title" className="ac-h2">{tr({ zh: '全站背景', en: 'Site backgrounds' })}</h2>
        <p className="ac-lead">
          {tr({ zh: '山海之间，奇境之中。雪山、沙漠与不可能建筑，全站相伴。点击图片查看原图。', en: 'Quiet worlds of snowy peaks, deserts and impossible architecture, across the whole site. Open any image to see the original.' })}
        </p>
        <div className="ac-background-controls">
          <div className="ac-background-modes" role="group" aria-label={tr({ zh: '背景模式', en: 'Background mode' })}>
            <button type="button" className="ac-background-mode" aria-pressed={background === 'auto'} onClick={() => setBackground('auto')}>
              <SunMoon size={16} />{tr({ zh: '随明暗切换', en: 'Follow light / dark' })}
            </button>
            <button type="button" className="ac-background-mode" aria-pressed={background === 'none'} onClick={() => setBackground('none')}>
              <ImageOff size={16} />{tr({ zh: '无背景', en: 'No background' })}
            </button>
          </div>
          <p className="ac-background-hint">{tr({ zh: '默认：浅色用雪山初晴，深色用蓝夜远山。', en: 'Default: Snowy Dawn in light mode, Moonlit Peaks in dark mode.' })}</p>
        </div>
        <div className="ac-background-current">
          <span role="status">{tr({ zh: '当前背景：', en: 'Current background: ' })}{activeScene ? tr(activeScene) : tr({ zh: '无背景', en: 'None' })}</span>
          <AppLink href="/">{tr({ zh: '查看主页效果', en: 'See it on your homepage' })}</AppLink>
        </div>

        <div className="ac-background-grid">
          {HOME_BACKGROUNDS.map((scene) => {
            const selected = background === scene.id;
            const automatic = background === 'auto' && activeScene?.id === scene.id;
            return <article key={scene.id} className={`ac-background-item${selected || automatic ? ' is-current' : ''}`}>
              <a className="ac-background-image" href={`${HOME_BACKGROUND_ASSETS}/original/${scene.id}.png`} target="_blank" rel="noopener noreferrer"
                aria-label={tr({ zh: `查看原图：${scene.zh}（新标签页）`, en: `View original: ${scene.en} (new tab)` })}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Existing compact WebP previews; originals load only on demand. */}
                <img src={`${HOME_BACKGROUND_ASSETS}/${scene.id}.webp`} alt={tr(scene)} width={1672} height={941} loading="lazy" />
                <span className="ac-background-expand" aria-hidden="true"><Expand size={16} /></span>
              </a>
              <div className="ac-background-caption">
                <h3>{tr(scene)}</h3>
                <button type="button" className="ac-background-apply" aria-pressed={selected}
                  aria-label={tr({ zh: `应用背景：${scene.zh}`, en: `Apply background: ${scene.en}` })}
                  onClick={() => setBackground(scene.id)}>
                  {selected && <Check size={14} />}
                  {selected ? tr({ zh: '已应用', en: 'Applied' }) : tr({ zh: '应用背景', en: 'Apply background' })}
                </button>
              </div>
              <p className="ac-background-family">{scene.family}{automatic && <span>{tr({ zh: '当前自动', en: 'Auto-selected' })}</span>}</p>
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
    </div>
  );
}
