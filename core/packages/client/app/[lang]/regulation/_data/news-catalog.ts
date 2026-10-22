import {REG_NEWS} from './news';
import posts from './posts-index.json';
// Retain curated deep links; show one title for each official source in the index.
const curatedSources:Record<string,string>={
 '4-pad-2027':'adoption-of-4-pad-timing-august-2026',
 'official-events-2026':'changes-to-the-wca-s-list-of-official-events-june-2026',
 'requirements-policy-5-5':'wca-competition-requirements-policy-update-5-5-may-2026',
};
export const ALL_NEWS=[...posts,...Object.values(REG_NEWS)];
// Month-only dates sort before dated posts in that month; the displayed date stays unchanged.
const dateSortKey=(date:string)=>/^\d{4}-\d{2}$/.test(date)?date+'-99':date;
export const NEWS_INDEX=[...posts,...Object.values(REG_NEWS).filter(e=>!posts.some(p=>p.id===curatedSources[e.id]))].sort((a,b)=>dateSortKey(b.date).localeCompare(dateSortKey(a.date))||a.id.localeCompare(b.id));
export const LATEST_NEWS=NEWS_INDEX[0];
