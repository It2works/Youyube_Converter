import { NextRequest, NextResponse } from "next/server";
import {
  checkBinaries,
  fetchVideoInfo,
  isYouTubeUrl,
  missingBinaryMessage,
} from "../../../lib/yt-dlp";
import { stringifyThrown } from "../../../lib/error-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url)
    return NextResponse.json(
      { error: "Missing url query parameter." },
      { status: 400 },
    );
  if (!isYouTubeUrl(url))
    return NextResponse.json(
      { error: "That does not look like a YouTube URL." },
      { status: 400 },
    );

  const bins = checkBinaries();
  const missing = missingBinaryMessage(bins);
  if (missing) {
    return NextResponse.json({ error: missing }, { status: 503 });
  }

  try {
    const info = await fetchVideoInfo(url);
    return NextResponse.json({
      title: info.title,
      videoId: info.videoId,
      duration: formatDuration(info.durationSeconds),
      channel: info.channel,
    });
  } catch (err) {
    const message = stringifyThrown(err);
    console.error("[api/info] yt-dlp failed:", message);
    return NextResponse.json(
      { error: `Could not load video: ${message.split("\n")[0]}` },
      { status: 502 },
    );
  }
}
