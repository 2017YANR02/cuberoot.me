'use client';

// WCIF (WCA Competition Interchange Format) 参考页 — 给开发者 / AI 速查比赛数据结构。
// 内容据官方 spec v1.1 (github.com/thewca/wcif) + CubeRoot 实战用法整理。

import HomeLink from '@/components/HomeLink';
import AppLink from '@/components/AppLink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import './wcif.css';

function Field({ k, type, children }: { k: string; type: string; children: React.ReactNode }) {
  return (
    <tr>
      <td className="wcif-field-k"><code>{k}</code></td>
      <td className="wcif-field-t"><code>{type}</code></td>
      <td className="wcif-field-d">{children}</td>
    </tr>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="wcif-table-wrap">
      <table className="wcif-table">
        <thead>
          <tr>
            <th>{tr({ zh: '字段', en: 'Field',
                zhHant: "欄位"
            })}</th>
            <th>{tr({ zh: '类型', en: 'Type',
                zhHant: "型別"
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

export default function WcifPage() {
  useDocumentTitle('WCIF', 'WCIF', 'WCIF');

  return (
    <div className="wcif-page">
      <div className="wcif-topbar">
        <HomeLink className="wcif-back">← {tr({ zh: '回首页', en: 'Home',
            zhHant: "回首頁"
        })}</HomeLink>
        <AppLink href="/code" className="wcif-back">/code</AppLink>
      </div>

      <header className="wcif-hero">
        <div className="wcif-hero-route">/code/wcif</div>
        <h1 className="wcif-hero-title">WCIF</h1>
        <p className="wcif-hero-sub">WCA Competition Interchange Format</p>
        <p className="wcif-hero-tagline">
          {tr({
            zh: '世界魔方协会（WCA）比赛数据的标准 JSON 格式。一份 WCIF 完整描述一场比赛：报名选手、项目、轮次、赛程、成绩。CubeRoot 站内的比赛中心、赛程、打乱、报名人数统计全靠它。',
            en: 'The standard JSON format for World Cube Association (WCA) competition data. One WCIF fully describes a competition: registered competitors, events, rounds, schedule, results. CubeRoot’s competition hub, schedule, scramble and registration stats all read from it.',
              zhHant: "世界魔方協會（WCA）比賽資料的標準 JSON 格式。一份 WCIF 完整描述一場比賽：報名選手、項目、輪次、賽程、成績。CubeRoot 站內的比賽中心、賽程、打亂、報名人數統計全靠它。"
        })}
        </p>
        <div className="wcif-hero-meta">
          <span>{tr({ zh: '版本 1.1 · 稳定', en: 'v1.1 · Stable',
              zhHant: "版本 1.1 · 穩定"
        })}</span>
          <span className="wcif-meta-sep">·</span>
          <a href="https://github.com/thewca/wcif/blob/stable/specification.md" target="_blank" rel="noopener noreferrer">
            {tr({ zh: '官方规范', en: 'Official spec',
                zhHant: "官方規範"
            })} ↗
          </a>
        </div>
      </header>

      {/* ── 端点 ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: '两个端点', en: 'Two endpoints',
            zhHant: "兩個端點"
        })}</h2>
        <p>
          {tr({
            zh: 'WCA 官网对每场比赛暴露两个 WCIF 端点。公开端点无需认证，但会裁剪掉私密字段（生日、邮箱、备注、未公布的串赛比赛等）；授权端点需要 OAuth 的比赛管理权限，返回完整数据。',
            en: 'The WCA website exposes two WCIF endpoints per competition. The public one needs no auth but strips private fields (birthdate, email, notes, unannounced series comps); the authorized one needs OAuth competition-manage scope and returns everything.',
              zhHant: "WCA 官網對每場比賽暴露兩個 WCIF 端點。公開端點無需認證，但會裁剪掉私密欄位（生日、郵箱、備註、未公佈的串賽比賽等）；授權端點需要 OAuth 的比賽管理許可權，返回完整資料。"
        })}
        </p>
        <pre className="wcif-code"><code>{`# 公开 / Public（无需认证）
GET https://www.worldcubeassociation.org/api/v0/competitions/{compId}/wcif/public

# 授权 / Authorized（需 OAuth manage_competitions）
GET https://www.worldcubeassociation.org/api/v0/competitions/{compId}/wcif`}</code></pre>
        <p className="wcif-note">
          {tr({
            zh: 'CubeRoot 全程只用公开端点：报名名单、轮次、赛程都在 persons / events / schedule 里，公开端点足够。',
            en: 'CubeRoot uses only the public endpoint — registration list, rounds and schedule all live in persons / events / schedule, which the public endpoint already provides.',
              zhHant: "CubeRoot 全程只用公開端點：報名名單、輪次、賽程都在 persons / events / schedule 裡，公開端點足夠。"
        })}
        </p>
      </section>

      {/* ── 顶层 ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: '顶层结构 · Competition', en: 'Top level · Competition',
            zhHant: "頂層結構 · Competition"
        })}</h2>
        <p>{tr({ zh: '根对象，整份 WCIF 就是它。', en: 'The root object — the whole WCIF is one Competition.',
            zhHant: "根物件，整份 WCIF 就是它。"
        })}</p>
        <Table>
          <Field k="id" type="String">{tr({ zh: '比赛唯一标识，如 WC2019。', en: 'Unique competition id, e.g. WC2019.',
              zhHant: "比賽唯一標識，如 WC2019。"
        })}</Field>
          <Field k="name" type="String">{tr({ zh: '比赛全名。', en: 'Full competition name.',
              zhHant: "比賽全名。"
        })}</Field>
          <Field k="persons" type="[Person]">{tr({ zh: '所有相关人员（选手 + 代表 + 组织者）。', en: 'Everyone involved (competitors + delegates + organizers).',
              zhHant: "所有相關人員（選手 + 代表 + 組織者）。"
        })}</Field>
          <Field k="events" type="[Event]">{tr({ zh: '比赛举办的所有项目。', en: 'All events held at the competition.',
              zhHant: "比賽舉辦的所有項目。"
        })}</Field>
          <Field k="schedule" type="Schedule">{tr({ zh: '场馆、房间、活动的时间安排。', en: 'Venues, rooms and timed activities.',
              zhHant: "場館、房間、活動的時間安排。"
        })}</Field>
          <Field k="registrationInfo" type="RegistrationInfo">{tr({ zh: '报名开关时间、费用、币种。', en: 'Registration open/close time, fee, currency.',
              zhHant: "報名開關時間、費用、幣種。"
        })}</Field>
          <Field k="competitorLimit" type="Integer|null">{tr({ zh: '整场人数上限（per-event 上限见 Event，但实践中几乎都为 null）。', en: 'Whole-competition competitor cap (per-event cap is on Event, but almost always null in practice).',
              zhHant: "整場人數上限（per-event 上限見 Event，但實踐中幾乎都為 null）。"
        })}</Field>
          <Field k="series" type="Series|null">{tr({ zh: '所属串联赛事，没有则为 null。', en: 'The competition series this belongs to, or null.',
              zhHant: "所屬串聯賽事，沒有則為 null。"
        })}</Field>
          <Field k="extensions" type="[Extension]">{tr({ zh: '自定义扩展数据（见下）。', en: 'Custom extension data (see below).',
              zhHant: "自定義擴充套件資料（見下）。"
        })}</Field>
        </Table>
      </section>

      {/* ── Person / Registration ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: 'Person · Registration', en: 'Person · Registration' })}</h2>
        <p>
          {tr({
            zh: 'persons 是 WCIF 的核心。每个 Person 的 registration 子对象记录这个人报了哪些项目、状态如何 —— CubeRoot 的「每个项目报名人数」就是把所有 accepted 选手的 registration.eventIds 累加出来的。',
            en: 'persons is the heart of a WCIF. Each Person’s registration sub-object records which events they signed up for and the status — CubeRoot’s per-event registrant counts come from tallying registration.eventIds across all accepted competitors.',
              zhHant: "persons 是 WCIF 的核心。每個 Person 的 registration 子物件記錄這個人報了哪些項目、狀態如何 —— CubeRoot 的「每個項目報名人數」就是把所有 accepted 選手的 registration.eventIds 累加出來的。"
        })}
        </p>
        <h3>Person</h3>
        <Table>
          <Field k="registrantId" type="Integer">{tr({ zh: '比赛内唯一人员号（Result.personId 引用它）。', en: 'Unique id within the comp (referenced by Result.personId).',
              zhHant: "比賽內唯一人員號（Result.personId 引用它）。"
        })}</Field>
          <Field k="wcaId" type="String|null">{tr({ zh: 'WCA ID，新手未有正式 ID 时为 null。', en: 'WCA ID; null for newcomers without one yet.',
              zhHant: "WCA ID，新手未有正式 ID 時為 null。"
        })}</Field>
          <Field k="name" type="String">{tr({ zh: '全名，可能含括号内本地名。', en: 'Full name, may include local name in parentheses.',
              zhHant: "全名，可能含括號內本地名。"
        })}</Field>
          <Field k="countryIso2" type="CountryCode">{tr({ zh: '国籍 ISO 3166-1 alpha-2。', en: 'Nationality, ISO 3166-1 alpha-2.',
              zhHant: "國籍 ISO 3166-1 alpha-2。"
        })}</Field>
          <Field k="roles" type="[Role]">{tr({ zh: 'delegate / organizer 等角色。', en: 'Roles like delegate / organizer.' })}</Field>
          <Field k="registration" type="Registration|null">{tr({ zh: '在线报名数据；纯工作人员可能为 null。', en: 'Online registration data; may be null for pure staff.',
              zhHant: "線上報名資料；純工作人員可能為 null。"
        })}</Field>
        </Table>
        <h3>Registration</h3>
        <Table>
          <Field k="eventIds" type="[String]">{tr({ zh: '该选手报名的项目短码列表，如 ["333","444"]。', en: 'Event ids the competitor registered for, e.g. ["333","444"].',
              zhHant: "該選手報名的項目短碼列表，如 [\"333\",\"444\"]。"
        })}</Field>
          <Field k="status" type='"accepted"|"pending"|"deleted"'>{tr({ zh: '报名状态。统计人数只数 accepted。', en: 'Registration status. Count only accepted for stats.',
              zhHant: "報名狀態。統計人數只數 accepted。"
        })}</Field>
          <Field k="isCompeting" type="Boolean">{tr({ zh: '是否作为选手参赛（区别于仅观赛/帮工）。', en: 'Whether registered as a competitor (vs. spectator/helper).',
              zhHant: "是否作為選手參賽（區別於僅觀賽/幫工）。"
        })}</Field>
        </Table>
        <pre className="wcif-code"><code>{`// CubeRoot：聚合每个项目的报名人数（零额外请求）
const eventRegs = {};
for (const p of wcif.persons) {
  if (p.registration?.status !== 'accepted') continue;
  for (const e of p.registration.eventIds) {
    eventRegs[e] = (eventRegs[e] ?? 0) + 1;
  }
}`}</code></pre>
      </section>

      {/* ── Event / Round ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: 'Event · Round', en: 'Event · Round' })}</h2>
        <h3>Event</h3>
        <Table>
          <Field k="id" type="String">{tr({ zh: 'WCA 项目码，如 333 / 444bf / 333mbf。', en: 'WCA event id, e.g. 333 / 444bf / 333mbf.',
              zhHant: "WCA 項目碼，如 333 / 444bf / 333mbf。"
        })}</Field>
          <Field k="rounds" type="[Round]">{tr({ zh: '该项目的所有轮次。', en: 'All rounds of this event.',
              zhHant: "該項目的所有輪次。"
        })}</Field>
          <Field k="competitorLimit" type="Integer|null">{tr({ zh: '单项目人数上限。规范里有这字段，但绝大多数比赛是 null。', en: 'Per-event competitor cap. The field exists in the spec but is null for the vast majority of comps.',
              zhHant: "單項目人數上限。規範裡有這欄位，但絕大多數比賽是 null。"
        })}</Field>
          <Field k="qualification" type="Qualification|null">{tr({ zh: '报名该项目的资格门槛（成绩 / 名次），通常 null。', en: 'Qualifying requirement to register (result / ranking), usually null.',
              zhHant: "報名該項目的資格門檻（成績 / 名次），通常 null。"
        })}</Field>
        </Table>
        <h3>Round</h3>
        <Table>
          <Field k="id" type="String">{tr({ zh: '形如 333-r1，也是合法的 ActivityCode。', en: 'Form {eventId}-r{n}, e.g. 333-r1; also a valid ActivityCode.' })}</Field>
          <Field k="format" type='"1"|"2"|"3"|"5"|"a"|"m"'>{tr({ zh: '赛制：取 1/2/3、5 次取 5、a=去头尾平均、m=平均。', en: 'Format: best of 1/2/3, best of 5, a = avg of 5, m = mean of 3.',
              zhHant: "賽制：取 1/2/3、5 次取 5、a=去頭尾平均、m=平均。"
        })}</Field>
          <Field k="cutoff" type="Cutoff|null">{tr({ zh: '及格线：前几把没过线则跳过剩余把数。', en: 'Cutoff: skip remaining attempts if first ones miss the bar.',
              zhHant: "及格線：前幾把沒過線則跳過剩餘把數。"
        })}</Field>
          <Field k="timeLimit" type="TimeLimit|null">{tr({ zh: '时间限制（厘秒）。MBLD / FM 为 null（规则固定）。', en: 'Time limit (centiseconds). null for MBLD / FM (fixed by regs).',
              zhHant: "時間限制（釐秒）。MBLD / FM 為 null（規則固定）。"
        })}</Field>
          <Field k="advancementCondition" type="AdvancementCondition|null">{tr({ zh: '晋级条件（前 N 名 / 前 X% / 优于成绩 Y）。注意这是「晋级名额」不是报名上限。', en: 'Advancement (top N / top X% / better than Y). This is advancement quota, NOT a registration cap.',
              zhHant: "晉級條件（前 N 名 / 前 X% / 優於成績 Y）。注意這是「晉級名額」不是報名上限。"
        })}</Field>
          <Field k="results" type="[Result]">{tr({ zh: '本轮所有成绩（比赛进行后才填）。', en: 'All results in this round (filled once held).',
              zhHant: "本輪所有成績（比賽進行後才填）。"
        })}</Field>
        </Table>
        <p className="wcif-note">
          {tr({
            zh: 'CubeRoot 列表里每个项目的「轮次数」就是 rounds.length；比赛结束前 results 为空，所以用轮次数和报名人数衡量热度。',
            en: 'The “round count” per event in CubeRoot’s list is just rounds.length; results are empty until the comp is held, so round count and registrant count are the pre-comp heat signals.',
              zhHant: "CubeRoot 列表裡每個項目的「輪次數」就是 rounds.length；比賽結束前 results 為空，所以用輪次數和報名人數衡量熱度。"
        })}
        </p>
      </section>

      {/* ── AttemptResult 编码 ── */}
      <section className="wcif-section wcif-section-accent">
        <h2>{tr({ zh: 'AttemptResult 编码', en: 'AttemptResult encoding',
            zhHant: "AttemptResult 編碼"
        })}</h2>
        <p>
          {tr({
            zh: '成绩用一个整数编码，越小越好。所有 best / average / 单把 result 都用这套。读 WCA 数据最容易踩坑的地方。',
            en: 'A single integer encodes every result — lower is better. Used by best / average / single attempt alike. The easiest place to trip up when reading WCA data.',
              zhHant: "成績用一個整數編碼，越小越好。所有 best / average / 單把 result 都用這套。讀 WCA 資料最容易踩坑的地方。"
        })}
        </p>
        <Table>
          <Field k="0" type="">{tr({ zh: '跳过的一把（如未过及格线）。', en: 'Skipped attempt (e.g. missed cutoff).',
              zhHant: "跳過的一把（如未過及格線）。"
        })}</Field>
          <Field k="-1" type="">{tr({ zh: 'DNF（Did Not Finish，未完成）。', en: 'DNF (Did Not Finish).' })}</Field>
          <Field k="-2" type="">{tr({ zh: 'DNS（Did Not Start，未开始）。', en: 'DNS (Did Not Start).',
              zhHant: "DNS（Did Not Start，未開始）。"
        })}</Field>
          <Field k="> 0" type="">{tr({ zh: '默认：厘秒数。如 1:10.25 → 7025。', en: 'Default: centiseconds. e.g. 1:10.25 → 7025.',
              zhHant: "預設：釐秒數。如 1:10.25 → 7025。"
        })}</Field>
        </Table>
        <p>
          {tr({ zh: '两个特例：', en: 'Two special events:',
              zhHant: "兩個特例："
        })}
        </p>
        <ul className="wcif-list">
          <li>
            <strong>{tr({ zh: '最少步（333fm）', en: 'Fewest Moves (333fm)' })}</strong>：
            {tr({ zh: '单次 = 步数本身（25 步 → 25）；平均 = 平均步数 ×100（25.33 → 2533）。', en: 'single = move count (25 moves → 25); average = avg ×100 (25.33 → 2533).',
                zhHant: "單次 = 步數本身（25 步 → 25）；平均 = 平均步數 ×100（25.33 → 2533）。"
            })}
          </li>
          <li>
            <strong>{tr({ zh: '多盲（333mbf）', en: 'Multi-Blind (333mbf)' })}</strong>：
            {tr({ zh: '编码为 0DDTTTTTMM —— 时间 TTTTT 秒、DD=99−成功差、MM=失败数；solved = (99−DD) + MM。', en: 'encoded 0DDTTTTTMM — time TTTTT seconds, DD = 99 − difference, MM = missed; solved = (99 − DD) + MM.',
                zhHant: "編碼為 0DDTTTTTMM —— 時間 TTTTT 秒、DD=99−成功差、MM=失敗數；solved = (99−DD) + MM。"
            })}
          </li>
        </ul>
      </section>

      {/* ── Result / Attempt ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: 'Result · Attempt', en: 'Result · Attempt' })}</h2>
        <Table>
          <Field k="Result.personId" type="Integer">{tr({ zh: '对应 Person.registrantId。', en: 'Maps to Person.registrantId.',
              zhHant: "對應 Person.registrantId。"
        })}</Field>
          <Field k="Result.ranking" type="Integer|null">{tr({ zh: '本轮名次，未录入时 null。', en: 'Ranking in this round; null when not yet entered.',
              zhHant: "本輪名次，未錄入時 null。"
        })}</Field>
          <Field k="Result.attempts" type="[Attempt]">{tr({ zh: '每一把的成绩列表。', en: 'List of per-attempt results.',
              zhHant: "每一把的成績列表。"
        })}</Field>
          <Field k="Result.best / average" type="AttemptResult">{tr({ zh: '最好成绩 / 平均（按赛制为 5 去头尾或 3 取平均）。', en: 'Best / average (avg-of-5 or mean-of-3 per format).',
              zhHant: "最好成績 / 平均（按賽制為 5 去頭尾或 3 取平均）。"
        })}</Field>
          <Field k="Attempt.result" type="AttemptResult">{tr({ zh: '这一把的成绩（同上编码）。', en: 'This attempt’s result (same encoding).',
              zhHant: "這一把的成績（同上編碼）。"
        })}</Field>
          <Field k="Attempt.reconstruction" type="String|null">{tr({ zh: '可选的复原步骤（CubeRoot 的复盘/recon 用到）。', en: 'Optional reconstruction (used by CubeRoot’s recon).',
              zhHant: "可選的復原步驟（CubeRoot 的覆盤/recon 用到）。"
        })}</Field>
        </Table>
      </section>

      {/* ── Schedule / Extension ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: 'Schedule · Extension', en: 'Schedule · Extension' })}</h2>
        <p>
          {tr({
            zh: 'schedule 是三层嵌套：Venue（场馆，含时区）→ Room（房间）→ Activity（活动，带起止时间，activityCode 形如 333-r1-g2 关联到具体轮次/分组）。CubeRoot 的比赛赛程 tab 就是把这棵树拍平后渲染。',
            en: 'schedule nests three levels: Venue (timezone) → Room → Activity (start/end time; activityCode like 333-r1-g2 links to a round/group). CubeRoot’s schedule tab flattens this tree to render.',
              zhHant: "schedule 是三層巢狀：Venue（場館，含時區）→ Room（房間）→ Activity（活動，帶起止時間，activityCode 形如 333-r1-g2 關聯到具體輪次/分組）。CubeRoot 的比賽賽程 tab 就是把這棵樹拍平後渲染。"
        })}
        </p>
        <p>
          {tr({
            zh: 'extensions 是规范的逃生舱：任何对象都能挂一组 { id, specUrl, data } 自定义数据，不破坏标准字段。WCA 注册系统、各类工具用它存额外信息。',
            en: 'extensions is the spec’s escape hatch: any object can carry { id, specUrl, data } custom blobs without breaking standard fields. The WCA registration system and various tools use it for extra info.',
              zhHant: "extensions 是規範的逃生艙：任何物件都能掛一組 { id, specUrl, data } 自定義資料，不破壞標準欄位。WCA 註冊系統、各類工具用它存額外資訊。"
        })}
        </p>
      </section>

      {/* ── CubeRoot 实战 ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: 'CubeRoot 怎么用它', en: 'How CubeRoot uses it',
            zhHant: "CubeRoot 怎麼用它"
        })}</h2>
        <ul className="wcif-list">
          <li>{tr({ zh: '比赛中心列表的轮次数 = events[].rounds.length；报名人数 = 聚合 persons[].registration.eventIds。同一份公开 WCIF 一次拉取全拿到。', en: 'List view round count = events[].rounds.length; registrant count = aggregated persons[].registration.eventIds. One public-WCIF fetch gets both.',
              zhHant: "比賽中心列表的輪次數 = events[].rounds.length；報名人數 = 聚合 persons[].registration.eventIds。同一份公開 WCIF 一次拉取全拿到。"
        })}</li>
          <li>{tr({ zh: '比赛赛程 tab 解析 schedule 的 venues / rooms / activities。', en: 'Schedule tab parses schedule’s venues / rooms / activities.',
              zhHant: "比賽賽程 tab 解析 schedule 的 venues / rooms / activities。"
        })}</li>
          <li>{tr({ zh: '顶尖选手近期比赛追踪：用 persons[].wcaId 与 top-cuber 名单交叉匹配。', en: 'Upcoming-comp tracking for top cubers: cross-match persons[].wcaId against the top-cuber list.',
              zhHant: "頂尖選手近期比賽追蹤：用 persons[].wcaId 與 top-cuber 名單交叉匹配。"
        })}</li>
          <li>{tr({ zh: '复盘（recon）：attempts[].reconstruction 即 WCA 官方存的复原步骤。', en: 'Recon: attempts[].reconstruction is the reconstruction stored by WCA.',
              zhHant: "覆盤（recon）：attempts[].reconstruction 即 WCA 官方存的復原步驟。"
        })}</li>
        </ul>
      </section>

      <footer className="wcif-foot">
        <a href="https://github.com/thewca/wcif" target="_blank" rel="noopener noreferrer">thewca/wcif ↗</a>
        <span className="wcif-meta-sep">·</span>
        <a href="https://github.com/thewca/worldcubeassociation.org/blob/main/lib/static_data/events.json" target="_blank" rel="noopener noreferrer">
          {tr({ zh: 'WCA 项目码', en: 'WCA event ids',
              zhHant: "WCA 項目碼"
        })} ↗
        </a>
        <span className="wcif-meta-sep">·</span>
        <AppLink href="/code">/code</AppLink>
      </footer>
    </div>
  );
}
