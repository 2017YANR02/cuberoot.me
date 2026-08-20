import { describe, expect, it } from 'vitest';
import { extractWeChatOpenSdkCode } from '@/lib/wechat-pc-opensdk';

describe('extractWeChatOpenSdkCode', () => {
  it.each([
    [0, 0],
    [{ errCode: -11034 }, -11034],
    [{ err_code: 3 }, 3],
    [{ code: 6 }, 6],
  ])('reads supported OpenSDK result shape %#', (result, expected) => {
    expect(extractWeChatOpenSdkCode(result)).toBe(expected);
  });

  it.each([undefined, null, '0', {}, { errCode: '3' }])('ignores an unknown result shape %#', (result) => {
    expect(extractWeChatOpenSdkCode(result)).toBeUndefined();
  });
});
