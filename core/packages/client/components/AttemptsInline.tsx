import '@/components/wca-results/attempts-grid.css';
import { formatWcaResult } from '@/lib/wca-format-result';
import { isAo5Bracketed } from '@/lib/wca-ao5-brackets';

// 极简只读的 5 把成绩展示(无复盘 / 编辑入口),纪录 / 领奖台表的详情列共用。
export function AttemptsInline({ attempts, best, eventId }: { attempts: number[]; best: number; eventId: string }) {
  if (!attempts || attempts.length === 0) return <span className="wp-text-mute">—</span>;
  const valid = attempts.filter((x) => x > 0);
  const minValid = valid.length > 0 ? Math.min(...valid) : 0;
  return (
    <span className="wp-attempts-flow">
      {attempts.map((a, i) => {
        if (a === undefined) return null;
        const isBest = a > 0 && a === minValid && a === best;
        const trimmed = isAo5Bracketed(attempts, i);
        return (
          <span key={i} className={`wp-att ${isBest ? 'wp-att-best' : ''} ${trimmed ? 'wp-att-trimmed' : ''}`}>
            {formatWcaResult(a, eventId, 'single')}
          </span>
        );
      })}
    </span>
  );
}
