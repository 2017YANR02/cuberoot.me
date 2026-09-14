// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isUnmovedSwipe, startScrollDiagnostic, summarizeFrameGaps, type GestureEvidence, type ScrollDiagnosticReport } from '@/lib/scroll-diagnostics';

const swipe: GestureEvidence = {startMs:0,durationMs:500,dx:2,dy:-100,moves:3,scrollTravel:0,
  availableUp:0,availableDown:500,cancelled:false,multiTouch:false,prevented:false,
  interactive:false,touchAction:'auto',target:'article'};
describe('scroll diagnostic interpretation', () => {
  it('flags only vertical swipes with room to scroll, excluding controls, taps and cancellation', () => {
    expect(isUnmovedSwipe(swipe)).toBe(true);
    for (const change of [{scrollTravel:50},{dy:15},{dx:120},{availableDown:0},{dy:100},
      {cancelled:true},{multiTouch:true},{interactive:true},{touchAction:'pan-x'}, {touchAction:'none'}]) {
      expect(isUnmovedSwipe({...swipe,...change})).toBe(false);
    }
    expect(isUnmovedSwipe({...swipe,dy:100,availableUp:100})).toBe(true);
  });
  it('reports callback intervals, including absent samples, without inventing FPS', () => {
    expect(summarizeFrameGaps([])).toEqual({samples:0,medianMs:null,p95Ms:null,maxMs:null,over50Ms:0,over100Ms:0});
    expect(summarizeFrameGaps([16,17,16,50,120])).toEqual({samples:5,medianMs:17,p95Ms:120,maxMs:120,over50Ms:1,over100Ms:1});
  });
});

describe('opt-in scroll recorder', () => {
  let now: number, frames: Map<number,FrameRequestCallback>, id: number, reports: ScrollDiagnosticReport[];
  let stop: (() => void) | undefined;
  beforeEach(() => {
    vi.useFakeTimers(); now=0; id=0; frames=new Map(); reports=[];
    document.body.innerHTML='<article class="fixture" id="private-id">Private page text<input value="private-input" /></article>';
    document.body.removeAttribute('data-scroll-diagnostic');
    vi.spyOn(performance,'now').mockImplementation(()=>now);
    vi.stubGlobal('requestAnimationFrame',(cb: FrameRequestCallback)=>{frames.set(++id,cb);return id;});
    vi.stubGlobal('cancelAnimationFrame',(i:number)=>frames.delete(i));
    vi.stubGlobal('PerformanceObserver',undefined);
    Object.defineProperty(document,'scrollingElement',{configurable:true,value:document.documentElement});
    Object.defineProperty(document,'hidden',{configurable:true,value:false});
    Object.defineProperty(document.documentElement,'scrollHeight',{configurable:true,value:1500});
    Object.defineProperty(document.documentElement,'clientHeight',{configurable:true,value:500});
    document.documentElement.scrollTop=0;
  });
  afterEach(()=>{stop?.();stop=undefined;vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();document.body.innerHTML='';});
  const start = () => { const recorder=startScrollDiagnostic('no-blur',r=>reports.push(r));stop=recorder.stop;return recorder; };
  const frame = (time: number) => { now=time;const callbacks=[...frames.values()];frames.clear();for(const cb of callbacks) cb(time); };
  const touch = (type: string, y: number, target: Element=document.querySelector('article')!) => {
    const point={identifier:1,clientX:100,clientY:y};
    const event=new Event(type,{bubbles:true,cancelable:true});
    Object.defineProperties(event,{touches:{value:type==='touchend'||type==='touchcancel'?[]:[point]},changedTouches:{value:[point]}});
    target.dispatchEvent(event);return event;
  };
  it('separates finger motion and actual document movement without recording input or page text', () => {
    start();touch('touchstart',300);frame(16);touch('touchmove',200);frame(32);
    document.documentElement.scrollTop=80;document.dispatchEvent(new Event('scroll'));now=80;touch('touchend',200);stop!();
    expect(reports[0].gestures[0]).toMatchObject({dy:-100,scrollTravel:80,cancelled:false,moves:1,target:'article.fixture'});
    expect(reports[0].unmovedSwipes).toBe(0);expect(reports[0].observedEntries).toEqual([]);
    expect(JSON.stringify(reports[0])).not.toMatch(/private-id|private-input|Private page text/);
  });
  it('observes downstream preventDefault with passive listeners', async () => {
    const listen=vi.spyOn(document,'addEventListener');start();
    document.querySelector('article')!.addEventListener('touchmove',e=>e.preventDefault());
    touch('touchstart',300);touch('touchmove',180);await Promise.resolve();now=200;touch('touchend',180);stop!();
    expect(reports[0].unmovedSwipes).toBe(1);expect(reports[0].gestures[0].prevented).toBe(true);
    for(const type of ['touchstart','touchmove','touchend','touchcancel','scroll']) {
      expect(listen.mock.calls.find(call=>call[0]===type)?.[2]).toEqual({passive:true,capture:true});
    }
  });
  it('excludes diagnostic controls and cancelled touches from failed-swipe clues', () => {
    start();const panel=document.createElement('div');panel.setAttribute('data-scroll-diagnostic-ui','');document.body.append(panel);
    touch('touchstart',300,panel);touch('touchmove',100,panel);touch('touchend',100,panel);
    touch('touchstart',300);touch('touchmove',100);touch('touchcancel',100);stop!();
    expect(reports[0].gestures).toHaveLength(1);expect(reports[0].unmovedSwipes).toBe(0);
    expect(reports[0].gestures[0].cancelled).toBe(true);
  });
  it('accounts for scrolling in nested containers', () => {
    const target=document.querySelector<HTMLElement>('article')!;target.style.overflowY='auto';
    Object.defineProperties(target,{scrollHeight:{value:900},clientHeight:{value:200}});
    start();touch('touchstart',300);touch('touchmove',100);target.scrollTop=100;frame(16);touch('touchend',100);stop!();
    expect(reports[0].gestures[0].scrollTravel).toBe(100);expect(reports[0].unmovedSwipes).toBe(0);
  });
  it('allows delayed native scroll updates after touchend before flagging a swipe', () => {
    start();touch('touchstart',300);touch('touchmove',100);now=100;touch('touchend',100);
    document.documentElement.scrollTop=80;frame(150);stop!();
    expect(reports[0].gestures[0].scrollTravel).toBe(80);expect(reports[0].unmovedSwipes).toBe(0);
  });
  it('stops when hidden, restores prior attributes, and excludes background waiting', () => {
    document.body.setAttribute('data-scroll-diagnostic','original');start();frame(16);frame(32);
    Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
    frame(9000);stop!();
    expect(reports).toHaveLength(1);expect(reports[0].stopReason).toBe('hidden');expect(reports[0].frames.maxMs).toBe(16);
    expect(frames.size).toBe(0);expect(document.body.getAttribute('data-scroll-diagnostic')).toBe('original');
  });
  it('stops automatically and detaches observation after 30 seconds', () => {
    start();now=30000;vi.advanceTimersByTime(30000);
    expect(reports).toHaveLength(1);expect(reports[0].stopReason).toBe('timeout');
    expect(document.body.hasAttribute('data-scroll-diagnostic')).toBe(false);expect(frames.size).toBe(0);
    touch('touchstart',300);touch('touchmove',100);touch('touchend',100);stop!();expect(reports[0].gestures).toHaveLength(0);
  });
  it('bounds samples and reports truncation', () => {
    start();for(let i=0;i<105;i++){touch('touchstart',300);touch('touchmove',100);touch('touchend',100);}
    for(let i=1;i<=6010;i++)frame(i);stop!();
    expect(reports[0].gestures).toHaveLength(100);expect(reports[0].frames.samples).toBe(6000);expect(reports[0].truncated).toBe(true);
  });
});
