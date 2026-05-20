/**
 * 高阶 NxN(8-300)输入框。WCA 21 项里最大 7×7,N≥8 走自带 random-move 生成器。
 * 共享给 /scramble/gen QuickMode + TNoodleMode 两处。chip 渲染由调用方负责
 * (一处展示可移除的已选 NxN chip,一处不展示)。
 *
 * 调用方通常把它放在一个 `.gen-tn-config-group` flex 容器里,后面跟自己的 chip。
 */
import { useState, type ReactNode } from 'react';

interface Props {
  isZh: boolean;
  /** 输入合法 N(8-300)后回调一次,把 `nxn<N>` 加进 events。 */
  onAdd: (n: number) => void;
  /** 渲染在 input 后面的 chip 等附属内容(可选);自动复用 group flex 排版。 */
  children?: ReactNode;
}

export default function HighOrderNxNInput({ isZh, onAdd, children }: Props) {
  const [input, setInput] = useState<string>('');
  const commit = () => {
    const n = parseInt(input, 10);
    if (Number.isFinite(n) && n >= 8 && n <= 300) {
      onAdd(n);
      setInput('');
    }
  };
  return (
    <div className="gen-tn-config-group">
      <label className="gen-tn-config-label">{isZh ? '高阶 NxN' : 'High-order NxN'}</label>
      <input
        type="number"
        min={8}
        max={300}
        value={input}
        placeholder="8-300"
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
        onBlur={() => { if (input) commit(); }}
        className="gen-count-input"
        style={{ width: '72px' }}
      />
      {children}
    </div>
  );
}
