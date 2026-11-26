import type { AssistantAnswer } from '@cuberoot/shared/site-assistant';
import type { KnowledgeIndex } from './site_assistant_knowledge.js';

// An intent identifies a small, published passage. Both the question vocabulary
// and every required excerpt must match; an unfamiliar qualifier goes to the planner.
type PassageIntent = {
  href: string;
  scope: RegExp[];
  vocabulary: RegExp;
  excerpts: RegExp[];
};
const intents: PassageIntent[] = [
  {href:'/video-recon-about',scope:[/视频|录像/,/打乱/,/留空|没填|没有|不填/],
    vocabulary:/视频|录像|复盘|打乱|留空|没填|没有|不填|镜头|拍清楚|拍清|拍到|起点|结尾|最后|时候|一定|开始|画面|结束|状态/g,
    excerpts:[/区间要包含[^。]+。打乱留空时[^。]+。/]},
  {href:'/alg/3bld/readme',scope:[/借位/,/缓冲/],
    vocabulary:/三盲|盲拧|缓冲块?|借位块?|位置|换了?|之后|能设|设成|选成|重合|重复|同一|一个|一样|相同|不同|默认|分别|新/g,
    excerpts:[/默认缓冲[^。]+。修改缓冲块[^。]+。/]},
  {href:'/alg/3bld/readme',scope:[/精准生成/,/公式|棱块/,/停|结束|练完|一次|一轮/],
    vocabulary:/三盲|盲拧|棱块|公式|精准生成|练习|练完|练到|练|模式|选了|选|几条|一次|一轮|结束|停止|停|时候|遍历/g,
    excerpts:[/精准生成模式[^\n]+?(?:输出打乱与信息|输出打乱和信息)。/]},
  {href:'/alg/sq1/parity-game',scope:[/sq[- ]?1/i,/奇偶/,/颜色|顺序/],
    vocabulary:/sq[- ]?1|奇偶|小游戏|游戏|颜色|出现|出了|三个|缺的|缺|剩下|补|末尾|摆|放|基准|参照|顺序|判断|判/gi,
    excerpts:[/把未出现的颜色[^。]+。/]},
  {href:'/alg/double-zbll-about',scope:[/zbll/i,/双底|单层/,/等权|配对|单例|auf/i],
    vocabulary:/zbll|双底|单层|单例|case|等权|对象|有序|配对|打乱|统计|分别|额外|加|auf/gi,
    excerpts:[/双底按有序配对等权[^。]+。/]},
  {href:'/memo/colpi',scope:[/colpi|字母对/i,/提交|编辑|上传|修改|改/],
    vocabulary:/colpi|盲拧|字母对|联想词|词条|词库|普通用户|普通人|用户|管理员|编辑|上传|修改|提交|版本|直接|别人|自己|登录|改|词/gi,
    excerpts:[/登录后可提交[^。]+。/]},
  {href:'/ruimin-yan',scope:[/创始人|颜瑞民/,/哪里人|家乡|籍贯|wca\s*id/i],
    vocabulary:/cuberoot|魔方根|创始人|颜瑞民|家乡|籍贯|哪里人|wca\s*id|编号/gi,
    excerpts:[/来自([^\s]+?)身份CubeRoot 创始人[^\n]*?WCA(\d{4}[A-Z]{4}\d{2})/]},
  {href:'/math/probability',scope:[/h\s*perm/i,/t\s*perm/i,/概率|常见|常遇/],
    vocabulary:/[ht]\s*perm|概率|理论|各自|常遇到|常见|高|低|频率/gi,
    excerpts:[/H perm 是 (1\/\d+)[,，]\s*T perm 却是 (1\/\d+)/i]},
  {href:'/math/demigod',scope:[/半神之数/,/36|上界|精确/],
    vocabulary:/半神之数|上帝之数|三阶|精确|最远|距离|改成|上界|[0-9]+|步|证明/g,
    excerpts:[/上帝之数(\d+) HTM精确证明[^\n]*?半神之数(\d+) HTM概率上界/]},
  {href:'/nemesizer-about',scope:[/宿敌/,/并列|一样|没比过|多一个|额外项目|打平/],
    vocabulary:/严格|宿敌|对手|对方|一项|每项|都比|只有|平均|单次|并列|打平|一样|强|符合|妨碍|成为|多一个|一个|从来|没比过|没有|额外项目|项目|多/g,
    excerpts:[/你有排名的每个项目[^。]+。单次与平均分开比较。/,/少一项排名[^。]+。对方多出[^。]+。|少一项排名[^。]+。/]},
  {href:'/mosaic-about',scope:[/拼画|魔方墙/,/抖色/],
    vocabulary:/拼画|魔方墙|抖色|表现|调色板|没有|颜色|实现|效果|原理|打算/g,
    excerpts:[/抖色用相邻色块[^。]+。/]},
  {href:'/wca/comp-about',scope:[/pr2/i,/平均|同值|相同|并列/],
    vocabulary:/pr2|同一个人|三阶|单次|平均|成绩|相同|同值|并列|混在一起|一起|分开|排名|排|怎么办/gi,
    excerpts:[/PR 表示个人最快[^。]+。它与本轮名次不同[^。]+。/]},
  {href:'/wca/comp-about',scope:[/纪录/,/顺位|标记/,/之前|过去|旧比赛/],
    vocabulary:/今天|刷了|新纪录|之前|过去|旧比赛|比赛|当时|显示|个人纪录|顺位|标记|全部|改掉|改变/g,
    excerpts:[/历史比较以赛前成绩[^。]+。/]},
  {href:'/scramble/hardest',scope:[/HTM/i,/QTM/i,/双转|[URFDLB]2|180/i],
    vocabulary:/htm|qtm|双转|[urfdlb]2|180|度|各|几步|步数/gi,
    excerpts:[/HTM：转 90° 或 180° 都算一步；QTM 中 180° 算两步/]},
  {href:'/alg/fto/notation',scope:[/fto/i,/rw/i,/rs/i],
    vocabulary:/fto|记号|rw|rs|到底|差|哪一层|区别/gi,
    excerpts:[/w 表示该面[^。]+。/]},
  {href:'/scramble/555-about',scope:[/五阶/,/打乱/,/概率|均匀/],
    vocabulary:/五阶|每次|生成|固定|60|步|随机转动|打乱|局面|出现|等概率|概率|一样|均匀|每个/g,
    excerpts:[/随机转动不保证最终状态等概率[^。]+。/]},
  {href:'/recon-about',scope:[/复盘/,/可见性|私享|公开/,/提交|分享/],
    vocabulary:/还原步骤|提交|分享|复盘|可见性|公开|私享|时候|选|不想|自己/g,
    excerpts:[/可选择公开、不公开列出或私享/]},
  {href:'/lettering',scope:[/拼字/,/王/,/朝向|起手|外圈/],
    vocabulary:/拼字|工具|内置|王|两种|朝向|起手|最外圈|外圈|打乱|被/g,
    excerpts:[/从复原状态开始，绿色面朝前、白色面朝上/,/完成后六个面的最外圈均保持复原。/]},
  {href:'/wca/comp-about',scope:[/比赛/,/选手/,/每轮|各轮|整场/,/点|查看/],
    vocabulary:/查一场|比赛|选手|整场|每轮|各轮|发挥|站内|点击|点|看|表现|姓名|哪里|一场/g,
    excerpts:[/点选手姓名，查看本场各轮成绩与个人最佳对比。/]},
  {href:'/wca/globe-about',scope:[/地球|地图/,/选手/,/足迹/,/导出|视频/],
    vocabulary:/比赛|地球|地图|上|某位|选手|参赛|足迹|做成|视频|搜|导出|姓名|搜索|怎么找|回放/g,
    excerpts:[/搜索姓名或 WCA ID，按时间播放参赛地点，也可导出足迹视频。/]},
  {href:'/timer',scope:[/计时器/,/看图|背公式/,/记忆|识别/],
    vocabulary:/已经|整把|计时器?|现在|看图|背公式|训练|识别|记忆|选|模式|还是/g,
    excerpts:[/训练用于动手还原，识别用于判断情况，记忆用于看图回忆公式/]},
  {href:'/scramble/555-about',scope:[/五阶/,/目标局面|随机状态/,/还原步骤|解法/,/打乱/],
    vocabulary:/五阶|先抽到|目标局面|随机状态|求解器|给|还原步骤|解法|变成|打乱|反推/g,
    excerpts:[/先采样合法状态[^。]+到达目标的打乱。/]},
  {href:'/mosaic-about',scope:[/拼画|魔方墙/,/像素|高清/,/细节|五官/],
    vocabulary:/一定|五官|照片|[一二三四五六七八九十百千万0-9]+|像素|魔方墙|拼画|来列|列|原图|越|高清|保住|所有|细节/g,
    excerpts:[/例如用三阶拼[^。]+。魔方数量决定[^。]+。/]},
  {href:'/scramble/hardest',scope:[/整方/,/最优/,/十字/,/难/],
    vocabulary:/极难打乱|页面|说|整方|最优解?|20|步|推出|十字|特别|难/g,
    excerpts:[/HTM 的 20 步态需要至少 20 步还原，但十字仍可能只需一步。/]},
  {href:'/comp-sim',scope:[/赛前|模拟/,/平均制/,/最佳制/],
    vocabulary:/赛前|模拟|训练|让|目标|更像|正式赛|平均制|最佳制|最好|一把|判断|过线/g,
    excerpts:[/目标按本轮赛制比较[^。]+。/]},
];
const filler=/[\s\p{P}]+|是(?:不是|否)|能不能|可不可以|可否|可不|有没有|可以|应该|怎样|怎么|什么|多少|哪个|几个|请问|请|告诉|知道|同一|时候|这(?:种|个)|那(?:个|种)|一下|一点|一个|几个|更|会|吗|呢|请|我|你|他|它|的|了|是|能|在|到|跟|和|与|或|也|都|只|想|要|用|该|这|那|把|就|从|对|里|时|才|算|还|按|有|以|个|几|哪|各|去|让|比|得|将|不|没/gu;

export function publishedFactIntent(question:string) {
  if(question.length>180) return;
  return intents.find(i=>i.scope.every(re=>re.test(question)) &&
    !question.replace(i.vocabulary,'').replace(filler,''));
}
export function publishedFactAnswer(intent:PassageIntent, pages:KnowledgeIndex['pages']):AssistantAnswer|undefined {
  const page=pages.find(p=>p.lang==='zh' && p.href===intent.href);
  if(!page || !page.text) return;
  const parts:string[]=[];
  for(const pattern of intent.excerpts) {
    const m=pattern.exec(page.text);
    if(!m) return;
    if(intent.href==='/ruimin-yan') parts.push('颜瑞民来自'+m[1]+'，WCA ID 为 '+m[2]+'。');
    else if(intent.href==='/math/probability') {
      const denominator=(fraction:string)=>Number(fraction.slice(2));
      const comparison=denominator(m[1])===denominator(m[2])?'两者等概率':denominator(m[1])>denominator(m[2])?'T perm 更常见':'H perm 更常见';
      parts.push(comparison+'。H perm 的概率是 '+m[1]+'，T perm 是 '+m[2]+'。');
    } else if(intent.href==='/math/demigod') parts.push('三阶最远距离的精确值仍是 '+m[1]+' HTM；半神之数给出 '+m[2]+' HTM 的概率上界。');
    else if(intent.href==='/recon-about') parts.push('如果不想让别人通过链接看到步骤，提交时选「私享」。「不公开列出」只从公开列表隐藏，拿到链接的人仍可查看。');
    else parts.push(m[0]);
  }
  const id='page:'+page.href;
  return {answer:parts.join('\n')+' [['+id+']]',sources:[{id,title:page.title,href:page.href,read:true}]};
}
