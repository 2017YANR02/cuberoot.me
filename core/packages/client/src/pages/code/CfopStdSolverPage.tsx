import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LangToggle from '../../components/LangToggle';
import './algorithm_intro.css';

const ACCENT = '#E879A6';

export default function CfopStdSolverPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';

  useEffect(() => {
    document.title = lang === 'zh' ? 'CFOP 多阶段求解器 — CubeRoot' : 'CFOP multi-stage solver — CubeRoot';
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
          <div className="algo-page-tag">{lang === 'zh' ? '自研 · 多阶段' : 'Self-built · multi-stage'}</div>
          <h1 className="algo-page-title">CFOP 多阶段求解器</h1>
          <p className="algo-page-sub">
            {lang === 'zh'
              ? 'Cross / XCross / XXCross / XXXCross / F2L 五个阶段全部求最少步。Lehmer 排列编码紧凑表示;共轭变换让 4 个 F2L 槽位共用一份剪枝表;阶段间下界传播跳过低于前置阶段最优的所有无效迭代。1,200,000 条 WCA 历史打乱 × 5 阶段 × 6 视角 = 3,600 万次最优搜索,量化颜色中性的边际收益。'
              : 'Optimal move counts for all five CFOP stages: Cross / XCross / XXCross / XXXCross / F2L. Lehmer permutation encoding for compact state representation; conjugation lets four F2L slots share one prune table; cross-stage lower-bound propagation skips iterations below the previous stage’s optimum. 1.2M WCA scrambles × 5 stages × 6 orientations = 36M optimal searches — quantifying the marginal value of color neutrality.'}
          </p>
        </header>

        <div className="algo-soon">
          <div className="algo-soon-glyph">✧</div>
          <div className="algo-soon-title">{lang === 'zh' ? '正文撰写中 (论文移植)' : 'Content in progress (paper port)'}</div>
          <p className="algo-soon-sub">
            {lang === 'zh'
              ? '即将上线:状态空间图论建模、Lehmer 编码、移动表/剪枝表预计算流水线、4-bit 紧凑存储 + 逆向 BFS 填充、共轭变换在多槽位 F2L 的作用、Huge 邻接/对角剪枝表、5 阶段下界传播、240 万样本统计 (颜色中性边际收益 + 立方对称性验证) + 10 张分布图。'
              : 'Coming: state-space graph formulation, Lehmer encoding, move/prune-table precomputation pipeline, 4-bit packed storage + reverse-BFS filling, conjugation for multi-slot F2L, huge adjacent/opposite prune tables, cross-stage lower-bound propagation, 2.4M-sample analysis (color-neutrality margins + cubic-symmetry verification) + 10 distribution figures.'}
          </p>
        </div>

        <footer className="algo-page-foot">
          <Link to="/">CubeRoot</Link> · <Link to="/code/algorithms">/code/algorithms</Link>
        </footer>
      </div>
    </div>
  );
}
