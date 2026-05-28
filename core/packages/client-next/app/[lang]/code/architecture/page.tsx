'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { LangCtx, L } from '../_lib/Lang';
import type { Lang } from '../_lib/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import ArchNav from './_components/ArchNav';
import { SystemTopoSVG, PackageDepsSVG } from './_components/ArchSvgs';
import { LAYERS, PACKAGES, MODULES } from './_lib/arch-data';
import './architecture.css';

export default function ArchitecturePage() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';

  useDocumentTitle('站点架构', 'Site Architecture');

  return (
    <LangCtx.Provider value={lang}>
      <div className="arch-page">
        <ArchNav />

        <header className="arch-hero">
          <div className="arch-hero-meta">
            <L zh="一份内部说明书" en="An internal handbook" />
            <span className="arch-meta-sep">·</span>
            <span>2026.05</span>
          </div>
          <h1 className="arch-hero-title">
            <L zh="CubeRoot 是怎么搭起来的" en="How CubeRoot is built" />
          </h1>
          <p className="arch-hero-lede">
            <L
              zh={<>一个 24+ 工具页的魔方站, 同份 Next.js 16 代码两边跑 (自有 VM + Vercel edge, DNS 分线路)。后端是 Hono + PostgreSQL, WCA 统计有一条独立的周更管道。下面这页把每一层讲清楚 — 从一个鼠标点击, 到 DOM 更新, 中间发生了什么。</>}
              en={<>A cube-tools site with 24+ tool pages — one Next.js 16 codebase deployed two ways (self-hosted VM + Vercel edge, split-horizon DNS). Backend is Hono + PostgreSQL, and the WCA statistics pipeline runs separately on a weekly cadence. This page walks every layer — from a mouse click to a DOM update, and everything in between.</>}
            />
          </p>
          <div className="arch-hero-stats">
            <div className="arch-hs"><div className="arch-hs-v">5</div><div className="arch-hs-l"><L zh="monorepo 包" en="packages" /></div></div>
            <div className="arch-hs"><div className="arch-hs-v">14</div><div className="arch-hs-l"><L zh="模块" en="modules" /></div></div>
            <div className="arch-hs"><div className="arch-hs-v">80+</div><div className="arch-hs-l"><L zh="WCA 统计页" en="WCA stat pages" /></div></div>
            <div className="arch-hs"><div className="arch-hs-v">41</div><div className="arch-hs-l"><L zh="公式库" en="alg sets" /></div></div>
            <div className="arch-hs"><div className="arch-hs-v">1</div><div className="arch-hs-l"><L zh="台云服务器" en="cloud VM" /></div></div>
          </div>
        </header>

        {/* 01 System topology */}
        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">01</span>
            <h2 className="arch-sec-title"><L zh="一图看懂整个系统" en="The whole system in one picture" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<>一条线路一切都坐在一台自有 VM 上:nginx 反代 systemd Next standalone (:3002) + Hono API (:3001);Hono 通过本地 socket 打 PG。另一条线路走 Vercel edge, 同份 Next 代码; 拉的还是同一个 api.cuberoot.me。static.cuberoot.me 独立子域服 /tools /stats 给 Vercel function fallback 用。</>}
              en={<>One line: everything sits on one self-hosted VM — nginx reverse-proxies systemd Next standalone (:3002) + Hono API (:3001); Hono talks to PG over a local socket. The other line hits Vercel edge running the same Next code; the API call still resolves to api.cuberoot.me. static.cuberoot.me is a dedicated subdomain serving /tools and /stats for the Vercel function fallback.</>}
            />
          </p>
          <div className="arch-diagram">
            <SystemTopoSVG />
          </div>
          <div className="arch-layers">
            {LAYERS.map((l) => {
              const t = l[lang];
              return (
                <div key={l.num} className="arch-layer">
                  <div className="arch-layer-num">{l.num}</div>
                  <div className="arch-layer-name">{t.name}</div>
                  <div className="arch-layer-one">{t.one}</div>
                  <div className="arch-layer-tech">{t.tech}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 02 Packages */}
        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">02</span>
            <h2 className="arch-sec-title"><L zh="Monorepo:五个包" en="Monorepo: five packages" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<><code>core/</code> 是 pnpm + Turbo monorepo, 五个包各管一摊。CI 只跑改动到的包, 缓存 hit 时秒级出结果。</>}
              en={<><code>core/</code> is a pnpm + Turbo monorepo with five packages, each owning one slice. CI only re-runs packages that actually changed — cache hits make most builds sub-second.</>}
            />
          </p>
          <div className="arch-diagram">
            <PackageDepsSVG />
          </div>
          <div className="arch-pkgs">
            {PACKAGES.map((p) => {
              const t = p[lang];
              return (
                <article key={p.name} className="arch-pkg">
                  <header className="arch-pkg-head">
                    <span className="arch-pkg-name">@cuberoot/{p.name}</span>
                    <span className="arch-pkg-size">{p.size}</span>
                  </header>
                  <div className="arch-pkg-role">{t.role}</div>
                  <ul className="arch-pkg-bullets">
                    {t.bullet.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        {/* 03 Modules */}
        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">03</span>
            <h2 className="arch-sec-title"><L zh="14 个模块, 三种治理" en="14 modules, three flavors" /></h2>
          </div>
          <p className="arch-sec-lede">
            <L
              zh={<>不是所有路由都是我写的。<strong>own</strong> = 自己设计 + 实现;<strong>port</strong> = 把别人的 React / HTML 重写进本仓库;<strong>fork</strong> = upstream 静态资源原样托管。点卡片去看实际模块。</>}
              en={<>Not every route was built from scratch. <strong>own</strong> = designed and built here; <strong>port</strong> = someone else's React/HTML rewritten in-repo; <strong>fork</strong> = upstream assets hosted as-is. Click a card to visit the module.</>}
            />
          </p>
          <div className="arch-mod-legend">
            <span className="arch-tag arch-tag-own">own · 8</span>
            <span className="arch-tag arch-tag-port">port · 3</span>
            <span className="arch-tag arch-tag-fork">fork · 3</span>
          </div>
          <div className="arch-mods">
            {MODULES.map((m) => (
              <Link key={m.route} href={m.route} className={`arch-mod arch-mod-${m.origin}`}>
                <div className="arch-mod-top">
                  <span className="arch-mod-route">{m.route}</span>
                  <span className={`arch-tag arch-tag-${m.origin}`}>{m.origin}</span>
                </div>
                <div className="arch-mod-name">{lang === 'zh' ? m.zh : m.en}</div>
                <div className="arch-mod-desc">{lang === 'zh' ? m.zhDesc : m.enDesc}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* 04 Deploy hosts */}
        <section className="arch-sec">
          <div className="arch-sec-head">
            <span className="arch-sec-num">04</span>
            <h2 className="arch-sec-title"><L zh="部署:六个域名, DNS 分线路" en="Deploy: six hosts, split-horizon DNS" /></h2>
          </div>
          <table className="arch-tbl">
            <thead><tr>
              <th><L zh="域名" en="Host" /></th>
              <th><L zh="后面" en="Backed by" /></th>
              <th><L zh="作用" en="Role" /></th>
            </tr></thead>
            <tbody>
              <tr><td><code>cuberoot.me</code><br/><code>www.cuberoot.me</code></td><td><L zh="DNS 分线路 — 一条线路 → 自有 VM nginx → systemd Next standalone :3002;另一条线路 → Vercel Hobby edge (同份代码 push 即部署)" en="Split-horizon DNS — one line → self-hosted VM nginx → systemd Next standalone :3002; the other → Vercel Hobby edge (same code, push-to-deploy)" /></td><td><L zh="主站, Next.js 16 App Router" en="Primary site, Next.js 16 App Router" /></td></tr>
              <tr><td><code>api.cuberoot.me</code></td><td><L zh="同台云服务器 nginx 反代 :3001" en="Cloud VM nginx → :3001" /></td><td><L zh="Hono API + 24h proxy_cache" en="Hono API + 24h proxy_cache" /></td></tr>
              <tr><td><code>next.cuberoot.me</code></td><td><L zh="同 systemd cuberoot-next :3002 (别名)" en="Same systemd cuberoot-next :3002 (alias)" /></td><td><L zh="Staging 别名 / 直连 self-hosted Next 不绕 DNS" en="Staging alias / direct to self-hosted Next, bypassing DNS routing" /></td></tr>
              <tr><td><code>static.cuberoot.me</code></td><td><L zh="同台 nginx 独立 vhost,仅服 /tools/ + /stats/ (CORS:*)" en="Same nginx, dedicated vhost serving only /tools/ + /stats/ (CORS:*)" /></td><td><L zh="给 Vercel function fallback 拉静态资源" en="Static-asset origin for Vercel function fallback" /></td></tr>
              <tr><td><code>cuberoot.me/blog/</code><br/><code>blog.cuberoot.me</code></td><td><L zh="双轨 DNS 分线路:同台 nginx alias / GH Pages" en="Dual via split-horizon DNS: same-VM nginx alias / GH Pages" /></td><td><L zh="WordPress 静态归档 (2026-05 phase 2 freeze)" en="WordPress static archive (frozen 2026-05)" /></td></tr>
            </tbody>
          </table>
        </section>

        <footer className="arch-foot">
          <div className="arch-foot-line">
            <L zh="源码" en="Source" />
            <span className="arch-meta-sep">·</span>
            <a href="https://github.com/RuiminYan/cuberoot.me" target="_blank" rel="noreferrer">
              github.com/RuiminYan/cuberoot.me
            </a>
            <span className="arch-meta-sep">·</span>
            <Link href="/code">/code</Link>
          </div>
          <p className="arch-foot-note">
            <L
              zh={<>这页是 CubeRoot 的内部说明书。改任何模块前, 先看一眼这里;改完了, 再看一眼这里。</>}
              en={<>This is CubeRoot's internal handbook. Read it before touching any module; read it again after.</>}
            />
          </p>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
