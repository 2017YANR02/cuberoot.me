"use client";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import {
  RotateCcw, Maximize, Minimize, Eraser, Save, FolderOpen,
  Trash2, Copy, Download, List, Shuffle, type LucideIcon,
} from "@app-foundation/icons/lucide";
import { Tooltip } from "@/components/Tooltip";
import PageHeading from "@/components/PageHeading";
import MoreToggle, { MoreTogglePanel } from "@/components/MoreToggle";
import BoolToggle from "@/components/BoolToggle";
import DrawCompetitionPicker from "./DrawCompetitionPicker";
import DrawCandidates from "./DrawCandidates";
import { tr } from "@/i18n/tr";
import { apiUrl } from "@/lib/api-base";
import { copyClipboardText } from "@/lib/clipboard";
import {
  createDrawController,
  labels,
  type DrawView,
} from "@cuberoot/shared/draw/controller";
import {
  DRAW_STORAGE_KEY,
  resultsText,
} from "@cuberoot/shared/draw";
import "./draw.css";
function DrawIconButton({ icon: Icon, label, ...props }: ComponentProps<"button"> & {
  icon: LucideIcon;
  label: string;
}) {
  return <Tooltip content={label}>{tip => (
    <button {...tip} {...props} type="button" className="draw-icon-button" aria-label={label}>
      <Icon size={18} aria-hidden="true" />
    </button>
  )}</Tooltip>;
}
export default function DrawPage() {
  const { i18n } = useTranslation();
  const [v, setView] = useState<DrawView>();
  const controller = useRef<ReturnType<typeof createDrawController> | null>(
    null,
  );
  const root = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    const c = createDrawController({
      read: () => JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY) || "null"),
      write: (value) =>
        localStorage.setItem(DRAW_STORAGE_KEY, JSON.stringify(value)),
      confirm: async (message) => window.confirm(message),
      random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
      copy: async (text) => {
        if (!(await copyClipboardText(text))) throw new Error("Copy failed");
      },
      request: async <T,>(path: string) => {
        const r = await fetch(apiUrl("/v1" + path));
        if (!r.ok) throw new Error("Request failed");
        return r.json() as Promise<T>;
      },
      translate: tr,
      update: setView,
    });
    controller.current = c;
    c.start();
    return () => c.dispose();
  }, [i18n.language]);
  const l = v?.copy ?? labels(tr);
  const act = (a: string, i = 0) => void controller.current?.act(a, i);
  const input = (
    key: "draft" | "query" | "listName" | "letters",
    value: string,
  ) => controller.current?.input(key, value);
  function download() {
    if (!v) return;
    const url = URL.createObjectURL(
      new Blob([resultsText(v.session)], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "cuberoot-draw.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="draw-page" ref={root}>
      <PageHeading>{l.title}</PageHeading>
      {v && (
        <>
          <div className="draw-options">
            <BoolToggle
              label={l.training}
              value={v.session.training}
              onChange={(b) => controller.current?.setting("training", b)}
            />
            <BoolToggle
              label={l.stage}
              value={v.session.stage}
              onChange={(b) => controller.current?.setting("stage", b)}
            />
            <BoolToggle
              label={l.repeat}
              value={v.session.repeat}
              onChange={(b) => controller.current?.setting("repeat", b)}
            />
            {!v.session.training && (
              <label>
                {l.count}
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={v.session.count}
                  onChange={(e) =>
                    controller.current?.setting(
                      "count",
                      Math.min(100, Math.max(1, Number(e.target.value) || 1)),
                    )
                  }
                />
              </label>
            )}
          </div>
          {v.message && <p role="status">{v.message}</p>}
          <div className="draw-actions">
            <MoreToggle
              expanded={v.editing}
              onToggle={() => act("edit")}
              disabled={v.busy}
              aria-controls="draw-editor"
            >
              <List size={18} aria-hidden="true" />{l.editor}
            </MoreToggle>
            <DrawIconButton icon={RotateCcw} label={l.reset}
              onClick={() => act("reset")}
              disabled={v.busy || !v.session.history.length}
             />
            <DrawIconButton icon={fullscreen ? Minimize : Maximize} label={fullscreen ? l.exitFullscreen : l.fullscreen}
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen();
                else void root.current?.requestFullscreen().catch(() => {});
              }}
            />
          </div>
          <MoreTogglePanel expanded={v.editing} id="draw-editor">
            <section className="draw-editor">
              <div className="draw-list-editor">
                <label>
                  <span className="draw-section-title">{l.list}</span>
                  <textarea
                    value={v.draft}
                    maxLength={500000}
                    onChange={(e) => input("draft", e.target.value)}
                    aria-describedby="draw-list-format draw-list-note"
                    placeholder={tr({
                      zh: "小明\n小红\n#12 小方",
                      en: "Alex\nSam\n#12 Taylor",
                    })}
                  />
                </label>
                <p id="draw-list-format">{l.hint}</p>
                {!!v.duplicates && (
                  <p>
                    {l.duplicates} ({v.duplicates}){" "}
                    <button onClick={() => act("dedupe")}>{l.dedupe}</button>
                  </p>
                )}
                <div className="draw-actions">
                  <button className="draw-apply" onClick={() => act("apply")}>
                    {l.apply}
                  </button>
                  <DrawIconButton icon={Eraser} label={l.clear} onClick={() => act("clear")} />
                </div>
                <p id="draw-list-note">{l.editNote}</p>
                {v.session.training && (
                  <div className="draw-training-settings">
                    <label>
                      {l.letters}
                      <input
                        value={v.letters}
                        onChange={(e) => input("letters", e.target.value)}
                      />
                    </label>
                    <div className="draw-actions">
                      <button onClick={() => act("builtin")}>
                        {l.builtin}
                      </button>
                      <button onClick={() => act("weak")}>{l.weak}</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="draw-list-tools">
                <section>
                  <h2 className="draw-section-title">{l.saved}</h2>
                  <div className="draw-actions draw-input-row">
                    <input
                      aria-label={l.name}
                      placeholder={l.name}
                      value={v.listName}
                      onChange={(e) => input("listName", e.target.value)}
                    />
                    <DrawIconButton icon={Save} label={l.save}
                      disabled={!v.listName.trim() || !v.draft.trim()}
                      onClick={() => act("save")}
                     />
                  </div>
                  {v.saved.map((s, i) => (
                    <div className="draw-actions" key={s.name}>
                      <span>{s.name}</span>
                      <DrawIconButton icon={FolderOpen} label={`${l.load} · ${s.name}`} onClick={() => act("load", i)} />
                      <DrawIconButton icon={Trash2} label={`${l.remove} · ${s.name}`} onClick={() => act("remove", i)} />
                    </div>
                  ))}
                </section>
                <section>
                  <h2 className="draw-section-title">{l.import}</h2>
                  <DrawCompetitionPicker
                    value={v.query}
                    onChange={(value) => input("query", value)}
                    isZh={i18n.language.startsWith("zh")}
                    onPick={(comp) => {
                      controller.current?.selectCompetition(comp);
                      act("import");
                    }}
                  />
                  {v.loading && (
                    <p role="status">
                      {tr({ zh: "正在导入…", en: "Importing…" })}
                    </p>
                  )}
                </section>
              </div>
              {v.preview && (
                <section className="draw-import-preview">
                  <h2>
                    {l.preview} · {v.source}
                  </h2>
                  <p>
                    {l.source} · {v.preview.split("\n").length}
                  </p>
                  <pre>{v.preview}</pre>
                  <div className="draw-actions">
                    <button onClick={() => act("replace")}>{l.replace}</button>
                    <button onClick={() => act("append")}>{l.append}</button>
                    <button onClick={() => act("cancel")}>{l.cancel}</button>
                  </div>
                </section>
              )}
            </section>
          </MoreTogglePanel>
          <div className="draw-counts">
            <span>
              {l.remaining} {v.remaining}
            </span>
            <span>
              {l.history} {v.session.history.length}
            </span>
          </div>
          <section
            className={`draw-stage ${v.session.training ? "is-pool" : "is-sphere"} ${v.session.stage ? "is-3d" : ""} ${v.busy ? "is-drawing" : ""} ${v.last.length && !v.busy ? "has-result" : ""}`}
            aria-live="polite"
            aria-busy={v.busy}
          >
            {(v.session.stage || !v.last.length || v.busy) && (
              <DrawCandidates session={v.session} last={v.last} busy={v.busy} />
            )}
            {!!v.last.length && !v.busy && (
              <div className="draw-winners">
                {v.last.map((t) => (
                  <div
                    className="draw-card winner"
                    key={`${v.session.history.length}-${t.id}`}
                  >
                    <strong>{t.name}</strong>
                    {t.number && <small>#{t.number}</small>}
                    {v.session.training && v.revealed && (
                      <p>{t.answer || l.noAnswer}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
          <div className="draw-actions draw-primary">
            {v.session.training && !!v.last.length && !v.revealed && (
              <button onClick={() => act("reveal")} disabled={v.busy}>
                {l.reveal}
              </button>
            )}
            {v.session.training && v.revealed && (
              <>
                <button onClick={() => act("known")}>{l.known}</button>
                <button onClick={() => act("unknown")}>{l.unknown}</button>
              </>
            )}
            <button
              disabled={v.busy || !v.remaining}
              onClick={() => act("draw")}
            >
              <Shuffle size={18} aria-hidden="true" />{v.busy ? l.busy : v.remaining ? l.next : l.empty}
            </button>
          </div>
          <section>
            <div className="draw-actions">
              <h2>{l.history}</h2>
              <DrawIconButton icon={Copy} label={l.copy}
                disabled={v.busy || !v.session.history.length}
                onClick={() => act("copy")}
               />
              <DrawIconButton icon={Download} label={l.export}
                disabled={v.busy || !v.session.history.length}
                onClick={download}
              />
            </div>
            <ol reversed>
              {v.session.history
                .slice(0, v.busy ? -v.last.length : undefined)
                .reverse()
                .map((r, i) => (
                  <li key={v.session.history.length - i}>
                    {r.ticket.number && `#${r.ticket.number} `}
                    {r.ticket.name}
                    {r.known !== undefined &&
                      ` · ${r.known ? l.known : l.unknown}`}
                  </li>
                ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
