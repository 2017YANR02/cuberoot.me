"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, Loader2, Check, X } from "lucide-react";

type Status = "idle" | "uploading" | "done" | "error";

export function FileUpload({
  accept,
  label,
  onUploaded,
  hint,
}: {
  accept?: string;
  label?: string;
  onUploaded: (url: string) => void;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const upload = useCallback(
    (file: File) => {
      setFileName(file.name);
      setError(null);
      setStatus("uploading");
      setProgress(0);
      const fd = new FormData();
      fd.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        try {
          const r = JSON.parse(xhr.responseText) as
            | { ok: true; url: string }
            | { ok: false; error: string };
          if (xhr.status >= 200 && xhr.status < 300 && r.ok) {
            setStatus("done");
            setProgress(100);
            onUploaded(r.url);
          } else {
            setStatus("error");
            setError(("error" in r && r.error) || `HTTP ${xhr.status}`);
          }
        } catch {
          setStatus("error");
          setError(`HTTP ${xhr.status}`);
        }
      };
      xhr.onerror = () => {
        setStatus("error");
        setError("network error");
      };
      xhr.send(fd);
    },
    [onUploaded],
  );

  const onChoose = (f: File | null) => {
    if (f) upload(f);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) upload(f);
      }}
      className={
        "mt-1 rounded-[14px] border border-dashed px-4 py-3 text-[13px] " +
        "transition cursor-pointer " +
        (dragging
          ? "border-brand bg-brand-soft text-brand"
          : "border-line bg-bg-soft text-ink-2 hover:border-brand/40")
      }
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChoose(e.target.files?.[0] ?? null)}
      />
      <div className="flex items-center gap-2">
        {status === "uploading" ? (
          <Loader2 className="size-4 animate-spin text-brand" />
        ) : status === "done" ? (
          <Check className="size-4 text-brand" />
        ) : status === "error" ? (
          <X className="size-4 text-ink" />
        ) : (
          <Upload className="size-4 text-ink-3" />
        )}
        <span className="flex-1 truncate">
          {status === "idle" && (label ?? "点击或拖拽上传文件")}
          {status === "uploading" && `上传中 ${progress}% · ${fileName ?? ""}`}
          {status === "done" && `上传完成 · ${fileName ?? ""}`}
          {status === "error" && `失败:${error ?? ""}`}
        </span>
      </div>
      {status === "uploading" ? (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full bg-brand transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
      {hint ? <div className="mt-1 text-[12px] text-ink-3">{hint}</div> : null}
    </div>
  );
}
