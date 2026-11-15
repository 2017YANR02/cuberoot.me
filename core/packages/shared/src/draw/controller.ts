import {
  candidates,
  decodeSession,
  deduplicate,
  draw,
  duplicateCount,
  freshSession,
  parseList,
  replaceList,
  resultsText,
  trainingList,
  weakList,
  type Session,
  type SavedList,
  type Ticket,
} from "@cuberoot/shared/draw";
import words from "@cuberoot/shared/draw/words";
export const COPY = {
  title: ["抽奖", "Lucky Draw"],
  list: ["名单", "List"],
  training: ["盲拧训练", "Blindfolded training"],
  editor: ["编辑名单", "Edit list"],
  apply: ["应用名单", "Apply list"],
  clear: ["清空名单", "Clear list"],
  reset: ["重新开始本轮", "Restart round"],
  next: ["抽出", "Draw"],
  reveal: ["显示联想词", "Reveal association"],
  known: ["会", "Know it"],
  unknown: ["不会", "Needs practice"],
  weak: ["只练不会的", "Practice missed pairs"],
  repeat: ["允许重复", "Allow replacement"],
  stage: ["三维展示", "3D stage"],
  count: ["每次抽取数量", "Batch size"],
  remaining: ["剩余", "Remaining"],
  history: ["已抽出", "Drawn"],
  empty: ["本轮已抽完", "Round complete"],
  hint: [
    "一行一项；编号格式 #12 姓名；词库格式 KP = 联想词",
    "One per line; #12 Name for numbers; KP = word for associations",
  ],
  duplicates: [
    "有重复项；同名可保留，词条可去重",
    "Duplicates found; keep distinct people or deduplicate words",
  ],
  dedupe: ["去重", "Deduplicate"],
  save: ["保存名单", "Save list"],
  saved: ["已存名单", "Saved lists"],
  name: ["名单名称", "List name"],
  letters: ["编码字母范围", "Letter range"],
  builtin: ["载入参考词库", "Load reference words"],
  copy: ["复制结果", "Copy results"],
  export: ["导出结果", "Export results"],
  search: ["搜索比赛", "Search competitions"],
  query: ["比赛名称", "Competition name"],
  import: ["导入报名选手", "Import registrations"],
  replace: ["替换名单", "Replace list"],
  append: ["追加名单", "Append to list"],
  preview: ["导入预览", "Import preview"],
  source: [
    "来源：粗饼已报名选手",
    "Source: Cubing China accepted registrations",
  ],
  cancel: ["取消", "Cancel"],
  confirm: [
    "这会清空当前抽取记录，是否继续？",
    "This clears the current draw history. Continue?",
  ],
  fail: [
    "操作失败，请重试；原名单仍保留。",
    "Unable to complete. Retry; the original list is retained.",
  ],
  storage: [
    "保存失败，请先导出结果。",
    "Unable to save. Export results before leaving.",
  ],
  noResults: ["没有结果", "No results"],
  noAnswer: ["此项未设置联想词", "No association for this item"],
  savedOk: ["已保存", "Saved"],
  copied: ["已复制", "Copied"],
  remove: ["删除名单", "Delete list"],
  removeConfirm: ["删除这份已存名单？", "Delete this saved list?"],
  load: ["载入", "Load"],
  busy: ["正在抽取…", "Drawing…"],
  importConfirm: [
    "替换当前名单并清空本轮记录？",
    "Replace the list and clear this round?",
  ],
  fullscreen: ["全屏", "Fullscreen"],
  exitFullscreen: ["退出全屏", "Exit fullscreen"],
  editNote: [
    "修改名单将开始新一轮。",
    "Applying a changed list starts a new round.",
  ],
  rating: ["先揭晓并标记当前编码", "Reveal and rate the current pair first"],
  tooLarge: ["名单最多 10000 项", "Maximum 10,000 entries"],
  emptyList: ["请输入至少一项", "Enter at least one item"],
} as const;
export type Copy = Record<keyof typeof COPY, string>;
export function labels(
  translate: (v: { zh: string; en: string }) => string,
): Copy {
  return Object.fromEntries(
    Object.entries(COPY).map(([k, [zh, en]]) => [k, translate({ zh, en })]),
  ) as Copy;
}
export interface Competition {
  id: string;
  name: string;
  date: string;
}
export interface DrawView {
  session: Session;
  draft: string;
  editing: boolean;
  remaining: number;
  duplicates: number;
  last: Ticket[];
  revealed: boolean;
  busy: boolean;
  message: string;
  saved: SavedList[];
  listName: string;
  letters: string;
  query: string;
  competitions: Competition[];
  preview: string;
  source: string;
  loading: boolean;
  copy: Copy;
}
export interface Adapter {
  read(): unknown;
  write(v: unknown): void;
  confirm(message: string): Promise<boolean>;
  random(): number;
  copy(text: string): Promise<void>;
  request<T>(path: string): Promise<T>;
  translate(v: { zh: string; en: string }): string;
  update(v: DrawView): void;
}
export function createDrawController(a: Adapter) {
  const copy = labels(a.translate);
  let s = freshSession();
  let saved: SavedList[] = [];
  try {
    const raw = a.read() as { session?: unknown; saved?: SavedList[] } | null;
    s = decodeSession(raw?.session) ?? s;
    if (Array.isArray(raw?.saved))
      saved = raw.saved
        .filter(
          (v) =>
            typeof v.name === "string" &&
            typeof v.text === "string" &&
            typeof v.training === "boolean",
        )
        .slice(0, 50);
  } catch {
    /* Empty first visit. */
  }
  let v: DrawView = {
    session: s,
    draft: s.text,
    editing: !s.entries.length,
    remaining: 0,
    duplicates: 0,
    last:
      s.training && s.history.length
        ? [s.history[s.history.length - 1].ticket]
        : [],
    revealed: false,
    busy: false,
    message: "",
    saved,
    listName: "",
    letters: [...new Set(Object.keys(words).join(""))].sort().join(""),
    query: "",
    competitions: [],
    preview: "",
    source: "",
    loading: false,
    copy,
  };
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  function emit(persist = false) {
    v = {
      ...v,
      session: s,
      remaining: candidates(s).length,
      duplicates: duplicateCount(parseList(v.draft)),
      saved,
    };
    if (persist)
      try {
        a.write({ session: s, saved });
      } catch {
        v.message = copy.storage;
      }
    if (!disposed) a.update(v);
  }
  async function replace(text: string, force = false) {
    if (!text.trim()) {
      v.message = copy.emptyList;
      emit();
      return;
    }
    if (parseList(text).length > 10000) {
      v.message = copy.tooLarge;
      emit();
      return;
    }
    if ((force || s.history.length) && !(await a.confirm(copy.importConfirm)))
      return;
    s = replaceList(s, text);
    v = {
      ...v,
      draft: text,
      editing: false,
      last: [],
      revealed: false,
      message: "",
      preview: "",
    };
    emit(true);
  }
  return {
    start() {
      emit();
    },
    dispose() {
      disposed = true;
      generation++;
      if (timer) clearTimeout(timer);
    },
    selectCompetition(comp: Competition) {
      generation++;
      v.query = comp.name;
      v.competitions = [comp];
      v.preview = "";
      v.message = "";
      v.loading = false;
      emit();
    },
    input(key: "draft" | "query" | "listName" | "letters", value: string) {
      v = { ...v, [key]: value, message: "" };
      if (key === "query") {
        generation++;
        v.competitions = [];
        v.loading = false;
      }
      emit();
    },
    setting(
      key: "training" | "repeat" | "stage" | "count",
      value: boolean | number,
    ) {
      if (v.busy) return;
      s = { ...s, [key]: value };
      if (key === "training") {
        v.last = [];
        v.revealed = false;
        v.editing = true;
      }
      emit(true);
    },
    async act(action: string, index = 0) {
      if (v.busy) return;
      v.message = "";
      try {
        if (action === "edit") v.editing = !v.editing;
        if (action === "apply") {
          if (v.draft === s.text) {
            v.editing = false;
          } else {
            await replace(v.draft);
            return;
          }
        }
        if (action === "dedupe") {
          v.draft = deduplicate(v.draft);
        }
        if (action === "clear" && (await a.confirm(copy.confirm))) {
          s = replaceList(s, "");
          v.draft = "";
          v.last = [];
          v.editing = true;
        }
        if (
          action === "reset" &&
          (!s.history.length || (await a.confirm(copy.confirm)))
        ) {
          s = { ...s, history: [] };
          v.last = [];
          v.revealed = false;
        }
        if (action === "draw") {
          if (
            s.training &&
            v.last.length &&
            s.history.at(-1)?.known === undefined
          ) {
            v.message = copy.rating;
            emit();
            return;
          }
          const before = s.history.length;
          s = draw(s, a.random, Date.now());
          v.last = s.history.slice(before).map((r) => r.ticket);
          v.revealed = false;
          v.busy = s.stage && v.last.length > 0;
          emit(true);
          if (v.busy)
            timer = setTimeout(() => {
              v.busy = false;
              emit();
            }, s.training ? 850 : 1500);
          return;
        }
        if (action === "reveal") v.revealed = true;
        if (
          (action === "known" || action === "unknown") &&
          v.revealed &&
          s.history.length
        ) {
          s = {
            ...s,
            history: s.history.map((r, i) =>
              i === s.history.length - 1
                ? { ...r, known: action === "known" }
                : r,
            ),
          };
        }
        if (action === "builtin") {
          await replace(trainingList(words, v.letters));
          return;
        }
        if (action === "weak") {
          await replace(weakList(s));
          return;
        }
        if (action === "save" && v.listName.trim()) {
          const item = {
            name: v.listName.trim(),
            text: v.draft,
            training: s.training,
          };
          if (
            saved.some((l) => l.name === item.name) &&
            !(await a.confirm(copy.importConfirm))
          )
            return;
          saved = [item, ...saved.filter((l) => l.name !== item.name)].slice(
            0,
            50,
          );
          v.message = copy.savedOk;
        }
        if (action === "load" && saved[index]) {
          const item = saved[index];
          await replace(item.text);
          if (s.text === item.text) s = { ...s, training: item.training };
        }
        if (action === "remove" && (await a.confirm(copy.removeConfirm)))
          saved = saved.filter((_, i) => i !== index);
        if (action === "copy") {
          await a.copy(resultsText(s));
          v.message = copy.copied;
        }
        if (action === "search") {
          const id = ++generation;
          v.loading = true;
          v.competitions = [];
          emit();
          try {
            const data = await a.request<{ competitions: Competition[] }>(
              `/draw/competitions?q=${encodeURIComponent(v.query)}`,
            );
            if (id !== generation) return;
            v.competitions = data.competitions;
            if (!data.competitions.length) v.message = copy.noResults;
          } finally {
            if (id === generation) v.loading = false;
          }
        }
        if (action === "import" && v.competitions[index]) {
          const comp = v.competitions[index];
          const id = ++generation;
          v.loading = true;
          emit();
          try {
            const data = await a.request<{ text: string }>(
              `/draw/competitions/${encodeURIComponent(comp.id)}/registrations`,
            );
            if (id !== generation) return;
            v.preview = data.text;
            v.source = comp.name;
            if (!data.text) v.message = copy.noResults;
          } finally {
            if (id === generation) v.loading = false;
          }
        }
        if (action === "replace") {
          await replace(v.preview, !!s.text);
          return;
        }
        if (action === "append") {
          await replace([s.text, v.preview].filter(Boolean).join("\n"));
          return;
        }
        if (action === "cancel") v.preview = "";
      } catch {
        v.message = copy.fail;
        v.loading = false;
      }
      emit(true);
    },
  };
}
