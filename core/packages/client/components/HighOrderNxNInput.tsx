'use client';

/**
 * NxN(1-300)输入框。2～7 阶复用已有 WCA 项目。
 * 共享给 /scramble/gen QuickMode + TNoodleMode 两处。chip 渲染由调用方负责
 * (一处展示可移除的已选 NxN chip,一处不展示)。
 *
 * 调用方通常把它放在一个 `.gen-tn-config-group` flex 容器里,后面跟自己的 chip。
 */
import { useState, type ReactNode } from 'react';
import { tr } from '@/i18n/tr';

interface Props {
  isZh: boolean;
  /** 输入合法整数 N(1-300)后回调一次。 */
  onAdd: (n: number) => void;
  /** 渲染在 input 后面的 chip 等附属内容(可选);自动复用 group flex 排版。 */
  children?: ReactNode;
}

export default function HighOrderNxNInput({ onAdd, children }: Props) {
  const [input, setInput] = useState<string>('');
  const commit = () => {
    const n = Number(input);
    if (Number.isInteger(n) && n >= 1 && n <= 300) {
      onAdd(n);
      setInput('');
    }
  };
  return (
    <div className="gen-tn-config-group">
      <input
        type="number"
        min={1}
        max={300}
        value={input}
        placeholder="1-300"
        aria-label={tr({ zh: '阶数', en: 'Cube order' })}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
        onBlur={() => { if (input) commit(); }}
        className="gen-count-input"
        style={{ width: '88px' }}
      />
      {children}
    </div>
  );
}
