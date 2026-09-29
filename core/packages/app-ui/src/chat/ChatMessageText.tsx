import { Fragment, useMemo, useState } from 'react';

export interface ChatExpression { token: string; src: string; zh: string; en: string; large?: boolean }
export interface ChatExpressionPack { id: string; zh: string; en: string; items: ChatExpression[] }

function ExpressionImage({ item }: { item: ChatExpression }) {
  const [failed, setFailed] = useState(false);
  return failed ? item.token : <img src={item.src} alt={item.token} className={item.large ? 'friend-chat-pet-expression' : 'friend-chat-inline-expression'} onError={() => setFailed(true)} />;
}

/** Only host-catalogued tokens become images; all other input remains React text. */
export function ChatMessageText({ body, packs }: { body: string; packs: ChatExpressionPack[] }) {
  const lookup = useMemo(() => new Map(packs.flatMap(pack => pack.items.map(item => [item.token, item] as const))), [packs]);
  return <>{body.split(/(\[[^\[\]\n]{1,180}\])/g).map((part, index) => {
    const item = lookup.get(part);
    return <Fragment key={index}>{item ? <ExpressionImage key={item.src} item={item} /> : part}</Fragment>;
  })}</>;
}
