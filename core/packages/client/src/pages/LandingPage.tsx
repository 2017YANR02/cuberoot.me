/**
 * 全站入口页
 * NOTE: 粒子动画代码保留但不挂载（SHOW_PARTICLES=false），方便将来复用
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3, Film, ScanSearch, Calculator as CalculatorIcon, LineChart,
  Swords, Target, CalendarDays, Puzzle, BookOpen, Earth as GlobeIcon,
  Shuffle, Library, BookMarked, Compass, Grid2x2, Heart, Trophy, Timer as TimerIcon, TrendingDown,
  ImagePlus,
  Wand2,
  Code as CodeIcon, Brain,
  type LucideIcon,
} from 'lucide-react';
import LandingCubeHero from './LandingCubeHero';
import DonateModal from './DonateModal';
import WcaAuth from '../components/WcaAuth';
import ThemeToggle from '../components/ThemeToggle';
import { Flag } from '../utils/flag';
import './landing.css';

// NOTE: 粒子动画开关 — 当前落地页走浅色主题，不需要粒子背景
const SHOW_PARTICLES = false;

// ── 粒子系统（从 assets/js/particles.js 1:1 移植） ──────────────────────

// NOTE: 标准魔方 6 面配色（面法线方向 → 颜色）
const FACE_COLORS = [
  { normal: [0, 1, 0], color: '#FFFFFF', light: '#FFFFFF' },   // U 白
  { normal: [0, -1, 0], color: '#FFD500', light: '#FFE566' },  // D 黄
  { normal: [0, 0, 1], color: '#B71234', light: '#D44A5E' },   // F 红
  { normal: [0, 0, -1], color: '#FF5800', light: '#FF8844' },  // B 橙
  { normal: [-1, 0, 0], color: '#009B48', light: '#33C070' },  // L 绿
  { normal: [1, 0, 0], color: '#0046AD', light: '#3377CC' },   // R 蓝
];

const SIZE_RATIO = 0.2;
const SCATTER_RATIO = 0.5;
const FOV = 800;
const SPRING_K = 0.06;
const FRICTION = 0.88;
const EXPLODE_RADIUS = 300;
const ROTATE_Y_SPEED = 0.003;
const ROTATE_X_SPEED = 0.001;
const TRAIL_SCALE = 1.5;
const DEPTH_NEAR = -500;
const DEPTH_FAR = 500;

interface Particle {
  cubeX: number; cubeY: number; cubeZ: number;
  scatX: number; scatY: number; scatZ: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  color1: string; color2: string;
  baseSize: number;
}

function rotateY(x: number, y: number, z: number, a: number) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: x * c + z * s, y, z: -x * s + z * c };
}

function rotateX(x: number, y: number, z: number, a: number) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x, y: y * c - z * s, z: y * s + z * c };
}

/** 在球壳上生成随机点 */
function spherePoint(innerR: number, outerR: number) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = innerR + Math.random() * (outerR - innerR);
  return {
    x: r * Math.sin(phi) * Math.cos(theta),
    y: r * Math.sin(phi) * Math.sin(theta),
    z: r * Math.cos(phi),
  };
}

/** 创建粒子数组 */
function createParticles(cubeSize: number, scatterR: number, isMobile: boolean): Particle[] {
  const ppf = isMobile ? 100 : 200; // particles per face
  const half = cubeSize;
  const particles: Particle[] = [];

  for (let fi = 0; fi < 6; fi++) {
    const face = FACE_COLORS[fi];
    const [nx, ny, nz] = face.normal;

    for (let i = 0; i < ppf; i++) {
      // NOTE: 魔方面上的坐标（法线方向固定，其他两轴随机）
      const cp = { x: 0, y: 0, z: 0 };
      if (nx !== 0) {
        cp.x = nx * half;
        cp.y = (Math.random() - 0.5) * 2 * half;
        cp.z = (Math.random() - 0.5) * 2 * half;
      } else if (ny !== 0) {
        cp.x = (Math.random() - 0.5) * 2 * half;
        cp.y = ny * half;
        cp.z = (Math.random() - 0.5) * 2 * half;
      } else {
        cp.x = (Math.random() - 0.5) * 2 * half;
        cp.y = (Math.random() - 0.5) * 2 * half;
        cp.z = nz * half;
      }

      const sp = spherePoint(cubeSize * 0.8, scatterR);

      particles.push({
        cubeX: cp.x, cubeY: cp.y, cubeZ: cp.z,
        scatX: sp.x, scatY: sp.y, scatZ: sp.z,
        x: cp.x, y: cp.y, z: cp.z,
        vx: 0, vy: 0, vz: 0,
        color1: face.color,
        color2: face.light,
        baseSize: 1.2 + Math.random() * 1.5,
      });
    }
  }
  return particles;
}

/** 粒子系统 hook — 管理 Canvas 动画生命周期 */
function useParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isMobile = window.innerWidth < 768;
    let w = 0, h = 0;
    let cubeSize = 0, scatterR = 0;
    let explodeAmount = 0;
    const mouse = { x: -9999, y: -9999 };
    let particles: Particle[] = [];
    let animId = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = w + 'px';
      canvas!.style.height = h + 'px';
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const avgDim = (w + h) / 2;
      cubeSize = avgDim * SIZE_RATIO;
      scatterR = avgDim * SCATTER_RATIO;
    }

    function init() {
      resize();
      particles = createParticles(cubeSize, scatterR, isMobile);
    }

    function update() {
      // 鼠标离屏幕中心的距离 → 控制爆炸程度
      const mwX = mouse.x - w / 2;
      const mwY = mouse.y - h / 2;
      const mouseDist = Math.sqrt(mwX * mwX + mwY * mwY);
      const targetExplode = mouseDist < EXPLODE_RADIUS
        ? 1.0 - (mouseDist / EXPLODE_RADIUS)
        : 0;
      explodeAmount += (targetExplode - explodeAmount) * 0.05;

      for (const p of particles) {
        // 1. 旋转魔方坐标（全局自转）
        let r = rotateY(p.cubeX, p.cubeY, p.cubeZ, ROTATE_Y_SPEED);
        r = rotateX(r.x, r.y, r.z, ROTATE_X_SPEED);
        p.cubeX = r.x; p.cubeY = r.y; p.cubeZ = r.z;

        // 2. base = lerp(cubePos, scatterPos, explodeAmount)
        const baseX = p.cubeX + (p.scatX - p.cubeX) * explodeAmount;
        const baseY = p.cubeY + (p.scatY - p.cubeY) * explodeAmount;
        const baseZ = p.cubeZ + (p.scatZ - p.cubeZ) * explodeAmount;

        // 3. 弹簧恢复
        p.vx += (baseX - p.x) * SPRING_K;
        p.vy += (baseY - p.y) * SPRING_K;
        p.vz += (baseZ - p.z) * SPRING_K;

        // 4. 阻尼
        p.vx *= FRICTION;
        p.vy *= FRICTION;
        p.vz *= FRICTION;

        // 5. 位置更新
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;
      }
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h);
      const hw = w / 2;
      const hh = h / 2;

      // Z 排序
      particles.sort((a, b) => b.z - a.z);

      for (const p of particles) {
        const scale = FOV / (FOV + p.z);
        if (scale <= 0) continue;

        const sx = p.x * scale + hw;
        const sy = p.y * scale + hh;

        // 景深
        const depthRange = DEPTH_FAR - DEPTH_NEAR;
        const depthNorm = Math.max(0, Math.min(1, (p.z - DEPTH_NEAR) / depthRange));
        const alpha = 1.0 - depthNorm * 0.8;

        const pvx = p.vx * scale;
        const pvy = p.vy * scale;
        const lw = p.baseSize * scale;

        ctx!.save();
        ctx!.globalAlpha = alpha;

        // 渐变线段
        const ex = sx - pvx * TRAIL_SCALE;
        const ey = sy - pvy * TRAIL_SCALE;
        const grad = ctx!.createLinearGradient(sx, sy, ex, ey);
        grad.addColorStop(0, p.color1);
        grad.addColorStop(1, p.color2);
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = Math.max(lw, 0.5);
        ctx!.lineCap = 'round';

        ctx!.beginPath();
        ctx!.moveTo(sx, sy);
        ctx!.lineTo(ex, ey);
        ctx!.stroke();

        ctx!.restore();
      }
    }

    function loop() {
      update();
      draw();
      animId = requestAnimationFrame(loop);
    }

    // ── 事件绑定 ──
    const onMouseMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onMouseLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    const onTouchMove = (e: TouchEvent) => { const t = e.touches[0]; mouse.x = t.clientX; mouse.y = t.clientY; };
    const onTouchEnd = () => { mouse.x = -9999; mouse.y = -9999; };
    const onResize = () => { resize(); particles = createParticles(cubeSize, scatterR, isMobile); };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('resize', onResize);

    init();
    loop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', onResize);
    };
  }, [canvasRef]);
}

// ── i18n 文本映射 ────────────────────────────────────────────────────────
// NOTE: 原版 index.html 使用 data-i18n 属性 + i18n.js 全局翻译引擎
// React 版使用 react-i18next，这里手动定义文本对照（与原版对齐）
const TEXTS: Record<string, { en: string; zh: string }> = {
  brand:           { en: 'CubeRoot', zh: 'CubeRoot' },
  tagline:         { en: 'Solve. Train. Analyze.', zh: '解法 · 训练 · 分析' },
  solver:          { en: 'or18 Solver', zh: 'or18 求解器' },
  wcaStats:        { en: 'WCA Stats', zh: 'WCA 统计' },
  recon:           { en: 'Recon', zh: '复盘' },
  algTrainer:      { en: 'mihlefeld Trainer', zh: 'mihlefeld 训练器' },
  cuberootTrainer: { en: 'Trainer', zh: '训练器' },
  hthGrapher:      { en: 'Calculator', zh: '计算器' },
  battle:          { en: 'Battle', zh: '对战' },
  viz:             { en: 'Distribution', zh: '分布' },
  upcoming:        { en: 'Calendar', zh: '日历' },
  globe:           { en: 'Globe', zh: '地球' },
  cstimer:         { en: 'csTimer', zh: 'csTimer' },
  timer:           { en: 'Timer', zh: '计时器' },
  frameCount:      { en: 'Frame Count', zh: '数帧' },
  scramble:        { en: 'Scramble', zh: '打乱' },
  alg:             { en: 'Tutorial',   zh: '教程' },
  algdb:           { en: 'Algorithms', zh: '公式' },
  sitesDirectory:  { en: 'Web', zh: '网站' },
  mosaic:          { en: 'Mosaic', zh: '马赛克' },
  worldBests:      { en: 'World Bests', zh: '非官方纪录' },
  blog:            { en: 'Blog', zh: '博客' },
  prediction:      { en: 'Prediction', zh: '预测' },
  visualcubeEditor:{ en: 'VisualCube', zh: '魔方可视化' },
  analyze:         { en: 'Analyzer', zh: '打乱分析' },
  gen:             { en: 'Scrambles', zh: '生成打乱' },
  notation:        { en: 'Notation', zh: '记号沙盒' },
  memo:            { en: 'Memo', zh: '记忆' },
  code:            { en: 'Code', zh: '编程' },
  comingSoon:      { en: 'Coming soon', zh: '即将上线' },
  creditsPrefix:   { en: 'Inspired by', zh: '致谢' },
  // Section titles
  secTrain:        { en: 'Train',  zh: '训练' },
  secLearn:        { en: 'Learn',  zh: '学习' },
  secWca:          { en: 'Compete', zh: '比赛' },
  secTools:        { en: 'Tool',   zh: '工具' },
  secOther:        { en: 'Other',  zh: '其他' },
};

// ── 卡片配置 ──────────────────────────────────────────────────────────────
type Tier = 'hero' | 'hero-side' | 'medium' | 'standard' | 'utility';

interface CardConfig {
  id: string;
  /** 已迁移到 React 的模块用内部路由，否则为外部绝对路径 */
  href: string;
  internal: boolean;
  tier: Tier;
  /** Lucide 图标；Trainer 卡由 LandingCubeHero 接管，csTimer 用 iconImg */
  Icon?: LucideIcon;
  /** csTimer 使用图片 logo */
  iconImg?: string;
  nameKey: keyof typeof TEXTS;
  /** 即将上线：卡片灰显 + tooltip，不可点击 */
  comingSoon?: boolean;
}

// NOTE: 落地页按 5 大类分组渲染。每个 section 是独立 12 列 grid；
// 卡片 tier 调整成让每个 section 行尾对齐(标准卡 3 列 / medium 4 列 / hero-side 6 列 / hero 6 列 × 2 行)。
interface Section {
  titleKey: keyof typeof TEXTS;
  cards: CardConfig[];
}

const SECTIONS: Section[] = [
  {
    titleKey: 'secTrain',
    cards: [
      { id: 'cuberoot', href: '/trainer',      internal: true, tier: 'hero',     nameKey: 'cuberootTrainer' },
      { id: 'timer',    href: '/timer',        internal: true, tier: 'standard', Icon: TimerIcon, nameKey: 'timer', comingSoon: true },
      { id: 'battle',   href: '/battle',       internal: true, tier: 'standard', Icon: Swords,    nameKey: 'battle' },
      { id: 'memo',     href: '/memo',         internal: true, tier: 'standard', Icon: Brain,     nameKey: 'memo' },
      { id: 'trainer',  href: '/alg-trainers', internal: true, tier: 'standard', Icon: Target,    nameKey: 'algTrainer' },
      { id: 'cstimer',  href: '/cstimer',      internal: true, tier: 'utility',  nameKey: 'cstimer', iconImg: import.meta.env.BASE_URL + 'cstimer_logo.png' },
    ],
  },
  {
    titleKey: 'secLearn',
    cards: [
      { id: 'alg',      href: '/tutorial', internal: true, tier: 'medium', Icon: Library,    nameKey: 'alg', comingSoon: true },
      { id: 'algdb',    href: '/alg',      internal: true, tier: 'medium', Icon: BookMarked, nameKey: 'algdb' },
      { id: 'notation', href: '/notation', internal: true, tier: 'medium', Icon: Wand2,      nameKey: 'notation' },
    ],
  },
  {
    titleKey: 'secWca',
    cards: [
      { id: 'stats',      href: '/wca-stats',  internal: true, tier: 'hero-side', Icon: BarChart3,      nameKey: 'wcaStats' },
      { id: 'upcoming',   href: '/calendar',   internal: true, tier: 'standard',  Icon: CalendarDays,   nameKey: 'upcoming' },
      { id: 'globe',      href: '/globe',      internal: true, tier: 'standard',  Icon: GlobeIcon,      nameKey: 'globe' },
      { id: 'viz',        href: '/viz',        internal: true, tier: 'standard',  Icon: LineChart,      nameKey: 'viz' },
      { id: 'hth',        href: '/calc',       internal: true, tier: 'standard',  Icon: CalculatorIcon, nameKey: 'hthGrapher' },
      { id: 'wb',         href: '/wb',         internal: true, tier: 'standard',  Icon: Trophy,         nameKey: 'worldBests' },
      { id: 'prediction', href: '/prediction', internal: true, tier: 'standard',  Icon: TrendingDown,   nameKey: 'prediction' },
    ],
  },
  {
    titleKey: 'secTools',
    cards: [
      { id: 'recon',       href: '/recon',       internal: true, tier: 'medium', Icon: ScanSearch, nameKey: 'recon' },
      { id: 'frame-count', href: '/frame-count', internal: true, tier: 'medium', Icon: Film,       nameKey: 'frameCount' },
      { id: 'visualcube',  href: '/visualcube',  internal: true, tier: 'medium', Icon: ImagePlus,  nameKey: 'visualcubeEditor' },
      { id: 'scramble',    href: '/scramble',    internal: true, tier: 'medium', Icon: Shuffle,    nameKey: 'scramble' },
      { id: 'solver',      href: '/solver',      internal: true, tier: 'medium', Icon: Puzzle,     nameKey: 'solver' },
      { id: 'mosaic',      href: '/mosaic',      internal: true, tier: 'medium', Icon: Grid2x2,    nameKey: 'mosaic' },
    ],
  },
  {
    titleKey: 'secOther',
    cards: [
      { id: 'code', href: '/code', internal: true, tier: 'medium', Icon: CodeIcon, nameKey: 'code' },
      { id: 'blog', href: 'https://blog.cuberoot.me/', internal: false, tier: 'medium', Icon: BookOpen, nameKey: 'blog' },
      { id: 'site', href: '/site', internal: true, tier: 'medium', Icon: Compass,  nameKey: 'sitesDirectory' },
    ],
  },
];

// ── 组件 ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { i18n } = useTranslation();
  const [donateOpen, setDonateOpen] = useState(false);

  useParticles(SHOW_PARTICLES ? canvasRef : { current: null });

  // NOTE: 当前语言
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';

  /** 文本获取 helper */
  const t = useCallback((key: keyof typeof TEXTS) => {
    return TEXTS[key][lang];
  }, [lang]);

  /** 语言切换 — 与原版 I18n.toggle() 行为一致 */
  const toggleLang = useCallback(() => {
    const newLang = lang === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
    localStorage.setItem('trainer-lang', newLang);
  }, [lang, i18n]);



  return (
    <div className="landing-page">
      {/* NOTE: 粒子动画 Canvas — SHOW_PARTICLES=true 时才挂载（当前关闭） */}
      {SHOW_PARTICLES && (
        <canvas
          ref={canvasRef}
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
        />
      )}

      {/* NOTE: 右上角 cluster — WCA 登录 + 语言 + 主题 */}
      <div className="global-corner">
        <WcaAuth />
        <button className="lang-toggle" onClick={toggleLang} title={lang === 'zh' ? '切换为 English' : 'Switch to 中文'} aria-label={lang === 'zh' ? '中文' : 'English'}>
          <Flag iso2={lang === 'zh' ? 'cn' : 'us'} className="lang-flag" />
        </button>
        <ThemeToggle />
      </div>

      <div className="brand-line">
        <img src="/icons/CubeRoot.png" alt="" className="brand-logo" />
        <span className="brand-name">{t('brand')}</span>
      </div>
      <h1 className="landing-tagline">{t('tagline')}</h1>

      <div className="cards-sections">
        {SECTIONS.map((sec) => (
          <section key={sec.titleKey} className="cards-section">
            <h2 className="section-title">{t(sec.titleKey)}</h2>
            <div className="cards-container">
              {sec.cards.map((card) => {
                const iconSize = card.tier === 'hero-side' ? 32
                  : card.tier === 'medium' ? 28
                  : card.tier === 'utility' ? 20
                  : 24;
                const content = (
                  <>
                    <div className="card-icon">
                      {card.tier === 'hero'
                        ? <LandingCubeHero />
                        : card.iconImg
                          ? <img src={card.iconImg} alt={`${t(card.nameKey)} Logo`} className="cstimer-logo" />
                          : card.Icon
                            ? <card.Icon size={iconSize} strokeWidth={1.5} />
                            : null}
                    </div>
                    <div className="card-name">{t(card.nameKey)}</div>
                  </>
                );
                const className = `card tier-${card.tier}${card.comingSoon ? ' is-disabled' : ''}`;
                if (card.comingSoon) {
                  return (
                    <div key={card.id} className={className} id={`card-${card.id}`}
                      title={t('comingSoon')} aria-disabled="true" role="link">
                      {content}
                      <span className="coming-soon-badge">{t('comingSoon')}</span>
                    </div>
                  );
                }
                if (card.internal) {
                  return (
                    <Link key={card.id} to={card.href} className={className} id={`card-${card.id}`}>
                      {content}
                    </Link>
                  );
                }
                return (
                  <a key={card.id} href={card.href} className={className} id={`card-${card.id}`}
                    target="_blank" rel="noopener noreferrer">
                    {content}
                  </a>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* NOTE: 致谢：列出上游开源项目作者 */}
      <div className="credits">
        <span>{t('creditsPrefix')}</span>{' '}
        <a href="https://github.com/or18/RubiksSolverDemo" target="_blank" rel="noopener noreferrer">or18</a> ·{' '}
        <a href="https://github.com/jonatanklosko/wca_statistics" target="_blank" rel="noopener noreferrer">jonatanklosko</a> ·{' '}
        <a href="https://github.com/mihlefeld/Alg-Trainers" target="_blank" rel="noopener noreferrer">mihlefeld</a> ·{' '}
        <a href="https://github.com/carykh/hthgrapher" target="_blank" rel="noopener noreferrer">carykh</a> ·{' '}
        <a href="https://github.com/MatteoColombo/cube_challenge_timer" target="_blank" rel="noopener noreferrer">MatteoColombo</a> ·{' '}
        <a href="https://github.com/cs0x7f/cstimer" target="_blank" rel="noopener noreferrer">cs0x7f</a> ·{' '}
        <a href="https://github.com/MeigenChou/DCTimer-Android" target="_blank" rel="noopener noreferrer">MeigenChou</a> ·{' '}
        <a href="https://github.com/Roman-/mosaic" target="_blank" rel="noopener noreferrer">Roman-</a> ·{' '}
        <a href="https://nemesizer.com" target="_blank" rel="noopener noreferrer">nemesizer.com</a> ·{' '}
        <a href="https://cubing.pro/" target="_blank" rel="noopener noreferrer">cubing.pro</a> ·{' '}
        <a href="https://github.com/tdecker91/puzzle-gen" target="_blank" rel="noopener noreferrer">tdecker91</a> ·{' '}
        <a href="https://github.com/nbwzx/commutator" target="_blank" rel="noopener noreferrer">nbwzx</a>
      </div>

      <div className="footer">
        <a
          href="https://github.com/RuiminYan/cuberoot.me"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-github"
        >
          {/* NOTE: GitHub 品牌图标 — lucide-react 已移除品牌图标，改用 inline SVG（Simple Icons） */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
          </svg>
          <span>GitHub</span>
        </a>

        <button
          className="footer-donate"
          onClick={() => setDonateOpen(true)}
          title={lang === 'zh' ? '赞助' : 'Donate'}
        >
          <Heart size={14} strokeWidth={1.8} />
          <span>{lang === 'zh' ? '赞助' : 'Donate'}</span>
        </button>
      </div>

      {/* NOTE: 中国 ICP / 公安备案 — 仅在 cuberoot.me 域名（备案绑定该域名）和本地 dev 显示。
          其他域名（GitHub Pages 直接 URL 等）无需中国备案，不显示。 */}
      {(() => {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        const onCuberootMe = /(^|\.)cuberoot\.me$/i.test(hostname);
        const onLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
        if (!onCuberootMe && !onLocalhost) return null;
        return (
          <div className="beian">
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
              沪ICP备2025130431号
            </a>
            <span className="beian-sep">|</span>
            <a
              href="https://beian.mps.gov.cn/#/query/webSearch?code=31010902100930"
              target="_blank"
              rel="noopener noreferrer"
              className="beian-mps"
            >
              <img src="/beian-badge.png" alt="" width="14" height="14" />
              沪公网安备31010902100930号
            </a>
          </div>
        );
      })()}

      {donateOpen && <DonateModal lang={lang} onClose={() => setDonateOpen(false)} />}
    </div>
  );
}
