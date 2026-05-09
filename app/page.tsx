"use client";

import { useCallback, useState } from "react";

type InfoState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ok";
      title: string;
      duration: string;
      videoId: string;
      resolvedUrl: string;
    }
  | { status: "error"; message: string };

function parseYouTubeInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (/^[\w-]{11}$/.test(trimmed)) {
    return `https://www.youtube.com/watch?v=${trimmed}`;
  }
  return `https://www.youtube.com/watch?v=${encodeURIComponent(trimmed)}`;
}

export default function Home() {
  const [input, setInput] = useState("");
  const [info, setInfo] = useState<InfoState>({ status: "idle" });

  const fetchInfo = useCallback(async () => {
    const url = parseYouTubeInput(input);
    if (!url) {
      setInfo({ status: "error", message: "Paste a YouTube link or video ID." });
      return;
    }
    setInfo({ status: "loading" });
    try {
      const res = await fetch(
        `/api/info?url=${encodeURIComponent(url)}`,
        { method: "GET" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInfo({
          status: "error",
          message:
            typeof data.error === "string"
              ? data.error
              : "Could not read that video. It may be private, age-restricted, or region-blocked.",
        });
        return;
      }
      setInfo({
        status: "ok",
        title: data.title ?? "Unknown title",
        duration: data.duration ?? "",
        videoId: data.videoId ?? "",
        resolvedUrl: url,
      });
    } catch {
      setInfo({
        status: "error",
        message: "Network error. Check your connection and try again.",
      });
    }
  }, [input]);

  const downloadHref =
    info.status === "ok"
      ? `/api/download?url=${encodeURIComponent(info.resolvedUrl)}`
      : null;

  return (
    <main className="bg-grid relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-red-950/20 via-transparent to-transparent" />
      <div className="relative mx-auto flex max-w-xl flex-col gap-8 px-4 py-16 sm:py-24">
        <header className="space-y-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            YouTube Converter
          </h1>
          <p className="text-sm leading-relaxed text-zinc-400">
            Put your video link below, then download. You get{" "}
            <span className="text-zinc-200">only the audio</span> (no video
            file). It saves like a normal download on your phone or PC.
          </p>
          <p className="text-xs leading-relaxed text-zinc-500">
            Honest detail: the file is usually{" "}
            <code className="rounded bg-zinc-800 px-1 py-0.5">.m4a</code> or{" "}
            <code className="rounded bg-zinc-800 px-1 py-0.5">.webm</code>, not
            always <code className="rounded bg-zinc-800 px-1 py-0.5">.mp3</code>
            . For listening in music apps it works the same; if you truly need
            MP3, convert once on your device (e.g. VLC).
          </p>
        </header>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl shadow-black/40 backdrop-blur">
          <label htmlFor="url" className="sr-only">
            YouTube URL
          </label>
          <textarea
            id="url"
            rows={3}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (info.status !== "idle") setInfo({ status: "idle" });
            }}
            placeholder="https://www.youtube.com/watch?v=…"
            className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-red-500/60 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={fetchInfo}
              disabled={info.status === "loading"}
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {info.status === "loading" ? "Checking…" : "Look up video"}
            </button>
            {downloadHref && (
              <a
                href={downloadHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-600 bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700"
              >
                Save on my device
              </a>
            )}
          </div>

          {info.status === "error" && (
            <p
              className="mt-4 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200"
              role="alert"
            >
              {info.message}
            </p>
          )}

          {info.status === "ok" && (
            <div className="mt-4 space-y-1 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Ready
              </p>
              <p className="text-sm font-medium text-zinc-100">{info.title}</p>
              {info.duration && (
                <p className="text-xs text-zinc-500">Duration: {info.duration}</p>
              )}
              {info.videoId && (
                <p className="font-mono text-xs text-zinc-600">ID: {info.videoId}</p>
              )}
            </div>
          )}
        </div>

        <footer className="space-y-3 text-center text-xs text-zinc-600">
          <p className="text-zinc-400">
            Made by{" "}
            <a
              href="https://github.com/It2works"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-300 underline decoration-zinc-600 underline-offset-2 transition hover:text-red-400 hover:decoration-red-400/60"
            >
              Ayari Mohamed Ghassen
            </a>
          </p>
          <p>
            For personal, rights-respecting use only. Downloading may not be
            allowed by YouTube&apos;s terms for some content — you are
            responsible for how you use this tool.
          </p>
        </footer>
      </div>
    </main>
  );
}
