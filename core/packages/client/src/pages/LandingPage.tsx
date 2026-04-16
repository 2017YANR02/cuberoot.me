/**
 * Toolkit 全站入口页
 * NOTE: 粒子动画代码保留但不挂载（SHOW_PARTICLES=false），方便将来复用
 */
import { useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/auth_store';
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
  solver:          { en: 'Solver', zh: '求解器' },
  wcaStats:        { en: 'WCA Stats', zh: 'WCA 统计' },
  recon:           { en: 'Recon', zh: '复盘' },
  algTrainer:      { en: 'Alg Trainer', zh: '公式训练器' },
  cuberootTrainer: { en: 'Trainer', zh: '训练器' },
  hthGrapher:      { en: 'Score Calculator', zh: '成绩计算器' },
  battle:          { en: '1v1 Battle', zh: '1v1 对战' },
  viz:             { en: 'Distribution', zh: '分布演变' },
  upcoming:        { en: 'Upcoming Comps', zh: '近期比赛' },
  cstimer:         { en: 'csTimer', zh: 'csTimer' },
  frameCount:      { en: 'Frame Count', zh: '数帧工具' },
  blog:            { en: 'Blog', zh: '博客' },
  creditsPrefix:   { en: 'Inspired by open-source projects from', zh: '致谢' },
};

// ── 卡片配置 ──────────────────────────────────────────────────────────────
interface CardConfig {
  id: string;
  /** 已迁移到 React 的模块用内部路由，否则为外部绝对路径 */
  href: string;
  internal: boolean;
  icon: string;
  /** csTimer 使用图片 logo */
  iconImg?: string;
  nameKey: keyof typeof TEXTS;
}

const CARDS: CardConfig[] = [
  { id: 'solver',   href: '/solver',              internal: true,  icon: '🧩', nameKey: 'solver' },
  { id: 'stats',    href: '/wca-stats',           internal: true,  icon: '📊', nameKey: 'wcaStats' },
  { id: 'recon',    href: '/recon',               internal: true,  icon: '🔍', nameKey: 'recon' },
  { id: 'trainer',  href: '/alg-trainers',        internal: true,  icon: '🎯', nameKey: 'algTrainer' },
  { id: 'cuberoot', href: '/trainer',             internal: true,  icon: '🧊', nameKey: 'cuberootTrainer' },
  { id: 'hth',      href: '/calc',                internal: true,  icon: '🧮', nameKey: 'hthGrapher' },
  { id: 'battle',   href: '/battle',              internal: true,  icon: '⚔️', nameKey: 'battle' },
  { id: 'frame-count', href: '/frame-count',      internal: true,  icon: '🎬', nameKey: 'frameCount' },
  { id: 'viz',      href: '/viz',                 internal: true,  icon: '📈', nameKey: 'viz' },
  { id: 'upcoming', href: '/upcoming-comps',      internal: true,  icon: '🏅', nameKey: 'upcoming' },
  { id: 'cstimer',  href: '/cstimer',             internal: true,  icon: '',   nameKey: 'cstimer', iconImg: import.meta.env.BASE_URL + 'cstimer_logo.png' },
  { id: 'blog',     href: window.location.hostname.endsWith('cuberoot.me') ? '/blog/' : 'https://www.cuberoot.me/blog/', internal: false, icon: '📝', nameKey: 'blog' },
];

// ── 组件 ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);

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

      {/* NOTE: 全局 WCA 登录区域（左上角） */}
      <div className="global-auth">
        {user ? (
          <div className="global-user">
            <img
              className="global-avatar"
              src={user.avatar || ''}
              alt=""
              title={user.name || user.wcaId}
            />
            <button
              className="global-logout"
              onClick={() => { logout(); location.reload(); }}
              title="Logout"
            >
              ❌
            </button>
          </div>
        ) : (
          <button className="global-auth-btn" onClick={login}>
            🔐 Login
          </button>
        )}
      </div>

      {/* NOTE: GitHub Corner 角标 */}
      <a
        href="https://github.com/RuiminYan/ruiminyan.github.io"
        className="github-corner"
        aria-label="View source on Github"
      >
        <svg width="80" height="80" viewBox="0 0 250 250" aria-hidden="true">
          <path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z" />
          <path
            d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2"
            fill="currentColor"
            style={{ transformOrigin: '130px 106px' }}
            className="octo-arm"
          />
          <path
            d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z"
            fill="currentColor"
            className="octo-body"
          />
        </svg>
      </a>

      <div className="brand-line">
        <img src="/icons/CubeRoot.png" alt="" className="brand-logo" />
        <span className="brand-name">{t('brand')}</span>
      </div>
      <h1 className="landing-tagline">{t('tagline')}</h1>

      <div className="cards-container">
        {CARDS.map((card) => {
          const href = card.href;
          const content = (
            <>
              <div className="card-icon">
                {card.iconImg
                  ? <img src={card.iconImg} alt={`${t(card.nameKey)} Logo`} className="cstimer-logo" />
                  : card.icon}
              </div>
              <div className="card-name">{t(card.nameKey)}</div>
            </>
          );

          // NOTE: 已迁移模块用 React Router Link（SPA 导航），未迁移模块用 <a>（跳转 legacy/ 路径）
          if (card.internal) {
            return (
              <Link
                key={card.id}
                to={href}
                className="card"
                id={`card-${card.id}`}
              >
                {content}
              </Link>
            );
          }
          return (
            <a
              key={card.id}
              href={href}
              className="card"
              id={`card-${card.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {content}
            </a>
          );
        })}
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
        <a href="https://github.com/MeigenChou/DCTimer-Android" target="_blank" rel="noopener noreferrer">MeigenChou</a>
      </div>

      <div className="footer">
        <span>v1.4.1</span>
        <a href="https://github.com/RuiminYan/ruiminyan.github.io" target="_blank" rel="noopener noreferrer">GitHub</a>

        <button className="lang-toggle" onClick={toggleLang}>
          <span className="globe-icon">🌐</span>
          <span className="lang-label">{lang === 'zh' ? 'English' : '中文'}</span>
        </button>
      </div>
    </div>
  );
}
