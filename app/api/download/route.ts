import "../../../lib/ytdl-env";
import { NextRequest, NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";

export const runtime = "nodejs";

/** Hobby tier stays under typical getInfo time; increase on Pro if needed */
export const maxDuration = 60;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return badRequest("Missing url query parameter.");
  if (!ytdl.validateURL(url)) return badRequest("That does not look like a valid YouTube URL.");

  try {
    const info = await ytdl.getInfo(url, {
      playerClients: ["WEB", "ANDROID", "IOS"],
      requestOptions: {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; YT-Audio/1.0)" },
      },
    });

    const format = ytdl.chooseFormat(info.formats, {
      quality: "highestaudio",
      filter: "audioonly",
    });

    if (!format?.url) {
      return NextResponse.json(
        { error: "No audio-only format was returned for this video." },
        { status: 404 },
      );
    }

    return NextResponse.redirect(format.url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `YouTube request failed: ${message}` },
      { status: 502 },
    );
  }
}
