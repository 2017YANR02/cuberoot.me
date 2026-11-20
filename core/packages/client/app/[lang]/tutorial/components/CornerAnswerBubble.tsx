import { useLayoutEffect, useRef, useState } from 'react';
import ChatBubble from '@/components/ChatBubble';

const EDGE = 8;
const GAP = 12;

export default function CornerAnswerBubble({ clientX, clientY, message }: {
  clientX: number;
  clientY: number;
  message: string;
}) {
  const bubble = useRef<HTMLDivElement>(null);
  const [tail, setTail] = useState<'top' | 'bottom'>('bottom');

  useLayoutEffect(() => {
    const note = bubble.current;
    const layer = note?.parentElement;
    if (!note || !layer) return;

    const position = () => {
      const bounds = layer.getBoundingClientRect();
      const x = clientX - bounds.left;
      const y = clientY - bounds.top;
      const width = note.offsetWidth;
      const height = note.offsetHeight;
      const above = y - height - GAP >= EDGE || y >= bounds.height / 2;
      const top = above ? y - height - GAP : y + GAP;
      note.style.left = `${Math.max(EDGE, Math.min(x - width / 2, bounds.width - width - EDGE))}px`;
      note.style.top = `${Math.max(EDGE, Math.min(top, bounds.height - height - EDGE))}px`;
      setTail(above ? 'bottom' : 'top');
    };

    position();
    const resize = new ResizeObserver(position);
    resize.observe(layer);
    resize.observe(note);
    return () => resize.disconnect();
  }, [clientX, clientY]);

  return <ChatBubble ref={bubble} tail={tail} className="course-answer-bubble" data-course-answer-bubble>
    {message}
  </ChatBubble>;
}
