/**
 * /about — 关于 / 致谢页。纯文字列表,中英双语。
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import LangToggle from '../components/LangToggle';
import './about.css';

interface Credit {
  name: string;
  url: string;
  zh: string;
  en: string;
}

// NOTE: 上游开源项目 — 按字母序整理
const CREDITS: Credit[] = [
  { name: 'or18 / RubiksSolverDemo', url: 'https://github.com/or18/RubiksSolverDemo',
    zh: '3x3 求解器 demo',                                   en: '3x3 solver demo' },
  { name: 'jonatanklosko / wca_statistics', url: 'https://github.com/jonatanklosko/wca_statistics',
    zh: 'WCA 统计管道的原型(本站 TS 重写版)',               en: 'WCA statistics pipeline (TS rewrite here)' },
  { name: 'mihlefeld / Alg-Trainers', url: 'https://github.com/mihlefeld/Alg-Trainers',
    zh: '公式训练器',                                         en: 'Algorithm trainer' },
  { name: 'carykh / hthgrapher', url: 'https://github.com/carykh/hthgrapher',
    zh: 'HTH 计算器(已 port 为 React)',                     en: 'HTH calculator (ported to React)' },
  { name: 'MatteoColombo / cube_challenge_timer', url: 'https://github.com/MatteoColombo/cube_challenge_timer',
    zh: '1v1 对战计时器(已 port 为 React)',                 en: '1v1 battle timer (ported to React)' },
  { name: 'cs0x7f / cstimer', url: 'https://github.com/cs0x7f/cstimer',
    zh: 'csTimer 计时器(integrated)',                       en: 'csTimer (integrated)' },
  { name: 'MeigenChou / DCTimer-Android', url: 'https://github.com/MeigenChou/DCTimer-Android',
    zh: 'BLE / 协议参考',                                     en: 'BLE / protocol reference' },
  { name: 'Roman- / mosaic', url: 'https://github.com/Roman-/mosaic',
    zh: '魔方马赛克(已 port 为 React)',                     en: 'Mosaic generator (ported to React)' },
  { name: 'huazhechen / cuber', url: 'https://github.com/huazhechen/cuber',
    zh: '/stack 的 three.js 魔方引擎(原 Vue + Vuetify,已 port 为 React)',
    en: '/stack three.js cube engine (originally Vue + Vuetify, ported to React)' },
  { name: 'nemesizer.com', url: 'https://nemesizer.com',
    zh: '"宿敌"概念灵感',                                    en: 'Nemesizer concept inspiration' },
  { name: 'cubing.pro', url: 'https://cubing.pro/',
    zh: '若干统计可视化的灵感',                                en: 'Statistics visualization inspiration' },
  { name: 'tdecker91 / puzzle-gen', url: 'https://github.com/tdecker91/puzzle-gen',
    zh: 'SR puzzle SVG 渲染(sq1 / megaminx / pyraminx / skewb)', en: 'SR puzzle SVG renderer' },
  { name: 'nbwzx / commutator', url: 'https://github.com/nbwzx/commutator',
    zh: '换位子分解工具(已 port 为 React)',                  en: 'Commutator decomposer (ported to React)' },
  { name: 'speedcubedb.com', url: 'https://speedcubedb.com',
    zh: '公式库 / CFOP 分析器灵感',                            en: 'Alg library / CFOP analyzer inspiration' },
];

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
