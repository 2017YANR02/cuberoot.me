import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import {
  buildDocumentDocx,
  documentExportBlocks,
  documentExportFilename,
  documentExportText,
  type RichTextNode,
} from '@/lib/document-export';

const fixture: RichTextNode = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '合作协议', marks: [{ type: 'bold' }] }] },
    { type: 'paragraph', content: [{ type: 'text', text: '甲乙双方' }, { type: 'hardBreak' }, { type: 'text', text: '共同确认', marks: [{ type: 'italic' }] }] },
    {
      type: 'orderedList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '第一项' }] }] },
        {
          type: 'listItem', content: [
            { type: 'paragraph', content: [{ type: 'text', text: '第二项' }] },
            { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '子项' }] }] }] },
          ],
        },
      ],
    },
    { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: '备注', marks: [{ type: 'strike' }] }] }] },
  ],
};

describe('collaborative document export', () => {
  it('preserves headings, inline marks, nested lists, and quotes', () => {
    const blocks = documentExportBlocks(fixture);
    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 2 });
    expect(blocks[0].segments[0]).toMatchObject({ text: '合作协议', bold: true });
    expect(blocks[1].segments.map((segment) => segment.text).join('')).toBe('甲乙双方\n共同确认');
    expect(blocks[1].segments.at(-1)?.italic).toBe(true);
    expect(blocks[2].list).toEqual({ type: 'ordered', depth: 0, index: 1 });
    expect(blocks[3].list).toEqual({ type: 'ordered', depth: 0, index: 2 });
    expect(blocks[4].list).toEqual({ type: 'bullet', depth: 1, index: 1 });
    expect(blocks[5]).toMatchObject({ quote: true });
    expect(blocks[5].segments[0].strike).toBe(true);
  });

  it('extracts all visible text and sanitizes download names', () => {
    expect(documentExportText(fixture)).toContain('合作协议\n甲乙双方\n共同确认');
    expect(documentExportFilename('8月13日: 合同/终稿. ', 'docx')).toBe('8月13日_ 合同_终稿.docx');
    expect(documentExportFilename('   ', 'pdf')).toBe('document.pdf');
  });

  it('writes hard breaks into the generated Word document', async () => {
    const blob = await buildDocumentDocx('换行测试', fixture);
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const xml = strFromU8(files['word/document.xml']);
    expect(xml).toContain('<w:br/>');
    expect(xml).toContain('共同确认');
  });
});
