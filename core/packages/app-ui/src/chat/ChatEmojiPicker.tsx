import { useState } from 'react';
import data from '@emoji-mart/data/sets/15/native.json';

const categories = [
  ['people', '表情与人物', 'Smileys & people'], ['nature', '动物与自然', 'Animals & nature'],
  ['foods', '食物与饮料', 'Food & drink'], ['activity', '活动', 'Activities'],
  ['places', '旅行与地点', 'Travel & places'], ['objects', '物品', 'Objects'],
  ['symbols', '符号', 'Symbols'], ['flags', '旗帜', 'Flags'],
] as const;
const tones = ['🖐️', '🖐🏻', '🖐🏼', '🖐🏽', '🖐🏾', '🖐🏿'];
const emojis = data.emojis as Record<string, { skins: { native: string }[] }>;

/** Native Unicode characters use Apple Color Emoji on iOS/macOS; no Apple image bundle. */
export default function ChatEmojiPicker({ disabled, onSelect, t }: {
  disabled: boolean; onSelect(value: string): void; t(zh: string, en: string): string;
}) {
  const [category, setCategory] = useState('people');
  const [tone, setTone] = useState(0);
  const group = data.categories.find((item) => item.id === category)!;
  return <>
    <div className="friend-chat-tools friend-chat-emoji-controls">
      <select aria-label={t('表情分类', 'Emoji category')} value={category} onChange={(event) => setCategory(event.target.value)}>
        {categories.map(([id, zh, en]) => <option key={id} value={id}>{t(zh, en)}</option>)}
      </select>
      <select aria-label={t('肤色', 'Skin tone')} value={tone} onChange={(event) => setTone(Number(event.target.value))}>
        {tones.map((value, index) => <option key={value} value={index}>{value}</option>)}
      </select>
    </div>
    <div key={category} className="friend-chat-emoji-grid">{group.emojis.map((id) => {
      const skins = emojis[id].skins;
      const value = (skins[tone] ?? skins[0]).native;
      return <button type="button" className="friend-chat-action" key={id} disabled={disabled} aria-label={value} onClick={() => onSelect(value)}>{value}</button>;
    })}</div>
  </>;
}
