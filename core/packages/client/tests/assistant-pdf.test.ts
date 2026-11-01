import {describe, expect, it} from 'vitest';
import {assistantPdfDocument} from '@/lib/assistant-pdf';
import {documentExportBlocks, documentExportText} from '@/lib/document-export';

describe('assistant PDF Markdown', () => {
  it('preserves roles, Markdown structure and literal user input', async () => {
    const doc = await assistantPdfDocument('问题 **保持原文**', '# 标题\n\n**重点**和 `R U`\n\n1. 第一步\n2. 第二步\n\n> 引用\n\n```js\nconst x = 1;\n```\n\n[来源](https://cuberoot.me)', 'zh');
    const blocks = documentExportBlocks(doc);
    expect(documentExportText(doc)).toContain('用户\n问题 **保持原文**');
    expect(documentExportText(doc)).toContain('CubeRoot · AI 助手');
    expect(blocks.find(b => b.segments.some(s => s.text === '标题'))?.level).toBe(1);
    expect(blocks.some(b => b.segments.some(s => s.text === '重点' && s.bold))).toBe(true);
    expect(blocks.some(b => b.quote)).toBe(true);
    expect(blocks.filter(b => b.list).map(b => b.list?.index)).toEqual([1, 2]);
    expect(blocks.find(b => b.kind === 'code')?.segments[0].text).toBe('const x = 1;');
    expect(documentExportText(doc)).toContain('https://cuberoot.me');
  });
});

describe('PDF punctuation wrapping', () => {
  it('keeps closing punctuation with preceding text across bold boundaries', async () => {
    const {wrapDocumentPdfSegments} = await import('@/lib/document-export');
    const style = {bold:false, italic:false, strike:false, code:false};
    const lines = wrapDocumentPdfSegments([
      {...style, text:'容易误以为没效果', bold:true}, {...style, text:'。下一句。'},
    ], 8, value => Array.from(value).length);
    expect(lines.map(line => line.map(run => run.text).join(''))).toEqual(['容易误以为没效', '果。下一句。']);
    expect(lines[1][0].bold).toBe(true);
    expect(lines[1][1].bold).toBe(false);
  });
  it('moves opening brackets with their contents and preserves explicit breaks', async () => {
    const {wrapDocumentPdfSegments} = await import('@/lib/document-export');
    const style = {bold:false, italic:false, strike:false, code:false};
    const lines = wrapDocumentPdfSegments([{...style,text:'测试「内容」。\n下一段。'}], 3, value => Array.from(value).length);
    expect(lines.map(line => line.map(run => run.text).join(''))).toEqual(['测试', '「内', '容」。', '下一', '段。']);
  });
});

it('exports structured tables and chart values without flattening them into Markdown', async () => {
  const doc = await assistantPdfDocument('成绩？', '如下。', 'zh', [
    {kind:'table', title:'比赛', columns:['名称', '日期'], rows:[['含 | 符号的比赛', '2026-10-31']]},
    {kind:'progress', title:'平均成绩', event:'333', metric:'average', points:[
      {date:'2026-01-01', value:8653, person:'测试选手', label:'比赛一'},
      {date:'2026-02-01', value:-1, person:'测试选手', label:'比赛二'},
    ]},
  ]);
  const tables = doc.content!.filter(node => node.type === 'table');
  expect(tables).toHaveLength(2);
  expect(documentExportText(tables[0])).toContain('含 | 符号的比赛');
  expect(documentExportText(tables[1])).toContain('1:26.53');
  expect(documentExportText(tables[1])).toContain('DNF');
  expect(doc.content!.find(node => node.type === 'pdfChart')?.pdfChart).toEqual([
    {date:'2026-01-01', value:8653, label:'1:26.53'},
  ]);
});
