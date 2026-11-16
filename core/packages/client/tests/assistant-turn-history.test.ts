import { expect, it } from 'vitest';
import { assistantTurnHistory } from '@/lib/assistant-turn-history';
import type { AssistantTurn } from '@/components/SiteAssistantDialog';

it('preserves unanswered and interrupted requirements without treating partial output as facts',()=>{
  const turns:AssistantTurn[]=[
    {question:'统计 2020—2025 年中国选手的三阶成绩',endState:'stopped'},
    {question:'只看平均成绩',endState:'stopped',partial:true,result:{answer:'未经校验的 128 场',sources:[]}},
    {question:'按年分组',endState:'error'},
  ];
  expect(assistantTurnHistory(turns,'https://cuberoot.me')).toEqual(turns.map(turn=>({role:'user',content:turn.question})));
});
it('keeps explicit quotations in subsequent conversation context',()=>{
  const references=[{messageId:'old:assistant',messageVersion:2,role:'assistant' as const,sourceStatus:'partial' as const,selectedText:'128 场'}];
  const messages=assistantTurnHistory([{question:'这是否排除了取消比赛？',references}], 'https://cuberoot.me');
  expect(messages[0].content).toContain(JSON.stringify(references));
  expect(messages[0].content).toContain('not verified evidence');
});
