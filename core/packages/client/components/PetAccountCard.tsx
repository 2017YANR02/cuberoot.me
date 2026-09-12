'use client';
import { useEffect, useState } from 'react';
import AppLink from '@/components/AppLink';
import PetLevelBadge from '@/components/PetLevelBadge';
import { getMyPets, type AdoptedPet } from '@/lib/deskpet-api';
import { getDeskPetCatalog } from '@/lib/deskpet-api';
import { THEMES, THEME_IDS, type ThemeId } from '@/lib/deskpet-themes';
import { resolveDeskPets } from '@cuberoot/shared/deskpet';
import { useAuthStore } from '@/lib/auth-store';
import { tr } from '@/i18n/tr';
import './DeskPetHome.css';
export default function PetAccountCard() {
  const user=useAuthStore(s=>s.user);
  const owner=user?String(user.uid??user.wcaId):'';
  const [saved,setSaved]=useState<{owner:string;pet?:AdoptedPet;label?:{zh:string;en:string}}|null>(null);
  useEffect(()=>{
    let live=true; let request=0;
    const load=()=>{const id=++request; if(owner)void Promise.all([getMyPets(),getDeskPetCatalog()]).then(([pets,catalog])=>{
      if(!live || id!==request)return;
      const choices=resolveDeskPets(THEME_IDS,catalog.entries).filter(p=>!p.locked&&!p.removed);
      const pet=pets.find(p=>choices.some(c=>c.id===p.id));
      setSaved({owner,pet,label:choices.find(c=>c.id===pet?.id)?.label});
    }).catch(()=>{});};
    load();window.addEventListener('pets:updated',load);window.addEventListener('focus',load);
    return()=>{live=false;window.removeEventListener('pets:updated',load);window.removeEventListener('focus',load);};
  },[owner]);
  const pet=saved?.owner===owner?saved.pet:undefined;
  const theme=THEMES[pet?.id as ThemeId]??THEMES.rootbeast;
  return <AppLink href={`/pets${pet?`?pet=${pet.id}`:''}`} className="account-card account-pet-card" prefetch={false}>
    <img src={theme.thumb} alt="" width={60} height={60}/><div className="account-card-body"><div className="account-card-title">{pet?tr(saved?.label??theme.label):tr({zh:'我的宠物',en:'My companions'})}</div>
      {pet?<PetLevelBadge bond={pet.care.bond}/>:<div className="account-card-desc">{tr({zh:'领养一个小伙伴，一起长大。',en:'Adopt a little friend and grow together.'})}</div>}
    </div>
  </AppLink>;
}
