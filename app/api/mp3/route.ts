import { NextRequest } from "next/server";
import {
  checkBinaries,
  isYouTubeUrl,
  missingBinaryMessage,
  sanitizeFilename,
  spawnAudioToMp3,
} from "../../../lib/yt-dlp";

export const runtime = "nodejs";
export const maxDuration = 300;

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const titleParam = req.nextUrl.searchParams.get("title") ?? "audio";
  const bitrateParam = Number(req.nextUrl.searchParams.get("bitrate") ?? 192);
  const bitrate = [128, 160, 192, 256, 320].includes(bitrateParam)
    ? bitrateParam
    : 192;

  if (!url) return jsonError("Missing url query parameter.", 400);
  if (!isYouTubeUrl(url))
    return jsonError("That does not look like a YouTube URL.", 400);

  const bins = checkBinaries();
  const missing = missingBinaryMessage(bins);
  if (missing) return jsonError(missing, 503);

  const filename = `${sanitizeFilename(titleParam)}.mp3`;
  const { ytDlp, ffmpeg } = spawnAudioToMp3(url, bitrate);

  let ytDlpErr = "";
  let ffmpegErr = "";
  ytDlp.stderr.on("data", (c: Buffer) => {
    ytDlpErr += c.toString("utf8");
  });
  ffmpeg.stderr.on("data", (c: Buffer) => {
    ffmpegErr += c.toString("utf8");
  });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      ffmpeg.stdout.on("data", (chunk: Buffer) => {
        if (!closed) controller.enqueue(new Uint8Array(chunk));
      });
      ffmpeg.stdout.on("end", close);
      ffmpeg.stdout.on("error", (e) => {
        if (!closed) {
          closed = true;
          controller.error(e);
        }
      });
      ffmpeg.on("close", (code) => {
        if (code !== 0 && !closed) {
          closed = true;
          const msg =
            ffmpegErr.trim() ||
            ytDlpErr.trim() ||
            `ffmpeg exited with code ${code}`;
          console.error("[api/mp3] pipeline failed:", msg);
          controller.error(new Error(msg.split("\n")[0]));
        } else {
          close();
        }
      });
      ytDlp.on("error", (e) => {
        console.error("[api/mp3] yt-dlp spawn error:", e);
      });
    },
    cancel() {
      try {
        ytDlp.kill("SIGKILL");
      } catch {
        /* noop */
      }
      try {
        ffmpeg.kill("SIGKILL");
      } catch {
        /* noop */
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(
        filename,
      )}`,
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
