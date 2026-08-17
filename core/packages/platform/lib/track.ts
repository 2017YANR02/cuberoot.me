"use client";

export type TrackPayload = Record<string, unknown>;

export function track(name: string, payload?: TrackPayload, opts?: { url?: string }): void {
  if (typeof window === "undefined") return;
  const url = opts?.url ?? window.location.pathname + window.location.search;
  try {
    fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, payload: payload ?? null, url }),
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {});
  } catch {
    // swallow
  }
}
