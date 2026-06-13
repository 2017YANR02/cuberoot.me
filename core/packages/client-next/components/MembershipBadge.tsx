'use client';

/**
 * MembershipBadge — CubeRoot 会员标记(小药丸)。
 * 用在选手名旁 / 个人页 / 致谢墙等处标识会员;lifetime 显示「永久会员」。
 */
import { Crown } from 'lucide-react';
import { tr } from '@/i18n/tr';
import './membership-badge.css';

interface Props {
  lifetime?: boolean;
  size?: number;
  className?: string;
}

export default function MembershipBadge({ lifetime, size = 13, className }: Props) {
  return (
    <span
      className={`membership-badge${lifetime ? ' is-lifetime' : ''}${className ? ' ' + className : ''}`}
      title={tr({ zh: 'CubeRoot 会员', en: 'CubeRoot member',
          zhHant: "CubeRoot 會員"
    })}
    >
      <Crown size={size} strokeWidth={2} aria-hidden="true" />
      {lifetime
        ? tr({ zh: '永久会员', en: 'Lifetime',
            zhHant: "永久會員"
        })
        : tr({ zh: '会员', en: 'Member',
            zhHant: "會員"
        })}
    </span>
  );
}
