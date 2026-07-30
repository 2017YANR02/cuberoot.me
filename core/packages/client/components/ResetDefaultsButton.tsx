'use client';

/**
 * 「恢复默认」—— 把一页的设置(+视角)一键推回出厂值的那颗按钮。
 *
 * /sim 的播放器控制行和 /predict 共用这一份:两边都是「一堆开关调乱了,想一键回到
 * 刚打开的样子」,再各写一颗只会让文案和配色慢慢漂开。恢复什么由调用方在 `onReset`
 * 里决定(/sim = 全部设置 + 视角,/predict = 出题参数 + 视角),`title` 也由调用方写
 * 清楚 —— 「恢复默认」四个字说不出各页恢复的边界。
 */

import { tr } from '@/i18n/tr';
import './reset-defaults-button.css';

export interface ResetDefaultsButtonProps {
  onReset: () => void;
  /** 悬停说明:这一页的「默认」到底含哪些、不含哪些。 */
  title?: string;
  /** 页面侧的尺寸/间距覆写类(配色一律走本组件)。 */
  className?: string;
}

export default function ResetDefaultsButton({ onReset, title, className }: ResetDefaultsButtonProps) {
  return (
    <button
      type="button"
      className={className ? `reset-defaults-btn ${className}` : 'reset-defaults-btn'}
      onClick={onReset}
      title={title}
    >
      {tr({ zh: '恢复默认', en: 'Reset defaults' })}
    </button>
  );
}
