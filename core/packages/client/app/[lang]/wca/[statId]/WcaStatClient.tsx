'use client';

// Route shell for /wca/[statId]: reads statId from the URL and renders the shared
// <WcaStatView> (headerMode='full' = 暗锁页壳 + h1 + note + document.title)。
// 渲染器本体在 components/wca-stats/WcaStatView.tsx —— 同一份也嵌入 /wca/results 的
// 「记录·指标」视图(wr_metric)。
import { useParams } from 'next/navigation';
import PersonalRecordStreakPage from '@/components/wca-stats/PersonalRecordStreakPage';
import { WcaStatView } from '@/components/wca-stats/WcaStatView';

export default function WcaStatClient() {
  const params = useParams();
  const statIdRaw = params?.statId;
  const statId = Array.isArray(statIdRaw) ? statIdRaw[0] : (statIdRaw ?? '');
  if (statId === 'longest_streak_of_personal_records') return <PersonalRecordStreakPage />;
  return <WcaStatView statId={statId} />;
}
