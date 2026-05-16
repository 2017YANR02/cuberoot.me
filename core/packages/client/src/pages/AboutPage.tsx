/**
 * /about — 关于 / 致谢页。纯文字列表,中英双语。
 *
 * Credits 数据源: src/pages/credits_data.json (单一数据源)。
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import LangToggle from '../components/LangToggle';
import CREDITS from './credits_data.json';
import './about.css';

export default function AboutPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  return (
    <div className="about-page">
      <header className="about-header">
        <Link to="/" className="about-back">
          <ChevronLeft size={16} />
          <span>{isZh ? '首页' : 'Home'}</span>
        </Link>
        <LangToggle />
      </header>

      <main className="about-main">
        <h1 className="about-title">{isZh ? '关于' : 'About'}</h1>
        <p className="about-lead">
          {isZh
            ? 'CubeRoot 是一个魔方工具站,由若干开源项目启发并整合而成。下面是它们的清单。'
            : 'CubeRoot is a cubing toolkit, built on top of and inspired by the open-source projects below.'}
        </p>

        <h2 className="about-section-title">{isZh ? '致谢' : 'Credits'}</h2>
        <ul className="about-credits">
          {CREDITS.map(c => (
            <li key={c.url}>
              <a href={c.url} target="_blank" rel="noopener noreferrer">{c.name}</a>
              <span className="about-credits-desc"> — {isZh ? c.zh : c.en}</span>
            </li>
          ))}
        </ul>

        <p className="about-source">
          {isZh ? '本站源码: ' : 'Source code: '}
          <a href="https://github.com/RuiminYan/cuberoot.me" target="_blank" rel="noopener noreferrer">
            github.com/RuiminYan/cuberoot.me
          </a>
        </p>
      </main>
    </div>
  );
}
