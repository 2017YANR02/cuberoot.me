'use client';
import { TimerRankBadge, type RankBadgeProps as SharedProps } from '@cuberoot/timer-ui/rank-badge';
import { fetchRankFor } from '@/lib/rank-client';
import { fetchWcaPersonResults } from '@/lib/wca-person-api';
export type RankBadgeProps = Omit<SharedProps, 'host'>;
const host = { fetchRankFor, fetchOfficial: fetchWcaPersonResults };
export default function RankBadge(props: RankBadgeProps) { return <TimerRankBadge {...props} host={host} />; }
