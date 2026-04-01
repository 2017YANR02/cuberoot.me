/**
 * 魔方主题粒子系统 v3.0
 *
 * 粒子聚合成旋转的 3D 魔方轮廓
 * 鼠标靠近时爆炸散开成球壳，移开后重新聚合
 *
 * 物理模型: v += (base - pos) * springK; v *= friction
 * base 在 cubePos 和 scatterPos 之间根据鼠标距离 lerp
 */

(function () {
    'use strict';

    const canvas = document.getElementById('particles-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // ── 配置 ─────────────────────────────────────────────
    const isMobile = window.innerWidth < 768;
    const PARTICLES_PER_FACE = isMobile ? 100 : 200;
    const TOTAL = PARTICLES_PER_FACE * 6;

    // NOTE: 标准魔方 6 面配色（面法线方向 → 颜色）
    const FACE_COLORS = [
        { normal: [0, 1, 0], color: '#FFFFFF', light: '#FFFFFF' }, // U 白
        { normal: [0, -1, 0], color: '#FFD500', light: '#FFE566' }, // D 黄
        { normal: [0, 0, 1], color: '#B71234', light: '#D44A5E' }, // F 红
        { normal: [0, 0, -1], color: '#FF5800', light: '#FF8844' }, // B 橙
        { normal: [-1, 0, 0], color: '#009B48', light: '#33C070' }, // L 绿
        { normal: [1, 0, 0], color: '#0046AD', light: '#3377CC' }, // R 蓝
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

    /** 将 hex 颜色混入白色 */
    function lightenColor(hex, t) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgb(${Math.round(r + (255 - r) * t)},${Math.round(g + (255 - g) * t)},${Math.round(b + (255 - b) * t)})`;
    }

    let particles = [];
    let mouse = { x: -9999, y: -9999 };
    let w, h, dpr;
    let cubeSize, scatterR;
    // NOTE: 全局旋转角（累积）
    let globalRotY = 0;
    let globalRotX = 0;
    // NOTE: 爆炸程度 0=聚合 1=完全爆炸，平滑过渡
    let explodeAmount = 0;

    // ── 旋转辅助 ─────────────────────────────────────────

    function rotateY(x, y, z, a) {
        const c = Math.cos(a), s = Math.sin(a);
        return { x: x * c + z * s, y, z: -x * s + z * c };
    }

    function rotateX(x, y, z, a) {
        const c = Math.cos(a), s = Math.sin(a);
        return { x, y: y * c - z * s, z: y * s + z * c };
    }

    // ── 初始化 ────────────────────────────────────────────
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
        cubeSize = avgDim * SIZE_RATIO;
        scatterR = avgDim * SCATTER_RATIO;
    }

    /** 在魔方某一面上生成随机点 */
    function facePoint(normalAxis, halfSize) {
        // normalAxis: 0=X, 1=Y, 2=Z
        // 在另外两个轴上随机，法线轴固定在 +halfSize 或 -halfSize
        const coords = [0, 0, 0];
        const axes = [0, 1, 2].filter(a => a !== Math.abs(normalAxis));
        coords[axes[0]] = (Math.random() - 0.5) * 2 * halfSize;
        coords[axes[1]] = (Math.random() - 0.5) * 2 * halfSize;
        coords[Math.abs(normalAxis)] = normalAxis >= 0 ? halfSize : -halfSize;
        return { x: coords[0], y: coords[1], z: coords[2] };
    }

    /** 在球壳上生成随机点 */
    function spherePoint(innerR, outerR) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = innerR + Math.random() * (outerR - innerR);
        return {
            x: r * Math.sin(phi) * Math.cos(theta),
            y: r * Math.sin(phi) * Math.sin(theta),
            z: r * Math.cos(phi),
        };
    }

    function createParticles() {
        particles = [];
        const half = cubeSize;

        for (let fi = 0; fi < 6; fi++) {
            const face = FACE_COLORS[fi];
            const [nx, ny, nz] = face.normal;

            for (let i = 0; i < PARTICLES_PER_FACE; i++) {
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

                // 爆炸后的球壳散布位置
                const sp = spherePoint(cubeSize * 0.8, scatterR);

                particles.push({
                    // 魔方位置（会随全局旋转而变化）
                    cubeX: cp.x, cubeY: cp.y, cubeZ: cp.z,
                    // 散布位置
                    scatX: sp.x, scatY: sp.y, scatZ: sp.z,
                    // 当前位置
                    x: cp.x, y: cp.y, z: cp.z,
                    vx: 0, vy: 0, vz: 0,
                    color1: face.color,
                    color2: face.light,
                    baseSize: 1.2 + Math.random() * 1.5,
                });
            }
        }
    }

    function init() {
        resize();
        createParticles();
    }

    // ── 物理更新 ──────────────────────────────────────────
    function getMouseWorld() {
        return { x: mouse.x - w / 2, y: mouse.y - h / 2 };
    }

    function update() {
        // 全局自转
        globalRotY += ROTATE_Y_SPEED;
        globalRotX += ROTATE_X_SPEED;

        // NOTE: 计算鼠标离屏幕中心的距离 → 控制爆炸程度
        const mw = getMouseWorld();
        const mouseDist = Math.sqrt(mw.x * mw.x + mw.y * mw.y);
        // 目标爆炸量：鼠标越近中心越爆炸
        const targetExplode = mouseDist < EXPLODE_RADIUS
            ? 1.0 - (mouseDist / EXPLODE_RADIUS)
            : 0;
        // 平滑过渡
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

    // ── 渲染 ──────────────────────────────────────────────
    function draw() {
        ctx.clearRect(0, 0, w, h);
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

            ctx.save();
            ctx.globalAlpha = alpha;

            // 渐变线段
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
        createParticles();
    });

    // NOTE: 触摸事件——手机端触屏 = 鼠标移动，抬手 = 鼠标离开
    window.addEventListener('touchmove', (e) => {
        const t = e.touches[0];
        mouse.x = t.clientX;
        mouse.y = t.clientY;
    }, { passive: true });

    window.addEventListener('touchend', () => {
        mouse.x = -9999;
        mouse.y = -9999;
    });

    init();
    loop();
})();
