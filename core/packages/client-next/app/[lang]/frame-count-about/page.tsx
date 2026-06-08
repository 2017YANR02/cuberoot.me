'use client';

/**
 * /frame-count-about — 数帧工具说明页
 */
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './frame_count_about.css';
import i18n from "@/i18n/i18n-client";

interface StepProps { step: number; title: string; body: string; highlight?: boolean; }
function Step({ step, title, body, highlight }: StepProps) {
  return (
    <div className={`fca-step${highlight ? ' is-highlight' : ''}`}>
      <span className="fca-step-num">{step}</span>
      <div>
        <div className="fca-step-title">{title}</div>
        <div className="fca-step-body">{body}</div>
      </div>
    </div>
  );
}
function Arrow() { return <span className="fca-arrow" aria-hidden="true">↓</span>; }

export default function FrameCountAboutPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  useDocumentTitle('数帧工具说明', 'Frame Count Guide', "數幀工具說明");

  return (
    <div className="fca-page">
      <div className="fca-header">
        <Link href="/frame-count" className="fca-back">
          <ArrowLeft size={16} />
          <span>{t('返回数帧', 'Back to Frame Count', "返回數幀")}</span>
        </Link>
      </div>

      <main className="fca-main">
        <h1 className="fca-title">{t('数帧是怎么用的', 'How frame-counting works', "數幀是怎麼用的")}</h1>
        <p className="fca-intro">
          {t(
            '/frame-count 是给比赛视频 / 自己录像逐帧打点的工具。导入 mp4 / mov 后,在时间轴上标出每个 solve 的开始帧 / 结束帧,自动算成绩并跟计时器对比 — 适合裁判申诉、对比手速、复盘多手 solve 录像。',
            '/frame-count is a frame-precise marker tool for competition footage or your own recordings. Load an mp4 / mov, mark the start and end frame of each solve on the timeline, and it auto-computes timings to compare against the official clock — useful for judge appeals, hand-speed analysis, and reviewing multi-solve recordings.', "/frame-count 是給比賽影片 / 自己錄影逐幀打點的工具。匯入 mp4 / mov 後,在時間軸上標出每個 solve 的開始幀 / 結束幀,自動算成績並跟計時器對比 — 適合裁判申訴、對比手速、覆盤多手 solve 錄影。"
          )}
        </p>

        <h2 className="fca-section-title">{t('核心原理', 'Core idea')}</h2>
        <p className="fca-section-intro">
          {t(
            '解码走 WebCodecs(浏览器原生硬件解码,几乎零开销);某些 mp4 元数据走 mediainfo.js 提取真实 frame rate;转码兜底走 ffmpeg.wasm。所有处理在本地,不上传视频。',
            'Decoding uses WebCodecs (native hardware decode, near-zero overhead). True frame rate is extracted via mediainfo.js for some mp4 containers; ffmpeg.wasm provides transcoding fallback for unsupported codecs. All processing is local — your video never uploads.', "解碼走 WebCodecs(瀏覽器原生硬體解碼,幾乎零開銷);某些 mp4 後設資料走 mediainfo.js 提取真實 frame rate;轉碼兜底走 ffmpeg.wasm。所有處理在本地,不上傳影片。"
          )}
        </p>

        <h2 className="fca-section-title">{t('使用流程', 'How to use')}</h2>
        <div className="fca-flow">
          <Step
            step={1}
            title={t('载入视频', 'Load a video', "載入影片")}
            body={t(
              '拖到页面任意位置 / 点工具栏「打开视频」 / 在 OBS 录像目录里整文件夹挑(支持 mp4 / mov / webm)。载入后右上角显示真实 frame rate。',
              'Drag onto the page, click the toolbar "Open video", or pick from an OBS recording folder (mp4 / mov / webm). After loading, the real frame rate appears in the top-right.', "拖到頁面任意位置 / 點工具欄「開啟影片」 / 在 OBS 錄影目錄裡整資料夾挑(支援 mp4 / mov / webm)。載入後右上角顯示真實 frame rate。"
            )}
          />
          <Arrow />
          <Step
            step={2}
            title={t('打点', 'Mark frames', "打點")}
            body={t(
              '空格暂停 / 播放;`,` `.` 上一帧 / 下一帧;`M` 在当前帧打 mark。一个 solve 需要两个 mark(开始 + 结束),会用颜色带把它们连成一个 solve。',
              'Space toggles play/pause; `,` and `.` step back/forward one frame; `M` drops a mark at the current frame. A solve needs two marks (start + end), and they\'re visually linked with a colored band.', "空格暫停 / 播放;`,` `.` 上一幀 / 下一幀;`M` 在當前幀打 mark。一個 solve 需要兩個 mark(開始 + 結束),會用顏色帶把它們連成一個 solve。"
            )}
          />
          <Arrow />
          <Step
            step={3}
            title={t('精修与裁剪', 'Refine and crop', "精修與裁剪")}
            body={t(
              '点 mark 后用方向键微调到准确帧;时间轴长按拖拽快速 scrub。需要的话用裁剪模式(C 键)只看竞赛区域,排除背景干扰。',
              'After selecting a mark, fine-tune to the exact frame with arrow keys; long-press the timeline to scrub fast. Crop mode (C) restricts the visible area to just the cube zone, hiding distractions.', "點 mark 後用方向鍵微調到準確幀;時間軸長按拖拽快速 scrub。需要的話用裁剪模式(C 鍵)只看競賽區域,排除背景干擾。"
            )}
          />
          <Arrow />
          <Step
            step={4}
            title={t('导出', 'Export', "匯出")}
            body={t(
              '导出 CSV(每行一个 solve:start 帧 / end 帧 / 持续帧 / 秒数)。同时支持复制一段「逐 solve 时间表」到剪贴板,方便贴到申诉邮件 / 对比电脑成绩。',
              'Export to CSV (one row per solve: start frame, end frame, frame count, seconds). You can also copy a "per-solve timing list" to clipboard — handy for appeal emails or side-by-side comparisons with timer logs.', "匯出 CSV(每行一個 solve:start 幀 / end 幀 / 持續幀 / 秒數)。同時支援複製一段「逐 solve 時間表」到剪貼簿,方便貼到申訴郵件 / 對比電腦成績。"
            )}
            highlight
          />
        </div>

        <h2 className="fca-section-title">{t('快捷键', 'Shortcuts', "快捷鍵")}</h2>
        <p className="fca-section-intro">
          {t(
            '工具栏右上「键盘」按钮列出完整快捷键表(含播放控制、打点、定位、缩放)。键位在桌面 / 移动端均可用,移动端额外有长按时间轴拖动。',
            'The toolbar\'s keyboard button lists the full shortcut table (playback, marking, jumping, zoom). Shortcuts work on desktop and mobile; mobile additionally supports long-press timeline drag.', "工具欄右上「鍵盤」按鈕列出完整快捷鍵表(含播放控制、打點、定位、縮放)。鍵位在桌面 / 移動端均可用,移動端額外有長按時間軸拖動。"
          )}
        </p>

        <h2 className="fca-section-title">{t('相关页面', 'See also', "相關頁面")}</h2>
        <ul className="fca-refs">
          <li>
            <Link href="/recon">{t('复盘库', 'Recon Library', "覆盤庫")}</Link>
            {t(' — 数完帧拿到精确成绩后,可以来这里上传对应的还原步骤。', ' — once you have a precise timing, upload the corresponding solve breakdown here.', " — 數完幀拿到精確成績後,可以來這裡上傳對應的還原步驟。")}
          </li>
          <li>
            <a href="https://www.worldcubeassociation.org/regulations/" target="_blank" rel="noopener noreferrer">{t('WCA 规则', 'WCA regulations', "WCA 規則")}</a>
            {t(' — 申诉相关的章节 (Article 9 / 12)。', ' — appeal-relevant sections (Articles 9 and 12).', " — 申訴相關的章節 (Article 9 / 12)。")}
          </li>
        </ul>
      </main>
    </div>
  );
}
