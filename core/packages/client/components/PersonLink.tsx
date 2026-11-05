'use client';

// Canonical link to a WCA person profile (/wca/persons/:id). Centralizes the
// route + prefetch policy that was inlined across ~20 files.
//   - AppLink handles the /zh lang prefix, so we pass the bare path (any hard-
//     coded /en|/zh a caller used to prepend is redundant — AppLink normalizes
//     it away anyway).
//   - prefetch defaults OFF: person tables render hundreds of these; prefetching
//     each would be a prefetch storm.
//   - display defaults to displayCuberName(name, isZh); pass `children` to
//     override (e.g. nameByMode, or a Flag + name composition inside the link).
//   - 非 WCA id 降级成纯文本:站内作者字段存的是归属键 ownerKey(shared/account.ts),
//     没绑 WCA 的账号是合成 `u<uid>`,/wca/persons/u144 查无此人 → 不该出链接。

import type { ComponentProps, ReactNode } from 'react';
import { WcaPersonIdentity } from '@/components/WcaPersonIdentity';
import AppLink from '@/components/AppLink';
import { displayCuberName } from '@/lib/cuber-name-display';
import { isWcaIdFormat } from '@cuberoot/shared/account';
import { personHref } from '@/lib/person-link';
export { personHref } from '@/lib/person-link';

interface Props {
  wcaId: string;
  /** When no children: rendered as displayCuberName(name, isZh). */
  name?: string;
  isZh?: boolean;
  className?: string;
  prefetch?: boolean;
  title?: string;
  children?: ReactNode;
  /** Optional flag rendered between the team badge and the name link. */
  flag?: ReactNode;
  /** Disable when the caller already renders the team identity. */
  showTeam?: boolean;
  onClick?: ComponentProps<typeof AppLink>['onClick'];
}

export default function PersonLink({
  wcaId, name, isZh = false, className, prefetch = false, title, children, showTeam = true, flag, onClick,
}: Props) {
  const body = children ?? (name != null ? displayCuberName(name, isZh) : wcaId);
  if (!isWcaIdFormat(wcaId)) {
    return <WcaPersonIdentity showTeam={showTeam} flag={flag}><span className={className} title={title}>{body}</span></WcaPersonIdentity>;
  }
  return (
    <WcaPersonIdentity wcaId={wcaId} showTeam={showTeam} flag={flag}><AppLink href={personHref(wcaId)} prefetch={prefetch} className={className} title={title} onClick={onClick}>
      {body}
    </AppLink></WcaPersonIdentity>
  );
}
