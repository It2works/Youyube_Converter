/** Normalize thrown values from ytdl / network into a non-empty string. */
export function stringifyThrown(err: unknown): string {
  if (err instanceof Error) {
    const m = err.message?.trim();
    if (m) return m;
    if (err.name && err.name !== "Error") return err.name;
  }
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err && typeof err === "object" && "message" in err) {
    const m = String((err as { message?: unknown }).message ?? "").trim();
    if (m) return m;
  }
  try {
    const s = JSON.stringify(err);
    if (s && s !== "{}") return s;
  } catch {
    /* ignore */
  }
  return "Unknown error (no details from YouTube). Check the terminal running `next dev`.";
}
