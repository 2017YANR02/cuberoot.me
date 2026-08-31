// Web data adapter over the runtime-neutral competition-name rules shared with Mobile.
import {
  localizeCompName as localizeSharedCompName,
  resolveCompName as resolveSharedCompName,
  stripCompYear,
  stripWcaPrefix,
  type LocalizeCompOpts as SharedLocalizeCompOpts,
} from '@cuberoot/shared/comp-localize';
import { compNameEnFromZh, compNameZh } from './country-flags';

export { stripCompYear, stripWcaPrefix };

export interface LocalizeCompOpts {
  upcomingNameZhById?: ReadonlyMap<string, string> | null;
  explicitNameZh?: string | null;
  date?: string | null;
}

function withWebResolvers(opts?: LocalizeCompOpts): SharedLocalizeCompOpts {
  return {
    ...opts,
    resolveNameEnFromZh: compNameEnFromZh,
    resolveNameZh: compNameZh,
  };
}

export function resolveCompName(
  id: string,
  name: string,
  isZh: boolean,
  opts?: LocalizeCompOpts,
): string {
  return resolveSharedCompName(id, name, isZh, withWebResolvers(opts));
}

export function localizeCompName(
  id: string,
  name: string,
  isZh: boolean,
  opts?: LocalizeCompOpts,
): string {
  return localizeSharedCompName(id, name, isZh, withWebResolvers(opts));
}
