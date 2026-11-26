import { expect, it } from 'vitest';
import { measuredTurnSpan, goalResults, type GuidedSample } from '@/lib/replay-guided-practice';

it('rejects missing or ambiguous device times and keeps manual and cube medians separate', () => {
  expect(measuredTurnSpan([0])).toBeUndefined();
  expect(measuredTurnSpan([0,100,100,399])).toBeUndefined();
  expect(measuredTurnSpan([100,90])).toBeUndefined();
  const turns=measuredTurnSpan([10,110,340,410]);
  expect(turns).toEqual({executionMs:400,longestGapMs:230});
  const sample:GuidedSample={i:1,goal:'routes',variant:'recorded',scramble:'R',caseName:'example',caseKey:'f2l|example',ms:900,penalty:'ok'};
  const result=goalResults([{...sample,turnSpan:turns},{...sample,ms:700},{...sample,penalty:'DNF',ms:100,turnSpan:turns},
    {...sample,variant:'reference',ms:550}]);
  expect(result).toMatchObject([{variant:'recorded',correct:2,attempts:3,medianMs:800,deviceCount:1,deviceExecutionMs:400,longestGapMs:230},
    {variant:'reference',correct:1,attempts:1,medianMs:550,deviceCount:0,deviceExecutionMs:null,longestGapMs:null}]);
});
