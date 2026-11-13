import { algorithmCaseImage } from '@cuberoot/puzzle-render-core/alg-case-image';
import { createAssistantAlgorithmLoader, replaceAssistantAlgorithm } from '@cuberoot/shared/site-assistant-algorithms';
import type { AssistantAlgorithmCard } from '@cuberoot/shared/site-assistant';
import type { AlgFile } from '@cuberoot/shared/alg-types';
import { ASSISTANT_ERROR_TEXT, assistantAnswerHistory, assistantAnswerText, boundAssistantHistory, isAssistantAlgorithms, SITE_ASSISTANT_QUESTION_MAX_LENGTH, type AssistantAnswer, type AssistantAlgorithms, type AssistantMessage, type AssistantErrorCode } from '@cuberoot/shared/site-assistant';
import { getStoredSession, requestJson, ApiError } from '../../lib/auth';
import { miniProgramApi } from '../../lib/platform';
import { getMiniProgramLocale, tr } from '../../lib/i18n';
import { applyNativeAppearance } from '../../lib/appearance';
import { hidePublicShareMenu } from '../../lib/share';
import { API_ORIGIN, SITE_ORIGIN } from '../../lib/runtime-config';
import themes from '../../theme.json';

interface Turn { question:string; result:AssistantAnswer; requestId?:string }
interface Group extends AssistantAlgorithms { artifactIndex:number; cards: Array<AssistantAlgorithms['cards'][number] & {image?:string;imageFailed?:boolean;switching?:boolean;switchFailed?:boolean}> }
interface ViewTurn {question:string; answer:string; groups:Group[]; other:string; requestId?:string}
const labels = () => ({title:tr({zh:'问 CubeRoot',en:'Ask CubeRoot'}), send:tr({zh:'发送',en:'Send'}),
  stop:tr({zh:'停止',en:'Stop'}), thinking:tr({zh:'正在查询…',en:'Looking up sources…'}), copy:tr({zh:'复制公式',en:'Copy algorithm'}),
  another:tr({zh:'换一条公式',en:'Another algorithm'}), more:tr({zh:'加载更多',en:'Load more'}), clear:tr({zh:'清除',en:'Clear'}),
  formula:tr({zh:'公式',en:'Algorithm'}), loading:tr({zh:'加载中…',en:'Loading…'}), retry:tr({zh:'重试',en:'Retry'}),
  switchFailed:tr({zh:'公式加载失败，请重试。',en:'Could not load algorithms. Please retry.'}),
  newChat:tr({zh:'新对话',en:'New conversation'}), account:tr({zh:'前往账号',en:'Open account'}),
  placeholder:tr({zh:'例如：展示所有 PLL',en:'For example: show all PLL cases'}),
  share:tr({zh:'分享回答',en:'Share response'}), imageFailed:tr({zh:'状态图加载失败',en:'Diagram could not be loaded'}),
  pdf:tr({zh:'导出 PDF',en:'Export PDF'}), exporting:tr({zh:'正在导出…',en:'Exporting…'}),
});
function view(turn:Turn):ViewTurn {
  const groups = turn.result.artifacts?.flatMap((a,artifactIndex)=>isAssistantAlgorithms(a) ? [{...a,artifactIndex}] : []) ?? [];
  return {question:turn.question, requestId:turn.requestId,
    answer:turn.result.answer.replace(/\[\[([^\]\n]+)\]\]/g, (_m,id:string)=>turn.result.sources.find(s=>s.id===id)?.title ?? ''),
    groups:groups.map(a=>({...a,cards:a.cards.map(c=>({...c}))})),
    other:assistantAnswerText({...turn.result, answer:'', artifacts:turn.result.artifacts?.filter(a=>a.kind!=='algorithms')},SITE_ORIGIN),
  };
}
function mode(a:AssistantAlgorithms) { return {both:{zh:'状态图和公式',en:'diagrams and algorithms'},image:{zh:'只显示状态图',en:'diagrams only'},text:{zh:'只显示公式文字',en:'algorithm text only'}}[a.display]; }
const loadNextAlgorithm = createAssistantAlgorithmLoader((puzzle,set)=>requestJson<AlgFile>(`/alg/sets/${encodeURIComponent(puzzle)}/${encodeURIComponent(set)}`,{timeoutMs:10000}));

Page({
  data:{appearanceStyle:'',copy:labels(),draft:'',turns:[] as ViewTurn[],busy:false,error:'',needsAccount:false,shared:false,pdfBusy:false,changingFormula:false},
  records:[] as Turn[],owner:'',job:0,selectionEpoch:0,controller:null as AbortController|null,observer:null as WechatMiniprogram.IntersectionObserver|null,
  imageJobs:new Set<string>(),switchJobs:new Set<string>(),shareId:'',sharing:false,active:true,
  onLoad(options:Record<string,string>) { if(/^[A-Za-z0-9_-]{24}$/.test(options.shareId ?? '')) { this.shareId=options.shareId; this.setData({shared:true}); void this.readShare(); } },
  onShow() {
    this.active=true; applyNativeAppearance(); hidePublicShareMenu(); this.setData({copy:labels()});
    miniProgramApi().setNavigationBarTitle({title:labels().title});
    if(this.shareId) return;
    const user=getStoredSession()?.user, owner=user?.uid ? `${user.uid}:${user.wcaId ?? ''}` : '';
    if(owner!==this.owner) {
      this.stop(); this.owner=owner; this.records=[];
      try { const saved=owner ? miniProgramApi().getStorageSync(`assistant:${owner}`) : null;
        if(Array.isArray(saved)) this.records=saved.filter(t=>typeof t?.question==='string' && typeof t?.result?.answer==='string' && Array.isArray(t.result.sources) && (!t.result.artifacts || t.result.artifacts.every((a:{kind:string})=>a.kind!=='algorithms' || isAssistantAlgorithms(a)))).slice(-6);
      } catch { /* Keep the conversation usable without local storage. */ }
      this.render();
    }
    this.observeImages();
  },
  onReady() { this.observeImages(); },
  onHide() { this.active=false; this.stop(); this.observer?.disconnect(); },
  onUnload() { this.onHide(); },
  input(e:WechatMiniprogram.Input) { this.setData({draft:e.detail.value}); },
  clear() { this.setData({draft:''}); },
  account() { miniProgramApi().switchTab({url:'/pages/account/index'}); },
  stop() {
    ++this.job; ++this.selectionEpoch; this.controller?.abort(); this.controller=null; this.imageJobs.clear(); this.switchJobs.clear(); this.sharing=false;
    const patch:Record<string,unknown>={busy:false,pdfBusy:false,changingFormula:false};
    this.data.turns.forEach((turn,t)=>turn.groups.forEach((group,g)=>group.cards.forEach((card,c)=>{
      if(card.switching)patch[`turns[${t}].groups[${g}].cards[${c}].switching`]=false;
    })));
    this.setData(patch);
  },
  newChat() { this.stop(); this.records=[]; this.shareId=''; this.setData({shared:false,draft:'',error:''}); this.persist(); this.render(); },
  persist() { if(this.owner) try { miniProgramApi().setStorageSync(`assistant:${this.owner}`,this.records.slice(-6)); } catch { /* Storage is optional. */ } },
  render() { this.imageJobs.clear(); this.setData({turns:this.records.map(view)},()=>this.observeImages()); },
  observeImages() {
    this.observer?.disconnect();
    if(!this.active || !this.data.turns.length) return;
    this.observer=miniProgramApi().createIntersectionObserver(this,{observeAll:true});
    this.observer.relativeToViewport({bottom:160}).observe('.assistant-card',entry=>{
      if(entry.intersectionRatio<=0) return;
      const [t,g,c]=entry.id.replace('card-','').split('-').map(Number);
      void this.draw(t,g,c);
    });
  },
  async cardImage(card:AssistantAlgorithmCard) {
    const image=await algorithmCaseImage(card);
    // SVG image documents cannot inherit the page's CSS variables.
    const muted = this.data.appearanceStyle.match(/(?:^|;)--cr-muted:([^;]+)/)?.[1] ?? themes.light.tabBarColor;
    const encoded = image.svg ? encodeURIComponent(image.svg.replace(/var\(--muted-foreground\)/g,muted)).replace(/%([0-9A-F]{2})/g,(_m,hex:string)=>String.fromCharCode(parseInt(hex,16))) : '';
    const src=encoded ? `data:image/svg+xml;base64,${miniProgramApi().arrayBufferToBase64(Uint8Array.from(encoded,c=>c.charCodeAt(0)).buffer)}` : image.src ? image.src.startsWith('/v1/') ? `${API_ORIGIN}${image.src.slice(3)}` : `${SITE_ORIGIN}${image.src}` : '';
    if(!src) throw new Error('no image');
    return src;
  },
  async draw(t:number,g:number,c:number) {
    const group=this.data.turns[t]?.groups[g],card=group?.cards[c],key=`${t}:${g}:${c}`,job=this.job;
    if(!card || group.display==='text' || card.image || this.imageJobs.has(key)) return;
    this.imageJobs.add(key);
    try {
      const src=await this.cardImage(card);
      if(this.active && this.job===job && this.data.turns[t]?.groups[g]?.cards[c]===card) this.setData({[`turns[${t}].groups[${g}].cards[${c}].image`]:src});
    } catch { if(this.active && this.job===job && this.data.turns[t]?.groups[g]?.cards[c]===card) this.setData({[`turns[${t}].groups[${g}].cards[${c}].imageFailed`]:true}); }
    finally { this.imageJobs.delete(key); }
  },
  imageError(e:WechatMiniprogram.TouchEvent) {
    const {t,g,c}=e.currentTarget.dataset;
    this.setData({[`turns[${t}].groups[${g}].cards[${c}].image`]:'',[`turns[${t}].groups[${g}].cards[${c}].imageFailed`]:true});
  },
  copyAlg(e:WechatMiniprogram.TouchEvent) {
    const {t,g,c}=e.currentTarget.dataset; const card=this.data.turns[Number(t)]?.groups[Number(g)]?.cards[Number(c)];
    if(card) miniProgramApi().setClipboardData({data:card.alg});
  },
  async another(e:WechatMiniprogram.TouchEvent) {
    const t=Number(e.currentTarget.dataset.t),g=Number(e.currentTarget.dataset.g),c=Number(e.currentTarget.dataset.c);
    const group=this.data.turns[t]?.groups[g],artifact=this.records[t]?.result.artifacts?.[group?.artifactIndex];
    const card=artifact?.kind==='algorithms' ? artifact.cards[c] : undefined,key=`${t}:${g}:${c}`,epoch=this.selectionEpoch,owner=this.owner;
    if(this.shareId || this.data.pdfBusy || !card || card.caseId===undefined || this.switchJobs.has(key)) return;
    const current=()=>{
      const latest=this.records[t]?.result.artifacts?.[group.artifactIndex];
      return this.active && this.selectionEpoch===epoch && this.owner===owner && latest?.kind==='algorithms' && latest.cards[c]===card;
    };
    this.switchJobs.add(key);
    this.setData({changingFormula:true,[`turns[${t}].groups[${g}].cards[${c}].switching`]:true,[`turns[${t}].groups[${g}].cards[${c}].switchFailed`]:false});
    try {
      const next=await loadNextAlgorithm(card);
      if(!current())return;
      const image=group.display==='text' ? undefined : await this.cardImage(next);
      if(!current())return;
      const turn=this.records[t];
      if(!turn)return;
      const result=replaceAssistantAlgorithm(turn.result,group.artifactIndex,c,card,next);
      if(result===turn.result)return;
      this.records=this.records.map((item,i)=>i===t ? {...item,result} : item);
      this.persist();
      this.setData({[`turns[${t}].groups[${g}].cards[${c}]`]:{...next,...(image?{image}:{}),switching:false}});
    } catch { if(current())this.setData({[`turns[${t}].groups[${g}].cards[${c}].switchFailed`]:true}); }
    finally {
      if(this.selectionEpoch===epoch) {this.switchJobs.delete(key);this.setData({changingFormula:this.switchJobs.size>0});}
      if(current())this.setData({[`turns[${t}].groups[${g}].cards[${c}].switching`]:false});
    }
  },
  more(e:WechatMiniprogram.TouchEvent) {
    const {t,g}=e.currentTarget.dataset,a=this.data.turns[Number(t)]?.groups[Number(g)];
    if(a?.nextOffset!==undefined) void this.ask(tr({zh:`继续展示 ${a.puzzle} ${a.set} ${a.query ?? ''}，从第 ${a.nextOffset+1} 个 case 开始，${mode(a).zh}。`,en:`Continue ${a.puzzle} ${a.set} ${a.query ?? ''}, starting at case ${a.nextOffset+1}, ${mode(a).en}.`}));
  },
  send() { void this.ask(this.data.draft); },
  async pdf(e:WechatMiniprogram.TouchEvent) {
    const turn=this.records[Number(e.currentTarget.dataset.t)],epoch=this.selectionEpoch,owner=this.owner,token=getStoredSession()?.token;
    if(!turn || !this.active || this.data.pdfBusy || this.switchJobs.size) return;
    const current=()=>this.active && this.selectionEpoch===epoch && this.owner===owner && getStoredSession()?.token===token && this.records.some(item=>item===turn);
    const check=()=>{if(!current()) throw new Error('PDF export cancelled');};
    this.setData({pdfBusy:true,error:''});
    try {
      const {assistantPdfCanvas, buildAssistantPdf, openAssistantPdf}=await import('../../lib/assistant-pdf');
      check();
      const canvas=await assistantPdfCanvas(this);
      const bytes=await buildAssistantPdf(turn.question,turn.result,getMiniProgramLocale(),canvas,check);
      check();await openAssistantPdf(bytes,turn.question,check);
    } catch {if(current()) this.setData({error:tr({zh:'PDF 导出失败，请重试。',en:'PDF export failed. Please retry.'})});}
    finally {if(this.selectionEpoch===epoch) this.setData({pdfBusy:false});}
  },
  async ask(raw:string) {
    const question=raw.trim(); if(this.data.busy || !question || question.length>SITE_ASSISTANT_QUESTION_MAX_LENGTH) return;
    const session=getStoredSession();
    if(!session?.user.wcaId) { this.setData({error:tr(ASSISTANT_ERROR_TEXT[session?'wca_link_required':'login_required']),needsAccount:true}); return; }
    const job=++this.job, token=session.token; this.controller=new AbortController();
    this.setData({busy:true,error:'',needsAccount:false});
    const history:AssistantMessage[]=this.records.flatMap(t=>[{role:'user' as const,content:t.question},{role:'assistant' as const,content:assistantAnswerHistory(t.result,SITE_ORIGIN)}]);
    try {
      let requestId:string|undefined;
      const result=await requestJson<AssistantAnswer>('/site-assistant',{method:'POST',token,timeoutMs:60000,signal:this.controller.signal,
        onResponseHeaders:headers=>{ const value=Object.entries(headers).find(([key])=>key.toLowerCase()==='x-assistant-request-id')?.[1]; if(typeof value==='string' && /^[0-9a-f-]{36}$/i.test(value)) requestId=value; },
        body:{question,lang:getMiniProgramLocale(),thinking:'auto',history:boundAssistantHistory(history)}});
      if(job!==this.job || getStoredSession()?.token!==token) return;
      this.records=[...this.records,{question,result,requestId}].slice(-6); this.persist(); this.setData({draft:'',busy:false}); this.render();
    } catch(error) {
      if(job!==this.job) return;
      const code=error instanceof ApiError && error.message in ASSISTANT_ERROR_TEXT ? error.message as AssistantErrorCode : 'network';
      this.setData({error:tr(ASSISTANT_ERROR_TEXT[code]),busy:false,needsAccount:code==='login_required'||code==='wca_link_required'});
    }
  },
  async share(e:WechatMiniprogram.TouchEvent) {
    const turn=this.records[Number(e.currentTarget.dataset.t)],session=getStoredSession();
    if(!turn?.requestId || !session || !this.active || this.sharing) return;
    const epoch=this.selectionEpoch,owner=this.owner;
    const current=()=>this.active && this.selectionEpoch===epoch && this.owner===owner && getStoredSession()?.token===session.token;
    this.sharing=true;
    this.setData({error:''});
    try {
      const confirmed=await new Promise<boolean>(resolve=>miniProgramApi().showModal({title:labels().share,
        content:tr({zh:'任何拥有链接的人都能看到这条回答及公式状态图。',en:'Anyone with the link can view this answer and its algorithm diagrams.'}),success:r=>resolve(r.confirm),fail:()=>resolve(false)}));
      if(!confirmed || !current()) return;
      // A formula switch may finish while the confirmation is open. Snapshot
      // the latest saved selection, and never copy a superseded response URL.
      const latest=this.records.find(item=>item.requestId===turn.requestId);
      if(!latest) return;
      const result=await requestJson<{id:string}>('/site-assistant/shares',{method:'POST',token:session.token,body:{requestId:latest.requestId,question:latest.question,
        answer:assistantAnswerText({...latest.result,artifacts:latest.result.artifacts?.filter(a=>a.kind!=='algorithms')},SITE_ORIGIN) || latest.result.answer,
        algorithms:latest.result.artifacts?.filter(isAssistantAlgorithms)}});
      if(!current()) return;
      if(this.records.find(item=>item.requestId===turn.requestId)?.result!==latest.result) throw new Error('selection changed');
      miniProgramApi().setClipboardData({data:`${SITE_ORIGIN}/chat/share?id=${result.id}`});
    } catch { if(current()) this.setData({error:tr({zh:'分享失败，请重试。',en:'Sharing failed. Please retry.'})}); }
    finally { if(this.selectionEpoch===epoch) this.sharing=false; }
  },
  async readShare() {
    try {
      const saved=await requestJson<{question:string;answer:string;algorithms?:AssistantAlgorithms[]}>(`/site-assistant/shares/${this.shareId}`);
      this.records=[{question:saved.question,result:{answer:saved.answer,sources:[],artifacts:saved.algorithms?.filter(isAssistantAlgorithms)}}]; this.render();
    } catch { this.setData({error:tr({zh:'分享已失效。',en:'This share is unavailable.'})}); }
  },
});
