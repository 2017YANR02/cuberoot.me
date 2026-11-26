import { EDGE_FACELET, SOLVED_FACELET } from '@cuberoot/shared/cube-facelet';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { answerSiteQuestion, canReadPublicResult } from '../src/utils/site_assistant.js';
import { fullCubeHandoff } from '../src/utils/site_assistant_full_cube.js';
import { competitionScheduleRequest } from '../src/utils/site_assistant_competition_schedule.js';

const deadline = () => AbortSignal.timeout(5000);
const now = new Date('2026-11-24T18:00:00Z');
const scan = '/scramble/solver?event=333&view=photo';
const net = '/scramble/solver?event=333&view=net';
const json = (value: unknown) => new Response(JSON.stringify(value));

afterEach(() => vi.useRealTimers());

describe('complete 3×3 state handoff', () => {
  it('sends a photo solve to the six-face workflow without proposing a guessed state', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const result = await answerSiteQuestion('这张照片里的三阶魔方怎么复原？', 'zh', null, deadline(), fetcher, [], undefined, undefined, 'UTC', [{mediaType:'image/png',data:'test'}]);
    expect(result.actions?.map(action => action.href)).toEqual([scan, net]);
    expect(result.answer).toContain('六个面');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not redirect last-layer photos or unrelated images', () => {
    expect(fullCubeHandoff('这个 OLL 怎么还原？', true, 'zh')).toBeUndefined();
    expect(fullCubeHandoff('图里三阶魔方的最后一层怎么复原？', true, 'zh')).toBeUndefined();
    expect(fullCubeHandoff('Solve this picture puzzle', true, 'en')).toBeUndefined();
    expect(fullCubeHandoff('怎么还原这个二阶魔方？', true, 'zh')).toBeUndefined();
  });

  it('preserves a legal custom color scheme and only prefills its canonical state', async () => {
    const question = '求解这个三阶，贴纸编码：AAAAAAAAAEEEEEEEEEIIIIIIIIIOOOOOOOOOPPPPPPPPPSSSSSSSSS';
    const fetcher = vi.fn<typeof fetch>();
    expect(canReadPublicResult({ question, history: [] })).toBe(true);
    const result = await answerSiteQuestion(question, 'zh', null, deadline(), fetcher);
    expect(result.actions?.map(action => action.href)).toEqual([`${net}&facelets=${SOLVED_FACELET}`]);
    expect(result.answer).toContain('六面中心映射');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('validates explicitly supplied stickers before handing off to the board', async () => {
    const state = 'UUFUUFUUFRRRRRRRRRFFDFFDFFDDDBDDBDDBLLLLLLLLLUBBUBBUBB';
    const question = `我想求解完整三阶，请先验证再给我能预填的画板。贴纸编码：${state}`;
    const fetcher = vi.fn<typeof fetch>();
    expect(canReadPublicResult({ question, history: [] })).toBe(true);
    const result = await answerSiteQuestion(question, 'zh', null, deadline(), fetcher);
    expect(result.answer).toContain('合法的三阶局面');
    expect(result.actions?.map(action => action.href)).toEqual([`${net}&facelets=${state}`]);
    expect(fetcher).not.toHaveBeenCalled();
    expect(fullCubeHandoff(`验证 R U 从这个局面能否还原。贴纸编码：${state}`, false, 'zh')).toBeUndefined();
    expect(fullCubeHandoff('验证照片里的三阶能否还原', true, 'zh')).toBeUndefined();
  });

  it('separates unknown stickers from an unreachable state with one flipped edge', () => {
    const [a, b] = EDGE_FACELET[0];
    const flipped = [...SOLVED_FACELET];
    [flipped[a], flipped[b]] = [flipped[b], flipped[a]];
    const unknown = fullCubeHandoff(`求解三阶，贴纸：?${SOLVED_FACELET.slice(1)}`, false, 'zh');
    const invalid = fullCubeHandoff(`求解三阶，贴纸：${flipped.join('')}`, false, 'zh');
    expect(unknown?.answer).toContain('贴纸信息不足');
    expect(invalid?.answer).toContain('无法组成');
    expect(invalid?.actions?.map(action => action.href)).toEqual([net, scan]);
  });
});

const fixtureSchedule = {
  venues: [{timezone:'Asia/Shanghai',rooms:[{id:7}]}],
  rounds: {'333-r2':{roundNumber:2,totalRounds:2},'333-r1':{roundNumber:1,totalRounds:2}},
  activities: ['333-r1','333-r2','333oh-r1','333-r2-g1'].map((activityCode, index) => ({
    activityCode, roomId:7, roomName:'Main Hall', startTime:`2026-11-28T0${index + 1}:30:00Z`, endTime:`2026-11-28T0${index + 2}:00:00Z`,
  })),
};
const openRecord = (id: string) => ({
  id, name: id, use_wca_registration: true, registration_open:'2026-11-01T00:00:00Z',
  registration_close:'2026-11-26T00:00:00Z', 'registration_full?':false,
});

const organizerId = 'KunmingOpen2026';
const organizerPage = 'https://cubing.com/competition/Kunming-Open-2026';
const organizerApi = 'https://api.cubing.com/competitions/Kunming-Open-2026';
const wcaApi = `https://www.worldcubeassociation.org/api/v0/competitions/${organizerId}`;
const organizerRecord = { ...openRecord(organizerId), use_wca_registration: false, external_registration_page: `${organizerPage}/registration?k=opaque` };
const organizerMeta = {
  id: 20, alias: 'Kunming-Open-2026', wcaCompetitionId: organizerId, status: 'announced',
  registrationStartTime: '2026-11-01T12:00:00Z', registrationEndTime: '2026-11-26T12:00:00Z',
  locations: [{ id: 11, regionIso2: 'CN' }], events: [{ eventId: '333', roundCount: 2 }],
};
const organizerSeats = (acceptedCount: number) => ({ limitType: 'per-competitor', overall: { limit: 90, acceptedCount, remaining: 90 - acceptedCount } });
const organizerSlot = {
  id: 30, competitionId: 20, scheduleType: 'event', eventId: '333', round: { eventId: '333', roundNumber: 2 },
  startTime: '2026-11-28T04:30:00Z', endTime: '2026-11-28T04:45:00Z',
  group: 2, attempt: null, venueId: 22, venue: { id: 22, competitionLocationId: 11, name: 'Second stage', nameZh: '二号赛台' },
};

describe('public organizer and group evidence', () => {
  it('separates a full active window, unknown waitlist eligibility and personal acceptance', async () => {
    vi.setSystemTime(now);
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => {
      if (url === wcaApi) return json(organizerRecord);
      if (url === organizerApi) return json(organizerMeta);
      if (url === `${organizerApi}/registration/availability`) return json(organizerSeats(90));
      throw new Error(`Unexpected read ${url}`);
    });
    const result = await answerSiteQuestion('KunmingOpen2026 额满了吗？还能加候补吗？我的报名已受理了吗？', 'zh', null, deadline(), fetcher);
    expect(result.answer).toContain('主办方显示名额已满');
    expect(result.answer).toContain('90/90，剩余 0');
    expect(result.answer).toContain('公开来源未确认能否加入候补');
    expect(result.answer).toContain('需要登录报名页查看个人状态');
    expect(result.sources.find(source => source.href === `${organizerPage}/registration`)?.read).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(result)).not.toContain('opaque');
  });

  it.each([
    [{}, '主办方报名时段已开放'],
    [{ hasBeenFull: true, registrationReopenTime: '2026-11-25T12:00:00Z' }, '报名暂时暂停'],
    [{ hasBeenFull: true, registrationReopenTime: '2026-11-23T12:00:00Z' }, '已重新开放'],
    [{ registrationEndTime: '2026-11-24T18:00:00Z' }, '报名时段已结束'],
  ])('separates window phase from currently vacant places: %s', async (extra, status) => {
    vi.setSystemTime(now);
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => json(url === wcaApi ? organizerRecord
      : url === organizerApi ? { ...organizerMeta, ...extra } : organizerSeats(89)));
    const result = await answerSiteQuestion('KunmingOpen2026 现在还可以报名吗？', 'zh', null, deadline(), fetcher);
    expect(result.answer).toContain(status);
    expect(result.answer).toContain('89/90，剩余 1');
  });

  it('keeps a confirmed organizer group slot when the capacity endpoint times out', async () => {
    vi.setSystemTime(now);
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => {
      if (url === wcaApi) return json(organizerRecord);
      if (url === organizerApi) return json(organizerMeta);
      if (url === `${organizerApi}/schedule`) return json([organizerSlot, { ...organizerSlot, id: 31, group: 3 }]);
      if (url === `${organizerApi}/registration/availability` || String(url).includes('/wcif/public')) throw new DOMException('Timed out', 'TimeoutError');
      return json({ schedule: fixtureSchedule });
    });
    const question = 'KunmingOpen2026 三阶决赛第二组几点开始？还能报名吗？';
    const result = await answerSiteQuestion(question, 'zh', null, deadline(), fetcher);
    expect(result.answer).toContain('核实到 1 个公开分组时段');
    expect(result.answer).toContain('报名时段已开放，暂时无法核实名额');
    expect(result.artifacts?.[0]).toMatchObject({ rows: [['三阶','第 2 轮（决赛）','2','2026-11-28 12:30','2026-11-28 12:45','Asia/Shanghai','二号赛台']] });
    expect(result.sources.find(source => source.href === `${organizerPage}/schedule`)?.read).toBe(true);
  });

  it('keeps the WCA round block and public registration if the organizer and WCIF fail', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => {
      if (url === wcaApi) return json(organizerRecord);
      if (String(url).startsWith('https://api.cuberoot.me/')) return json({ schedule: fixtureSchedule });
      throw new DOMException('Timed out', 'TimeoutError');
    });
    const result = await answerSiteQuestion('KunmingOpen2026 三阶第2组几点？还能报名吗？', 'zh', null, deadline(), fetcher);
    expect(result.answer).toContain('表中为整个轮次的时间');
    expect(result.answer).toContain('暂时无法核实主办方报名时段和名额');
    expect(result.artifacts?.[0]).toMatchObject({ rows: [
      ['三阶','第 1 轮','2026-11-28 09:30','2026-11-28 10:00','Asia/Shanghai','Main Hall'],
      ['三阶','第 2 轮（决赛）','2026-11-28 10:30','2026-11-28 11:00','Asia/Shanghai','Main Hall'],
    ] });
    expect(result.sources.find(source => source.href === `${organizerPage}/registration`)?.read).toBe(false);
  });

  it('uses public WCIF child activities on legacy caches without exposing assignments', async () => {
    const id = 'StockholmOpen2026';
    const round = { ...fixtureSchedule.activities[0], id: 10, activityCode: '333-r1', name: 'Round 1' };
    const group = { ...round, id: 11, activityCode: '333-r1-gB', startTime: '2026-11-28T01:45:00Z' };
    const publicFile = {
      id, persons: [{ name: 'Not part of a schedule answer', assignments: [{ activityId: 11 }] }],
      schedule: { startDate: '2026-11-28', numberOfDays: 1, venues: [{ id: 8, name: 'Venue', timezone: 'Europe/Stockholm',
        rooms: [{ id: 7, name: 'Blue', activities: [{ ...round, childActivities: [{ ...group, childActivities: [
          { ...group, id: 13, activityCode: '333-r1-gB-a1', startTime: '2026-11-28T01:48:00Z' },
        ] }, { ...group, id: 12, activityCode: '333-r1-gC' }] }] }],
      }] },
    };
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => {
      if (String(url).endsWith('/wcif/public')) return json(publicFile);
      if (String(url).endsWith('/schedule')) return json({ schedule: fixtureSchedule });
      return json({ id });
    });
    const result = await answerSiteQuestion('StockholmOpen2026 3x3 Round 1, when is Group B in venue time?', 'en', null, deadline(), fetcher);
    expect(result.artifacts?.[0]).toMatchObject({ rows: [['3×3','Round 1','B','2026-11-28 02:45','2026-11-28 03:00','Europe/Stockholm','Blue']] });
    expect(result.sources[0].href).toContain('/wcif/public');
    expect(JSON.stringify(result)).not.toContain('Not part of a schedule answer');
  });

  it('rejects a mismatched organizer identity and retains the WCA competition dates on schedule failure', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => {
      if (url === wcaApi) return json({ ...organizerRecord, start_date: '2026-11-28', end_date: '2026-11-29' });
      if (url === organizerApi) return json({ ...organizerMeta, wcaCompetitionId: 'OtherOpen2026' });
      if (url === `${organizerApi}/schedule`) return json([organizerSlot]);
      throw new DOMException('Timed out', 'TimeoutError');
    });
    const result = await answerSiteQuestion('KunmingOpen2026 有公开的三阶分组赛程吗？', 'zh', null, deadline(), fetcher);
    expect(result.answer).toContain('WCA 公示的比赛日期为 2026-11-28 – 2026-11-29');
    expect(result.artifacts).toHaveLength(0);
    expect(result.sources).toContainEqual(expect.objectContaining({ href: `https://www.worldcubeassociation.org/competitions/${organizerId}`, read: true }));
  });

  it('shows an official waiting list deadline without claiming that the user can enter it', async () => {
    vi.setSystemTime(now);
    const id = 'BergenOpen2026';
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ ...openRecord(id), 'registration_full?': true,
      waiting_list_deadline_date: '2026-11-25T17:00:00Z' }));
    const result = await answerSiteQuestion('For BergenOpen2026, can I join the waiting list if the competition is full?', 'en', null, deadline(), fetcher);
    expect(result.answer).toContain('marks capacity as full');
    expect(result.answer).toContain('waitlist processing deadline of 2026-11-25 17:00 UTC');
    expect(result.answer).toContain('Check the registration page for whether new entries are accepted');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('beginner learning handoff', () => {
  it('answers a full layer-by-layer overview with the existing lesson', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const result = await answerSiteQuestion('我刚拿到三阶魔方，准备学层先法。整个复原从哪开始，后面分哪几步？', 'zh', null, deadline(), fetcher);
    expect(result.answer).toContain('先做小花和白十字');
    expect(result.answer).toContain('四个侧面的底排也要和各自的中心同色');
    expect(result.actions?.map(action => action.href)).toEqual(['/tutorial/lbl?step=structure&section=overview']);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('public WCA schedule and registration', () => {
  it('reads final-round venue time and official registration without calling a model', async () => {
    vi.setSystemTime(now);
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => String(url).endsWith('/schedule')
      ? json({schedule:fixtureSchedule}) : json(openRecord('ShanghaiOpen2026')));
    const result = await answerSiteQuestion('ShanghaiOpen2026 三阶决赛几点，还能报名吗？', 'zh', null, deadline(), fetcher);
    const [table] = result.artifacts ?? [];
    expect(table).toMatchObject({kind:'table',rows:[['三阶','第 2 轮（决赛）','2026-11-28 10:30','2026-11-28 11:00','Asia/Shanghai','Main Hall']]});
    expect(result.answer).toContain('官方尚未标记额满');
    expect(result.actions?.map(action => action.href)).toEqual([
      '/wca/comp/ShanghaiOpen2026?view=schedule', 'https://www.worldcubeassociation.org/competitions/ShanghaiOpen2026/register',
    ]);
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      'https://api.cuberoot.me/v1/wca/comp/ShanghaiOpen2026/schedule', 'https://www.worldcubeassociation.org/api/v0/competitions/ShanghaiOpen2026',
    ]);
  });

  it('keeps both English round selectors when registration is a second question', async () => {
    vi.setSystemTime(now);
    const pocketSchedule = {
      ...fixtureSchedule,
      rounds: { '222-r1': {roundNumber:1,totalRounds:2}, '222-r2': {roundNumber:2,totalRounds:2} },
      activities: [...fixtureSchedule.activities, ...fixtureSchedule.activities.slice(0, 2).map((slot, i) => ({
        ...slot, activityCode: `222-r${i + 1}`,
      }))],
    };
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => String(url).endsWith('/schedule')
      ? json({ schedule:pocketSchedule }) : json({...openRecord('WC2025'),registration_close:'2025-07-04T00:00:00Z',registration_open:'2025-06-04T00:00:00Z'}));
    const question = 'For WC2025, show the opening round and the final of 2×2 in venue time. Is registration still open?';
    const result = await answerSiteQuestion(question, 'en', null, deadline(), fetcher);
    const table = result.artifacts?.find(artifact => artifact.kind === 'table');
    expect(table?.rows.map(row => row[1])).toEqual(['Round 1','Round 2 (final)']);
    expect(table?.rows.every(row => row[0] === '2×2' || row[0] === '2x2')).toBe(true);
    expect(result.answer).toContain('The registration window has closed');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('compares only the two requested round start times', async () => {
    const extendedSchedule = {
      ...fixtureSchedule,
      rounds: Object.fromEntries([1, 2, 3].map(roundNumber => [`333-r${roundNumber}`, {roundNumber,totalRounds:3}])),
      activities: [...fixtureSchedule.activities, {...fixtureSchedule.activities[1], activityCode:'333-r3', startTime:'2026-11-28T04:30:00Z', endTime:'2026-11-28T05:00:00Z'}],
    };
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => json({schedule:extendedSchedule}));
    const result = await answerSiteQuestion('WC2025 三阶第二轮、第三轮各是当地什么时候？只比较这两轮的开赛时间。', 'zh', null, deadline(), fetcher);
    const table = result.artifacts?.find(artifact => artifact.kind === 'table');
    expect(table?.rows.map(row => row.slice(1,3))).toEqual([['第 2 轮','2026-11-28 10:30'],['第 3 轮（决赛）','2026-11-28 12:30']]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(competitionScheduleRequest('WC2025 三阶首轮和决赛分别几点？顺便给我三阶世界纪录。')).toBeUndefined();
    expect(competitionScheduleRequest('WC2025 三阶第2组几点开始？')).toMatchObject({event:'333',groups:true,group:'2'});
    expect(competitionScheduleRequest('WC2025 二阶首轮和三阶决赛的赛程')).toBeUndefined();
    expect(competitionScheduleRequest('WC2025 三阶首轮和三阶决赛的赛程')).toMatchObject({event:'333',rounds:['first','final']});
  });

  it('returns the first round and final from a single schedule read, and names an unavailable round', async () => {
    const crowded = { ...fixtureSchedule, activities: [...Array.from({ length: 12 }, (_, id) => ({
      ...fixtureSchedule.activities[0], id,
    })), ...fixtureSchedule.activities.slice(1)] };
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => json({ schedule: crowded }));
    const result = await answerSiteQuestion('ShanghaiOpen2026 三阶首轮和决赛分别几点？', 'zh', null, deadline(), fetcher);
    const table = result.artifacts?.find(artifact => artifact.kind === 'table');
    expect(table?.rows).toHaveLength(12);
    expect(new Set(table?.rows.map(row => row[1]))).toEqual(new Set(['第 1 轮', '第 2 轮（决赛）']));
    expect(fetcher).toHaveBeenCalledTimes(1);

    const partial = await answerSiteQuestion('ShanghaiOpen2026 三阶第三轮和决赛分别几点？', 'zh', null, deadline(), fetcher);
    expect(partial.answer).toContain('现有赛程未核实到第 3 轮');
    expect(partial.artifacts?.find(artifact => artifact.kind === 'table')?.rows).toHaveLength(1);
  });

  it('preserves external-registration and capacity evidence when schedule data is missing', async () => {
    vi.setSystemTime(now);
    const question = 'ShanghaiOpen2026 三阶赛程和报名状态';
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => String(url).endsWith('/schedule')
      ? json({schedule:null}) : json({...openRecord('ShanghaiOpen2026'),use_wca_registration:false,external_registration_page:'https://organizer.example/registration'}));
    const result = await answerSiteQuestion(question, 'zh', null, deadline(), fetcher);
    expect(result.answer).toContain('公开来源未提供赛程');
    expect(result.answer).toContain('使用外部报名');
    expect(result.actions?.some(action => action.href.includes('organizer.example'))).toBe(false);
    const full = vi.fn<typeof fetch>().mockResolvedValue(json({...openRecord('ShanghaiOpen2026'),'registration_full?':true}));
    const registration = await answerSiteQuestion('ShanghaiOpen2026 还能报名吗？', 'zh', null, deadline(), full);
    expect(registration.answer).toContain('官方标记名额已满');
    expect(full).toHaveBeenCalledTimes(1);
  });

  it.each([
    '周末上海有哪些还能报名的比赛？三阶几点？上次参加的那场呢？',
    '这周末上海有哪些比赛还能报名？三阶几点？上次参加的那场呢？',
    '上海这周末有哪些比赛还能报名？三阶首轮和决赛分别几点？上次参加的那场呢？',
    '上海周末有什么比赛还能报名？三阶几点？上次参加的那场呢？',
  ])('joins city, weekend, round time and the linked viewer’s last competition: %s', async question => {
    vi.setSystemTime(now);
    const comp = (id: string, start: string, city: string) => ({id,name:id,city,country:'CN',start_date:start,end_date:start});
    const current = comp('ShanghaiOpen2026','2026-11-28','Shanghai, Shanghai');
    const previous = comp('BeijingOpen2025','2025-08-01','Beijing');
    const otherCity = comp('ShanghaiSponsor2026','2026-11-28','Beijing');
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => {
      const href = String(url);
      if (href.endsWith('/comp_names_zh.json')) return json({});
      if (href.endsWith('/all_upcoming_comps.json')) return json([current,otherCity]);
      if (href.includes('/person-page?wcaId=2017YANR02')) return json({profile:{person:{name:'Viewer'}},comps:[previous],results:[{competition_id:previous.id}]});
      if (href.endsWith('/historical-ranks/meta')) return json({lastImportedAt:'2026-11-23T23:00:00Z'});
      if (href.endsWith('/schedule')) return json({schedule:fixtureSchedule});
      if (href.endsWith('/ShanghaiOpen2026')) return json(openRecord(current.id));
      throw new Error(`Unexpected read ${href}`);
    });
    expect(canReadPublicResult({ question, history: [] })).toBe(true);
    const result = await answerSiteQuestion(question, 'zh', null, deadline(), fetcher, [], '2017YANR02', undefined, 'Asia/Shanghai');
    expect(result.answer).toContain('2026-11-28 至 2026-11-29');
    expect(result.answer).toContain('ShanghaiOpen2026');
    expect(result.answer).toContain('BeijingOpen2025');
    expect(result.answer).not.toContain(otherCity.id);
    expect(result.artifacts).toHaveLength(3);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/schedule'))).toHaveLength(2);
  });
});
