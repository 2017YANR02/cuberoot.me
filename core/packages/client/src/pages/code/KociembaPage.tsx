import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LangToggle from '../../components/LangToggle';
import './algorithm_intro.css';

const ACCENT = '#7BD389';

export default function KociembaPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';

  useEffect(() => {
    document.title = lang === 'zh' ? 'Kociemba 二阶段 — CubeRoot' : 'Kociemba two-phase — CubeRoot';
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
          <div className="algo-page-tag">{lang === 'zh' ? '经典分治' : 'Classic D&C'}</div>
          <h1 className="algo-page-title">Kociemba 二阶段</h1>
          <p className="algo-page-sub">
            {lang === 'zh'
              ? '1992 年 Herbert Kociemba 提出的二阶段算法:先把状态降到 G1 = ⟨U, D, L², R², F², B²⟩ 子群,再在 G1 内完成归位。两阶段各自跑 IDA*,共用三种坐标 (CO / EO / UD slice) 的剪枝表。'
              : 'The 1992 two-phase algorithm by Herbert Kociemba: drop the state into the subgroup G1 = ⟨U, D, L², R², F², B²⟩ first, then solve inside G1. Each phase runs its own IDA*, sharing three coordinate prune tables (CO / EO / UD-slice).'}
          </p>
        </header>

        <div className="algo-soon">
          <div className="algo-soon-glyph">⫻</div>
          <div className="algo-soon-title">{lang === 'zh' ? '正文撰写中' : 'Content in progress'}</div>
          <p className="algo-soon-sub">
            {lang === 'zh'
              ? '即将上线:G1 子群定义、CO/EO/UD-slice 三坐标编码、phase1→phase2 衔接、IDA* 搜索循环、典型平均步数曲线。'
              : 'Coming: definition of subgroup G1, CO/EO/UD-slice coordinate encoding, phase1→phase2 handoff, the IDA* search loop, typical move-count curves.'}
          </p>
        </div>

        <footer className="algo-page-foot">
          <Link to="/">CubeRoot</Link> · <Link to="/code/algorithms">/code/algorithms</Link>
        </footer>
      </div>
    </div>
  );
}
