'use client';

import Link from '@/components/AppLink';
import MoreToggle from '@/components/MoreToggle';
import PageHeading from '@/components/PageHeading';
import { useT } from '@/hooks/useT';
import '@/components/report-page.css';

export default function FrameCountAboutPage() {
  const t = useT();
  return <main className="report-page">
    <header className="report-header">
      <PageHeading backHref="/frame-count">{t('逐帧计时', 'Frame-by-frame timing')}</PageHeading>
      <p>{t('在视频中标出起点、终点和中间阶段，检查一次还原的时间分配。', 'Mark the start, finish and intermediate stages of a solve to inspect its timing.')}</p>
      <div className="report-links"><Link href="/frame-count">{t('打开逐帧工具', 'Open frame counter')}</Link><Link href="/recon">{t('复盘库', 'Reconstructions')}</Link></div>
    </header>
    <ol className="report-steps">
      <li><strong>{t('载入视频，确认帧率。', 'Load a video and check its frame rate. ')}</strong>{t('用逐帧前进、后退定位动作发生的位置。', 'Step forward and backward to locate the action.')}</li>
      <li><strong>{t('标记起止和阶段。', 'Mark the start, finish and stages. ')}</strong>{t('已有计时器成绩时，可以从结束帧反推起点，再检查画面是否吻合。', 'If you have a timer result, work backward from the finish frame and check the suggested start against the footage.')}</li>
      <li><strong>{t('保存标记或导出画面。', 'Save marks or export footage. ')}</strong>{t('标记保存在 .splits.txt；也可导出视频片段或当前帧图片。', 'Marks are saved as .splits.txt. You can also export a video segment or the current frame.')}</li>
    </ol>
    <h2>{t('一帧有多长？', 'How long is one frame?')}</h2>
    <table className="report-table">
      <thead><tr><th scope="col">{t('固定帧率', 'Constant frame rate')}</th><th scope="col">{t('相邻帧间隔', 'Time between frames')}</th></tr></thead>
      <tbody><tr><th scope="row">30 fps</th><td>{t('约 33.3 毫秒', 'About 33.3 ms')}</td></tr><tr><th scope="row">60 fps</th><td>{t('约 16.7 毫秒', 'About 16.7 ms')}</td></tr></tbody>
    </table>
    <p>{t('例如固定 60 fps 的视频，两个标记相差 600 帧，对应 10 秒。帧间隔只代表视频的时间分辨率，不是测量准确度。', 'In a constant 60 fps video, marks 600 frames apart span 10 seconds. Frame spacing is the video’s time resolution, not a guarantee of measurement accuracy.')}</p>
    <h2>{t('哪些地方需要人工判断', 'What needs judgment')}</h2>
    <p>{t('起止动作的选取、掉帧、可变帧率和转码都会影响结果。反推起点依赖你输入的成绩，不能再用它独立证明该成绩准确；视频分析也不自动改变正式比赛成绩。', 'The chosen start and finish, dropped frames, variable frame rate and transcoding can affect results. A start inferred from a supplied time cannot independently verify that time. Video analysis does not itself amend an official result.')}</p>
    <details className="report-details">
      <MoreToggle as="summary">{t('快捷键、保存与计时方式', 'Shortcuts, saving and timing methods')}</MoreToggle>
      <div className="report-detail-body">
        <p>{t('K 播放或暂停；逗号 / 句号逐帧后退或前进；M 添加标记。完整键位表在工具内。', 'K plays or pauses; comma / period step backward or forward; M adds a mark. The tool lists all shortcuts.')}</p>
        <p>{t('起点反推支持帧率法与帧时间戳法；时间戳法需要可用的逐帧数据。帧率法包含对计时器百分位截断的处理，因此不等同于简单的秒数乘帧率。', 'Start estimation supports frame-rate and frame-timestamp methods; the latter needs per-frame data. The frame-rate method accounts for centisecond truncation, so it is not just time multiplied by frame rate.')}</p>
        <p>{t('视频处理在本地进行。保存标记需允许访问视频所在文件夹，并确认工具显示保存成功。解码与导出能力取决于浏览器、编码格式和设备。', 'Video processing is local. Saving marks requires access to the video folder; check that the tool reports a successful save. Decoding and export depend on the browser, codec and device.')}</p>
      </div>
    </details>
  </main>;
}
