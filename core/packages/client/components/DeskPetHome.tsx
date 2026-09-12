'use client';

import { useEffect, useRef, useState } from 'react';
import { Apple, Hand, Heart, Moon, Sparkles, Star, Check, Zap, Loader2 } from 'lucide-react';
import AppLink from '@/components/AppLink';
import PetLevelBadge from '@/components/PetLevelBadge';
import { tr, useLang } from '@/i18n/tr';
import { useAuthStore } from '@/lib/auth-store';
import { adoptPet, careForPet, getMyPets, type AdoptedPet } from '@/lib/deskpet-api';
import { CARE_ACTIONS, careWait, currentCare, petLevel, type CareAction } from '@/lib/deskpet-care';
import { petCareArt, petCareDuration, type ThemeId } from '@/lib/deskpet-themes';
import { getRootBeastScene } from '@/lib/deskpet-rootbeast';
import './DeskPetHome.css';

const ACTIONS = {
  feed: { icon: Apple, label: { zh: '喂食', en: 'Feed' }, reply: { zh: '吃饱啦，谢谢你的点心。', en: 'That was delicious. Thank you!' } },
  pet: { icon: Hand, label: { zh: '摸摸', en: 'Pet' }, reply: { zh: '再摸一下，好不好？', en: 'One more little head scratch?' } },
  play: { icon: Sparkles, label: { zh: '玩耍', en: 'Play' }, reply: { zh: '和你一起玩，最开心。', en: 'Playing together is my favorite.' } },
  rest: { icon: Moon, label: { zh: '小睡', en: 'Nap' }, reply: { zh: '眯一会儿，醒来再找你。', en: 'A tiny nap. See you in a moment.' } },
};

export default function DeskPetHome({ character, label, locked = false }: {
  character: ThemeId; label: { zh: string; en: string }; locked?: boolean;
}) {
  const user = useAuthStore(s => s.user);
  const lang = useLang();
  const owner = user ? String(user.uid ?? user.wcaId) : '';
  const [record, setRecord] = useState<{ owner: string; pets: AdoptedPet[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(0);
  const [reaction, setReaction] = useState<{ action: CareAction; at: number; src: string; duration: number; gained: boolean; leveled: boolean } | null>(null);
  const generation = useRef(0);
  const readVersion = useRef(0);
  const [reload, setReload] = useState(0);
  const busy = useRef(false);
  const selected = record?.owner === owner ? record.pets.find(p => p.id === character) : undefined;
  const care = selected && currentCare(selected.care, now || selected.care.updatedAt);
  const rank = petLevel(care?.bond ?? 0);
  useEffect(() => {
    const g = ++generation.current;
    busy.current = false; setSaving(false); setReaction(null); setError(''); setLoading(true);
    const load = () => {
      if (busy.current) return;
      const read = ++readVersion.current;
      if (!owner) { setRecord(null); setLoading(false); return; }
      void getMyPets().then(pets => {
        if (generation.current === g && readVersion.current === read && !busy.current) { setRecord({ owner, pets }); setError(''); }
      }).catch(() => { if (generation.current === g && readVersion.current === read) setError(tr({ zh: '暂时没能连上小窝，请重试。', en: 'Could not reach your pet home. Please retry.' })); })
        .finally(() => { if (generation.current === g && readVersion.current === read) setLoading(false); });
    };
    load(); setNow(Date.now());
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    window.addEventListener('focus', load);
    return () => { generation.current++; clearInterval(clock); window.removeEventListener('focus', load); };
  }, [owner, character, reload]);
  useEffect(() => {
    if (!reaction) return;
    const timer = setTimeout(() => setReaction(null), Math.max(0,reaction.at+reaction.duration-Date.now()));
    return () => clearTimeout(timer);
  }, [reaction]);
  const update = (pet: AdoptedPet) => setRecord(old => ({ owner, pets: [...(old?.owner === owner ? old.pets.filter(p=>p.id!==pet.id) : []),pet] }));
  const interact = async (action?: CareAction) => {
    if (!owner || locked || busy.current || reaction || loading || error || (action && !selected)) return;
    busy.current = true; readVersion.current++; setSaving(true);
    const g = generation.current;
    try {
      if (!action) {
        const pet = await adoptPet(character);
        if (g !== generation.current) return;
        update(pet); setNow(Date.now());
        setReaction({ action: 'pet', at: Date.now(), src: petCareArt(character,'pet'), duration: petCareDuration(character,'pet'), gained: false, leveled: false });
      } else {
        const result = await careForPet(character, action);
        if (g !== generation.current) return;
        update(result.pet); setNow(Date.now());
        if (result.accepted) {
          const special = character === 'rootbeast' ? getRootBeastScene(action==='rest' && rank.level>=4 ? 'rootbeast:moon-hug' : action==='play' && rank.level>=16 ? 'rootbeast:dance' : undefined) : undefined;
          const src = special?.src ?? petCareArt(character,action);
          setReaction({ action, at: Date.now(), src, duration: special?.durationMs ?? petCareDuration(character,action), gained: result.gained, leveled: petLevel(result.pet.care.bond).level > rank.level });
        }
      }
      window.dispatchEvent(new Event('pets:updated'));
    } catch { if (g === generation.current) setError(tr({ zh: '这次没有保存成功，请重试。', en: 'Could not save. Please retry.' })); }
    finally { if (g === generation.current) { busy.current=false; setSaving(false); } }
  };
  const days = selected && now ? Math.max(1, Math.floor((now-new Date(selected.adoptedAt).getTime())/86400000)+1) : 1;
  const message = reaction ? reaction.leveled ? tr({zh:`升级啦！现在是 Lv.${rank.level}`,en:`Level up! Now Lv.${rank.level}`})
    : reaction.action==='feed' && now-reaction.at < reaction.duration*.9 ? tr({zh:'咔嚓，慢慢嚼……',en:'Crunch, crunch…'}) : tr(ACTIONS[reaction.action].reply)
    : selected ? tr({zh:'你来啦。今天想一起做点什么？',en:'You’re here. What shall we do today?'}) : tr({zh:'第一眼见到你，就想跟你回家。',en:'A little friend, ready to come home with you.'});
  return <section className="pet-home" data-adopted={!!selected} aria-label={tr({zh:'宠物小窝',en:'Pet home'})}>
    <div className="pet-home-scene">
      <div className="pet-home-orbit" aria-hidden />
      <div className="pet-home-scene-top"><span className="pet-home-scene-caption">{selected ? tr({zh:`相伴第 ${days} 天`,en:`Day ${days} together`}) : tr({zh:'等一个属于自己的家',en:'A place to call home'})}</span>{care && <PetLevelBadge bond={care.bond}/>}</div>
      <button type="button" className="pet-home-stage" data-pet={character} onClick={()=>void interact('pet')}
        disabled={!selected || !!reaction || saving || locked || loading || !!error} aria-label={tr({zh:'摸摸宠物',en:'Pet your companion'})}>
        <img key={`${character}-${reaction?.at ?? 'idle'}`} src={reaction?.src ?? petCareArt(character,'idle')} alt={tr(label)} draggable={false} />
        {reaction?.gained && <span className="pet-home-gain" key={reaction.at}><Star size={16}/>+1</span>}
      </button>
      <p className="pet-home-message" role="status">{message}</p>
      {care && <div className="pet-home-actions">{CARE_ACTIONS.map(action=>{
        const {icon:Icon,label:actionLabel}=ACTIONS[action];
        const wait = Math.ceil(careWait(care,action,now)/1000);
        return <button type="button" key={action} onClick={()=>void interact(action)} disabled={saving || !!reaction || wait>0 || locked || !!error || (action==='play' && care.energy<15)}>
          <span><Icon size={22}/>{care.rewarded.includes(action) && <Check size={10} className="pet-home-action-done"/>}</span><strong>{tr(actionLabel)}</strong>
          <small>{wait ? `${wait}s` : care.rewarded.includes(action) ? tr({zh:'再陪一会儿',en:'More time together'}) : '+1 XP'}</small>
        </button>;
      })}</div>}
    </div>
    <div className="pet-home-details">
      <span className="pet-home-eyebrow">{selected ? tr({zh:'我的伙伴',en:'MY COMPANION'}) : tr({zh:'领养一份小小的陪伴',en:'A LITTLE COMPANY'})}</span>
      <h2>{tr(label)}</h2>
      <p className="pet-home-intro">{selected ? tr({zh:'把平凡的一天，变成我们的回忆。',en:'Making ordinary days a little more ours.'}) : tr({zh:'喂一口点心，摸摸小脑袋。从今天起，一起长大。',en:'A little snack. A gentle head scratch. A friendship that grows with you.'})}</p>
      {care ? <>
        <div className="pet-home-level"><PetLevelBadge bond={care.bond}/></div>
        <progress value={rank.progress} max={1} aria-label={tr({zh:'等级进度',en:'Level progress'})}/>
        <div className="pet-home-progress-label"><span>{rank.next===null ? tr({zh:'满级伙伴',en:'Fully grown friendship'}) : tr({zh:`再 ${rank.next-rank.xp} XP 升级`,en:`${rank.next-rank.xp} XP to next level`})}</span><span>{care.rewarded.length}/4 {tr({zh:'今日陪伴',en:'today'})}</span></div>
        <div className="pet-home-needs">{([{key:'food',icon:Apple,label:{zh:'饱腹',en:'Food'}},{key:'mood',icon:Heart,label:{zh:'心情',en:'Mood'}},{key:'energy',icon:Zap,label:{zh:'活力',en:'Energy'}}] as const).map(({key,icon:Icon,label:needLabel})=><div key={key}><span><Icon size={15}/>{tr(needLabel)}<b>{Math.round(care[key])}</b></span><meter min={0} max={100} value={care[key]} aria-label={tr(needLabel)}/></div>)}</div>
        <details className="pet-home-growth"><summary>{tr({zh:'星星，慢慢变成太阳',en:'Little stars become suns'})}</summary>
          <p>{tr({zh:'每天四种互动各得 1 XP。4 颗星变月亮，4 个月亮变太阳；休息几天也不会掉级。',en:'Each daily interaction earns 1 XP. Four stars make a moon; four moons make a sun. Time away never lowers your level.'})}</p>
          {character==='rootbeast' && <p>{tr({zh:'Lv.4 解锁抱月小睡 · Lv.16 解锁开心舞步',en:'Lv.4: moon-hug nap · Lv.16: happy dance'})}</p>}
        </details>
      </> : loading && owner ? <p className="pet-home-status"><Loader2 size={16}/>{tr({zh:'正在打开小窝…',en:'Opening your home…'})}</p>
        : locked ? <p>{tr({zh:'这位伙伴还未开放领养。',en:'This companion is not available for adoption yet.'})}</p>
        : owner ? <button type="button" className="pet-primary" onClick={()=>void interact()} disabled={saving || !!error}>{saving ? <Loader2 size={18}/> : <Heart size={18}/>} {tr({zh:`领养${label.zh}`,en:`Adopt ${label.en}`})}</button>
        : <AppLink className="pet-primary" href={`/account?next=${encodeURIComponent(`${lang==='zh'?'/zh':''}/pets?pet=${character}`)}`} prefetch={false}><Heart size={18}/>{tr({zh:'登录并领养',en:'Sign in to adopt'})}</AppLink>}
      {error && <div className="pet-home-error" role="alert"><p>{error}</p><button type="button" onClick={()=>setReload(value=>value+1)}>{tr({zh:'重试',en:'Retry'})}</button></div>}
      <AppLink className="pet-home-gallery-link" href={`/pets/gallery?pet=${character}`} prefetch={false}><Sparkles size={16}/>{tr({zh:'看看它的更多小表情',en:'Explore its little expressions'})}</AppLink>
    </div>
  </section>;
}
