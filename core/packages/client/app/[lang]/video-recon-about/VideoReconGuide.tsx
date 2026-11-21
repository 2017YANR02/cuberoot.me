'use client';

import MoreToggle from '@/components/MoreToggle';
import PageHeading from '@/components/PageHeading';
import { useT } from '@/hooks/useT';
import { T } from '@/i18n/tr';
import '@/components/report-page.css';

export default function VideoReconGuide({ upstream }: { upstream?: { name: string; url: string } }) {
  const t = useT();
  return <main className="report-page">
    <header className="report-header">
      <PageHeading backHref="/video-recon">{t('视频复盘说明', 'Video Reconstruction Guide')}</PageHeading>
      <p>{t('输入固定机位的三阶还原视频和原始打乱，得到带时间戳的转动记录。视频开头要留出第一步前的清晰画面。',
        'Start with a fixed-camera 3×3 solve video and its exact scramble. Include a clear view before the first turn to help recover a timestamped move sequence.')}</p>
    </header>

    <h2>{t('从画面到复盘', 'From footage to notation')}</h2>
    <ol className="report-steps">
      <li><strong>{t('关键点检测（YOLO Pose）。', 'Keypoint detection (YOLO Pose). ')}</strong>{t('检测框先圈出魔方，姿态模型再在框内定位角点、接缝交点和色块中心，并识别可见色块的颜色。',
        'A bounding-box detector locates the cube. Inside the crop, a pose model finds corners, seam junctions, sticker centers, and visible sticker colors.')}</li>
      <li><strong>{t('三维姿态拟合（PnP）。', '3D pose fitting (PnP). ')}</strong>{t('把三维魔方上的已知点与画面上的像素点配对，求出魔方相对镜头的位置和旋转。再把三维点投回画面，用像素偏差衡量拟合质量，并估计各层的转角。',
        'Perspective-n-Point matches known 3D cube points to image pixels to estimate position and rotation relative to the camera. Reprojection error measures the pixel discrepancy, and the fitter estimates layer angles.')}</li>
      <li><strong>{t('双向动作搜索。', 'Bidirectional move search. ')}</strong>{t('从打乱后的局面正向试转。如果末尾画面支持还原态，也从终点反向搜索。候选路径按可见色块是否对得上、转角是否符合前后帧来排序。',
        'Search forward from the scrambled state and, if the last frames support a solved state, backward from solved. Candidate paths are ranked by sticker-color agreement and motion between frames.')}</li>
      <li><strong>{t('转体换算与分段。', 'Regrips and solve stages. ')}</strong>{t('确认起手的顶面和前面后，后续层转按检测到的整方转体更新记号。系统逐步执行这些动作，找出十字、F2L 等阶段的完成点，再根据相应局面识别 OLL、PLL 等案例。',
        'Confirm the starting top and front faces. Detected whole-cube rotations then change how subsequent turns are written. Replaying the moves identifies stage boundaries such as cross and F2L, and recognizes cases such as OLL and PLL from the resulting states.')}</li>
    </ol>
    <p><T zh={<><strong>例子</strong>　同一层在原朝向记作 <code>R</code>。整方做 <code>y2</code> 后，右面和左面对调，再转同一层就记作 <code>L</code>。</>}
      en={<><strong>Example</strong> A turn of one layer is written <code>R</code>. After a <code>y2</code> regrip, right and left swap, so a turn of that same layer is written <code>L</code>.</>} /></p>

    <h2>{t('结果如何核对', 'How to check the result')}</h2>
    <p><T zh={<>系统会重放输出的公式，在每个分段边界核对完整局面，检查记号换算是否与搜索结果一致。如果手遮住 <code>R R′</code> 的全过程，前后局面完全相同，视频就可能漏掉这两步。点击谱里的动作，可跳回相应画面核对。</>}
      en={<>The app replays the written notation and compares the full cube state with the search result at each stage boundary. If a hand hides an entire <code>R R′</code> sequence, the before and after states match and both moves may be missed. Select a move to jump to its frame.</>} /></p>
    <p>{t('动作时间对应搜索判定局面切换的帧。识别以约 30 fps 为采样目标，30 fps 的相邻帧约隔 33 毫秒，遮挡或模糊还会增加误差。单张图片只能提供检测结果。',
      'Move timestamps come from the frames where the search assigns state changes. Recognition targets about 30 fps, roughly 33 ms between frames, and occlusion or blur can increase error. A single photo provides detection only.')}</p>

    <details className="report-details">
      <MoreToggle as="summary">{t('技术栈与本地处理', 'Technology stack and local processing')}</MoreToggle>
      <div className="report-detail-body">
        <p>{t('Mediabunny 读取视频帧，ONNX Runtime Web 通过 WebGPU 运行模型。Rust/WASM 执行姿态拟合和动作搜索，OpenCV 用于 PnP 求解。界面使用 React，实况魔方可选 Three.js 或 cubing.js。',
          'Mediabunny reads video frames. ONNX Runtime Web runs the models on WebGPU. Rust/WASM handles pose fitting and move search, using OpenCV to solve PnP. React powers the UI, with Three.js or cubing.js for the tracked cube.')}</p>
        <p>{t('首次使用需联网下载模型，浏览器和设备须支持 WebGPU。视频和图片只在浏览器本地处理。',
          'First use requires an internet connection to download the models and a browser and device that support WebGPU. Media is processed locally in the browser.')}</p>
      </div>
    </details>
    {upstream && <p className="report-note"><T
      zh={<>感谢 <a href={upstream.url}>{upstream.name}</a> 提供识别模型、三维姿态拟合和动作搜索内核。</>}
      en={<>Thanks to <a href={upstream.url}>{upstream.name}</a> for the detection models, 3D pose fitter, and move-search engine.</>} /></p>}
  </main>;
}
