/**
 * 3D 球壳粒子系统 — 参考 Google Antigravity 效果
 *
 * 核心模型:
 * - 1500 粒子分布在 3D 中空球壳 (R ∈ [300, 800])
 * - 弹簧振子恢复: v += (base - pos) * springK
 * - 全局自转: 基准坐标绕 Y/Z 轴旋转
 * - 鼠标 3D 排斥: 映射到 z=0 平面，距离内施加排斥力
 * - 透视投影: scale = fov / (fov + z)
 * - 速度对齐线段渲染 (运动模糊)
 * - Z-depth 景深: 近大亮、远小淡
 */

(function () {
    'use strict';

    const canvas = document.getElementById('particles-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // ── 配置 ─────────────────────────────────────────────
    const COUNT_PC = 1500;
    const COUNT_MOBILE = 600;
    const COLORS = ['#EA4335', '#FBBC05', '#34A853', '#4285F4'];

    const INNER_R = 300;            // 球壳内径（中心留空防遮挡文字）
    const OUTER_R = 800;            // 球壳外径
    const FOV = 800;                // 虚拟相机焦距
    const SPRING_K = 0.05;          // 弹簧系数
    const FRICTION = 0.9;           // 阻尼系数
    const MOUSE_RADIUS = 250;       // 鼠标排斥半径
    const MOUSE_FORCE = 15;         // 鼠标排斥力强度
    const ROTATE_Y_SPEED = 0.002;   // Y 轴自转速度 (rad/帧)
    const ROTATE_Z_SPEED = 0.001;   // Z 轴自转速度 (rad/帧)
    const TRAIL_SCALE = 2;          // 速度→线段长度比例
    const DEPTH_NEAR = -400;        // 景深：近处 Z 阈值
    const DEPTH_FAR = 400;          // 景深：远处 Z 阈值

    let particles = [];
    let mouse = { x: -9999, y: -9999 };
    let w, h, dpr;

    // ── 工具函数 ──────────────────────────────────────────

    /** Y 轴旋转矩阵 */
    function rotateY(x, y, z, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return { x: x * cos + z * sin, y, z: -x * sin + z * cos };
    }

    /** Z 轴旋转矩阵 */
    function rotateZ(x, y, z, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return { x: x * cos - y * sin, y: x * sin + y * cos, z };
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
    }

    function createParticle() {
        // NOTE: 球面坐标随机分布在中空球壳内
        const theta = Math.random() * Math.PI * 2;   // 方位角 [0, 2π)
        const phi = Math.acos(2 * Math.random() - 1); // 极角 [0, π]，均匀分布
        const r = INNER_R + Math.random() * (OUTER_R - INNER_R);

        const bx = r * Math.sin(phi) * Math.cos(theta);
        const by = r * Math.sin(phi) * Math.sin(theta);
        const bz = r * Math.cos(phi);

        return {
            // 基准坐标（随球壳自转而旋转）
            baseX: bx, baseY: by, baseZ: bz,
            // 当前坐标
            x: bx, y: by, z: bz,
            // 速度向量（初始为 0）
            vx: 0, vy: 0, vz: 0,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            baseSize: 1 + Math.random() * 1.5, // 基础粗细 1~2.5
        };
    }

    function init() {
        resize();
        particles = [];
        const count = getCount();
        for (let i = 0; i < count; i++) particles.push(createParticle());
    }

    // ── 物理更新 ──────────────────────────────────────────
    // NOTE: 鼠标屏幕坐标 -> 3D 空间（假设鼠标在 z=0 平面）
    function getMouseWorld() {
        return { x: mouse.x - w / 2, y: mouse.y - h / 2, z: 0 };
    }

    function update() {
        const mw = getMouseWorld();

        for (const p of particles) {
            // 1. 全局自转——旋转基准坐标
            const ry = rotateY(p.baseX, p.baseY, p.baseZ, ROTATE_Y_SPEED);
            const ryz = rotateZ(ry.x, ry.y, ry.z, ROTATE_Z_SPEED);
            p.baseX = ryz.x;
            p.baseY = ryz.y;
            p.baseZ = ryz.z;

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

            // 3. 弹簧恢复力: v += (base - pos) * springK
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

        // NOTE: 按 Z 深度排序——先画远处（被遮挡的），再画近处
        particles.sort((a, b) => b.z - a.z);

        for (const p of particles) {
            // 透视投影
            const scale = FOV / (FOV + p.z);
            if (scale <= 0) continue; // 相机后方

            const sx = p.x * scale + hw;
            const sy = p.y * scale + hh;

            // NOTE: 景深透明度——近处亮（1.0），远处淡（0.15）
            const depthRange = DEPTH_FAR - DEPTH_NEAR;
            const depthNorm = Math.max(0, Math.min(1, (p.z - DEPTH_NEAR) / depthRange));
            const alpha = 1.0 - depthNorm * 0.85; // 1.0 → 0.15

            // 速度的 2D 投影
            const pvx = p.vx * scale;
            const pvy = p.vy * scale;

            // 线段粗细：近处粗、远处细
            const lw = p.baseSize * scale;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = Math.max(lw, 0.5);
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            // NOTE: 速度对齐线段——终点沿速度反方向延伸（运动模糊）
            ctx.lineTo(sx - pvx * TRAIL_SCALE, sy - pvy * TRAIL_SCALE);
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
        const target = getCount();
        while (particles.length < target) particles.push(createParticle());
        while (particles.length > target) particles.pop();
    });

    init();
    loop();
})();
