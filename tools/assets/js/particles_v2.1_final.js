/**
 * 3D 球壳粒子系统 v2.1
 *
 * v2.0 → v2.1 变更:
 * - 去除全局统一 Y/Z 旋转（导致明显机械顺时针转动）
 * - 改为每个粒子独立旋转参数：独立轴倾角、独立速度、随机正/反方向
 * - 宏观效果：有机悬浮漂移，无统一旋转方向
 */

(function () {
    'use strict';

    const canvas = document.getElementById('particles-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // ── 配置 ─────────────────────────────────────────────
    const COUNT_PC = 1200;
    const COUNT_MOBILE = 400;
    const COLORS = ['#EA4335', '#FBBC05', '#34A853', '#4285F4'];

    // NOTE: 球壳半径基于视口宽高均值动态计算，适配超宽屏
    const R_INNER_RATIO = 0.15;
    const R_OUTER_RATIO = 0.5;
    const FOV = 800;
    const SPRING_K = 0.05;
    const FRICTION = 0.9;
    const MOUSE_RADIUS = 250;
    const MOUSE_FORCE = 15;
    const TRAIL_SCALE = 2;
    const DEPTH_NEAR = -400;
    const DEPTH_FAR = 400;

    // NOTE: 每个粒子独立旋转的速度范围 (rad/帧)
    // 值很小 → 缓慢漂浮；正负随机 → CW/CCW 混合
    const ROT_SPEED_MIN = 0.0003;
    const ROT_SPEED_MAX = 0.002;

    /** 将 hex 颜色混入白色，t=0 原色，t=1 纯白 */
    function lightenColor(hex, t) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const lr = Math.round(r + (255 - r) * t);
        const lg = Math.round(g + (255 - g) * t);
        const lb = Math.round(b + (255 - b) * t);
        return `rgb(${lr},${lg},${lb})`;
    }

    let particles = [];
    let mouse = { x: -9999, y: -9999 };
    let w, h, dpr;
    let INNER_R, OUTER_R;  // 动态计算的球壳半径

    // ── 旋转辅助 ─────────────────────────────────────────

    /** 绕任意轴 (ux,uy,uz) 旋转角度 a 的 Rodrigues 公式 */
    function rotateAroundAxis(x, y, z, ux, uy, uz, a) {
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const dot = x * ux + y * uy + z * uz;
        // NOTE: Rodrigues: v' = v·cosA + (k×v)·sinA + k·(k·v)·(1-cosA)
        return {
            x: x * cos + (uy * z - uz * y) * sin + ux * dot * (1 - cos),
            y: y * cos + (uz * x - ux * z) * sin + uy * dot * (1 - cos),
            z: z * cos + (ux * y - uy * x) * sin + uz * dot * (1 - cos),
        };
    }

    /** 生成随机单位向量（均匀球面分布），作为旋转轴 */
    function randomAxis() {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        return {
            x: Math.sin(phi) * Math.cos(theta),
            y: Math.sin(phi) * Math.sin(theta),
            z: Math.cos(phi),
        };
    }

    // ── 初始化 ────────────────────────────────────────────
    function getCount() {
        return window.innerWidth < 768 ? COUNT_MOBILE : COUNT_PC;
    }

    function resize() {
        dpr = window.devicePixelRatio || 1;
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // NOTE: 球壳半径基于宽高均值，超宽屏不会太小
        const avgDim = (w + h) / 2;
        INNER_R = avgDim * R_INNER_RATIO;
        OUTER_R = avgDim * R_OUTER_RATIO;
    }

    function createParticle() {
        // 球壳分布
        const ci = Math.floor(Math.random() * COLORS.length);
        // NOTE: 同色系渐变——头部原色，尾部混入白色的浅色版
        const base = COLORS[ci];
        const light = lightenColor(base, 0.4);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = INNER_R + Math.random() * (OUTER_R - INNER_R);
        const bx = r * Math.sin(phi) * Math.cos(theta);
        const by = r * Math.sin(phi) * Math.sin(theta);
        const bz = r * Math.cos(phi);

        // NOTE: 独立旋转参数——每个粒子有自己的旋转轴和速度
        const axis = randomAxis();
        const speed = ROT_SPEED_MIN + Math.random() * (ROT_SPEED_MAX - ROT_SPEED_MIN);
        // 随机正/反方向（50% CW, 50% CCW）
        const dir = Math.random() > 0.5 ? 1 : -1;

        return {
            baseX: bx, baseY: by, baseZ: bz,
            x: bx, y: by, z: bz,
            vx: 0, vy: 0, vz: 0,
            // NOTE: 同色系渐变
            color1: base,
            color2: light,
            baseSize: 1 + Math.random() * 1.5,
            // 独立旋转
            axisX: axis.x, axisY: axis.y, axisZ: axis.z,
            rotSpeed: speed * dir,
        };
    }

    function init() {
        resize();
        particles = [];
        const count = getCount();
        for (let i = 0; i < count; i++) particles.push(createParticle());
    }

    // ── 物理更新 ──────────────────────────────────────────
    function getMouseWorld() {
        return { x: mouse.x - w / 2, y: mouse.y - h / 2, z: 0 };
    }

    function update() {
        const mw = getMouseWorld();

        for (const p of particles) {
            // 1. 独立自转——每个粒子绕自己的随机轴旋转
            const rotated = rotateAroundAxis(
                p.baseX, p.baseY, p.baseZ,
                p.axisX, p.axisY, p.axisZ,
                p.rotSpeed
            );
            p.baseX = rotated.x;
            p.baseY = rotated.y;
            p.baseZ = rotated.z;

            // 2. 鼠标 3D 排斥
            const dx = p.x - mw.x;
            const dy = p.y - mw.y;
            const dz = p.z - mw.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
            if (dist < MOUSE_RADIUS) {
                const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE;
                p.vx += (dx / dist) * force;
                p.vy += (dy / dist) * force;
                p.vz += (dz / dist) * force;
            }

            // 3. 弹簧恢复力
            p.vx += (p.baseX - p.x) * SPRING_K;
            p.vy += (p.baseY - p.y) * SPRING_K;
            p.vz += (p.baseZ - p.z) * SPRING_K;

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

    // ── 渲染 ──────────────────────────────────────────────
    function draw() {
        ctx.clearRect(0, 0, w, h);
        const hw = w / 2;
        const hh = h / 2;

        // NOTE: Z 排序——远处先画
        particles.sort((a, b) => b.z - a.z);

        for (const p of particles) {
            const scale = FOV / (FOV + p.z);
            if (scale <= 0) continue;

            const sx = p.x * scale + hw;
            const sy = p.y * scale + hh;

            // 景深透明度
            const depthRange = DEPTH_FAR - DEPTH_NEAR;
            const depthNorm = Math.max(0, Math.min(1, (p.z - DEPTH_NEAR) / depthRange));
            const alpha = 1.0 - depthNorm * 0.85;

            // 速度 2D 投影
            const pvx = p.vx * scale;
            const pvy = p.vy * scale;
            const lw = p.baseSize * scale;

            ctx.save();
            ctx.globalAlpha = alpha;
            // NOTE: 沿速度方向的渐变线段
            const ex = sx - pvx * TRAIL_SCALE;
            const ey = sy - pvy * TRAIL_SCALE;
            const grad = ctx.createLinearGradient(sx, sy, ex, ey);
            grad.addColorStop(0, p.color1);
            grad.addColorStop(1, p.color2);
            ctx.strokeStyle = grad;
            ctx.lineWidth = Math.max(lw, 0.5);
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
            ctx.stroke();

            ctx.restore();
        }
    }

    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }

    // ── 事件 ──────────────────────────────────────────────
    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    window.addEventListener('mouseleave', () => {
        mouse.x = -9999;
        mouse.y = -9999;
    });

    window.addEventListener('resize', () => {
        resize();
        // NOTE: 球壳半径已变化，重建所有粒子
        init();
    });

    init();
    loop();
})();
