'use client';

import PageHeading from '@/components/PageHeading';
import Link from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import { useT } from '@/hooks/useT';
import '@/components/report-page.css';

export default function Scramble555AboutPage() {
  const t = useT();
  return <main className="report-page">
    <header className="report-header">
      <PageHeading backHref="/scramble/gen">{t('五阶打乱：两种方法', 'Two ways to scramble a 5×5')}</PageHeading>
      <p>{t('随机转动先选步骤，随机状态先选目标。日常练习可直接使用默认的随机转动。', 'Random moves start with a sequence; random states start with a target. The default random-move mode works for everyday practice.')}</p>
      <div className="report-links"><Link href="/scramble/gen">{t('打开打乱生成器', 'Open scramble generator')} →</Link></div>
    </header>

    <table className="report-table">
      <thead><tr><th scope="col">{t('区别', 'Difference')}</th><th scope="col">{t('随机转动 · 默认', 'Random moves · default')}</th><th scope="col">{t('随机状态', 'Random states')}</th></tr></thead>
      <tbody>
        <tr><th scope="row">{t('生成方式', 'Method')}</th><td>{t('直接生成转动序列', 'Generate a move sequence')}</td><td>{t('采样目标，再反转解法', 'Sample a target, then invert a solution')}</td></tr>
        <tr><th scope="row">{t('打乱长度', 'Length')}</th><td>{t('60 步', '60 moves')}</td><td>{t('通常约 70 步，不固定', 'Typically about 70 moves; varies')}</td></tr>
        <tr><th scope="row">{t('等待时间', 'Waiting')}</th><td>{t('浏览器本地生成，通常很快', 'Generated locally; usually quick')}</td><td>{t('服务器求解，通常需数秒', 'Server solve; usually several seconds')}</td></tr>
        <tr><th scope="row">{t('网络', 'Network')}</th><td>{t('加载后可本地生成', 'Local generation after loading')}</td><td>{t('需要联网', 'Connection required')}</td></tr>
        <tr><th scope="row">{t('适合', 'Useful for')}</th><td>{t('日常练习、模拟赛', 'Daily practice and mock events')}</td><td>{t('体验不同采样方式、研究', 'Exploring state sampling and research')}</td></tr>
      </tbody>
    </table>

    <h2>{t('差别与局限', 'What the difference does—and does not—mean')}</h2>
    <ul className="report-limits">
      <li>{t('随机转动不保证最终状态等概率；随机状态以均匀采样为目标，但不能据此推断练习成绩更真实或训练效果更好。', 'Random moves do not guarantee equally likely final states. Random-state generation aims for uniform sampling; that alone does not establish more representative times or better training.')}</li>
      <li>{t('随机状态服务失败时会回退到随机转动。用于统计研究前需确认实际来源；本页没有提供端到端均匀性认证。', 'Server failures fall back to random moves. Verify the actual source before using results for research; this page does not certify end-to-end uniformity.')}</li>
      <li>{t('正式 WCA 比赛必须使用现行官方打乱程序。本站两种模式都不能仅凭生成方法或步数视为获得认证。', 'Official WCA competitions require a current official scramble program. Neither mode here is certified merely by its method or move count.')} <a href="https://www.worldcubeassociation.org/regulations/#4b" target="_blank" rel="noopener noreferrer">WCA 4b</a></li>
    </ul>

    <details className="report-details"><MoreToggle as="summary">{t('采样、求解与回退机制', 'Sampling, solving and fallback')}</MoreToggle><div className="report-detail-body">
      <h3>{t('随机转动', 'Random moves')}</h3>
      <p>{t('浏览器调用 cubing.js 生成五阶转动序列。选择面、层宽和方向，并按生成器规则避免可直接合并的转动。固定长度不是均匀状态采样的证明，也不代表每条打乱都有相同难度。', 'The browser uses cubing.js to generate face, layer-width and direction choices, avoiding directly reducible turns under the generator’s rules. A fixed length proves neither uniform state sampling nor equal difficulty.')}</p>
      <h3>{t('随机状态', 'Random states')}</h3>
      <p>{t('服务器使用 cs0x7f 的 cube555：先采样合法状态，经过五阶段降阶与三阶求解，再将解法逆序、逐步取逆，得到到达目标的打乱。求解器不保证五阶全局最短解。', 'The server uses cs0x7f’s cube555: sample a legal state, reduce it through five phases, solve the remaining 3×3, then reverse and invert the solution. The solver does not guarantee a globally shortest 5×5 solution.')}</p>
      <p>{t('默认每次请求采样一个状态。服务配置若改为多个状态中选最短打乱，会改变采样分布；“随机状态”标签不能代替对实际配置的核查。', 'The default samples one state per request. Configuring the service to choose the shortest scramble from multiple states changes the distribution; the random-state label is not a substitute for checking the configuration.')}</p>
      <p>{t('常驻求解进程复用剪枝表；批量请求逐条返回结果，浏览器缓存后续打乱。网络、排队、冷启动和目标状态都会影响等待时间，失败时回退到本地随机转动。', 'A persistent solver reuses pruning tables. Batch requests stream results individually, and the browser caches upcoming scrambles. Network latency, queuing, startup and target states affect waiting time; failures fall back to local random moves.')}</p>
      <div className="report-links"><a href="https://github.com/cs0x7f/cube555" target="_blank" rel="noopener noreferrer">cube555</a><a href="https://github.com/cs0x7f/min2phase" target="_blank" rel="noopener noreferrer">min2phase</a><a href="https://www.cubing.net/cubing.js/" target="_blank" rel="noopener noreferrer">cubing.js</a></div>
    </div></details>

    <details className="report-details"><MoreToggle as="summary">{t('历史性能记录与测试条件', 'Previous performance results and conditions')}</MoreToggle><div className="report-detail-body">
      <p>{t('2026-05-18 的服务器记录中，20 次串行请求的中位耗时为 1.93–2.45 秒，批量和并发请求可能等待更久。测试期间配置和负载不同，不适合据此给引擎排名，也不代表当前服务速度。', 'In server tests recorded on May 18, 2026, median latency over 20 serial requests ranged from 1.93 to 2.45 seconds. Batch and concurrent requests could take longer. Configurations and server load differed, so these figures neither rank the engines nor describe current service speed.')}</p>
      <table className="report-table"><thead><tr><th scope="col">{t('同一用户操作的历史记录', 'Recorded user flow')}</th><th scope="col">{t('修复前', 'Before')}</th><th scope="col">{t('修复后', 'After')}</th></tr></thead><tbody>
        <tr><th scope="row">{t('冷启动生成 5 条', 'Generate 5 from cold')}</th><td className="report-number">17.6 s</td><td className="report-number">9.69 s</td></tr>
        <tr><th scope="row">{t('首条返回', 'First result')}</th><td className="report-number">4.7 s</td><td className="report-number">2.48 s</td></tr>
      </tbody></table>
      <p>{t('这是当时切换到随机状态后立即生成的端到端观测，不能推广为所有设备、网络和请求的固定提速比例。', 'This was an end-to-end observation immediately after switching to random-state mode, not a fixed speedup for every device, connection or request.')}</p>
      <div className="report-links"><a href="https://github.com/RuiminYan/cuberoot.me/blob/main/core/cube555-daemon/BENCHMARKS.md" target="_blank" rel="noopener noreferrer">{t('完整测试记录', 'Full benchmark records')}</a><Link href="/scramble/gen-about">{t('打乱生成说明', 'Scramble generator guide')}</Link></div>
    </div></details>
  </main>;
}
