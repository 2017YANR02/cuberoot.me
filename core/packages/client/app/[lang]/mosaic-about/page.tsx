'use client';

import Link from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import PageHeading from '@/components/PageHeading';
import { useT } from '@/hooks/useT';
import '@/components/report-page.css';

export default function MosaicAboutPage() {
  const t = useT();
  return <main className="report-page">
    <header className="report-header">
      <PageHeading backHref="/mosaic">{t('魔方拼画', 'Cube mosaics')}</PageHeading>
      <p>{t('把照片转成魔方色块，预览效果并导出分块拼装图纸。', 'Turn a photo into cube colours, preview the mosaic and export a build guide.')}</p>
      <div className="report-links"><Link href="/mosaic">{t('制作拼画', 'Create a mosaic')}</Link></div>
    </header>
    <h2>{t('先决定要用多少魔方', 'Start with your cube budget')}</h2>
    <p>{t('例如用三阶拼 20 列 × 30 行，需要 600 个魔方，画面由 60 × 90 个色块组成。魔方数量决定能保留多少细节，原图像素再高也不能突破这个网格。', 'A 20-column × 30-row mosaic uses 600 3×3 cubes and produces a 60 × 90-sticker image. The cube count limits detail, regardless of the source photo’s resolution.')}</p>
    <ol className="report-steps">
      <li><strong>{t('裁剪主体、设置行列。', 'Crop the subject and set the grid. ')}</strong>{t('让人物或图案在有限网格里仍能辨认。', 'Keep the subject recognisable at the chosen size.')}</li>
      <li><strong>{t('比较配色效果。', 'Compare colour treatments. ')}</strong>{t('选择渐变或抖色方案，再调整亮度、对比度与可用颜色。', 'Choose a gradient or dithering variant, then adjust brightness, contrast and available colours.')}</li>
      <li><strong>{t('导出 PDF，按分块拼装。', 'Export a PDF and build block by block. ')}</strong>{t('图纸包含总览、位置和色块标记，可选黑白打印。', 'The guide includes an overview, block locations and colour labels, with a black-and-white print option.')}</li>
    </ol>
    <h2>{t('实物效果的边界', 'Before building')}</h2>
    <ul className="report-limits">
      <li>{t('屏幕颜色与贴纸、光线有差异，先用一小块实物核对配色。', 'Screen colours differ from stickers under real lighting. Check a small physical sample first.')}</li>
      <li>{t('图纸给出可见面的色块目标，不提供每个魔方的转动解法，也不验证所有色块组合都能转出来。', 'The guide specifies the visible face colours. It does not supply turn sequences or validate that every sticker pattern is reachable.')}</li>
    </ul>
    <details className="report-details">
      <MoreToggle as="summary">{t('配色方法与来源', 'Colour methods and source')}</MoreToggle>
      <div className="report-detail-body">
        <p>{t('渐变按明暗分配颜色；抖色用相邻色块的排列近似原图中不存在于调色板的颜色。两者的观感不同，应按实际观看距离选择。调色板可以修改颜色或禁用不需要的颜色。', 'Gradient mapping assigns colours by brightness. Dithering arranges neighbouring stickers to suggest colours outside the palette. Compare them at the intended viewing distance. Palette colours can be edited or disabled.')}</p>
        <p>{t('PDF 可设置每块的魔方行列数、颜色字母和拼装方向。工具基于：', 'PDF options include block dimensions, colour letters and build direction. Based on: ')}<a href="https://github.com/Roman-/mosaic" target="_blank" rel="noopener noreferrer">Roman-/mosaic</a></p>
      </div>
    </details>
  </main>;
}
