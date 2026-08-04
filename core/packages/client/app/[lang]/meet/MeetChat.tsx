'use client';

/**
 * 会议里的文字聊天。库的 <Chat/> 的中文版 —— 它把「Messages」「Enter a message...」「Send」
 * 写死在组件里且不给参数,所以这里自己搭一层,消息条目仍用库的 <ChatEntry/>(那里面只有
 * 时间戳和昵称,没有要翻的文案)。
 *
 * 消息不落库、不留档:LiveKit 的数据通道只发给此刻在房里的人。因此没有「历史消息」,
 * 也不需要清理 —— 与本站不存会议记录是同一个决定。
 */

import { useEffect, useRef } from 'react';
import { ChatEntry, useChat } from '@livekit/components-react';

import { tr } from '@/i18n/tr';

export interface MeetChatProps {
  open: boolean;
  onClose: () => void;
  /** 未读数回传给控制条上的角标。 */
  onUnread: (n: number) => void;
}

export default function MeetChat({ open, onClose, onUnread }: MeetChatProps) {
  const { chatMessages, send, isSending } = useChat();
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** 面板打开时读到了第几条。关着的时候进来的才算未读。 */
  const readCount = useRef(0);

  useEffect(() => {
    if (open) {
      readCount.current = chatMessages.length;
      onUnread(0);
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    } else {
      onUnread(Math.max(0, chatMessages.length - readCount.current));
    }
  }, [chatMessages, open, onUnread]);

  return (
    <div className="lk-chat" style={{ display: open ? 'grid' : 'none' }}>
      <div className="lk-chat-header">
        {tr({ zh: '聊天', en: 'Chat' })}
        <button
          type="button"
          className="lk-button lk-close-button"
          aria-label={tr({ zh: '关闭聊天', en: 'Close chat' })}
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <ul className="lk-list lk-chat-messages" ref={listRef}>
        {chatMessages.map((msg, i, all) => {
          const prev = all[i - 1];
          const sameSender = !!prev && prev.from === msg.from;
          return (
            <ChatEntry
              key={msg.id ?? i}
              entry={msg}
              hideName={sameSender}
              // 同一个人连着发、且间隔不到一分钟,就不再重复盖时间戳。
              hideTimestamp={sameSender && !!prev && msg.timestamp - prev.timestamp < 60_000}
            />
          );
        })}
      </ul>

      <form
        className="lk-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          const value = inputRef.current?.value.trim();
          if (!value) return;
          void send(value).then(() => {
            if (inputRef.current) {
              inputRef.current.value = '';
              inputRef.current.focus();
            }
          });
        }}
      >
        <input
          ref={inputRef}
          type="text"
          className="lk-form-control lk-chat-form-input"
          disabled={isSending}
          placeholder={tr({ zh: '说点什么…', en: 'Enter a message…' })}
          // 会议里到处是快捷键(空格切静音之类),别让聊天框里的每一次敲击往外冒。
          onInput={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
        />
        <button type="submit" className="lk-button lk-chat-form-button" disabled={isSending}>
          {tr({ zh: '发送', en: 'Send' })}
        </button>
      </form>
    </div>
  );
}
