import {describe,expect,it,vi} from 'vitest';
import {assistantAlgorithmSelection,createAssistantAlgorithmLoader,nextAssistantAlgorithm,replaceAssistantAlgorithm} from '@cuberoot/shared/site-assistant-algorithms';
import {assistantAnswerHistory,type AssistantAlgorithmCard,type AssistantAnswer} from '@cuberoot/shared/site-assistant';
import type {AlgFile} from '@cuberoot/shared/alg-types';
import {assistantPdfDocument} from '@/lib/assistant-pdf';
import {documentExportText} from '@/lib/document-export';

const file:AlgFile={puzzle:'3x3',set:'pll',source:'fixture',scrapedAt:'2026-11-12',cases:[{
  id:1,name:'T',subgroup:'',setup:'case preset',sticker:{kind:'raw',tag:'',attrs:{}},
  algs:[[{alg:"R U R'",setup:"R U' R'"},{alg:"R U2 R'"}]],
}]};
const card:AssistantAlgorithmCard={caseId:1,name:'T',puzzle:'3x3',set:'pll',href:'/alg/3x3/pll#T',...assistantAlgorithmSelection(file.cases[0],'3x3','pll',0)!};
const answer:AssistantAnswer={answer:'如下',sources:[],artifacts:[{kind:'algorithms',version:1,title:'PLL',puzzle:'3x3',set:'pll',display:'both',offset:0,total:2,cards:[card,{...card,caseId:2}]}]};

describe('in-place algorithm selections',()=>{
  it('cycles the exact case and clears an obsolete per-formula drawing setup',()=>{
    const next=nextAssistantAlgorithm(file,card);
    expect(next).toMatchObject({caseId:1,alternative:1,alternativeCount:2,alg:"R U2 R'"});
    expect(next.setup).toBeUndefined();
    expect(nextAssistantAlgorithm(file,next)).toEqual(card);
    expect(assistantAlgorithmSelection(file.cases[0],'3x3','f2l',1)?.setup).toBe('case preset');
    expect(()=>nextAssistantAlgorithm(file,{...card,caseId:99})).toThrow();
    expect(()=>nextAssistantAlgorithm({...file,set:'coll'},card)).toThrow();
  });
  it('keeps the current formula identity through library reordering',()=>{
    const reordered={...file,cases:[{...file.cases[0],algs:[[...file.cases[0].algs[0]].reverse()]}]};
    expect(nextAssistantAlgorithm(reordered,card)).toMatchObject({alternative:0,alg:"R U2 R'"});
  });
  it('updates only the selected card, rejects late results and persists through history and PDF',async()=>{
    const next=nextAssistantAlgorithm(file,card),updated=replaceAssistantAlgorithm(answer,0,0,card,next);
    const group=updated.artifacts![0];if(group.kind!=='algorithms')throw new Error();
    expect(group.cards[1]).toBe((answer.artifacts![0] as typeof group).cards[1]);
    expect((answer.artifacts![0] as typeof group).cards[0]).toBe(card);
    expect(replaceAssistantAlgorithm(updated,0,0,card,next)).toBe(updated);
    const saved=JSON.parse(JSON.stringify(updated));
    expect(assistantAnswerHistory(saved,'https://cuberoot.me')).toContain('caseId=1; alternative=1/2');
    const doc=await assistantPdfDocument('T','如下','zh',[{...group,cards:[group.cards[0]]}]);
    expect(documentExportText(doc)).toContain(next.alg);
    expect(documentExportText(doc)).not.toContain(card.alg);
    expect(doc.content?.some(node=>node.type==='pdfSvg' && node.pdfSvg?.includes('<svg'))).toBe(true);
  });
  it('coalesces library reads and retries after a failed fetch',async()=>{
    const source=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(file);
    const load=createAssistantAlgorithmLoader(source);
    await expect(load(card)).rejects.toThrow('offline');
    const results=await Promise.all([load(card),load(card)]);
    expect(source).toHaveBeenCalledTimes(2);
    expect(results[0]).toEqual(results[1]);
    await load(results[0]);expect(source).toHaveBeenCalledTimes(2);
  });
});
