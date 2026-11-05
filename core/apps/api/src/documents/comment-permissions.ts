import * as Y from 'yjs';

/** Validate on a disposable replica before Hocuspocus applies an untrusted update.
 * Pending structs/deletes are rejected: otherwise a later writer could activate
 * content edits hidden in an incomplete commenter update. */
export function assertCommentOnlyUpdate(document: Y.Doc, update: Uint8Array): void {
  const replica = new Y.Doc();
  try {
    replica.getXmlFragment('default');
    replica.getArray('sheets');
    replica.getMap('documentComments');
    replica.getMap('documentSuggestions');
    replica.getArray('documentActivity');
    Y.applyUpdate(replica, Y.encodeStateAsUpdate(document));
    const suggestionsBefore = replica.getMap<Record<string, unknown>>('documentSuggestions').toJSON();
    const activityBefore = replica.getArray('documentActivity').toArray();
    let denied = false;
    replica.on('afterTransaction', transaction => {
      for (const changed of transaction.changed.keys()) {
        let root = changed;
        while (root.parent) root = root.parent;
        const name = [...replica.share].find(([, type]) => type === root)?.[0];
        if (!name || !['documentComments', 'documentSuggestions', 'documentActivity'].includes(name)) denied = true;
      }
    });
    Y.applyUpdate(replica, update);
    if (denied || replica.store.pendingStructs || replica.store.pendingDs) throw new Error('Commenters cannot edit document content');
    const suggestionsAfter = replica.getMap<Record<string, unknown>>('documentSuggestions').toJSON();
    for (const [id, item] of Object.entries(suggestionsAfter)) {
      if (JSON.stringify(item) === JSON.stringify(suggestionsBefore[id])) continue;
      if (!item || item.status !== 'open' || suggestionsBefore[id]?.status && suggestionsBefore[id].status !== 'open') {
        throw new Error('Commenters cannot decide suggestions');
      }
    }
    for (const id of Object.keys(suggestionsBefore)) {
      if (!(id in suggestionsAfter)) throw new Error('Commenters cannot remove suggestions');
    }
    const activities = replica.getArray<Record<string, unknown>>('documentActivity').toArray();
    if (activities.length < activityBefore.length || activityBefore.some((value, i) => JSON.stringify(value) !== JSON.stringify(activities[i]))) {
      throw new Error('Commenters cannot rewrite activity');
    }
    if (activities.slice(activityBefore.length).some(item => !['comment', 'reply', 'resolve', 'suggestion'].includes(String(item.kind)))) {
      throw new Error('Invalid commenter activity');
    }
  } finally { replica.destroy(); }
}
