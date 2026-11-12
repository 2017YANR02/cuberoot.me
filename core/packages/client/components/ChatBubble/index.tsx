'use client';

import { useImperativeHandle, useLayoutEffect, useRef, useState, type ComponentPropsWithRef, type CSSProperties, type ReactNode } from 'react';
import { BUBBLE_OUTSET, chatBubblePath, type ChatBubbleTail } from './shape';
import './chat-bubble.css';

export type { ChatBubbleTail } from './shape';

export interface ChatBubbleProps extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'color'> {
  children: ReactNode;
  tail?: ChatBubbleTail;
  /** CSS color or variable; defaults to the site's accent. */
  color?: CSSProperties['backgroundColor'];
  /** Set alongside a custom color when it needs a different foreground. */
  textColor?: CSSProperties['color'];
  /** Inherits the surrounding font size unless explicitly supplied. */
  fontSize?: CSSProperties['fontSize'];
}

/** Content-sized speech bubble. Placement and reveal timing belong to the caller. */
export default function ChatBubble({
  children, tail = 'left', color, textColor, fontSize, className, style, ref, ...props
}: ChatBubbleProps) {
  const element = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useImperativeHandle(ref, () => element.current!, []);
  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    let active = true;
    let lastWidth = 0, lastHeight = 0;
    const measure = () => {
      if (!active) return;
      // Computed border-box dimensions exclude the caller's translate/scale.
      const css = getComputedStyle(node);
      const width = Number.parseFloat(css.width), height = Number.parseFloat(css.height);
      if (!(width > 0 && height > 0)) return;
      if (Math.abs(lastWidth - width) < .01 && Math.abs(lastHeight - height) < .01) return;
      lastWidth = width;
      lastHeight = height;
      setSize({ width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node, { box: 'border-box' });
    return () => { active = false; observer.disconnect(); };
  }, []);
  const path = chatBubblePath(size.width, size.height, tail);
  const bubbleStyle = {
    ...style,
    ...(color === undefined ? {} : { '--chat-bubble-color': color }),
    ...(textColor === undefined ? {} : { '--chat-bubble-text': textColor }),
    ...(fontSize === undefined ? {} : { fontSize }),
  } as CSSProperties;

  return <div {...props} ref={element} className={`chat-bubble${className ? ` ${className}` : ''}`}
    data-tail={tail} data-shaped={!!path || undefined} data-corner-shape="native" style={bubbleStyle}>
    {path && <svg className="chat-bubble__shape" aria-hidden="true" focusable="false"
      viewBox={`0 0 ${size.width + BUBBLE_OUTSET * 2} ${size.height + BUBBLE_OUTSET * 2}`}>
      <path d={path} />
    </svg>}
    {children}
  </div>;
}
