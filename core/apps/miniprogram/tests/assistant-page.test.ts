import {beforeEach,describe,it,expect,vi} from 'vitest';
const pdfMocks=vi.hoisted(()=>({assistantPdfCanvas:vi.fn(async()=>({})),buildAssistantPdf:vi.fn(async(..._args:any[])=>new ArrayBuffer(8)),openAssistantPdf:vi.fn(async()=>{})}));
vi.mock('../src/lib/assistant-pdf',()=>pdfMocks);
const mocks=vi.hoisted(()=>({request:vi.fn(),session:{token:'session-token',user:{uid:1,wcaId:'2017TEST01'}} as any,api:{setStorageSync:vi.fn(),getStorageSync:vi.fn(),setNavigationBarTitle:vi.fn(),setClipboardData:vi.fn(),arrayBufferToBase64:(bytes:ArrayBuffer)=>Buffer.from(bytes).toString('base64'),showModal:vi.fn((options:any)=>options.success({confirm:true})),createIntersectionObserver:vi.fn(()=>({relativeToViewport(){return this;},observe:vi.fn(),disconnect:vi.fn()}))}}));
vi.mock('../src/lib/auth',()=>({requestJson:mocks.request,getStoredSession:()=>mocks.session,ApiError:class extends Error{}}));
vi.mock('../src/lib/platform',()=>({miniProgramApi:()=>mocks.api}));
vi.mock('../src/lib/appearance',()=>({applyNativeAppearance:vi.fn()}));
vi.mock('../src/lib/share',()=>({hidePublicShareMenu:vi.fn()}));
vi.mock('../src/lib/i18n',()=>({getMiniProgramLocale:()=> 'zh',tr:(x:any)=>x.zh}));
vi.mock('@cuberoot/puzzle-render-core/alg-case-image',()=>({algorithmCaseImage:vi.fn(async()=>({svg:'<svg/>'}))}));
let options:any;
beforeEach(async()=>{vi.clearAllMocks();mocks.request.mockReset();mocks.api.getStorageSync.mockReset();mocks.session={token:'session-token',user:{uid:1,wcaId:'2017TEST01'}};vi.stubGlobal('Page',(o:any)=>{options=o;});vi.resetModules();await import('../src/pages/assistant/index');});
function page(){const p={...options,data:structuredClone(options.data),records:[],imageJobs:new Set(),switchJobs:new Set(),setData(patch:any,done?:()=>void){
  for(const [path,value] of Object.entries(patch)){const keys=path.replace(/\[(\d+)\]/g,'.$1').split('.');let node:any=this.data;for(const k of keys.slice(0,-1))node=node[k];node[keys.at(-1)!]=value;}
  done?.();}};return p;}
const result={answer:'如下',sources:[],artifacts:[{kind:'algorithms',version:1,title:'PLL',puzzle:'3x3',set:'pll',offset:0,total:1,display:'both',cards:[{caseId:1,name:'T',href:'/alg/3x3/pll#T',puzzle:'3x3',set:'pll',alg:"R U R'",sticker:{kind:'raw',tag:'',attrs:{}},alternative:0,alternativeCount:2}]}]};
const library={puzzle:'3x3',set:'pll',cases:[{id:1,name:'T',setup:'',sticker:{kind:'raw',tag:'',attrs:{}},algs:[[{alg:"R U R'"},{alg:"R U2 R'",setup:"R U2 R'"}]]}]};
const choose={currentTarget:{dataset:{t:0,g:0,c:0}}};
describe('native assistant',()=>{
  it('switches in place and saves the same selection for restore, copy, sharing and follow-up',async()=>{
    const p=page();p.onShow();p.records=[{question:'展示 T',requestId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',result:structuredClone(result)}];p.render();
    mocks.request.mockResolvedValueOnce(library);
    await p.another(choose);
    expect(p.records).toHaveLength(1);
    expect(p.records[0].result.artifacts[0].cards[0]).toMatchObject({alternative:1,alg:"R U2 R'",setup:"R U2 R'"});
    expect(p.data.turns[0].groups[0].cards[0].image).toContain('data:image/svg+xml;base64,');
    p.copyAlg(choose);expect(mocks.api.setClipboardData).toHaveBeenLastCalledWith({data:"R U2 R'"});
    const saved=structuredClone(mocks.api.setStorageSync.mock.calls.at(-1)![1]);
    mocks.api.getStorageSync.mockReturnValue(saved);const restored=page();restored.onShow();
    expect(restored.data.turns[0].groups[0].cards[0].alternative).toBe(1);
    mocks.request.mockResolvedValueOnce({id:'abcdefghijklmnopqrstuvwx'});
    await p.share({currentTarget:{dataset:{t:0}}});
    expect(mocks.request.mock.calls.at(-1)![1].body.algorithms[0].cards[0].alg).toBe("R U2 R'");
    mocks.request.mockResolvedValueOnce(result);await p.ask('解释当前公式');
    expect(mocks.request.mock.calls.at(-1)![1].body.history[1].content).toContain('alternative=1/2');
    expect(mocks.request.mock.calls.filter(([url])=>url==='/site-assistant')).toHaveLength(1);
  });
  it('keeps the old card on failure and permits a retry without adding a conversation',async()=>{
    const p=page();p.onShow();p.records=[{question:'T',result:structuredClone(result)}];p.render();
    mocks.request.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(library);
    await p.another(choose);
    expect(p.data.turns[0].groups[0].cards[0]).toMatchObject({alg:"R U R'",switching:false,switchFailed:true});
    await p.another(choose);expect(p.records[0].result.artifacts[0].cards[0].alternative).toBe(1);
    expect(p.records).toHaveLength(1);
  });
  it('coalesces rapid clicks and discards a selection that finishes after leaving the page',async()=>{
    const p=page();p.onShow();p.records=[{question:'T',result:structuredClone(result)}];p.render();
    let resolve:(value:any)=>void=()=>{};mocks.request.mockReturnValue(new Promise(r=>{resolve=r;}));
    const pending=p.another(choose);await p.another(choose);await Promise.resolve();
    expect(mocks.request).toHaveBeenCalledTimes(1);p.onHide();resolve(library);await pending;
    expect(p.records[0].result.artifacts[0].cards[0].alternative).toBe(0);
    expect(p.data.turns[0].groups[0].cards[0].switching).toBe(false);
  });
  it('preserves card context in follow-ups and copies exact move notation',async()=>{const p=page();p.onShow();mocks.request.mockResolvedValue(result);await p.ask('展示 T');p.copyAlg({currentTarget:{dataset:{t:0,g:0,c:0}}});expect(mocks.api.setClipboardData).toHaveBeenCalledWith({data:"R U R'"});await p.ask('换一种');expect(mocks.request.mock.calls[1][1].body.history[1].content).toContain('caseId=1; alternative=0/2');});
  it('never displays a late answer after stop or an account change',async()=>{const p=page();p.onShow();let finish:(x:any)=>void=()=>{};mocks.request.mockReturnValue(new Promise(r=>{finish=r;}));const pending=p.ask('展示 PLL');p.stop();finish(result);await pending;expect(p.records).toHaveLength(0);p.records=[{question:'old',result}];mocks.session={token:'other',user:{uid:2,wcaId:'2018TEST01'}};p.onShow();expect(p.records).toHaveLength(0);});
  it('requires the existing linked account before a paid request',async()=>{const p=page();mocks.session=null;await p.ask('PLL');expect(mocks.request).not.toHaveBeenCalled();expect(p.data.needsAccount).toBe(true);});
  it('exports the restored current selection without another conversation or public share',async()=>{
    const p=page();p.onShow();p.records=[{question:'T',result:structuredClone(result)}];p.render();
    mocks.request.mockResolvedValueOnce(library);await p.another(choose);
    mocks.api.getStorageSync.mockReturnValue(structuredClone(mocks.api.setStorageSync.mock.calls.at(-1)![1]));
    const restored=page();restored.onShow();
    await restored.pdf({currentTarget:{dataset:{t:0}}});
    expect(pdfMocks.buildAssistantPdf.mock.calls.at(-1)![1].artifacts[0].cards[0]).toMatchObject({alg:"R U2 R'",setup:"R U2 R'",alternative:1});
    expect(pdfMocks.openAssistantPdf).toHaveBeenCalledTimes(1);
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(restored.records).toHaveLength(1);
    expect(restored.data.pdfBusy).toBe(false);
  });
  it('prevents a mixed PDF while switching and discards an export after leaving',async()=>{
    const p=page();p.onShow();p.records=[{question:'T',result:structuredClone(result)}];p.render();
    let finish:(x:any)=>void=()=>{};mocks.request.mockReturnValueOnce(new Promise(r=>{finish=r;}));
    const switching=p.another(choose);await p.pdf({currentTarget:{dataset:{t:0}}});
    expect(pdfMocks.buildAssistantPdf).not.toHaveBeenCalled();finish(library);await switching;
    pdfMocks.buildAssistantPdf.mockImplementationOnce(()=>new Promise(r=>{finish=r;}));
    const pending=p.pdf({currentTarget:{dataset:{t:0}}});
    await vi.waitFor(()=>expect(pdfMocks.buildAssistantPdf).toHaveBeenCalledTimes(1));
    expect(p.data.pdfBusy).toBe(true);await p.another(choose);expect(mocks.request).toHaveBeenCalledTimes(1);
    p.onHide();finish(new ArrayBuffer(8));await pending;
    expect(pdfMocks.openAssistantPdf).not.toHaveBeenCalled();expect(p.data.pdfBusy).toBe(false);
  });
  it('shares the latest formula when a pending switch finishes during confirmation',async()=>{
    const p=page();p.onShow();p.records=[{question:'T',requestId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',result:structuredClone(result)}];p.render();
    let confirm:()=>void=()=>{};
    mocks.api.showModal.mockImplementationOnce((options:any)=>{confirm=()=>options.success({confirm:true});});
    const sharing=p.share({currentTarget:{dataset:{t:0}}});
    mocks.request.mockResolvedValueOnce(library);await p.another(choose);
    mocks.request.mockResolvedValueOnce({id:'abcdefghijklmnopqrstuvwx'});confirm();await sharing;
    expect(mocks.request.mock.calls.at(-1)![1].body.algorithms[0].cards[0].alg).toBe("R U2 R'");
  });
  it('does not publish after leaving or copy a stale link after a selection changes',async()=>{
    const p=page();p.onShow();p.records=[{question:'T',requestId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',result:structuredClone(result)}];p.render();
    let confirm:()=>void=()=>{};
    mocks.api.showModal.mockImplementationOnce((options:any)=>{confirm=()=>options.success({confirm:true});});
    const abandoned=p.share({currentTarget:{dataset:{t:0}}});p.onHide();confirm();await abandoned;
    expect(mocks.request).not.toHaveBeenCalled();
    p.onShow();let finish:(x:any)=>void=()=>{};mocks.request.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
    const sharing=p.share({currentTarget:{dataset:{t:0}}});await Promise.resolve();
    mocks.request.mockResolvedValueOnce(library);await p.another(choose);
    finish({id:'abcdefghijklmnopqrstuvwx'});await sharing;
    expect(mocks.api.setClipboardData).not.toHaveBeenCalled();
    expect(p.data.error).toBeTruthy();
    mocks.request.mockResolvedValueOnce({id:'zyxwvutsrqponmlkjihgfedc'});
    await p.share({currentTarget:{dataset:{t:0}}});
    expect(mocks.request.mock.calls.at(-1)![1].body.algorithms[0].cards[0].alg).toBe("R U2 R'");
    expect(mocks.api.setClipboardData).toHaveBeenCalledWith({data:'https://cuberoot.me/chat/share?id=zyxwvutsrqponmlkjihgfedc'});
    expect(p.data.error).toBe('');
  });
});
