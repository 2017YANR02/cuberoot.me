import { EVENT_DISPLAY_EN, EVENT_DISPLAY_ZH, WCA_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import { EVENT_NAME_BY_ID } from '@cuberoot/shared/record-news';

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeEvent = (text: string) => text.toLowerCase().replace(/×/g,'x').replace(/\s+/g,' ').trim();
const eventAliases = new Map<string,string>();
// Reuse published names; add qualified spellings of the existing short labels.
// Include known non-WCA names so "四阶金字塔" cannot become a 4x4 attendance filter.
for (const id of Object.keys(EVENT_DISPLAY_ZH)) {
  const labels=[id,EVENT_DISPLAY_ZH[id],EVENT_DISPLAY_EN[id],EVENT_NAME_BY_ID[id]];
  if (/^[345]{3}[a-z]+$/.test(id)) {
    const base=id.slice(0,3);
    labels.push(EVENT_DISPLAY_ZH[base]+(id.endsWith('bf') && !id.includes('mb')?'盲拧':EVENT_DISPLAY_ZH[id]));
    labels.push(EVENT_DISPLAY_EN[base]+' '+EVENT_DISPLAY_EN[id]);
  }
  for (const label of labels) if (label) eventAliases.set(normalizeEvent(label),id);
}
export const eventPattern = new RegExp([...eventAliases.keys()].sort((a,b)=>b.length-a.length).map(label=>{
  const pattern=escape(label).replace(/(\d)x(?=\d)/g,'$1[x×]').replace(/ /g,'\\s+');
  return /[\u3400-\u9fff]/.test(label)?pattern:`\\b${pattern}\\b`;
}).join('|'),'gi');
export const eventAliasId=(label:string)=>eventAliases.get(normalizeEvent(label));
export function eventForLabel(label:string) {
  const id=eventAliasId(label);
  return WCA_EVENT_ORDER.find(event=>event===id);
}

export function roundEventMentions(text:string) {
  return [...text.matchAll(eventPattern)].map(([label])=>({label,event:eventForLabel(label)}));
}

export function singleRoundEvent(text:string) {
  const mentions=roundEventMentions(text);
  if (mentions.length!==1) return;
  const {label,event}=mentions[0];
  return event ? {label,event} : undefined;
}
