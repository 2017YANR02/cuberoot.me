"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { updateProgress } from "@/app/actions/progress";
import { LessonNotes } from "@/components/LessonNotes";
import type { LessonNote } from "@/lib/db/notes";

type Props = {
  lessonId: string;
  src: string;
  poster?: string | null;
  initialPositionSec?: number;
  initialCompleted?: boolean;
  initialNotes?: LessonNote[];
};

const THROTTLE_MS = 10_000;

export function LessonPlayer({
  lessonId,
  src,
  poster,
  initialPositionSec = 0,
  initialCompleted = false,
  initialNotes = [],
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSentRef = useRef(0);
  const [completed, setCompleted] = useState(initialCompleted);
  const [resumed, setResumed] = useState(false);

  // Resume position once the metadata loads so duration is known.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || resumed || initialPositionSec <= 0) return;
    const onMeta = () => {
      if (!Number.isNaN(el.duration) && el.duration > initialPositionSec + 2) {
        el.currentTime = initialPositionSec;
      }
      setResumed(true);
    };
    el.addEventListener("loadedmetadata", onMeta, { once: true });
    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
    };
  }, [initialPositionSec, resumed]);

  const send = async (positionSec: number, doneFlag: boolean) => {
    try {
      await updateProgress(lessonId, positionSec, doneFlag);
    } catch {
      // Network blips are non-fatal; next tick will retry.
    }
  };

  const onTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    const now = Date.now();
    if (now - lastSentRef.current < THROTTLE_MS) return;
    lastSentRef.current = now;
    void send(el.currentTime, completed);
  };

  const onEnded = () => {
    const el = videoRef.current;
    if (!el) return;
    setCompleted(true);
    lastSentRef.current = Date.now();
    void send(el.currentTime || el.duration || 0, true);
  };

  const onPause = () => {
    const el = videoRef.current;
    if (!el) return;
    // Flush latest position on pause so the user doesn't lose seconds.
    lastSentRef.current = Date.now();
    void send(el.currentTime, completed);
  };

  // 给笔记面板暴露当前播放位置 / 跳转能力(共享同一个 video ref,不另起播放器)。
  const getCurrentTime = useCallback(() => {
    const el = videoRef.current;
    return el && Number.isFinite(el.currentTime) ? el.currentTime : 0;
  }, []);

  const seek = useCallback((sec: number) => {
    const el = videoRef.current;
    if (!el) return;
    const target = Math.max(0, sec);
    el.currentTime =
      !Number.isNaN(el.duration) && el.duration > 0
        ? Math.min(target, el.duration)
        : target;
    void el.play().catch(() => {
      // Autoplay may be blocked; user can resume manually. Position is set regardless.
    });
  }, []);

  return (
    <div>
      <div className="overflow-hidden rounded-[14px] border border-line bg-black">
        <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
          <video
            ref={videoRef}
            src={src}
            controls
            playsInline
            preload="metadata"
            poster={poster ?? undefined}
            onTimeUpdate={onTimeUpdate}
            onEnded={onEnded}
            onPause={onPause}
            className="absolute inset-0 h-full w-full bg-black"
          >
            <track kind="captions" />
          </video>
        </div>
      </div>

      <LessonNotes
        lessonId={lessonId}
        initialNotes={initialNotes}
        getCurrentTime={getCurrentTime}
        onSeek={seek}
      />
    </div>
  );
}
