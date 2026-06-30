'use client';

// WCA REST API (robiningelbrecht/wca-rest-api) 参考页 — 给开发者 / AI 速查这个
// 非官方 WCA 公共 API：端点、响应形状、值编码,以及它跟 CubeRoot 的关系。
// 事实据 v1 分支静态 JSON 实测 (raw.githubusercontent.com/.../v1/*) + 仓库 README。
// 复用 /code/wcif 的文档样式 (.wcif-*) + 本页自有 .api-* 视觉块。

import { Fragment } from 'react';
import HomeLink from '@/components/HomeLink';
import AppLink from '@/components/AppLink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import '../wcif/wcif.css';
import './wca_rest_api.css';

const BASE = 'https://wca-rest-api.robiningelbrecht.be';

function Row({ k, type, children }: { k: string; type: string; children: React.ReactNode }) {
  return (
    <tr>
      <td className="wcif-field-k"><code>{k}</code></td>
      <td className="wcif-field-t"><code>{type}</code></td>
      <td className="wcif-field-d">{children}</td>
    </tr>
  );
}

function Table({ head, children }: { head: [string, string]; children: React.ReactNode }) {
  return (
    <div className="wcif-table-wrap">
      <table className="wcif-table">
        <thead>
          <tr>
            <th>{head[0]}</th>
            <th>{head[1]}</th>
            <th>{tr({ zh: '说明', en: 'Description' })}</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const FLOW: { glyph: string; out?: boolean; zh: [string, string]; en: [string, string] }[] = [
  { glyph: '⛁', zh: ['WCA 官方导出', '每天发布的完整结果数据库 (SQL)'], en: ['WCA export', 'Full results DB published daily (SQL)'] },
  { glyph: '↻', zh: ['每日构建', 'GitHub Actions 跑 PHP 导入 + 生成,约 77 分钟'], en: ['Daily build', 'GitHub Actions: PHP import + generate, ~77 min'] },
  { glyph: '{ }', zh: ['静态 JSON', '每个实体烘焙成一个 .json 文件'], en: ['Static JSON', 'One .json file baked per entity'] },
  { glyph: '◍', out: true, zh: ['GitHub Pages', '通过 CDN 分发,CORS 开放'], en: ['GitHub Pages', 'Served over CDN, CORS open'] },
  { glyph: '⤓', out: true, zh: ['你的 fetch', 'curl / fetch 直接拿,无需鉴权'], en: ['Your fetch', 'Plain curl / fetch, no auth'] },
];

const EPS: { glyph: string; name: string; path: string; zh: string; en: string }[] = [
  { glyph: 'P', name: 'persons/{wcaId}', path: '/persons/2009ZEMD01.json', zh: '单个选手:成绩、PB、纪录、奖牌', en: 'One competitor: results, PBs, records, medals' },
  { glyph: 'P', name: 'persons (index)', path: '/persons-page-{n}.json', zh: '全部选手,每页 1000', en: 'All competitors, 1000 per page' },
  { glyph: 'C', name: 'competitions/{id}', path: '/competitions/WC2023.json', zh: '单场比赛:日期、场馆、项目、代表', en: 'One competition: date, venue, events, delegates' },
  { glyph: 'C', name: 'competitions (index)', path: '/competitions-page-{n}.json', zh: '全部比赛,total 18,035', en: 'All competitions, total 18,035' },
  { glyph: '★', name: 'championships', path: '/championships-page-{n}.json', zh: '锦标赛专场,total 894', en: 'Championship comps, total 894' },
  { glyph: '≣', name: 'rank/{region}/…', path: '/rank/CN/single/333.json', zh: '某地区某项目的单次 / 平均排名', en: 'Single / average ranking by region + event' },
  { glyph: '⊞', name: 'results/{compId}', path: '/results/WC2023.json', zh: '某场比赛的全部成绩行', en: 'Every result row for one competition' },
  { glyph: 'E', name: 'events', path: '/events.json', zh: '21 个项目 + 计分格式', en: 'All 21 events + scoring format' },
  { glyph: '◯', name: 'countries / continents', path: '/countries.json', zh: '国家 (ISO2) 与大洲查找表', en: 'Country (ISO2) + continent lookups' },
  { glyph: 'v', name: 'version', path: '/version.json', zh: '数据版本 + 上游导出链接', en: 'Data version + upstream export links' },
];

export default function WcaRestApiPage() {
  useDocumentTitle('WCA REST API', 'WCA REST API');

  return (
    <div className="wcif-page wcif-page-wide api-accent">
      <div className="wcif-topbar">
        <HomeLink className="wcif-back">← {tr({ zh: '回首页', en: 'Home' })}</HomeLink>
        <AppLink href="/code" className="wcif-back">/code</AppLink>
        <AppLink href="/code/wca-export" className="wcif-back">WST Export</AppLink>
        <AppLink href="/code/wcif" className="wcif-back">WCIF</AppLink>
      </div>

      <header className="wcif-hero">
        <div className="wcif-hero-route">/code/wca-rest-api</div>
        <h1 className="wcif-hero-title">WCA REST API</h1>
        <p className="wcif-hero-sub">{tr({ zh: '非官方 WCA 公共 API · Robin Ingelbrecht', en: 'Unofficial WCA Public API · by Robin Ingelbrecht' })}</p>
        <p className="wcif-hero-tagline">
          {tr({
            zh: '一个把 WCA 官方结果导出「预烘焙」成只读静态 JSON 的非官方 REST API。每个选手、每场比赛、每条排名都是 GitHub 上一个 .json 文件,通过 CDN 分发,无需数据库、无需鉴权、无需服务端。想拿 WCA 数据又不想自己架 MySQL 跑导出管道时,这是最省事的一条路。本页给人也给 AI:端点全集、真实响应、值编码,以及它跟 CubeRoot 的关系。',
            en: 'An unofficial REST API that "pre-bakes" the official WCA results export into read-only static JSON. Every competitor, competition and ranking is a single .json file on GitHub, served over a CDN — no database, no auth, no server. When you want WCA data without standing up MySQL and an export pipeline, this is the path of least resistance. This page is for humans and AI alike: the full endpoint set, real responses, value encoding, and how it relates to CubeRoot.',
          })}
        </p>
        <div className="wcif-hero-meta">
          <span>{tr({ zh: '静态 JSON · 每日更新 · MIT', en: 'Static JSON · daily · MIT' })}</span>
          <span className="wcif-meta-sep">·</span>
          <a href={BASE} target="_blank" rel="noopener noreferrer">{tr({ zh: '官方文档', en: 'Docs' })} ↗</a>
          <span className="wcif-meta-sep">·</span>
          <a href="https://github.com/robiningelbrecht/wca-rest-api" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
        </div>
      </header>

      {/* ── 它是什么 / 数据怎么来的 ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: '它是什么', en: 'What it is' })}</h2>
        <p>
          {tr({
            zh: '官方只发一份每日更新的数据库快照 (见 WST Export),你得自己下、自己导、自己查。这个项目替你把那一步做了:每天用 GitHub Actions 把官方 SQL 导出导进数据库,再为每个实体生成一个静态 JSON 文件,推到 GitHub Pages 上当 API 用。作者明确声明与官方 WST 团队无关。它是只读的,没有写接口、没有服务端查询 —— 一切都是预先算好的文件。',
            en: 'The WCA only publishes a daily database snapshot (see WST Export) — you download, import and query it yourself. This project does that step for you: every day a GitHub Action imports the official SQL export into a database, then generates one static JSON file per entity and pushes them to GitHub Pages to serve as an API. The author explicitly states it is not affiliated with the official WST team. It is read-only: no write endpoints, no server-side querying — everything is a pre-computed file.',
          })}
        </p>
        <div className="api-flow" aria-hidden="true">
          {FLOW.map((s, i) => (
            <Fragment key={i}>
              <div className={`api-flow-step${s.out ? ' is-out' : ''}`}>
                <span className="api-flow-glyph">{s.glyph}</span>
                <span className="api-flow-t">{tr({ zh: s.zh[0], en: s.en[0] })}</span>
                <span className="api-flow-d">{tr({ zh: s.zh[1], en: s.en[1] })}</span>
              </div>
              {i < FLOW.length - 1 && <span className="api-flow-arrow">→</span>}
            </Fragment>
          ))}
        </div>
        <p className="wcif-note">
          {tr({
            zh: '作者选静态文件的三条理由,直接写在 README 里:数据一天最多变一次、静态文件够快、不想为托管付费(一旦付费很容易失控)。代价是结构有限制 —— 没有任意查询,分页靠拆成多个文件。',
            en: 'The author lists three reasons for static files right in the README: the data changes at most once a day, static files are (or should be) fast, and they do not want to pay for hosting (which can get expensive fast). The trade-off is a constrained shape — no arbitrary queries, pagination done by splitting into multiple files.',
          })}
        </p>
      </section>

      {/* ── 30 秒上手 ── */}
      <section className="wcif-section wcif-section-accent">
        <h2>{tr({ zh: '30 秒上手', en: 'Quick start' })}</h2>
        <p>
          {tr({ zh: '基址 ', en: 'Base ' })}
          <span className="api-get">GET</span>{' '}
          <span className="api-base">{BASE}</span>
          {tr({ zh: ' —— 全部是 GET,拼上路径直接拿 JSON。', en: ' — everything is a GET; append a path and you get JSON.' })}
        </p>
        <pre className="wcif-code"><code>{`# 单个选手 (Feliks Zemdegs) / one competitor
curl ${BASE}/persons/2009ZEMD01.json

# 单场比赛 (2023 世锦赛) / one competition
curl ${BASE}/competitions/WC2023.json

# 中国 3x3 单次排名 / China 3x3 single ranking
curl ${BASE}/rank/CN/single/333.json

# 某场比赛全部成绩 / every result at a competition
curl ${BASE}/results/WC2023.json

# 21 个项目 + 数据版本 / events + data version
curl ${BASE}/events.json
curl ${BASE}/version.json`}</code></pre>
        <p className="wcif-note">
          {tr({
            zh: '没有 API key、没有速率限制,浏览器可直接 fetch(CORS 开放)。先打 version.json 的 export_date 就能判断数据新不新。',
            en: 'No API key, no rate limit, and browsers can fetch it directly (CORS is open). Hit version.json first and read export_date to tell how fresh the data is.',
          })}
        </p>
      </section>

      {/* ── 端点总览 ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: '端点总览', en: 'Endpoints at a glance' })}</h2>
        <p>
          {tr({
            zh: '九类资源,路径即文件。{wcaId} 用 WCA ID (如 2009ZEMD01),{id} 用比赛 ID (如 WC2023),{eventId} 用项目 ID (如 333 / 333bf / minx)。',
            en: 'Nine resource kinds; the path is the file. {wcaId} is a WCA ID (e.g. 2009ZEMD01), {id} is a competition ID (e.g. WC2023), {eventId} is an event id (e.g. 333 / 333bf / minx).',
          })}
        </p>
        <div className="api-ep-grid">
          {EPS.map((e) => (
            <div key={e.name} className="api-ep">
              <div className="api-ep-top">
                <span className="api-ep-glyph">{e.glyph}</span>
                <span className="api-ep-name">{e.name}</span>
              </div>
              <div className="api-ep-path">{e.path}</div>
              <div className="api-ep-d">{tr({ zh: e.zh, en: e.en })}</div>
            </div>
          ))}
        </div>
        <p className="wcif-note">
          {tr({
            zh: 'rank 的 {region} 三选一:world、大洲 slug(africa / asia / europe / north-america / oceania / south-america)、或国家 ISO2(CN / US / JP …);再接 single 或 average,再接项目。集合端点(persons / competitions / championships)同时提供「全量单文件」和「-page-N 分页文件」两种。',
            en: 'rank {region} is one of: world, a continent slug (africa / asia / europe / north-america / oceania / south-america), or a country ISO2 (CN / US / JP …); then single or average, then the event. Collection endpoints (persons / competitions / championships) come both as one full file and as -page-N paginated files.',
          })}
        </p>
      </section>

      {/* ── 响应形状 ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: '响应形状(真实示例)', en: 'Response shapes (real samples)' })}</h2>

        <h3>persons/{'{wcaId}'}.json</h3>
        <pre className="wcif-code"><code>{`{
  "id": "2009ZEMD01",
  "name": "Feliks Zemdegs",
  "slug": "feliks-zemdegs",
  "country": "AU",
  "numberOfCompetitions": 176,
  "competitionIds": ["...", "..."],
  "championshipIds": ["AsianChampionship2010", "..."],
  "medals":  { "gold": 804, "silver": 171, "bronze": 84 },
  "records": { "single":  { "WR": 54, "CR": 108, "NR": 4 },
               "average": { "WR": 67, "CR": 120, "NR": 3 } },
  "rank": {
    "singles":  [ { "eventId": "333", "best": 412,
                    "rank": { "world": 47, "continent": 4, "country": 4 } }, ... ],
    "averages": [ ... ]
  },
  "results": {
    "<competitionId>": {
      "<eventId>": [ { "round": "Final", "position": 1,
                       "best": 530, "average": 697, "format": "Average of 5",
                       "solves": [844, 559, 530, 723, 809] } ]
    }
  }
}`}</code></pre>

        <h3>competitions/{'{id}'}.json</h3>
        <pre className="wcif-code"><code>{`{
  "id": "WC2023",
  "name": "Rubik's WCA World Championship 2023",
  "city": "인천광역시 (Incheon)",
  "country": "KR",
  "date": { "from": "2023-08-12", "till": "2023-08-15" },
  "isCanceled": false,
  "venue": { "name": "송도컨벤시아 (Songdo ConvensiA)",
             "address": "...", "details": "...",
             "coordinates": { "latitude": 37.388986, "longitude": 126.645696 } },
  "events": ["222", "333", "333bf", ...],
  "championshipIds": null,
  "wcaDelegates": [ { "name": "...", "email": "..." } ],
  "organisers":   [ { "name": "...", "email": "..." } ],
  "externalWebsite": null,
  "information": "..."
}`}</code></pre>

        <h3>rank/{'{region}'}/{'{single|average}'}/{'{eventId}'}.json &nbsp;·&nbsp; results/{'{compId}'}.json</h3>
        <pre className="wcif-code"><code>{`// rank/CN/single/333.json
{ "items": [ { "rankType": "single", "personId": "2023GENG02", "eventId": "333",
               "best": 280, "rank": { "world": 2, "continent": 1, "country": 1 } }, ... ],
  "pagination": { "page": 1, "size": 1000 }, "total": 12345 }

// results/WC2023.json
{ "items": [ { "competitionId": "WC2023", "personId": "2012PARK03", "eventId": "333",
               "round": "Final", "position": 1, "best": 454, "average": 531,
               "format": "Average of 5", "solves": [504, 542, 569, 454, 548] }, ... ],
  "pagination": { "page": 1, "size": 7952 }, "total": 7952 }`}</code></pre>
        <p className="wcif-note">
          {tr({
            zh: '集合 / 排名 / 成绩端点统一是 { items, pagination, total } 信封;单实体端点(persons/competitions 的 {id})是裸对象。events / countries / continents 是 { items: [...] }。',
            en: 'Collection / ranking / result endpoints share an { items, pagination, total } envelope; single-entity endpoints (the {id} files for persons/competitions) are bare objects. events / countries / continents are { items: [...] }.',
          })}
        </p>
      </section>

      {/* ── 值编码 ── */}
      <section className="wcif-section wcif-section-accent">
        <h2>{tr({ zh: '值编码(同 WCA 官方)', en: 'Value encoding (same as official WCA)' })}</h2>
        <Table head={[tr({ zh: '字段', en: 'Field' }), tr({ zh: '编码', en: 'Encoding' })]}>
          <Row k="best / average / solves[]" type="int">{tr({ zh: '计时项为厘秒:8653 = 1 分 26.53 秒', en: 'Timed events in centiseconds: 8653 = 1 min 26.53 s' })}</Row>
          <Row k="333fm (最少步)" type="int">{tr({ zh: '步数;平均存为 100 倍后四舍五入(2533 = 25.33 步均)', en: 'Move count; averages stored as 100× rounded (2533 = 25.33 avg)' })}</Row>
          <Row k="333mbf / 333mbo (多盲)" type="packed">{tr({ zh: '打包十进制,同时编进 解出 / 尝试 / 用时;越小越好', en: 'Packed decimal encoding solved / attempted / time at once; smaller is better' })}</Row>
          <Row k="-1 / -2 / 0" type="sentinel">{tr({ zh: '-1 = DNF(没还原),-2 = DNS(没开始),0 = 无成绩(如 bo3 的 average)', en: '-1 = DNF, -2 = DNS, 0 = no result (e.g. the average of a best-of-3 round)' })}</Row>
        </Table>
        <p className="wcif-note">
          {tr({
            zh: '编码跟官方导出逐字一致 —— CubeRoot 站内的 formatWcaResult() 能直接格式化这些值,无需另写解码。多盲打包规则细节见 WST Export 与官方第九章。',
            en: 'The encoding is byte-identical to the official export — CubeRoot’s own formatWcaResult() formats these values directly, no separate decoder needed. The multi-blind packing rules are detailed in WST Export and official Article 9.',
          })}
        </p>
      </section>

      {/* ── 限制与坑 ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: '限制与坑', en: 'Limits & gotchas' })}</h2>
        <ul className="wcif-list">
          <li><strong>{tr({ zh: '没有服务端查询', en: 'No server-side query' })}</strong> — {tr({ zh: '不能按条件筛 / 排序 / 联表。要过滤得自己把整页拉下来再在本地过。', en: 'no filtering, sorting or joining by parameter. To filter, download the page and filter locally.' })}</li>
          <li><strong>{tr({ zh: '每日快照,非实时', en: 'Daily snapshot, not live' })}</strong> — {tr({ zh: '跟着 WCA 上游一天更一次;进行中 / 未来的比赛实时成绩它没有。', en: 'tracks WCA upstream once a day; it has no live results for in-progress or upcoming competitions.' })}</li>
          <li><strong>{tr({ zh: '分页是文件不是参数', en: 'Pagination is files, not params' })}</strong> — {tr({ zh: 'persons / competitions / championships 拆成 -page-1.json … -page-N.json(每页 1000)。', en: 'persons / competitions / championships split into -page-1.json … -page-N.json (1000 each).' })}</li>
          <li><strong>{tr({ zh: '排名按地区 × 项目切片', en: 'Ranks sliced by region × event' })}</strong> — {tr({ zh: '想要「世界 3x3 单次榜」就直接定位 rank/world/single/333.json,不存在「一次拿所有榜」。', en: 'for the world 3x3 single board, go straight to rank/world/single/333.json — there is no "all boards at once".' })}</li>
          <li><strong>{tr({ zh: '善待 GitHub Pages', en: 'Be kind to GitHub Pages' })}</strong> — {tr({ zh: '没鉴权 / 没限流,但它跑在 Pages 上,别脚本暴力遍历 19 万个选手文件;要全量分析直接用官方导出更合适。', en: 'no auth or rate limit, but it runs on Pages — do not brute-force all ~199k person files; for full-dataset analysis, use the official export instead.' })}</li>
        </ul>
      </section>

      {/* ── 跟 CubeRoot 的关系(用户重点) ── */}
      <section className="wcif-section wcif-section-accent">
        <h2>{tr({ zh: '它跟 CubeRoot 的关系', en: 'How it relates to CubeRoot' })}</h2>
        <p>
          {tr({
            zh: '说清楚一点:CubeRoot 在运行时并不调用这个 API。本站所有 WCA 数据走的是自建管道 —— 直接下 WCA 官方 Developer 导出(MySQL dump),本地导入,再用 stats-build 离线算成 JSON(完整流程见 WST Export 那页)。换句话说,这个 API 和 CubeRoot 喝的是同一口井(WCA 官方导出),只是消费方式不同。',
            en: 'To be precise: CubeRoot does not call this API at runtime. All WCA data on this site comes from a self-built pipeline — it downloads the official WCA Developer export (a MySQL dump), imports it locally, and computes JSON offline with stats-build (full flow on the WST Export page). In other words, this API and CubeRoot draw from the same well (the official WCA export); they just consume it differently.',
          })}
        </p>
        <div className="api-vs">
          <div className="api-vs-col is-api">
            <p className="api-vs-h">{tr({ zh: '这个 API', en: 'This API' })}</p>
            <ul>
              <li>{tr({ zh: '每实体一个预烘焙 JSON', en: 'One pre-baked JSON per entity' })}</li>
              <li>{tr({ zh: '零基建:不用数据库 / 服务端', en: 'Zero infra: no DB, no server' })}</li>
              <li>{tr({ zh: '拿单个选手 / 比赛极快', en: 'Fetching one person / comp is instant' })}</li>
              <li>{tr({ zh: '只读、固定形状,不能跨表算', en: 'Read-only, fixed shape, no cross-table compute' })}</li>
            </ul>
          </div>
          <div className="api-vs-col">
            <p className="api-vs-h">{tr({ zh: 'CubeRoot 的管道', en: 'CubeRoot’s pipeline' })}</p>
            <ul>
              <li>{tr({ zh: '原始导出进本地 MySQL / PG', en: 'Raw export into local MySQL / PG' })}</li>
              <li>{tr({ zh: '自建名次(导出的 ranks 表是空的)', en: 'Builds its own ranks (export’s rank tables are empty)' })}</li>
              <li>{tr({ zh: '名次和 / 历史排名 / 打乱难度等派生统计', en: 'Sum-of-ranks, historical ranks, scramble difficulty, etc.' })}</li>
              <li>{tr({ zh: '读比赛配置表(双轮 linked_round_id 等)', en: 'Reads comp-config tables (dual-round linked_round_id, etc.)' })}</li>
            </ul>
          </div>
        </div>
        <p>
          {tr({
            zh: '为什么 CubeRoot 没直接用它:本站要的是跨表 join、自建名次、名次和、历史排名时间线、打乱难度分桶、报名人数、双轮判定这类派生数据和比赛配置字段,还要亚秒级查询撑实时页面 —— 一个「每实体一个静态 JSON」的接口给不了。所以这个 API 恰好是本站没有走的那条「省事」路线。',
            en: 'Why CubeRoot does not just use it: the site needs cross-table joins, self-built ranks, sum-of-ranks, historical-rank timelines, scramble-difficulty bins, registration counts, dual-round detection — derived data and competition-config fields — plus sub-second queries for live pages. A "one static JSON per entity" interface cannot deliver that. So this API is precisely the convenient road the site did not take.',
          })}
        </p>
        <p className="wcif-note">
          {tr({
            zh: '它在本站确实出现的地方:收录在站内工具导航(/site,比赛分组),署名 Robin Ingelbrecht。什么时候你该选它而不是自建管道:只想拿「某个选手 / 某场比赛」而懒得架数据库,或者一个 AI agent 想抓 WCA 数据但手上没有 DB —— 这个 API 是最快上手的入口。',
            en: 'Where it does appear here: catalogued in the on-site tools directory (/site, competition group), credited to Robin Ingelbrecht. When to reach for it instead of a pipeline: you just want one competitor or one competition without standing up a database, or an AI agent needs WCA data with no DB on hand — this API is the fastest on-ramp.',
          })}
        </p>
      </section>

      {/* ── 给 AI 的调用建议 ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: '给 AI agent 的调用建议', en: 'Notes for AI agents' })}</h2>
        <ul className="wcif-list">
          <li>{tr({ zh: '基址固定 ', en: 'Base is fixed: ' })}<code>{BASE}</code>{tr({ zh:'(也可走 raw.githubusercontent.com/robiningelbrecht/wca-rest-api/v1/ )', en:' (or raw.githubusercontent.com/robiningelbrecht/wca-rest-api/v1/ )' })}</li>
          <li>{tr({ zh: '要单个对象就走 persons/{wcaId}.json、competitions/{id}.json —— 别去下整个 persons.json(巨大)。', en: 'For a single object use persons/{wcaId}.json or competitions/{id}.json — never download the whole persons.json (huge).' })}</li>
          <li>{tr({ zh: '排名直接定位 rank/{region}/{single|average}/{eventId}.json,不要遍历。', en: 'Jump straight to rank/{region}/{single|average}/{eventId}.json; do not iterate.' })}</li>
          <li>{tr({ zh: '先 GET version.json 读 export_date,判断要不要复用缓存。', en: 'GET version.json first and read export_date to decide whether to reuse a cache.' })}</li>
          <li>{tr({ zh: '所有成绩是 WCA 编码(厘秒 / 步数 / 多盲打包,DNF=-1,DNS=-2),展示前先解码。', en: 'All results are WCA-encoded (centiseconds / moves / packed multi, DNF=-1, DNS=-2); decode before display.' })}</li>
          <li>{tr({ zh: '要实时 / 未来比赛数据,这个 API 没有 —— 改用 WCIF 公开端点(见下方链接)。', en: 'It has no live / upcoming data — use the WCIF public endpoint instead (linked below).' })}</li>
        </ul>
      </section>

      <footer className="wcif-foot">
        <a href={BASE} target="_blank" rel="noopener noreferrer">{tr({ zh: '官方文档 ↗', en: 'Docs ↗' })}</a>
        <span className="wcif-meta-sep">·</span>
        <a href="https://github.com/robiningelbrecht/wca-rest-api" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
        <span className="wcif-meta-sep">·</span>
        <AppLink href="/code/wca-export">{tr({ zh: 'WST 导出(本站数据源)', en: 'WST Export (the source)' })}</AppLink>
        <span className="wcif-meta-sep">·</span>
        <AppLink href="/code/wcif">{tr({ zh: 'WCIF(未来比赛实时格式)', en: 'WCIF (live upcoming)' })}</AppLink>
        <span className="wcif-meta-sep">·</span>
        <span>{tr({ zh: '数据归 WCA,遵守其使用条款', en: 'Data © WCA, used under their terms' })}</span>
      </footer>
    </div>
  );
}
