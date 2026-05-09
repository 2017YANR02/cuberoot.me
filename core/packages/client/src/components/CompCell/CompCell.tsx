/**
 * 比赛名渲染:国旗 + 本地化名.统一全站,渲染 WCA 比赛名一律走这个.
 *
 * 调用方需先 `loadFlagData()` 一次(否则 iso2 / 中文名都查不到);函数返回 JSX.
 */
import { Flag } from '../../utils/flag';
import { compFlagIso2 } from '../../utils/country_flags';
import { localizeCompName } from '../../utils/comp_localize';

interface Props {
  compId: string;
  compName?: string | null;
  isZh: boolean;
  /** 不渲染国旗,只本地化名(罕见场景) */
  noFlag?: boolean;
}

export function CompCell({ compId, compName, isZh, noFlag }: Props) {
  const iso2 = compFlagIso2(compId);
  const display = localizeCompName(compId, compName ?? compId, isZh);
  return (
    <span className="comp-cell">
      {!noFlag && iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
      {!noFlag && iso2 && ' '}
      <span>{display}</span>
    </span>
  );
}
