/**
 * 公式表 PDF —— 把 `/alg` 下任意一批 case(图 + 名字 + 公式)排成能直接打印的 A4。
 *
 * 为什么不是 `window.print()`:页面上的卡片是懒加载的(视口外的图根本没请求),
 * 而且带着导航 / 筛选器 / 折叠状态,打出来又散又缺图。这里从数据重新排一遍版,
 * 一页塞得下三到四倍的 case,魔方图还是矢量(放大不糊)。
 *
 * 排版:自适应列数 + 字号(按公式实际宽度挑,见 `pickLayout`)→ 行内按最高的格子对齐 →
 * 子组标题横贯整行。所有单位都是 pt(jsPDF 的 'pt'),A4 = 595.28 × 841.89。
 */
import { jsPDF } from 'jspdf';
import { FONT_MONO, FONT_SANS, FONT_CJK, loadPdfFonts, ensureCjkFont, hasCjk } from '@/lib/pdf-fonts';
import { svgStringToElement, embedSvg } from '@/lib/pdf-svg';
import { algCaseSvg, type CaseSvgInput } from './case_svg';

export interface AlgPdfCase {
  /** 卡片主名(`Aa` / `U1` / `AD`) */
  name: string;
  /** 副名或编号(`#12`);跟在主名后面,灰色小字 */
  sub?: string;
  /** 子组标题。相邻同名归一段,变了就起一条新的横贯标题。 */
  group?: string;
  /** 摆出这个 case 的打乱 */
  setup?: string;
  /** 要印的公式,顺序即库里的顺序(第一条是主推解法) */
  algs: string[];
  /** 缩略图;省略 = 这份表不出图(换位子字典那种纯文字表) */
  thumb?: CaseSvgInput;
}

export interface AlgPdfSheetInput {
  /** 页首大标题(`3x3 PLL`) */
  title: string;
  /** 标题下那行小字,一般是「N 个 case」+ 出处 URL */
  subtitle?: string;
  cases: AlgPdfCase[];
  /** 下载文件名,不带扩展名 */
  filename: string;
  /** 每画完一个 case 报一次(用来做按钮上的百分比) */
  onProgress?: (done: number, total: number) => void;
  /** 取消信号:每个 case 前查一次,true 就中止(用户点了停 / 离开页面) */
  shouldCancel?: () => boolean;
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 34;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const FOOT_H = 22;              // 页脚(页码)占高
const TITLE_SIZE = 15;
const SUB_SIZE = 8;
const GROUP_SIZE = 9.5;
const NAME_SIZE = 8.5;
const ALG_SIZE = 8;             // 公式字号上限(放不下会往 7 降,见 pickLayout)
const SETUP_SIZE = 6.6;
const CELL_PAD = 4;
const GAP_X = 12;
const GAP_Y = 8;
const IMG_GAP = 6;              // 图与文字之间

/** 列数 → 缩略图边长。列越多图越小,否则文字列会被挤没。 */
const IMG_FOR_COLS: Record<number, number> = { 1: 56, 2: 46, 3: 40, 4: 33 };

/**
 * 挑「几列 + 公式多大字」:先保字号,再尽量多列。
 *
 * 单列排一套 PLL 要三页纸,右边一半全是白的 —— 公式再长也就四十来字符,值得为多一列
 * 把字号从 8 降到 7(打印出来仍是脚注大小)。判据用 85 分位而不是最长那条:库里总有
 * 一两条二十步的怪物,为它一条把整份表压成单列不划算,那几条折行就是了。
 */
function pickLayout(doc: jsPDF, cases: AlgPdfCase[], withImage: boolean): { cols: number; algSize: number } {
  doc.setFont(FONT_MONO, 'normal');
  doc.setFontSize(10);
  const widths = cases.flatMap(c => c.algs.map(a => doc.getTextWidth(a)));
  if (!widths.length) return { cols: 3, algSize: ALG_SIZE };
  widths.sort((a, b) => a - b);
  const p85at10 = widths[Math.min(widths.length - 1, Math.floor(widths.length * 0.85))];
  const textWidthFor = (cols: number) =>
    (CONTENT_W - GAP_X * (cols - 1)) / cols - 2 * CELL_PAD - (withImage ? IMG_FOR_COLS[cols] + IMG_GAP : 0);
  for (const algSize of [ALG_SIZE, 7.5, 7]) {
    for (const cols of [4, 3, 2]) {
      if (textWidthFor(cols) >= p85at10 * algSize / 10) return { cols, algSize };
    }
  }
  return { cols: 1, algSize: ALG_SIZE };
}

interface Laid {
  c: AlgPdfCase;
  /** 每条公式折行后的文本行 */
  lines: string[][];
  h: number;
}

export async function downloadAlgSheet(input: AlgPdfSheetInput): Promise<void> {
  const doc = await buildAlgSheet(input);
  if (doc) doc.save(`${input.filename}.pdf`);
}

/** 建好整份文档;被取消则返回 null。 */
export async function buildAlgSheet({
  title, subtitle, cases, onProgress, shouldCancel,
}: AlgPdfSheetInput): Promise<jsPDF | null> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  await loadPdfFonts(doc);

  // 中文只可能出现在标题 / 子组名这类「文案」里(公式和 case 名都是记号),
  // 真有才拖那 4MB 的字体。
  const proseText = [title, subtitle ?? '', ...cases.map(c => `${c.name}${c.sub ?? ''}${c.group ?? ''}`)].join('');
  const cjk = hasCjk(proseText);
  if (cjk) await ensureCjkFont(doc);
  const SANS = cjk ? FONT_CJK : FONT_SANS;

  const withImage = cases.some(c => c.thumb);
  const { cols, algSize } = pickLayout(doc, cases, withImage);
  const algLine = algSize * 1.2;
  const colW = (CONTENT_W - GAP_X * (cols - 1)) / cols;
  const img = withImage ? IMG_FOR_COLS[cols] : 0;
  const textX = CELL_PAD + (withImage ? img + IMG_GAP : 0);
  const textW = colW - CELL_PAD - textX;

  // 同组的 case 归到一起(库里的顺序是交错的:PLL 的 Adj Swap / Opp Swap / Adj Swap…)。
  // 不归拢的话「组变了就起一条标题」会把同一个组名印上好几遍。按**首次出现**排序,
  // 组内顺序不动 —— 和列表页 `grouped` 那个 Map 同一套。
  const byGroup = new Map<string, AlgPdfCase[]>();
  for (const c of cases) {
    const k = c.group ?? '';
    const arr = byGroup.get(k);
    if (arr) arr.push(c); else byGroup.set(k, [c]);
  }
  const ordered = [...byGroup.values()].flat();

  // 折行 + 高度先全算出来:格子高不依赖图(图是定宽方块),所以排版可以一次过,
  // 边排边把 SVG 塞进去,不用把几百张图先全渲染出来堆在内存里。
  doc.setFont(FONT_MONO, 'normal');
  doc.setFontSize(algSize);
  const laid: Laid[] = ordered.map(c => {
    const lines = c.algs.map(a => doc.splitTextToSize(a, textW) as string[]);
    const nLines = lines.reduce((n, l) => n + l.length, 0);
    const textH = NAME_SIZE + 2 + (c.setup ? SETUP_SIZE + 2 : 0) + nLines * algLine;
    return { c, lines, h: Math.max(img, textH) + 2 * CELL_PAD };
  });

  let y = MARGIN;

  const pageBottom = () => PAGE_H - MARGIN - FOOT_H;
  const newPage = () => {
    doc.addPage();
    y = MARGIN;
    // 续页顶上重复一行小标题 —— 打印出来散落在桌上时还认得出是哪份表
    doc.setFont(SANS, 'normal');
    doc.setFontSize(SUB_SIZE);
    doc.setTextColor(140);
    doc.text(title, MARGIN, y + SUB_SIZE);
    doc.setTextColor(0);
    y += SUB_SIZE + 10;
  };

  // ── 页首
  doc.setFont(SANS, 'bold');
  doc.setFontSize(TITLE_SIZE);
  doc.text(title, MARGIN, y + TITLE_SIZE);
  y += TITLE_SIZE + 4;
  if (subtitle) {
    doc.setFont(SANS, 'normal');
    doc.setFontSize(SUB_SIZE);
    doc.setTextColor(130);
    doc.text(subtitle, MARGIN, y + SUB_SIZE);
    doc.setTextColor(0);
    y += SUB_SIZE + 4;
  }
  y += 8;

  let i = 0;
  let lastGroup: string | undefined;
  let done = 0;
  while (i < laid.length) {
    if (shouldCancel?.()) return null;

    // 这一行取 `cols` 个(同组内),行高 = 里面最高的那个
    const g = laid[i].c.group;
    const row: Laid[] = [];
    while (row.length < cols && i + row.length < laid.length && laid[i + row.length].c.group === g) {
      row.push(laid[i + row.length]);
    }
    const rowH = Math.max(...row.map(r => r.h));

    // 子组换了 ⟹ 先落一条横贯标题(整行独占,后面的格子从新行起)。
    // 换页判据把**跟在它后面那一行**也算进去 —— 否则标题会孤零零留在页底,
    // 它的 case 全翻到下一页。
    const headH = g && g !== lastGroup ? GROUP_SIZE + 8 : 0;
    lastGroup = g;
    if (y + headH + rowH > pageBottom()) newPage();
    if (headH) {
      doc.setFont(SANS, 'bold');
      doc.setFontSize(GROUP_SIZE);
      doc.setTextColor(0);
      doc.text(g!, MARGIN, y + GROUP_SIZE);
      doc.setDrawColor(205);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, y + GROUP_SIZE + 3, PAGE_W - MARGIN, y + GROUP_SIZE + 3);
      y += headH;
    }

    for (let k = 0; k < row.length; k++) {
      const { c, lines } = row[k];
      const x = MARGIN + k * (colW + GAP_X);
      let ty = y + CELL_PAD;

      if (c.thumb) {
        const svg = await algCaseSvg(c.thumb);
        if (svg) await embedSvg(doc, svgStringToElement(svg), x + CELL_PAD, y + CELL_PAD, img, img);
      }

      doc.setFont(SANS, 'bold');
      doc.setFontSize(NAME_SIZE);
      doc.setTextColor(0);
      doc.text(c.name, x + textX, ty + NAME_SIZE - 1);
      if (c.sub) {
        const w = doc.getTextWidth(c.name);
        doc.setFont(SANS, 'normal');
        doc.setFontSize(NAME_SIZE - 1);
        doc.setTextColor(150);
        doc.text(c.sub, x + textX + w + 4, ty + NAME_SIZE - 1);
      }
      ty += NAME_SIZE + 2;

      if (c.setup) {
        doc.setFont(FONT_MONO, 'normal');
        doc.setFontSize(SETUP_SIZE);
        doc.setTextColor(140);
        doc.text(c.setup, x + textX, ty + SETUP_SIZE - 1, { maxWidth: textW });
        ty += SETUP_SIZE + 2;
      }

      doc.setFont(FONT_MONO, 'normal');
      doc.setFontSize(algSize);
      doc.setTextColor(20);
      for (const wrapped of lines) {
        for (const line of wrapped) {
          doc.text(line, x + textX, ty + algSize - 1.5);
          ty += algLine;
        }
      }

      done++;
      onProgress?.(done, laid.length);
    }

    i += row.length;
    y += rowH + GAP_Y;
    // 让出主线程,否则几百个 case 的表在生成期间整页卡住
    if (i % (cols * 4) === 0) await new Promise(r => setTimeout(r, 0));
  }

  // ── 页脚页码(最后统一补,这时才知道总页数)
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont(SANS, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(150);
    doc.text(`${p} / ${total}`, PAGE_W - MARGIN, PAGE_H - MARGIN, { align: 'right' });
    doc.text('cuberoot.me', MARGIN, PAGE_H - MARGIN);
  }
  doc.setTextColor(0);
  return doc;
}
