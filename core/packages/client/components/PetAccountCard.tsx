'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import AppLink from '@/components/AppLink';
import PetLevelBadge from '@/components/PetLevelBadge';
import { getMyPets, type AdoptedPet } from '@/lib/deskpet-api';
import { getDeskPetCatalog } from '@/lib/deskpet-api';
import { THEMES, THEME_IDS, type ThemeId } from '@/lib/deskpet-themes';
import { resolveDeskPets, type DeskPetEntry } from '@cuberoot/shared/deskpet';
import { getDeskPetSelection, getServerDeskPetSelection, subscribeDeskPetSelection } from '@/lib/deskpet-selection';
import { hasAdminAccess, useAuthStore } from '@/lib/auth-store';
import { tr } from '@/i18n/tr';
import './DeskPetHome.css';
export default function PetAccountCard() {
  const user=useAuthStore(s=>s.user);
  const isAdmin=hasAdminAccess(user);
  const owner=user?String(user.uid??user.wcaId):'';
  const selectedCharacter=useSyncExternalStore(subscribeDeskPetSelection,getDeskPetSelection,getServerDeskPetSelection);
  const [saved,setSaved]=useState<{owner:string;pets:AdoptedPet[];choices:DeskPetEntry[]}|null>(null);
  useEffect(()=>{
    let live=true; let request=0;
    const load=()=>{const id=++request; if(owner)void Promise.all([getMyPets().catch(()=>null),getDeskPetCatalog()]).then(([pets,catalog])=>{
      if(!live || id!==request)return;
      const choices=resolveDeskPets(THEME_IDS,catalog.entries).filter(p=>isAdmin||(!p.locked&&!p.removed));
      setSaved(previous=>({owner,pets:pets??(previous?.owner===owner?previous.pets:[]),choices}));
    }).catch(()=>{});};
    load();window.addEventListener('pets:updated',load);window.addEventListener('focus',load);
    return()=>{live=false;window.removeEventListener('pets:updated',load);window.removeEventListener('focus',load);};
  },[owner,isAdmin]);
  const record=saved?.owner===owner?saved:null;
  const choice=record?.choices.find(c=>c.id===selectedCharacter)??record?.choices[0];
  const pet=record?.pets.find(p=>p.id===choice?.id);
  const theme=THEMES[(choice?.id??selectedCharacter) as ThemeId]??THEMES.rootbeast;
  return <AppLink href={`/pets${choice?`?pet=${choice.id}`:''}`} className="account-card account-pet-card" prefetch={false}>
    <img src={theme.thumb} alt="" width={60} height={60}/><div className="account-card-body"><div className="account-card-title">{choice?tr(choice.label??theme.label):tr({zh:'我的宠物',en:'My companions'})}</div>
      {pet?<PetLevelBadge bond={pet.care.bond}/>:<div className="account-card-desc">{tr({zh:'领养一个小伙伴，一起长大。',en:'Adopt a little friend and grow together.'})}</div>}
    </div>
  </AppLink>;
}
