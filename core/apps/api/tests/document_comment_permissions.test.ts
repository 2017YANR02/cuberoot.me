import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { assertCommentOnlyUpdate } from '../src/documents/comment-permissions.js';
function update(edit: (doc: Y.Doc) => void) {
  const server = new Y.Doc();
  server.getText('body').insert(0, 'protected text');
  server.getMap('documentSuggestions').set('existing', { status: 'open', replacement: 'suggestion' });
  const client = new Y.Doc(); Y.applyUpdate(client, Y.encodeStateAsUpdate(server));
  const vector = Y.encodeStateVector(client); edit(client);
  return { server, client, payload: Y.encodeStateAsUpdate(client, vector) };
}
function check(edit: (doc: Y.Doc) => void, allowed: boolean) {
  const { server, client, payload } = update(edit);
  try {
    const validate = () => assertCommentOnlyUpdate(server, payload);
    if (allowed) expect(validate).not.toThrow(); else expect(validate).toThrow();
    expect(server.getText('body').toString()).toBe('protected text');
  } finally { server.destroy(); client.destroy(); }
}
describe('commenter Yjs boundary', () => {
  it('allows comments, replies and comment activity', () => check(doc => {
    doc.getMap('documentComments').set('comment', { body: 'Comment', replies: [{ body: 'Reply' }] });
    doc.getArray('documentActivity').push([{ kind: 'comment' }]);
  }, true));
  it('allows proposing an open suggestion', () => check(doc => doc.getMap('documentSuggestions').set('new', { status: 'open', replacement: 'proposed' }), true));
  it('rejects text edits mixed into a comment update', () => check(doc => {
    doc.getMap('documentComments').set('comment', { body: 'Comment' }); doc.getText('body').delete(0, 4);
  }, false));
  it('rejects ProseMirror body edits', () => check(doc => doc.getXmlFragment('default').insert(0, [new Y.XmlElement('paragraph')]), false));
  it('rejects spreadsheet edits', () => check(doc => doc.getArray('sheets').push([new Y.Map()]), false));
  it.each(['accepted', 'rejected'])('rejects %s suggestions', status => check(doc => doc.getMap('documentSuggestions').set('existing', { status }), false));
  it('rejects deleting suggestions', () => check(doc => doc.getMap('documentSuggestions').delete('existing'), false));
  it('rejects forged edit activity', () => check(doc => doc.getArray('documentActivity').push([{ kind: 'edit' }]), false));
  it('rejects incomplete updates that could later activate a content edit', () => {
    const client = new Y.Doc(), server = new Y.Doc();
    client.getText('body').insert(0, 'first');
    const vector = Y.encodeStateVector(client);
    client.getText('body').insert(5, 'hidden');
    expect(() => assertCommentOnlyUpdate(server, Y.encodeStateAsUpdate(client, vector))).toThrow();
    client.destroy(); server.destroy();
  });
});
