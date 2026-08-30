import { describe, expect, it } from 'vitest';

import {
  validateWxmlExpressionSource,
  WxmlExpressionError,
} from '../scripts/wxml-expression.mjs';

describe('WXML expression validation', () => {
  it('accepts native WXML logical operators', () => {
    expect(() => validateWxmlExpressionSource(
      '<view wx:if="{{ready && count > 0}}" />',
      { label: 'src/pages/tools/index.wxml' },
    )).not.toThrow();
  });

  it('rejects HTML entities before the source reaches WeChat compilation', () => {
    expect(() => validateWxmlExpressionSource(
      '<view>\n  <text wx:if="{{ready &amp;&amp; count > 0}}" />\n</view>',
      { label: 'src/pages/tools/index.wxml' },
    )).toThrow(new WxmlExpressionError(
      'src/pages/tools/index.wxml:2 的 WXML 表达式包含 HTML 实体 &amp;；表达式运算符必须直接书写。',
    ));
  });
});
