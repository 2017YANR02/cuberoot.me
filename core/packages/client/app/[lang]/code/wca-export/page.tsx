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
            <th>{head?.[1] ?? tr({ zh: '行数', en: 'Rows'
            })}</th>
            <th>{tr({ zh: '说明', en: 'Description'
            })}</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default function WcaExportPage() {
  useDocumentTitle('WST 数据导出', 'WST Export');

  return (
    <div className="wcif-page wcif-page-wide">
      <div className="wcif-topbar">
        <HomeLink className="wcif-back">← {tr({ zh: '回首页', en: 'Home'
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
            en: 'The official full database snapshot the WCA Software Team (WST) publishes daily: every competition, person, result, round config, scramble and schedule since 1982, in one MySQL .sql.zip. Every WCA stat on CubeRoot — the competition hub, scramble difficulty, registration counts — is built offline from this export rather than hitting WCA live.'
        })}
        </p>
        <div className="wcif-hero-meta">
          <span>{tr({ zh: '每日更新 · MySQL dump', en: 'Daily · MySQL dump' })}</span>
          <span className="wcif-meta-sep">·</span>
          <a href="https://www.worldcubeassociation.org/export/developer" target="_blank" rel="noopener noreferrer">
            {tr({ zh: '官方导出页', en: 'Official export page'
            })} ↗
          </a>
        </div>
      </header>

      {/* ── 两种导出 ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: '两种导出，别拿错', en: 'Two exports — pick the right one'
        })}</h2>
        <p>
          {tr({
            zh: 'WCA 提供两份导出。Public 导出只有成绩 / 选手 / 比赛三类核心表（TSV，给做榜单的人）；Developer 导出是整个数据库的关系型快照，多出轮次配置、打乱、赛程、场馆、资格要求等。要拿「每轮限时 / 及格线 / 晋级条件 / 参赛资格」这类只存在于比赛配置里的字段，必须用 Developer 导出。',
            en: 'WCA ships two exports. The Public export has only the three core kinds — results / persons / competitions (TSV, for ranking work). The Developer export is a relational snapshot of the whole database, adding round configuration, scrambles, schedule, venues, qualifications. Fields like per-round time limit / cutoff / advancement / qualification live only in competition config, so you need the Developer export for those.'
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
        <h2>{tr({ zh: '表清单', en: 'Tables'
        })}</h2>
        <p className="wcif-note">
          {tr({ zh: '整份 developer dump 有数十张表；下面按用途列出 CubeRoot 用到的核心表 + 2026 新增、值得知道的几张。行数为 2026-06 一份导出的实测量级，仅供感受规模。', en: 'The full developer dump has dozens of tables; below are the core ones CubeRoot uses plus a few notable 2026 additions. Row counts are from a 2026-06 export, order-of-magnitude only.'
        })}
        </p>

        <h3>{tr({ zh: '成绩 Results', en: 'Results'
        })}</h3>
        <Table>
          <Row k="results" type="6.6M">{tr({ zh: '每人每项每轮一行；best / average + 各把成绩（厘秒，-1=DNF，-2=DNS）', en: 'One row per person/event/round; best / average + per-attempt values (centiseconds, -1=DNF, -2=DNS)'
        })}</Row>
          <Row k="result_attempts" type="—">{tr({ zh: '把成绩拆成单把（value1..5 的规范化版）', en: 'Per-attempt rows (normalized form of value1..5)'
        })}</Row>
          <Row k="scrambles" type="3.1M">{tr({ zh: '每场每轮每组的打乱串（/scramble 难度分布的源数据）', en: 'Scramble sequences per comp/round/group (source for /scramble difficulty stats)'
        })}</Row>
          <Row k="ranks_single / ranks_average" type="0 空">{tr({ zh: '排名表。developer 导出里被 skip_all_rows 清空——只剩表结构、0 行。单次 / 平均的国家 / 大洲 / 世界名次得自己从 results 现算（CubeRoot 的 ranks 是自建的）', en: 'Rank tables. Emptied (skip_all_rows) in the developer export — schema only, 0 rows. Compute single/average NR/CR/WR from results yourself (CubeRoot builds its own ranks).'
        })}</Row>
        </Table>

        <h3>{tr({ zh: '实体 Entities', en: 'Entities'
        })}</h3>
        <Table>
          <Row k="persons" type="289k">{tr({ zh: 'WCA ID、姓名、国籍、性别', en: 'WCA ID, name, country, gender'
        })}</Row>
          <Row k="competitions" type="17.7k">{tr({ zh: '比赛元数据：日期、城市、坐标、人数上限、报名时间', en: 'Competition metadata: dates, city, coords, competitor limit, registration window'
        })}</Row>
          <Row k="events" type="—">{tr({ zh: '17 个现役 + 已废止项目', en: '17 active + retired events'
        })}</Row>
          <Row k="formats / round_types" type="—">{tr({ zh: '计分格式（ao5/mo3…）与轮次类型（决赛 / 半决赛…）', en: 'Scoring formats (ao5/mo3…) and round types (final / semi…)'
        })}</Row>
          <Row k="continents / countries" type="—">{tr({ zh: '大洲、国家 + ISO2', en: 'Continents, countries + ISO2'
        })}</Row>
          <Row k="championships" type="—">{tr({ zh: '世锦 / 洲际 / 国家锦标的归属（+ eligible_country_iso2s_for_championship：多国共享锦标的资格国家）', en: 'World / continental / national championship tags (+ eligible_country_iso2s_for_championship: eligible countries for multi-country championships)'
        })}</Row>
        </Table>

        <h3>{tr({ zh: '比赛配置 只有这里有', en: 'Competition config — only here'
        })}</h3>
        <Table>
          <Row k="rounds" type="251k">{tr({ zh: '每场每项每轮一行。time_limit / cutoff / advancement_condition 是 WCIF 形状 JSON 文本（见下）；2026 新增 linked_round_id（双轮，见专节）、participation_* 与 total_number_of_rounds 等列', en: 'One row per comp/event/round. time_limit / cutoff / advancement_condition are WCIF-shaped JSON text (below); 2026 adds linked_round_id (dual rounds — see section), participation_*, total_number_of_rounds, etc.'
        })}</Row>
          <Row k="competition_events" type="—">{tr({ zh: '某场办了哪些项目 + qualification（WCIF 文本）/ qualification_condition（新 JSON）/ qualification_latest_date（参赛资格门槛）', en: 'Which events a comp runs + qualification (WCIF text) / qualification_condition (new JSON) / qualification_latest_date (entry requirements)'
        })}</Row>
          <Row k="schedule_activities" type="—">{tr({ zh: '赛程：每个活动的开始 / 结束时间（喂 /wca/comp 赛程 tab）', en: 'Schedule: per-activity start/end times (feeds /wca/comp schedule tab)'
        })}</Row>
          <Row k="competition_venues / venue_rooms" type="—">{tr({ zh: '场馆、房间、时区', en: 'Venues, rooms, timezones'
        })}</Row>
          <Row k="competition_delegates" type="—">{tr({ zh: '每场的代表（Delegate）', en: 'Per-comp delegates'
        })}</Row>
          <Row k="preferred_formats / users" type="—">{tr({ zh: '项目默认格式；账号（公开导出里高度脱敏：邮箱→用户号、生日统一 1954-12-04 等）', en: 'Per-event default format; accounts (heavily redacted in the public dump: emails→user ids, DOB normalized to 1954-12-04, etc.)'
        })}</Row>
        </Table>

        <h3>{tr({ zh: '2026 新增 值得知道', en: '2026 additions — worth knowing'
        })}</h3>
        <Table>
          <Row k="linked_rounds" type="—">{tr({ zh: '双轮（Reg 9v）配对分组。rounds.linked_round_id 指向它；共享同一 id 的两轮 = 这对双轮（见专节）', en: 'Dual-round (Reg 9v) pairing groups. rounds.linked_round_id points here; the two rounds sharing one id form the dual pair (see section).'
        })}</Row>
          <Row k="h2h_matches / h2h_sets / h2h_attempts / h2h_match_competitors" type="—">{tr({ zh: '对决（head-to-head，1v1 淘汰）赛制的对阵 / 局 / 单把数据；rounds.is_h2h_mock 标该轮是 H2H 的占位轮', en: 'Head-to-head (1v1 knockout) match / set / attempt data; rounds.is_h2h_mock flags a round as an H2H mock placeholder.'
        })}</Row>
          <Row k="registrations / registration_competition_events / waiting_lists" type="—">{tr({ zh: '报名记录（哪个选手报了哪些项目）+ 候补名单（脱敏）。以前 CubeRoot 报名人数靠 WCIF / 推算，dump 现已自带', en: 'Registration records (who registered for which events) + waiting lists (redacted). CubeRoot used to infer registration counts from WCIF; the dump now carries them.'
        })}</Row>
          <Row k="competition_series / competition_organizers / competition_media / competition_tabs" type="—">{tr({ zh: '比赛系列（联办）、组织者、媒体链接、自定义比赛页', en: 'Competition series (joint comps), organizers, media links, custom comp tabs.'
        })}</Row>
        </Table>
      </section>

      {/* ── JSON 列 ── */}
      <section className="wcif-section wcif-section-accent">
        <h2>{tr({ zh: 'WCIF 形状的 JSON 列', en: 'WCIF-shaped JSON columns'
        })}</h2>
        <p>
          {tr({
            zh: '关键发现：rounds 和 competition_events 里几个列是 JSON 文本，形状和 WCIF 公开端点逐字一致。所以「过去比赛」的每轮限时 / 及格线 / 晋级 / 资格能直接从这份离线 dump 拿，无需对几万场历史比赛逐个去打 WCIF。CubeRoot 的 comp_round_meta.json 就是这么来的。',
            en: 'Key insight: a few columns in rounds and competition_events are JSON text, byte-identical in shape to the WCIF public endpoint. So per-round time limit / cutoff / advancement / qualification for past comps come straight from this offline dump — no need to hit WCIF for tens of thousands of historical comps. CubeRoot’s comp_round_meta.json is built exactly this way.'
        })}
        </p>
        <pre className="wcif-code"><code>{`rounds.time_limit            {"centiseconds":60000,"cumulativeRoundIds":[]}
rounds.cutoff                {"numberOfAttempts":2,"attemptResult":3000}
rounds.advancement_condition {"type":"ranking","level":24}   // ranking | percent | attemptResult
competition_events.qualification
                             {"type":"attemptResult","resultType":"average",
                              "whenDate":"2023-09-04","level":1500}`}</code></pre>
        <p className="wcif-note">
          {tr({ zh: 'attemptResult / level 的编码同 WCA 成绩：时间为厘秒，FMC 为步数，多盲为打包数。formatWcaResult() 直接能格式化。', en: 'attemptResult / level use WCA result encoding: centiseconds for timed events, move count for FMC, packed for MBLD. formatWcaResult() formats them directly.'
        })}
        </p>
        <p>
          {tr({
            zh: '2026 起 WCA 又加了一套「新模型」并行存在：rounds.participation_condition 和 competition_events.qualification_condition 是原生 JSON 列（不是文本），形状是 {type, scope, value}，配合 rounds 的 participation_source_type / participation_source_id 表达「这一轮的选手从哪来」。它和上面的 WCIF 文本列语义相关但不等价（同一轮两边的数值可能不同），是 WCA 内部正在迁移的新结构。CubeRoot 目前仍读 WCIF 文本那套（advancement_condition / qualification），新模型先了解、暂不依赖。',
            en: 'Since 2026 WCA also ships a parallel "new model": rounds.participation_condition and competition_events.qualification_condition are native JSON columns (not text), shaped {type, scope, value}, paired with rounds.participation_source_type / participation_source_id to express "where this round’s competitors come from". It is related to but not equivalent to the WCIF text columns above (the two sides can hold different numbers for the same round) — it is WCA’s in-progress internal structure. CubeRoot still reads the WCIF text columns (advancement_condition / qualification); treat the new model as informational for now.'
        })}
        </p>
        <pre className="wcif-code"><code>{`rounds.participation_condition  {"type":"ranking","scope":"average","value":60}
rounds.participation_source_type  CompetitionEvent | Round | LinkedRound
rounds.participation_source_id    -> 选手来源行的 id / id of the source row
competition_events.qualification_condition
                                {"type":"resultAchieved","scope":"average","value":1500}`}</code></pre>
      </section>

      {/* ── 双轮 / Dual Rounds ── */}
      <section className="wcif-section wcif-section-accent">
        <h2>{tr({ zh: '双轮 Dual Rounds（rounds.linked_round_id）', en: 'Dual Rounds (rounds.linked_round_id)'
        })}</h2>
        <p>
          {tr({
            zh: 'WCA 2026 新赛制「双轮」(Reg 9v)：一个项目的前两轮被链接成一对，所有选手两轮都打、轮间不淘汰，取更好的成绩排名，两轮成绩都独立计入世界排名 / 纪录。判断一场比赛某项目是不是双轮，唯一权威信号就是 dump 里的 rounds.linked_round_id —— 非 NULL 即这一轮属于一对双轮。它是指向 linked_rounds 表的外键（不是 rounds.id）；同一项目里共享同一 linked_round_id 的那两轮，就是这对双轮（当前 dump 里每个 linked_round_id 恰好对应 2 行）。',
            en: 'WCA’s 2026 "dual rounds" format (Reg 9v): a competition’s first two rounds are linked into a pair — everyone plays both, no elimination between them, ranking takes the better result, and both results count independently toward world rankings / records. The only authoritative signal for whether an event at a comp is dual is rounds.linked_round_id in the dump — non-NULL means this round belongs to a dual pair. It is a foreign key to the linked_rounds table (not to rounds.id); the two rounds of one event sharing the same linked_round_id are the pair (in the current dump each linked_round_id maps to exactly 2 rows).'
        })}
        </p>
        <pre className="wcif-code"><code>{`-- 一场比赛里所有双轮项目 / all dual-round events at a comp
SELECT DISTINCT ce.event_id
FROM rounds r
JOIN competition_events ce ON ce.id = r.competition_event_id
WHERE ce.competition_id = ? AND r.linked_round_id IS NOT NULL;`}</code></pre>
        <p className="wcif-note">
          {tr({
            zh: '坑：别用 advancement_condition 判双轮。双轮赛常把它写成后备值 {"type":"percent","level":75}（「万一双轮取消，回退取前 75%」），所以 percent/75 既出现在真双轮、也出现在普通晋级，两向都不准。早期用 advancement==percent/100 启发式两向皆错（假阳如 Shanghai、假阴如 Evanston），已全部改用 linked_round_id。',
            en: 'Pitfall: don’t infer dual from advancement_condition. Dual rounds commonly store it as a fallback {"type":"percent","level":75} ("if dual is cancelled, fall back to top 75%"), so percent/75 shows up on both real duals and ordinary advancement — unreliable both ways. An earlier advancement==percent/100 heuristic was wrong in both directions (false positives like Shanghai, false negatives like Evanston); both now use linked_round_id.'
        })}
        </p>
      </section>

      {/* ── CubeRoot 怎么用 ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: 'CubeRoot 怎么用', en: 'How CubeRoot uses it'
        })}</h2>
        <ul className="wcif-list">
          <li><strong>update_database.ts</strong> — {tr({ zh: '下载 zip、解压、按表名过滤导入本地 MySQL（只留 REQUIRED_TABLES，不灌整 2GB）', en: 'downloads the zip, unzips, imports into local MySQL filtered by table name (only REQUIRED_TABLES, not the full ~2GB)'
        })}</li>
          <li><strong>REQUIRED_TABLES</strong> — {tr({ zh: 'stats-build 用到的表白名单；要新字段先把对应表加进去（rounds / competition_events 就是为「每轮配置」加的，rounds 整表导入自带 linked_round_id 列）', en: 'the whitelist of tables stats-build needs; to use new fields, add the table here first (rounds / competition_events were added for per-round config; importing rounds whole brings linked_round_id along)'
        })}</li>
          <li><strong>compute_all.ts</strong> — {tr({ zh: '跑所有 WCA 统计页（榜单 / 名次和 / 历史排名…）', en: 'computes every WCA stats page (rankings / sum-of-ranks / historical ranks…)'
        })}</li>
          <li><strong>gen_all_comps.ts</strong> — {tr({ zh: '产 all_past_comps.json + comp_round_meta.json（过去比赛的每轮限时/及格/晋级/资格）+ comp_dual.json（{compId: [双轮项目]}，源同 linked_round_id，含未结束比赛，喂 /wca/comp 详情页与列表的双轮判定）', en: 'emits all_past_comps.json + comp_round_meta.json (past-comp per-round time limit / cutoff / advancement / qualification) + comp_dual.json ({compId: [dual events]}, sourced from linked_round_id, includes upcoming comps, feeds dual-round detection on /wca/comp detail + list)'
        })}</li>
          <li><strong>build_scramble_lengths.ts</strong> — {tr({ zh: '从 scrambles 表算每个项目的打乱长度分布', en: 'computes per-event scramble length distribution from the scrambles table'
        })}</li>
        </ul>
        <p className="wcif-note">
          {tr({
            zh: '整条流水线在 stats.yml CI 里每天 UTC 20:00 跑（跟着 WCA 上游天更），产物 commit 进 stats/，再由 sync_toolkit 同步到静态服务器。未来比赛拿不到 dump（还没结束），那部分走 WCIF 公开端点实时补 —— 见 /code/wcif。',
            en: 'The whole pipeline runs daily at 20:00 UTC in stats.yml CI (tracking WCA upstream), commits artifacts into stats/, and sync_toolkit ships them to the static server. Upcoming comps aren’t in the dump yet, so that slice is filled live from the WCIF public endpoint — see /code/wcif.'
        })}
        </p>
      </section>

      <footer className="wcif-foot">
        <a href="https://www.worldcubeassociation.org/export/developer" target="_blank" rel="noopener noreferrer">{tr({ zh: '官方导出页 ↗', en: 'Official export page ↗'
        })}</a>
        <span className="wcif-meta-sep">·</span>
        <AppLink href="/code/wcif">{tr({ zh: 'WCIF（未来比赛实时格式）', en: 'WCIF (live upcoming format)'
        })}</AppLink>
        <span className="wcif-meta-sep">·</span>
        <AppLink href="/code/wca-rest-api">{tr({ zh: 'WCA REST API（同源的现成接口）', en: 'WCA REST API (off-the-shelf over the same data)'
        })}</AppLink>
        <span className="wcif-meta-sep">·</span>
        <span>{tr({ zh: '数据归 WCA，遵守其使用条款', en: 'Data © WCA, used under their terms'
        })}</span>
      </footer>
    </div>
  );
}
