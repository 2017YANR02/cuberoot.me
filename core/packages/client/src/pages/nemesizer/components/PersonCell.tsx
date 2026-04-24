import { Flag } from '../../../utils/flag';
import { displayCuberName } from '../../../utils/name_utils';
import type { PersonRecord } from '@cuberoot/shared';

interface Props {
  person: PersonRecord;
  isZh: boolean;
}

export default function PersonCell({ person, isZh }: Props) {
  return (
    <span>
      <Flag iso2={person.countryIso2} className="nemesizer-flag-icon" />
      {displayCuberName(person.name, isZh)}
    </span>
  );
}
