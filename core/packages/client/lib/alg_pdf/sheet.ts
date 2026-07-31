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
import { renderSVG } from 'uqr';
import { FONT_MONO, FONT_SANS, FONT_CJK, loadPdfFonts, ensureCjkFont, hasCjk } from '@/lib/pdf-fonts';
import { svgStringToElement, embedSvg } from '@/lib/pdf-svg';
import { loadPdfLogo, drawPdfLogo } from '@/lib/pdf-logo';
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
  /** 纸色。默认 `light`(白纸黑字,打印用);`dark` 是屏幕上看的深底白字。 */
  theme?: AlgPdfTheme;
  /** 首页右上角二维码指向的网址(一般就是这份表所在的页面);省略 = 不印二维码。 */
  url?: string;
  /**
   * 每个子组独占一页(ZBLL 那种「一页一类」的练习表:翻到哪页就练哪一类)。
   * 开了之后首页只剩刊头,成一张封面;版面也会按「一组恰好一页」重算图和行距。
   * 只有一个子组时没有意义,调用方(`algSheetFromCases`)会自己关掉。
   */
  groupPerPage?: boolean;
}

export type AlgPdfTheme = 'light' | 'dark';

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
const LOCKUP_H = 46;            // 首页刊头的完整标志(含中英文字)高
const RUN_LOGO_H = 9;           // 续页页眉那枚小标记
const RUN_HEAD_H = Math.max(SUB_SIZE, RUN_LOGO_H) + 10;  // 续页页眉整条占高
// 二维码边长。一条 /alg 网址编出来是 33×33 模块(含 2 模块留白),54pt 下每模块
// 约 0.58mm —— 手机相机可靠识别的下限在 0.5mm 上下,再小就得贴到镜头前才扫得出。
const QR_SIZE = 54;
const CELL_PAD = 4;
const GAP_X = 12;
const GAP_Y = 8;
const IMG_GAP = 6;              // 图与文字之间

/** 列数 → 缩略图边长。列越多图越小,否则文字列会被挤没。 */
const IMG_FOR_COLS: Record<number, number> = { 1: 56, 2: 46, 3: 40, 4: 33 };

/**
 * 纸色。灰阶数值直接喂 `setTextColor(n)`。
 *
 * 浅色版不铺底色 —— 让纸自己白,打印机不会为一整页背景喷墨。深色版必须铺满整页:
 * PDF 阅读器不会给你补背景,只画白字就是一页空白。
 */
interface Palette {
  /** 整页底色;省略 = 不铺(白纸) */
  page?: [number, number, number];
  title: number;
  body: number;
  muted: number;
  faint: number;
  rule: number;
}
const PALETTE: Record<AlgPdfTheme, Palette> = {
  light: { title: 0, body: 20, muted: 130, faint: 150, rule: 205 },
  dark: { page: [23, 23, 23], title: 237, body: 224, muted: 152, faint: 128, rule: 74 },
};

/**
 * 挑「几列 + 公式多大字」:先保字号,再尽量多列。
 *
 * 单列排一套 PLL 要三页纸,右边一半全是白的 —— 公式再长也就四十来字符,值得为多一列
 * 把字号从 8 降到 7(打印出来仍是脚注大小)。判据用 85 分位而不是最长那条:库里总有
 * 一两条二十步的怪物,为它一条把整份表压成单列不划算,那几条折行就是了。
 */
function pickLayout(doc: jsPDF, cases: AlgPdfCase[], withImage: boolean): { cols: number; algSize: number; p85: number } {
  doc.setFont(FONT_MONO, 'normal');
  doc.setFontSize(10);
  const widths = cases.flatMap(c => c.algs.map(a => doc.getTextWidth(a)));
  if (!widths.length) return { cols: 3, algSize: ALG_SIZE, p85: 0 };
  widths.sort((a, b) => a - b);
  const p85at10 = widths[Math.min(widths.length - 1, Math.floor(widths.length * 0.85))];
  const textWidthFor = (cols: number) =>
    (CONTENT_W - GAP_X * (cols - 1)) / cols - 2 * CELL_PAD - (withImage ? IMG_FOR_COLS[cols] + IMG_GAP : 0);
  for (const algSize of [ALG_SIZE, 7.5, 7]) {
    for (const cols of [4, 3, 2]) {
      if (textWidthFor(cols) >= p85at10 * algSize / 10) return { cols, algSize, p85: p85at10 };
    }
  }
  return { cols: 1, algSize: ALG_SIZE, p85: p85at10 };
}

interface Laid {
  c: AlgPdfCase;
  /** 打乱折行后的文本行 */
  setup: string[];
  /** 每条公式折行后的文本行 */
  lines: string[][];
  h: number;
}

/** 折行后第二行起缩进,不然三条各折两行的公式会糊成一坨,看不出哪行接哪行。 */
const WRAP_INDENT = 8;

export async function downloadAlgSheet(input: AlgPdfSheetInput): Promise<void> {
  const doc = await buildAlgSheet(input);
  if (doc) doc.save(`${input.filename}.pdf`);
}

/** 建好整份文档;被取消则返回 null。 */
export async function buildAlgSheet({
  title, subtitle, cases, onProgress, shouldCancel, theme = 'light', url, groupPerPage,
}: AlgPdfSheetInput): Promise<jsPDF | null> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  await loadPdfFonts(doc);
  const dark = theme === 'dark';
  const pal = PALETTE[theme];
  const [lockup, mark] = await Promise.all([loadPdfLogo('lockup', dark), loadPdfLogo('mark', dark)]);

  const paintPage = () => {
    if (!pal.page) return;
    doc.setFillColor(...pal.page);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  };

  // 中文只可能出现在标题 / 子组名这类「文案」里(公式和 case 名都是记号),
  // 真有才拖那 4MB 的字体。
  const proseText = [title, subtitle ?? '', ...cases.map(c => `${c.name}${c.sub ?? ''}${c.group ?? ''}`)].join('');
  const cjk = hasCjk(proseText);
  if (cjk) await ensureCjkFont(doc);
  const SANS = cjk ? FONT_CJK : FONT_SANS;

  const withImage = cases.some(c => c.thumb);
  const { cols, algSize, p85 } = pickLayout(doc, cases, withImage);
  const algLine = algSize * 1.2;
  const colW = (CONTENT_W - GAP_X * (cols - 1)) / cols;

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

  const pageBottom = () => PAGE_H - MARGIN - FOOT_H;
  const perPage = !!groupPerPage && byGroup.size > 1;
  const groupTop = MARGIN + RUN_HEAD_H + GROUP_SIZE + 8;   // 一页一组时,内容从页眉 + 组标题下面起
  const groupBudget = pageBottom() - groupTop;

  doc.setFont(FONT_MONO, 'normal');
  /** 折行按**首行**的宽度算(续行缩进,窄一点),够用且不会低估行数。 */
  const wrap = (text: string, size: number, tw: number) => {
    doc.setFontSize(size);
    return doc.splitTextToSize(text, tw - WRAP_INDENT) as string[];
  };
  const layOut = (imgSize: number): Laid[] => {
    const tw = colW - 2 * CELL_PAD - (withImage ? imgSize + IMG_GAP : 0);
    return ordered.map(c => {
      // 打乱也会折行 —— 只按一行算高的话,第二行直接压在第一条公式上
      const setup = c.setup ? wrap(c.setup, SETUP_SIZE, tw) : [];
      const lines = c.algs.map(a => wrap(a, algSize, tw));
      const nLines = lines.reduce((n, l) => n + l.length, 0);
      const textH = NAME_SIZE + 2 + setup.length * (SETUP_SIZE + 2) + nLines * algLine;
      return { c, setup, lines, h: Math.max(imgSize, textH) + 2 * CELL_PAD };
    });
  };
  /** 最挤的那一组排下来有多高(行高 = 行内最高的格子)。 */
  const tallestGroup = (laid: Laid[]) => {
    let worst = 0;
    let at = 0;
    for (const g of byGroup.values()) {
      const hs = laid.slice(at, at + g.length).map(l => l.h);
      at += g.length;
      let total = -GAP_Y;
      for (let i = 0; i < hs.length; i += cols) total += Math.max(...hs.slice(i, i + cols)) + GAP_Y;
      worst = Math.max(worst, total);
    }
    return worst;
  };

  // 一页一组时把图放大到页面吃得下的最大尺寸。ZBLL 一类才 12 个 case,照原尺寸排就是
  // 整页顶着三分之一的内容、下面全白。图变大 ⟹ 文字列变窄 ⟹ 折行变多 ⟹ 格子变高,
  // 所以不能算一次了事:在「排得下」这个单调条件上二分。下界是原尺寸(放大不成就照旧),
  // 上界让 85 分位的公式最多折成两行 —— 再窄下去整页都是断成三四截的公式。
  let img = withImage ? IMG_FOR_COLS[cols] : 0;
  if (perPage && withImage) {
    let lo = img;
    let hi = Math.min(
      groupBudget - 2 * CELL_PAD,
      colW - 2 * CELL_PAD - IMG_GAP - Math.max(p85 * algSize / 10 / 2, 60),
    );
    if (hi > lo && tallestGroup(layOut(lo)) <= groupBudget) {
      for (let k = 0; k < 7 && hi - lo > 2; k++) {
        const mid = (lo + hi) / 2;
        if (tallestGroup(layOut(mid)) <= groupBudget) lo = mid; else hi = mid;
      }
      img = lo;
    }
  }
  const textX = CELL_PAD + (withImage ? img + IMG_GAP : 0);

  // 折行 + 高度全算出来:格子高不依赖图(图是定宽方块),所以排版可以一次过,
  // 边排边把 SVG 塞进去,不用把几百张图先全渲染出来堆在内存里。
  const laid = layOut(img);

  // 图放到头之后仍有富余(比如公式短、一组不满一页)就摊进行距,每行最多多给 24pt ——
  // 硬撑到页底的话最后一行会贴着页脚。
  let gapY = GAP_Y;
  if (perPage) {
    const rows = Math.ceil(Math.max(...[...byGroup.values()].map(g => g.length)) / cols);
    const slack = groupBudget - tallestGroup(laid);
    if (rows > 1 && slack > 0) gapY = GAP_Y + Math.min(24, slack / (rows - 1));
  }

  // 一页一组时首页只剩刊头 —— 顶在页首像是排版排漏了,压到三分之一处才像张扉页
  let y = perPage ? PAGE_H * 0.3 : MARGIN;

  const newPage = async () => {
    doc.addPage();
    paintPage();
    y = MARGIN;
    // 续页页眉:小标记 + 重复一行标题 —— 打印出来散落在桌上时还认得出是哪份表、出自哪
    const lw = await drawPdfLogo(doc, mark, MARGIN, y - 1, RUN_LOGO_H);
    doc.setFont(SANS, 'normal');
    doc.setFontSize(SUB_SIZE);
    doc.setTextColor(pal.muted);
    doc.text(title, MARGIN + (lw ? lw + 6 : 0), y + SUB_SIZE - 1);
    y += Math.max(SUB_SIZE, RUN_LOGO_H) + 10;
  };

  // ── 首页刊头:标志 / 标题 / 出处一列居中。副标题里带着 `cuberoot.me/alg/...`,
  //    正好接在标志下面成一块出处。
  paintPage();
  // 二维码扫过去就是这份表的在线版(带上当前视角 / 筛选)。永远白底黑码,不跟着纸色反相
  // —— 反相的二维码有相当一部分相机认不出;深色纸上那圈白留白反而是它的取景框。
  if (url) {
    const qr = renderSVG(url, { border: 2, ecc: 'M', blackColor: '#111', whiteColor: '#fff' });
    await embedSvg(doc, svgStringToElement(qr), PAGE_W - MARGIN - QR_SIZE, MARGIN, QR_SIZE, QR_SIZE);
  }
  const logoW = await drawPdfLogo(doc, lockup, PAGE_W / 2, y, LOCKUP_H, 'center');
  if (logoW) y += LOCKUP_H + 10;
  doc.setFont(SANS, 'bold');
  doc.setFontSize(TITLE_SIZE);
  doc.setTextColor(pal.title);
  doc.text(title, PAGE_W / 2, y + TITLE_SIZE, { align: 'center' });
  y += TITLE_SIZE + 4;
  if (subtitle) {
    doc.setFont(SANS, 'normal');
    doc.setFontSize(SUB_SIZE);
    doc.setTextColor(pal.muted);
    doc.text(subtitle, PAGE_W / 2, y + SUB_SIZE, { align: 'center' });
    y += SUB_SIZE + 4;
  }
  y += 10;

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
    // 它的 case 全翻到下一页。一页一组时子组一换就翻页,首页因此只剩刊头(封面)。
    const newGroup = g !== lastGroup;
    const headH = g && newGroup ? GROUP_SIZE + 8 : 0;
    lastGroup = g;
    if ((perPage && newGroup) || y + headH + rowH > pageBottom()) await newPage();
    if (headH) {
      doc.setFont(SANS, 'bold');
      doc.setFontSize(GROUP_SIZE);
      doc.setTextColor(pal.title);
      doc.text(g!, MARGIN, y + GROUP_SIZE);
      doc.setDrawColor(pal.rule);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, y + GROUP_SIZE + 3, PAGE_W - MARGIN, y + GROUP_SIZE + 3);
      y += headH;
    }

    for (let k = 0; k < row.length; k++) {
      const { c, lines, setup } = row[k];
      const x = MARGIN + k * (colW + GAP_X);
      let ty = y + CELL_PAD;

      if (c.thumb) {
        const svg = await algCaseSvg(c.thumb);
        if (svg) await embedSvg(doc, svgStringToElement(svg), x + CELL_PAD, y + CELL_PAD, img, img);
      }

      doc.setFont(SANS, 'bold');
      doc.setFontSize(NAME_SIZE);
      doc.setTextColor(pal.title);
      doc.text(c.name, x + textX, ty + NAME_SIZE - 1);
      if (c.sub) {
        const w = doc.getTextWidth(c.name);
        doc.setFont(SANS, 'normal');
        doc.setFontSize(NAME_SIZE - 1);
        doc.setTextColor(pal.faint);
        doc.text(c.sub, x + textX + w + 4, ty + NAME_SIZE - 1);
      }
      ty += NAME_SIZE + 2;

      if (setup.length) {
        doc.setFont(FONT_MONO, 'normal');
        doc.setFontSize(SETUP_SIZE);
        doc.setTextColor(pal.muted);
        for (let n = 0; n < setup.length; n++) {
          doc.text(setup[n], x + textX + (n ? WRAP_INDENT : 0), ty + SETUP_SIZE - 1);
          ty += SETUP_SIZE + 2;
        }
      }

      doc.setFont(FONT_MONO, 'normal');
      doc.setFontSize(algSize);
      doc.setTextColor(pal.body);
      for (const wrapped of lines) {
        for (let n = 0; n < wrapped.length; n++) {
          doc.text(wrapped[n], x + textX + (n ? WRAP_INDENT : 0), ty + algSize - 1.5);
          ty += algLine;
        }
      }

      done++;
      onProgress?.(done, laid.length);
    }

    i += row.length;
    y += rowH + gapY;
    // 让出主线程,否则几百个 case 的表在生成期间整页卡住
    if (i % (cols * 4) === 0) await new Promise(r => setTimeout(r, 0));
  }

  // ── 页脚页码(最后统一补,这时才知道总页数)
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont(SANS, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(pal.faint);
    doc.text(`${p} / ${total}`, PAGE_W - MARGIN, PAGE_H - MARGIN, { align: 'right' });
    doc.text('cuberoot.me', MARGIN, PAGE_H - MARGIN);
  }
  return doc;
}
