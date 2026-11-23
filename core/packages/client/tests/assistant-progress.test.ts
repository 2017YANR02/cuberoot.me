import { describe,it,expect } from 'vitest';
import { assistantProgressView, updateAssistantProgress } from '@/lib/assistant-progress';

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
  it('shows the current step independently of completion and snapshot arrival order',()=>{
    let progress=updateAssistantProgress([],{id:1,phase:'model',activity:'plan',state:'complete',elapsedMs:2});
    progress=updateAssistantProgress(progress,{id:2,phase:'tool',tool:'recent_3x3_champions',state:'running',elapsedMs:4});
    progress=updateAssistantProgress(progress,{id:3,phase:'model',activity:'write',state:'running',elapsedMs:6});
    expect(assistantProgressView([...progress].reverse()).current).toMatchObject({id:3,activity:'write'});
    progress=updateAssistantProgress(progress,{...progress[1],state:'complete',reused:true});
    expect(assistantProgressView(progress)).toMatchObject({current:{id:3},steps:[{id:1},{id:2,reused:true},{id:3}]});
    progress=updateAssistantProgress(progress,{...progress[2],state:'complete'});
    expect(assistantProgressView(progress).current).toMatchObject({id:3,state:'complete'});
  });
  it('keeps only recognized public scope fields in a tool progress event',()=>{
    const progress={id:1,phase:'tool',state:'running',elapsedMs:5,tool:'competitions'};
    expect(updateAssistantProgress([],{...progress,scope:{event:'333',from:'2026-08-23',to:'2026-11-23',query:'hidden'}})[0].scope)
      .toEqual({event:'333',from:'2026-08-23',to:'2026-11-23'});
    expect(updateAssistantProgress([],{...progress,scope:{event:'unknown',from:'2026-02-31',to:'2026-03-03'}})[0].scope).toBeUndefined();
  });
});
