"""Local video review editor and FFmpeg subtitle renderer."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent
PORT = 48720
ORIGIN = f"http://127.0.0.1:{PORT}"
FFMPEG = "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"
STATIC = {
    "/": (ROOT / "cube-review-subtitle.html", "text/html; charset=utf-8"),
    "/review.js": (ROOT / "review.js", "text/javascript; charset=utf-8"),
    "/vendor/json5.js": (ROOT.parent / "node_modules/json5/dist/index.min.js", "text/javascript"),
    "/vendor/csv.js": (ROOT.parent / "node_modules/csv-parse/dist/umd/sync.js", "text/javascript"),
}


class Editor(BaseHTTPRequestHandler):
    def send_file(self, path, content_type):
        with path.open("rb") as stream:
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(path.stat().st_size))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            shutil.copyfileobj(stream, self.wfile)

    def do_GET(self):
        if self.path not in STATIC:
            return self.send_error(404)
        self.send_file(*STATIC[self.path])

    def do_POST(self):
        if self.path != "/render":
            return self.send_error(404)
        if self.headers.get("Host") != ORIGIN.split("//")[1] or self.headers.get("Origin") != ORIGIN:
            return self.send_error(403)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            ass_bytes = int(self.headers.get("X-ASS-Bytes", "0"))
            if not 0 < ass_bytes < length or ass_bytes > 4 * 1024 * 1024:
                raise ValueError
        except ValueError:
            return self.send_error(400, "Invalid subtitle or video size")

        with TemporaryDirectory(prefix="cube-review-") as directory:
            folder = Path(directory)
            (folder / "review.ass").write_bytes(self.rfile.read(ass_bytes))
            remaining = length - ass_bytes
            with (folder / "media").open("wb") as stream:
                while remaining:
                    chunk = self.rfile.read(min(remaining, 1024 * 1024))
                    if not chunk:
                        return self.send_error(400, "Incomplete video")
                    stream.write(chunk)
                    remaining -= len(chunk)
            result = subprocess.run([
                FFMPEG, "-nostdin", "-v", "error", "-protocol_whitelist", "file",
                "-format_whitelist", "mov,matroska,webm,avi,mpeg,mpegts,flv,asf,ogg",
                "-i", "media", "-map", "0:V:0", "-map", "0:a:0?",
                "-vf", "ass=review.ass,pad=ceil(iw/2)*2:ceil(ih/2)*2",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
                "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "out.mp4",
            ], cwd=folder, stderr=subprocess.PIPE)
            if result.returncode:
                self.log_error("FFmpeg: %s", result.stderr.decode(errors="replace")[-1500:])
                msg = "FFmpeg 无法处理这个视频，请检查文件格式和可用空间。".encode()
                self.send_response(422)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.end_headers()
                self.wfile.write(msg)
                return
            self.send_file(folder / "out.mp4", "video/mp4")


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Editor)
    print(f"魔方复盘字幕　{ORIGIN}/", flush=True)
    server.serve_forever()
