import { describe, expect, it } from 'vitest';
import { assistantReasoningPolicy, assistantToolKey } from '../src/utils/site_assistant_policy.js';

describe('assistant effort policy', () => {
  it('does not rerun the same query for renamed headings or reordered object keys',()=>{
    expect(assistantToolKey({tool:'analysis_query',title:'First',description:'Old',query:{from:{dataset:'results',as:'r'},limit:20}}))
      .toBe(assistantToolKey({query:{limit:20,from:{as:'r',dataset:'results'}},description:'New',title:'Recheck',tool:'analysis_query'}));
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
});
