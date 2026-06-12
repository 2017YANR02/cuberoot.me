'use client';

// WST Developer Export 参考页 — 给开发者 / AI 速查 WCA 官方完整数据库导出。
// 复用 /code/wcif 的文档样式（.wcif-* 类）。事实据本地导入的 developer dump 实测 + 官方导出页。

import HomeLink from '@/components/HomeLink';
import AppLink from '@/components/AppLink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import '../wcif/wcif.css';

function Row({ k, type, children }: { k: string; type: string; children: React.ReactNode }) {
  return (
    <tr>
      <td className="wcif-field-k"><code>{k}</code></td>
      <td className="wcif-field-t"><code>{type}</code></td>
      <td className="wcif-field-d">{children}</td>
    </tr>
  );
}

function Table({ head, children }: { head?: [string, string]; children: React.ReactNode }) {
  return (
    <div className="wcif-table-wrap">
      <table className="wcif-table">
        <thead>
          <tr>
            <th>{head?.[0] ?? tr({ zh: '表', en: 'Table' })}</th>
            <th>{head?.[1] ?? tr({ zh: '行数', en: 'Rows',
                zhHant: "行數"
            })}</th>
            <th>{tr({ zh: '说明', en: 'Description',
                zhHant: "說明"
            })}</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default function WcaExportPage() {
  useDocumentTitle('WST 数据导出', 'WST Export', 'WST 資料匯出');

  return (
    <div className="wcif-page">
      <div className="wcif-topbar">
        <HomeLink className="wcif-back">← {tr({ zh: '回首页', en: 'Home',
            zhHant: "回首頁"
        })}</HomeLink>
        <AppLink href="/code" className="wcif-back">/code</AppLink>
        <AppLink href="/code/wcif" className="wcif-back">WCIF</AppLink>
      </div>

      <header className="wcif-hero">
        <div className="wcif-hero-route">/code/wca-export</div>
        <h1 className="wcif-hero-title">WST Export</h1>
        <p className="wcif-hero-sub">WCA Developer Database Export</p>
        <p className="wcif-hero-tagline">
          {tr({
            zh: '世界魔方协会（WCA）软件团队（WST）每天发布的官方完整数据库快照：自 1982 年以来全部比赛、选手、成绩、轮次配置、打乱、赛程，一个 MySQL .sql.zip 打包。CubeRoot 的所有 WCA 统计、比赛中心、打乱难度、报名人数都从这份导出离线构建，不实时打 WCA 服务器。',
            en: 'The official full database snapshot the WCA Software Team (WST) publishes daily: every competition, person, result, round config, scramble and schedule since 1982, in one MySQL .sql.zip. Every WCA stat on CubeRoot — the competition hub, scramble difficulty, registration counts — is built offline from this export rather than hitting WCA live.',
              zhHant: "世界魔方協會（WCA）軟體團隊（WST）每天釋出的官方完整資料庫快照：自 1982 年以來全部比賽、選手、成績、輪次配置、打亂、賽程，一個 MySQL .sql.zip 打包。CubeRoot 的所有 WCA 統計、比賽中心、打亂難度、報名人數都從這份匯出離線構建，不實時打 WCA 伺服器。"
        })}
        </p>
        <div className="wcif-hero-meta">
          <span>{tr({ zh: '每日更新 · MySQL dump', en: 'Daily · MySQL dump' })}</span>
          <span className="wcif-meta-sep">·</span>
          <a href="https://www.worldcubeassociation.org/export/developer" target="_blank" rel="noopener noreferrer">
            {tr({ zh: '官方导出页', en: 'Official export page',
                zhHant: "官方匯出頁"
            })} ↗
          </a>
        </div>
      </header>

      {/* ── 两种导出 ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: '两种导出，别拿错', en: 'Two exports — pick the right one',
            zhHant: "兩種匯出，別拿錯"
        })}</h2>
        <p>
          {tr({
            zh: 'WCA 提供两份导出。Public 导出只有成绩 / 选手 / 比赛三类核心表（TSV，给做榜单的人）；Developer 导出是整个数据库的关系型快照，多出轮次配置、打乱、赛程、场馆、资格要求等。要拿「每轮限时 / 及格线 / 晋级条件 / 参赛资格」这类只存在于比赛配置里的字段，必须用 Developer 导出。',
            en: 'WCA ships two exports. The Public export has only the three core kinds — results / persons / competitions (TSV, for ranking work). The Developer export is a relational snapshot of the whole database, adding round configuration, scrambles, schedule, venues, qualifications. Fields like per-round time limit / cutoff / advancement / qualification live only in competition config, so you need the Developer export for those.',
              zhHant: "WCA 提供兩份匯出。Public 匯出只有成績 / 選手 / 比賽三類核心表（TSV，給做榜單的人）；Developer 匯出是整個資料庫的關係型快照，多出輪次配置、打亂、賽程、場館、資格要求等。要拿「每輪限時 / 及格線 / 晉級條件 / 參賽資格」這類只存在於比賽配置裡的欄位，必須用 Developer 匯出。"
        })}
        </p>
        <pre className="wcif-code"><code>{`# Developer export（本页讲的这个，~完整 DB）
https://www.worldcubeassociation.org/export/developer
  → wca-developer-database-dump.zip  →  wca-developer-database-dump.sql (MySQL)

# Public export（仅成绩榜用，TSV）
https://www.worldcubeassociation.org/export/results`}</code></pre>
      </section>

      {/* ── 表清单 ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: '表清单（22 张）', en: 'Tables (22)',
            zhHant: "表清單（22 張）"
        })}</h2>
        <p className="wcif-note">
          {tr({ zh: '行数为 2026-05 一份导出的实测量级，仅供感受规模。', en: 'Row counts are from a 2026-05 export, order-of-magnitude only.',
              zhHant: "行數為 2026-05 一份匯出的實測量級，僅供感受規模。"
        })}
        </p>

        <h3>{tr({ zh: '成绩 · Results', en: 'Results',
            zhHant: "成績 · Results"
        })}</h3>
        <Table>
          <Row k="results" type="6.6M">{tr({ zh: '每人每项每轮一行；best / average + 各把成绩（厘秒，-1=DNF，-2=DNS）', en: 'One row per person/event/round; best / average + per-attempt values (centiseconds, -1=DNF, -2=DNS)',
              zhHant: "每人每項每輪一行；best / average + 各把成績（釐秒，-1=DNF，-2=DNS）"
        })}</Row>
          <Row k="result_attempts" type="—">{tr({ zh: '把成绩拆成单把（value1..5 的规范化版）', en: 'Per-attempt rows (normalized form of value1..5)',
              zhHant: "把成績拆成單把（value1..5 的規範化版）"
        })}</Row>
          <Row k="ranks_single" type="—">{tr({ zh: '每人每项当前单次排名（国家 / 大洲 / 世界）', en: 'Per-person/event current single rank (NR/CR/WR)',
              zhHant: "每人每項當前單次排名（國家 / 大洲 / 世界）"
        })}</Row>
          <Row k="ranks_average" type="—">{tr({ zh: '同上，平均成绩', en: 'Same, for averages',
              zhHant: "同上，平均成績"
        })}</Row>
          <Row k="scrambles" type="3.1M">{tr({ zh: '每场每轮每组的打乱串（/scramble 难度分布的源数据）', en: 'Scramble sequences per comp/round/group (source for /scramble difficulty stats)',
              zhHant: "每場每輪每組的打亂串（/scramble 難度分佈的源資料）"
        })}</Row>
        </Table>

        <h3>{tr({ zh: '实体 · Entities', en: 'Entities',
            zhHant: "實體 · Entities"
        })}</h3>
        <Table>
          <Row k="persons" type="289k">{tr({ zh: 'WCA ID、姓名、国籍、性别', en: 'WCA ID, name, country, gender',
              zhHant: "WCA ID、姓名、國籍、性別"
        })}</Row>
          <Row k="competitions" type="17.7k">{tr({ zh: '比赛元数据：日期、城市、坐标、人数上限、报名时间', en: 'Competition metadata: dates, city, coords, competitor limit, registration window',
              zhHant: "比賽後設資料：日期、城市、座標、人數上限、報名時間"
        })}</Row>
          <Row k="events" type="—">{tr({ zh: '17 个现役 + 已废止项目', en: '17 active + retired events',
              zhHant: "17 個現役 + 已廢止項目"
        })}</Row>
          <Row k="formats / round_types" type="—">{tr({ zh: '计分格式（ao5/mo3…）与轮次类型（决赛 / 半决赛…）', en: 'Scoring formats (ao5/mo3…) and round types (final / semi…)',
              zhHant: "計分格式（ao5/mo3…）與輪次型別（決賽 / 半決賽…）"
        })}</Row>
          <Row k="continents / countries" type="—">{tr({ zh: '大洲、国家 + ISO2', en: 'Continents, countries + ISO2',
              zhHant: "大洲、國家 + ISO2"
        })}</Row>
          <Row k="championships" type="—">{tr({ zh: '世锦 / 洲际 / 国家锦标的归属', en: 'World / continental / national championship tags',
              zhHant: "世錦 / 洲際 / 國家錦標的歸屬"
        })}</Row>
        </Table>

        <h3>{tr({ zh: '比赛配置 · 只有这里有', en: 'Competition config · only here',
            zhHant: "比賽配置 · 只有這裡有"
        })}</h3>
        <Table>
          <Row k="rounds" type="251k">{tr({ zh: '每场每项每轮一行。time_limit / cutoff / advancement_condition 三列是 WCIF 形状的 JSON 文本（见下）', en: 'One row per comp/event/round. time_limit / cutoff / advancement_condition are WCIF-shaped JSON text (below)',
              zhHant: "每場每項每輪一行。time_limit / cutoff / advancement_condition 三列是 WCIF 形狀的 JSON 文字（見下）"
        })}</Row>
          <Row k="competition_events" type="—">{tr({ zh: '某场办了哪些项目 + qualification / qualification_condition（参赛资格门槛）', en: 'Which events a comp runs + qualification / qualification_condition (entry requirements)',
              zhHant: "某場辦了哪些項目 + qualification / qualification_condition（參賽資格門檻）"
        })}</Row>
          <Row k="schedule_activities" type="—">{tr({ zh: '赛程：每个活动的开始 / 结束时间（喂 /wca/comp 赛程 tab）', en: 'Schedule: per-activity start/end times (feeds /wca/comp schedule tab)',
              zhHant: "賽程：每個活動的開始 / 結束時間（喂 /wca/comp 賽程 tab）"
        })}</Row>
          <Row k="competition_venues / venue_rooms" type="—">{tr({ zh: '场馆、房间、时区', en: 'Venues, rooms, timezones',
              zhHant: "場館、房間、時區"
        })}</Row>
          <Row k="competition_delegates" type="—">{tr({ zh: '每场的代表（Delegate）', en: 'Per-comp delegates',
              zhHant: "每場的代表（Delegate）"
        })}</Row>
          <Row k="preferred_formats / users" type="—">{tr({ zh: '项目默认格式；账号（公开导出里高度脱敏）', en: 'Per-event default format; accounts (heavily redacted in the public dump)',
              zhHant: "項目預設格式；賬號（公開匯出裡高度脫敏）"
        })}</Row>
        </Table>
      </section>

      {/* ── JSON 列 ── */}
      <section className="wcif-section wcif-section-accent">
        <h2>{tr({ zh: 'WCIF 形状的 JSON 列', en: 'WCIF-shaped JSON columns',
            zhHant: "WCIF 形狀的 JSON 列"
        })}</h2>
        <p>
          {tr({
            zh: '关键发现：rounds 和 competition_events 里几个列是 JSON 文本，形状和 WCIF 公开端点逐字一致。所以「过去比赛」的每轮限时 / 及格线 / 晋级 / 资格能直接从这份离线 dump 拿，无需对几万场历史比赛逐个去打 WCIF。CubeRoot 的 comp_round_meta.json 就是这么来的。',
            en: 'Key insight: a few columns in rounds and competition_events are JSON text, byte-identical in shape to the WCIF public endpoint. So per-round time limit / cutoff / advancement / qualification for past comps come straight from this offline dump — no need to hit WCIF for tens of thousands of historical comps. CubeRoot’s comp_round_meta.json is built exactly this way.',
              zhHant: "關鍵發現：rounds 和 competition_events 裡幾個列是 JSON 文字，形狀和 WCIF 公開端點逐字一致。所以「過去比賽」的每輪限時 / 及格線 / 晉級 / 資格能直接從這份離線 dump 拿，無需對幾萬場歷史比賽逐個去打 WCIF。CubeRoot 的 comp_round_meta.json 就是這麼來的。"
        })}
        </p>
        <pre className="wcif-code"><code>{`rounds.time_limit            {"centiseconds":60000,"cumulativeRoundIds":[]}
rounds.cutoff                {"numberOfAttempts":2,"attemptResult":3000}
rounds.advancement_condition {"type":"ranking","level":24}   // ranking | percent | attemptResult
competition_events.qualification
                             {"type":"attemptResult","resultType":"average",
                              "whenDate":"2023-09-04","level":1500}`}</code></pre>
        <p className="wcif-note">
          {tr({ zh: 'attemptResult / level 的编码同 WCA 成绩：时间为厘秒，FMC 为步数，多盲为打包数。formatWcaResult() 直接能格式化。', en: 'attemptResult / level use WCA result encoding: centiseconds for timed events, move count for FMC, packed for MBLD. formatWcaResult() formats them directly.',
              zhHant: "attemptResult / level 的編碼同 WCA 成績：時間為釐秒，FMC 為步數，多盲為打包數。formatWcaResult() 直接能格式化。"
        })}
        </p>
      </section>

      {/* ── CubeRoot 怎么用 ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: 'CubeRoot 怎么用', en: 'How CubeRoot uses it',
            zhHant: "CubeRoot 怎麼用"
        })}</h2>
        <ul className="wcif-list">
          <li><strong>update_database.ts</strong> — {tr({ zh: '下载 zip、解压、按表名过滤导入本地 MySQL（只留 REQUIRED_TABLES，不灌整 2GB）', en: 'downloads the zip, unzips, imports into local MySQL filtered by table name (only REQUIRED_TABLES, not the full ~2GB)',
              zhHant: "下載 zip、解壓、按表名過濾匯入本地 MySQL（只留 REQUIRED_TABLES，不灌整 2GB）"
        })}</li>
          <li><strong>REQUIRED_TABLES</strong> — {tr({ zh: 'stats-build 用到的表白名单；要新字段先把对应表加进去（rounds / competition_events 就是为「每轮配置」加的）', en: 'the whitelist of tables stats-build needs; to use new fields, add the table here first (rounds / competition_events were added for per-round config)',
              zhHant: "stats-build 用到的表白名單；要新欄位先把對應表加進去（rounds / competition_events 就是為「每輪配置」加的）"
        })}</li>
          <li><strong>compute_all.ts</strong> — {tr({ zh: '跑所有 WCA 统计页（榜单 / 名次和 / 历史排名…）', en: 'computes every WCA stats page (rankings / sum-of-ranks / historical ranks…)',
              zhHant: "跑所有 WCA 統計頁（榜單 / 名次和 / 歷史排名…）"
        })}</li>
          <li><strong>gen_all_comps.ts</strong> — {tr({ zh: '产 all_past_comps.json + comp_round_meta.json（过去比赛的每轮限时/及格/晋级/资格）', en: 'emits all_past_comps.json + comp_round_meta.json (past-comp per-round time limit / cutoff / advancement / qualification)',
              zhHant: "產 all_past_comps.json + comp_round_meta.json（過去比賽的每輪限時/及格/晉級/資格）"
        })}</li>
          <li><strong>build_scramble_lengths.ts</strong> — {tr({ zh: '从 scrambles 表算每个项目的打乱长度分布', en: 'computes per-event scramble length distribution from the scrambles table',
              zhHant: "從 scrambles 表算每個項目的打亂長度分佈"
        })}</li>
        </ul>
        <p className="wcif-note">
          {tr({
            zh: '整条流水线在 stats.yml CI 里每天 UTC 20:00 跑（跟着 WCA 上游天更），产物 commit 进 stats/，再由 sync_toolkit 同步到静态服务器。未来比赛拿不到 dump（还没结束），那部分走 WCIF 公开端点实时补 —— 见 /code/wcif。',
            en: 'The whole pipeline runs daily at 20:00 UTC in stats.yml CI (tracking WCA upstream), commits artifacts into stats/, and sync_toolkit ships them to the static server. Upcoming comps aren’t in the dump yet, so that slice is filled live from the WCIF public endpoint — see /code/wcif.',
              zhHant: "整條流水線在 stats.yml CI 裡每天 UTC 20:00 跑（跟著 WCA 上游天更），產物 commit 進 stats/，再由 sync_toolkit 同步到靜態伺服器。未來比賽拿不到 dump（還沒結束），那部分走 WCIF 公開端點實時補 —— 見 /code/wcif。"
        })}
        </p>
      </section>

      <footer className="wcif-foot">
        <a href="https://www.worldcubeassociation.org/export/developer" target="_blank" rel="noopener noreferrer">{tr({ zh: '官方导出页 ↗', en: 'Official export page ↗',
            zhHant: "官方匯出頁 ↗"
        })}</a>
        <span className="wcif-meta-sep">·</span>
        <AppLink href="/code/wcif">{tr({ zh: 'WCIF（未来比赛实时格式）', en: 'WCIF (live upcoming format)',
            zhHant: "WCIF（未來比賽實時格式）"
        })}</AppLink>
        <span className="wcif-meta-sep">·</span>
        <span>{tr({ zh: '数据归 WCA，遵守其使用条款', en: 'Data © WCA, used under their terms',
            zhHant: "資料歸 WCA，遵守其使用條款"
        })}</span>
      </footer>
    </div>
  );
}
