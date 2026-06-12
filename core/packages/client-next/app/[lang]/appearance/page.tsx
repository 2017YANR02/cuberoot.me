'use client';

// /appearance — 配色主题展示页。把「经典 + 5 套中国色」并排摆出来,每张卡是该配色
// 下的真实 UI 迷你样板(走 .palette-scope[data-palette=x] 局部作用域,不影响整页),
// 点卡片即用 View Transitions 淡出应用到全站。让用户一眼横向比、敲定喜好。

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Play, RotateCcw } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { applyPalette, readPalette } from '@/lib/theme';
import { PALETTES } from '@/lib/palettes';
import { tr } from '@/i18n/tr';
import './appearance.css';

interface Card {
  id: string | null;
  scope: string;
  zh: string;
  zhHant: string;
  en: string;
  scheme: 'light' | 'dark';
}

const CARDS: Card[] = [
  { id: null, scope: 'classic', zh: '经典', zhHant: '經典', en: 'Classic', scheme: 'light' },
  ...PALETTES.map((p) => ({ id: p.id, scope: p.id, zh: p.zh, zhHant: p.zhHant, en: p.en, scheme: p.scheme })),
];

export default function AppearancePage() {
  const { i18n } = useTranslation();
  const isHant = i18n.language.startsWith('zh-Hant');
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('配色主题', 'Color Themes', '配色主題');

  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    setCurrent(readPalette());
    const r = () => setCurrent(readPalette());
    window.addEventListener('theme-change', r);
    window.addEventListener('storage', r);
    return () => {
      window.removeEventListener('theme-change', r);
      window.removeEventListener('storage', r);
    };
  }, []);

  const name = (c: Card) => (isHant ? c.zhHant : isZh ? c.zh : c.en);

  return (
    <div className="ac-page">
      <h1 className="ac-h1">{tr({ zh: '配色主题', en: 'Color Themes',
          zhHant: "配色主題"
    })}</h1>
      <p className="ac-lead">
        {tr({
          zh: '给整站换一套中国传统色。「经典」是默认的赭陶配色;其余取自中国色,点任意一张即整站淡入预览,随时可换回经典。',
          en: 'Dress the whole site in a Chinese traditional-color palette. "Classic" is the default terracotta; the rest are drawn from 中国色 — tap any card to fade the whole site into it, switch back to Classic anytime.',
            zhHant: "給整站換一套中國傳統色。「經典」是預設的赭陶配色;其餘取自中國色,點任意一張即整站淡入預覽,隨時可換回經典。"
        })}
      </p>

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
                    {c.scheme === 'dark' ? tr({ zh: '深', en: 'Dark' }) : tr({ zh: '浅', en: 'Light',
                        zhHant: "淺"
                    })}
                  </span>
                  {active && <Check size={15} className="ac-check" />}
                </span>
              </span>

              <span className="palette-scope ac-preview" data-palette={c.scope}>
                <span className="ac-pv-top">
                  <span className="ac-pv-dot" />
                  <span className="ac-pv-title">魔方 Cube</span>
                  <span className="ac-pv-faint">Ao5 12.34</span>
                </span>
                <span className="ac-pv-sub">Solve. Train. Analyze.</span>
                <span className="ac-pv-panel">
                  <span className="ac-pv-mono">R U R&#39; U&#39; R&#39; F R F&#39;</span>
                </span>
                <span className="ac-pv-actions">
                  <span className="ac-pv-btn">{tr({ zh: '应用', en: 'Apply',
                      zhHant: "應用"
                })}</span>
                  <span className="ac-pv-btn-primary" aria-hidden="true"><Play size={12} /></span>
                  <span className="ac-pv-btn-secondary" aria-hidden="true"><RotateCcw size={12} /></span>
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
