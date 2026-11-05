'use client';

import { Flag } from '@/components/Flag';
import { WcaPersonIdentity } from '@/components/WcaPersonIdentity';
import { displayCuberName } from '@/lib/cuber-name-display';

interface PersonLike {
  wcaId: string;
  name: string;
  countryIso2: string;
  continentIdx?: number;
}

interface Props {
  person: PersonLike;
  isZh: boolean;
}

export default function PersonCell({ person, isZh }: Props) {
  return (
    <WcaPersonIdentity wcaId={person.wcaId} flag={<Flag iso2={person.countryIso2} className="nemesizer-flag-icon" />}>
      {displayCuberName(person.name, isZh)}
    </WcaPersonIdentity>
  );
}
