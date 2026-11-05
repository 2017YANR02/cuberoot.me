import { L } from '../../_lib/Lang';
import { tr } from '@/i18n/tr';
import { DECISIONS } from '../_lib/arch-data';

export default function ArchitectureDecisions() {
  return (
    <table className="arch-tbl arch-tbl-decisions">
      <colgroup>
        <col style={{ width: '15%' }} />
        <col style={{ width: '35%' }} />
        <col />
      </colgroup>
      <thead><tr>
        <th scope="col"><L zh="用途" en="Area" /></th>
        <th scope="col"><L zh="选型" en="Technology" /></th>
        <th scope="col"><L zh="说明" en="Use" /></th>
      </tr></thead>
      <tbody>
        {DECISIONS.map((d) => (
          <tr key={d.topic.en}>
            <td className="arch-tbl-topic">{tr(d.topic)}</td>
            <td className="arch-tbl-pick">{d.pick}</td>
            <td>{tr(d)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
