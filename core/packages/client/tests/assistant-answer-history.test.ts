import {describe, expect, it} from 'vitest';
import {SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH, type AssistantAnswer} from '@cuberoot/shared/site-assistant';
import {assistantAnswerHistory, assistantAnswerText} from '@/lib/assistant-answer-export';

const origin = 'https://www.cuberoot.me';
const answer: AssistantAnswer = {
  answer: '现场计算结果见下表。',
  sources: [{id:'analysis:winners', title:'周末冠军', href:'/wca/results', read:true}],
  actions: [{id:'person:2017YANR02', title:'颜瑞民', href:'/wca/persons/2017YANR02'}],
  artifacts: [{kind:'table', title:'周末冠军', columns:['比赛', '选手', '平均'],
    rows:[['比赛一', '选手一', '7.12'], ['比赛二', '颜瑞民', '8.53']],
    links:['/wca/comp/First2026', '/wca/comp/Second2026'],
    cellLinks:[[null, '/wca/persons/2020TEST01', null], [null, '/wca/persons/2017YANR02', null]],
  }],
};

describe('assistant follow-up context', () => {
  it('retains the displayed row order, people, results and selected destinations', () => {
    const history = assistantAnswerHistory(answer, origin);
    expect(history).toContain('比赛\t选手\t平均');
    expect(history).toContain('比赛二 (/wca/comp/Second2026)\t颜瑞民 (/wca/persons/2017YANR02)\t8.53');
    expect(history.indexOf('比赛一')).toBeLessThan(history.indexOf('比赛二'));
    expect(history).toContain('周末冠军 (/wca/results)');
    expect(history).toContain('reverify facts with tools');
    expect(assistantAnswerText(answer, origin)).toBe('现场计算结果见下表。\n\n周末冠军\n比赛\t选手\t平均\n比赛一\t选手一\t7.12\n比赛二\t颜瑞民\t8.53');
  });
  it('reserves room for actual results when the previous prose is already long', () => {
    const history = assistantAnswerHistory({...answer, answer:'说明'.repeat(6000)}, origin);
    expect(history.length).toBeLessThanOrEqual(SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH);
    expect(history).toContain('颜瑞民 (/wca/persons/2017YANR02)\t8.53');
    expect(history).toContain('truncated');
  });
  it('bounds oversized tables and marks missing rows instead of implying completeness', () => {
    const table = answer.artifacts![0];
    if (table.kind !== 'table') throw new Error('Expected table fixture');
    const history = assistantAnswerHistory({...answer, artifacts:[{...table, rows:Array.from({length:100}, (_,i)=>[String(i), '长名称'.repeat(100), '7.12'])}]}, origin);
    expect(history.length).toBe(SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH);
    expect(history).toMatch(/\[Earlier answer context truncated; omitted rows are unavailable\.\]$/);
  });
  it('does not shorten a long written answer merely because it has a source', () => {
    const prose = '解释'.repeat(4500) + '保留结尾';
    expect(assistantAnswerHistory({...answer, answer:prose, artifacts:[]}, origin)).toContain(prose);
  });
  it('preserves chart identities and excludes unsafe destination metadata', () => {
    const history = assistantAnswerHistory({answer:'成绩变化如下。', sources:[], actions:[{id:'unsafe', title:'Unsafe', href:'javascript:alert(1)'}], artifacts:[{
      kind:'progress', title:'平均成绩', event:'333', metric:'average', points:[{date:'2026-11-01',value:853,label:'比赛二',person:'颜瑞民'}],
    }]}, origin);
    expect(history).toContain('2026-11-01\t8.53\t颜瑞民\t比赛二');
    expect(history).not.toContain('javascript:');
  });
});
