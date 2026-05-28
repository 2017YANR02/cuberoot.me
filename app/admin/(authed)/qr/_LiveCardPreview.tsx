"use client";

import { useEffect, useState } from "react";
import type { QrCode, QrType } from "@/lib/db/qr";
import { QrCardUnit } from "@/components/QrCard";
import { linksToText, parseLinks } from "@/lib/qr/links";

// 卡片预览(实时):监听同页表单里所有影响卡片的字段,改动即时反映到预览,不必先保存。
// 卡片正面用 frontArt + quote;背面文案由 type / target / title / intro / links 派生。
// 复用 QrCardUnit,只是以当前表单值覆盖 entry。
type Live = {
  type: QrType;
  target: string;
  title: string;
  term: string;
  intro: string;
  linksRaw: string;
  quote: string;
  art: string;
};

export function LiveCardPreview({ entry, svg }: { entry: QrCode; svg: string }) {
  const [s, setS] = useState<Live>({
    type: entry.type,
    target: entry.target,
    title: entry.title ?? "",
    term: entry.term ?? "",
    intro: entry.intro ?? "",
    linksRaw: linksToText(entry.links),
    quote: entry.quote ?? "",
    art: entry.frontArt ?? "",
  });

  useEffect(() => {
    const apply = (name: string, value: string) =>
      setS((p) => {
        switch (name) {
          case "type":
            return { ...p, type: value === "landing" ? "landing" : "redirect" };
          case "target":
            return { ...p, target: value };
          case "title":
            return { ...p, title: value };
          case "term":
            return { ...p, term: value };
          case "intro":
            return { ...p, intro: value };
          case "links":
            return { ...p, linksRaw: value };
          case "quote":
            return { ...p, quote: value };
          case "frontArt":
            return { ...p, art: value };
          default:
            return p;
        }
      });

    const sync = (e: Event) => {
      const t = e.target as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) | null;
      if (t?.name) apply(t.name, t.value);
    };
    document.addEventListener("change", sync);
    document.addEventListener("input", sync);

    // 挂载时按当前 DOM 值初始化(含已选中的图片单选)
    const form = document.querySelector<HTMLFormElement>("form");
    if (form) {
      form
        .querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
          "[name]",
        )
        .forEach((el) => {
          if (el instanceof HTMLInputElement && el.type === "radio" && !el.checked)
            return;
          apply(el.name, el.value);
        });
    }

    return () => {
      document.removeEventListener("change", sync);
      document.removeEventListener("input", sync);
    };
  }, []);

  const merged: QrCode = {
    ...entry,
    type: s.type,
    target: s.target.trim() || "/",
    title: s.title.trim() || null,
    term: s.term.trim() || null,
    intro: s.intro.trim() || null,
    links: parseLinks(s.linksRaw),
    quote: s.quote.trim() || null,
    frontArt: s.art.trim() || null,
  };

  return <QrCardUnit entry={merged} svg={svg} />;
}
