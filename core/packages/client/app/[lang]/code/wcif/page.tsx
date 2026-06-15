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
            <th>{tr({ zh: '字段', en: 'Field'
            })}</th>
            <th>{tr({ zh: '类型', en: 'Type'
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

export default function WcifPage() {
  useDocumentTitle('WCIF', 'WCIF');

  return (
    <div className="wcif-page">
      <div className="wcif-topbar">
        <HomeLink className="wcif-back">← {tr({ zh: '回首页', en: 'Home'
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
            en: 'The standard JSON format for World Cube Association (WCA) competition data. One WCIF fully describes a competition: registered competitors, events, rounds, schedule, results. CubeRoot’s competition hub, schedule, scramble and registration stats all read from it.'
        })}
        </p>
        <div className="wcif-hero-meta">
          <span>{tr({ zh: '版本 1.1 · 稳定', en: 'v1.1 · Stable'
        })}</span>
          <span className="wcif-meta-sep">·</span>
          <a href="https://github.com/thewca/wcif/blob/stable/specification.md" target="_blank" rel="noopener noreferrer">
            {tr({ zh: '官方规范', en: 'Official spec'
            })} ↗
          </a>
        </div>
      </header>

      {/* ── 端点 ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: '两个端点', en: 'Two endpoints'
        })}</h2>
        <p>
          {tr({
            zh: 'WCA 官网对每场比赛暴露两个 WCIF 端点。公开端点无需认证，但会裁剪掉私密字段（生日、邮箱、备注、未公布的串赛比赛等）；授权端点需要 OAuth 的比赛管理权限，返回完整数据。',
            en: 'The WCA website exposes two WCIF endpoints per competition. The public one needs no auth but strips private fields (birthdate, email, notes, unannounced series comps); the authorized one needs OAuth competition-manage scope and returns everything.'
        })}
        </p>
        <pre className="wcif-code"><code>{`# 公开 / Public（无需认证）
GET https://www.worldcubeassociation.org/api/v0/competitions/{compId}/wcif/public

# 授权 / Authorized（需 OAuth manage_competitions）
GET https://www.worldcubeassociation.org/api/v0/competitions/{compId}/wcif`}</code></pre>
        <p className="wcif-note">
          {tr({
            zh: 'CubeRoot 全程只用公开端点：报名名单、轮次、赛程都在 persons / events / schedule 里，公开端点足够。',
            en: 'CubeRoot uses only the public endpoint — registration list, rounds and schedule all live in persons / events / schedule, which the public endpoint already provides.'
        })}
        </p>
      </section>

      {/* ── 顶层 ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: '顶层结构 · Competition', en: 'Top level · Competition'
        })}</h2>
        <p>{tr({ zh: '根对象，整份 WCIF 就是它。', en: 'The root object — the whole WCIF is one Competition.'
        })}</p>
        <Table>
          <Field k="id" type="String">{tr({ zh: '比赛唯一标识，如 WC2019。', en: 'Unique competition id, e.g. WC2019.'
        })}</Field>
          <Field k="name" type="String">{tr({ zh: '比赛全名。', en: 'Full competition name.'
        })}</Field>
          <Field k="persons" type="[Person]">{tr({ zh: '所有相关人员（选手 + 代表 + 组织者）。', en: 'Everyone involved (competitors + delegates + organizers).'
        })}</Field>
          <Field k="events" type="[Event]">{tr({ zh: '比赛举办的所有项目。', en: 'All events held at the competition.'
        })}</Field>
          <Field k="schedule" type="Schedule">{tr({ zh: '场馆、房间、活动的时间安排。', en: 'Venues, rooms and timed activities.'
        })}</Field>
          <Field k="registrationInfo" type="RegistrationInfo">{tr({ zh: '报名开关时间、费用、币种。', en: 'Registration open/close time, fee, currency.'
        })}</Field>
          <Field k="competitorLimit" type="Integer|null">{tr({ zh: '整场人数上限（per-event 上限见 Event，但实践中几乎都为 null）。', en: 'Whole-competition competitor cap (per-event cap is on Event, but almost always null in practice).'
        })}</Field>
          <Field k="series" type="Series|null">{tr({ zh: '所属串联赛事，没有则为 null。', en: 'The competition series this belongs to, or null.'
        })}</Field>
          <Field k="extensions" type="[Extension]">{tr({ zh: '自定义扩展数据（见下）。', en: 'Custom extension data (see below).'
        })}</Field>
        </Table>
      </section>

      {/* ── Person / Registration ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: 'Person · Registration', en: 'Person · Registration' })}</h2>
        <p>
          {tr({
            zh: 'persons 是 WCIF 的核心。每个 Person 的 registration 子对象记录这个人报了哪些项目、状态如何 —— CubeRoot 的「每个项目报名人数」就是把所有 accepted 选手的 registration.eventIds 累加出来的。',
            en: 'persons is the heart of a WCIF. Each Person’s registration sub-object records which events they signed up for and the status — CubeRoot’s per-event registrant counts come from tallying registration.eventIds across all accepted competitors.'
        })}
        </p>
        <h3>Person</h3>
        <Table>
          <Field k="registrantId" type="Integer">{tr({ zh: '比赛内唯一人员号（Result.personId 引用它）。', en: 'Unique id within the comp (referenced by Result.personId).'
        })}</Field>
          <Field k="wcaId" type="String|null">{tr({ zh: 'WCA ID，新手未有正式 ID 时为 null。', en: 'WCA ID; null for newcomers without one yet.'
        })}</Field>
          <Field k="name" type="String">{tr({ zh: '全名，可能含括号内本地名。', en: 'Full name, may include local name in parentheses.'
        })}</Field>
          <Field k="countryIso2" type="CountryCode">{tr({ zh: '国籍 ISO 3166-1 alpha-2。', en: 'Nationality, ISO 3166-1 alpha-2.'
        })}</Field>
          <Field k="roles" type="[Role]">{tr({ zh: 'delegate / organizer 等角色。', en: 'Roles like delegate / organizer.' })}</Field>
          <Field k="registration" type="Registration|null">{tr({ zh: '在线报名数据；纯工作人员可能为 null。', en: 'Online registration data; may be null for pure staff.'
        })}</Field>
        </Table>
        <h3>Registration</h3>
        <Table>
          <Field k="eventIds" type="[String]">{tr({ zh: '该选手报名的项目短码列表，如 ["333","444"]。', en: 'Event ids the competitor registered for, e.g. ["333","444"].'
        })}</Field>
          <Field k="status" type='"accepted"|"pending"|"deleted"'>{tr({ zh: '报名状态。统计人数只数 accepted。', en: 'Registration status. Count only accepted for stats.'
        })}</Field>
          <Field k="isCompeting" type="Boolean">{tr({ zh: '是否作为选手参赛（区别于仅观赛/帮工）。', en: 'Whether registered as a competitor (vs. spectator/helper).'
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
          <Field k="id" type="String">{tr({ zh: 'WCA 项目码，如 333 / 444bf / 333mbf。', en: 'WCA event id, e.g. 333 / 444bf / 333mbf.'
        })}</Field>
          <Field k="rounds" type="[Round]">{tr({ zh: '该项目的所有轮次。', en: 'All rounds of this event.'
        })}</Field>
          <Field k="competitorLimit" type="Integer|null">{tr({ zh: '单项目人数上限。规范里有这字段，但绝大多数比赛是 null。', en: 'Per-event competitor cap. The field exists in the spec but is null for the vast majority of comps.'
        })}</Field>
          <Field k="qualification" type="Qualification|null">{tr({ zh: '报名该项目的资格门槛（成绩 / 名次），通常 null。', en: 'Qualifying requirement to register (result / ranking), usually null.'
        })}</Field>
        </Table>
        <h3>Round</h3>
        <Table>
          <Field k="id" type="String">{tr({ zh: '形如 333-r1，也是合法的 ActivityCode。', en: 'Form {eventId}-r{n}, e.g. 333-r1; also a valid ActivityCode.' })}</Field>
          <Field k="format" type='"1"|"2"|"3"|"5"|"a"|"m"'>{tr({ zh: '赛制：取 1/2/3、5 次取 5、a=去头尾平均、m=平均。', en: 'Format: best of 1/2/3, best of 5, a = avg of 5, m = mean of 3.'
        })}</Field>
          <Field k="cutoff" type="Cutoff|null">{tr({ zh: '及格线：前几把没过线则跳过剩余把数。', en: 'Cutoff: skip remaining attempts if first ones miss the bar.'
        })}</Field>
          <Field k="timeLimit" type="TimeLimit|null">{tr({ zh: '时间限制（厘秒）。MBLD / FM 为 null（规则固定）。', en: 'Time limit (centiseconds). null for MBLD / FM (fixed by regs).'
        })}</Field>
          <Field k="advancementCondition" type="AdvancementCondition|null">{tr({ zh: '晋级条件（前 N 名 / 前 X% / 优于成绩 Y）。注意这是「晋级名额」不是报名上限。', en: 'Advancement (top N / top X% / better than Y). This is advancement quota, NOT a registration cap.'
        })}</Field>
          <Field k="results" type="[Result]">{tr({ zh: '本轮所有成绩（比赛进行后才填）。', en: 'All results in this round (filled once held).'
        })}</Field>
        </Table>
        <p className="wcif-note">
          {tr({
            zh: 'CubeRoot 列表里每个项目的「轮次数」就是 rounds.length；比赛结束前 results 为空，所以用轮次数和报名人数衡量热度。',
            en: 'The “round count” per event in CubeRoot’s list is just rounds.length; results are empty until the comp is held, so round count and registrant count are the pre-comp heat signals.'
        })}
        </p>
      </section>

      {/* ── AttemptResult 编码 ── */}
      <section className="wcif-section wcif-section-accent">
        <h2>{tr({ zh: 'AttemptResult 编码', en: 'AttemptResult encoding'
        })}</h2>
        <p>
          {tr({
            zh: '成绩用一个整数编码，越小越好。所有 best / average / 单把 result 都用这套。读 WCA 数据最容易踩坑的地方。',
            en: 'A single integer encodes every result — lower is better. Used by best / average / single attempt alike. The easiest place to trip up when reading WCA data.'
        })}
        </p>
        <Table>
          <Field k="0" type="">{tr({ zh: '跳过的一把（如未过及格线）。', en: 'Skipped attempt (e.g. missed cutoff).'
        })}</Field>
          <Field k="-1" type="">{tr({ zh: 'DNF（Did Not Finish，未完成）。', en: 'DNF (Did Not Finish).' })}</Field>
          <Field k="-2" type="">{tr({ zh: 'DNS（Did Not Start，未开始）。', en: 'DNS (Did Not Start).'
        })}</Field>
          <Field k="> 0" type="">{tr({ zh: '默认：厘秒数。如 1:10.25 → 7025。', en: 'Default: centiseconds. e.g. 1:10.25 → 7025.'
        })}</Field>
        </Table>
        <p>
          {tr({ zh: '两个特例：', en: 'Two special events:'
        })}
        </p>
        <ul className="wcif-list">
          <li>
            <strong>{tr({ zh: '最少步（333fm）', en: 'Fewest Moves (333fm)' })}</strong>：
            {tr({ zh: '单次 = 步数本身（25 步 → 25）；平均 = 平均步数 ×100（25.33 → 2533）。', en: 'single = move count (25 moves → 25); average = avg ×100 (25.33 → 2533).'
            })}
          </li>
          <li>
            <strong>{tr({ zh: '多盲（333mbf）', en: 'Multi-Blind (333mbf)' })}</strong>：
            {tr({ zh: '编码为 0DDTTTTTMM —— 时间 TTTTT 秒、DD=99−成功差、MM=失败数；solved = (99−DD) + MM。', en: 'encoded 0DDTTTTTMM — time TTTTT seconds, DD = 99 − difference, MM = missed; solved = (99 − DD) + MM.'
            })}
          </li>
        </ul>
      </section>

      {/* ── Result / Attempt ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: 'Result · Attempt', en: 'Result · Attempt' })}</h2>
        <Table>
          <Field k="Result.personId" type="Integer">{tr({ zh: '对应 Person.registrantId。', en: 'Maps to Person.registrantId.'
        })}</Field>
          <Field k="Result.ranking" type="Integer|null">{tr({ zh: '本轮名次，未录入时 null。', en: 'Ranking in this round; null when not yet entered.'
        })}</Field>
          <Field k="Result.attempts" type="[Attempt]">{tr({ zh: '每一把的成绩列表。', en: 'List of per-attempt results.'
        })}</Field>
          <Field k="Result.best / average" type="AttemptResult">{tr({ zh: '最好成绩 / 平均（按赛制为 5 去头尾或 3 取平均）。', en: 'Best / average (avg-of-5 or mean-of-3 per format).'
        })}</Field>
          <Field k="Attempt.result" type="AttemptResult">{tr({ zh: '这一把的成绩（同上编码）。', en: 'This attempt’s result (same encoding).'
        })}</Field>
          <Field k="Attempt.reconstruction" type="String|null">{tr({ zh: '可选的复原步骤（CubeRoot 的复盘/recon 用到）。', en: 'Optional reconstruction (used by CubeRoot’s recon).'
        })}</Field>
        </Table>
      </section>

      {/* ── Schedule / Extension ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: 'Schedule · Extension', en: 'Schedule · Extension' })}</h2>
        <p>
          {tr({
            zh: 'schedule 是三层嵌套：Venue（场馆，含时区）→ Room（房间）→ Activity（活动，带起止时间，activityCode 形如 333-r1-g2 关联到具体轮次/分组）。CubeRoot 的比赛赛程 tab 就是把这棵树拍平后渲染。',
            en: 'schedule nests three levels: Venue (timezone) → Room → Activity (start/end time; activityCode like 333-r1-g2 links to a round/group). CubeRoot’s schedule tab flattens this tree to render.'
        })}
        </p>
        <p>
          {tr({
            zh: 'extensions 是规范的逃生舱：任何对象都能挂一组 { id, specUrl, data } 自定义数据，不破坏标准字段。WCA 注册系统、各类工具用它存额外信息。',
            en: 'extensions is the spec’s escape hatch: any object can carry { id, specUrl, data } custom blobs without breaking standard fields. The WCA registration system and various tools use it for extra info.'
        })}
        </p>
      </section>

      {/* ── CubeRoot 实战 ── */}
      <section className="wcif-section">
        <h2>{tr({ zh: 'CubeRoot 怎么用它', en: 'How CubeRoot uses it'
        })}</h2>
        <ul className="wcif-list">
          <li>{tr({ zh: '比赛中心列表的轮次数 = events[].rounds.length；报名人数 = 聚合 persons[].registration.eventIds。同一份公开 WCIF 一次拉取全拿到。', en: 'List view round count = events[].rounds.length; registrant count = aggregated persons[].registration.eventIds. One public-WCIF fetch gets both.'
        })}</li>
          <li>{tr({ zh: '比赛赛程 tab 解析 schedule 的 venues / rooms / activities。', en: 'Schedule tab parses schedule’s venues / rooms / activities.'
        })}</li>
          <li>{tr({ zh: '顶尖选手近期比赛追踪：用 persons[].wcaId 与 top-cuber 名单交叉匹配。', en: 'Upcoming-comp tracking for top cubers: cross-match persons[].wcaId against the top-cuber list.'
        })}</li>
          <li>{tr({ zh: '复盘（recon）：attempts[].reconstruction 即 WCA 官方存的复原步骤。', en: 'Recon: attempts[].reconstruction is the reconstruction stored by WCA.'
        })}</li>
        </ul>
      </section>

      <footer className="wcif-foot">
        <a href="https://github.com/thewca/wcif" target="_blank" rel="noopener noreferrer">thewca/wcif ↗</a>
        <span className="wcif-meta-sep">·</span>
        <a href="https://github.com/thewca/worldcubeassociation.org/blob/main/lib/static_data/events.json" target="_blank" rel="noopener noreferrer">
          {tr({ zh: 'WCA 项目码', en: 'WCA event ids'
        })} ↗
        </a>
        <span className="wcif-meta-sep">·</span>
        <AppLink href="/code">/code</AppLink>
      </footer>
    </div>
  );
}
