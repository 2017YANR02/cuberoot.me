import { describe, expect, it } from 'vitest';
import { scenarioTableReader } from '../src/utils/site_assistant_scenario_table.js';
import { suppliedGuideCorrection } from '../src/utils/site_assistant_scenario_edits.js';

describe('edits to supplied competition examples', () => {
  const page = { href: '/wca/about/wr_aoxr', text: '每轮都有有效平均' };
  const setup =
    '按 AoXR 比两位选手，同场三轮的三阶平均分别是蓝 7、8、9秒，黄 12、10、11秒。两人的Ao3R怎么算，差几秒？';
  it('includes the added round for its only participant after an independent undo', () => {
    const result = scenarioTableReader(page, [
      setup,
      '蓝的8秒被改成无有效平均了。他能拿剩下两轮报Ao2R吗？黄那项变吗？',
      '黄的最后一轮更正为14秒。现在这两个人中谁还合格，是多少？',
      '撤回蓝那笔判罚，黄的14秒照留。重报两项和领先差。',
      '比赛加开第4轮，只有黄晋级并拿到8秒。这能算谁的Ao4R，结果又是多少？',
    ])?.direct();
    expect(result).toContain('不计 Ao4R');
    expect(result).toContain('Ao4R 为 11 秒');
  });
  it('rejects unsupported source, ranking intent, partial rows and an undo without a previous value', () => {
    expect(scenarioTableReader({ ...page, text: '' }, [setup])).toBeUndefined();
    expect(scenarioTableReader(page, [setup, '给我全国排名的链接'])).toBeUndefined();
    const reader = scenarioTableReader(page, [setup]);
    expect(reader?.answer('{"steps":[{"a":{"人":"蓝","用时":"^"}}]}')).toBeUndefined();
    expect(reader?.answer('{"steps":[{"a":{"人":"蓝","轮次":1,"用时":9}}]}')).toBeUndefined();
    expect(reader?.answer('{"steps":[{"a":{"人":"蓝","额外":8}}]}')).toBeUndefined();
  });
  it('restores one attempt without undoing its event transfer', () => {
    const freq = { href: '/wca/about/most_frequent_results', text: '具体厘秒值' };
    const turns = [
      '按最常出现的成绩统计一小段：四阶有五把13.24和二把13.40，另有一次DNF；三阶有三把13.40。只看四阶哪种最多，多少次？',
      '两把之前录成13.24，实际都是13.40。四阶这两个值的频次和第一名变了吗？',
      '更正的两把里，一把应当归入三阶。此时四阶与三阶各有几次13.40？',
      '只撤回这把的改秒，不撤它的项目更正。现在三阶的13.24、13.40各几次？四阶13.40变了吗？',
    ];
    expect(scenarioTableReader(freq, turns.slice(0, 1))?.direct()).not.toContain('三阶');
    const result = scenarioTableReader(freq, turns)?.direct();
    expect(result).toMatch(/三阶：13.40 秒 3 次，13.24 秒 1 次/);
    expect(result).toMatch(/四阶：13.(?:24|40) 秒 3 次，13.(?:24|40) 秒 3 次/);
  });
  it('withdraws only the added event and names the action that changed the average', () => {
    const guide = { href: '/wca/about/average_event_count_by_competition', text: 'COUNT(DISTINCT event_id)' };
    const turns = [
      '每场比赛平均参赛项目数怎么算？同场只有小石比四阶和二阶，小宁只比四阶。分母几人、平均几项？',
      '小宁的四阶又比一轮，另外报了单手。哪件事改变均值，新值呢？',
      '小石的二阶其实是小宁的二阶，两个选手都没有别的二阶记录。这次人数和平均会变吗？',
      '去掉小宁单手的参赛记录，但二阶归属沿用更正。两人分别几项，新平均呢？',
    ];
    expect(scenarioTableReader(guide, turns.slice(0, 2))?.direct()).toContain(
      '小宁新增的单手使均值上升。四阶多比一轮不改变均值',
    );
    expect(scenarioTableReader(guide, turns)?.direct()).toContain(
      '小石 1 项、小宁 2 项。共 2 人、3 项人次，平均 3 ÷ 2 = 1.5',
    );
    expect(
      scenarioTableReader(guide, turns.slice(0, 2))?.answer(
        JSON.stringify({ steps: [{ a: { 人: '小宁', 项目: '四阶' } }, { a: { 项目: '单手' } }] }),
      ),
    ).toBeUndefined();
  });
  it('uses the stated constant frame rate and declines an extra unsupported question', () => {
    const frame = { href: '/frame-count-about', text: '反推起点依赖你输入的成绩' };
    const first =
      '逐帧工具里视频固定25 fps，我只知道结束在第260帧、计时器用时8秒。反推起帧是多少，能用这个起帧独立证明8秒正确吗？';
    const next = '计时器读错了，应为6秒，结束标记没动。起点往哪个方向移动了多少帧？';
    expect(suppliedGuideCorrection(frame, [first, next])).toContain('往后移动 50 帧');
    expect(suppliedGuideCorrection(frame, [first, next + '能教我怎么剪辑吗？'])).toBeUndefined();
  });
});

it('uses representation at attendance and restores only the edited venue', () => {
  const guide = {
    href: '/wca/about/most_competitions_abroad',
    text: 'result.country_id != competition.country_id',
  };
  const reader = scenarioTableReader(guide, [
    '最多海外参赛：我代表瑞典时有两站。各算几次？',
    '现在改代表地，又比了一场。',
    '一场改举办地。',
    '撤回旧场的改动，新站保留。',
  ]);
  const result = reader?.answer(
    JSON.stringify({
      steps: [
        { a: { 当时代表地: '瑞典', 举办地: '丹麦' }, b: { 当时代表地: '瑞典', 举办地: '瑞典' } },
        { c: { 当时代表地: '丹麦', 举办地: '瑞典' } },
        { a: { 举办地: '瑞典' } },
        { a: { 举办地: '^' } },
      ],
    }),
  );
  expect(result).toContain('合计 2 站海外比赛');
  expect(result).toContain('瑞典代表在瑞典参赛 1 站，计入 0 站');
});

it('keeps the selected frequency partition when undoing a time correction after a transfer', () => {
  const page = { href: '/wca/about/most_frequent_results', text: '具体厘秒值' };
  const turns = [
    '最常出现的成绩：单手7.03有4把、7.12有2把；三阶7.12有2把。限定单手谁最多？',
    '沿用单手，两把7.03其实都是7.12。谁最多？',
    '纠正里的两把有一把原来就是三阶，放回三阶。两个项目各有几把？',
    '只撤销这把的改秒，项目还是三阶。仅报三阶7.03和7.12的频次。',
  ];
  const answer = scenarioTableReader(page, turns)?.direct();
  expect(answer).toContain('7.12 秒 2 次，7.03 秒 1 次');
  expect(answer).not.toContain('单手');
});

it('counts the corrected venue against the historical representative after an independent undo', () => {
  const guide = {
    href: '/wca/about/most_competitions_abroad',
    text: 'result.country_id != competition.country_id',
  };
  const turns = [
    '最多海外参赛：她代表瑞士时去德国三站、瑞士一站。共几站？',
    '她改代表德国以后又在瑞士参加一场。现在有几站？',
    '其中一场旧德国赛实际在瑞士办。还剩几站？',
    '只把那场举办地更正撤掉，后来改代表地的事有效。合计几站？',
    '后来瑞士那场误录，其实也在德国。合计几站？',
  ];
  expect(scenarioTableReader(guide, turns)?.direct()).toContain('合计 3 站海外比赛');
});

it('applies a follow-up to the validated prefix once and refuses a replacement history', () => {
  const page = {
    href: '/wca/about/most_attended_competitions_in_single_week',
    text: 'HAVING attended_within_week >= 3',
  };
  const setup = '我参加过三场比赛，分别在同一周，怎么算门槛？';
  const first = scenarioTableReader(page, [setup])!;
  first.answer(
    JSON.stringify({
      steps: [
        { a: { 比赛ID: '甲', 周: '本周' }, b: { 比赛ID: '乙', 周: '本周' }, c: { 比赛ID: '丙', 周: '本周' } },
      ],
    }),
  );
  const saved = first.snapshot();
  expect(saved).toBeDefined();
  const next = scenarioTableReader(page, [setup, '丙其实在下一周，本周还有几场？'], saved)!;
  expect(next.answer(JSON.stringify({ edit: { c: { 周: '下周' } } }))).toContain('本周 2 场');
  expect(next.answer(JSON.stringify({ steps: [{}, {}] }))).toBeUndefined();
  expect(
    scenarioTableReader(page, [setup + '这是另一份样本。', '丙在哪一周？'], saved)?.context.priorSteps,
  ).toBeUndefined();
});

it('moves an added competition out of its old ISO week instead of duplicating it', () => {
  const page = {
    href: '/wca/about/most_attended_competitions_in_single_week',
    text: 'HAVING attended_within_week >= 3',
  };
  const table = scenarioTableReader(page, [
    '单周内最多参加比赛数里，这周一站跨周四、五、六，另有周二一站。几场达标吗？',
    '周日我还赶了另一站，只比一个项目。这次差门槛几站？',
    '新加的比赛实际下周二开幕，我误看成周日。这两周分别有几站，哪周达标？',
  ]);
  expect(table?.direct()).toContain('本周 2 场，未达标，还差 1 场；下周 1 场');
});
it('computes each supplied competition against its own podium threshold', () => {
  const p = { href: '/wca/about/most_podiums_at_single_competition', text: 'HAVING podiums_count >= 10' };
  const q =
    '看单场最多领奖台次数，岩赛我拿7个不同项目的有效决赛奖牌，沙赛只有6个。两站能不能凑过门槛，各差几项？';
  expect(scenarioTableReader(p, [q])?.direct()).toContain('岩赛 7 枚，还差 3 枚。沙赛 6 枚，还差 4 枚');
});

it('scores a single moved attempt using its corrected time after undoing only its event', () => {
  const page = {href:'/wca/about/most_frequent_results',text:'具体厘秒值'};
  const setup = '最常出现的成绩。三阶有13.45三把、12.00一把，单手只有12.00两把。先比三阶。';
  const turns = [setup, '三阶最慢的有效值里有一把属于单手，秒数照旧。还有几种？',
    '刚移动的那一把是12.00才对。各有几把？',
    '这个改秒没错，但项目还是三阶，把归属退回。现在有几把？'];
  expect(scenarioTableReader(page, turns)?.direct()).toContain('并列最多');
});

it('derives the Ao2R verdict from both computed averages', () => {
  const page = {href:'/wca/about/wr_aoxr',text:'每轮都有有效平均'};
  const output=scenarioTableReader(page,['同场两轮平均：甲是11秒和15秒，乙是12秒和14秒。两人的Ao2R谁胜？'])?.direct();
  expect(output).toContain('两人并列');
  expect(output?.match(/为 13 秒/g)).toHaveLength(2);
});

describe('field-specific corrections and explicit answer scope', () => {
  const frequency = { href: '/wca/about/most_frequent_results', text: '具体厘秒值' };
  const start = '最常出现的成绩：五阶18.20有3次，17.80有1次；单手17.80有1次。各自有多少次？';
  const transfer = '单手那把原来属于五阶，仍然是17.80秒。五阶的次数呢？';
  const corrected = '刚转过去的那把其实是18.20秒。只报五阶两个次数。';

  it('replays the same attempt and restores just its original event', () => {
    const turns = [start, transfer, corrected];
    expect(scenarioTableReader(frequency, turns)?.direct()).toBe('五阶：18.20 秒 4 次，17.80 秒 1 次。');
    const back = '用时没错，只把它转回单手。单手众数和五阶的差距呢？';
    const answer = scenarioTableReader(frequency, [...turns, back])?.direct();
    expect(answer).toContain('单手：18.20 秒 1 次');
    expect(answer).toContain('相差 2 次');
  });

  it('leaves an ambiguous transfer for the general reader', () => {
    expect(scenarioTableReader(frequency, [start.replace('单手17.80有1次','单手17.80有2次'), transfer])?.direct()).toBeUndefined();
  });

  it('checks the proposed numerator as well as the denominator', () => {
    const page = { href: '/wca/about/average_event_count_by_competition', text: 'COUNT(DISTINCT event_id)' };
    const question = '每场比赛平均参赛项目数里，河有三阶和单手，池有三阶，松就一个时钟。分子五、分母三对吗？';
    expect(scenarioTableReader(page, [question])?.direct()).toMatch(/^不对。.*4 ÷ 3/);
    expect(scenarioTableReader(page, [question.replace('分子五', '分子四')])?.direct()).toMatch(/^对。/);
  });

  it('keeps a duplicate merged after undoing a later venue correction', () => {
    const page = { href: '/wca/about/most_competitions_abroad', text: 'result.country_id != competition.country_id' };
    const turns = [
      '用海外参赛最多做个假设，南代表日本时在日本一场、德国两场；换代表德国后在日本一场。分别贡献多少海外站？',
      '后一段的那站实际也在德国举办。现在总共几站？',
      '前一段在德国的两份成绩其实来自同一站。前段还剩几站？',
      '撤销后段改址，但德国的重复ID仍按一场。哪一段更多？',
    ];
    const answer = scenarioTableReader(page, turns)?.direct();
    expect(answer).toContain('两段并列');
    expect(answer).toContain('合计 2 站');
    expect(scenarioTableReader(page, [...turns.slice(0, 2), turns[3]])?.direct()).toBeUndefined();
  });
});
