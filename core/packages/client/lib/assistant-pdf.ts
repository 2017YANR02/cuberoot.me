import type { AssistantArtifact } from '@cuberoot/shared/site-assistant';
import { formatWcaResult } from '@/lib/wca-format-result';
import type { RichTextNode } from '@/lib/document-export';

type Node = { type: string; value?: string; depth?: number; ordered?: boolean; url?: string; children?: Node[] };
const text = (value: string): RichTextNode => ({type:'text', text:value});
const paragraph = (content: RichTextNode[]): RichTextNode => ({type:'paragraph', content});

/** Parse with the same Markdown engine as chat, then use the shared PDF renderer. */
export async function assistantPdfDocument(question: string, answer: string, lang: 'zh' | 'en', artifacts: AssistantArtifact[] = []): Promise<RichTextNode> {
  const [{default: Markdown}, {default: gfm}] = await Promise.all([import('react-markdown'), import('remark-gfm')]);
  let root: Node = {type:'root', children:[]};
  Markdown({children:answer, skipHtml:true, remarkPlugins:[gfm, () => (tree: Node) => { root = tree; }]});
  function convert(node: Node): RichTextNode[] {
    const content = () => (node.children ?? []).flatMap(convert);
    switch (node.type) {
      case 'text': return [text(node.value ?? '')];
      case 'inlineCode': return [{...text(node.value ?? ''), marks:[{type:'code'}]}];
      case 'strong': case 'emphasis': case 'delete':
        return content().map(child => ({...child, marks:[...child.marks ?? [], {type:node.type === 'strong' ? 'bold' : node.type === 'emphasis' ? 'italic' : 'strike'}]}));
      case 'link': return [...content(), ...(node.url && /^(https?:\/\/|mailto:)/i.test(node.url) ? [text(` (${node.url})`)] : [])];
      case 'break': return [{type:'hardBreak'}];
      case 'heading': return [{type:'heading', attrs:{level:node.depth}, content:content()}];
      case 'paragraph': return [paragraph(content())];
      case 'code': return [{type:'codeBlock', content:[text(node.value ?? '')]}];
      case 'blockquote': return [{type:'blockquote', content:content()}];
      case 'list': return [{type:node.ordered ? 'orderedList' : 'bulletList', content:content()}];
      case 'listItem': return [{type:'listItem', content:content()}];
      case 'thematicBreak': return [{type:'horizontalRule'}];
      case 'table': return [{type:'table', content:(node.children ?? []).map((row, index) => ({
        type:'tableRow', content:(row.children ?? []).map(cell => ({type:index === 0 ? 'tableHeader' : 'tableCell', content:[paragraph(convert(cell))]})),
      }))}];
      case 'html': return [];
      case 'image': return [];
      default: return content();
    }
  }
  return {type:'doc', content:[
    {type:'heading', attrs:{level:2}, content:[text(lang === 'zh' ? '用户' : 'User')]},
    paragraph([text(question)]),
    {type:'horizontalRule'},
    {type:'heading', attrs:{level:2}, content:[text(lang === 'zh' ? 'CubeRoot · AI 助手' : 'CubeRoot · AI assistant')]},
    ...convert(root),
    ...artifacts.flatMap((artifact): RichTextNode[] => {
      const heading: RichTextNode = {type:'heading', attrs:{level:2}, content:[text(artifact.title)]};
      const table = (columns:string[], rows:string[][]): RichTextNode => ({type:'table', content:[columns, ...rows].map((row, index) => ({
        type:'tableRow', content:row.map(value => ({type:index === 0 ? 'tableHeader' : 'tableCell', content:[paragraph([text(value)])]})),
      }))});
      if (artifact.kind === 'table') return [heading, table(artifact.columns, artifact.rows)];
      if (artifact.kind === 'cube-photo') return [heading,
        paragraph([text(artifact.status === 'partial'
          ? { zh: '完整状态尚不唯一，仅展示所有可能状态均适用的公式。', en: 'The complete state is ambiguous; displayed algorithms work for every compatible state.' }[lang]
          : artifact.status === 'corners-only'
          ? { zh: '仅确定顶层角块，棱块与中层状态未推导。', en: 'Only the last-layer corners are known; edge and middle-layer states are unknown.' }[lang]
          : { zh: '按标准配色、前两层已复原推导。每条公式独立执行，已包含 AUF。', en: 'Assumes standard colors and solved F2L. Each algorithm is independent and includes AUF.' }[lang])]),
        ...(artifact.recognition?.status === 'ok' || artifact.recognition?.status === 'corners-only' ? [paragraph([text((['U','F','R'] as const).map(face => `${face}: ${(artifact.recognition!.candidates[0] ?? artifact.recognition!.cornerCandidates![0]).frame[face]}`).join(' · '))])] : [paragraph([text(artifact.status)])]),
        ...artifact.results.flatMap(r => r.match ? [paragraph([text(`${r.set.toUpperCase()} · ${r.match.name}`)]), {type:'codeBlock', content:[text(r.match.alg)]}, paragraph([text(`https://www.cuberoot.me${r.match.href}`)])] : [paragraph([text(`${r.set.toUpperCase()}: ${r.status}`)])]),
      ];
      const chartNodes: RichTextNode[] = [];
      if (!['333mbf', '333mbo'].includes(artifact.event)) {
        const people = [...new Set(artifact.points.map(point => point.person))];
        for (const person of people) {
          if (people.length > 1) chartNodes.push(paragraph([{...text(person), marks:[{type:'bold'}]}]));
          chartNodes.push({type:'pdfChart', pdfChart:artifact.points.filter(point => point.person === person && point.value > 0).map(point => ({
            date:point.date, value:point.value, label:formatWcaResult(point.value, artifact.event, artifact.metric),
          }))});
        }
      }
      return [heading, ...chartNodes, table(
        lang === 'zh' ? ['日期', '成绩', '选手', '说明'] : ['Date', 'Result', 'Person', 'Details'],
        artifact.points.map(point => [point.date, formatWcaResult(point.value, artifact.event, artifact.metric), point.person, point.label]),
      )];
    }),
  ]};
}
