'use client';

import type { ReactNode } from 'react';
import { continuousCorners } from '@2017yanr02/continuous-corners';
import Link from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import { TeX, TeXBlock } from '@/components/math/Tex';
import { useT } from '@/hooks/useT';
import { T } from '@/i18n/tr';
import { CornerLab, BezierLab, ConcentricLab } from './_labs';
import './continuous-corners.css';

const REPO = 'https://github.com/2017YANR02/continuous-corners';
const file = (path: string) => `${REPO}/blob/main/${path}`;
function Formula({ children }: { children: string }) {
  return <div className="cc-formula" role="math" aria-label={children}><TeXBlock src={children} /></div>;
}
function Chapter({ id, number, title, intro, children }: {
  id: string; number: string; title: string; intro: ReactNode; children: ReactNode;
}) {
  return <section id={id} className="cc-chapter">
    <header className="cc-chapter-head"><span className="cc-number">{number}</span><h2>{title}</h2><p>{intro}</p></header>
    {children}
  </section>;
}
function Code({ children, label }: { children: string; label: string }) {
  return <div className="cc-code"><div>{label}</div><pre tabIndex={0}><code>{children}</code></pre></div>;
}

export default function ContinuousCornersPage() {
  const t = useT();
  const hero = continuousCorners({ width: 280, height: 280, radius: 68 });
  const nav = [
    ['playground', t('体验', 'Explore')], ['mathematics', t('数学', 'Math')],
    ['geometry', t('算法', 'Algorithm')], ['evidence', t('证据', 'Evidence')],
    ['integration', t('接入', 'Use it')], ['sources', t('资料', 'Sources')],
  ];
  return <div className="cc-page">
    <div className="cc-topbar">
      <Link href="/dev" prefetch={false} className="cc-wordmark">CubeRoot <span>/</span> dev</Link>
      <div className="cc-top-actions"><a href={REPO}>GitHub ↗</a><HeaderToggles /></div>
    </div>
    <main className="cc-main">
      <header className="cc-hero">
        <div className="cc-hero-copy">
          <p className="cc-eyebrow">CONTINUOUS CORNERS · {t('设计与几何', 'DESIGN & GEOMETRY')}</p>
          <h1>{t('连续圆角', 'Continuous corners')}<br /><span>{t('几何与实现', 'Geometry & implementation')}</span></h1>
          <p className="cc-hero-description">{t('本文记录 continuous-corners 的实现：从 SwiftUI 导出路径，在 TypeScript 中重建控制点，再用于网页。包括数学推导、交互示例、测量结果和当前限制。', 'Implementation notes for continuous-corners: exporting SwiftUI paths, reconstructing their control points in TypeScript, and rendering them on the web. Includes the mathematics, interactive examples, measurements and known limitations.')}</p>
          <div className="cc-hero-actions"><a className="cc-button" href="#playground">{t('查看示例', 'View examples')} <span aria-hidden>↓</span></a><a className="cc-text-link" href="#mathematics">{t('数学推导', 'Mathematics')} ↗</a></div>
          <p className="cc-caption">{t('研究记录 · 2026 年 10 月 · 非 Apple 官方项目', 'Research notes · October 2026 · Independent of Apple')}</p>
        </div>
        <figure className="cc-hero-art">
          <svg viewBox="-44 -38 368 368" role="img" aria-label={t('三层错位的连续圆角路径示意', 'Three layered reconstructed corner paths')}>
            <g transform="translate(19,22)"><path d={hero.d} className="cc-hero-back" /></g>
            <g transform="translate(7,9)"><path d={hero.d} className="cc-hero-mid" /></g>
            <path d={hero.d} className="cc-hero-front" />
            <path d="M0 130 V104 M0 68 A68 68 0 0 1 68 0 H130" className="cc-hero-guide" />
            <path d={hero.d} className="cc-hero-trace" />
            <circle cx="0" cy="104" r="4" className="cc-hero-pin" /><circle cx="104" cy="0" r="4" className="cc-hero-pin" />
            <text x="140" y="146" textAnchor="middle" className="cc-hero-symbol">C</text>
            <text x="140" y="177" textAnchor="middle" className="cc-hero-sub">CONTINUOUS CORNERS</text>
          </svg>
        </figure>
      </header>

      <nav className="cc-nav" aria-label={t('专题目录', 'Article sections')}>
        {nav.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
      </nav>

      <div className="cc-intro">
        <p className="cc-lead">{t('实现范围', 'Scope')}</p>
        <div><p><T zh={<>普通 border-radius 在直线与圆弧之间连接。位置接上了，方向也对上了，但弯曲程度会从 <TeX src="0" /> 突然变成 <TeX src="1/r" />。连续圆角试图平滑这段过渡。</>} en={<>A circular border-radius joins straight edges to circular arcs. Position and tangent direction can match, yet curvature jumps from <TeX src="0" /> to <TeX src="1/r" />. Continuous corners aim to smooth this transition.</>} /></p><p>{t('本库以 SwiftUI 公开导出的 CGPath 为参照。导出路径与系统直接绘制的轮廓存在差异，后文给出对照数据及接点连续性检查。', 'The reference is SwiftUI’s publicly exported CGPath. It differs from the contour drawn directly by the system; the comparisons and join-continuity measurements are documented below.')}</p></div>
      </div>

      <Chapter id="playground" number="01" title={t('形状比较', 'Shape comparison')} intro={t('调整宽高与半径。实线来自项目正在使用的几何库；虚线使用同一有效半径的标准圆弧。', 'Adjust dimensions and radius. The solid shape uses the project’s installed geometry library; the dashed outline uses circular arcs with the same effective radius.')}>
        <CornerLab />
        <div className="cc-three cc-concepts">
          <article><span className="cc-small-label">CIRCULAR</span><h3>{t('圆弧圆角', 'Circular corners')}</h3><p>{t('每个角是四分之一圆。半径描述圆的大小；两端与直线相切。胶囊只是半径达到短边一半时的一种特殊外形。', 'Each corner is a quarter-circle tangent to its straight edges. A capsule is a special case when the radius reaches half the shorter dimension.')}</p></article>
          <article><span className="cc-small-label">SUPERELLIPSE</span><h3>{t('超椭圆', 'Superellipse')}</h3><p><T zh={<>用指数控制整条闭合轮廓的饱满程度。<TeX src="n = 2" /> 是椭圆，<TeX src="n = 4" /> 是常见的 squircle。</>} en={<>An exponent controls the fullness of a closed contour. <TeX src="n = 2" /> gives an ellipse; <TeX src="n = 4" /> gives a familiar squircle.</>} /></p></article>
          <article><span className="cc-small-label">PIECEWISE BÉZIER</span><h3>{t('分段贝塞尔', 'Piecewise Bézier')}</h3><p>{t('当前库每角使用三段三次曲线。控制点来自公开原生输出，过渡段随可用空间变化，四角再映射成完整路径。', 'The library uses three cubic segments per corner. Control points follow public native exports; transition segments adapt to available space before mapping to all four corners.')}</p></article>
        </div>
        <Formula>{String.raw`\left|\frac{x}{a}\right|^n+\left|\frac{y}{b}\right|^n=1`}</Formula>
        <p className="cc-caption">{t('超椭圆方程', 'Superellipse equation')}</p>
      </Chapter>

      <Chapter id="mathematics" number="02" title={t('三次贝塞尔曲线', 'Cubic Bézier curves')} intro={<T zh={<>三次贝塞尔由四个二维点决定。<TeX src="P_0" />、<TeX src="P_3" /> 是端点，<TeX src="P_1" />、<TeX src="P_2" /> 控制切线和弯曲形态。</>} en={<>Four two-dimensional points define a cubic Bézier. <TeX src="P_0" /> and <TeX src="P_3" /> are endpoints; <TeX src="P_1" /> and <TeX src="P_2" /> control the tangents and bending.</>} />}>
        <div className="cc-equation-feature">
          <Formula>{String.raw`B(t)=(1-t)^3P_0+3(1-t)^2tP_1+3(1-t)t^2P_2+t^3P_3`}</Formula>
          <p><TeX src={String.raw`0 \le t \le 1`} /></p>
        </div>
        <BezierLab />
        <div className="cc-two cc-prose">
          <article><h3>{t('凸包性质', 'Convex hull property')}</h3><p><T zh={<>当 <TeX src="t" /> 在 <TeX src="0" /> 到 <TeX src="1" /> 之间，四个权重都非负，且总和为 <TeX src="1" />。因此 <TeX src="B(t)" /> 是控制点的凸组合，整段曲线位于四个控制点的凸包中。控制点不是曲线必须经过的点，只有两个端点例外。</>} en={<>For <TeX src="t" /> between <TeX src="0" /> and <TeX src="1" />, all four weights are nonnegative and sum to one. <TeX src="B(t)" /> is a convex combination, so the curve stays inside the control points’ convex hull. It generally passes through only the two endpoint controls.</>} /></p></article>
          <article><h3>{t('从曲线段到完整路径', 'Assembling the path')}</h3><p>{t('每个角由三段三次贝塞尔组成。生成完整路径还需要限制半径、分配各轴空间、计算控制点、映射四角，并用直线闭合。', 'Each corner consists of three cubic segments. The full path also requires radius clamping, space allocation on each axis, control-point evaluation, corner mapping and straight closing edges.')}</p></article>
        </div>
      </Chapter>

      <Chapter id="continuity" number="03" title={t('连续性与曲率', 'Continuity and curvature')} intro={t('分段曲线的接点可分别检查位置、切线和曲率。以下列出三种几何连续条件。', 'At each join, position, tangent direction and curvature can be checked separately. These give three conditions for geometric continuity.')}>
        <div className="cc-three cc-continuity">
          {[
            ['G^0', t('位置连续', 'Position continuity'), t('两段在同一个点相遇。', 'Two segments meet at the same point.'), 'M20 75 L90 35 L160 75'],
            ['G^1', t('切线连续', 'Tangent continuity'), t('接点的前进方向一致，速度可以不同。', 'The direction agrees at the join; speed may differ.'), 'M20 75 H80 C110 75 110 35 160 35'],
            ['G^2', t('曲率连续', 'Curvature continuity'), t('同向相切，并且单侧曲率相同。', 'Tangents agree and one-sided curvatures match.'), 'M20 75 H65 C110 75 145 75 160 35'],
          ].map(([kind, title, body, path]) => <article key={kind} data-site-surface="panel">
            <span className="cc-continuity-symbol"><TeX src={kind} /></span><h3>{title}</h3><p>{body}</p>
            <svg viewBox="0 0 180 100" aria-hidden="true"><path d={path} className="cc-bezier-line" /></svg>
          </article>)}
        </div>
        <p className="cc-caption"><T zh={<>图示说明直线进入曲线时的不同连接条件；<TeX src="C^1/C^2" /> 还约束参数导数，不能直接与 <TeX src="G^1/G^2" /> 混用。以下讨论假设速度非零。</>} en={<>Diagrams illustrate line-to-curve joins. <TeX src="C^1/C^2" /> also constrain parameter derivatives and are not interchangeable with <TeX src="G^1/G^2" />. The formulas below assume nonzero velocity.</>} /></p>
        <div className="cc-two cc-prose">
          <article><h3>{t('端点切线', 'Endpoint tangents')}</h3>
            <Formula>{String.raw`B'(0)=3(P_1-P_0),\quad B'(1)=3(P_3-P_2)`}</Formula>
            <p><T zh={<>拼接两段时，前一段末端与后一段起点的导数向量必须同向，才能满足 <TeX src="G^1" />。向量长度相等则进一步满足该参数化下的 <TeX src="C^1" />。</>} en={<>For <TeX src="G^1" />, the ending derivative of the first segment and starting derivative of the next must point in the same direction. Equal vectors additionally give <TeX src="C^1" /> for that parameterization.</>} /></p>
          </article>
          <article><h3>{t('带符号曲率', 'Signed curvature')}</h3>
            <Formula>{String.raw`\kappa(t)=\frac{x'(t)y''(t)-y'(t)x''(t)}{(x'(t)^2+y'(t)^2)^{3/2}}`}</Formula>
            <p><T zh={<>这是带符号曲率，单位是长度的倒数。直线为 <TeX src="0" />；半径为 <TeX src="r" /> 的圆，其曲率绝对值是 <TeX src="1/r" />。符号由坐标系和行进方向决定。</>} en={<>Signed curvature has units of inverse length. A line has zero curvature; a circle of radius <TeX src="r" /> has magnitude <TeX src="1/r" />. The sign depends on orientation and coordinate conventions.</>} /></p>
          </article>
        </div>
        <details className="cc-detail"><summary>{t('展开二阶导数与接点检验', 'Second derivatives and the join test')}</summary>
          <Formula>{String.raw`B''(0)=6(P_2-2P_1+P_0),\quad B''(1)=6(P_3-2P_2+P_1)`}</Formula>
          <p><T zh={<>先检验端点相等，再检验两条切线叉积为零且点积为正，最后比较左右带符号曲率。接点若不满足切线连续，就不能称为严格 <TeX src="G^2" />。</>} en={<>Check endpoint equality, then a zero cross product and positive dot product for the tangents, and finally compare one-sided signed curvatures. A join without tangent continuity is not <TeX src="G^2" />.</>} /></p>
        </details>
        <div className="cc-callout">
          <h3>{t('位置误差与导数误差', 'Position error and derivative error')}</h3>
          <Formula>{String.raw`f_\varepsilon(x)=\varepsilon\sin(x/\varepsilon),\quad |f_\varepsilon|\leq\varepsilon,\quad f'_\varepsilon(x)=\cos(x/\varepsilon)`}</Formula>
          <p><T zh={<>这个光滑例子的高度可以无限接近 <TeX src="0" />，但斜率仍在 <TeX src="-1" /> 到 <TeX src="1" /> 之间变化；二阶导数的幅度甚至是 <TeX src={"1/\\varepsilon"} />。它说明位置误差不控制导数误差。更直接地，<TeX src={"\\varepsilon|x|"} /> 无论多小，在 <TeX src="x = 0" /> 仍有折点。因此“距离很小”本身不能证明相同的光滑等级。</>} en={<>This smooth function can stay arbitrarily close to zero while its slope still ranges from <TeX src="-1" /> to <TeX src="1" />; the second derivative has amplitude <TeX src={"1/\\varepsilon"} />. Position error alone does not control derivative error. More directly, <TeX src={"\\varepsilon|x|"} /> has a kink at zero however small <TeX src={"\\varepsilon"} /> becomes. Small distance does not prove matching smoothness.</>} /></p>
        </div>
      </Chapter>

      <Chapter id="geometry" number="04" title={t('路径重建算法', 'Path reconstruction')} intro={t('几何版本：swiftui-27-uniform-v1。', 'Geometry version: swiftui-27-uniform-v1.')}>
        <ol className="cc-steps">
          <li><div><h3>{t('先约束有效半径', 'Clamp the effective radius')}</h3><Formula>{String.raw`r=\min(r_{\rm requested},\,w/2,\,h/2)`}</Formula><p><T zh={<>宽高必须为有限正数，半径为有限非负数，输入上限为 <TeX src="10^7" />。<TeX src="r = 0" /> 直接生成矩形。</>} en={<>Dimensions must be finite and positive; radius finite and nonnegative. Inputs are capped at <TeX src="10^7" />. Zero radius gives a rectangle.</>} /></p></div></li>
          <li><div><h3>{t('计算每轴能分给角部的空间', 'Allocate space on each axis')}</h3><Formula>{String.raw`e=\min(H/r,\,1.528665),\qquad u=\frac{e-1}{1.528665-1}`}</Formula><p><T zh={<>统一半径时，<TeX src="H" /> 分别是宽度或高度的一半。足够宽松时过渡范围约为 <TeX src="1.528665r" />；空间紧张时 <TeX src="u" /> 从 <TeX src="1" /> 向 <TeX src="0" /> 收缩。这里的 <TeX src="u" /> 是空间插值参数，不是曲线参数 <TeX src="t" />。</>} en={<>For equal radii, <TeX src="H" /> is half the width or height. With enough space, the transition occupies about <TeX src="1.528665r" />; tighter dimensions reduce <TeX src="u" /> from <TeX src="1" /> toward <TeX src="0" />. This <TeX src="u" /> is a space-allocation parameter, not the curve parameter <TeX src="t" />.</>} /></p></div></li>
          <li><div><h3>{t('求过渡控制点，再映射四角', 'Evaluate controls, then map the corners')}</h3><Formula>{String.raw`a=1.08849u+0.96(1-u),\qquad b=0.868407u+0.82(1-u)`}</Formula><p><T zh={<>中间段的归一化常数固定，首尾段使用各轴的 <TeX src="e" />、<TeX src="a" />、<TeX src="b" />。坐标乘以 <TeX src="r" />，再通过水平、垂直反射映射到其余角。SVG 保留原始数值精度，不额外截短小数。</>} en={<>The middle segment uses fixed normalized constants. The outer segments use axis-specific <TeX src="e" />, <TeX src="a" /> and <TeX src="b" />. Multiply by <TeX src="r" /> and reflect horizontally and vertically to obtain the other corners. SVG serialization does not add decimal truncation.</>} /></p></div></li>
        </ol>
        <details className="cc-detail"><summary>{t('完整左上角控制点表', 'Full top-left control-point table')}</summary>
          <p><T zh={<>从左边缘向上边缘行进。下表均为归一化坐标；最后整对坐标乘以 <TeX src="r" />。设 <TeX src="i = 0.0749114" />，<TeX src="d = 0.631494" />，<TeX src="n = 0.16906" />，<TeX src="q = 0.372824" />。</>} en={<>Traveling from the left edge to the top edge. Coordinates below are normalized; multiply each pair by <TeX src="r" />. Let <TeX src="i = 0.0749114" />, <TeX src="d = 0.631494" />, <TeX src="n = 0.16906" />, <TeX src="q = 0.372824" />.</>} /></p>
          <div className="cc-table-scroll" tabIndex={0}><table><caption>{t('三段三次贝塞尔', 'Three cubic Bézier segments')}</caption><thead><tr><th>{t('段', 'Segment')}</th><th><TeX src="P_0" /></th><th><TeX src="P_1" /></th><th><TeX src="P_2" /></th><th><TeX src="P_3" /></th></tr></thead><tbody>
            <tr><th>1</th><td><TeX src="(0, e_y)" /></td><td><TeX src="(0, a_y)" /></td><td><TeX src="(0, b_y)" /></td><td><TeX src="(i, d)" /></td></tr>
            <tr><th>2</th><td><TeX src="(i, d)" /></td><td><TeX src="(n, q)" /></td><td><TeX src="(q, n)" /></td><td><TeX src="(d, i)" /></td></tr>
            <tr><th>3</th><td><TeX src="(d, i)" /></td><td><TeX src="(b_x, 0)" /></td><td><TeX src="(a_x, 0)" /></td><td><TeX src="(e_x, 0)" /></td></tr>
          </tbody></table></div>
          <p>{t('关键常数和中间值通过 Math.fround 做 Float32 舍入，具体运算顺序见源码。', 'Key constants and intermediate values use Math.fround for Float32 rounding. See the source for evaluation order.')}</p>
          <a href={file('src/index.ts')}>{t('查看几何核心源码', 'Read the geometry source')} ↗</a>
        </details>
      </Chapter>

      <Chapter id="containers" number="05" title={t('容器与同心圆角', 'Containers and concentric corners')} intro={t('Apple 的同心圆角体系还涉及容器、子视图位置、独立四角和最小半径。GeometryProxy 的查询返回半径，本身不生成曲线。', 'Apple’s concentric-corner system also involves containers, child positions, independent corners and minimum radii. GeometryProxy queries return radii; they do not generate the curve itself.')}>
        <ConcentricLab />
        <div className="cc-two cc-prose"><article><h3>{t('矩形容器中的左上角', 'Top-left within a rectangular container')}</h3>
          <Formula>{String.raw`g=\max(\Delta x_{\rm left},\Delta y_{\rm top})`}</Formula>
          <Formula>{String.raw`r_{\rm child}=\min\!\left(\frac{w}{2},\frac{h}{2},\max(0,R_{\rm parent}-g)\right)`}</Formula>
          <p>{t('该规则来自矩形容器原生实验，仅适用于显式矩形容器。外扩时距离可为负。', 'This rule comes from native experiments with explicit rectangular containers and applies to that case. Outsets allow negative distances.')}</p></article>
          <article><h3>{t('相邻半径约束', 'Constraints on adjacent radii')}</h3><p>{t('物理顺序为左上、右上、右下、左下。先处理横向邻角，再处理纵向邻角，小半径优先保留；不能直接替换成 CSS 的全体同比缩小。', 'Physical order is top-left, top-right, bottom-right, bottom-left. Horizontal pairs are constrained before vertical pairs, preserving smaller radii where possible. This is not CSS’s global proportional reduction.')}</p>
          <Formula>{String.raw`a'=\min(a,\max(L/2,L-b)),\quad b'=\min(b,\max(L/2,L-a))`}</Formula>
          <p><T zh={<>一对角在同一步都读取原始 <TeX src="a" />、<TeX src="b" />。fixed、concentric、minimum 先解析成候选值；统一角组取组内最大值，最后再做尺寸约束。leading/trailing 在方向边界转换，不能假定总是左/右。</>} en={<>Both values in a pair read the original <TeX src="a" /> and <TeX src="b" />. Fixed, concentric and minimum rules resolve first; uniform groups take their maximum, followed by size constraints. Leading/trailing must be mapped at the layout-direction boundary.</>} /></p></article></div>
        <p className="cc-source-note">{t('API 时间线：ConcentricRectangle 属于 26 系列；GeometryProxy.concentricCornerRadii 查询从 27.0 引入。', 'API timeline: ConcentricRectangle belongs to the 26 generation; GeometryProxy.concentricCornerRadii was introduced in 27.0.')} <a href="https://developer.apple.com/documentation/swiftui/geometryproxy/concentriccornerradii">Apple documentation ↗</a></p>
      </Chapter>

      <Chapter id="evidence" number="06" title={t('精度与误差', 'Accuracy and error')} intro={t('以下区分系统直接绘制、公开导出路径和本库重建结果，分别记为 A、B、C。', 'The comparisons distinguish direct system rendering, the public path export and this library’s reconstruction, labeled A, B and C.')}>
        <div className="cc-three cc-evidence-chain">
          <article><span>A</span><h3>{t('原生直接绘制', 'Direct native rendering')}</h3><code>RoundedRectangle</code><p>{t('系统直接绘制的图像，包含光栅化结果。', 'The image drawn directly by the system, including rasterization.')}</p></article>
          <article><span>B</span><h3>{t('公开导出路径', 'Public exported path')}</h3><code>.path(in:).cgPath</code><p>{t('公开接口返回的路径命令和控制点。', 'Path commands and control points returned by the public API.')}</p></article>
          <article><span>C</span><h3>{t('TypeScript 重建', 'TypeScript reconstruction')}</h3><code>continuousCorners()</code><p>{t('本库根据 B 重建动态尺寸路径，再交给 SVG 或 Canvas 绘制。', 'This library reconstructs B for dynamic dimensions, then passes it to SVG or Canvas.')}</p></article>
        </div>
        <div className="cc-table-scroll" tabIndex={0}><table className="cc-evidence-table"><caption>{t('已保存的研究基线 · 2026-10-19', 'Saved research baseline · 2026-10-19')}</caption><thead><tr><th>{t('比较', 'Comparison')}</th><th>{t('范围', 'Scope')}</th><th>{t('结果', 'Result')}</th></tr></thead><tbody>
          <tr><th>B ↔ C</th><td>{t('578 组统一半径，46,582 个坐标', '578 uniform-radius samples, 46,582 coordinates')}</td><td><strong>0.0000282897</strong><small>{t('最大控制点坐标绝对差，逻辑单位', 'Maximum absolute control-coordinate difference, logical units')}</small></td></tr>
          <tr><th>B ↔ C</th><td>{t('262 组独立四角', '262 independent-corner samples')}</td><td><strong>≈ 0.0000708</strong><small>{t('最大控制点坐标绝对差，逻辑单位', 'Maximum absolute control-coordinate difference, logical units')}</small></td></tr>
          <tr><th>{t('容器查询', 'Container queries')}</th><td>{t('360 个显式矩形容器查询', '360 explicit rectangular-container queries')}</td><td>{t('样本内数值相等', 'Equal values within the sample set')}</td></tr>
          <tr><th>A ↔ B</th><td><T zh={<><TeX src={"100\\times100"} />，<TeX src="r = 24" />，<TeX src={"24\\times"} /> 渲染</>} en={<><TeX src={"100\\times100"} />, <TeX src="r = 24" />, rendered at <TeX src={"24\\times"} /></>} /></td><td><strong>≈ 0.154931</strong><small>{t('选定扫描行的半强度边界最大横向差，逻辑单位', 'Maximum sampled horizontal half-intensity boundary difference, logical units')}</small></td></tr>
        </tbody></table></div>
        <p className="cc-source-note"><a href={file('fixtures/verification.json')}>{t('统一半径数据', 'Uniform-radius data')} ↗</a> · <a href={file('fixtures/system-ios-comparison.json')}>{t('跨系统记录', 'Cross-system record')} ↗</a> · <a href={file('fixtures/native-render-comparison-macos-27.0.1.json')}>{t('渲染对照', 'Rendering comparison')} ↗</a></p>
        <details className="cc-detail"><summary>{t('控制点误差的传播', 'Propagation of control-point error')}</summary>
          <p><T zh={<>对拓扑相同、对应控制点一致配对的两段三次贝塞尔，若每个控制点的欧氏距离误差不超过 <TeX src={"\\delta"} />，利用 Bernstein 权重的非负性与和为 <TeX src="1" />，可得到同一参数 <TeX src="t" /> 下的界：</>} en={<>For two cubic segments with matching topology and paired controls, suppose every control-point Euclidean error is at most <TeX src={"\\delta"} />. Nonnegative Bernstein weights summing to one give these bounds at the same parameter <TeX src="t" />:</>} /></p>
          <Formula>{String.raw`\|B-\widetilde B\|\leq\delta,\quad \|B'-\widetilde B'\|\leq6\delta,\quad \|B''-\widetilde B''\|\leq24\delta`}</Formula>
          <p><T zh={<>表中的数值是单坐标最大误差 <TeX src={"\\varepsilon"} />，在二维中可取 <TeX src={"\\delta = \\sqrt{2}\\,\\varepsilon"} />。这只约束已配对的 B ↔ C 样本。曲率还要除以速度的三次方，速度接近零时尤其敏感；而“严格连续”要求接点左右精确相等，任意小的扰动仍可能破坏这种等式。更关键的是，B 自己的内部接点并非已经证明连续，C 贴近 B 不会自动变成连续。</>} en={<>The table reports maximum single-coordinate error <TeX src={"\\varepsilon"} />; in two dimensions <TeX src={"\\delta = \\sqrt{2}\\,\\varepsilon"} /> is a valid bound. This applies only to paired B–C samples. Curvature also divides by speed cubed and becomes sensitive near zero speed. Strict continuity requires exact join equalities, which even tiny perturbations can break. Crucially, B’s internal joins are not established as continuous; making C close to B cannot itself make them continuous.</>} /></p>
        </details>
        <div className="cc-callout cc-important">
          <h3>{t('原生绘制与导出路径的差异', 'Native rendering versus exported paths')}</h3>
          <p>{t('A 与 B 在同一个 macOS 27.0.1 ImageRenderer 中对照：continuous 在 3×、12×、24× 均有差异，circular 对照组三种倍率的 RGBA 通道都相同。这里的 0.154931 是沿选定扫描行、用 RGB 半强度阈值插值估计的边界差；不是完整轮廓距离，不是所有尺寸的误差上限，也没有分离所有抗锯齿因素。', 'In the same macOS 27.0.1 ImageRenderer, continuous differed at 3×, 12× and 24×; circular controls had identical RGBA channels at all three scales. The 0.154931 value estimates a boundary using interpolated RGB half-intensity crossings on selected rows. It is not a full-contour distance, an all-size bound, or a complete separation of antialiasing effects.')}</p>
          <p>{t('因此，B ↔ C 的误差不能用作本库与原生绘制结果之间的误差上限。', 'The B–C error is therefore not an upper bound on the difference between this library and native rendering.')}</p>
        </div>
        <details className="cc-detail"><summary>{t('导出路径的接点检查', 'Exported-path join audit')}</summary>
          <p><T zh={<>在 macOS 27.0.1 导出的 <TeX src={"320\\times200"} />、<TeX src="r = 24" /> 样本中，左上角第一段到第二段的切线方向相差约 <TeX src={"2.453240^\\circ"} />。单侧曲率约为 0.02985295 与 0.04464430。这个接点甚至不满足严格 <TeX src="G^1" />，因此不能称为处处 <TeX src="G^2" />。</>} en={<>For the <TeX src={"320\\times200"} />, <TeX src="r = 24" /> export on macOS 27.0.1, the first-to-second top-left join had a tangent difference of approximately <TeX src={"2.453240^\\circ"} />. One-sided curvatures were about 0.02985295 and 0.04464430. That join is not strictly <TeX src="G^1" />, so the exported path is not everywhere <TeX src="G^2" />.</>} /></p>
          <p>{t('Apple 的文档将 .continuous 描述为连续曲率圆角；上述测量针对 B，不足以断言 A 的内部数学曲线不连续。', 'Apple describes .continuous as continuous-curvature rounded corners. The measurement concerns B and does not establish that A’s internal mathematical curve is discontinuous.')}</p>
          <a href={file('fixtures/continuity-audit-macos-27.0.1.json')}>{t('查看导数与原始控制点', 'Inspect derivatives and original controls')} ↗</a>
        </details>
      </Chapter>

      <Chapter id="integration" number="07" title={t('接入与平台支持', 'Integration and platform support')} intro={t('运行时是 TypeScript。Swift 仅用于调用公开 Apple API，导出独立的原生对照；网页运行不需要 Mac。', 'The runtime is TypeScript. Swift is used only to export independent references through public Apple APIs. Websites do not need a Mac to render the paths.')}>
        <div className="cc-two">
          <Code label="TypeScript → SVG / Canvas">{`import { continuousCorners, tracePath }
  from "@2017yanr02/continuous-corners";

const path = continuousCorners({
  width: 320, height: 200, radius: 24
});

// SVG: <path d={path.d} />
context.beginPath();
tracePath(context, path.commands);
context.fill();`}</Code>
          <Code label="React → SiteCorners">{`import { SiteCorners }
  from "@2017yanr02/continuous-corners/react";

// Mount once in the app root.
<SiteCorners
  containers=".card-surface"
  exclude=".third-party-widget"
/>

// Explicit native path + rendering references:
// xcrun swift tools/export.swift 320 200 24
// xcrun swift tools/compare-native-render.swift`}</Code>
        </div>
        <div className="cc-two cc-prose">
          <article><h3>{t('安装与版本', 'Installation and versioning')}</h3><p>{t('示例使用 CubeRoot 锁定的 0.3.1 本地包，几何版本为 uniform-v1 / independent-v1。仓库标记为 UNLICENSED，尚未发布 npm 包；使用需取得仓库访问和许可。', 'The examples use CubeRoot’s pinned 0.3.1 local package, with uniform-v1 / independent-v1 geometry. The repository is marked UNLICENSED and has no published npm package; use requires repository access and permission.')}</p><Code label={t('在库仓库中构建', 'Build in the library repository')}>{`npm ci
npm run build
mkdir -p output
npm pack --pack-destination output
# Install the resulting .tgz in the consumer.`}</Code></article>
          <article><h3>{t('DOM 绘制方式', 'DOM rendering')}</h3><p>{t('裁切可能同时切掉阴影、焦点轮廓、下拉框和溢出内容。全站适配器优先用 SVG border-image 绘制支持的背景与边框，保留元素结构；需要严格同路径阴影时使用显式 Surface。', 'Clipping can cut off shadows, focus outlines, menus and overflow content. The site adapter uses SVG border-image for supported fills and borders while preserving element structure. Use an explicit Surface when effects need to follow the same path.')}</p><p>{t('不要非等比拉伸固定 SVG；尺寸改变后重新求路径。Canvas 先按 DPR 配置逻辑坐标。圆形头像、单选点仍然应该是真正的圆。', 'Recompute paths when dimensions change instead of nonuniformly stretching fixed SVGs. Configure Canvas logical coordinates for DPR. Circular avatars and radio indicators should remain real circles.')}</p></article>
        </div>
        <div className="cc-table-scroll" tabIndex={0}><table><caption>{t('适配边界', 'Adapter boundaries')}</caption><thead><tr><th>{t('场景', 'Surface')}</th><th>{t('策略与状态', 'Strategy and status')}</th></tr></thead><tbody>
          <tr><th>SVG / Canvas</th><td>{t('共用路径命令。相同几何不代表不同引擎的抗锯齿像素相同。', 'Shared path commands. Identical geometry does not guarantee identical antialiasing across engines.')}</td></tr>
          <tr><th>Safari</th><td>{t('使用标准 SVG，不依赖 corner-shape。既有 Mac Safari 检查与真机验收分开记录；新版 iPhone Safari 验证待完成。', 'Uses standard SVG, without requiring corner-shape. Recorded Mac Safari checks are distinct from physical-device acceptance; current-version iPhone Safari validation remains pending.')}</td></tr>
          <tr><th>DOM / React</th><td>{t('支持范围内的纯色、单层线性渐变与统一实线边框自动适配；椭圆/百分比半径、复杂背景、不同边框、伪元素，以及背景/边框过渡或动画元素保留 CSS。', 'Automatic adaptation covers supported solid fills, single linear gradients and uniform solid borders. Elliptical/percentage radii, complex backgrounds, unequal borders, pseudo-elements, and background/border transitions or animations retain CSS.')}</td></tr>
          <tr><th>SwiftUI / UIKit / AppKit</th><td>{t('原生项目优先使用系统公开接口。不同框架、控件与系统版本需要分别验证。', 'Prefer public system APIs in native applications. Frameworks, controls and OS versions require separate validation.')}</td></tr>
          <tr><th>{t('其他客户端', 'Other clients')}</th><td>{t('可使用 Canvas 或路径命令；Android、Flutter 和小程序的组件适配与验收待完成。', 'Canvas or path commands can be used. Component integration and acceptance for Android, Flutter and Mini Programs remain pending.')}</td></tr>
        </tbody></table></div>
      </Chapter>

      <Chapter id="alternatives" number="08" title={t('相关实现', 'Related implementations')} intro={t('以下实现分别以 UIKit、Figma、超椭圆或 CSS 角形状为目标，可用于比较算法和适配方式。', 'These implementations target UIKit, Figma, superellipses or CSS corner shapes, and provide references for geometry and rendering approaches.')}>
        <div className="cc-two cc-alternatives">
          <a href="https://www.paintcodeapp.com/news/code-for-ios-7-rounded-rectangles" data-site-surface="panel"><span>01 ↗</span><h3>PaintCode</h3><p>{t('通过 CGPath 遍历读取 iOS 7 圆角的控制点，提供普通版和旧行为兼容版。研究对象是当时的 UIKit。', 'Extracts iOS 7 corner controls through CGPath traversal, with regular and legacy-compatible variants. The reference is UIKit from that period.')}</p></a>
          <a href="https://github.com/phamfoo/figma-squircle" data-site-surface="panel"><span>02 ↗</span><h3>figma-squircle</h3><p>{t('复现 Figma 风格的圆角，提供 smoothing 参数。适合需要与 Figma 设计稿一致的项目。', 'Figma-style corners with an adjustable smoothing parameter, intended for matching Figma designs.')}</p></a>
          <a href="https://api.flutter.dev/flutter/painting/RoundedSuperellipseBorder-class.html" data-site-surface="panel"><span>03 ↗</span><h3>Flutter RSuperellipse</h3><p>{t('Flutter 提供的圆角超椭圆边框。官方文档将其描述为模仿 iOS 常见圆角风格，可参考其路径和边框实现。', 'Flutter’s rounded-superellipse border, documented as mimicking the rounded rectangles common in iOS. Its path and border implementation are available for reference.')}</p></a>
          <a href="https://drafts.csswg.org/css-borders-4/#corner-shaping" data-site-surface="panel"><span>04 ↗</span><h3>CSS corner-shape</h3><p>{t('CSS 标准中的角形状属性，包含 squircle 等形状。几何定义见规范；可用性取决于浏览器版本。', 'A CSS property for corner shapes, including squircle. The specification defines the geometry; availability depends on the browser version.')}</p></a>
        </div>
      </Chapter>

      <Chapter id="research" number="09" title={t('复现步骤与待办', 'Reproduction and remaining work')} intro={t('仓库保存了原始路径样本、导出工具和对照脚本。当前还缺少完整轮廓误差指标，以及新版 iPhone Safari 真机结果。', 'The repository includes path samples, export tools and comparison scripts. Full-contour error metrics and current-version iPhone Safari device results are still missing.')}>
        <div className="cc-two cc-prose"><article><h3>{t('已有记录', 'Available records')}</h3><ul>
          <li>{t('带系统版本、尺寸和原始控制点的路径样本。', 'Versioned path samples with dimensions and original control points.')}</li>
          <li>{t('统一半径、独立四角、显式矩形容器的对照数据。', 'Uniform, independent-corner and rectangular-container comparisons.')}</li>
          <li>{t('端点导数核查与同一 ImageRenderer 中的 A/B 对照。', 'Endpoint-derivative audit and A/B comparisons in one ImageRenderer.')}</li>
        </ul></article><article><h3>{t('待办', 'Remaining work')}</h3><ul>
          <li>{t('区分几何偏差与光栅化偏差，建立完整轮廓距离指标。', 'Separate geometric and rasterization differences; establish full-contour distance metrics.')}</li>
          <li>{t('覆盖更多尺寸、极端比例、独立角与系统版本。', 'Cover more dimensions, extreme aspect ratios, independent corners and OS versions.')}</li>
          <li>{t('完成新版 iPhone Safari 真机检查，再分别验收各产品。', 'Complete current-version iPhone Safari device checks and separate product acceptance.')}</li>
        </ul></article></div>
        <Code label={t('导出与对照命令', 'Export and comparison commands')}>{`# Node 24+; Apple export tools require Mac + Xcode.
npm run verify:apple
xcrun swift tools/export.swift 320 200 24 > output/native.json
xcrun swift tools/compare-native-render.swift

# New OS results belong in output/ first.
# Review provenance, topology and numerical differences
# before introducing a new versioned fixture.`}</Code>
      </Chapter>

      <Chapter id="sources" number="10" title={t('参考资料', 'References')} intro={t('Apple 接口文档、SVG 规范、项目源码与实验记录。', 'Apple API documentation, the SVG specification, source code and experiment records.')}>
        <div className="cc-source-grid">
          {[
            ['APPLE', 'RoundedCornerStyle.continuous', 'https://developer.apple.com/documentation/swiftui/roundedcornerstyle/continuous'],
            ['APPLE', 'GeometryProxy.concentricCornerRadii', 'https://developer.apple.com/documentation/swiftui/geometryproxy/concentriccornerradii'],
            ['APPLE', 'ConcentricRectangle', 'https://developer.apple.com/documentation/swiftui/concentricrectangle'],
            ['APPLE', 'Path.cgPath', 'https://developer.apple.com/documentation/swiftui/path/cgpath'],
            ['W3C', t('SVG 三次贝塞尔路径规范', 'SVG cubic Bézier path specification'), 'https://www.w3.org/TR/SVG/paths.html#PathDataCubicBezierCommands'],
            ['SOURCE', t('TypeScript 几何核心', 'TypeScript geometry core'), file('src/index.ts')],
            ['RESEARCH', t('几何与精度完整记录', 'Geometry and precision notes'), file('docs/geometry.md')],
            ['RESEARCH', t('Apple 2026 圆角体系', 'Apple 2026 corner system'), file('docs/apple-system-2026.md')],
            ['STATUS', t('验证与平台跟踪文档', 'Validation and platform tracker'), file('docs/tracker.md')],
          ].map(([tag, label, href]) => <a key={href} href={href}><span>{tag}</span><strong>{label}</strong><span aria-hidden>↗</span></a>)}
        </div>
      </Chapter>
      <footer className="cc-footer"><div><strong>Continuous Corners</strong><p>{t('TypeScript 路径库 · CubeRoot 开发记录', 'TypeScript path library · CubeRoot development notes')}</p></div><a href={REPO}>{t('查看项目', 'View project')} ↗</a></footer>
    </main>
  </div>;
}
