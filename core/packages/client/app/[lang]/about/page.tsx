'use client';

// /about — port of packages/client-vite/src/pages/AboutPage.tsx.

import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import HomeLink from '@/components/HomeLink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import CREDITS from './credits_data.json';
import './about.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

export default function AboutPage() {
  const { i18n } = useTranslation();
  useDocumentTitle('关于', 'About');

  return (
    <div className="about-page">
      <header className="about-header">
        <HomeLink className="about-back">
          <ChevronLeft size={16} />
          <span>{tr({ zh: '首页', en: 'Home'
        })}</span>
        </HomeLink>
      </header>

      <main className="about-main">
        <h1 className="about-title">{tr({ zh: '关于', en: 'About'
        })}</h1>
        <p className="about-lead">
          {tr({ zh: 'CubeRoot 是一个魔方工具站,由若干开源项目启发并整合而成。下面是它们的清单。', en: 'CubeRoot is a cubing toolkit, built on top of and inspired by the open-source projects below.'
        })}
        </p>

        <h2 className="about-section-title">{tr({ zh: '致谢', en: 'Credits'
        })}</h2>
        <ul className="about-credits">
          {CREDITS.map((c) => (
            <li key={c.url}>
              <a href={c.url} target="_blank" rel="noopener noreferrer">{c.name}</a>
              <span className="about-credits-desc"> — {tr(c)}</span>
            </li>
          ))}
        </ul>

        <p className="about-source">
          {tr({ zh: '本站源码: ', en: 'Source code: '
        })}
          <a href="https://github.com/RuiminYan/cuberoot.me" target="_blank" rel="noopener noreferrer">
            github.com/RuiminYan/cuberoot.me
          </a>
        </p>
      </main>
    </div>
  );
}
