"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/track";

type Props = {
  name: string;
  payload?: Record<string, unknown>;
  dedupeKey: string;
};

export function TrackOnce({ name, payload, dedupeKey }: Props) {
  const fired = useRef<string>("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = `cube_track_once:${name}:${dedupeKey}`;
    try {
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, "1");
    } catch {
      if (fired.current === storageKey) return;
      fired.current = storageKey;
    }
    track(name, payload);
  }, [name, payload, dedupeKey]);
  return null;
}
