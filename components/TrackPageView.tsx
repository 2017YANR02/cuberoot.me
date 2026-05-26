"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { track } from "@/lib/track";

export function TrackPageView() {
  const pathname = usePathname();
  const search = useSearchParams();
  const lastRef = useRef<string>("");

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/admin")) return;
    const q = search?.toString();
    const path = q ? `${pathname}?${q}` : pathname;
    if (lastRef.current === path) return;
    lastRef.current = path;
    track("page_view", { path: pathname }, { url: path });
  }, [pathname, search]);

  return null;
}
