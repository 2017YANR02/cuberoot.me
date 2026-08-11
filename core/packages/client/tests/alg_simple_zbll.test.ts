import { describe, expect, it } from 'vitest';
import type { AlgCase } from '@cuberoot/shared';
import { isSimpleZbllCase, zbllRecognitionScore } from '@/lib/alg_simple_zbll';

function makeCase(sideRows: [string, string, string, string], htm: number): AlgCase {
  return {
    name: 'fixture',
    subgroup: 'U/UR',
    setup: '',
    sticker: {
      kind: 'face',
      us: 'yyyyyyyyy',
      ub: `${sideRows[0]}bbbbbb`,
      ur: `${sideRows[1]}rrrrrr`,
      uf: `${sideRows[2]}gggggg`,
      ul: `${sideRows[3]}oooooo`,
    },
    algs: [[]],
    meta: {
      no: 1,
      ollcp: 'fixture',
      subset: 'ZBLL-U',
      oll: 'U',
      cp: 'UR',
      optimal: { htm: { len: htm } },
    },
  };
}

describe('Simple ZBLL selection', () => {
  it('includes every case whose optimal HTM is at most 10', () => {
    expect(isSimpleZbllCase(makeCase(['rgb', 'gbr', 'bro', 'org'], 10))).toBe(true);
  });

  it('also includes a longer case with two full bars', () => {
    const c = makeCase(['rrr', 'ggg', 'bro', 'org'], 13);
    expect(zbllRecognitionScore(c)).toBe(4);
    expect(isSimpleZbllCase(c)).toBe(true);
  });

  it('excludes a long case without obvious colour blocks', () => {
    expect(isSimpleZbllCase(makeCase(['rgb', 'gbr', 'bro', 'org'], 13))).toBe(false);
  });
});
