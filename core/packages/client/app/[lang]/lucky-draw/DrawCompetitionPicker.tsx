"use client";

import { useEffect, useState } from "react";
import { CompPicker } from "@/components/CompPicker";
import { apiUrl } from "@/lib/api-base";
import { localizeCompName } from "@/lib/comp-localize";
import type { Comp } from "@/lib/comp-search";
import { tr } from "@/i18n/tr";
import type { Competition } from "@cuberoot/shared/draw/controller";

export default function DrawCompetitionPicker({
  value,
  onChange,
  onPick,
  isZh,
}: {
  value: string;
  onChange: (value: string) => void;
  onPick: (comp: Competition) => void;
  isZh: boolean;
}) {
  const [comps, setComps] = useState<Comp[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setStatus("loading");
    void (async () => {
      try {
        const response = await fetch(apiUrl("/v1/draw/competitions?picker=1"), {
          signal: abort.signal,
        });
        if (!response.ok) throw new Error("Competition index unavailable");
        const data = (await response.json()) as { competitions: Comp[] };
        if (
          !Array.isArray(data.competitions) ||
          data.competitions.some(
            (comp) =>
              !comp ||
              [
                comp.id,
                comp.name,
                comp.country,
                comp.start_date,
                comp.end_date,
              ].some((value) => typeof value !== "string"),
          )
        )
          throw new Error("Invalid competition index");
        if (abort.signal.aborted) return;
        setComps(data.competitions);
        setStatus("ready");
      } catch {
        if (!abort.signal.aborted) setStatus("error");
      }
    })();
    return () => abort.abort();
  }, [attempt]);

  return (
    <>
      <label className="sr-only" htmlFor="draw-competition">
        {tr({ zh: "比赛名称", en: "Competition name" })}
      </label>
      <CompPicker
        inputId="draw-competition"
        inputClassName="draw-input"
        value={value}
        onChange={onChange}
        isZh={isZh}
        restrictComps={comps}
        placeholder={tr({ zh: "搜索比赛", en: "Search competitions" })}
        onPick={(comp) =>
          onPick({
            id: comp.id,
            name: localizeCompName(comp.id, comp.name, isZh, {
              explicitNameZh: comp.name_zh,
            }),
            date: comp.start_date,
          })
        }
      />
      {status === "loading" && (
        <p role="status">{tr({ zh: "加载中…", en: "Loading…" })}</p>
      )}
      {status === "error" && (
        <p role="status">
          {tr({ zh: "比赛加载失败", en: "Unable to load competitions" })}{" "}
          <button className="draw-button" onClick={() => setAttempt((n) => n + 1)}>
            {tr({ zh: "重试", en: "Retry" })}
          </button>
        </p>
      )}
      {status === "ready" && !comps.length && (
        <p>
          {tr({
            zh: "暂无可导入的比赛",
            en: "No competitions available to import",
          })}
        </p>
      )}
    </>
  );
}
