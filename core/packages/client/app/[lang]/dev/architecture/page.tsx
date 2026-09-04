'use client';

import Link from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import { useTranslation } from 'react-i18next';
import { LangCtx, L } from '../_lib/Lang';
import type { Lang } from '../_lib/Lang';
import ArchitectureAtlas from './_components/ArchitectureAtlas';
import ArchNav from './_components/ArchNav';
import { BORROWED_MODULES } from './_lib/arch-data';
import './architecture.css';

export default function ArchitecturePage() {
  const { i18n } = useTranslation();
  const lang: Lang = (['en', 'zh'] as const)[Number(i18n.language.startsWith('zh'))];

  return (
    <LangCtx.Provider value={lang}>
      <div className="arch-page">
        <ArchNav />

        <header className="arch-hero">
          <div className="arch-hero-meta"><L zh="可交互的系统地图" en="Interactive system map" /></div>
          <h1 className="arch-hero-title"><L zh="CubeRoot 架构地图" en="CubeRoot Architecture Atlas" /></h1>
          <p className="arch-hero-lede">
            <L
              zh="点击任一节点，就能看到它在系统里的职责、源码位置和相关术语。地图只记录稳定边界，不记录容易过期的版本号和规模数字。"
              en="Select any node to see its responsibility, source location, and related terms. The map records stable boundaries, not fast-expiring versions or scale figures."
            />
          </p>
        </header>

        <section className="arch-sec arch-sec--wide">
          <div className="arch-sec-head">
            <span className="arch-sec-num">01</span>
            <h2 className="arch-sec-title"><L zh="从入口到数据" en="From entry to data" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh="实线表示在线请求，虚线表示共享能力，点线表示离线任务生成的数据。点击节点可沿着关系查看上下游。"
              en="Solid lines are live requests, dashed lines are shared capabilities, and dotted lines are artifacts from offline jobs. Select a node to trace its neighbors."
            />
          </p>
          <ArchitectureAtlas lang={lang} />
        </section>

        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">02</span>
            <h2 className="arch-sec-title"><L zh="借来的代码如何管理" en="How borrowed code is governed" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh="port 是把上游能力改写进本站产品，fork 是保留上游实现并在固定边界托管。自研页面不在这里重复列举。"
              en="A port rewrites an upstream capability into the product; a fork keeps the upstream implementation behind a fixed boundary. First-party pages are not repeated here."
            />
          </p>
          <div className="arch-mod-legend">
            <span className="arch-tag arch-tag-port">port</span>
            <span className="arch-tag arch-tag-fork">fork</span>
          </div>
          <table className="arch-tbl">
            <thead><tr>
              <th><L zh="模块" en="Module" /></th>
              <th><L zh="类型" en="Type" /></th>
              <th><L zh="上游" en="Upstream" /></th>
            </tr></thead>
            <tbody>
              {BORROWED_MODULES.map((module) => (
                <tr key={module.route}>
                  <td>
                    <Link href={module.route} className="arch-mod-link" prefetch={false}>{module.route}</Link>
                    <span className="arch-mod-cn">{tr(module)}</span>
                  </td>
                  <td><span className={`arch-tag arch-tag-${module.origin}`}>{module.origin}</span></td>
                  <td><a href={`https://github.com/${module.upstream}`} target="_blank" rel="noreferrer" className="arch-up-link">{module.upstream}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">03</span>
            <h2 className="arch-sec-title"><L zh="怎么防止地图失效" en="How the map stays current" /></h2>
          </div>
          <ol className="architecture-guardrails">
            <li><strong><L zh="只维护一份" en="One source" /></strong><span><L zh="节点、连线、术语和源码位置来自同一份结构数据。" en="Nodes, edges, terms, and source paths come from one data structure." /></span></li>
            <li><strong><L zh="目录变化就报错" en="Directory drift fails" /></strong><span><L zh="测试会对照真实 apps、packages 和 jobs，新增、移动或删除模块时必须同步地图。" en="A test compares real apps, packages, and jobs, so adding, moving, or deleting a unit requires updating the map." /></span></li>
            <li><strong><L zh="不写易变数字" en="No volatile figures" /></strong><span><L zh="版本、耗时、文件大小和页面数量不属于这张稳定地图。" en="Versions, timings, file sizes, and page counts do not belong in this stable map." /></span></li>
          </ol>
        </section>

        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">04</span>
            <h2 className="arch-sec-title"><L zh="开发环境：一份服务，多端热更新" en="Development: one server, live updates across devices" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<>开发时只运行一份 Next 开发服务。本机直接访问 <code>127.0.0.1:3000</code>；手机和外网设备通过 <code>dev.cuberoot.me</code> 进入 TLS 反向代理，再由 frp 隧道连接到同一份本机服务。HMR 使用 WSS，这条仅供开发的链路不参与生产拓扑，也不缓存响应。</>}
              en={<>Development runs a single Next development server. The local machine opens <code>127.0.0.1:3000</code> directly; phones and off-network devices enter through the TLS reverse proxy at <code>dev.cuberoot.me</code>, then an frp tunnel reaches the same local server. HMR uses WSS, and this development-only path is outside the production topology with caching disabled.</>}
            />
          </p>
          <table className="arch-tbl">
            <thead><tr>
              <th><L zh="场景" en="Scenario" /></th>
              <th><L zh="入口" en="Entry" /></th>
              <th><L zh="链路" en="Path" /></th>
            </tr></thead>
            <tbody>
              <tr>
                <td><L zh="本机开发" en="Local development" /></td>
                <td><code>127.0.0.1:3000</code></td>
                <td><L zh="直接连接 Next 开发服务" en="Direct connection to the Next development server" /></td>
              </tr>
              <tr>
                <td><L zh="手机或外网" en="Phone or off-network" /></td>
                <td><code>dev.cuberoot.me</code></td>
                <td><L zh="TLS 反向代理 → frp 隧道 → 本机 :3000，HMR over WSS" en="TLS reverse proxy → frp tunnel → local :3000, HMR over WSS" /></td>
              </tr>
            </tbody>
          </table>
        </section>

        <footer className="arch-foot">
          <div className="arch-foot-line">
            <L zh="继续了解" en="Keep exploring" />
            <span className="arch-meta-sep">/</span>
            <Link href="/dev/architecture/flow"><L zh="请求流程" en="Request flow" /></Link>
            <span className="arch-meta-sep">/</span>
            <Link href="/dev/architecture/decisions"><L zh="技术决策" en="Technical decisions" /></Link>
            <span className="arch-meta-sep">/</span>
            <Link href="/dev/infrastructure"><L zh="基础设施" en="Infrastructure" /></Link>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
