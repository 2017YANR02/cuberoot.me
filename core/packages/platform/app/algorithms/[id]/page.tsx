import Link from "next/link";
import { notFound } from "next/navigation";
import { Lightbulb, ArrowRight } from "lucide-react";
import {
  listAllAlgorithms,
  getAlgorithmById,
  relatedAlgorithms,
} from "@/lib/db/algorithms";
import type { Algorithm } from "@/lib/db/algorithms";
import { AlgBoard } from "@/lib/cube/face-svg";
import { Badge } from "@/components/Badge";
import { CopyButton } from "@/components/CopyButton";
import { ogImageUrl } from "@/lib/site";

export async function generateStaticParams() {
  const all = await listAllAlgorithms();
  return all.map((a) => ({ id: a.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = await getAlgorithmById(id);
  if (!a) return { title: "算法详情" };
  const title = `${a.name} — ${a.category}`;
  const desc =
    a.description?.trim() || `${a.category} 公式 ${a.name}:${a.notation}`;
  const img = ogImageUrl(`${a.name} · ${a.notation}`);
  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      images: [{ url: img, width: 1200, height: 630, alt: a.name }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description: desc,
      images: [img],
    },
  };
}

export default async function AlgorithmDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = await getAlgorithmById(id);
  if (!a) notFound();

  const related = await relatedAlgorithms(a, 6);

  return (
    <section className="container-page py-12">
      <Link href="/algorithms" className="text-[13px] text-ink-3 hover:text-ink">
        ← 返回算法字典
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-[260px_minmax(0,1fr)] items-start">
        <div className="rounded-[14px] border border-line bg-white p-6 grid place-items-center">
          <AlgBoard category={a.category} size={208} />
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="brand">{a.category}</Badge>
            {a.caseGroup ? (
              <span className="text-[13px] text-ink-3">{a.caseGroup}</span>
            ) : null}
            <span className="text-[13px] text-ink-3">{a.puzzle} 阶</span>
          </div>

          <h1 className="text-[26px] md:text-[32px] font-semibold text-ink leading-tight">
            {a.name}
          </h1>

          {/* 公式记法:等宽 font-alg,可一键复制 */}
          <div className="mt-6 rounded-[14px] border border-line bg-bg-soft p-5">
            <div className="mb-3 text-[12px] text-ink-3">公式记法</div>
            <p className="font-alg text-[18px] md:text-[20px] leading-relaxed tracking-wide text-ink break-words select-all">
              {a.notation}
            </p>
            <div className="mt-4">
              <CopyButton text={a.notation} label="复制记法" />
            </div>
          </div>

          {a.hint ? (
            <div className="mt-6 flex items-start gap-3 rounded-[14px] border border-line bg-white p-5">
              <Lightbulb size={18} className="mt-0.5 shrink-0 text-amber-500" />
              <div>
                <div className="text-[13px] font-medium text-ink mb-1">记忆提示</div>
                <p className="text-[14px] leading-7 text-ink-2">{a.hint}</p>
              </div>
            </div>
          ) : null}

          {a.description ? (
            <p className="mt-6 text-[15px] leading-7 text-ink-2">{a.description}</p>
          ) : null}
        </div>
      </div>

      {related.length > 0 ? (
        <div className="mt-16 border-t border-line pt-12">
          <h2 className="text-[20px] font-semibold text-ink mb-6">
            同类公式 · {a.category}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <RelatedCard key={r.id} alg={r} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RelatedCard({ alg }: { alg: Algorithm }) {
  return (
    <Link
      href={`/algorithms/${alg.id}`}
      className="group block rounded-[14px] border border-line bg-white p-5 transition hover:border-brand/40 hover:shadow-[0_8px_28px_-12px_rgba(42,93,244,0.18)]"
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <AlgBoard category={alg.category} size={64} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="mb-1.5 text-[14px] font-semibold text-ink group-hover:text-brand transition">
            {alg.name}
          </h3>
          <p className="font-alg text-[12px] leading-relaxed tracking-wide text-ink-3 break-words">
            {alg.notation}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end text-[12px] text-brand">
        <span className="inline-flex items-center gap-1 group-hover:gap-2 transition-all">
          查看 <ArrowRight size={12} />
        </span>
      </div>
    </Link>
  );
}
