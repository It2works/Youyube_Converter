import "../../../lib/ytdl-env";
import { NextRequest, NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";

export const runtime = "nodejs";
export const maxDuration = 60;

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url query parameter." }, { status: 400 });
  }
  if (!ytdl.validateURL(url)) {
    return NextResponse.json({ error: "Invalid YouTube URL." }, { status: 400 });
  }

  try {
    const info = await ytdl.getInfo(url, {
      playerClients: ["WEB", "ANDROID", "IOS"],
      requestOptions: {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; YT-Audio/1.0)" },
      },
    });
    const videoDetails = info.videoDetails;
    return NextResponse.json({
      title: videoDetails.title,
      videoId: videoDetails.videoId,
      duration: formatDuration(Number(videoDetails.lengthSeconds) || 0),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Could not load video: ${message}` },
      { status: 502 },
    );
  }
}
