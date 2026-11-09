'use client';

import PageHeading from '@/components/PageHeading';
import Link from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import { useT } from '@/hooks/useT';
import '@/components/report-page.css';

export default function GenAboutPage() {
  const t = useT();
  return <main className="report-page">
    <header className="report-header">
      <PageHeading backHref="/scramble/gen">{t('打乱生成说明', 'Scramble generator guide')}</PageHeading>
      <p>{t('日常练习、模拟比赛，或把已有打乱做成带图的表格。', 'Generate practice sets, prepare a mock competition, or illustrate scrambles you already have.')}</p>
      <div className="report-links"><Link href="/scramble/gen">{t('打开打乱生成器', 'Open scramble generator')} →</Link></div>
    </header>

    <h2>{t('选哪种模式', 'Choose a mode')}</h2>
    <table className="report-table">
      <thead><tr><th scope="col">{t('模式', 'Mode')}</th><th scope="col">{t('适合做什么', 'Use it for')}</th><th scope="col">{t('准备什么', 'What to provide')}</th></tr></thead>
      <tbody>
        <tr><th scope="row"><Link href="/scramble/gen?mode=comp">{t('比赛', 'Competition')}</Link></th><td>{t('团练、周赛、多轮模拟赛', 'Club sessions and mock competitions')}</td><td>{t('项目、轮次、组数和打印份数', 'Events, rounds, groups and copies')}</td></tr>
        <tr><th scope="row"><Link href="/scramble/gen?mode=batch">{t('批量', 'Batch')}</Link></th><td>{t('一次生成一组练习打乱', 'A set of practice scrambles')}</td><td>{t('项目与数量（1–1000）', 'Events and count (1–1000)')}</td></tr>
        <tr><th scope="row"><Link href="/scramble/gen?mode=paste">{t('输入', 'Paste')}</Link></th><td>{t('给已有打乱配图、排版', 'Illustrate existing scrambles')}</td><td>{t('对应项目，每行一条打乱', 'Puzzle and one scramble per line')}</td></tr>
      </tbody>
    </table>
    <p>{t('三种模式都支持预览、复制和导出 PDF。比赛模式还可读取 WCA 已公布的历史打乱。', 'All three modes support previews, copying and PDF export. Competition mode can also load scrambles published by the WCA.')}</p>

    <h2>{t('使用前了解', 'Before you start')}</h2>
    <ul className="report-limits">
      <li>{t('这里的比赛模式用于模拟赛和排版，不代表 WCA 官方认证。正式比赛须使用现行官方打乱程序。', 'Competition mode is for mock events and sheet layout, not WCA certification. Official competitions require a current official scramble program.')} <a href="https://www.worldcubeassociation.org/regulations/#4b" target="_blank" rel="noopener noreferrer">WCA 4b</a></li>
      <li>{t('首次加载、生成数量和设备速度都会影响等待时间。后台预生成可以减少等待，但不保证即时完成。', 'First load, batch size and device speed affect waiting time. Background generation helps, but does not guarantee instant results.')}</li>
      <li>{t('五阶默认随机转动；随机状态模式需要网络，失败时会回退到随机转动。', '5×5 defaults to random moves. Random-state mode needs a network connection and falls back to random moves on failure.')} <Link href="/scramble/555-about">{t('两种方法的差别', 'Compare the two methods')}</Link></li>
    </ul>

    <details className="report-details"><MoreToggle as="summary">{t('生成方式与引擎来源', 'Generation methods and engine sources')}</MoreToggle><div className="report-detail-body">
      <p>{t('随机状态先选目标状态，再求出到达它的打乱；随机转动直接生成一串转动。不同项目使用不同方法，不能把所有打乱都称为均匀随机状态。', 'Random-state generation chooses a target state and finds a scramble reaching it. Random-move generation builds a sequence directly. Methods vary by puzzle; not all scrambles sample states uniformly.')}</p>
      <table className="report-table"><thead><tr><th scope="col">{t('项目', 'Puzzle')}</th><th scope="col">{t('实现', 'Implementation')}</th></tr></thead><tbody>
        <tr><th scope="row">3×3</th><td>{t('cubing.js，或可选的 min2phase-rust；在浏览器内生成。', 'cubing.js or optional min2phase-rust; generated in the browser.')}</td></tr>
        <tr><th scope="row">4×4</th><td>{t('cs0x7f Threephase，在浏览器后台线程中求解随机状态。', 'cs0x7f Threephase solves random states in browser workers.')}</td></tr>
        <tr><th scope="row">5×5</th><td>{t('默认 cubing.js 随机转动；可切换到服务器 cube555 随机状态。', 'cubing.js random moves by default; optional server-side cube555 random states.')}</td></tr>
        <tr><th scope="row">6×6 / 7×7</th><td>{t('cubing.js 随机转动。', 'cubing.js random moves.')}</td></tr>
        <tr><th scope="row">{t('其他项目', 'Other puzzles')}</th><td>{t('使用 cubing.js、csTimer 或项目专用生成器；部分异形复用其基础魔方的打乱和展开图。', 'cubing.js, csTimer or puzzle-specific generators. Some shape mods reuse their base puzzle’s scrambles and net diagrams.')}</td></tr>
      </tbody></table>
      <div className="report-links"><a href="https://www.cubing.net/cubing.js/" target="_blank" rel="noopener noreferrer">cubing.js</a><a href="https://github.com/cs0x7f/cstimer" target="_blank" rel="noopener noreferrer">csTimer</a><a href="https://github.com/RuiminYan/min2phase-rust" target="_blank" rel="noopener noreferrer">min2phase-rust</a></div>
    </div></details>

    <details className="report-details"><MoreToggle as="summary">{t('预生成与三阶历史测试', 'Background generation and previous 3×3 tests')}</MoreToggle><div className="report-detail-body">
      <p>{t('页面会在后台准备引擎并缓存打乱。比赛模式按配置补充缓存，点击生成时优先取出已有结果；不足的部分继续生成。切换引擎会清理对应缓存。', 'The page prepares engines and caches scrambles in the background. Competition mode fills the cache to match the configuration; Generate uses cached results first and generates the remainder. Switching engines clears the relevant cache.')}</p>
      <h3>{t('历史记录：同机、同标签页，预热后各 100 条', 'Previous test: same machine and tab, 100 scrambles each after warm-up')}</h3>
      <p>{t('以下保留原页面的测试记录。缺少设备型号、版本和完整原始样本，不能当作当前性能承诺；冷启动行是单独观测，不属于预热后的 100 条。', 'These figures are retained from the previous page. Device details, versions and full raw samples are unavailable, so they are not a current performance guarantee. Cold-start figures are separate observations, outside the 100 warmed-up samples.')}</p>
      <div className="report-table-scroll"><table className="report-table">
            <thead>
              <tr>
                <th>{t('指标', 'Metric')}</th>
                <th>cubing.js</th>
                <th>min2phase-rust</th>
                <th>{t('m2p 倍速', 'm2p speedup')}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>{t('平均', 'avg')}</td><td>20.61 ms</td><td>1.44 ms</td><td>14.3×</td></tr>
              <tr><td>p50</td><td>12.42 ms</td><td>1.21 ms</td><td>10.3×</td></tr>
              <tr><td>p95</td><td>60.01 ms</td><td>3.49 ms</td><td>17.2×</td></tr>
              <tr><td>max</td><td>250.63 ms</td><td>18.23 ms</td><td>13.7×</td></tr>
              <tr><td>{t('平均长度', 'avg length')}</td><td>20.49</td><td>20.53</td><td>{t('~ 同', '~ same')}</td></tr>
              <tr><td>{t('首次冷启', 'cold start')}</td><td>{t('~3 s(prewarm 后 ~30 ms)', '~3 s (with prewarm ~30 ms)')}</td><td>{t('~120 ms(含 WASM fetch)', '~120 ms (incl. WASM fetch)')}</td><td>—</td></tr>
            </tbody>
          </table></div>
      <p>{t('这组样本的平均长度接近，不足以证明两种实现的完整分布等价。', 'Similar mean lengths in this sample do not prove that the full distributions are equivalent.')}</p>
    </div></details>
  </main>;
}
