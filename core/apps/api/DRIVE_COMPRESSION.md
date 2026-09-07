# Drive cloud compression

The API queues PostgreSQL jobs; `dist/drive-video.mjs` processes one job at a time in a separate systemd service. The original is never overwritten. Both modes use SVT-AV1 preset 6, CRF 18, copied audio, passthrough frame timing and MP4 faststart. This uses public AV1 technology, not YouTube's private encoding pipeline.

- `original` retains dimensions; `1080p` fits 1920×1080 or 1080×1920 without upscaling, with even pixel dimensions.
- Current inputs: MP4/MOV or Matroska/WebM, one progressive SDR 4:2:0 video stream, square pixels, up to 4096×2160 pixels total, optional audio copied verbatim. HDR, rotation, non-video/audio streams and odd dimensions fail safely.
- Acceptance: smaller bytes, unchanged source SHA-256, all decoded frame timestamps/counts equal, audio packet hashes/timestamps equal, video properties preserved. VMAF checks every fifth frame across the complete video: mean ≥97, first percentile ≥93, minimum ≥80. Outputs larger than 1920 on their long edge use the 4K model. For 1080p, the reference is resized identically; the score measures encoding loss, not the detail intentionally removed by resizing. Scores are a guard, not a guarantee of perceptual identity.
- Jobs reserve the original size against the existing shared Drive quota. Only the owner or a super administrator may queue compression. Output inherits the source owner and current folder.
- The same owner/superadministrator can cancel queued, encoding or validating jobs with `POST /v1/drive/compressions/:id/cancel`. Cancellation releases reserved quota and records `failed` with `compression-cancelled`; the worker checks every two seconds, stops its native process and removes temporary output. Publication and cancellation lock the job row, so a completed copy is retained if publication wins. Cancellation never changes the original or automatically retries the job.
- The worker can use four CPU cores, with low scheduling priority, 4 GB memory and a four-hour limit per native command. Decode, filters and VMAF use four threads; SVT 4.x retains parallelism level 2 to bound buffering (this is not a two-core limit). Interrupted jobs become failed and can be retried explicitly. Account/file deletion before publication prevents publication. No extra queue service is needed.

## Runtime artifact and deployment

FFmpeg build archive (includes libsvtav1 and libvmaf):

`https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-09-06-13-06/ffmpeg-n8.1.2-50-g1a748fe2cd-linux64-gpl-8.1.tar.xz`

SHA-256: `9b920f7f702cdc918654d37e517db82ae64a87619af1de15312d4ab9bf482383`.

Verify the archive before extraction into `/root/core-api/artifacts/ffmpeg/<sha256>/`, retain its license files, and set these non-secret runtime values:

```dotenv
DRIVE_COMPRESSION_ENABLED=1
DRIVE_FFMPEG_BIN_DIR=/root/core-api/artifacts/ffmpeg/9b920f7f702cdc918654d37e517db82ae64a87619af1de15312d4ab9bf482383/bin
```

The normal Deploy Core workflow bundles the worker, verifies native capabilities, applies migration 0218, installs the unit and checks it is active. It resolves the deployed Node path because systemd does not load nvm. API rollback also restores the previous worker bundle. The unit permits only loopback networking and storage writes under the Drive storage root. Changing `DRIVE_STORAGE_DIR` requires updating its `ReadWritePaths`.

Inspect `journalctl -u cuberoot-drive-compression.service` and `drive_compressions.status/error/report`. Setting the flag to `0`, stopping the unit and reloading the API disables new work without removing files. Source credits are maintained at `/about`.
