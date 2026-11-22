'use client';

import { ArrowRight, Box, GitBranch, ListChecks, ScanLine } from '@app-foundation/icons/lucide';
import MoreToggle from '@/components/MoreToggle';
import PageHeading from '@/components/PageHeading';
import { VisualCube } from '@/components/VisualCube';
import { useT } from '@/hooks/useT';
import { T } from '@/i18n/tr';
import '@/components/report-page.css';
import './video-recon-guide.css';

export default function VideoReconGuide({ upstream }: { upstream?: { name: string; url: string } }) {
  const t = useT();
  const steps = [
    { Icon: ScanLine, title: t('关键点检测', 'Keypoint detection'), method: 'YOLO Pose',
      output: t('定位角点、接缝交点和色块中心，识别可见颜色。', 'Find corners, seam junctions, sticker centers, and visible colors.') },
    { Icon: Box, title: t('三维姿态拟合', '3D pose fitting'), method: 'PnP',
      output: t('用像素关键点拟合魔方相对镜头的姿态和各层转角。', 'Fit the cube’s pose and layer angles from 2D keypoints.') },
    { Icon: GitBranch, title: t('动作搜索', 'Move search'), method: t('正向与逆向搜索', 'Forward and reverse search'),
      output: t('用贴纸颜色和帧间转角筛选步序。打乱留空时，从清晰的还原末态找回动作。', 'Use sticker colors and motion to rank moves. With no scramble, trace the moves backward from a clear solved state.') },
    { Icon: ListChecks, title: t('转体换算与分段', 'Notation and stages'), method: 'x / y / z',
      output: t('按选手朝向改写记号，标出十字、F2L 等阶段与末层案例。', 'Remap moves to the solver’s grip and identify stages and last-layer cases.') },
  ];
  return <main className="report-page">
    <header className="report-header">
      <PageHeading backHref="/frame-count?mode=detector">{t('视频复盘说明', 'Video Reconstruction Guide')}</PageHeading>
      <p>{t('导入三阶视频，或用「边拍边复盘」直接录制。区间要包含第一步前的清晰画面。打乱留空时，结尾也需要拍清已还原的魔方。',
        'Import a 3×3 video or record one in Live reconstruction. Include a clear view before the first move. If you leave the scramble blank, also show the solved cube at the end.')}</p>
    </header>

    <h2 id="video-recon-flow-heading">{t('从画面到复盘', 'From footage to notation')}</h2>
    <ol className="video-recon-guide-flow" role="list" aria-labelledby="video-recon-flow-heading">
      {steps.map(({ Icon, title, method, output }, index) => <li key={index}>
        <Icon className="video-recon-guide-flow-icon" size={22} aria-hidden />
        <div>
          <strong>{title}</strong>
          <span className="video-recon-guide-method">{method}</span>
          <p>{output}</p>
        </div>
        {index < steps.length - 1 && <ArrowRight className="video-recon-guide-flow-arrow" size={18} aria-hidden />}
      </li>)}
    </ol>

    <h3>{t('整方转体如何改变记号', 'How a regrip changes notation')}</h3>
    <figure className="video-recon-guide-example">
      <div className="video-recon-guide-views">
        <div className="video-recon-guide-view">
          <span>{t('转体前', 'Before')}</span>
          <div className="video-recon-guide-cube">
            <VisualCube local view="plan" scheme="wrgyob" setup="" size={96}
              alt={t('转体前的俯视图，红色面在右侧。', 'Top view before the regrip. The red face is on the right.')} />
            <code>R</code>
          </div>
        </div>
        <div className="video-recon-guide-rotate">
          <code>y2</code>
          <ArrowRight size={22} aria-hidden />
        </div>
        <div className="video-recon-guide-view">
          <span>{t('转体后', 'After')}</span>
          <div className="video-recon-guide-cube">
            <code>L</code>
            <VisualCube local view="plan" scheme="wrgyob" setup="y2" size={96}
              alt={t('转体后的俯视图，红色面在左侧。', 'Top view after the regrip. The red face is on the left.')} />
          </div>
        </div>
      </div>
      <figcaption className="report-note"><T
        zh={<>整方绕竖直轴转 180°，顶面保持不变。转同一个红色层，记号从 <code>R</code> 变为 <code>L</code>。</>}
        en={<>A 180° rotation around the vertical axis keeps the top face up. A turn of the same red layer changes from <code>R</code> to <code>L</code>.</>} />
      </figcaption>
    </figure>

    <h2>{t('结果如何核对', 'How to check the result')}</h2>
    <p><T zh={<>系统会重放输出的公式，在每个分段边界核对完整局面，检查记号换算是否与搜索结果一致。如果手遮住 <code>R R′</code> 的全过程，前后局面完全相同，视频就可能漏掉这两步。点击谱里的动作，可跳回相应画面核对。</>}
      en={<>The app replays the notation to check each stage boundary against the inferred cube state. If a hand hides <code>R R′</code>, both moves may be missed because the before and after states match. Select a move to inspect its frame.</>} /></p>
    <p>{t('动作时间对应搜索判定局面切换的帧。识别以约 30 fps 为采样目标，30 fps 的相邻帧约隔 33 毫秒，遮挡或模糊还会增加误差。单张图片只能提供检测结果。',
      'Move timestamps come from the frames where the search assigns state changes. Recognition targets about 30 fps, roughly 33 ms between frames, and occlusion or blur can increase error. A single photo provides detection only.')}</p>

    <details className="report-details">
      <MoreToggle as="summary">{t('技术栈与本地处理', 'Technology stack and local processing')}</MoreToggle>
      <div className="report-detail-body">
        <p>{t('检测框先圈出魔方，再把框内的像素关键点与三维模型配对。PnP 求出姿态后，把三维点投回画面，用重投影误差评估拟合。末尾画面支持还原态时，动作搜索也会从终点反推。',
          'The detector first crops to the cube. Perspective-n-Point matches image keypoints to the 3D model, and reprojection error scores how closely the projected points match. Move search also works backward when the ending frames support a solved state.')}</p>
        <p>{t('确认起手的顶面和前面后，后续转体更新层转记号。系统按动作逐步还原局面，找出阶段边界，并识别 OLL、PLL 等案例。',
          'After you confirm the starting top and front faces, later whole-cube rotations update the notation. Replaying the states locates stage boundaries and identifies cases such as OLL and PLL.')}</p>
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
