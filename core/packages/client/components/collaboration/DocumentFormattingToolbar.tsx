'use client';

import type { CSSProperties, ReactNode } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Highlighter, Italic, List, ListOrdered,
  Quote, Redo2, Strikethrough, Underline as UnderlineIcon, Undo2,
} from '@app-foundation/icons/lucide';
import { EditorContent, type Editor } from '@tiptap/react';
import { tr } from '@/i18n/tr';

export function DocumentTool({ label, disabled, active, onClick, children }: {
  label: string; disabled?: boolean; active?: boolean; onClick: () => void; children: ReactNode;
}) {
  return <button type="button" className={`doc-tool${active ? ' is-active' : ''}`} aria-label={label} title={label} aria-pressed={active} disabled={disabled} onClick={onClick}>{children}</button>;
}

export function DocumentFormattingToolbar({ editor, canEdit, zoom, onZoomChange, leading, insert, extraList, trailing }: {
  editor: Editor;
  canEdit: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  leading?: ReactNode;
  insert?: ReactNode;
  extraList?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="doc-toolbar" aria-label={tr({ zh: '格式工具栏', en: 'Formatting toolbar' })}>
      {leading}<DocumentTool label={tr({ zh: '撤销', en: 'Undo' })} disabled={!canEdit || !editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={17} /></DocumentTool><DocumentTool label={tr({ zh: '重做', en: 'Redo' })} disabled={!canEdit || !editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={17} /></DocumentTool><span className="doc-tool-separator" />
      <select className="doc-toolbar-select doc-zoom-select" value={zoom} onChange={(event) => onZoomChange(Number(event.target.value))} aria-label={tr({ zh: '缩放', en: 'Zoom' })}>{[80, 100, 120, 140].map((value) => <option key={value}>{value}</option>)}</select>
      <select className="doc-toolbar-select" disabled={!canEdit} value={editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'} onChange={(event) => event.target.value === 'p' ? editor.chain().focus().setParagraph().run() : editor.chain().focus().setHeading({ level: Number(event.target.value.slice(1)) as 1 | 2 | 3 }).run()} aria-label={tr({ zh: '段落样式', en: 'Paragraph style' })}><option value="p">{tr({ zh: '普通文本', en: 'Normal text' })}</option><option value="h1">{tr({ zh: '标题 1', en: 'Heading 1' })}</option><option value="h2">{tr({ zh: '标题 2', en: 'Heading 2' })}</option><option value="h3">{tr({ zh: '标题 3', en: 'Heading 3' })}</option></select><span className="doc-tool-separator" />
      <select className="doc-toolbar-select doc-font-select" disabled={!canEdit} value={editor.getAttributes('textStyle').fontFamily || ''} onChange={(event) => event.target.value ? editor.chain().focus().setFontFamily(event.target.value).run() : editor.chain().focus().unsetFontFamily().run()} aria-label={tr({ zh: '字体', en: 'Font' })}><option value="">{tr({ zh: '默认字体', en: 'Default font' })}</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="'Courier New'">Courier New</option></select>
      <select className="doc-toolbar-select doc-size-select" disabled={!canEdit} value={editor.getAttributes('textStyle').fontSize || ''} onChange={(event) => event.target.value ? editor.chain().focus().setFontSize(event.target.value).run() : editor.chain().focus().unsetFontSize().run()} aria-label={tr({ zh: '字号', en: 'Font size' })}><option value="">11</option>{[10, 12, 14, 16, 18, 24, 32].map((value) => <option key={value} value={`${value}px`}>{value}</option>)}</select>
      <label className="doc-color-tool" title={tr({ zh: '文字颜色', en: 'Text color' })}><span>A</span><input className="doc-color-input" type="color" disabled={!canEdit} value={editor.getAttributes('textStyle').color || '#111111'} onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} aria-label={tr({ zh: '文字颜色', en: 'Text color' })} /></label><span className="doc-tool-separator" />
      <DocumentTool label={tr({ zh: '粗体', en: 'Bold' })} active={editor.isActive('bold')} disabled={!canEdit} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={17} /></DocumentTool><DocumentTool label={tr({ zh: '斜体', en: 'Italic' })} active={editor.isActive('italic')} disabled={!canEdit} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={17} /></DocumentTool><DocumentTool label={tr({ zh: '下划线', en: 'Underline' })} active={editor.isActive('underline')} disabled={!canEdit} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={17} /></DocumentTool><DocumentTool label={tr({ zh: '删除线', en: 'Strikethrough' })} active={editor.isActive('strike')} disabled={!canEdit} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={17} /></DocumentTool><DocumentTool label={tr({ zh: '高亮', en: 'Highlight' })} active={editor.isActive('highlight')} disabled={!canEdit} onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter size={17} /></DocumentTool><span className="doc-tool-separator" />
      {insert && <>{insert}<span className="doc-tool-separator" /></>}
      <DocumentTool label={tr({ zh: '左对齐', en: 'Align left' })} disabled={!canEdit} active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={17} /></DocumentTool><DocumentTool label={tr({ zh: '居中', en: 'Align center' })} disabled={!canEdit} active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter size={17} /></DocumentTool><DocumentTool label={tr({ zh: '右对齐', en: 'Align right' })} disabled={!canEdit} active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight size={17} /></DocumentTool><DocumentTool label={tr({ zh: '项目符号列表', en: 'Bullet list' })} disabled={!canEdit} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={17} /></DocumentTool><DocumentTool label={tr({ zh: '编号列表', en: 'Numbered list' })} disabled={!canEdit} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={17} /></DocumentTool>{extraList}<DocumentTool label={tr({ zh: '引用', en: 'Quote' })} disabled={!canEdit} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={17} /></DocumentTool>{trailing && <><span className="doc-tool-separator" />{trailing}</>}
    </div>
  );
}

export function DocumentCanvas({ editor, zoom, wide = false, children }: {
  editor: Editor; zoom: number; wide?: boolean; children?: ReactNode;
}) {
  return <div className={`doc-canvas-row${children ? ' has-sidebar' : ''}${wide ? ' is-wide' : ''}`}>
    <EditorContent editor={editor} className="doc-editor" style={{ '--doc-zoom': zoom / 100 } as CSSProperties} />
    {children}
  </div>;
}
