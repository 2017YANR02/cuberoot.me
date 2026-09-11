'use client';

import { useEffect, useRef, useState } from 'react';
import { Apple, Hand, Heart, Moon, Sparkles, Check, Zap } from 'lucide-react';
import { CompactSelect } from '@/components/CompactSelect';
import { ClearButton } from '@/components/ClearButton';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { tr } from '@/i18n/tr';
import { persistItem } from '@/lib/safe-storage';
import { BOND_STAGES, CARE_ACTIONS, PET_CARE_KEY, careFor, careWait, createPetCare, currentCare,
  readCareBook, serializeCareBook, type CareAction, type CareBook } from '@/lib/deskpet-care';
import './DeskPetHome.css';

const ACTIONS = {
  feed: { icon: Apple, label: { zh: '喂食', en: 'Feed' }, hint: { zh: '饱腹 +25', en: 'Food +25' }, reply: { zh: '吃饱啦，再陪你一会儿！', en: 'All full. Ready to keep you company!' } },
  pet: { icon: Hand, label: { zh: '摸摸', en: 'Pet' }, hint: { zh: '心情 +18', en: 'Mood +18' }, reply: { zh: '蹭蹭你的手，今天也很喜欢你。', en: 'A little nuzzle, just for you.' } },
  play: { icon: Sparkles, label: { zh: '玩耍', en: 'Play' }, hint: { zh: '心情 +25', en: 'Mood +25' }, reply: { zh: '一起玩，就是最开心的事！', en: 'Everything is more fun with you!' } },
  rest: { icon: Moon, label: { zh: '打个盹', en: 'Nap' }, hint: { zh: '活力 +20', en: 'Energy +20' }, reply: { zh: '眯一小会儿，补充一点活力。', en: 'A tiny nap to recharge.' } },
};

export default function DeskPetHome({ character, characters, animations, durations, onSelectChar, onInteract, onClose }: {
  character: string;
  characters: { id: string; label: { zh: string; en: string }; thumb: string }[];
  animations: Record<CareAction | 'idle', string>;
  durations: Record<CareAction, number>;
  onSelectChar: (id: string) => void;
  onInteract: (action: CareAction) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [book, setBook] = useState<CareBook>({});
  const bookRef = useRef<CareBook>({});
  const [now, setNow] = useState(0);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(true);
  const [reaction, setReaction] = useState<{ action: CareAction; at: number; character: string } | null>(null);
  const busyUntil = useRef(0);
  const ids = characters.map(p => p.id).join(',');
  useModalDismiss(onClose);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  useEffect(() => {
    const load = () => {
      const at = Date.now();
      try { bookRef.current = readCareBook(localStorage.getItem(PET_CARE_KEY), ids.split(','), at); }
      catch { setSaved(false); }
      setBook(bookRef.current); setNow(at); setReady(true);
    };
    load();
    const sync = (event: StorageEvent) => { if (event.key === PET_CARE_KEY || event.key === null) load(); };
    window.addEventListener('storage', sync);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(clock); window.removeEventListener('storage', sync); };
  }, [ids]);
  const selected = characters.find(p => p.id === character);
  const pet = currentCare(book[character] ?? createPetCare(now), now);
  const active = reaction?.character === character ? reaction : null;
  const duration = active ? durations[active.action] : 0;
  useEffect(() => {
    if (!reaction) return;
    const timeout = setTimeout(() => setReaction(null), Math.max(0, reaction.at + duration - Date.now()));
    return () => clearTimeout(timeout);
  }, [reaction, duration]);
  const stageIndex = BOND_STAGES.findLastIndex(stage => pet.bond >= stage.at);
  const stage = BOND_STAGES[stageIndex];
  const nextStage = BOND_STAGES[stageIndex + 1];
  const progress = nextStage ? (pet.bond - stage.at) / (nextStage.at - stage.at) : 1;

  const interact = (action: CareAction) => {
    const at = Date.now();
    if (!ready || at < busyUntil.current) return;
    // Preserve other tabs' latest records; storage failures retain session progress.
    let latest = bookRef.current;
    if (saved) {
      try { latest = readCareBook(localStorage.getItem(PET_CARE_KEY), ids.split(','), at); } catch { /* keep session */ }
    }
    const result = careFor(latest[character] ?? createPetCare(at), action, at);
    if (!result.accepted) return;
    const updated = { ...latest, [character]: result.pet };
    bookRef.current = updated; setBook(updated); setNow(at);
    setSaved(persistItem(PET_CARE_KEY, serializeCareBook(updated)));
    busyUntil.current = at + durations[action];
    setReaction({ action, at, character });
    onInteract(action);
  };

  return <dialog ref={dialog} className="pet-home" aria-labelledby="pet-home-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) {
      const r = event.currentTarget.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose();
    } }}>
    <div className="pet-home-inner">
      <header className="pet-home-header">
        <h2 id="pet-home-title">{tr({ zh: '宠物小窝', en: 'Pet home' })}</h2>
        <ClearButton variant="standalone" onClick={onClose} ariaLabel={tr({ zh: '关闭', en: 'Close' })} />
      </header>
      <CompactSelect value={character} onChange={id => { busyUntil.current = 0; setReaction(null); onSelectChar(id); }}
        ariaLabel={tr({ zh: '小窝里的宠物', en: 'Pet in your home' })} valueText={selected ? tr(selected.label) : ''}
        label={selected ? tr(selected.label) : ''}
        items={characters.map(p => ({ value: p.id, label: <span className="pet-home-choice"><img src={p.thumb} alt="" />{tr(p.label)}</span> }))} />
      <div className="pet-home-stage" data-pet={character}>
        <img key={`${character}-${active?.at ?? 'idle'}`} src={animations[active?.action ?? 'idle']} alt={selected ? tr(selected.label) : ''} draggable={false} />
        {active && <span className="pet-home-reaction" key={active.at} aria-hidden>{active.action === 'feed' ? <Apple /> : active.action === 'rest' ? <Moon /> : <Heart />}</span>}
      </div>
      <p className="pet-home-message" role="status">{active ? tr(ACTIONS[active.action].reply) : tr({ zh: '在这里，陪你慢慢变熟。', en: 'A little company, a little closer each day.' })}</p>
      <div className="pet-home-needs">
        {([
          { key: 'food', icon: Apple, label: { zh: '饱腹', en: 'Food' } },
          { key: 'mood', icon: Heart, label: { zh: '心情', en: 'Mood' } },
          { key: 'energy', icon: Zap, label: { zh: '活力', en: 'Energy' } },
        ] as const).map(({ key, icon: Icon, label }) => <div key={key}>
          <span><Icon size={14} />{tr(label)}<b>{Math.round(pet[key])}</b></span>
          <meter min={0} max={100} value={pet[key]} aria-label={tr(label)} />
        </div>)}
      </div>
      <div className="pet-home-actions">
        {CARE_ACTIONS.map(action => {
          const { icon: Icon, label, hint } = ACTIONS[action];
          const seconds = Math.ceil(careWait(pet, action, now) / 1000);
          const tired = action === 'play' && pet.energy < 15;
          return <button type="button" className="pet-home-action" key={action} onClick={() => interact(action)}
            disabled={!ready || !!active || seconds > 0 || tired}>
            <Icon size={23} /><strong>{tr(label)}</strong>
            <small>{seconds ? `${seconds}s` : tired ? tr({ zh: '先休息', en: 'Rest first' }) : tr(hint)}</small>
          </button>;
        })}
      </div>
      <section className="pet-home-bond" aria-label={tr({ zh: '亲密度', en: 'Friendship' })}>
        <div className="pet-home-bond-title"><Heart size={17} /><strong>{tr(stage.label)}</strong><span>{pet.bond} {tr({ zh: '亲密度', en: 'bond' })}</span></div>
        <progress value={progress} max={1} aria-label={tr({ zh: '成长进度', en: 'Friendship progress' })} />
        <p>{nextStage ? tr({ zh: `再获得 ${nextStage.at - pet.bond} 点，成为「${nextStage.label.zh}」`, en: `${nextStage.at - pet.bond} more to become ${nextStage.label.en.toLowerCase()}` }) : tr({ zh: '已经是最亲密的伙伴啦，继续积攒共同的回忆。', en: 'Best friends already. Keep making memories together.' })}</p>
        <div className="pet-home-daily"><span>{tr({ zh: '今日陪伴', en: 'Today together' })}</span>
          {CARE_ACTIONS.map(action => <span key={action} className={pet.rewarded.includes(action) ? 'is-done' : ''} title={tr(ACTIONS[action].label)}>
            {pet.rewarded.includes(action) ? <Check size={13} /> : <Heart size={13} />}{tr(ACTIONS[action].label)}
          </span>)}
        </div>
        <p>{tr({ zh: '每天每种互动首次获得 1 点亲密度，之后也能继续玩。', en: 'The first of each interaction earns 1 bond daily. Keep playing after that, too.' })}</p>
      </section>
      <footer className="pet-home-footer">{saved ? tr({ zh: '进度保存在此浏览器。离开后，亲密度也会保留。', en: 'Saved in this browser. Your friendship stays while you’re away.' }) : tr({ zh: '浏览器未能保存，当前进度只在本次打开期间保留。', en: 'Could not save. Progress is kept only while this home stays open.' })}</footer>
    </div>
  </dialog>;
}
