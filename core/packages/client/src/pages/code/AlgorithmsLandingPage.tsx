import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LangToggle from '../../components/LangToggle';
import './algorithms_landing.css';

interface Topic {
  slug: string;
  href: string;
  zh: { title: string; sub: string; tagline: string; meta: string };
  en: { title: string; sub: string; tagline: string; meta: string };
  accent: string;
  glyph: string;
  available: boolean;
}

const TOPICS: Topic[] = [
  {
    slug: 'ida-star',
    href: '/code/algorithms/ida-star',
    accent: '#5BA8FF',
    glyph: 'A*',
    available: true,
    zh: {
      title: 'IDA* + 剪枝表',
      sub: 'Iterative Deepening A*',
      tagline: '所有魔方求解器共用的底座:迭代加深 + admissible 启发式;逆向 BFS 把状态距离压成 4-bit 查表,内存换时间',
      meta: '通用底座 · 4-bit 查表 · 逆向 BFS',
    },
    en: {
      title: 'IDA* + prune tables',
      sub: 'Iterative Deepening A*',
      tagline: 'The engine every cube solver shares: iterative deepening + admissible heuristic; reverse BFS encodes state distance into a 4-bit lookup table — memory for time',
      meta: 'Foundation · 4-bit LUT · reverse BFS',
    },
  },
  {
    slug: 'kociemba',
    href: '/code/algorithms/kociemba',
    accent: '#7BD389',
    glyph: '⫻',
    available: true,
    zh: {
      title: 'Kociemba 二阶段',
      sub: 'Two-Phase Algorithm',
      tagline: '1992 年 Herbert Kociemba 提出的经典分治:先到 G1 子群,再在 G1 内归位;三种坐标 (CO/EO/UD slice) + 三张剪枝表',
      meta: '经典分治 · G1 子群 · 三坐标',
    },
    en: {
      title: 'Kociemba two-phase',
      sub: 'Two-Phase Algorithm',
      tagline: 'The 1992 classic by Herbert Kociemba: descend to subgroup G1, then solve within it. Three coordinates (CO/EO/UD-slice) and three prune tables',
      meta: 'Classic D&C · subgroup G1 · 3 coords',
    },
  },
  {
    slug: 'min2phase',
    href: '/code/algorithms/min2phase',
    accent: '#F0A04B',
    glyph: '◐',
    available: true,
    zh: {
      title: 'min2phase',
      sub: 'Shuang Chen 的改进实现',
      tagline: 'cs0x7f 把 Kociemba 二阶段往实用方向推到极致:对称压缩、Huge 剪枝表、phase1 提前剪枝 — 普通笔记本秒解任意打乱',
      meta: 'Java 实现 · 对称压缩 · Huge prune',
    },
    en: {
      title: 'min2phase',
      sub: 'Shuang Chen’s refined build',
      tagline: 'cs0x7f pushes two-phase to its practical limit: symmetry compression, huge prune tables, phase-1 early cutoff — instant solves on any laptop',
      meta: 'Java impl · symmetry · huge prune',
    },
  },
  {
    slug: 'cfop-std-solver',
    href: '/code/algorithms/cfop-std-solver',
    accent: '#E879A6',
    glyph: '✧',
    available: true,
    zh: {
      title: 'CFOP 多阶段求解器',
      sub: 'Cross / XCross / F2L 最少步',
      tagline: '自研:5 个 CFOP 阶段全部求最少步;Lehmer 编码 + 共轭变换让 4 个 F2L 槽位共用一份剪枝表;240 万样本量化颜色中性收益',
      meta: '5 阶段 · 共轭 · 240 万样本',
    },
    en: {
      title: 'CFOP multi-stage solver',
      sub: 'Optimal Cross / XCross / F2L',
      tagline: 'Self-built: optimal move counts for all 5 CFOP stages. Lehmer encoding + conjugation lets four F2L slots share one prune table; 2.4M samples quantify color-neutrality',
      meta: '5 stages · conjugation · 2.4M samples',
    },
  },
];

export default function AlgorithmsLandingPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';

  useEffect(() => {
    document.title = lang === 'zh' ? '算法导览 — CubeRoot' : 'Algorithms — CubeRoot';
  }, [lang]);

  return (
    <div className="algos-landing">
      <div className="algos-landing-bg" />

      <header className="algos-landing-head">
        <div className="algos-landing-topbar">
          <Link to="/code" className="algos-landing-back">← /code</Link>
          <LangToggle variant="inline" />
        </div>
        <h1 className="algos-landing-title">
          <span className="algos-landing-prefix">/</span>algorithms
          <span className="algos-landing-cursor">_</span>
        </h1>
        <p className="algos-landing-sub">
          {lang === 'zh'
            ? '魔方求解类算法的长篇导览。一题一篇深度,含数学建模、数据结构、实现细节、性能曲线。'
            : 'Long-form guides to the cube-solving algorithms running inside CubeRoot. One algorithm per page — math, data structures, implementation, performance.'}
        </p>
        <div className="algos-landing-meta">
          <span>{lang === 'zh' ? '4 篇深度' : '4 deep dives'}</span>
          <span className="algos-landing-meta-dot">·</span>
          <span>{lang === 'zh' ? '状态空间搜索 / 启发式剪枝' : 'state-space search / admissible heuristics'}</span>
        </div>
      </header>

      <main className="algos-landing-grid">
        {TOPICS.map((t) => {
          const text = t[lang];
          return (
            <Link
              key={t.slug}
              to={t.href}
              className="algos-card"
              style={{ ['--accent' as string]: t.accent }}
            >
              <div className="algos-card-top">
                <div className="algos-card-glyph">{t.glyph}</div>
                <div className="algos-card-route">{t.href}</div>
              </div>
              <div className="algos-card-title">{text.title}</div>
              <div className="algos-card-sub">{text.sub}</div>
              <p className="algos-card-tagline">{text.tagline}</p>
              <div className="algos-card-foot">
                <span className="algos-card-meta">{text.meta}</span>
                <span className="algos-card-arrow">→</span>
              </div>
            </Link>
          );
        })}
      </main>

      <footer className="algos-landing-foot">
        <div className="algos-landing-foot-line">
          <span>{lang === 'zh' ? '内容持续增补' : 'Content always growing'}</span>
          <span className="algos-landing-meta-dot">·</span>
          <Link to="/">CubeRoot</Link>
        </div>
      </footer>
    </div>
  );
}
