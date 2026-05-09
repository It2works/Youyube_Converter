import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import type { Readable } from "node:stream";

type AudioPipeline = {
  ytDlp: ChildProcess & { stdout: Readable; stderr: Readable };
  ffmpeg: ChildProcess & { stdout: Readable; stderr: Readable };
};

const YOUTUBE_URL_RE =
  /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i;

export function isYouTubeUrl(input: string): boolean {
  return YOUTUBE_URL_RE.test(input.trim());
}

let _binaryCheck: { ytDlp: boolean; ffmpeg: boolean } | null = null;

export function checkBinaries(): { ytDlp: boolean; ffmpeg: boolean } {
  if (_binaryCheck) return _binaryCheck;
  const ytDlp = spawnSync("yt-dlp", ["--version"], { stdio: "ignore" }).status === 0;
  const ffmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
  _binaryCheck = { ytDlp, ffmpeg };
  return _binaryCheck;
}

export function missingBinaryMessage({
  ytDlp,
  ffmpeg,
}: {
  ytDlp: boolean;
  ffmpeg: boolean;
}): string | null {
  const missing: string[] = [];
  if (!ytDlp) missing.push("yt-dlp");
  if (!ffmpeg) missing.push("ffmpeg");
  if (missing.length === 0) return null;
  return `Missing ${missing.join(" and ")} on the server. Install: sudo apt install ffmpeg && sudo pip install -U yt-dlp`;
}

export interface VideoInfo {
  title: string;
  videoId: string;
  durationSeconds: number;
  channel: string | null;
}

export async function fetchVideoInfo(url: string): Promise<VideoInfo> {
  const result = await runJson(["-J", "--no-warnings", "--no-playlist", url]);
  const info = result as Partial<{
    id: string;
    title: string;
    duration: number;
    uploader: string;
    channel: string;
  }>;
  return {
    title: info.title ?? "Untitled",
    videoId: info.id ?? "",
    durationSeconds: typeof info.duration === "number" ? info.duration : 0,
    channel: info.channel ?? info.uploader ?? null,
  };
}

function runJson(args: string[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const proc = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    proc.stdout.on("data", (c: Buffer) => out.push(c));
    proc.stderr.on("data", (c: Buffer) => err.push(c));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(err).toString("utf8").trim();
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(out).toString("utf8")));
      } catch (e) {
        reject(new Error(`Could not parse yt-dlp JSON: ${(e as Error).message}`));
      }
    });
  });
}

/**
 * Spawn `yt-dlp` to write the best audio stream to stdout, then pipe through
 * `ffmpeg` to produce an MP3 byte stream on its stdout.
 *
 * Returns both processes so the caller can hook stderr / kill them.
 */
export function spawnAudioToMp3(url: string, bitrateKbps = 192): AudioPipeline {
  const ytDlp = spawn(
    "yt-dlp",
    [
      "-f",
      "bestaudio/best",
      "-o",
      "-",
      "--no-warnings",
      "--no-playlist",
      "--no-progress",
      "--quiet",
      url,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  const ffmpeg = spawn(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      "pipe:0",
      "-vn",
      "-ab",
      `${bitrateKbps}k`,
      "-f",
      "mp3",
      "pipe:1",
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );

  if (ytDlp.stdout && ffmpeg.stdin) {
    ytDlp.stdout.pipe(ffmpeg.stdin);
    ytDlp.stdout.on("error", () => {});
    ffmpeg.stdin.on("error", () => {});
  }

  return { ytDlp, ffmpeg } as AudioPipeline;
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 100) || "audio";
}
