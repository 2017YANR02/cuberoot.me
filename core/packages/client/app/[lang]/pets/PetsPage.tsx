'use client';

import { useEffect, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { Heart, Sparkles, Share2, Check, Lock, ArrowUpRight } from 'lucide-react';
import AppLink from '@/components/AppLink';
import HomeLink from '@/components/HomeLink';
import DeskPetHome from '@/components/DeskPetHome';
import DeskPetGallery from '@/components/DeskPetGallery';
import { hasAdminAccess, useAuthStore } from '@/lib/auth-store';
import { getDeskPetCatalog } from '@/lib/deskpet-api';
import { THEMES, THEME_IDS, type ThemeId } from '@/lib/deskpet-themes';
import { resolveDeskPets, type DeskPetCatalog } from '@cuberoot/shared/deskpet';
import { getDeskPetScene } from '@/lib/deskpet-playtime';
import { tr, useLang } from '@/i18n/tr';
import './pets.css';

export default function PetsPage({ gallery = false }: { gallery?: boolean }) {
  const lang = useLang();
  const user = useAuthStore(s=>s.user);
  const isAdmin = hasAdminAccess(user);
  const [petId,setPetId] = useQueryState('pet',parseAsString.withDefault('rootbeast'));
  const [scene,setScene] = useQueryState('scene',parseAsString.withOptions({history:'push'}));
  const [collection,setCollection] = useQueryState('collection',parseAsString.withDefault('all'));
  const [catalog,setCatalog] = useState<DeskPetCatalog | null>(null);
  const [failed,setFailed] = useState(false);
  const [retry,setRetry] = useState(0);
  const [shareState,setShareState] = useState<'idle'|'copied'|'failed'>('idle');
  useEffect(()=>{
    let active=true;
    const load=()=>void getDeskPetCatalog().then(value=>{if(active){setCatalog(current=>!current || value.revision>=current.revision ? value : current);setFailed(false);}}).catch(()=>{if(active){setCatalog(null);setFailed(true);}});
    load();window.addEventListener('focus',load);
    const timer=window.setInterval(load,60000);
    return ()=>{active=false;clearInterval(timer);window.removeEventListener('focus',load);};
  },[retry,isAdmin]);
  const choices = catalog ? resolveDeskPets(THEME_IDS,catalog.entries).filter(entry=>!entry.removed && (isAdmin || !entry.locked)).map(entry=>({
    ...entry,id:entry.id as ThemeId,label:entry.label ?? THEMES[entry.id as ThemeId].label,
    thumb:THEMES[entry.id as ThemeId].thumb,thumbScale:THEMES[entry.id as ThemeId].thumbScale,
  })) : [];
  const pet=choices.find(p=>p.id===petId) ?? choices[0];
  const route=gallery?'/pets/gallery':'/pets';
  const query=new URLSearchParams({pet:pet?.id ?? 'rootbeast'});
  const sharedScene=getDeskPetScene(scene);
  if(gallery && sharedScene?.character===pet?.id && scene)query.set('scene',scene);
  if(gallery && collection!=='all')query.set('collection',collection);
  const shareUrl=`https://cuberoot.me${lang==='zh'?'/zh':''}${route}?${query}`;
  const share=async()=>{
    try {
      if(navigator.share)await navigator.share({title:gallery && sharedScene?.character===pet?.id && sharedScene ? tr(sharedScene) : tr({zh:'来认识我的小伙伴',en:'Meet my little companion'}),url:shareUrl});
      else {await navigator.clipboard.writeText(shareUrl);setShareState('copied');}
    } catch(error){if(!(error instanceof DOMException && error.name==='AbortError'))setShareState('failed');}
  };
  useEffect(()=>{setShareState('idle');},[petId,scene,collection]);
  return <main className="pets-page">
    <header className="pets-header">
      <HomeLink className="pets-wordmark" prefetch={false}>CubeRoot <span>companions</span></HomeLink>
      <nav aria-label={tr({zh:'宠物导航',en:'Pet navigation'})}>
        <AppLink className="pets-nav-action" href={`/pets?pet=${pet?.id ?? 'rootbeast'}`} prefetch={false} aria-current={!gallery?'page':undefined}><Heart size={15}/>{tr({zh:'领养与陪伴',en:'Adopt & care'})}</AppLink>
        <AppLink className="pets-nav-action" href={`/pets/gallery?pet=${pet?.id ?? 'rootbeast'}`} prefetch={false} aria-current={gallery?'page':undefined}><Sparkles size={15}/>{tr({zh:'宠物图鉴',en:'Gallery'})}</AppLink>
        <button className="pets-nav-action" type="button" aria-label={tr({zh:'分享',en:'Share'})} onClick={()=>void share()} disabled={!pet}>{shareState==='copied'?<Check size={16}/>:<Share2 size={16}/>}<span role="status">{shareState==='copied'?tr({zh:'已复制',en:'Copied'}):tr({zh:'分享',en:'Share'})}</span></button>
      </nav>
    </header>
    <div className="pets-heading"><span>{gallery?tr({zh:'每个小动作，都值得收藏',en:'THE LITTLE THINGS'}):tr({zh:'陪伴，是每天的小事',en:'A FRIEND, EVERY DAY'})}</span><h1>{gallery?tr({zh:'每一个小表情，都有故事。',en:'A little expression. A little story.'}):tr({zh:'让日常，多一点陪伴。',en:'A little friend for everyday life.'})}</h1>
      <p>{gallery?tr({zh:'挑一段喜欢的，送给今天想起的人。',en:'Find a favorite moment. Share it with someone on your mind.'}):tr({zh:'领养、互动、一起长大。',en:'Adopt. Play. Grow together.'})}</p></div>
    {shareState==='failed' && <label className="pets-share-fallback">{tr({zh:'复制这个链接分享',en:'Copy this link to share'})}<input className="pets-share-url" readOnly value={shareUrl} onFocus={e=>e.currentTarget.select()}/></label>}
    {failed ? <div className="pets-empty" role="alert"><p>{tr({zh:'小伙伴暂时没能赶来。',en:'Our little friends could not load.'})}</p><button className="pet-primary pets-retry-action" onClick={()=>setRetry(v=>v+1)} type="button">{tr({zh:'再试一次',en:'Try again'})}</button></div>
      : !catalog ? <div className="pets-loading" aria-label={tr({zh:'正在布置小窝',en:'Preparing the pet home'})}/>
      : !pet ? <p className="pets-empty">{tr({zh:'新的小伙伴还在准备中。',en:'New companions are on their way.'})}</p>
      : <>
        {gallery && <div className="pets-roster" aria-label={tr({zh:'选择宠物',en:'Choose a pet'})}>{choices.map(p=><button className="pets-roster-option" type="button" key={p.id} aria-pressed={p.id===pet.id} onClick={()=>{void setPetId(p.id);void setScene(null);void setCollection('all');}}><span className="pets-roster-art"><img src={p.thumb} alt="" style={{transform:`scale(${p.thumbScale??1})`}}/></span><span>{tr(p.label)}</span>{p.locked&&<Lock size={13}/>}</button>)}</div>}
        {gallery ? <DeskPetGallery character={pet.id} characters={choices} selected={scene} setSelected={value=>void setScene(value)} collectionId={collection} setCollectionId={value=>void setCollection(value)}/>
          : <DeskPetHome key={pet.id} character={pet.id} label={pet.label} locked={pet.locked}/>}
        {!gallery && <section className="pets-meet"><div className="pets-section-title"><h2>{tr({zh:'认识小伙伴',en:'Meet the companions'})}</h2><AppLink href="/pets/gallery" prefetch={false}>{tr({zh:'探索图鉴',en:'Explore the gallery'})}<ArrowUpRight size={14}/></AppLink></div>
          <div className="pets-roster" aria-label={tr({zh:'选择宠物',en:'Choose a pet'})}>{choices.map(p=><button className="pets-roster-option" type="button" key={p.id} aria-pressed={p.id===pet.id} onClick={()=>void setPetId(p.id)}><span className="pets-roster-art"><img src={p.thumb} alt="" style={{transform:`scale(${p.thumbScale??1})`}}/></span><span>{tr(p.label)}</span>{p.locked?<Lock size={13}/>:p.id===pet.id?<Check size={14}/>:<Heart size={14}/>}</button>)}</div>
        </section>}
      </>}
    <footer className="pets-footer"><span>CubeRoot companions</span><AppLink href="/account" prefetch={false}>{tr({zh:'我的账号',en:'My account'})}<ArrowUpRight size={12}/></AppLink></footer>
  </main>;
}
