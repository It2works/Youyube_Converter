/** Run before `@distube/ytdl-core` so update checks skip flaky GitHub/DNS. */
process.env.YTDL_NO_UPDATE ??= "1";
