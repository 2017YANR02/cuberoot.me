import {describe,it,expect} from 'vitest';
import {algorithmCaseImage} from '@cuberoot/puzzle-render-core/alg-case-image';

describe('native formula diagrams',()=>{
  it('draws NxN locally and keeps the library setup as the state source',async()=>{
    const input={puzzle:'3x3' as const,set:'pll',sticker:{kind:'raw' as const,tag:'',attrs:{}},alg:"R U R'",setup:"F R F'"};
    const first=await algorithmCaseImage(input);
    expect(first.svg).toContain('<svg');
    expect(first.src).toBeUndefined();
    expect(await algorithmCaseImage({...input,alg:'U2'})).toEqual(first);
  });
  it('reuses canonical non-cube views and preserves forward versus inverse notation',async()=>{
    for(const [puzzle,set,view] of [['pyraminx','l3e','iso'],['megaminx','eo','top']] as const){
      const input={puzzle,set,sticker:{kind:'raw' as const,tag:'',attrs:{}},alg:"R U R'"};
      const result=await algorithmCaseImage(input);
      const url=new URL(result.src!,'https://cuberoot.me');
      expect(url.pathname).toBe('/v1/visualcube.svg');
      expect(url.searchParams.get('view')).toBe(view);
      expect(url.searchParams.get('case')).toBe(input.alg);
      const setupUrl=new URL((await algorithmCaseImage({...input,setup:"U R U'"})).src!,'https://cuberoot.me');
      expect(setupUrl.searchParams.get('case')).toBeNull();
      expect(setupUrl.searchParams.get('alg')).toBe("U R U'");
    }
  });
});
