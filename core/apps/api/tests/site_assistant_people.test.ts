import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { QueryRunner } from '../src/db/connection.js';
import { findAssistantPeople } from '../src/utils/site_assistant_people.js';

describe('assistant name resolution',()=>{
  it.each(['马致远','马志远','马智远','ma zhi yuan','Mǎ Zhì Yuǎn','MAZHIYUAN'])('uses the same tone-free key for %s',async input=>{
    const run:QueryRunner=async(sql,params=[])=>{
      expect(sql).not.toContain(input);
      expect(params.slice(4,8)).toEqual([9,'mazhiyuanmazhiyuan','mazhiyuan','mazhiyuan']);
      expect(params.slice(-2)).toEqual(['mazhiyuan','mazhiyuan']);
      return [];
    };
    expect(await findAssistantPeople(input,run)).toEqual([]);
  });
  it('preserves equally strong matches and excludes weaker substring candidates',async()=>{
    const run:QueryRunner=async <T>()=>[
      {wcaId:'2012MAZH01',name:'Zhiyuan Ma (马志远)',country:'China',matchRank:2},
      {wcaId:'2013MAZH01',name:'Zhiyuan Ma (马智远)',country:'China',matchRank:2},
      {wcaId:'2014MAZH01',name:'Longer name',country:'China',matchRank:3},
    ] as T[];
    expect((await findAssistantPeople('马致远',run)).map(row=>[row.wcaId,row.match])).toEqual([
      ['2012MAZH01','pinyin'],['2013MAZH01','pinyin'],
    ]);
  });
});

// Opt-in PostgreSQL check uses only a connection-local temporary table; it
// neither needs WCA data nor changes application tables or schemas.
const enabled=process.env.ASSISTANT_PEOPLE_PG_TEST==='1';
const db=postgres({host:'127.0.0.1',port:Number(process.env.ASSISTANT_PEOPLE_PG_PORT ?? 5433),username:'postgres',password:'dev',database:'postgres',max:1});
const run:QueryRunner=async<T>(text:string,params:unknown[]=[])=>{
  let index=0;
  return await db.unsafe(text.replace(/\?/g,()=>`$${++index}`),params as never[]) as unknown as T[];
};
afterAll(()=>db.end());
describe.skipIf(!enabled)('assistant name search PostgreSQL semantics',()=>{
  beforeAll(async()=>{
    await db`CREATE TEMP TABLE wca_persons (wca_id text, name text, country_id text)`;
    await db`INSERT INTO wca_persons VALUES
      ('2012MAZH01','Zhiyuan Ma (马志远)','China'),
      ('2013MAZH01','Zhiyuan Ma (马智远)','China'),
      ('2014MAZH01','Zhiyuanming Ma (马志远明)','China'),
      ('2015WANY01','Yiheng Wang (王艺衡)','China'),
      ('2016OUYA01','Yiming Ouyang (欧阳一鸣)','China'),
      ('2012PARK03','Max Park','USA'),
      ('2017PARK01','Max Parker','USA')`;
  });
  it.each(['马致远','ma zhi yuan','MAZHIYUAN','Zhiyuan Ma','Mǎ Zhì Yuǎn'])('finds every phonetic candidate for %s',async input=>{
    expect((await findAssistantPeople(input,run)).map(row=>row.wcaId)).toEqual(['2012MAZH01','2013MAZH01']);
  });
  it('prioritizes exact local names, full names and IDs over homophones and prefixes',async()=>{
    expect((await findAssistantPeople('马志远',run)).map(row=>[row.wcaId,row.match])).toEqual([['2012MAZH01','exact']]);
    expect((await findAssistantPeople('max park',run)).map(row=>[row.wcaId,row.match])).toEqual([['2012PARK03','exact']]);
    expect((await findAssistantPeople('2013mazh01',run)).map(row=>[row.wcaId,row.match])).toEqual([['2013MAZH01','id']]);
  });
  it('matches different Chinese characters and compound surnames through WCA romanization',async()=>{
    expect((await findAssistantPeople('王一恒',run)).map(row=>row.wcaId)).toEqual(['2015WANY01']);
    expect((await findAssistantPeople('欧阳一明',run)).map(row=>row.wcaId)).toEqual(['2016OUYA01']);
  });
  it('preserves partial search and treats SQL/wildcard input literally',async()=>{
    expect((await findAssistantPeople('Max',run)).map(row=>row.wcaId)).toEqual(['2012PARK03','2017PARK01']);
    for(const input of ['不存在的名字',"%' OR 1=1 --",'___',''])expect(await findAssistantPeople(input,run)).toEqual([]);
  });
});
