'use client';

import { useState } from 'react';
import ChatBubble, { type ChatBubbleTail } from '@/components/ChatBubble';
import { tr } from '@/i18n/tr';

const tails = [
  { value: 'left', zh: '左', en: 'Left' },
  { value: 'right', zh: '右', en: 'Right' },
  { value: 'top', zh: '上', en: 'Top' },
  { value: 'bottom', zh: '下', en: 'Bottom' },
  { value: 'none', zh: '隐藏', en: 'None' },
] as const;

export default function ChatBubbleDemo() {
  const [tail, setTail] = useState<ChatBubbleTail>('left');
  const [fontSize, setFontSize] = useState('');
  return <div style={{ display: 'grid', gap: 20, minWidth: 0, width: '100%' }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <label>{tr({ zh: '尖角 ', en: 'Tail ' })}<select className="native-select" value={tail} onChange={event => setTail(event.currentTarget.value as ChatBubbleTail)}>
        {tails.map(option => <option key={option.value} value={option.value}>{tr(option)}</option>)}
      </select></label>
      <label>{tr({ zh: '字号 ', en: 'Font size ' })}<select className="native-select" value={fontSize} onChange={event => setFontSize(event.currentTarget.value)}>
        <option value="">{tr({ zh: '继承', en: 'Inherit' })}</option>
        {['1rem', '1.25rem', '1.5rem'].map(size => <option key={size} value={size}>{size}</option>)}
      </select></label>
    </div>
    <ChatBubble tail={tail} fontSize={fontSize || undefined}>
      <p>{tr({ zh: '先找到白色棱块。', en: 'First, find a white edge.' })}</p>
      <p>{tr({ zh: '观察它的位置，再选择下一步。', en: 'Look at its position before choosing the next move.' })}</p>
    </ChatBubble>
    <ChatBubble tail="right" color="#BAE6FD" textColor="#000000" style={{ justifySelf: 'end' }}>
      {tr({ zh: '这一步我学会了！', en: "I've got this step!" })}
    </ChatBubble>
  </div>;
}
