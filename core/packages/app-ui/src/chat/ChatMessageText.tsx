import { Fragment, useMemo, useState } from 'react';

export interface ChatExpression { token: string; src: string; zh: string; en: string; large?: boolean }
export interface ChatExpressionPack { id: string; zh: string; en: string; items: ChatExpression[] }

function ExpressionImage({ item }: { item: ChatExpression }) {
  const [failed, setFailed] = useState(false);
  return failed ? item.token : <img src={item.src} alt={item.token} className={item.large ? 'friend-chat-pet-expression' : 'friend-chat-inline-expression'} onError={() => setFailed(true)} />;
}

/** Only host-catalogued tokens become images; all other input remains React text. */
export function ChatMessageText({ body, packs }: { body: string; packs: ChatExpressionPack[] }) {
  const parts = useMemo(() => splitChatExpressions(body, packs), [body, packs]);
  return <>{parts.map((part, index) => <Fragment key={index}>{typeof part === 'string' ? part : <ExpressionImage key={part.src} item={part} />}</Fragment>)}</>;
}

export function splitChatExpressions(body: string, packs: ChatExpressionPack[]): Array<string | ChatExpression> {
  const lookup = new Map(packs.flatMap(pack => pack.items.map(item => [item.token, item] as const)));
  return body.split(/(\[[^\[\]\n]{1,180}\])/g).map(part => lookup.get(part) ?? part);
}
