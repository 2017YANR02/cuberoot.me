import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ShieldAlert, GraduationCap } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { getByCode } from "@/lib/db/certificates";
import { absoluteUrl, getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

function fmtDate(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const cert = await getByCode(code);
  if (!cert) {
    return {
      title: "证书验证 — 魔方开放社群",
      robots: { index: false, follow: false },
    };
  }
  const title = `${cert.userName} 的结课证书 · ${cert.courseTitle}`;
  const ogImage = `${getSiteUrl()}/cert/${cert.code}/image`;
  const url = absoluteUrl(`/cert/${cert.code}`);
  return {
    title: `${title} — 魔方开放社群`,
    description: `${cert.userName} 已完成《${cert.courseTitle}》课程,验证码 ${cert.code}。`,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: `${cert.userName} 已完成《${cert.courseTitle}》课程。`,
      url,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      images: [ogImage],
    },
  };
}

export default async function CertPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cert = await getByCode(code);

  if (!cert) {
    return (
      <section className="container-page py-16 max-w-xl">
        <div className="rounded-[14px] border border-line bg-white p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-bg-soft">
            <ShieldAlert size={26} className="text-ink-3" />
          </div>
          <h1 className="mt-5 text-[20px] font-semibold text-ink">
            未找到该证书
          </h1>
          <p className="mt-2 text-[14px] text-ink-3 leading-relaxed">
            验证码 <span className="font-alg text-ink-2">{code}</span> 不存在或已失效。
            请核对链接是否完整。
          </p>
          <Link
            href="/courses"
            className="mt-6 inline-flex items-center justify-center rounded-md border border-line px-4 py-2 text-[13px] font-medium text-ink-2 hover:border-brand hover:text-brand transition"
          >
            去看看课程
          </Link>
        </div>
      </section>
    );
  }

  const shareUrl = absoluteUrl(`/cert/${cert.code}`);

  return (
    <section className="container-page py-12 max-w-2xl">
      <div className="flex items-center gap-2 text-[13px] font-medium text-brand">
        <BadgeCheck size={16} />
        证书已认证
      </div>
      <h1 className="mt-3 text-[24px] font-semibold text-ink">结课证书</h1>
      <p className="mt-1 text-[14px] text-ink-3">
        本页可公开验证证书真伪,验证码即唯一编号。
      </p>

      {/* 证书图预览 */}
      <div className="mt-6 overflow-hidden rounded-[14px] border border-line bg-white">
        <img
          src={`/cert/${cert.code}/image`}
          alt={`${cert.userName} 的结课证书`}
          width={1200}
          height={630}
          className="block w-full h-auto"
        />
      </div>

      {/* 信息明细 */}
      <dl className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-line bg-line sm:grid-cols-2">
        <Field label="学员姓名" value={cert.userName} />
        <Field label="完成课程" value={cert.courseTitle} />
        <Field label="颁发日期" value={fmtDate(cert.issuedAt)} mono />
        <Field label="验证码" value={cert.code} mono />
      </dl>

      {/* 分享 */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <CopyButton text={shareUrl} label="复制验证链接" />
        <Link
          href={`/cert/${cert.code}/image`}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-[13px] text-ink-2 hover:border-brand hover:text-brand transition"
        >
          <GraduationCap size={14} />
          查看证书图
        </Link>
      </div>

      <p className="mt-6 text-[12px] text-ink-3 leading-relaxed">
        证书由魔方开放社群依据学员完成课程的学习记录颁发。如对真实性有疑问,可凭验证码访问本页核对。
      </p>
    </section>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd
        className={
          "mt-1 text-[15px] text-ink " + (mono ? "font-alg" : "font-medium")
        }
      >
        {value}
      </dd>
    </div>
  );
}
