/**
 * /recon/submit-sketch —— 低保真布局原型,纯 placeholder,无 API 无数据
 * 目的:让用户对照现行 ReconSubmitPage 看新布局
 * 灵感:Twizzle 左输入右预览 + GitHub 设置式 collapsible sections
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, Keyboard, Eye } from 'lucide-react';
import { useDocumentTitle } from '../../utils/useDocumentTitle';

// ── tiny presentational primitives,inline styled,自洽 ──

function Field({ label, children, required, span }: { label: string; children: React.ReactNode; required?: boolean; span?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: span ? `span ${span}` : undefined }}>
      <label style={{ fontSize: 12, color: 'var(--muted, #9aa)', fontWeight: 500 }}>
        {label}{required && <span style={{ color: '#f66', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function FakeInput({ value, big }: { value?: string; big?: boolean }) {
  return (
    <div style={{
      height: big ? 44 : 34,
      padding: big ? '0 14px' : '0 10px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 6,
      display: 'flex', alignItems: 'center',
      fontSize: big ? 18 : 14,
      color: value ? 'var(--text, #ddd)' : 'var(--muted, #666)',
      fontVariantNumeric: 'tabular-nums',
    }}>{value || ' '}</div>
  );
}

function FakePill({ flag, name }: { flag?: string; name: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 8px', borderRadius: 999,
      background: 'rgba(100,150,255,0.12)', border: '1px solid rgba(100,150,255,0.3)',
      fontSize: 13,
    }}>
      {flag && <span>{flag}</span>}
      {name}
      <span style={{ opacity: 0.5, marginLeft: 2 }}>×</span>
    </span>
  );
}

function Section({ title, defaultOpen = false, children, badge }: {
  title: string; defaultOpen?: boolean; children: React.ReactNode; badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          minHeight: 48, padding: '12px 4px',
          background: 'transparent', border: 'none', color: 'inherit',
          font: 'inherit', textAlign: 'left', cursor: 'pointer',
        }}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
        {badge && (
          <span style={{ fontSize: 11, color: 'var(--muted, #888)', fontWeight: 400 }}>{badge}</span>
        )}
      </button>
      {open && <div style={{ padding: '8px 0 16px 0' }}>{children}</div>}
    </div>
  );
}

// ── 主体 ──

export default function ReconSubmitSketchPage() {
  useDocumentTitle('提交草稿', 'Submit Sketch');
  const [showKeyboard, setShowKeyboard] = useState(false);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: 16 }}>
      {/* sticky top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--bg, #1a1a1a)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 0', marginBottom: 16,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
          编辑复盘 #2287 <span style={{ color: 'var(--muted, #888)', fontWeight: 400, fontSize: 14, marginLeft: 8 }}>(布局草图)</span>
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: 'inherit', cursor: 'pointer' }}>取消</button>
          <button style={{ padding: '8px 20px', background: '#3b82f6', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 500, cursor: 'pointer' }}>保存</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 460px)', gap: 24 }} className="sketch-split">
        {/* ── 左:input 列 ── */}
        <div style={{ minWidth: 0 }}>

          {/* hero 行 — 3 个最关键字段,大字号醒目 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 12, marginBottom: 8 }}>
            <Field label="选手" required>
              <div style={{ display: 'flex', alignItems: 'center', minHeight: 44, padding: '0 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }}>
                <FakePill flag="🇨🇳" name="耿暄一" />
              </div>
            </Field>
            <Field label="项目" required>
              <FakeInput value="▦ 三阶" big />
            </Field>
            <Field label="成绩 (秒)" required>
              <FakeInput value="2.803" big />
            </Field>
          </div>

          {/* 实时 stats — 不是输入,是回显,放高位 */}
          <div style={{
            margin: '12px 0',
            padding: '10px 14px',
            background: 'rgba(100,200,150,0.08)',
            border: '1px solid rgba(100,200,150,0.2)',
            borderRadius: 6,
            fontSize: 13,
            fontVariantNumeric: 'tabular-nums',
            display: 'flex', gap: 16,
          }}>
            <span><b>33</b> STM</span>
            <span style={{ opacity: 0.5 }}>/</span>
            <span><b>2.80</b> s</span>
            <span style={{ opacity: 0.5 }}>=</span>
            <span><b>11.77</b> TPS</span>
          </div>

          {/* === 解法 section,常开 === */}
          <Section title="打乱与解法" defaultOpen badge="必填">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="打乱">
                <FakeInput value="D U2 F2 U' B' D2 L' B' L2 U2 B2 D' F2 L F2 D' F'" />
              </Field>
              <Field label="解法" required>
                <div style={{
                  minHeight: 140, padding: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}>
{`x2 // insp
l D' x' U' R' F R U2' D' // Y xcross (G0)
R U' R' // GR
U R' U' R // BR
y' r R' U R r' (U2' R' F R // BO/ZBLS
R' F' r U) R U' r' F U2' // ZBLL-T`}
                </div>
              </Field>
              {/* 虚拟键盘:按需展开,不是默认占满屏 */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowKeyboard(s => !s)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', fontSize: 12,
                    background: showKeyboard ? 'rgba(100,150,255,0.15)' : 'transparent',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6,
                    color: 'inherit', cursor: 'pointer',
                  }}
                >
                  <Keyboard size={14} />
                  {showKeyboard ? '隐藏虚拟键盘' : '显示虚拟键盘 (移动端友好)'}
                </button>
                {showKeyboard && (
                  <div style={{
                    marginTop: 8, padding: 12,
                    background: 'rgba(0,0,0,0.3)', borderRadius: 6,
                    color: 'var(--muted, #888)', fontSize: 12, textAlign: 'center',
                  }}>
                    [虚拟键盘 placeholder — 真实组件 CubeVirtualKeyboard]
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* === 比赛归属,有值时自动展开 === */}
          <Section title="比赛归属" defaultOpen badge="比赛/轮次/纪录">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <Field label="WCA 官方">
                <FakeInput value="WCA" />
              </Field>
              <Field label="比赛" span={2}>
                <div style={{ display: 'flex', alignItems: 'center', minHeight: 34, padding: '0 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }}>
                  <FakePill flag="🇨🇳" name="德清短时赛 2026" />
                </div>
              </Field>
              <Field label="日期">
                <FakeInput value="2026-04-22" />
              </Field>

              <Field label="轮次">
                <FakeInput value="决赛" />
              </Field>
              <Field label="#">
                <FakeInput value="5" />
              </Field>
              <Field label="分组">
                <FakeInput value="A" />
              </Field>
              <Field label="方法">
                <FakeInput value="ZB" />
              </Field>

              <Field label="平均成绩">
                <FakeInput value="3.71" />
              </Field>
              <Field label="单次纪录">
                <FakeInput value="🟨 CR" />
              </Field>
              <Field label="平均纪录">
                <FakeInput value="🟥 WR" />
              </Field>
            </div>
          </Section>

          {/* === 元数据,默认折叠,大多数提交不会改 === */}
          <Section title="元数据" badge="视频 / 装备 / 复盘者">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <Field label="视频链接" span={2}>
                <FakeInput value="https://youtube.com/..." />
              </Field>
              <Field label="魔方型号">
                <FakeInput value="GAN 16 Maglev MAX" />
              </Field>
              <Field label="备注">
                <FakeInput />
              </Field>
              <Field label="复盘者">
                <div style={{ display: 'flex', alignItems: 'center', minHeight: 34, padding: '0 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }}>
                  <FakePill flag="🇨🇳" name="颜瑞民" />
                </div>
              </Field>
              <Field label="复盘日期">
                <FakeInput />
              </Field>
            </div>
          </Section>
        </div>

        {/* ── 右:preview 列,sticky ── */}
        <div className="sketch-preview" style={{ position: 'sticky', top: 80, alignSelf: 'start', height: 'fit-content' }}>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, color: 'var(--muted, #aaa)' }}>
              <Eye size={14} /> 实时预览
            </div>

            {/* TwistyPlayer 占位 */}
            <div style={{
              aspectRatio: '1 / 1',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
              border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--muted, #666)', fontSize: 13,
              marginBottom: 12,
            }}>
              [TwistyPlayer 3D 渲染]
            </div>

            {/* 分段统计 */}
            <div style={{ fontSize: 12, color: 'var(--muted, #aaa)', marginBottom: 6 }}>分段</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
              {[
                ['xcross (G0)', '8 STM', '0.74s'],
                ['GR', '3 STM', '0.31s'],
                ['BR', '4 STM', '0.39s'],
                ['BO/ZBLS', '8 STM', '0.68s'],
                ['ZBLL-T', '10 STM', '0.68s'],
              ].map(([n, s, t]) => (
                <div key={n} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, padding: '4px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 4 }}>
                  <span>{n}</span><span style={{ color: 'var(--muted, #aaa)' }}>{s}</span><span>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 移动端单列 */}
      <style>{`
        @media (max-width: 1024px) {
          .sketch-split { grid-template-columns: 1fr !important; }
          .sketch-preview { position: static !important; }
        }
      `}</style>
    </div>
  );
}
