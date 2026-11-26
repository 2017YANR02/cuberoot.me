import { pinyin } from 'pinyin-pro';
import { PAGE_META } from '@cuberoot/shared/page-catalog';
import { SITE_DIRECTORY_GROUPS, SITE_DIRECTORY_TEXTS } from '@cuberoot/shared/site-directory';
import { ALG_CATALOG } from '@cuberoot/shared/alg-catalog';
import { ASSISTANT_FEATURE_LINKS, ASSISTANT_MODE_DESTINATIONS, assistantOpenTarget, type AssistantAnswer, type AssistantMessage } from '@cuberoot/shared/site-assistant';

type Lang = 'zh' | 'en';
const normalize = (value:string) => value.normalize('NFKC').toLowerCase().replace(/[。．.!！?？]+$/u,'').replace(/\s+/g,'').trim();
const destinations = new Map<string,{zh:string;en:string}>();
const byName = new Map<string, Set<string>>();
function register(path:string, title:{zh:string;en:string}, aliases:string[] = []) {
  destinations.set(path,title);
  for (const value of [title.zh,title.en,...aliases]) {
    const key=normalize(value);
    const matches=byName.get(key) ?? new Set();
    matches.add(path);
    byName.set(key,matches);
  }
}
for (const group of SITE_DIRECTORY_GROUPS) for (const entry of group.entries) {
  if (entry.internal && !('adminOnly' in entry && entry.adminOnly) && !('lockedForNonAdmin' in entry && entry.lockedForNonAdmin))
    register(entry.href,SITE_DIRECTORY_TEXTS[entry.nameKey]);
}
// PAGE_META includes parameter templates and a few metadata-only keys. A
// template cannot identify a private student, a specific event or a document.
// A bare editor, contract detail or payment callback cannot open a user's object.
const needsObject = new Map([
  ['docs/edit', {zh:'请提供要编辑的协作文档链接。', en:'Please share the document link you want to edit.'}],
  ['admin/team/contract', {zh:'请提供要查看的合同链接。', en:'Please share the contract link you want to view.'}],
  ['membership/checkout', {zh:'请先在会员方案中选择套餐，使用该订单生成的支付入口。', en:'Select a membership plan to get the payment link for that order.'}],
]);
const objectRequests = new Map<string, {zh:string;en:string}>();
for (const [path, prompt] of needsObject) {
  for (const label of Object.values(PAGE_META[path].title)) objectRequests.set(normalize(label), prompt);
}
const metadataOnly=new Set(['workspace','teachers-edit','wca/persons/students','alg/3x3/zbll/simple']);
const restrictedRoots=SITE_DIRECTORY_GROUPS.flatMap(group=>group.entries.filter(entry=>
  ('lockedForNonAdmin' in entry && entry.lockedForNonAdmin) || ('adminOnly' in entry && entry.adminOnly)).map(entry=>entry.href));
for (const [path,meta] of Object.entries(PAGE_META)) {
  if (!/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/i.test(path) || metadataOnly.has(path) || needsObject.has(path)
    || /^(?:tutorial-legacy|video-recon)(?:[-/]|$)/.test(path) || /(?:^|\/)embed$/.test(path)) continue;
  const href='/'+path;
  if (restrictedRoots.some(root=>href===root || href.startsWith(root+'/'))) continue;
  const title=path.startsWith('admin/') ? {zh:'管理后台'+meta.title.zh,en:'Admin '+meta.title.en} : meta.title;
  if (href === '/music') register(href, {zh:'曲库', en:'Music library'});
  else register(href,title);
}
for (const [puzzle,sets] of Object.entries(ALG_CATALOG)) for(const set of sets) {
  const href='/alg/'+puzzle+'/'+set.slug;
  const prefix=({'2x2':'二阶','3x3':'三阶','4x4':'四阶','5x5':'五阶','6x6':'六阶','7x7':'七阶',
    pyraminx:'金字塔',megaminx:'五魔',skewb:'斜转'} as Record<string,string>)[puzzle] ?? puzzle;
  const label=prefix+set.zh;
  register(href,{zh:label+'公式',en:puzzle+' '+set.en+' algorithms'},[puzzle + set.zh + '公式', ...(puzzle==='3x3'?[set.slug+'公式']:[])]);
  register(href+'/select',{zh:label+'公式训练',en:puzzle+' '+set.en+' practice'},[puzzle + set.zh + '公式训练', ...(puzzle==='3x3'?['练'+set.slug,set.slug+'训练']:[])]);
}
for (const [href, zh, en] of ASSISTANT_FEATURE_LINKS) register(href, {zh, en});
for(const [href,zh,en] of ASSISTANT_MODE_DESTINATIONS) register(href,{zh,en});
for(const [path,zh,en] of [
  ['account/courses','我的课程','My courses'],['account/notes','我的课程笔记','My course notes'],
  ['account/badges','我的学习徽章','My learning badges'],
]) register('/platform/'+path,{zh,en});
register('/jsonEditor', {zh:'JSON 编辑器', en:'JSON editor'});
register('/admin/team', PAGE_META.workspace.title);
register('/teachers/edit', PAGE_META['teachers-edit'].title);
// Keep the short spoken names as aliases and describe the distinction in the choices.
register('/courses', {zh:'教学录播方案', en:'Recorded teaching plans'});
register('/platform/courses', {zh:'学习平台课程', en:'Learning platform courses'});
register('/alg/progress', {zh:'公式学习进度', en:'Algorithm learning progress'});
register('/platform/progress', {zh:'平台课程学习进度', en:'Platform course progress'});
// Spoken task names refer to existing catalog entries. A phrase may deliberately
// name two destinations; preserve their display order through the next turn.
const taskNames:Record<string,string[]> = {
  'forum/search':['搜论坛帖子','搜索论坛帖子'], 'forum/mine':['查看我的帖子'], 'forum/new':['写论坛帖子'],
  'sim/grips':['看模拟器握姿','查看握姿'], 'recon/submit':['提交我的复盘'],
  'tutorial/lbl':['学层先法'], 'tutorial/f2l':['学F2L'], 'regulation/rules':['查看比赛规则'],
  'wca/comp/stats':['比赛日历统计'], 'wca/records':['查世界纪录页面'],
  'admin/users':['后台用户管理'], 'account/guardian-binding':['绑定监护人'],
  'platform/account/notes':['查看我的课程笔记'], 'platform/account/courses':['查看我的课程'],
  'scramble/gen?mode=batch':['批量打乱','批量生成打乱'], 'scramble/gen?mode=comp':['打印比赛打乱'],
  'scramble/gen?mode=paste':['导入打乱文本'], 'frame-count?mode=record':['视频录制模式'],
  'frame-count?mode=detector':['视频检测模式'], 'recon?favorites=true':['我的复盘收藏'],
  'admin/team?section=schedule':['查看工作排期'], 'admin/team?section=checklists':['员工工作清单'],
  'scramble/solver?event=222':['二阶求解器'], 'scramble/solver?event=333':['三阶求解器'],
  'cube-history?view=compare':['魔方型号对比','魔方历史参数对比'],
  'wca/comp?view=globe':['比赛地图','全球比赛地图'],
  'wca/most_4th_places':['最多第四名榜单','第四名次数榜'],
  'regulation/blindfolded':['盲拧比赛规则'],
  'tutorial/f2l?step=lesson-2':['F2L三步基态'],
  'timer?players=2':['对战计时'],
  'timer?players=net':['对战计时','联机对战计时','在线对战计时'],
  'alg/3x3/pll/select':['三阶PLL训练','PLL公式训练'],
  timer:['计时','给魔方计时','魔方计时器','开始计时'],
  'alg/3bld/lookup':['三盲公式查询','查三盲公式','查盲拧公式'],
  'alg/3bld/memo':['练盲拧','练盲拧记忆','盲拧记忆训练'],
  'alg/3bld/edge':['练盲拧','练盲拧公式'],
  'alg/3bld/timer':['盲拧计时'],
  cross_trainer:['练十字','十字训练器'], 'frame-count':['视频数帧','数视频帧数','给视频数帧'],
  'scramble/gen':['生成打乱','打乱生成器'], solver:['魔方求解器'],
  recon:['看复盘','看魔方复盘'], sim:['魔方模拟器'], alg:['查公式','公式库'],
  'alg-trainers':['练公式','公式训练'], 'wca/comp':['查比赛','找比赛','比赛查询'],
  search:['查选手','找选手','选手查询'],
};
// Register these natural names in both the exact index and the phonetic index.
for (const count of ['双人','两人','两个人','俩人','二人','2人','2个人']) {
  for (const mode of ['','同屏','同机','一起','同时','对战']) {
    taskNames['timer?players=2'].push(count+mode+'计时',count+mode+'计时器');
  }
}
for(const [path,aliases] of Object.entries(taskNames)) {
  const href='/'+path;
  const title=destinations.get(href) ?? PAGE_META[path]?.title;
  if(title) register(href,title,aliases);
}

// Restrict approximate matches to spoken feature aliases. They always produce a
// choice, even when only one destination survives. Never turn a guess into a jump.
const spokenNames=new Map<string,string[]>();
function syllables(value:string) {
  return pinyin(value,{type:'array',toneType:'none'}).map(part=>part.replace(/ng$/,'n').replace(/^([zcs])h/,'$1'));
}
function nearSyllable(a:string,b:string) {
  if (a.length>b.length) return nearSyllable(b,a);
  if (a.length===b.length) return [...a].filter((ch,i)=>ch!==b[i]).length<=1;
  if (b.length!==a.length+1) return false;
  return [...b].some((_,i)=>b.slice(0,i)+b.slice(i+1)===a);
}
function similarSpokenPaths(subject:string) {
  if (!/^[\p{Script=Han}]{3,12}$/u.test(subject)) return [];
  if (!spokenNames.size) {
    for (const name of byName.keys()) {
      if (/^[\p{Script=Han}]{3,12}$/u.test(name)) spokenNames.set(name, syllables(name));
    }
  }
  const heard=syllables(subject), found=new Set<string>();
  let best=Infinity;
  for (const [name,sounds] of spokenNames) {
    if (sounds.length!==heard.length) continue;
    const different=sounds.filter((part,i)=>part!==heard[i]).length;
    if (different>1 || !sounds.every((part,i)=>nearSyllable(part,heard[i]))) continue;
    if (different>best) continue;
    if (different<best) {best=different;found.clear();}
    for (const href of byName.get(name) ?? []) found.add(href);
  }
  return found.size<=3 ? [...found] : [];
}

// Resolve descriptive requests against registered destinations. Never treat explanatory
// prose, a negated command, or a bare feature mention as permission to navigate.
const describedFeatures: Array<[string,RegExp]> = [
  ['/alg/3bld/edge', /(?:盲拧|三盲).*棱块.*公式|棱块.*盲拧.*公式/],
  ['/wca/comp/stats', /比赛日历.{0,5}统计|日历统计/],
  ['/frame-count', /数帧|逐帧计时/],
  ['/alg/sq1/parity-game', /sq[ -]?1.*奇偶.*(?:游戏|小游戏)/i],
  ['/memo/colpi', /colpi|盲拧.*字母对.*(?:联想词|词库)|字母对联想词/i],
  ['/alg/fto/notation', /fto.*(?:转动)?记号/i],
  ['/scramble/solver?event=222', /二阶.*(?:涂色|涂颜色).*求解/],
  ['/color-test/relations', /对色.*邻色.*(?:测试|小测)|邻色.*对色.*(?:测试|小测)/],
  ['/cross_trainer', /(?:只想练|专练)十字/],
];
function describedPaths(phrase:string) {
  if (/为什么|怎么用|如何用|解释|区别|是否|源码|听说|帮我写|教程怎么|先别|不用|不想打开|什么意思|翻译|不要打开|别打开|是否需要|能不能打开|[“「『]|和.*(?:两个|都)|然后|另外/.test(phrase)) return [];
  const matches=describedFeatures.filter(([,pattern])=>pattern.test(phrase)).map(([href])=>href);
  if (/(?:双人|两个人|两人|俩人|两位|2人).{0,8}计时/.test(phrase)) {
    const remote=/联机|远程|异地|各(?:用|拿)|各自/.test(phrase);
    matches.push(remote?'/timer?players=net':'/timer?players=2');
    if(remote && /共用|同屏|同一台/.test(phrase)) matches.push('/timer?players=2');
  }
  return matches.filter(href=>destinations.has(href));
}

export function assistantNavigationRequest(question:string,history:AssistantMessage[],lang:Lang):AssistantAnswer|undefined {
  const q=question.normalize('NFKC').trim().replace(/[。.！!？?]+$/u,'').trim();
  // A question about a command previews the same registered destination but
  // never arms navigation or saves an actionable choice list in chat history.
  const hypothetical=/^(?:如果|假如|要是)我(?:说|输入)[“「『"]?(.+?)[”」』"]?[，,]?会(?:发生什么|怎样|怎么样)$/u.exec(q)?.[1];
  const target=assistantOpenTarget(hypothetical ?? q);
  if (hypothetical && !target) return;
  const ordinal=/^(?:第\s*([一二两三123])\s*(?:个|项|条)(?:入口|选项)?|(?:the )?(first|second|third)(?: one| option)?)$/i.exec(target ?? '');
  let paths:string[];
  let approximate=false;
  if(ordinal) {
    const last=history.at(-1);
    const line=last?.role==='assistant' && /^Navigation choices: (\[[^\n]+\])$/m.exec(last.content)?.[1];
    const index=['一','二','三'].indexOf(ordinal[1])+1 || ({两:2,first:1,second:2,third:3}[ordinal[2]?.toLowerCase() ?? ordinal[1]]) || Number(ordinal[1]);
    let href:string|undefined;
    try {const saved=line && JSON.parse(line); if(Array.isArray(saved)) href=saved[index-1];} catch { /* legacy or truncated history */ }
    if(!href || !destinations.has(href)) return {answer:lang==='zh'?'上一条回复没有这个编号的导航选项。你想打开哪个功能？':'Which feature would you like to open? The previous reply has no such numbered option.',sources:[]};
    paths=[href];
  } else {
    const link=/^(?:请)?(?:给我|发我)(.+?)(?:的)?(?:入口|链接)$|^(.+?)(?:的)?(?:入口|链接)(?:在(?:哪(?:里|儿)?|什么地方)|是什么)?$|^(.+?)在哪(?:里|儿)?(?:打开|找)?$|^(?:where (?:is|can i find)|link to) (.+)$/i.exec(q);
    const task=/^(?:我想|我要|我想要)(.+)$/u.exec(q);
    const asksForLink=/(?:给|发)(?:我|个|一个)?[^。！？!?]{0,48}(?:入口|链接)|(?:入口|链接)(?:吗|就好|发我)|哪(?:一|个)页|在哪(?:里|儿)看|哪[里儿]可以/.test(q);
    const subject=target ?? link?.slice(1).find(Boolean) ?? task?.[1] ?? (asksForLink?q:undefined);
    if(!subject) return;
    const name=normalize(subject);
    const objectPrompt=objectRequests.get(name);
    if (objectPrompt) return {answer:objectPrompt[lang], sources:[]};
    const feature=name.replace(/(?:的)?(?:页面|界面)$/u,'');
    // Resolve the whole noun phrase. A timer mentioned inside a how-to question
    // is not a request to open it. A remote opponent uses the online mode.
    paths=[...(byName.get(name) ?? byName.get(feature) ?? [])];
    if (!paths.length && (target || asksForLink || link) && !hypothetical) {
      const generic=/^(?:这个|那个|对应的)?(?:工具|页面|功能)$/.test(target ?? '');
      const phrase=target && !generic ? target : q;
      if (/不含|排除|除了|还要打开|再打开/.test(phrase)) return;
      const alternatives=phrase.split(/或者|还是|或是|或/u);
      if (alternatives.length>1) {
        const groups=alternatives.map(part=>[...(byName.get(normalize(part)) ?? describedPaths(part))]);
        if (groups.some(group=>!group.length)) return;
        paths=[...new Set(groups.flat())];
      } else {
        paths=describedPaths(phrase);
      }
    }
    if (paths.includes('/timer?players=2')) {
      const remote=/(?:异地|不同(?:的)?(?:城市|电脑)|各自(?:的)?(?:电脑|设备)|远程|线上|在线|联机)/u.test(q);
      const sameDevice=/(?:同屏|同机|(?:一台|同一台|同一部|同一块)(?:电脑|设备|手机|屏幕))/u.test(q);
      if (sameDevice && remote) paths=['/timer?players=2','/timer?players=net'];
      else if (remote) paths=['/timer?players=net'];
      else if (sameDevice) paths=['/timer?players=2'];
    }
    if (!paths.length) {
      // Interpret spoken letter names only within an algorithm or practice request.
      // Compare the suffix phonetically too, e.g. 公式 and 公司 in a noisy transcript.
      const spokenPll=/^(三阶)?(?:(?:梯|皮|批)ll|(?:p|皮|批)(?:[艾埃][尔勒]){2})([\p{Script=Han}]{2,4})$/u.exec(feature);
      if (spokenPll) {
        const heard=syllables(spokenPll[2]).join(' ');
        const suffix=['公式训练','训练','公式'].find(label=>syllables(label).join(' ')===heard);
        if (suffix) paths=[...(byName.get((spokenPll[1] ?? '')+'pll'+suffix) ?? [])];
      }
      if (!paths.length) paths=similarSpokenPaths(feature);
      if (!paths.length) return;
      approximate=true;
    }
  }
  const actions=paths.map(href=>({id:'nav:'+href,title:destinations.get(href)![lang],href}));
  const choose=approximate || actions.length>1;
  if (hypothetical) {
    const titles=actions.map(action=>action.title).join(lang==='zh'?'、':', ');
    const explanation=choose
      ? {zh:`我会先请你确认要打开的入口（${titles}），选定后才跳转。`, en:`I would ask you to confirm the destination (${titles}), then open your selection.`}
      : {zh:`单独发送这条指令时，聊天页会直接打开「${titles}」。`,en:`Sending that command on its own would open ${titles} from the chat.`};
    return {answer:explanation[lang],sources:[]};
  }
  const answer=choose ? (lang==='zh'?'请选择要打开的入口。':'Choose the destination you want to open.')+'\n\n'+actions.map((a,i)=>(i+1)+'. [['+a.id+']]').join('\n') : '[['+actions[0].id+']]';
  return {answer,actions,sources:actions.map(a=>({...a,read:false})),navigation:choose?'choose':target?'open':'link'};
}
