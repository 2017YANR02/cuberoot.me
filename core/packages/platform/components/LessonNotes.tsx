"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Plus, Check, X, NotebookPen } from "lucide-react";
import {
  addNoteAction,
  updateNoteAction,
  deleteNoteAction,
} from "@/app/actions/notes";
import type { LessonNote } from "@/lib/db/notes";

type Props = {
  lessonId: string;
  initialNotes: LessonNote[];
  // 由播放器提供:取当前播放秒数 / 跳转到指定秒数。
  getCurrentTime: () => number;
  onSeek: (sec: number) => void;
};

function formatTimestamp(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
}

export function LessonNotes({
  lessonId,
  initialNotes,
  getCurrentTime,
  onSeek,
}: Props) {
  const [notes, setNotes] = useState<LessonNote[]>(initialNotes);
  const [draftPos, setDraftPos] = useState<number | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const startDraft = () => {
    setError(null);
    setDraftPos(Math.max(0, Math.floor(getCurrentTime())));
    setDraftBody("");
  };

  const cancelDraft = () => {
    setDraftPos(null);
    setDraftBody("");
    setError(null);
  };

  const submitDraft = () => {
    const body = draftBody.trim();
    if (!body || draftPos === null) return;
    setError(null);
    startTransition(async () => {
      const res = await addNoteAction({
        lessonId,
        positionSec: draftPos,
        body,
      });
      if (res.ok) {
        setNotes(res.data);
        cancelDraft();
      } else {
        setError(res.error === "too_long" ? "笔记太长了" : "保存失败,请重试");
      }
    });
  };

  const startEdit = (note: LessonNote) => {
    setError(null);
    setEditingId(note.id);
    setEditBody(note.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBody("");
    setError(null);
  };

  const submitEdit = (id: string) => {
    const body = editBody.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const res = await updateNoteAction({ id, body });
      if (res.ok) {
        setNotes(res.data);
        cancelEdit();
      } else {
        setError(res.error === "too_long" ? "笔记太长了" : "保存失败,请重试");
      }
    });
  };

  const remove = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await deleteNoteAction({ id });
      if (res.ok) {
        setNotes(res.data);
        if (editingId === id) cancelEdit();
      } else {
        setError("删除失败,请重试");
      }
    });
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <NotebookPen size={16} className="text-brand" />
          学习笔记
          {notes.length > 0 ? (
            <span className="text-[12px] font-normal text-ink-3">
              {notes.length} 条
            </span>
          ) : null}
        </div>
        {draftPos === null ? (
          <button
            type="button"
            onClick={startDraft}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-brand-dark"
          >
            <Plus size={14} />
            在 {formatTimestamp(getCurrentTime())} 记一笔
          </button>
        ) : null}
      </div>

      {draftPos !== null ? (
        <div className="mt-3 rounded-[14px] border border-line bg-white p-3">
          <div className="mb-2 flex items-center gap-2 text-[12px] text-ink-3">
            <span className="font-mono text-brand">{formatTimestamp(draftPos)}</span>
            <span>记一笔(支持 Markdown)</span>
          </div>
          <textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            rows={3}
            autoFocus
            placeholder="此刻的要点、疑问或手法记录…"
            className="w-full resize-y rounded-md border border-line bg-bg-soft px-3 py-2 text-[14px] leading-6 text-ink outline-none focus:border-brand"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={cancelDraft}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] text-ink-3 transition hover:text-ink disabled:opacity-60"
            >
              <X size={14} />
              取消
            </button>
            <button
              type="button"
              onClick={submitDraft}
              disabled={pending || !draftBody.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-brand-dark disabled:opacity-60"
            >
              <Check size={14} />
              {pending ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-md bg-brand-soft px-3 py-2 text-[13px] text-brand-dark">
          {error}
        </div>
      ) : null}

      {notes.length === 0 && draftPos === null ? (
        <p className="mt-3 text-[13px] text-ink-3">
          还没有笔记。播放时在任意时间点记一笔,之后可点时间戳跳回该处。
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-[14px] border border-line bg-white p-3"
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => onSeek(note.positionSec)}
                  title="跳回该时间点"
                  className="mt-0.5 shrink-0 rounded-md bg-brand-tint px-2 py-0.5 font-mono text-[12px] text-brand transition hover:bg-brand-soft"
                >
                  {formatTimestamp(note.positionSec)}
                </button>
                <div className="min-w-0 flex-1">
                  {editingId === note.id ? (
                    <div>
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={3}
                        autoFocus
                        className="w-full resize-y rounded-md border border-line bg-bg-soft px-3 py-2 text-[14px] leading-6 text-ink outline-none focus:border-brand"
                      />
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={pending}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] text-ink-3 transition hover:text-ink disabled:opacity-60"
                        >
                          <X size={13} />
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={() => submitEdit(note.id)}
                          disabled={pending || !editBody.trim()}
                          className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-[12px] font-medium text-white transition hover:bg-brand-dark disabled:opacity-60"
                        >
                          <Check size={13} />
                          保存
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-[14px] leading-6 text-ink-2">
                      {note.body}
                    </p>
                  )}
                </div>
                {editingId === note.id ? null : (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(note)}
                      title="编辑"
                      className="rounded-md p-1.5 text-ink-3 transition hover:bg-bg-soft hover:text-brand"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(note.id)}
                      disabled={pending}
                      title="删除"
                      className="rounded-md p-1.5 text-ink-3 transition hover:bg-bg-soft hover:text-brand disabled:opacity-60"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
