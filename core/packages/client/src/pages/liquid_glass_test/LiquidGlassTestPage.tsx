/**
 * /liquid-glass-test — 测试 liquid-glass-react 的独立沙盒。镜像官方 example
 * (D:\liquid-glass-react\liquid-glass-example\src\pages\index.tsx):彩色 bg
 * + 居中 LiquidGlass + 6 个 slider 实时调参,验证 displacement / aberration /
 * elasticity 真能跑出 iOS 26 效果。
 *
 * 路由本地 only,生产 build 也会带,但不在任何导航里。
 */
import { useRef, useState } from 'react';
import LiquidGlass from 'liquid-glass-react';

type Mode = 'standard' | 'polar' | 'prominent' | 'shader';

export default function LiquidGlassTestPage() {
  const [displacementScale, setDisplacementScale] = useState(100);
  const [blurAmount, setBlurAmount] = useState(0.5);
  const [saturation, setSaturation] = useState(140);
  const [aberrationIntensity, setAberrationIntensity] = useState(2);
  const [elasticity, setElasticity] = useState(0.3);
  const [cornerRadius, setCornerRadius] = useState(32);
  const [mode, setMode] = useState<Mode>('standard');
  const [overLight, setOverLight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', height: '100vh', overflow: 'hidden' }}>
      {/* 左:可拖拽 / 滚动的彩色背景,glass 浮在上面 */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          overflow: 'auto',
          background: 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 35%, #86a8e7 70%, #91eae4 100%)',
        }}
      >
        <img
          src="https://picsum.photos/1600/1200"
          alt=""
          style={{ width: '100%', height: 480, objectFit: 'cover', display: 'block' }}
        />
        <div style={{ padding: '40px 60px', color: '#fff', fontSize: 14, lineHeight: 1.6 }}>
          <h2 style={{ fontSize: 28, marginBottom: 12 }}>Liquid Glass Sandbox</h2>
          <p>
            滚动 / 鼠标在左侧滑动,观察右下方 glass 的边缘折射 + 色散 + 弹性形变。
            橙色 ↔ 蓝绿 渐变是为了让 displacement 真正可见 —— 平铺单色看不出效果。
          </p>
          <p style={{ marginTop: 12 }}>
            非 Chromium 浏览器只剩 backdrop blur,这是 SVG filter 方案的固有限制。
          </p>
        </div>
        <img
          src="https://picsum.photos/1200/900?random=2"
          alt=""
          style={{ width: '100%', height: 360, objectFit: 'cover', display: 'block', marginTop: 20 }}
        />
        <div style={{ height: 200 }} />

        <LiquidGlass
          displacementScale={displacementScale}
          blurAmount={blurAmount}
          saturation={saturation}
          aberrationIntensity={aberrationIntensity}
          elasticity={elasticity}
          cornerRadius={cornerRadius}
          mouseContainer={containerRef}
          overLight={overLight}
          mode={mode}
          style={{ position: 'fixed', top: '40%', left: '30%' }}
        >
          <div style={{ width: 280, padding: '8px 4px', color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,0.45)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Liquid Glass</h3>
            <p style={{ fontSize: 13, lineHeight: 1.5 }}>
              拖动 / 移动鼠标在左侧,glass 会朝指针方向弹性形变(elasticity 控制)。
              边缘的彩色描边来自 chromatic aberration。
            </p>
          </div>
        </LiquidGlass>
      </div>

      {/* 右:控制面板 */}
      <div
        style={{
          background: '#1c1917',
          color: '#f0ebe3',
          padding: 24,
          overflowY: 'auto',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Controls</h2>
        <p style={{ fontSize: 11, color: '#9c8c7e', marginBottom: 20 }}>
          /liquid-glass-test · 独立沙盒,不影响其他页面
        </p>

        <Field label="Mode">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            style={{ width: '100%', padding: '6px 8px', background: '#232020', color: '#f0ebe3', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }}
          >
            <option value="standard">standard</option>
            <option value="polar">polar</option>
            <option value="prominent">prominent</option>
            <option value="shader">shader (experimental)</option>
          </select>
        </Field>

        <Slider label="Displacement Scale" value={displacementScale} min={0} max={200} step={1} onChange={setDisplacementScale} />
        <Slider label="Blur Amount" value={blurAmount} min={0} max={1} step={0.01} onChange={setBlurAmount} fmt={(v) => v.toFixed(2)} />
        <Slider label="Saturation %" value={saturation} min={100} max={300} step={10} onChange={setSaturation} />
        <Slider label="Chromatic Aberration" value={aberrationIntensity} min={0} max={20} step={1} onChange={setAberrationIntensity} />
        <Slider label="Elasticity" value={elasticity} min={0} max={1} step={0.05} onChange={setElasticity} fmt={(v) => v.toFixed(2)} />
        <Slider label="Corner Radius (999=full)" value={cornerRadius} min={0} max={100} step={1} onChange={setCornerRadius} />

        <Field label="Over Light (dark tint on bright bg)">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={overLight} onChange={(e) => setOverLight(e.target.checked)} />
            <span>启用</span>
          </label>
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#f0ebe3' }}>{label}</div>
      {children}
    </div>
  );
}

function Slider({
  label, value, min, max, step, onChange, fmt,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  return (
    <Field label={`${label}: ${fmt ? fmt(value) : value}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%' }}
      />
    </Field>
  );
}
