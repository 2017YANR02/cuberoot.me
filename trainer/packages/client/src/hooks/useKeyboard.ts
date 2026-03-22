import { useEffect, useRef } from 'react';

/**
 * 键盘事件监听 hook
 * 支持 keydown/keyup 分别处理（计时器需要区分按下和释放）
 */
export function useKeyboard(handlers: {
  onKeyDown?: (e: KeyboardEvent) => void;
  onKeyUp?: (e: KeyboardEvent) => void;
}) {
  // NOTE: 用 ref 存 handlers，避免每次渲染都重新绑定事件
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      handlersRef.current.onKeyDown?.(e);
    };
    const handleUp = (e: KeyboardEvent) => {
      handlersRef.current.onKeyUp?.(e);
    };

    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);

    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, []);
}
