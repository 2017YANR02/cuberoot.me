import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LangToggle from '../../components/LangToggle';
import './algorithm_intro.css';

const ACCENT = '#F0A04B';

export default function Min2PhasePage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';

  useEffect(() => {
    document.title = lang === 'zh' ? 'min2phase — CubeRoot' : 'min2phase — CubeRoot';
  }, [lang]);

  return (
    <div className="algo-page" style={{ ['--accent' as string]: ACCENT }}>
      <div className="algo-page-bg" />
      <div className="algo-page-inner">
        <div className="algo-page-topbar">
          <Link to="/code/algorithms" className="algo-page-back">← /code/algorithms</Link>
          <LangToggle variant="inline" />
        </div>

        <header className="algo-page-head">
          <div className="algo-page-tag">{lang === 'zh' ? '实用化改进' : 'Practical refinement'}</div>
          <h1 className="algo-page-title">min2phase</h1>
          <p className="algo-page-sub">
            {lang === 'zh'
              ? 'Shuang Chen (cs0x7f) 的 Java 实现,把 Kociemba 二阶段往实用方向推到极致:对称压缩让剪枝表小一个量级,Huge 剪枝表给 phase1 更准的下界,phase1 解里提前找最短 phase2 总解。csTimer / TNoodle 用的就是它。'
              : 'Shuang Chen (cs0x7f)’s Java implementation pushes Kociemba two-phase to its practical limit: symmetry compression shrinks tables by an order of magnitude, huge prune tables tighten phase-1 lower bounds, and the search interleaves phase-1 candidates with phase-2 to minimise total length. It’s what csTimer and TNoodle ship.'}
          </p>
        </header>

        <div className="algo-soon">
          <div className="algo-soon-glyph">◐</div>
          <div className="algo-soon-title">{lang === 'zh' ? '正文撰写中' : 'Content in progress'}</div>
          <p className="algo-soon-sub">
            {lang === 'zh'
              ? '即将上线:CoordCube/CubieCube 数据结构、对称类与共轭表、Huge prune (CornUDSliceFlip / CornEdg) 构造、phase1 ↔ phase2 交错搜索、benchmark 对比。'
              : 'Coming: CoordCube/CubieCube structures, symmetry classes and conjugation tables, Huge prune construction (CornUDSliceFlip / CornEdg), interleaved phase-1 ↔ phase-2 search, benchmarks.'}
          </p>
        </div>

        <footer className="algo-page-foot">
          <Link to="/">CubeRoot</Link> · <Link to="/code/algorithms">/code/algorithms</Link>
        </footer>
      </div>
    </div>
  );
}
