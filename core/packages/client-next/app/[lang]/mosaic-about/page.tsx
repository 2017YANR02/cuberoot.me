'use client';

/**
 * /mosaic-about — 魔方马赛克说明页
 */
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './mosaic_about.css';
import i18n from "@/i18n/i18n-client";

interface StepProps { step: number; title: string; body: string; highlight?: boolean; }
function Step({ step, title, body, highlight }: StepProps) {
  return (
    <div className={`moa-step${highlight ? ' is-highlight' : ''}`}>
      <span className="moa-step-num">{step}</span>
      <div>
        <div className="moa-step-title">{title}</div>
        <div className="moa-step-body">{body}</div>
      </div>
    </div>
  );
}
function Arrow() { return <span className="moa-arrow" aria-hidden="true">↓</span>; }

export default function MosaicAboutPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  useDocumentTitle('魔方马赛克说明', 'Mosaic Guide', "魔方馬賽克說明");

  return (
    <div className="moa-page">
      <div className="moa-header">
        <Link href="/mosaic" className="moa-back">
          <ArrowLeft size={16} />
          <span>{t('返回马赛克', 'Back to Mosaic', "返回馬賽克")}</span>
        </Link>
      </div>

      <main className="moa-main">
        <h1 className="moa-title">{t('魔方马赛克是什么', 'What the Mosaic tool does', "魔方馬賽克是什麼")}</h1>
        <p className="moa-intro">
          {t(
            '/mosaic 把任意图片切成网格,每格挑一面魔方的图案(单面 9 块或拆 6 块),最后给你「需要多少个魔方 + 每个魔方应该转到什么状态」的完整方案。可以用来真的拼一面墙,也可以纯欣赏。',
            '/mosaic turns any image into a grid where each cell is one face of a Rubik\'s cube (full 9-sticker face, or split 6-sticker variant). The output is "how many cubes you need + the exact pattern each cube has to show". You can use it to physically build a wall art, or just admire the rendering.', "/mosaic 把任意圖片切成網格,每格挑一面魔方的圖案(單面 9 塊或拆 6 塊),最後給你「需要多少個魔方 + 每個魔方應該轉到什麼狀態」的完整方案。可以用來真的拼一面牆,也可以純欣賞。"
          )}
        </p>

        <h2 className="moa-section-title">{t('两种风格', 'Two styles', "兩種風格")}</h2>
        <p className="moa-section-intro">
          {t(
            '「整面」每个魔方贡献 1 面 9 块,简单但色彩离散度低。「拆面」把每个魔方拆成 6 个朝向单独贡献,色彩密度 ×6,但需要安排好朝向。可在 method-choose 阶段切换。',
            'In "Whole-face" mode each cube contributes 9 stickers from one face — simpler but lower color density. "Split" mode breaks each cube into 6 orientations contributing separately, giving 6× density but requiring careful orientation. Switch between them at the method-choose stage.', "「整面」每個魔方貢獻 1 面 9 塊,簡單但色彩離散度低。「拆面」把每個魔方拆成 6 個朝向單獨貢獻,色彩密度 ×6,但需要安排好朝向。可在 method-choose 階段切換。"
          )}
        </p>

        <h2 className="moa-section-title">{t('使用流程', 'How to use')}</h2>
        <div className="moa-flow">
          <Step
            step={1}
            title={t('上传 / 裁剪', 'Upload and crop', "上傳 / 裁剪")}
            body={t(
              '拖入或选一张图,在 crop 阶段调到目标比例(默认 1:1)。原图越大、细节越多,生成方案越接近原图。',
              'Drag or select an image, then adjust to the target aspect ratio in the crop stage (default 1:1). Higher-resolution, higher-contrast originals give crisper results.', "拖入或選一張圖,在 crop 階段調到目標比例(預設 1:1)。原圖越大、細節越多,生成方案越接近原圖。"
            )}
          />
          <Arrow />
          <Step
            step={2}
            title={t('选方法 + 变体', 'Pick method and variant', "選方法 + 變體")}
            body={t(
              '先选「整面」/「拆面」;再选 grid 尺寸(几列 × 几行 = 多少个魔方)。预览即时算出 sticker 总数和大致成本。',
              'First choose Whole-face / Split. Then pick grid dimensions (cols × rows = total cubes). The preview updates with sticker count and rough cost estimate.', "先選「整面」/「拆面」;再選 grid 尺寸(幾列 × 幾行 = 多少個魔方)。預覽即時算出 sticker 總數和大致成本。"
            )}
          />
          <Arrow />
          <Step
            step={3}
            title={t('调色板', 'Tune the palette', "調色盤")}
            body={t(
              '默认用 WCA 6 色;开 palette 弹层可微调每种颜色对应的 RGB,适配自定义魔方贴纸 / 灯光环境。改完即时重算整图。',
              'Default palette is the 6 WCA colors. Open the palette panel to tweak each color\'s RGB to match custom stickers or lighting. Changes recompute the whole image instantly.', "預設用 WCA 6 色;開 palette 彈層可微調每種顏色對應的 RGB,適配自定義魔方貼紙 / 燈光環境。改完即時重算整圖。"
            )}
          />
          <Arrow />
          <Step
            step={4}
            title={t('导出方案', 'Export the build plan', "匯出方案")}
            body={t(
              '导出包含:总览预览图、每个魔方的 6 面 facelets(从某朝向开始一面一面看)、按行扫描的拼接说明。打印或存 PDF 都行。',
              'The export bundles: the overview render, per-cube 6-face facelets (read one face at a time from a fixed orientation), and a row-by-row build guide. Print or save as PDF.', "匯出包含:總覽預覽圖、每個魔方的 6 面 facelets(從某朝向開始一面一面看)、按行掃描的拼接說明。列印或存 PDF 都行。"
            )}
            highlight
          />
        </div>

        <h2 className="moa-section-title">{t('实物拼装小提示', 'Build tips', "實物拼裝小提示")}</h2>
        <p className="moa-section-intro">
          {t(
            '一般用便宜的练习级魔方(不需要顺滑),买够数 + 5%(应对色块脱胶 / 损坏)。拼前先把每个魔方按方案归位 + 贴标签写位置,墙上一次性装好后调整成本极高。',
            'Use cheap stickered or solid-color practice cubes (smoothness doesn\'t matter); buy 5% extra to cover sticker loss or damage. Solve each cube to its target pattern AND label its position before mounting — once on the wall, adjustments are extremely expensive.', "一般用便宜的練習級魔方(不需要順滑),買夠數 + 5%(應對色塊脫膠 / 損壞)。拼前先把每個魔方按方案歸位 + 貼標籤寫位置,牆上一次性裝好後調整成本極高。"
          )}
        </p>

        <h2 className="moa-section-title">{t('相关页面', 'See also', "相關頁面")}</h2>
        <ul className="moa-refs">
          <li>
            <Link href="/visualcube">{t('VisualCube 编辑器', 'VisualCube Editor', "VisualCube 編輯器")}</Link>
            {t(' — 单个魔方状态可视化,可以快速验证 mosaic 导出的某一格是否正确。', ' — single-cube state visualizer; handy for sanity-checking individual cells from a mosaic plan.', " — 單個魔方狀態視覺化,可以快速驗證 mosaic 匯出的某一格是否正確。")}
          </li>
          <li>
            <a href="https://github.com/Roman-/mosaic" target="_blank" rel="noopener noreferrer">{t('上游项目 Roman-/mosaic', 'Upstream Roman-/mosaic', "上游專案 Roman-/mosaic")}</a>
            {t(' — 算法和早期 UI 出处。', ' — algorithm and original UI inspiration.', " — 演算法和早期 UI 出處。")}
          </li>
        </ul>
      </main>
    </div>
  );
}
