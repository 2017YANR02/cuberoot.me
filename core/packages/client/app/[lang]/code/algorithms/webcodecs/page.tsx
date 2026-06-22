'use client';

import { useState } from 'react';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../../_lib/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './webcodecs.css';
import { tr } from '@/i18n/tr';

const ACCENT = '#22D3EE';

interface PipeNode { sym: string; name: { zh: string; en: string }; detail: { zh: string; en: string } }

// 解码流水线: 文件 → demux → 编码块 → 解码器 → 帧 → 位图 → 画布
const DECODE: PipeNode[] = [
  { sym: '⬚', name: { zh: '文件 / Blob', en: 'File / Blob' }, detail: { zh: '.mp4 / .mov, 流式分块读', en: '.mp4 / .mov, streamed in chunks' } },
  { sym: '▤', name: { zh: 'mp4box 解复用', en: 'mp4box demux' }, detail: { zh: 'createFile() + appendBuffer', en: 'createFile() + appendBuffer' } },
  { sym: '▦', name: { zh: 'EncodedVideoChunk', en: 'EncodedVideoChunk' }, detail: { zh: 'key / delta, μs 时间戳', en: 'key / delta, μs timestamp' } },
  { sym: '◫', name: { zh: 'VideoDecoder', en: 'VideoDecoder' }, detail: { zh: 'configure() → decode()', en: 'configure() → decode()' } },
  { sym: '▣', name: { zh: 'VideoFrame', en: 'VideoFrame' }, detail: { zh: 'GPU 纹理, 用完即 close()', en: 'GPU texture, close() when done' } },
  { sym: '◰', name: { zh: 'ImageBitmap', en: 'ImageBitmap' }, detail: { zh: 'LRU 缓存 360 帧', en: 'LRU cache, 360 frames' } },
  { sym: '◳', name: { zh: '画布 / 数帧', en: 'Canvas / step' }, detail: { zh: '逐帧渲染, 无需 seek', en: 'per-frame render, no seek' } },
];

// 编码流水线: 画布 → 帧 → 编码器 → 编码块 → 封装 → mp4
const ENCODE: PipeNode[] = [
  { sym: '◳', name: { zh: '画布 / 场景', en: 'Canvas / scene' }, detail: { zh: '每帧确定性重绘', en: 'deterministic redraw per frame' } },
  { sym: '▣', name: { zh: 'VideoFrame', en: 'VideoFrame' }, detail: { zh: 'timestamp = f × frameDur', en: 'timestamp = f × frameDur' } },
  { sym: '◫', name: { zh: 'VideoEncoder', en: 'VideoEncoder' }, detail: { zh: 'avc1.640033 (H.264)', en: 'avc1.640033 (H.264)' } },
  { sym: '▦', name: { zh: 'EncodedVideoChunk', en: 'EncodedVideoChunk' }, detail: { zh: 'keyFrame 每 2 秒一个', en: 'keyFrame every 2 s' } },
  { sym: '⬓', name: { zh: 'mp4-muxer', en: 'mp4-muxer' }, detail: { zh: 'fastStart 内存封装', en: 'fastStart in-memory mux' } },
  { sym: '⬚', name: { zh: '.mp4 Blob', en: '.mp4 Blob' }, detail: { zh: '可下载 / 分享', en: 'downloadable / shareable' } },
];

// GOP 片段: 用于演示「解一个 P/B 帧必须从前面最近的 I 帧重放」
const STRIP: Array<'I' | 'P' | 'B'> = ['I', 'B', 'B', 'P', 'B', 'B', 'P', 'B', 'P', 'I', 'B', 'P', 'B', 'B', 'P', 'P'];

function Pipe({ nodes, lang }: { nodes: PipeNode[]; lang: Lang }) {
  return (
    <div className="wc-pipe">
      {nodes.map((n, i) => (
        <div className="wc-pipe-step" key={n.name.en}>
          <div className="wc-pipe-node">
            <span className="wc-pipe-sym" aria-hidden>{n.sym}</span>
            <span className="wc-pipe-name">{n.name[lang]}</span>
            <span className="wc-pipe-detail">{n.detail[lang]}</span>
          </div>
          {i < nodes.length - 1 && <span className="wc-pipe-arrow" aria-hidden>→</span>}
        </div>
      ))}
    </div>
  );
}

export default function WebCodecsPage() {
  const { i18n } = useTranslation();
  const zhPref = i18n.language.startsWith('zh');
  const lang: Lang = zhPref ? 'zh' : 'en';

  useDocumentTitle('WebCodecs 帧精确解码', 'WebCodecs frame-accurate decoding');

  // 选中一帧 → 高亮它依赖的解码区间 (回溯到最近的 I 帧)
  const [sel, setSel] = useState(11);
  let depStart = sel;
  while (depStart > 0 && STRIP[depStart] !== 'I') depStart--;
  const depCount = sel - depStart + 1;

  return (
    <LangCtx.Provider value={lang}>
      <div className="wc-page" style={{ ['--accent' as string]: ACCENT }}>
        <div className="wc-bg" />
        <div className="wc-scanlines" aria-hidden />
        <div className="wc-inner">
          <div className="wc-topbar">
            <Link href="/code/algorithms" className="wc-back">← /code/algorithms</Link>
          </div>

          {/* ── HERO ── */}
          <header className="wc-hero">
            <div className="wc-jargon" aria-hidden>
              <span>VideoDecoder</span><span>EncodedVideoChunk</span><span>VideoFrame</span>
              <span>mp4box.js</span><span>avc1.640033</span><span>I / P / B</span>
            </div>
            <div className="wc-tag">{tr({ zh: '浏览器原生编解码', en: 'Browser-native codecs' })}</div>
            <h1 className="wc-title">WebCodecs</h1>
            <p className="wc-sub">
              <L
                zh={<>浏览器把 H.264 / HEVC 的<strong>硬件编解码器</strong>直接开放给 JavaScript。CubeRoot 用它做两件 <code>&lt;video&gt;</code> 标签做不到的事:把一段比赛录像<strong>逐帧、精确到微秒</strong>地拆开来数帧判罚,以及把魔方动画<strong>确定性地</strong>编码成稳定 60fps 的视频。</>}
                en={<>The browser exposes its <strong>hardware H.264 / HEVC codecs</strong> straight to JavaScript. CubeRoot uses it for two things a plain <code>&lt;video&gt;</code> tag cannot do: pull a solve recording apart <strong>frame by frame, accurate to the microsecond</strong> for judging, and encode cube animations into a rock-steady <strong>deterministic</strong> 60fps clip.</>}
              />
            </p>
            <div className="wc-stats">
              <div className="wc-stat"><span className="wc-stat-n">94+</span><span className="wc-stat-l"><L zh="Chrome / Edge 起步版本" en="Chrome / Edge baseline" /></span></div>
              <div className="wc-stat"><span className="wc-stat-n">μs</span><span className="wc-stat-l"><L zh="每帧时间戳精度" en="per-frame timestamp" /></span></div>
              <div className="wc-stat"><span className="wc-stat-n">60<span className="wc-stat-u">fps</span></span><span className="wc-stat-l"><L zh="确定性导出帧率" en="deterministic export" /></span></div>
              <div className="wc-stat"><span className="wc-stat-n">4</span><span className="wc-stat-l"><L zh="站内使用场景" en="in-site call sites" /></span></div>
            </div>
          </header>

          {/* ── 1 四个核心对象 ── */}
          <section className="wc-section">
            <div className="wc-sec-head"><span className="wc-sec-num">01</span><h2><L zh="四个核心对象" en="The four core objects" /></h2></div>
            <div className="wc-concept-grid">
              <div className="wc-concept">
                <div className="wc-concept-name">EncodedVideoChunk</div>
                <p><L zh={<>一段<strong>压缩</strong>的视频数据。带 <code>type</code>(关键帧 <code>key</code> 还是依赖帧 <code>delta</code>)和微秒级 <code>timestamp</code>。解复用器吐出来、编码器产出去的都是它。</>} en={<>One <strong>compressed</strong> packet. Carries a <code>type</code> (<code>key</code> for I-frames, <code>delta</code> for the rest) and a μs <code>timestamp</code>. Both what the demuxer emits and what the encoder produces.</>} /></p>
              </div>
              <div className="wc-concept">
                <div className="wc-concept-name">VideoDecoder</div>
                <p><L zh={<>喂进 chunk,异步在 <code>output</code> 回调里吐出解好的帧。先 <code>configure()</code> 告诉它 codec 和 SPS/PPS,再连续 <code>decode()</code>。</>} en={<>Feed it chunks; it hands back decoded frames asynchronously via an <code>output</code> callback. <code>configure()</code> with the codec + SPS/PPS first, then stream <code>decode()</code> calls.</>} /></p>
              </div>
              <div className="wc-concept">
                <div className="wc-concept-name">VideoFrame</div>
                <p><L zh={<>一帧<strong>未压缩</strong>的画面,通常是张 GPU 纹理。能直接 <code>drawImage</code> 到 canvas 或转 <code>ImageBitmap</code>。必须手动 <code>close()</code>,否则显存秒爆。</>} en={<>One <strong>uncompressed</strong> frame, usually a GPU texture. <code>drawImage</code> it onto a canvas or turn it into an <code>ImageBitmap</code>. Must be <code>close()</code>d by hand or GPU memory blows up instantly.</>} /></p>
              </div>
              <div className="wc-concept">
                <div className="wc-concept-name">VideoEncoder</div>
                <p><L zh={<>反方向:喂进 <code>VideoFrame</code>,在 <code>output</code> 里收到压缩好的 chunk。CubeRoot 固定输出 <code>avc1.640033</code>(H.264 High@5.1),兼容性最广。</>} en={<>The reverse: feed it <code>VideoFrame</code>s, receive compressed chunks in <code>output</code>. CubeRoot always emits <code>avc1.640033</code> (H.264 High@5.1) for the widest reach.</>} /></p>
              </div>
            </div>
          </section>

          {/* ── 2 解码流水线 ── */}
          <section className="wc-section">
            <div className="wc-sec-head"><span className="wc-sec-num">02</span><h2><L zh="解码流水线" en="The decode pipeline" /></h2></div>
            <p className="wc-lead">
              <L zh={<>WebCodecs 只管<strong>解码</strong>,不碰容器。一个 <code>.mp4</code> 文件得先<strong>解复用 (demux)</strong> 才能拿到一个个编码块 —— 这一步交给 <code>mp4box.js</code>。CubeRoot 的数帧工具走的就是下面这条链:</>} en={<>WebCodecs only does <strong>decoding</strong> — it never touches containers. A <code>.mp4</code> must be <strong>demuxed</strong> first to expose individual chunks, and that job goes to <code>mp4box.js</code>. CubeRoot's frame-counter runs exactly this chain:</>} />
            </p>
            <Pipe nodes={DECODE} lang={lang} />
            <pre className="wc-code"><code>{`const HAS_WEBCODECS = typeof VideoDecoder !== 'undefined'; // Chrome / Edge 94+

mp4File.onReady = (info) => {
  const v = info.videoTracks[0];
  decoder.configure({
    codec: v.codec,           // "avc1.640033" / "hvc1.1.6.L150" ...
    codedWidth: v.video.width,
    codedHeight: v.video.height,
    description,              // SPS/PPS, 从 avcC / hvcC box 抠出来
  });
};`}</code></pre>
            <p className="wc-cap"><L zh={<><code>description</code> 是 codec 的「使用说明书」(序列参数集 SPS / 图像参数集 PPS),藏在 mp4 的 <code>avcC</code> / <code>hvcC</code> box 里,不给解码器它就无从下手。</>} en={<><code>description</code> is the codec's "instruction sheet" (the SPS / PPS parameter sets), buried in the mp4's <code>avcC</code> / <code>hvcC</code> box. Without it the decoder has nothing to work from.</>} /></p>
          </section>

          {/* ── 3 I/P/B + 解码顺序 (互动) ── */}
          <section className="wc-section">
            <div className="wc-sec-head"><span className="wc-sec-num">03</span><h2><L zh="为什么不能随便从中间解一帧" en="Why you can't decode any frame in isolation" /></h2></div>
            <p className="wc-lead">
              <L zh={<>视频帧分三种:<strong>I 帧</strong>(关键帧,自包含)、<strong>P 帧</strong>(参照前面)、<strong>B 帧</strong>(参照前后两边)。想要第 <em>n</em> 帧,解码器必须从它前面<strong>最近的一个 I 帧</strong>开始,把中间的依赖链全部重放一遍。点下面任意一帧看它的解码区间:</>} en={<>Frames come in three flavours: <strong>I-frames</strong> (self-contained keyframes), <strong>P-frames</strong> (reference the past), <strong>B-frames</strong> (reference both directions). To get frame <em>n</em>, the decoder must start at the <strong>nearest preceding I-frame</strong> and replay the whole dependency chain. Tap any frame to see its decode span:</>} />
            </p>
            <div className="wc-strip" role="group" aria-label="GOP">
              {STRIP.map((t, i) => {
                const inSpan = i >= depStart && i <= sel;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`wc-frame wc-frame-${t.toLowerCase()}${i === sel ? ' is-sel' : ''}${inSpan ? ' is-span' : ''}`}
                    onClick={() => setSel(i)}
                    aria-pressed={i === sel}
                  >
                    <span className="wc-frame-type">{t}</span>
                    <span className="wc-frame-idx">{i}</span>
                  </button>
                );
              })}
            </div>
            <p className="wc-strip-readout">
              <L
                zh={<>要显示第 <strong>{sel}</strong> 帧({STRIP[sel]} 帧),解码器得从第 <strong>{depStart}</strong> 帧(I 帧)起重放,共 <strong>{depCount}</strong> 个编码块 —— 这正是 <code>useFrameBuffer</code> 里 <code>while (!samples[i].isSync) i--</code> 干的活。</>}
                en={<>To show frame <strong>{sel}</strong> (a {STRIP[sel]}-frame), the decoder replays from frame <strong>{depStart}</strong> (an I-frame): <strong>{depCount}</strong> chunks total — exactly what <code>while (!samples[i].isSync) i--</code> does inside <code>useFrameBuffer</code>.</>}
              />
            </p>
            <div className="wc-order">
              <div className="wc-order-row">
                <span className="wc-order-label"><L zh="显示顺序 (CTS)" en="Presentation (CTS)" /></span>
                <span className="wc-order-seq">I&nbsp; B&nbsp; B&nbsp; P&nbsp; B&nbsp; B&nbsp; P</span>
              </div>
              <div className="wc-order-row">
                <span className="wc-order-label"><L zh="解码顺序 (DTS)" en="Decode (DTS)" /></span>
                <span className="wc-order-seq">I&nbsp; P&nbsp; B&nbsp; B&nbsp; P&nbsp; B&nbsp; B</span>
              </div>
            </div>
            <p className="wc-cap"><L zh={<>有 B 帧时,<strong>解码顺序和显示顺序不一样</strong>。mp4box 按解码顺序(DTS)交付样本,而用户要的是显示顺序(CTS)。所以代码里建了一张<strong>双向映射表</strong>,把两套坐标对上,否则倒放数帧就会错位。</>} en={<>With B-frames present, <strong>decode order ≠ display order</strong>. mp4box delivers samples in decode order (DTS); the user wants display order (CTS). The code builds a <strong>two-way mapping</strong> between the two coordinate systems — without it, stepping backwards lands on the wrong frame.</>} /></p>
          </section>

          {/* ── 4 帧精确: seek vs WebCodecs ── */}
          <section className="wc-section">
            <div className="wc-sec-head"><span className="wc-sec-num">04</span><h2><L zh="帧精确:为什么不用 video.currentTime" en="Frame accuracy: why not video.currentTime" /></h2></div>
            <div className="wc-compare">
              <div className="wc-compare-col wc-bad">
                <div className="wc-compare-h"><L zh="HTMLVideoElement.currentTime" en="HTMLVideoElement.currentTime" /></div>
                <ul>
                  <li><L zh="seek 落点由浏览器决定, 常对齐到最近的关键帧" en="seek lands wherever the browser decides — often snapped to the nearest keyframe" /></li>
                  <li><L zh="高帧率视频下 play+pause 取帧不精确" en="play+pause frame grabs drift on high-fps footage" /></li>
                  <li><L zh="拿不到每帧的真实时间戳, 只能信你填的 fps" en="no access to true per-frame timestamps — you can only trust the fps you typed" /></li>
                </ul>
              </div>
              <div className="wc-compare-col wc-good">
                <div className="wc-compare-h"><L zh="WebCodecs + mp4box" en="WebCodecs + mp4box" /></div>
                <ul>
                  <li><L zh="每个 sample 自带微秒级 CTS, 就是 ground truth" en="every sample carries a μs CTS — that is the ground truth" /></li>
                  <li><L zh="解出来的帧逐帧入 LRU 缓存, 倒放零延迟" en="decoded frames go into an LRU cache — zero-latency reverse playback" /></li>
                  <li><L zh="起表帧用时间戳二分定位, 不受 fps 读数漂移影响" en="the start frame is binary-searched by timestamp, immune to fps drift" /></li>
                </ul>
              </div>
            </div>
            <div className="wc-formula">
              <div className="wc-formula-tag"><L zh="为什么对判罚重要" en="Why this matters for judging" /></div>
              <p>
                <L
                  zh={<>WCA 用「数帧」核成绩时,起表帧 = <code className="wc-tex">⌈(⌊t⌋₂ + 0.009) × fps⌉</code>。这个公式只认单一 fps 值,容器读数一漂移就差 ±1 帧。CubeRoot 改用 mp4box 解出的<strong>每帧真实时间戳</strong>当基准:从结束帧往前减回溯秒数,取时间戳 ≤ 目标的最大 sample —— 故意向下取整,宁可把区间算长一点(对选手有利),也不冤枉判罚。</>}
                  en={<>When the WCA verifies a time by counting frames, the start frame = <code className="wc-tex">⌈(⌊t⌋₂ + 0.009) × fps⌉</code>. That formula trusts a single fps value, so any container drift is ±1 frame. CubeRoot anchors on the <strong>true per-frame timestamps</strong> from mp4box instead: subtract the look-back seconds from the end frame, take the largest sample with timestamp ≤ target — deliberately rounding down so the interval errs long (in the cuber's favour) rather than penalising unfairly.</>}
                />
              </p>
            </div>
          </section>

          {/* ── 5 编码流水线 ── */}
          <section className="wc-section">
            <div className="wc-sec-head"><span className="wc-sec-num">05</span><h2><L zh="确定性编码:60fps 不掉帧" en="Deterministic encode: a solid 60fps" /></h2></div>
            <p className="wc-lead">
              <L zh={<>导出魔方动画 / 轨迹视频时,老办法 <code>MediaRecorder</code> 是<strong>实时</strong>录屏 —— 渲染一慢,帧率就被拖到 ~18fps,且每次都不一样。WebCodecs 反过来:逐帧<strong>手动</strong>喂时间戳,渲染多慢都不影响产物,帧率永远精确等于设定值。</>} en={<>To export a cube animation or trail video, the old <code>MediaRecorder</code> route records the screen in <strong>real time</strong> — if rendering stutters, the frame rate gets dragged down to ~18fps, differently every run. WebCodecs flips it: you hand each frame its timestamp <strong>by hand</strong>, so render speed never touches the output and the frame rate is always exactly what you set.</>} />
            </p>
            <Pipe nodes={ENCODE} lang={lang} />
            <pre className="wc-code"><code>{`encoder.configure({ codec: 'avc1.640033', width: W, height: H, bitrate, framerate: fps });

for (let f = 0; f < totalFrames; f++) {
  draw(canvas, f);                              // 第 f 帧, 与时钟无关
  const vf = new VideoFrame(canvas, {
    timestamp: f * frameDur,                    // 自己排时间戳 → 帧率确定
    duration: frameDur,
  });
  encoder.encode(vf, { keyFrame: f % (fps * 2) === 0 });
  vf.close();
  while (encoder.encodeQueueSize > 4) await tick();  // 背压, 防显存堆爆
}
await encoder.flush();`}</code></pre>
            <p className="wc-cap"><L zh={<>关键差别就在 <code>timestamp: f × frameDur</code> —— 帧号自己决定时间,不读墙上时钟。<code>encodeQueueSize</code> 背压则保证慢机器不会一次性把几百帧全堆进显存。封装交给 <code>mp4-muxer</code>(<code>fastStart</code> 把 moov 放文件头,边下边播)。</>} en={<>The whole trick is <code>timestamp: f × frameDur</code> — the frame index decides the time, not a wall clock. The <code>encodeQueueSize</code> backpressure keeps a slow machine from piling hundreds of frames into GPU memory at once. Muxing is left to <code>mp4-muxer</code> (<code>fastStart</code> puts the moov atom up front for progressive playback).</>} /></p>
          </section>

          {/* ── 6 真实世界的坑 ── */}
          <section className="wc-section">
            <div className="wc-sec-head"><span className="wc-sec-num">06</span><h2><L zh="真实世界的坑" en="Real-world gotchas" /></h2></div>
            <div className="wc-gotcha-grid">
              <div className="wc-gotcha">
                <div className="wc-gotcha-h"><L zh="iOS Safari 首帧黑屏" en="iOS Safari black first frame" /></div>
                <p><L zh={<>新建的 <code>OffscreenCanvas</code> 第一次 <code>drawImage(VideoFrame)</code> 有 GPU 上传竞态,产物可能全黑。先 <code>fillRect</code> + <code>transferToImageBitmap().close()</code> 暖一次让后备表面 commit,再对每张缩略图采中心像素 <code>luma &lt; 8</code> 兜底丢黑帧。</>} en={<>A fresh <code>OffscreenCanvas</code>'s first <code>drawImage(VideoFrame)</code> hits a GPU-upload race and can come out all black. Warm it once with <code>fillRect</code> + <code>transferToImageBitmap().close()</code> to commit the backing surface, then probe each thumbnail's centre pixel and drop anything with <code>luma &lt; 8</code>.</>} /></p>
              </div>
              <div className="wc-gotcha">
                <div className="wc-gotcha-h"><L zh="iPhone .MOV 的 moov 在文件尾" en="iPhone .MOV puts moov at the tail" /></div>
                <p><L zh={<>iPhone 录的 QuickTime 把 codec 配置放在文件末尾。mp4box 默认流式时会丢前面的 mdat,导致拿到配置却一个样本都收不到。开 <code>createFile(true)</code>(keepMdatData)才能在 moov 到达后回头按样本表抽数据。</>} en={<>iPhone QuickTime recordings put the codec config at the end of the file. mp4box, streaming by default, discards the leading mdat — so you get config but zero samples. <code>createFile(true)</code> (keepMdatData) lets it go back and pull data by the sample table once moov arrives.</>} /></p>
              </div>
              <div className="wc-gotcha">
                <div className="wc-gotcha-h"><L zh="变帧率 (VFR)" en="Variable frame rate (VFR)" /></div>
                <p><L zh={<>iPhone 视频常是 VFR(15~67fps 乱跳)。扫一遍每个 sample 的 duration 算 min/max,比值 &lt; 0.8 判为变帧率并提示用户 —— 否则按固定 fps 数帧会系统性偏。</>} en={<>iPhone clips are often VFR (jumping 15–67fps). Scan each sample's duration for min/max; a ratio &lt; 0.8 flags it as VFR and warns the user — otherwise counting frames at a fixed fps drifts systematically.</>} /></p>
              </div>
              <div className="wc-gotcha">
                <div className="wc-gotcha-h"><L zh="背压 + 显存预算" en="Backpressure + memory budget" /></div>
                <p><L zh={<>硬件解码器队列会溢出(4K HEVC + iOS 尤其敏感)。<code>decodeQueueSize</code> 超阈值就让出事件循环;解出的 <code>ImageBitmap</code> 走 LRU(桌面 360 帧 / 移动端 60),淘汰时立刻 <code>close()</code>。</>} en={<>The hardware decoder queue can overflow (4K HEVC on iOS especially). Yield the event loop whenever <code>decodeQueueSize</code> crosses a threshold; decoded <code>ImageBitmap</code>s live in an LRU (360 frames desktop / 60 mobile) and are <code>close()</code>d the instant they're evicted.</>} /></p>
              </div>
              <div className="wc-gotcha">
                <div className="wc-gotcha-h"><L zh="不支持的 codec profile" en="Unsupported codec profiles" /></div>
                <p><L zh={<><code>configure()</code> 能过,但 <code>decode()</code> 第一帧抛 <code>EncodingError</code> —— 典型是 HEVC 4:2:2 RExt / Main 12 这种专业格式。用 <code>decoderDead</code> 标记,上层回退到 <code>&lt;video&gt;</code> + seek 链产缩略图。</>} en={<><code>configure()</code> can pass yet the first <code>decode()</code> throws <code>EncodingError</code> — typically pro formats like HEVC 4:2:2 RExt / Main 12. A <code>decoderDead</code> flag catches it and the UI falls back to a <code>&lt;video&gt;</code>+seek chain for thumbnails.</>} /></p>
              </div>
              <div className="wc-gotcha">
                <div className="wc-gotcha-h"><L zh="两阶段缩略图" en="Two-phase thumbnails" /></div>
                <p><L zh={<>先只解全部 I 帧(自包含、极快),几百毫秒内填满 timeline;再完整解码、按步长抽样补满 scrub 缓存。用户几乎立刻看到缩略图,而不是干等整段解完。</>} en={<>Decode only the I-frames first (self-contained, very fast) to fill the timeline within a few hundred ms; then do a full decode, sampling by stride to top up the scrub cache. The user sees thumbnails almost instantly instead of waiting for the whole clip.</>} /></p>
              </div>
            </div>
          </section>

          {/* ── 7 codec / 容器矩阵 ── */}
          <section className="wc-section">
            <div className="wc-sec-head"><span className="wc-sec-num">07</span><h2><L zh="解什么、编什么" en="What we decode, what we emit" /></h2></div>
            <div className="wc-matrix-wrap">
              <table className="wc-matrix">
                <thead>
                  <tr>
                    <th><L zh="编码标准" en="Codec" /></th>
                    <th><L zh="codec 串" en="codec string" /></th>
                    <th><L zh="解码" en="Decode" /></th>
                    <th><L zh="编码" en="Encode" /></th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>H.264 / AVC</td><td><code>avc1.*</code></td><td className="wc-yes"><L zh="支持, 几乎所有平台" en="yes, ~all platforms" /></td><td className="wc-yes"><L zh="我们只发这个" en="the one we emit" /></td></tr>
                  <tr><td>HEVC / H.265</td><td><code>hvc1.* / hev1.*</code></td><td className="wc-warn"><L zh="支持, 看平台硬件" en="yes, platform-dependent" /></td><td className="wc-no"><L zh="不发" en="no" /></td></tr>
                  <tr><td>VP9</td><td><code>vp09.*</code></td><td className="wc-warn"><L zh="支持, 看浏览器" en="yes, browser-dependent" /></td><td className="wc-no"><L zh="不发" en="no" /></td></tr>
                  <tr><td>AV1</td><td><code>av01.*</code></td><td className="wc-warn"><L zh="较新浏览器" en="newer browsers" /></td><td className="wc-no"><L zh="不发" en="no" /></td></tr>
                </tbody>
              </table>
            </div>
            <p className="wc-cap"><L zh={<>容器统一是 <strong>MP4</strong>:解码侧 <code>mp4box.js</code> 解复用,编码侧 <code>mp4-muxer</code> 封装。解码尽量吃浏览器支持的一切,编码为了「谁都能播」只输出 H.264。</>} en={<>The container is always <strong>MP4</strong>: <code>mp4box.js</code> demuxes on the way in, <code>mp4-muxer</code> muxes on the way out. Decoding accepts whatever the browser supports; encoding sticks to H.264 so the result plays anywhere.</>} /></p>
          </section>

          {/* ── 8 在 cuberoot.me 怎么用 ── */}
          <section className="wc-section">
            <div className="wc-sec-head"><span className="wc-sec-num">08</span><h2><L zh="在 cuberoot.me 怎么用" en="How cuberoot.me uses it" /></h2></div>
            <div className="wc-use-grid">
              <div className="wc-use">
                <div className="wc-use-h"><L zh="数帧 / frame-count" en="frame-count" /></div>
                <p><L zh={<><code>useFrameBuffer</code> hook 是 WebCodecs 解码的核心:mp4box 解复用 + 双 decoder(I 帧缩略图 + 步长 scrub)+ LRU 帧缓存,给裁判逐帧核成绩。</>} en={<>The <code>useFrameBuffer</code> hook is the decode core: mp4box demux + two decoders (I-frame thumbnails + stride scrub) + an LRU frame cache, so judges can verify a solve frame by frame.</>} /></p>
              </div>
              <div className="wc-use">
                <div className="wc-use-h"><L zh="地球轨迹导出" en="Globe trail export" /></div>
                <p><L zh={<><code>/wca/globe</code> 把 MapLibre 的 WebGL 画布逐帧烧进 <code>VideoEncoder</code>,固定 60fps 导出选手的世界巡回轨迹。</>} en={<><code>/wca/globe</code> burns the MapLibre WebGL canvas frame by frame into a <code>VideoEncoder</code>, exporting a cuber's world tour at a locked 60fps.</>} /></p>
              </div>
              <div className="wc-use">
                <div className="wc-use-h"><L zh="榜单 / 模拟器导出" en="Top10 / sim export" /></div>
                <p><L zh={<>Top10 历史动画和 <code>/sim</code> 复盘回放都走同一套确定性编码,产出稳定帧率的分享视频。</>} en={<>The Top10 history animation and <code>/sim</code> replay both reuse the same deterministic encoder to produce steady-frame-rate shareable clips.</>} /></p>
              </div>
            </div>
            <p className="wc-cap"><L zh={<>解码侧只依赖 <code>mp4box</code>,编码侧只依赖 <code>mp4-muxer</code> —— 编解码本身全是浏览器原生 API,没有 WASM 大包、没有服务器转码。</>} en={<>The decode side depends only on <code>mp4box</code>, the encode side only on <code>mp4-muxer</code> — the actual coding is all native browser API, with no heavy WASM bundle and no server-side transcoding.</>} /></p>
          </section>

          {/* ── links ── */}
          <section className="wc-section wc-links-sec">
            <div className="wc-sec-head"><span className="wc-sec-num">09</span><h2><L zh="延伸阅读" en="Further reading" /></h2></div>
            <div className="wc-links">
              <a href="https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API" target="_blank" rel="noopener noreferrer">MDN — WebCodecs API</a>
              <a href="https://www.w3.org/TR/webcodecs/" target="_blank" rel="noopener noreferrer">W3C — WebCodecs Spec</a>
              <a href="https://github.com/gpac/mp4box.js" target="_blank" rel="noopener noreferrer">mp4box.js</a>
              <a href="https://github.com/Vanilagy/mp4-muxer" target="_blank" rel="noopener noreferrer">mp4-muxer</a>
            </div>
          </section>

          <footer className="wc-foot">
            <Link href="/code/algorithms">← /code/algorithms</Link>
            <Link href="/code">/code</Link>
          </footer>
        </div>
      </div>
    </LangCtx.Provider>
  );
}
