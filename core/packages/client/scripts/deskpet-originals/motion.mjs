// Shared intent, species-specific articulation. All tracks settle back to rest.
export const transform = ([x=0,y=0,r=0,sx=1,sy=sx]=[]) => `transform:translate(${x}px,${y}px) rotate(${r}deg) scale(${sx},${sy});`;
export const track = (...keys) => [[0,transform()],...keys.map(([t,...pose])=>[t,transform(pose)]),[100,transform()]];
const rotation = (values) => track(...values.map(([time,r])=>[time,0,0,r]));
export function motion(character, scene) {
  const swim=character.locomotion==='swim', flutter=character.locomotion==='flutter', slide=character.locomotion==='slide';
  const hard=character.gesture==='claw' || character.id==='beetle';
  const wing=character.gesture==='wing', fin=character.gesture==='fin', tentacle=character.gesture==='tentacle';
  const amp=fin?12:wing?18:tentacle?14:slide?7:16;
  const bodyIdle=swim?track([24,0,-3],[55,0,1],[78,0,-2]):track([45,0,-1],[76,0,0]);
  const joints={
    body:bodyIdle, head:rotation([[42,1],[72,-1]]),
    blink:[[0,transform()],[18,transform()],[20,transform([0,0,0,1,.08])],[23,transform()],[76,transform()],[78,transform([0,0,0,1,.08])],[81,transform()],[100,transform()]],
    gaze:track([38,1,0],[60,-1,0],[82,0,0]),
    tail:rotation([[30,4],[64,-4]]),
    earLeft:rotation([[48,-3],[55,2]]), earRight:rotation([[52,3],[59,-2]]),
    antennaLeft:rotation([[32,-5],[64,3]]),antennaRight:rotation([[38,4],[70,-3]]),
    left:swim||flutter?rotation([[28,-amp/3],[65,amp/3]]):track(),
    right:swim||flutter?rotation([[28,amp/3],[65,-amp/3]]):track(),
    footLeft:track(),footRight:track(),mouth:track(),
    clawLeft:rotation([[36,-3],[72,2]]),clawRight:rotation([[42,3],[76,-2]]),
  };
  const set=(name,...keys)=>joints[name]=track(...keys);
  const tilt=(name,...keys)=>joints[name]=rotation(keys);
  const gesture=(beats=[[28,1],[38,.2],[48,1],[61,0]])=>{
    tilt('left',...beats.map(([t,r])=>[t,-r*amp]));
    tilt('clawLeft',...beats.map(([t,r])=>[t,-r*12]));
    if (slide) tilt('antennaLeft',...beats.map(([t,r])=>[t,-r*8]));
  };
  const both=(beats)=>{gesture(beats);tilt('right',...beats.map(([t,r])=>[t,r*amp]));tilt('clawRight',...beats.map(([t,r])=>[t,r*12]));};
  const close=(start=35,end=78)=>joints.blink=[[0,transform()],[start-4,transform()],[start,transform([0,0,0,1,.06])],[end,transform([0,0,0,1,.06])],[end+5,transform()],[100,transform()]];
  const locomote=()=>{
    const beats=[[12,-1],[20,1],[28,-1],[36,1],[44,-1],[52,1],[60,0],[84,0]];
    tilt('footLeft',...beats.map(([t,n])=>[t,n*(hard?8:12)]));
    tilt('footRight',...beats.map(([t,n])=>[t,-n*(hard?8:12)]));
    tilt('left',...beats.map(([t,n])=>[t,n*(swim?14:flutter?24:4)]));
    tilt('right',...beats.map(([t,n])=>[t,-n*(swim?14:flutter?24:4)]));
    tilt('tail',[20,9],[35,-7],[52,6],[70,0]);
  };
  switch(scene.id){
    case 'idle':set('gaze',[25,-2,0],[44,-2,0],[60,2,0],[77,0,0]);break;
    case 'hello':gesture();tilt('head',[22,-4],[52,-4],[70,0]);break;
    case 'walk':locomote();set('body',[12,-9,0],[24,-4,swim?-3:-1],[38,5,0],[52,12,swim?2:-1],[72,12,0],[90,0,0]);break;
    case 'look-around':tilt('head',[25,-6],[46,-6],[65,6],[82,0]);set('gaze',[20,-3,0],[45,-3,0],[63,3,0],[82,0,0]);break;
    case 'nod':set('head',[22,0,3,3],[34,0,0,-1],[46,0,3,3],[59,0,0,-1]);break;
    case 'shake-head':tilt('head',[20,-7],[31,7],[42,-6],[53,5],[65,0]);set('gaze',[20,-2,0],[31,2,0],[42,-2,0],[53,2,0]);break;
    case 'curious':tilt('head',[25,-10],[57,-10],[75,2]);set('body',[28,4,-2,-2],[58,4,-2,-2],[78,0,0]);set('gaze',[25,2,-1],[58,2,-1]);break;
    case 'surprised':set('body',[18,0,1],[25,-5,-6,-4],[34,-5,0,-3],[56,-5,0,-3],[75,1,0,2]);both([[25,.8],[45,.6],[70,0]]);set('gaze',[25,0,-2],[56,0,-2],[75,2,0]);break;
    case 'happy':set('body',[16,0,2],[24,0,-12,-3],[32,0,0],[43,0,-8,3],[52,0,0],[66,0,0,-3],[75,0,0,2]);both([[24,1],[34,.4],[44,1],[57,0]]);break;
    case 'shy':tilt('head',[23,7],[58,7],[73,-3]);set('gaze',[20,0,2],[55,0,2],[69,2,-1]);tilt('tail',[28,10],[55,10],[82,0]);break;
    case 'proud':set('head',[24,0,-3,-4],[61,0,-3,-4],[76,0,-2,2]);set('body',[23,0,-2],[52,0,-2,3],[73,0,-2,-2]);both([[24,.35],[64,.35],[80,0]]);break;
    case 'sad':set('head',[28,0,4,6],[73,0,4,6]);set('body',[34,0,3,2],[74,0,3,2]);set('gaze',[24,0,2],[78,0,2]);tilt('earLeft',[30,-12],[78,-12]);tilt('earRight',[30,12],[78,12]);break;
    case 'angry':set('body',[22,0,-2],[28,-2,2],[35,0,-2],[41,2,2],[54,0,0]);tilt('head',[20,-4],[65,-4]);tilt('footLeft',[27,-14],[33,0]);tilt('footRight',[40,14],[46,0]);both([[23,.45],[44,.45],[62,0]]);break;
    case 'thanks':set('head',[30,0,5,8],[57,0,5,8],[77,0,-1,-2]);set('body',[30,0,3,4],[57,0,3,4],[80,0,0]);close(30,57);break;
    case 'cheer':both([[20,1],[32,.3],[43,1],[56,.3],[68,1],[81,0]]);set('body',[20,0,-3],[32,0,0],[43,0,-3],[56,0,0],[68,0,-3]);break;
    case 'heart':both([[28,.5],[59,.5],[76,0]]);set('head',[30,0,-2,-4],[60,0,-2,-4]);set('body',[30,0,-2],[66,0,-2]);break;
    case 'stretch':both([[30,1.1],[58,1.1],[78,0]]);set('head',[33,0,-5,-5],[59,0,-5,-5],[82,0,1]);tilt('tail',[35,16],[60,16],[84,0]);set('body',[32,0,-3],[62,0,-3],[82,0,1]);close(34,58);break;
    case 'yawn':set('head',[28,0,-4,-7],[53,0,-4,-7],[72,0,1]);set('mouth',[29,0,1,0,1.1,2.1],[53,0,1,0,1.1,2.1]);close(33,70);both([[32,.45],[55,.45],[76,0]]);break;
    case 'doze':set('head',[24,0,3,6],[37,0,6,10],[43,0,-1,-3],[53,0,0],[70,0,5,8],[79,0,6,10],[85,0,-1,-3]);close(22,78);break;
    case 'sleep':close(8,91);set('head',[12,0,5,8],[90,0,5,8]);set('body',[14,0,3],[35,0,2],[56,0,3],[75,0,2],[91,0,3]);break;
    case 'wake':close(4,31);set('head',[5,0,5,8],[29,0,5,8],[43,0,-3,-4],[63,0,-3,-4],[84,0,0]);both([[43,1],[62,1],[83,0]]);break;
    case 'groom':tilt('head',[20,8],[32,5],[44,8],[55,4],[72,-3],[79,3]);gesture([[22,.3],[32,.7],[42,.3],[52,.7],[65,0]]);tilt('tail',[27,-12],[47,-12],[71,5]);break;
    case 'scratch':tilt('body',[24,5],[67,5],[83,0]);tilt('footRight',[29,-14],[36,5],[43,-14],[50,5],[57,-14],[66,0]);tilt('right',[29,amp],[36,0],[43,amp],[50,0],[57,amp],[66,0]);close(28,66);break;
    case 'sneeze':set('head',[20,0,-2,-4],[38,0,-5,-9],[43,0,5,10],[50,0,0],[66,0,0,-4]);set('body',[38,0,-2,-3],[44,0,3,4],[53,0,0]);close(37,48);both([[38,.4],[44,1],[56,0]]);break;
    case 'read':set('head',[20,0,3,5],[62,0,3,5],[79,0,1,2]);set('gaze',[24,-2,2],[42,2,2],[60,-2,2],[77,2,2]);gesture([[47,.45],[57,.8],[67,0]]);break;
    case 'letter':set('head',[23,0,3,5],[52,0,3,5],[65,0,-2,-4]);gesture([[27,.45],[44,.8],[61,0]]);set('gaze',[32,0,2],[55,0,2],[68,0,-1]);break;
    case 'draw':tilt('head',[22,5],[65,5],[79,-4]);gesture([[24,.2],[32,.55],[40,.2],[48,.55],[56,.2],[65,0]]);set('body',[76,-3,0,-3],[88,-3,0,-3]);break;
    case 'music':tilt('head',[15,-6],[28,6],[41,-6],[54,6],[67,-6],[80,3]);tilt('tail',[15,10],[28,-10],[41,10],[54,-10],[67,10],[80,0]);set('body',[28,0,-2],[54,0,-2],[80,0,0]);break;
    case 'drum':gesture([[18,.8],[26,0],[34,.8],[42,0],[58,.8],[66,0]]);tilt('right',[26,amp],[34,0],[42,amp],[50,0],[66,amp],[74,0]);tilt('head',[26,4],[42,4],[66,4],[76,0]);break;
    case 'ball':gesture([[20,.4],[30,.9],[38,0],[66,.6],[76,0]]);set('gaze',[33,3,2],[55,3,2],[73,0,2]);set('body',[65,5,0,3],[77,0,0]);break;
    case 'bubbles':set('gaze',[23,2,-1],[43,2,-3],[62,-1,-3],[78,0,-1]);tilt('head',[30,-5],[61,-9],[77,0]);gesture([[53,.4],[62,.8],[71,0]]);break;
    case 'butterfly':set('gaze',[20,-3,-1],[36,3,-2],[56,-2,-3],[77,2,-1]);tilt('head',[21,-7],[38,7],[55,-7],[76,3]);gesture([[53,.2],[61,1],[69,0]]);break;
    case 'leaf':tilt('head',[23,-6],[43,-4],[64,4]);set('gaze',[23,-2,-3],[45,0,-2],[65,1,2]);gesture([[56,.6],[66,.9],[78,0]]);break;
    case 'flower':set('head',[30,5,3,7],[48,5,3,7],[64,0,-1,-3]);set('body',[32,3,0,2],[51,3,0,2]);close(39,67);break;
    case 'water':gesture([[25,.2],[37,.8],[46,0]]);set('body',[37,2,1,3],[44,-4,-5,-5],[57,-4,0,-3],[76,0,0]);set('gaze',[23,2,2],[60,2,2]);break;
    case 'rain':locomote();set('body',[22,-11,0,-3],[41,-11,0],[73,-11,0],[87,0,0]);tilt('head',[49,-5],[75,-5]);break;
    case 'wind':set('body',[22,-3,0,-7],[44,-4,0,-9],[59,-2,0,-5],[73,0,0,3],[81,0,0,-2]);tilt('tail',[24,-18],[49,-18],[71,6]);tilt('earLeft',[22,-15],[49,-15],[73,0]);tilt('earRight',[22,-15],[49,-15],[73,0]);break;
    case 'star':tilt('head',[27,-9],[61,-9],[80,0]);set('gaze',[23,1,-3],[62,1,-3]);gesture([[42,.4],[57,1],[72,0]]);break;
    case 'lantern':tilt('head',[22,-8],[44,8],[65,-5],[83,0]);set('gaze',[22,-2,-2],[44,2,-2],[65,-1,-2]);break;
    case 'gift':gesture([[25,.5],[39,.9],[51,0]]);set('head',[26,0,3,6],[46,0,2,4],[60,0,-4,-5]);both([[63,.8],[75,0]]);break;
    case 'snack':set('head',[28,3,4,7],[43,3,4,7],[55,0,0],[63,0,1,2],[70,0,0],[77,0,1,2]);tilt('body',[65,-2],[75,2],[85,0]);close(58,77);break;
    case 'tea':set('head',[30,0,5,7],[51,0,5,7],[65,0,-2,-3],[78,0,0]);set('gaze',[20,0,2],[48,0,2]);close(35,56);break;
    case 'balance':set('body',[23,-3,-1,-8],[40,3,-1,9],[56,-2,-1,-5],[70,1,0,3],[81,0,0]);both([[24,1],[43,.7],[59,1],[79,0]]);tilt('tail',[23,15],[40,-15],[56,9],[78,0]);break;
    case 'peek':set('body',[18,-11,2,-4],[40,9,0,5],[59,9,0,5],[78,-11,2,-4]);set('gaze',[37,3,0],[59,3,0]);break;
    case 'chase':locomote();set('body',[19,-11,0,-3],[40,10,-3,4],[54,14,-7,6],[64,10,0,3],[83,0,0]);both([[51,.9],[65,0]]);break;
    case 'hide':set('body',[22,-9,5,-6],[51,-9,5,-6],[64,5,1,4],[73,5,1,4],[86,-9,5,-6]);set('gaze',[62,3,0],[73,3,0]);break;
    case 'goodnight':gesture([[16,.8],[26,.1],[35,.7],[43,0]]);set('head',[57,0,4,10],[87,0,4,10]);set('body',[62,0,3,4],[89,0,3,4]);close(62,91);break;
    case 'celebrate':set('body',[20,0,1,-3],[30,0,-12,7],[41,0,0,2],[53,0,-7,-6],[64,0,0],[78,0,0,3]);both([[30,1],[43,.3],[54,1],[69,0]]);break;
    default:throw Error(`Missing choreography: ${scene.id}`);
  }
  // Snails glide; rays never sprout legs. A wave moves a real fin, not a made-up hand.
  const observing=slide||fin;
  if(['read','letter','draw','drum'].includes(scene.id)){
    // Props choose this same low joint, so the real limb and its tool move together.
    const hand=character.anchors.left[1]>=character.anchors.right[1]?'left':'right';
    joints.left=track();joints.right=track();
    if(observing){
      set('head',[24,0,3,3],[65,0,3,3],[80,0,0]);
      if(fin){tilt('left',[28,-3],[60,3]);tilt('right',[28,3],[60,-3]);}
    }else if(scene.id==='draw'){
      set(hand,[24,0,1,-2],[32,1,2,2],[40,0,1,-2],[48,1,2,2],[56,0,1,-2],[65,0,0]);
    }else if(scene.id==='drum'){
      set(hand,[18,0,-3,-3],[26,0,2,1],[34,0,-3,-3],[42,0,2,1],[58,0,-3,-3],[66,0,2,1],[77,0,0]);
    }
  }
  if(scene.id==='snack'||scene.id==='tea'){
    set('head',[28,scene.id==='snack'?3:0,7,4],[48,scene.id==='snack'?3:0,7,4],[61,0,1],[70,0,2],[80,0,0]);
    set('body',[29,0,2,1],[49,0,2,1],[63,0,0]);
  }
  if(slide){joints.footLeft=track();joints.footRight=track();}
  return joints;
}
