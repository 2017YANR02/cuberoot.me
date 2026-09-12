import { Star, Moon, Sun } from 'lucide-react';
import { petLevel } from '@/lib/deskpet-care';
import { tr } from '@/i18n/tr';
export default function PetLevelBadge({ bond }: { bond: number }) {
  const rank=petLevel(bond);
  return <span className="pet-level-badge"><strong>Lv.{rank.level}</strong><span aria-label={tr({zh:`${rank.suns}个太阳、${rank.moons}个月亮、${rank.stars}颗星星`,en:`${rank.suns} suns, ${rank.moons} moons, ${rank.stars} stars`})}>
    {Array.from({length:rank.suns},(_,i)=><Sun key={`sun${i}`} size={20}/>)}{Array.from({length:rank.moons},(_,i)=><Moon key={`moon${i}`} size={18}/>)}{Array.from({length:rank.stars},(_,i)=><Star key={`star${i}`} size={15}/>)}
  </span></span>;
}
