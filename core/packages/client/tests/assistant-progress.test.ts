import { describe,it,expect } from 'vitest';
import { updateAssistantProgress } from '@/lib/assistant-progress';

describe('assistant progress stream reconciliation',()=>{
  it('updates a step once, preserves independent steps and rejects stale completion or extra payloads',()=>{
    const first={id:1,phase:'tool',state:'running',elapsedMs:10,tool:'pages'};
    let progress=updateAssistantProgress([],first);
    progress=updateAssistantProgress(progress,{...first,id:2,tool:'person'});
    progress=updateAssistantProgress(progress,{...first,state:'complete',durationMs:20,sourceCount:2,reasoning:'never copied'});
    expect(progress).toHaveLength(2);expect(progress[0]).not.toHaveProperty('reasoning');
    expect(progress[0]).toMatchObject({state:'complete',sourceCount:2});
    expect(updateAssistantProgress(progress,first)).toBe(progress);
    expect(updateAssistantProgress(progress,{...first,id:65})).toBe(progress);
    expect(updateAssistantProgress(progress,{...first,id:3,elapsedMs:-1})).toBe(progress);
    expect(updateAssistantProgress(progress,{...first,id:2,tool:'news'})).toBe(progress);
  });
});
