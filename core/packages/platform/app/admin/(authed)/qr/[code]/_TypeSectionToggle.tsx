"use client";

import { useEffect } from "react";

// 跟随「类型」下拉实时显隐:聚合码(landing)藏跳转码块,跳转码(redirect)藏聚合码块。
// 监听同表单 select[name=type],不必先保存。隐藏块的 input 仍在表单里,值照常提交、不丢数据。
export function TypeSectionToggle() {
  useEffect(() => {
    const sel = document.querySelector<HTMLSelectElement>('select[name="type"]');
    if (!sel) return;
    const redirect = document.getElementById("qr-sec-redirect");
    const landing = document.getElementById("qr-sec-landing");
    const apply = () => {
      const isLanding = sel.value === "landing";
      if (redirect) redirect.style.display = isLanding ? "none" : "";
      if (landing) landing.style.display = isLanding ? "" : "none";
    };
    apply();
    sel.addEventListener("change", apply);
    return () => sel.removeEventListener("change", apply);
  }, []);
  return null;
}
