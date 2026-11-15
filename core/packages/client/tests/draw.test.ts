import { describe, it, expect } from "vitest";
import {
  freshSession,
  replaceList,
  draw,
  candidates,
  decodeSession,
  weakList,
  duplicateCount,
} from "@cuberoot/shared/draw";
import {
  createDrawController,
  type DrawView,
} from "@cuberoot/shared/draw/controller";
describe("draw rounds", () => {
  it("preserves distinct tickets with identical names and original numbers", () => {
    let s = replaceList(freshSession(), "#12 Alex\nAlex\nAlex");
    expect(duplicateCount(s.entries)).toBe(1);
    s = { ...s, count: 10 };
    s = draw(s, () => 0, 42);
    expect(s.history.map((r) => r.ticket.id)).toEqual(["0", "1", "2"]);
    expect(candidates(s)).toEqual([]);
    expect(s.history[0].ticket.number).toBe("12");
    expect(decodeSession(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it("allows replacement between batches but never within one batch", () => {
    let s = { ...replaceList(freshSession(), "A\nB"), repeat: true, count: 5 };
    s = draw(s, () => 0.99, 1);
    expect(s.history.map((r) => r.ticket.name)).toEqual(["B", "A"]);
    s = draw(s, () => 0, 2);
    expect(s.history).toHaveLength(4);
  });
  it("uses latest self assessment, not dictionary equality", () => {
    let s = replaceList(freshSession(), "AB = apple\nCD = cat");
    s = draw({ ...s, repeat: true }, () => 0, 1);
    s.history[0].known = false;
    expect(weakList(s)).toBe("AB = apple");
    s = draw(s, () => 0, 2);
    s.history[1].known = true;
    expect(weakList(s)).toBe("");
  });
  it("rejects corrupt persisted history instead of consuming the wrong ticket", () => {
    const s = replaceList(freshSession(), "A");
    expect(
      decodeSession({ ...s, history: [{ ticket: { id: "99" }, at: 1 }] }),
    ).toBeNull();
  });
  it("does not replace a round on cancelled import and restores unfinished training", async () => {
    let view: DrawView;
    let stored: unknown;
    const c = createDrawController({
      read: () => null,
      write: (v) => {
        stored = v;
      },
      confirm: async () => false,
      random: () => 0,
      copy: async () => {},
      request: async <T>() => ({}) as T,
      translate: (v) => v.en,
      update: (v) => {
        view = v;
      },
    });
    c.start();
    c.input("draft", "AB = apple");
    await c.act("apply");
    c.setting("stage", false);
    c.setting("training", true);
    await c.act("draw");
    await c.act("draw");
    expect(view!.session.history).toHaveLength(1);
    c.input("draft", "CD = cat");
    await c.act("apply");
    expect(view!.session.text).toBe("AB = apple");
    expect(stored).toBeTruthy();
    c.dispose();
  });
});
