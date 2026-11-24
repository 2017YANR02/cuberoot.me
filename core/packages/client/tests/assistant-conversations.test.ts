import { describe, expect, it, vi } from 'vitest';
import { createAssistantConversations } from '@/lib/assistant-conversations';
import { formatReplayAssistantDraft } from '@/lib/assistant-replay-draft';
import { defaultReplayAnswer } from '@cuberoot/shared/site-assistant-replay';

describe('assistant workspace conversations', () => {
  it('answers the default timer prompt from its own measurements and preserves custom requests', () => {
    const draft=formatReplayAssistantDraft({
      timeMs:7718,penalty:'ok',method:'CFOP',stm:62,tps:8.03,stages:[
        {label:'Cross',stepMs:1475,recognitionMs:0,executionMs:1475,turns:11,cumulativeMs:1475},
        {label:'F2',stepMs:992,recognitionMs:698,executionMs:294,turns:8,cumulativeMs:2467},
        {label:'F3',stepMs:1678,recognitionMs:537,executionMs:1141,turns:7,cumulativeMs:4145},
        {label:'PLL',stepMs:1613,recognitionMs:377,executionMs:1236,turns:17,cumulativeMs:7718},
      ],
    },text=>text.zh);
    for(const question of [draft,draft.normalize('NFKC').replaceAll('\n','\r\n')]){
      const answer=defaultReplayAnswer(question,'zh');
      expect(answer?.answer).toContain('F3 的阶段用时为 1.678 秒');
      expect(answer?.answer).toContain('回放截至 4.145 秒');
      expect(answer?.actions).toMatchObject([{href:'/alg/3x3/f2l/select'}]);
    }
    expect(defaultReplayAnswer(draft+' 请按识别耗时判断。','zh')).toBeUndefined();
  });

  it('stages only the selected replay measurements in a new unsent, account-scoped draft', () => {
    const store = createAssistantConversations();
    store.create('alice', 'existing', 'My existing draft');
    const replay = {
      timeMs: 11050, penalty: 'ok' as const, method: 'CFOP', stm: 48, tps: 5.31,
      stages: [{ label: 'F2L', stepMs: 5100, recognitionMs: null, executionMs: 4900, turns: 24, cumulativeMs: 7610 }],
      id: 'local-solve-id', scramble: 'unsent-raw-scramble', moves: ['unsent-raw-turns'],
    };
    const draft = formatReplayAssistantDraft(replay, text => text.en);
    store.create('alice', 'replay', draft);
    expect(draft).toContain('F2L 5.100 s, execution 4.900 s, 24 turns (HTM), playback through 7.610 s');
    expect(draft).not.toMatch(/local-solve-id|unsent-raw|recognition 0/);
    expect(store.takeSubmission('alice', 'replay')).toBeNull();
    expect(store.read('alice').conversations[0].snapshot.draft).toBe('My existing draft');
    expect(store.read('bob').conversations).toEqual([]);
    expect(formatReplayAssistantDraft({ ...replay, stages: [] }, text => text.zh)).toContain('没有可靠的分阶段用时');
    const verifiedStages = formatReplayAssistantDraft({ ...replay, tps: null }, text => text.zh);
    expect(verifiedStages).not.toContain('TPS');
    expect(defaultReplayAnswer(verifiedStages, 'zh')?.answer).toContain('在有相应计时的阶段中');
  });
  it('tracks completed replies independently across chats and accounts without treating snapshots as completion', () => {
    const store = createAssistantConversations();
    store.create('alice', 'a');
    store.create('alice', 'b');
    store.create('bob', 'a');
    store.patch('alice', 'a', { turns: [{ question: 'first', partial: true, result: { answer: 'streaming', sources: [] } }] });
    expect(store.read('alice').conversations[0].unreadReply).toBeUndefined();
    store.replyCompleted('alice', 'a');
    store.replyCompleted('alice', 'b');
    expect(store.read('alice').conversations.map(chat => chat.unreadReply)).toEqual([true, true]);
    expect(store.read('alice').activeId).toBe('b');
    expect(store.read('bob').conversations[0].unreadReply).toBeUndefined();
    store.select('alice', 'a');
    // Selection alone is insufficient: the page could be hidden or covered on mobile.
    expect(store.read('alice').conversations[0].unreadReply).toBe(true);
    store.markReplyRead('alice', 'a');
    expect(store.read('alice').conversations.map(chat => chat.unreadReply)).toEqual([false, true]);
    let changes = 0;
    store.subscribe(() => { changes++; });
    store.markReplyRead('alice', 'a');
    store.replyCompleted('alice', 'b');
    store.replyCompleted('alice', 'missing');
    expect(changes).toBe(0);
    store.replyCompleted('alice', 'a');
    expect(changes).toBe(1);
    expect(store.read('alice').conversations[0].unreadReply).toBe(true);
  });

  it('restores pinned chats for the same account without persisting image bytes', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
    try {
      const store = createAssistantConversations();
      store.restorePinned('alice');
      store.create('alice', 'a');
      store.patch('alice', 'a', { turns: [{ question: 'picture', images: [{ data: 'secret-image', mediaType: 'image/png' }, { data: '', mediaType: 'image/png', attachmentId: 'saved-image-id' }] }] });
      store.rename('alice', 'a', '  Photo notes  ');
      store.setPinned('alice', 'a', true);
      expect([...data.values()].join('')).not.toContain('secret-image');
      const reopened = createAssistantConversations();
      reopened.restorePinned('bob');
      reopened.restorePinned('alice');
      expect(reopened.read('bob').conversations).toEqual([]);
      expect(reopened.read('alice').conversations[0]).toMatchObject({ id: 'a', title: 'Photo notes', pinned: true, snapshot: { turns: [{ question: 'picture', imagesExpired: true }] } });
      expect(reopened.read('alice').conversations[0].snapshot.turns[0].images).toEqual([{ data: '', mediaType: 'image/png', attachmentId: 'saved-image-id' }]);
      reopened.setPinned('alice', 'a', false);
      const again = createAssistantConversations();
      again.restorePinned('alice');
      expect(again.read('alice').conversations).toEqual([]);
    } finally { vi.unstubAllGlobals(); }
  });
  it('restores unpinned durable inbox pointers and unconfirmed delivery IDs without caching answers',()=>{
    const data=new Map<string,string>();vi.stubGlobal('window',{});vi.stubGlobal('localStorage',{getItem:(key:string)=>data.get(key) ?? null,setItem:(key:string,value:string)=>data.set(key,value)});
    try {
      const store=createAssistantConversations();store.restorePinned('alice');store.create('alice','chat');
      store.patch('alice','chat',{conversationId:'server-conversation',turns:[{question:'private',result:{answer:'large answer',sources:[]}}]});
      const delivery={id:'stable-message',key:'digest',input:{question:'new',lang:'en' as const,provider:'bailian' as const,thinking:'auto' as const,timeZone:'UTC',history:[]}};
      store.patch('alice','chat',{delivery});
      expect(data.get('cuberoot-assistant-recent:alice')).not.toContain('large answer');
      const reopened=createAssistantConversations();reopened.restorePinned('alice');reopened.restorePinned('bob');
      expect(reopened.read('alice').conversations[0].snapshot).toMatchObject({conversationId:'server-conversation',turns:[],delivery});
      expect(reopened.read('alice').conversations[0].pinned).toBeUndefined();expect(reopened.read('bob').conversations).toEqual([]);
      reopened.patch('alice','chat',{delivery:undefined});
      const final=createAssistantConversations();final.restorePinned('alice');expect(final.read('alice').conversations[0].snapshot.delivery).toBeUndefined();
    } finally {vi.unstubAllGlobals();}
  });
  it('branches through the selected answer without changing or aliasing the original', () => {
    const store = createAssistantConversations();
    store.create('alice', 'original');
    const turns = [{ question: 'first', result: { answer: 'answer', sources: [] } }, { question: 'later' }];
    store.patch('alice', 'original', { turns, conversationId: 'old-request' });
    store.branch('alice', 'branch', turns.slice(0, 1));
    const branch = store.read('alice').conversations[1];
    expect(branch.snapshot.turns).toEqual([turns[0]]);
    expect(branch.snapshot.conversationId).toBeNull();
    branch.snapshot.turns[0].question = 'changed';
    expect(turns[0].question).toBe('first');
    expect(store.read('alice').activeId).toBe('branch');
    expect(store.read('bob').conversations).toEqual([]);
  });
  it('keeps drafts, images and context independent while switching and receiving a background reply', () => {
    const store = createAssistantConversations();
    store.create('alice', 'a');
    const first = { ...store.read('alice').conversations[0].snapshot, draft: 'first draft', conversationId: 'request-a', turns: [{ question: 'first question' }] };
    store.update('alice', 'a', first);
    store.create('alice', 'b');
    const second = { ...store.read('alice').conversations[1].snapshot, draft: 'second draft', conversationId: 'request-b' };
    store.update('alice', 'b', second);
    store.update('alice', 'a', { ...first, turns: [{ question: 'first question', result: { answer: 'first reply', sources: [] } }] });
    expect(store.read('alice').activeId).toBe('b');
    expect(store.read('alice').conversations[1].snapshot).toBe(second);
    store.select('alice', 'a');
    expect(store.read('alice').activeId).toBe('a');
    expect(store.read('alice').conversations[0].snapshot.turns[0].result?.answer).toBe('first reply');
    expect(store.read('alice').conversations[0].snapshot.draft).toBe('first draft');
  });

  it('isolates accounts and preserves chats when a workspace unsubscribes and reopens', () => {
    const store = createAssistantConversations();
    const unsubscribe = store.subscribe(() => {});
    store.create('alice', 'a');
    const saved = store.read('alice');
    unsubscribe();
    store.create('bob', 'b');
    store.select('bob', 'a');
    expect(store.read('bob').activeId).toBe('b');
    expect(store.read('bob').conversations.map(item => item.id)).toEqual(['b']);
    expect(store.read('alice')).toBe(saved);
    expect(store.serverSnapshot().conversations).toEqual([]);
  });

  it('does not notify recursively for an unchanged component snapshot', () => {
    const store = createAssistantConversations();
    store.create('alice', 'a');
    let notifications = 0;
    store.subscribe(() => { notifications++; });
    store.update('alice', 'a', { ...store.read('alice').conversations[0].snapshot });
    expect(notifications).toBe(0);
  });

  it('hands a submission to one consumer without overwriting a newer draft or attachments', () => {
    const store = createAssistantConversations();
    store.create('alice', 'a');
    const images = [{ data: 'test', mediaType: 'image/png' as const }];
    store.patch('alice', 'a', { draft: 'translate WIC', images });
    expect(store.submit('alice', 'a', 'translate WIC', images)).toBe(true);
    expect(store.submit('alice', 'a', 'duplicate', [])).toBe(false);
    expect(store.read('alice').open).toBe(true);
    expect(store.read('alice').conversations[0].snapshot.draft).toBe('');
    const submitted = store.takeSubmission('alice', 'a');
    expect(submitted).toEqual({ question: 'translate WIC', images });
    expect(store.takeSubmission('alice', 'a')).toBeNull();
    store.patch('alice', 'a', { draft: 'next question', images });
    store.setOpen('alice', false);
    store.patch('alice', 'a', { turns: [{ question: 'translate WIC', result: { answer: '廉政委员会', sources: [] } }] });
    expect(store.read('alice').conversations[0].snapshot).toMatchObject({ draft: 'next question', images });
    expect(store.read('alice').opened).toBe(true);
    expect(store.read('bob').open).toBe(false);
    expect(store.read('bob').conversations).toEqual([]);
  });
});

it('submits an independent chat while the original chat keeps its running task',()=>{
  const store=createAssistantConversations();
  store.create('owner','original');
  store.setResponding('owner','original','thinking');
  const reference={messageId:'source',messageVersion:1,role:'user' as const,selectedText:'Only the final',sourceStatus:'complete' as const};
  store.create('owner','parallel');
  expect(store.submit('owner','parallel','New question',[],'new-message',[reference])).toBe(true);
  expect(store.read('owner').activeId).toBe('parallel');
  expect(store.read('owner').conversations[0].responding).toBe('thinking');
  expect(store.read('owner').conversations[1].snapshot.turns).toEqual([]);
  expect(store.takeSubmission('owner','parallel')).toMatchObject({messageId:'new-message',references:[reference]});
  expect(store.read('another-owner').conversations).toHaveLength(0);
});
