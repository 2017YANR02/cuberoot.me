import { Play } from "lucide-react";

function isVideoFile(url: string): boolean {
  return /\.(mp4|webm|ogv|mov)(\?|#|$)/i.test(url);
}

function isLikelyIframe(url: string): boolean {
  return /\b(bilibili\.com|youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)\b/i.test(
    url,
  );
}

export function CourseVideo({
  videoUrl,
  coverUrl,
  title,
}: {
  videoUrl: string;
  coverUrl: string | null;
  title: string;
}) {
  const asFile = isVideoFile(videoUrl);
  const asIframe = !asFile && isLikelyIframe(videoUrl);

  return (
    <div className="mb-10 overflow-hidden rounded-[14px] border border-line bg-black">
      <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
        {asFile ? (
          <video
            src={videoUrl}
            controls
            preload="metadata"
            poster={coverUrl ?? undefined}
            className="absolute inset-0 h-full w-full bg-black"
          >
            <track kind="captions" />
          </video>
        ) : asIframe ? (
          <iframe
            src={videoUrl}
            title={`${title} 视频`}
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            allow="fullscreen"
            allowFullScreen
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <a
            href={videoUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="absolute inset-0 flex items-center justify-center gap-2 bg-bg-soft text-[14px] text-ink-2 hover:text-brand transition"
          >
            <Play size={16} />
            打开外链播放(演示用)
          </a>
        )}
      </div>
    </div>
  );
}
