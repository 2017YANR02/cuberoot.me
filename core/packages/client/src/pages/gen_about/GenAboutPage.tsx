/**
 * /scramble/gen-about — 打乱生成器说明页。介绍三种模式 (comp / batch / paste) +
 * 后台预生成 pool 的工作方式。从 GenPage 标题的 HelpCircle 入口进入。
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import './gen_about.css';

interface StepProps {
  step: number;
  title: string;
  body: string;
  highlight?: boolean;
}
function Step({ step, title, body, highlight }: StepProps) {
  return (
    <div className={`ga-step${highlight ? ' is-highlight' : ''}`}>
      <span className="ga-step-num">{step}</span>
      <div>
        <div className="ga-step-title">{title}</div>
        <div className="ga-step-body">{body}</div>
      </div>
    </div>
  );
}
function Arrow() {
  return <span className="ga-arrow" aria-hidden="true">↓</span>;
}

export default function GenAboutPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);
  useDocumentTitle('打乱生成器说明', 'Scramble Generator Guide');

  return (
    <div className="ga-page">
      <div className="ga-header">
        <Link to="/scramble/gen" className="ga-back">
          <ArrowLeft size={16} />
          <span>{t('返回打乱生成器', 'Back to scramble generator')}</span>
        </Link>
        <LangToggle />
      </div>

      <main className="ga-main">
        <h1 className="ga-title">{t('打乱生成器是怎么工作的', 'How the scramble generator works')}</h1>
        <p className="ga-intro">
          {t(
            '/scramble/gen 是站内的统一打乱生成入口。3 种模式覆盖从「比赛官方打乱表」到「随手出 N 条练习」到「自带打乱粘进来出图」的常见需求。所有 WCA 项目走 Lucas Garron 的 cubing.js 随机状态生成器(4×4 走 cs0x7f Threephase 走 Web Worker 池,5×5 可切到本站 cube555 daemon 真随机态)。额外还接入了 cubing.js twizzleEvents 里 5 个非 WCA 的真随机态项目:FTO / 四阶金字塔 / 二阶五魔 / Redi / 二阶 FTO。',
            '/scramble/gen is the unified scramble entry point. Three modes cover the common needs: "official WCA scramble sheet", "quick N scrambles to practice", "paste my own scrambles for preview". All WCA events go through Lucas Garron\'s cubing.js random-state scramblers (4×4 routes to cs0x7f Threephase via a Web Worker pool; 5×5 can switch to our server-side cube555 daemon for true random-state). 5 additional non-WCA random-state events from cubing.js twizzleEvents are also plugged in: FTO / Master Tetra / Kilominx / Redi / Baby FTO.',
          )}
        </p>

        <h2 className="ga-section-title">{t('三种模式', 'The three modes')}</h2>
        <div className="ga-mode-grid">
          <section className="ga-mode-card">
            <header className="ga-mode-head">
              <h3>{t('比赛 (Comp)', 'Comp')}</h3>
              <span className="ga-badge">tnoodle</span>
            </header>
            <p className="ga-mode-tag">
              {t(
                '一张完整的 WCA 比赛打乱表。多项目 + 多轮 + 每轮多组,format / sets / copies 全可配。也能粘 WCA 比赛 id 直接拉已公布的真实打乱。',
                'A full WCA-style scramble sheet — multi-event, multi-round, multi-group, with format / sets / copies all configurable. Or paste a WCA comp id to pull published scrambles.',
              )}
            </p>
            <ul className="ga-mode-uses">
              <li>{t('模拟比赛日的全套打乱', 'Mock a competition-day scramble run')}</li>
              <li>{t('做团练 / 周赛 / 模拟赛的打乱表', 'Make club / weekly-comp scramble sheets')}</li>
              <li>{t('回看历史比赛真实打乱(WCA 公布后)', 'Browse real published scrambles from past comps')}</li>
            </ul>
            <h4 className="ga-mode-out">{t('输出', 'Output')}</h4>
            <p className="ga-mode-out-body">{t('网页表格 + tnoodle 风格 PDF(含打乱图,可关)。', 'Web table + tnoodle-style PDF (with preview thumbnails — toggleable).')}</p>
          </section>

          <section className="ga-mode-card">
            <header className="ga-mode-head">
              <h3>{t('批量 (Batch)', 'Batch')}</h3>
              <span className="ga-badge">quick</span>
            </header>
            <p className="ga-mode-tag">
              {t(
                '选 1 个或多个项目,设个数量 (1-1000),按一次直接出。多项目并排,每项目独立计时基准。',
                'Pick one or more events + a count (1-1000). Multi-event runs in parallel; each event reports its own timing.',
              )}
            </p>
            <ul className="ga-mode-uses">
              <li>{t('日常练打乱集', 'Daily practice scramble sets')}</li>
              <li>{t('做对照实验 / 跑统计的种子', 'Seeds for A/B benchmarks or statistical runs')}</li>
              <li>{t('一键 100 条复制贴到 csTimer / Twisty Timer', 'Copy 100 scrambles into csTimer / Twisty Timer in one go')}</li>
            </ul>
            <h4 className="ga-mode-out">{t('输出', 'Output')}</h4>
            <p className="ga-mode-out-body">{t('每个项目一张表(点行复制单条) + 一键出 PDF。', 'Per-event tables (click a row to copy one scramble) + one-click PDF export.')}</p>
          </section>

          <section className="ga-mode-card">
            <header className="ga-mode-head">
              <h3>{t('输入 (Paste)', 'Paste')}</h3>
              <span className="ga-badge">manual</span>
            </header>
            <p className="ga-mode-tag">
              {t(
                '自带打乱粘进来,出预览图。容忍 "1. " / "1) " 编号前缀。',
                'Bring your own scrambles, get previews. Tolerates leading "1. " / "1) " numbering.',
              )}
            </p>
            <ul className="ga-mode-uses">
              <li>{t('要把别处的打乱(老比赛 / 朋友给的)做 PDF', 'Turn scrambles from elsewhere (old comp / a friend) into a PDF')}</li>
              <li>{t('看一组特定打乱的 2D net 是什么样', 'Peek at the 2D net of a specific scramble set')}</li>
              <li>{t('校对粘出来的打乱跟原始一致', 'Sanity-check a paste against its source')}</li>
            </ul>
            <h4 className="ga-mode-out">{t('输出', 'Output')}</h4>
            <p className="ga-mode-out-body">{t('实时预览 + 一键出 PDF。', 'Live preview + one-click PDF export.')}</p>
          </section>
        </div>

        <h2 className="ga-section-title">{t('比赛模式的流程', 'Comp-mode flow')}</h2>
        <p className="ga-section-intro">
          {t(
            '配置 → 后台默默预生成 → 点「生成」秒切到查看模式。后台 pool 让点按钮的瞬间几乎不用等。',
            'Configure → background prefetch silently fills a pool → clicking Generate snaps to the view almost instantly because pool drain is free.',
          )}
        </p>
        <div className="ga-flow">
          <Step
            step={1}
            title={t('挑项目', 'Pick events')}
            body={t(
              '21 个 WCA 项目图标里点选,带橙色高亮。也能输入 8-50 加高阶 NxN(8×8 到 50×50 都行,WCA 7 项之外)。',
              'Click one or more of the 21 WCA event icons (orange highlight). Optionally type 8-50 to add a high-order NxN (8×8 to 50×50, beyond WCA\'s 7).',
            )}
          />
          <Arrow />
          <Step
            step={2}
            title={t('调轮数 / 组 / 份 / 赛制', 'Tune rounds / sets / copies / format')}
            body={t(
              '再点同一图标加一轮(最多 4 轮);每轮配 format (Ao5 / Mo3 / Bo1 等)、scrambleSets(几组打乱)、copies(印几份)。MBLD 还能调每次魔方数,FM 选翻译语言,clock 选配色。',
              'Click the same icon again to add a round (up to 4); each round has its own format (Ao5 / Mo3 / Bo1 …), scrambleSets (groups), and copies (printed copies). MBLD has cubes-per-attempt; FM picks translation languages; clock picks pin colors.',
            )}
          />
          <Arrow />
          <Step
            step={3}
            title={t('后台 pool 默默 top up', 'Background pool silently tops up')}
            body={t(
              '配置一改,前端就按当前需求量(总 attempts × cubes × sets)算出每种 scramble 类型缺多少条,默默发起后台生成。这步看不到 UI,但它把 444/555 的 ~3s 剪枝表 build 和单条求解时间挪到「用户读屏」这段空闲里。',
              'On every config change, the client computes how many scrambles of each type are needed (total attempts × cubes × sets) and fires async fills in the background. No UI noise — but the ~3 s 4×4/5×5 pruning-table build and per-scramble solver cost happens during user think-time instead of after a button click.',
            )}
          />
          <Arrow />
          <Step
            step={4}
            title={t('点「生成 (N)」', 'Click "Generate (N)"')}
            body={t(
              '能从 pool 拿就直接 shift 出来,几乎零等。pool 没填满的部分回退到现场生成,跟点按钮前一样。生成完页面切到查看模式:顶端 selector 单选切项目,下面是 sheet 表格 + 打乱图预览。',
              'Drain from the pool first (near-zero wait). Anything not yet pooled falls through to live generation. The page then switches to view mode: top selector single-picks an event; sheet table + preview thumbnails below.',
            )}
            highlight
          />
          <Arrow />
          <Step
            step={5}
            title={t('看 / 复制 / 下载 PDF', 'View / copy / download PDF')}
            body={t(
              '右上「下载 PDF」走 tnoodle 风格 (项目分组 + group / sets / copies header + 打乱图 thumbnail)。需要换比赛或重新配置:左边的清空按钮回配置模式。',
              "Top-right Download PDF emits a tnoodle-style PDF (event grouped, group/sets/copies headers, preview thumbnails). To re-configure: hit the clear button on the left to return to configure mode.",
            )}
          />
        </div>

        <h2 className="ga-section-title">{t('批量 / 输入模式的流程', 'Batch / paste flow')}</h2>
        <p className="ga-section-intro">
          {t(
            '配置即结果。改 events / count 立即重生,看着结果调,不需要确认按钮。',
            'Config is the result. Tweaking events or count triggers an immediate regen; what you see is always live — no "apply" button.',
          )}
        </p>
        <div className="ga-flow ga-flow--compact">
          <Step
            step={1}
            title={t('挑项目', 'Pick events')}
            body={t('多选 21 个 WCA 项目里的若干个;高阶 NxN 同 Comp 模式。', 'Multi-pick from the 21 WCA events; high-order NxN works the same as Comp.')}
          />
          <Arrow />
          <Step
            step={2}
            title={t('选个数(批量)/ 粘文本(输入)', 'Pick a count (batch) / paste text (paste)')}
            body={t(
              '批量:输入 1-1000 或点 chip(1 / 5 / 12 / 25 / 50 / 100 / 200 / 1000)。输入:每行一条粘到选中项目下方的 textarea。',
              'Batch: type 1-1000 or pick a chip (1 / 5 / 12 / 25 / 50 / 100 / 200 / 1000). Paste: one scramble per line into each event\'s textarea.',
            )}
          />
          <Arrow />
          <Step
            step={3}
            title={t('实时显示', 'Live render')}
            body={t(
              '改一下马上重生 / 重渲。每个 event 各自统计 wall / avg / first 三个时间,可以一眼看出哪种打乱在你机器上慢。',
              'Any change re-renders instantly. Per-event timing (wall / avg / first) lets you see at a glance which scrambler is slow on your machine.',
            )}
            highlight
          />
        </div>

        <h2 className="ga-section-title">{t('引擎选择', 'Engine selection')}</h2>
        <div className="ga-engine-table-wrap">
          <table className="ga-engine-table">
            <thead>
              <tr>
                <th>{t('项目', 'Event')}</th>
                <th>{t('引擎', 'Engine')}</th>
                <th>{t('生成位置', 'Where')}</th>
                <th>{t('特点', 'Notes')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>2×2 / 3×3 / 3×3 BLD / OH / FT / FM / MBLD</td>
                <td>cubing.js</td>
                <td>{t('浏览器', 'browser')}</td>
                <td>{t('真随机状态,毫秒级', 'random-state, millisecond')}</td>
              </tr>
              <tr>
                <td>4×4</td>
                <td>cs0x7f Threephase</td>
                <td>{t('浏览器 Web Worker 池', 'browser Web Worker pool')}</td>
                <td>{t('真随机状态,冷启 ~3s 剪枝表,池满后秒级', 'random-state; ~3 s cold table build, then ms once pool is warm')}</td>
              </tr>
              <tr>
                <td>5×5</td>
                <td>{t('cubing.js (默认) 或 cube555 daemon', 'cubing.js (default) or cube555 daemon')}</td>
                <td>{t('浏览器 / 服务器', 'browser / server')}</td>
                <td>
                  {t('默认 WCA 标准 60 步随机转动;切到「随机状态」走服务器,~70 步真均匀。', 'Default is the WCA 60-move random-move; toggle to "random-state" for the server (~70 moves, uniform).')}
                  {' '}
                  <Link to="/scramble/555-about">{t('详情', 'details')}</Link>
                </td>
              </tr>
              <tr>
                <td>6×6 / 7×7</td>
                <td>cubing.js</td>
                <td>{t('浏览器', 'browser')}</td>
                <td>{t('WCA 标准 80 / 100 步随机转动', 'WCA 80 / 100 random-move')}</td>
              </tr>
              <tr>
                <td>{t('高阶 N×N (N ≥ 8)', 'high-order N×N (N ≥ 8)')}</td>
                <td>{t('自带随机转动(线性 20·(N-2))', 'in-house random-move (linear 20·(N-2))')}</td>
                <td>{t('浏览器', 'browser')}</td>
                <td>{t('WCA 没规范,模仿 5/6/7 的轴防压缩规则', 'No WCA spec; mirrors the same-axis rejection used by 5/6/7')}</td>
              </tr>
              <tr>
                <td>{t('Pyraminx / Skewb / Sq-1 / Megaminx / Clock', 'Pyraminx / Skewb / Sq-1 / Megaminx / Clock')}</td>
                <td>cubing.js</td>
                <td>{t('浏览器', 'browser')}</td>
                <td>{t('随机状态(各 puzzle 独立 solver)', 'random-state (per-puzzle solver)')}</td>
              </tr>
              <tr>
                <td>{t('非 WCA:FTO / 四阶金字塔 / 二阶五魔 / Redi / 二阶 FTO', 'Non-WCA: FTO / Master Tetra / Kilominx / Redi / Baby FTO')}</td>
                <td>cubing.js</td>
                <td>{t('浏览器', 'browser')}</td>
                <td>
                  {t(
                    '随机状态(cubing.js twizzleEvents),5 个项目接在 WCA 21 项后面同行展示',
                    'Random-state (cubing.js twizzleEvents); 5 events appended in the same selector row after the WCA 21',
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="ga-section-title">{t('快的秘密:三层池子', 'Why it feels fast: three layers of pool')}</h2>
        <ul className="ga-pool-list">
          <li>
            <strong>{t('prewarm 启动钩:', 'prewarm on mount:')}</strong>
            {t(
              ' 进 /scramble/gen 就触发 333 / 444 / 555 的剪枝表 build,跟用户挑项目并行。第一次点 Generate 不再等 ~3s 冷启。',
              ' Landing on /scramble/gen kicks off the 333 / 444 / 555 pruning-table build in parallel with the user picking events. The first Generate click no longer eats a ~3 s cold start.',
            )}
          </li>
          <li>
            <strong>{t('cubing.js immediate prefetch:', 'cubing.js immediate prefetch:')}</strong>
            {t(
              ' 配 scramblePrefetchLevel: \'immediate\',一条打乱解出来下一条就开始(默认是 1s idle 才开)。连点 Generate 第 2、3 次基本零等。',
              " We set scramblePrefetchLevel: 'immediate' so the next scramble starts solving the instant the previous one resolves (default is 1 s idle). Click-click-click feels free.",
            )}
          </li>
          <li>
            <strong>{t('应用层池 (cubingScramble.ts):', 'App-level pool (cubingScramble.ts):')}</strong>
            {t(
              ' 每个项目维护 N 条已生成 scramble。pop 一条立刻 schedule 补一条;4×4 池 25,5×5 池 5,其余 3。',
              ' Each event keeps N pre-generated scrambles. Pop one, schedule a refill; 4×4 pool = 25, 5×5 = 5, others = 3.',
            )}
          </li>
          <li>
            <strong>{t('Comp 模式专属:per-config 大池 (TNoodleMode):', 'Comp-only per-config pool (TNoodleMode):')}</strong>
            {t(
              ' 在配置 events / rounds / sets 时,后台按当前需求量预生成到「正好够用」。点 Generate 几乎就是从池里 shift。',
              ' While configuring events / rounds / sets, the page prefetches "exactly enough" in the background. Generate then becomes mostly a pool drain.',
            )}
          </li>
        </ul>

        <h2 className="ga-section-title">{t('相关页面', 'See also')}</h2>
        <ul className="ga-refs">
          <li>
            <Link to="/scramble/555-about">{t('5×5 打乱方法对照', '5×5 scramble methods')}</Link>
            {t(' — 随机转动 vs 随机状态,以及 cube555 daemon 的 5 个 phase 怎么跑。', " — random-move vs random-state, plus the 5 phases of the cube555 daemon.")}
          </li>
          <li>
            <Link to="/scramble/analyzer">{t('CFOP 打乱分析器', 'CFOP scramble analyzer')}</Link>
            {t(' — 拿一条 3×3 打乱看 cross / F2L 各步的最佳解法长度。', ' — feed one 3×3 scramble, see optimal cross / F2L lengths per step.')}
          </li>
          <li>
            <Link to="/scramble/solver">{t('Solver demo', 'Solver demo')}</Link>
            {t(' — Kociemba two-phase 在浏览器跑的可视化。', " — Kociemba two-phase running visually in the browser.")}
          </li>
          <li>
            <a href="https://www.cubing.net/cubing.js/" target="_blank" rel="noopener noreferrer">cubing.js</a>
            {t(' — Lucas Garron 的浏览器 cubing 全家桶,本站打乱都从这条流出来。', " — Lucas Garron's in-browser cubing stack; all our scrambles flow through it.")}
          </li>
          <li>
            <a href="https://www.worldcubeassociation.org/regulations/#article-4-scrambling" target="_blank" rel="noopener noreferrer">{t('WCA Regulation §4: Scrambling', 'WCA Regulation §4: Scrambling')}</a>
            {t(' — 比赛打乱标准的来源(各项目长度、随机转动 vs 随机状态的规定)。', ' — the source of competition scramble rules (per-event length, random-move vs random-state allowances).')}
          </li>
        </ul>
      </main>
    </div>
  );
}
