"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import PageHeading from "@/components/PageHeading";
import MoreToggle, { MoreTogglePanel } from "@/components/MoreToggle";
import BoolToggle from "@/components/BoolToggle";
import { ClearButton } from "@/components/ClearButton";
import { tr } from "@/i18n/tr";
import { apiUrl } from "@/lib/api-base";
import {
  createDrawController,
  labels,
  type DrawView,
} from "@cuberoot/shared/draw/controller";
import {
  DRAW_STORAGE_KEY,
  resultsText,
  candidates,
} from "@cuberoot/shared/draw";
import "./draw.css";
export default function DrawPage() {
  const { i18n } = useTranslation();
  const [v, setView] = useState<DrawView>();
  const controller = useRef<ReturnType<typeof createDrawController> | null>(
    null,
  );
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = createDrawController({
      read: () => JSON.parse(localStorage.getItem(DRAW_STORAGE_KEY) || "null"),
      write: (value) =>
        localStorage.setItem(DRAW_STORAGE_KEY, JSON.stringify(value)),
      confirm: async (message) => window.confirm(message),
      random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
      copy: (text) => navigator.clipboard.writeText(text),
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
              {l.editor}
            </MoreToggle>
            <button
              onClick={() => act("reset")}
              disabled={v.busy || !v.session.history.length}
            >
              {l.reset}
            </button>
            <button
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen();
                else void root.current?.requestFullscreen().catch(() => {});
              }}
            >
              {l.fullscreen}
            </button>
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
                  <button onClick={() => act("clear")}>{l.clear}</button>
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
                    <button
                      disabled={!v.listName.trim() || !v.draft.trim()}
                      onClick={() => act("save")}
                    >
                      {l.save}
                    </button>
                  </div>
                  {v.saved.map((s, i) => (
                    <div className="draw-actions" key={s.name}>
                      <span>{s.name}</span>
                      <button onClick={() => act("load", i)}>{l.load}</button>
                      <button onClick={() => act("remove", i)}>
                        {l.remove}
                      </button>
                    </div>
                  ))}
                </section>
                <section>
                  <h2 className="draw-section-title">{l.import}</h2>
                  <div className="draw-actions draw-input-row">
                    <input
                      aria-label={l.query}
                      placeholder={l.query}
                      value={v.query}
                      onChange={(e) => input("query", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") act("search");
                      }}
                    />
                    {!!v.query && (
                      <ClearButton onClick={() => input("query", "")} />
                    )}
                    <button disabled={v.loading} onClick={() => act("search")}>
                      {l.search}
                    </button>
                  </div>
                  {v.competitions.map((c, i) => (
                    <div className="draw-actions" key={c.id}>
                      <span>
                        {c.name} · {c.date}
                      </span>
                      <button
                        disabled={v.loading}
                        onClick={() => act("import", i)}
                      >
                        {l.import}
                      </button>
                    </div>
                  ))}
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
            className={`draw-stage ${v.session.stage ? "is-3d" : ""} ${v.busy ? "is-drawing" : ""}`}
            aria-live="polite"
            aria-busy={v.busy}
          >
            {!v.last.length || v.busy ? (
              <div className="draw-cloud">
                {candidates(v.session)
                  .slice(0, 24)
                  .map((t, i) => (
                    <div
                      className="draw-card"
                      key={t.id}
                      style={{ "--i": i } as React.CSSProperties}
                    >
                      {t.name}
                      {t.number && <small>#{t.number}</small>}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="draw-winners">
                {v.last.map((t) => (
                  <div className="draw-card winner" key={t.id}>
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
              {v.busy ? l.busy : v.remaining ? l.next : l.empty}
            </button>
          </div>
          <section>
            <div className="draw-actions">
              <h2>{l.history}</h2>
              <button
                disabled={!v.session.history.length}
                onClick={() => act("copy")}
              >
                {l.copy}
              </button>
              <button disabled={!v.session.history.length} onClick={download}>
                {l.export}
              </button>
            </div>
            <ol reversed>
              {v.session.history
                .slice()
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
