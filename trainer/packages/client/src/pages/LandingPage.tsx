/**
 * Toolkit 全站入口页
 * NOTE: 从原版 index.html 1:1 复刻，包含粒子系统、WCA 登录、9 卡片、语言切换、致谢
 */
import { useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/auth_store';
import './landing.css';

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
  title:           { en: "Rubik's Cube Toolkit", zh: '魔方工具箱' },
  subtitle:        { en: 'Solvers, trainers, and statistics', zh: '求解器、训练器与统计' },
  solver:          { en: 'Solver', zh: '求解器' },
  solverDesc:      { en: 'Cross, XCross, EOCross, Free Pair, Pseudo F2L, Last Layer, and trainers', zh: 'Cross、XCross、EOCross、Free Pair、Pseudo F2L、Last Layer 训练器' },
  wcaStats:        { en: 'WCA Stats', zh: 'WCA 统计' },
  statsDesc:       { en: '60+ statistics from the WCA database, updated weekly', zh: '60+ 项 WCA 数据库统计，每周更新' },
  recon:           { en: 'Recon', zh: '复盘' },
  reconDesc:       { en: 'Competition solve reconstructions and analysis', zh: '比赛还原复盘与分析' },
  algTrainer:      { en: 'Alg Trainer', zh: '公式训练器' },
  algTrainerDesc:  { en: 'OLL, PLL, ZBLL, CMLL, and algorithm trainers for various puzzles', zh: 'OLL、PLL、ZBLL、CMLL 等各类魔方公式训练器' },
  cuberootTrainer:     { en: 'Trainer', zh: '训练器' },
  cuberootTrainerDesc: { en: 'PLL, OLL, ZBLL, ZBLS recognition trainers with adaptive queue', zh: 'PLL、OLL、ZBLL、ZBLS 公式识别训练，自适应队列' },
  hthGrapher:      { en: 'Score Calculator', zh: '成绩计算器' },
  hthGrapherDesc:  { en: 'Compare final round results and visualize WPA/BPA for WCA competitions', zh: '对比决赛成绩，可视化 WCA 比赛的 WPA/BPA' },
  battle:          { en: '1v1 Battle', zh: '1v1 对战' },
  battleDesc:      { en: 'Head-to-head cube battle timer, challenge your friends face to face', zh: '面对面魔方对战计时器，挑战你的朋友' },
  viz:             { en: 'Distribution', zh: '分布演变' },
  vizDesc:         { en: 'Visualize how solve time distributions evolve over competitions, compare multiple cubers', zh: '可视化复原时间分布随比赛的演变，对比多位选手' },
  upcoming:        { en: 'Upcoming Comps', zh: '近期比赛' },
  upcomingDesc:    { en: "Track top cubers' upcoming WCA competitions with WR badges", zh: '追踪顶尖选手的近期 WCA 比赛与 WR 标记' },
  cstimer:         { en: 'csTimer', zh: 'csTimer' },
  cstimerDesc:     { en: 'Professional speedcubing timer with statistics, scrambles, and session management', zh: '专业速拧计时器，含统计、打乱与成绩管理' },
  creditsPrefix:   { en: 'Inspired by open-source projects from', zh: '致谢' },
};

// ── 卡片配置 ──────────────────────────────────────────────────────────────
interface CardConfig {
  id: string;
  /** 已迁移到 React 的模块用内部路由，否则为外部绝对路径 */
  href: string;
  internal: boolean;
  cssClass: string;
  icon: string;
  /** csTimer 使用图片 logo */
  iconImg?: string;
  nameKey: keyof typeof TEXTS;
  descKey: keyof typeof TEXTS;
}

const CARDS: CardConfig[] = [
  { id: 'solver',   href: '/solver',              internal: true,  cssClass: 'card-solver',   icon: '🧩', nameKey: 'solver',     descKey: 'solverDesc' },
  { id: 'stats',    href: '/wca-stats',            internal: true,  cssClass: 'card-stats',    icon: '📊', nameKey: 'wcaStats',   descKey: 'statsDesc' },
  { id: 'recon',    href: '/recon',               internal: true,  cssClass: 'card-recon',    icon: '🔍', nameKey: 'recon',      descKey: 'reconDesc' },
  { id: 'trainer',  href: '/alg-trainers',         internal: true,  cssClass: 'card-trainer',  icon: '🎯', nameKey: 'algTrainer', descKey: 'algTrainerDesc' },
  { id: 'cuberoot', href: '/trainer',              internal: true,  cssClass: 'card-cuberoot', icon: '🧊', nameKey: 'cuberootTrainer', descKey: 'cuberootTrainerDesc' },
  { id: 'hth',      href: '/calc',                internal: true,  cssClass: 'card-hth',      icon: '🧮', nameKey: 'hthGrapher', descKey: 'hthGrapherDesc' },
  { id: 'battle',   href: '/battle',              internal: true,  cssClass: 'card-battle',   icon: '⚔️', nameKey: 'battle',     descKey: 'battleDesc' },
  { id: 'viz',      href: '/viz',                 internal: true,  cssClass: 'card-viz',      icon: '📈', nameKey: 'viz',        descKey: 'vizDesc' },
  { id: 'upcoming', href: '/upcoming-comps',        internal: true,  cssClass: 'card-upcoming', icon: '🏅', nameKey: 'upcoming',   descKey: 'upcomingDesc' },
  { id: 'cstimer',  href: '/cstimer',             internal: true,  cssClass: 'card-cstimer',  icon: '',   nameKey: 'cstimer',    descKey: 'cstimerDesc', iconImg: import.meta.env.BASE_URL + 'cstimer_logo.png' },
];

// ── 组件 ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);

  useParticles(canvasRef);

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

  /** csTimer 链接：中文时追加 ?lang=zh-cn */
  const cstimerHref = lang === 'zh' ? '/cstimer/?lang=zh-cn' : '/cstimer/';

  return (
    <div className="landing-page">
      {/* NOTE: 粒子动画背景 Canvas，全屏覆盖但不拦截点击 */}
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
      />

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

      <h1 className="landing-title">{t('title')}</h1>
      <p className="landing-subtitle">{t('subtitle')}</p>

      <div className="cards-container">
        {CARDS.map((card) => {
          const href = card.id === 'cstimer' ? cstimerHref : card.href;
          const content = (
            <>
              <div className="card-icon">
                {card.iconImg
                  ? <img src={card.iconImg} alt={`${t(card.nameKey)} Logo`} className="cstimer-logo" />
                  : card.icon}
              </div>
              <div className="card-name">{t(card.nameKey)}</div>
              <div className="card-desc">{t(card.descKey)}</div>
            </>
          );

          // NOTE: 已迁移模块用 React Router Link（SPA 导航），未迁移模块用 <a>（跳转 Jekyll 路径）
          if (card.internal) {
            return (
              <Link
                key={card.id}
                to={href}
                className={`glass-card card ${card.cssClass}`}
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
              className={`glass-card card ${card.cssClass}`}
              id={`card-${card.id}`}
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
