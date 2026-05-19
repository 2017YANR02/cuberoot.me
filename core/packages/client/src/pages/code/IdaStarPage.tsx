import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LangToggle from '../../components/LangToggle';
import './algorithm_intro.css';

const ACCENT = '#5BA8FF';

export default function IdaStarPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';

  useEffect(() => {
    document.title = lang === 'zh' ? 'IDA* + 剪枝表 — CubeRoot' : 'IDA* + prune tables — CubeRoot';
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
          <div className="algo-page-tag">{lang === 'zh' ? '通用底座' : 'Foundation'}</div>
          <h1 className="algo-page-title">IDA* + prune tables</h1>
          <p className="algo-page-sub">
            {lang === 'zh'
              ? '所有魔方求解器共用的搜索底座:迭代加深 A* 配 admissible 启发式;状态距离用逆向 BFS 预计算压成 4-bit 查表。空间换时间,本页拆开讲它每一步在算什么。'
              : 'The search engine every cube solver shares: iterative deepening A* with an admissible heuristic. State distance is pre-computed by reverse BFS into a 4-bit lookup table. This page unpacks each piece.'}
          </p>
        </header>

        <div className="algo-soon">
          <div className="algo-soon-glyph">A*</div>
          <div className="algo-soon-title">{lang === 'zh' ? '正文撰写中' : 'Content in progress'}</div>
          <p className="algo-soon-sub">
            {lang === 'zh'
              ? '即将上线:深度优先迭代加深、admissible / consistent 启发式、4-bit 压缩存储、逆向 BFS 预计算、对称归一化、move pruning。'
              : 'Coming: depth-limited DFS with iterative deepening, admissible heuristics, 4-bit packed storage, reverse-BFS precomputation, symmetry reduction, move pruning.'}
          </p>
        </div>

        <footer className="algo-page-foot">
          <Link to="/">CubeRoot</Link> · <Link to="/code/algorithms">/code/algorithms</Link>
        </footer>
      </div>
    </div>
  );
}
