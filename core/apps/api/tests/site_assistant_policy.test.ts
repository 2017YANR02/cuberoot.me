import { describe, expect, it } from 'vitest';
import { coachingAnswerSections } from '../src/utils/site_assistant_answer_check.js';
import { assistantReasoningPolicy, assistantToolKey, automaticTrainingGuidance, requiresNeutralPracticeMix, trainingDecisionGuidance, isTrainingDecision, trainingComparisonIssue } from '../src/utils/site_assistant_policy.js';

describe('assistant effort policy', () => {
  it('does not rerun the same query for renamed headings or reordered object keys',()=>{
    expect(assistantToolKey({tool:'analysis_query',title:'First',description:'Old',query:{from:{dataset:'results',as:'r'},limit:20}}))
      .toBe(assistantToolKey({query:{limit:20,from:{as:'r',dataset:'results'}},description:'New',title:'Recheck',tool:'analysis_query'}));
    const heading=(label?:string)=>assistantToolKey({tool:'analysis_query',query:{select:[{as:'n',expr:{fn:'count',args:[]},label}]}});
    expect(heading('New heading')).toBe(heading('Old heading'));
    expect(heading()).not.toBe(heading('Required heading'));
    expect(assistantToolKey({tool:'analysis_query',query:{limit:20}})).not.toBe(assistantToolKey({tool:'analysis_query',query:{limit:30}}));
  });
  it('keeps ordinary answers and direct site lookups in auto mode fast', () => {
    for(const tools of [[], ['navigation'], ['pages'], ['find_person','person']]) {
      expect(assistantReasoningPolicy('auto',{tools,repair:false,review:false})).toEqual({thinking:false,effort:'high',maxTokens:4096});
    }
  });
  it('uses deeper reasoning for analytics, public-web verification, deliberation and repairs', () => {
    for(const tools of [['deliberate'], ['analysis_schema'], ['analysis_query'], ['statistics'], ['web_search'], ['news','web_search']]) {
      expect(assistantReasoningPolicy('auto',{tools,repair:false,review:false})).toEqual({thinking:true,effort:'high',maxTokens:16384});
    }
    expect(assistantReasoningPolicy('auto',{tools:[],repair:true,review:false}).thinking).toBe(true);
    expect(assistantReasoningPolicy('auto',{tools:[],repair:false,review:true}).thinking).toBe(true);
  });
  it('honors user effort preferences across tool selection and recovery', () => {
    expect(assistantReasoningPolicy('deep',{tools:[],repair:false,review:false})).toEqual({thinking:true,effort:'high',maxTokens:16384});
    expect(assistantReasoningPolicy('fast',{tools:['analysis_query','deliberate','web_search'],repair:true,review:true})).toEqual({thinking:false,effort:'high',maxTokens:4096});
  });
  it('uses low effort only for ordinary auto evidence review',()=>{
    expect(assistantReasoningPolicy('auto',{tools:['glossary'],repair:false,review:true}).effort).toBe('low');
    expect(assistantReasoningPolicy('auto',{tools:['pages'],repair:false,review:true,criticalReview:true}).effort).toBe('high');
    expect(assistantReasoningPolicy('auto',{tools:['analysis_query'],repair:false,review:true}).effort).toBe('high');
    expect(assistantReasoningPolicy('deep',{tools:['glossary'],repair:false,review:true}).effort).toBe('high');
  });
});

describe('training decision intent',()=>{
  it('keeps whole-set accuracy out of whole-solve speed comparisons and vice versa', () => {
    const speed = automaticTrainingGuidance('慢拧和全速练完怎么比较整把速度？');
    const accuracy = automaticTrainingGuidance('新版 PLL 更顺，我只想一整轮全做对，该换吗？');
    expect(speed).toContain('整把用时中位数');
    expect(speed).not.toContain('成功整组数');
    expect(accuracy).toContain('成功整组数/尝试组数');
    expect(accuracy).toContain('犹豫但全对仍算成功');
    expect(accuracy).not.toContain('整把用时中位数');
  });
  it('recognizes coaching requests without requiring a specific measure or inventing the strength of evidence',()=>{
    const questions=[
      '回看昨天两把，F2L 有停顿，我该把手法课换成找块课吗？',
      '我准备少练慢拧、多练全速。录像里衔接顺了，值得换练习比例吗？',
      '三周轮换对照试验都更快了，支持新训练配比吗？',
      'Two clips look smoother. Should I switch my PLL practice?',
    ];
    for(const question of questions)expect(isTrainingDecision(question)).toBe(true);
    for(const question of ['帮我算这五次练习的平均成绩。','带我去录像分析。','两个班训练要怎样排时间？'])expect(isTrainingDecision(question)).toBe(false);
  });
});

it('maps compact coaching replies to distinct requested items while preserving a three-sentence answer',()=>{
  const items=['现在要换吗？','理由和验证办法是什么？'];
  const sections=coachingAnswerSections('1、先保留原安排。\n2、两段录像无法定位原因。用等长练习后的整把成绩比较。',items);
  expect(sections).toEqual(['先保留原安排。','两段录像无法定位原因。用等长练习后的整把成绩比较。']);
  expect(coachingAnswerSections('先保持。\n先保持。',items)).toBeUndefined();
  expect(coachingAnswerSections('先保持。\n2、',items)).toBeUndefined();
  expect(coachingAnswerSections('先保持。\n理由。\n再调整。',items)).toBeUndefined();
  expect(coachingAnswerSections('2、先保持。\n1、再测试。',items)).toBeUndefined();
});

describe('training comparison review', () => {
  const accuracy = '录像里 PLL 更顺，怎么检验整套成功率？';
  const timing = '怎么比较慢拧和全速？';
  const allocation = '十字慢，要砍掉一半后两层练习吗？给个验证办法。';
  it('rejects the three observed experimental errors', () => {
    expect(trainingComparisonIssue(accuracy, '一处错或犹豫即算该套失败，犹豫但全对仍算成功。')).toBe('training_set_scoring');
    expect(trainingComparisonIssue(timing, '练习后测同一批未见过的打乱，各取中位数。')).toBe('training_shared_test_list');
    expect(trainingComparisonIssue('怎样公平比较慢拧和全速？', 'A 和 B 各用一份不同的新题单，比较整把中位数。')).toBe('training_match_duration');
    expect(trainingComparisonIssue(allocation, '交替安排“先十字专项后后两层”和“先后两层后十字专项”。')).toBe('training_allocation');
  });
  it('uses whole-round accuracy when the user calls it getting every case right', () => {
    const question = '怎样比较一整轮能不能全做对？允许犹豫。';
    expect(trainingComparisonIssue(question, '犹豫就算失败。')).toBe('training_set_scoring');
    expect(trainingComparisonIssue(question, '犹豫但全对仍算成功，错一条判整轮失败。')).toBeUndefined();
  });
  it('compares the two mixes without assigning an unstated dominant practice to either arm',()=>{
    const question = '慢拧那段录像停顿多，全速那段少，可后者的打乱我认识。我该把练习比例倒过来吗？请把两种练法各自用什么题单验收说清，给一个取舍指标。';
    expect(automaticTrainingGuidance(question)).toContain('A=当前配比，B=倒过来的配比');
    expect(trainingDecisionGuidance(question)).toContain('A is the current mix and B the reversed mix');
    for (const bad of ['A 原练法＝慢拧为主、全速为辅。','A 原练法（慢拧）用陌生题单。','B 组用全速题单验收。','暂留原安排（慢拧多、全速少）。','A=70:30，B=30:70。']) {
      expect(trainingComparisonIssue(question,bad)).toBe('training_unspecified_mix');
    }
    expect(trainingComparisonIssue(question,'A 用当前配比，B 用倒过来的配比。两组都练慢拧和全速。')).toBeUndefined();
    expect(requiresNeutralPracticeMix(question,'我现在慢拧70%、全速30%。')).toBe(false);
    expect(requiresNeutralPracticeMix(question,'我昨天慢拧10分钟。')).toBe(true);
    expect(requiresNeutralPracticeMix(question,'如果我主练全速会怎样？')).toBe(true);
    expect(requiresNeutralPracticeMix(question,'我平时慢拧10分钟，全速30分钟。')).toBe(false);
    expect(trainingComparisonIssue(question,'A 主要练全速，B 主练慢拧。')).toBe('training_unspecified_mix');
    expect(requiresNeutralPracticeMix(question+'全对率是70%。')).toBe(true);
    expect(requiresNeutralPracticeMix('直接比较慢拧练习和全速练习。')).toBe(false);
  });
  it('distinguishes prior exposure from scramble difficulty',()=>{
    const question='全速那组打乱我认识。该把慢拧和全速的配比倒过来吗？';
    const unsupported='暂留原安排：两段录像的打乱难度不同，慢拧停顿多可能只是题更难。';
    expect(trainingComparisonIssue(question,unsupported)).toBe('training_unsupported_difficulty');
    expect(trainingComparisonIssue(question,'一个做过，一个刚抽，两者难度和熟悉度都不同。')).toBe('training_unsupported_difficulty');
    expect(trainingComparisonIssue(question+'我无法确定难度是否不同。',unsupported)).toBe('training_unsupported_difficulty');
    expect(trainingComparisonIssue(question,'认识打乱可能让识别更快，不能推断两组难度不同。下次匹配难度。')).toBeUndefined();
    expect(trainingComparisonIssue(question+'我还确认了两组难度不同。',unsupported)).toBeUndefined();
    expect(trainingComparisonIssue('配比要反过来吗？','两组等时、使用同难度的题单。')).toBeUndefined();
  });
  it('accepts distinct lists, explicit scoring and actual transfers', () => {
    expect(trainingComparisonIssue(accuracy, '停顿但全对仍算成功。')).toBeUndefined();
    expect(trainingComparisonIssue(accuracy+'无停顿才算全对。', '犹豫就算失败。')).toBeUndefined();
    expect(trainingComparisonIssue(timing, '两组都测同一批打乱不公平。分别用两份不重叠的新题单。')).toBeUndefined();
    expect(trainingComparisonIssue(timing, '两组练同一批打乱，练完分别用新的不重叠题单测试。')).toBeUndefined();
    expect(trainingComparisonIssue(allocation, 'A照旧，B的后两层减半，省下的时间全部给十字。')).toBeUndefined();
  });
});
