/**
 * /scramble/555-about — 5x5 打乱两种生成方法的对照说明页,从
 * Scramble555ModePicker 的 info 图标进入。
 *
 * 单页:头部 + 简介 + 两张并排卡片(各自纵向流程图)+ 对比表 + 资料链接。
 * 窄屏卡片堆叠两行。无外部图表库依赖,流程图用 CSS box + Unicode 箭头。
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import './scramble_555_about.css';

interface StepProps {
  step: number;
  title: string;
  body: string;
  highlight?: boolean;
}
function Step({ step, title, body, highlight }: StepProps) {
  return (
    <div className={`s555-step${highlight ? ' is-highlight' : ''}`}>
      <span className="s555-step-num">{step}</span>
      <div>
        <div className="s555-step-title">{title}</div>
        <div className="s555-step-body">{body}</div>
      </div>
    </div>
  );
}

function Arrow() {
  return <span className="s555-arrow" aria-hidden="true">↓</span>;
}

export default function Scramble555AboutPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  return (
    <div className="s555-page">
      <div className="s555-header">
        <Link to="/scramble/gen" className="s555-back">
          <ArrowLeft size={16} />
          <span>{t('返回打乱生成器', 'Back to scramble generator')}</span>
        </Link>
        <LangToggle />
      </div>

      <main className="s555-main">
        <h1 className="s555-title">{t('5×5 打乱:随机转动 vs 随机状态', '5×5 scramble: random-move vs random-state')}</h1>

        <p className="s555-intro">
          {t(
            '两种生成方法都能"打乱"一个 5×5 魔方,但数学层面差很远。下面是它们各自的流程、优缺点,以及为什么这个站给你两个选项。',
            'Two methods both "scramble" a 5×5 cube, but they\'re mathematically very different. Here\'s how each one works, the trade-offs, and why this site lets you pick.',
          )}
        </p>

        <div className="s555-grid">
          {/* ──── Random Move 卡片 ──── */}
          <section className="s555-card">
            <header className="s555-card-head">
              <h2>{t('随机转动 (Random-Move)', 'Random-Move')}</h2>
              <span className="s555-badge s555-badge--wca">WCA</span>
            </header>
            <p className="s555-card-tag">
              {t('WCA 比赛官方标准。生成的就是 60 步打乱序列。', 'WCA competition standard. The output is a 60-move sequence.')}
            </p>

            <div className="s555-flow">
              <Step step={1} title={t('随机选一面', 'Pick a face at random')}
                body={t('U / R / F / D / L / B 6 个面,均匀。', 'One of U / R / F / D / L / B, uniform.')} />
              <Arrow />
              <Step step={2} title={t('随机选层宽', 'Pick layer width')}
                body={t('1 层 (R / U) 或 2 层 (Rw / Uw)。', '1 layer (R / U) or 2 layers (Rw / Uw).')} />
              <Arrow />
              <Step step={3} title={t('随机选后缀', 'Pick suffix')}
                body={t("' / 2 / 无,各 1/3 概率。", "' / 2 / nothing, 1/3 each.")} />
              <Arrow />
              <Step step={4} title={t('同轴防压缩', 'Reject same-axis')}
                body={t('如果这一步跟上一步同轴(U vs D 也算),抛掉重选。', "Reject if same axis as previous (U vs D counts as same). Try again.")} />
              <Arrow />
              <Step step={5} title={t('追加到序列', 'Append')}
                body={t('合法就加进去,跳回 1。重复直到 60 步。', 'Append, loop back to step 1. Repeat until 60 moves.')}
                highlight />
            </div>

            <h3 className="s555-pros">{t('优点', 'Pros')}</h3>
            <ul className="s555-list">
              <li>{t('即时生成(<1 毫秒),浏览器本地算', 'Instant (<1 ms), runs locally in browser')}</li>
              <li>{t('确定性低,但符合 WCA 规则', 'Low determinism, but matches WCA spec')}</li>
              <li>{t('零依赖、零网络', 'Zero deps, zero network')}</li>
            </ul>
            <h3 className="s555-cons">{t('缺点', 'Cons')}</h3>
            <ul className="s555-list">
              <li>{t('「过程」而不是「结果」 — 短解状态出现概率偏高', 'A process, not an outcome — easier-to-solve states are over-represented')}</li>
              <li>{t('实际状态空间利用率不足', 'State-space coverage is not uniform')}</li>
            </ul>
          </section>

          {/* ──── Random State 卡片 ──── */}
          <section className="s555-card">
            <header className="s555-card-head">
              <h2>{t('随机状态 (Random-State)', 'Random-State')}</h2>
              <span className="s555-badge s555-badge--ours">cube555</span>
            </header>
            <p className="s555-card-tag">
              {t('cs0x7f 的 5-phase reduction solver。先采样状态,再反求打乱。', "cs0x7f's 5-phase reduction solver. Sample a state, then derive the scramble.")}
            </p>

            <div className="s555-flow">
              <Step step={1} title={t('采样合法状态', 'Sample a legal state')}
                body={t('在 5×5 全部合法状态(≈ 2.27 × 10⁷⁴)里**均匀**抽一个。', 'Sample uniformly from all legal 5×5 states (≈ 2.27 × 10⁷⁴).')} />
              <Arrow />
              <Step step={2} title={t('Phase 1-3:reduce 到 3×3', 'Phase 1-3: reduce to 3×3')}
                body={t('还原 center + 配对 wing edge,~30 步。', 'Solve centers and pair wing edges, ~30 moves.')} />
              <Arrow />
              <Step step={3} title={t('Phase 4:完成 reduction', 'Phase 4: finish reduction')}
                body={t('配对 mid edge,完成 3×3 reduction,~15 步。', 'Pair middle edges, finish the 3×3 reduction, ~15 moves.')} />
              <Arrow />
              <Step step={4} title={t('Phase 5:像 3×3 一样求解', 'Phase 5: solve as 3×3')}
                body={t('twophase Kociemba 求解角块 + 边块,~20 步。', 'Solve corners + edges via two-phase Kociemba, ~20 moves.')} />
              <Arrow />
              <Step step={5} title={t('解 → 打乱', 'Invert solution')}
                body={t('把解法**反序 + 每步取反**得到打乱序列(~70 步)。', 'Reverse the solution and invert each move → scramble (~70 moves).')}
                highlight />
            </div>

            <h3 className="s555-pros">{t('优点', 'Pros')}</h3>
            <ul className="s555-list">
              <li>{t('状态空间均匀采样,真随机', 'Uniform over the state space — truly random')}</li>
              <li>{t('每个解都"独一无二",没有偏向短解的统计现象', 'Each scramble is independent; no short-solve bias')}</li>
              <li>{t('Round-trip self-verify:每条返回前都核过', 'Round-trip self-verify: every scramble is checked before return')}</li>
            </ul>
            <h3 className="s555-cons">{t('缺点', 'Cons')}</h3>
            <ul className="s555-list">
              <li>{t('慢:服务器 solver ~1.5s / 条', 'Slow: solver takes ~1.5 s / scramble on the server')}</li>
              <li>{t('依赖网络:server 挂了会降级到随机转动', 'Needs network — if the server is down, falls back to random-move')}</li>
              <li>{t('非 WCA 标准:比赛不能用', 'Not WCA-compliant: not allowed in official competition')}</li>
            </ul>
          </section>
        </div>

        {/* ──── 对比表 ──── */}
        <h2 className="s555-section-title">{t('一眼对比', 'At a glance')}</h2>
        <div className="s555-table-wrap">
          <table className="s555-table">
            <thead>
              <tr>
                <th>{t('维度', 'Dimension')}</th>
                <th>{t('随机转动', 'Random-Move')}</th>
                <th>{t('随机状态', 'Random-State')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>{t('WCA 合规', 'WCA-compliant')}</th>
                <td>✓</td>
                <td>✗</td>
              </tr>
              <tr>
                <th>{t('序列长度', 'Length')}</th>
                <td>60</td>
                <td>~70</td>
              </tr>
              <tr>
                <th>{t('生成时间', 'Generation time')}</th>
                <td>{t('<1 毫秒', '<1 ms')}</td>
                <td>~1.5 s</td>
              </tr>
              <tr>
                <th>{t('状态分布', 'State distribution')}</th>
                <td>{t('偏短解', 'biased toward easy solves')}</td>
                <td>{t('均匀', 'uniform')}</td>
              </tr>
              <tr>
                <th>{t('计算位置', 'Where it runs')}</th>
                <td>{t('浏览器', 'in-browser')}</td>
                <td>{t('服务器 (Java daemon)', 'server (Java daemon)')}</td>
              </tr>
              <tr>
                <th>{t('剪枝表', 'Pruning tables')}</th>
                <td>{t('无', 'none')}</td>
                <td>~230 MB</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ──── 资料 ──── */}
        <h2 className="s555-section-title">{t('参考资料', 'References')}</h2>
        <ul className="s555-refs">
          <li>
            <a href="https://github.com/cs0x7f/cube555" target="_blank" rel="noopener noreferrer">
              cs0x7f/cube555
            </a>
            {' — '}
            {t('5-phase reduction solver 上游(Java),本站 daemon 就是它的胶水', 'upstream 5-phase reduction solver (Java); our daemon wraps it')}
          </li>
          <li>
            <a href="https://www.worldcubeassociation.org/regulations/#article-4-scrambling" target="_blank" rel="noopener noreferrer">
              {t('WCA 第 4 条规则:打乱', 'WCA Regulation §4: Scrambling')}
            </a>
            {' — '}
            {t('为什么比赛用 60 步随机转动', 'why competitions use 60-move random-move')}
          </li>
          <li>
            <a href="https://www.cubing.net/cubing.js/" target="_blank" rel="noopener noreferrer">
              cubing.js
            </a>
            {' — '}
            {t('浏览器端随机转动生成器', 'in-browser random-move generator we use')}
          </li>
        </ul>
      </main>
    </div>
  );
}
