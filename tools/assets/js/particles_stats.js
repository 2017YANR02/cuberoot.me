/**
 * Stats 页面粒子系统（基于 v2.1 球壳效果）
 *
 * 与首页魔方粒子分开，使用更低调的参数：
 * - 粒子数更少、球壳更小、旋转更慢
 * - 独立旋转 + 鼠标排斥 + 弹簧恢复
 */

(function () {
    'use strict';

    const canvas = document.getElementById('particles-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // NOTE: stats 页参数比首页更低调
    const isMobile = window.innerWidth < 768;
    const COUNT_PC = 600;
    const COUNT_MOBILE = 250;
    const COLORS = ['#EA4335', '#FBBC05', '#34A853', '#4285F4'];

    const R_INNER_RATIO = 0.12;
    const R_OUTER_RATIO = 0.4;
    const FOV = 800;
    const SPRING_K = 0.05;
    const FRICTION = 0.9;
    const MOUSE_RADIUS = 200;
    const MOUSE_FORCE = 12;
    const TRAIL_SCALE = 1.2;
    const DEPTH_NEAR = -400;
    const DEPTH_FAR = 400;

    const ROT_SPEED_MIN = 0.0002;
    const ROT_SPEED_MAX = 0.0015;

    function lightenColor(hex, t) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgb(${Math.round(r + (255 - r) * t)},${Math.round(g + (255 - g) * t)},${Math.round(b + (255 - b) * t)})`;
    }

    let particles = [];
    let mouse = { x: -9999, y: -9999 };
    let w, h, dpr;
    let INNER_R, OUTER_R;

    function rotateAroundAxis(x, y, z, ux, uy, uz, a) {
        const cos = Math.cos(a), sin = Math.sin(a);
        const dot = x * ux + y * uy + z * uz;
        return {
            x: x * cos + (uy * z - uz * y) * sin + ux * dot * (1 - cos),
            y: y * cos + (uz * x - ux * z) * sin + uy * dot * (1 - cos),
            z: z * cos + (ux * y - uy * x) * sin + uz * dot * (1 - cos),
        };
    }

    function randomAxis() {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        return {
            x: Math.sin(phi) * Math.cos(theta),
            y: Math.sin(phi) * Math.sin(theta),
            z: Math.cos(phi),
        };
    }

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
        const avgDim = (w + h) / 2;
        INNER_R = avgDim * R_INNER_RATIO;
        OUTER_R = avgDim * R_OUTER_RATIO;
    }

    function createParticle() {
        const ci = Math.floor(Math.random() * COLORS.length);
        const base = COLORS[ci];
        const light = lightenColor(base, 0.4);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = INNER_R + Math.random() * (OUTER_R - INNER_R);
        const bx = r * Math.sin(phi) * Math.cos(theta);
        const by = r * Math.sin(phi) * Math.sin(theta);
        const bz = r * Math.cos(phi);

        const axis = randomAxis();
        const speed = ROT_SPEED_MIN + Math.random() * (ROT_SPEED_MAX - ROT_SPEED_MIN);
        const dir = Math.random() > 0.5 ? 1 : -1;

        return {
            baseX: bx, baseY: by, baseZ: bz,
            x: bx, y: by, z: bz,
            vx: 0, vy: 0, vz: 0,
            color1: base, color2: light,
            baseSize: 1 + Math.random() * 1.5,
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

    function getMouseWorld() {
        return { x: mouse.x - w / 2, y: mouse.y - h / 2, z: 0 };
    }

    function update() {
        const mw = getMouseWorld();
        for (const p of particles) {
            const rotated = rotateAroundAxis(
                p.baseX, p.baseY, p.baseZ,
                p.axisX, p.axisY, p.axisZ, p.rotSpeed
            );
            p.baseX = rotated.x; p.baseY = rotated.y; p.baseZ = rotated.z;

            const dx = p.x - mw.x, dy = p.y - mw.y, dz = p.z - mw.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
            if (dist < MOUSE_RADIUS) {
                const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE;
                p.vx += (dx / dist) * force;
                p.vy += (dy / dist) * force;
                p.vz += (dz / dist) * force;
            }

            p.vx += (p.baseX - p.x) * SPRING_K;
            p.vy += (p.baseY - p.y) * SPRING_K;
            p.vz += (p.baseZ - p.z) * SPRING_K;
            p.vx *= FRICTION; p.vy *= FRICTION; p.vz *= FRICTION;
            p.x += p.vx; p.y += p.vy; p.z += p.vz;
        }
    }

    function draw() {
        ctx.clearRect(0, 0, w, h);
        const hw = w / 2, hh = h / 2;
        particles.sort((a, b) => b.z - a.z);

        for (const p of particles) {
            const scale = FOV / (FOV + p.z);
            if (scale <= 0) continue;
            const sx = p.x * scale + hw;
            const sy = p.y * scale + hh;

            const depthNorm = Math.max(0, Math.min(1, (p.z - DEPTH_NEAR) / (DEPTH_FAR - DEPTH_NEAR)));
            const alpha = 1.0 - depthNorm * 0.85;
            const pvx = p.vx * scale, pvy = p.vy * scale;
            const lw = p.baseSize * scale;

            ctx.save();
            ctx.globalAlpha = alpha;
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

    function loop() { update(); draw(); requestAnimationFrame(loop); }

    // ── 事件 ──────────────────────────────────────────────
    window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
    window.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });
    window.addEventListener('resize', () => { resize(); init(); });

    // NOTE: 触摸事件——手机端
    window.addEventListener('touchmove', (e) => {
        mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY;
    }, { passive: true });
    window.addEventListener('touchend', () => { mouse.x = -9999; mouse.y = -9999; });

    init();
    loop();
})();
