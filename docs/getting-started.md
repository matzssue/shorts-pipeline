# Getting started

From a fresh clone to your first video, your first post and the dashboard on your own data.
Every step after setup is optional: you can stop after the render and publish by hand.

## 1. Install

You need Node.js 24 (`.nvmrc`), pnpm 9 and ffmpeg on `PATH`.

```sh
git clone <this repo> && cd shorts-pipeline
pnpm install
pnpm typecheck && pnpm test     # everything should be green before you start
```

## 2. Create your content directory

Keep your content outside this repo, for example next to it:

```
my-content/
  shorts.config.json
  .env
  topics/
  products/
  out/        # written by the pipeline
  data/       # publications.csv by hand, the rest written by the pipeline
```

1. Copy `pipeline/examples/shorts.config.example.json` to `my-content/shorts.config.json` and set your channels, narrators, series, language and disclosure sentence (keys: README, "Content directory").
2. Copy `pipeline/.env.example` to `my-content/.env`. Fill in only what you will use (step 3).
3. Point the pipeline at it. Every command reads `CONTENT_DIR`:

   ```sh
   # bash
   export CONTENT_DIR=/path/to/my-content
   # PowerShell
   $env:CONTENT_DIR = "D:\path\to\my-content"
   ```

Never commit `my-content/` to this repo: it holds keys, real links and stats.

## 3. Accounts and keys

| For | You need | Goes into `.env` |
| --- | --- | --- |
| Narration | ElevenLabs API key and a voice ID per narrator | `ELEVENLABS_API_KEY`, the names you gave in `voiceIdEnv` |
| YouTube upload and stats | Google Cloud project with YouTube Data API v3 and YouTube Analytics API, OAuth client of type "Desktop app" | `YT_CLIENT_ID`, `YT_CLIENT_SECRET`; then `pnpm yt-auth --channel <id>` fills in `YT_REFRESH_TOKEN_<ID>` and `YT_CHANNEL_ID_<ID>` |
| Instagram upload and stats | Instagram professional account linked to a Facebook page, a system-user token with `instagram_content_publish` (and `instagram_manage_insights` for stats) | `IG_ACCESS_TOKEN_<ID>`, `IG_USER_ID_<ID>` |

`<ID>` is the channel id from the config in upper case. Check the tokens without uploading anything:

```sh
cd pipeline
pnpm yt-publish --channel a --check
pnpm ig-publish --channel a --check
```

## 4. Make a video

All commands run from `pipeline/` and print their help with `--help`.

1. **Card.** Write `topics/<id>.json` (template: `pipeline/examples/topic.example.json`). Every fact needs a source URL and a date.
   Check it with `pnpm validate`.
2. **Script.** `pnpm make --topic <id> --format F5` creates the video folder and stops: write `out/<date>-<id>-F5/script.json` yourself or with an LLM (template: `examples/script.example.json`). Every claim must point to a fact in the card.
   Run the same command again: it checks scene lengths, banned phrases and claims.
3. **Clips.** Generate one clip or image per scene with any generator and save them as `out/<video>/scenes/01.mp4`, `02.mp4`, …
4. **Narration.** `pnpm make --topic <id> --format F5 --narrator <narrator>`. This step is paid (ElevenLabs). The same text is never recorded twice.
   To fix one scene, use `pnpm voice-fix`.
5. **Render.** `pnpm compose --topic <id> --format F5 --narrator <narrator>` writes `final-<narrator>.mp4`. Add `--still 1,5` for a quick PNG preview.
6. **QA.** `pnpm qa --topic <id> --format F5 --narrator <narrator>` checks length, frame, loudness, captions, claims, sources and the disclosure. Exit code 1 means do not publish.
   It also writes the manual checklist and `meta-<narrator>.json` (caption and hashtags).

## 5. Publish, one video at a time

Without `--confirm` both commands only show a preview.

```sh
pnpm yt-publish --channel a --video ../out/<video>/final-<narrator>.mp4 --title "<title>" --meta ../out/<video>/meta-<narrator>.json --confirm
pnpm ig-publish --channel a --video ../out/<video>/final-<narrator>.mp4 --meta ../out/<video>/meta-<narrator>.json --confirm
```

TikTok has no upload here: post it in the app. Then add one row per post to `data/publications.csv`:

```csv
date,platform,channel,file,link,status
2026-01-06,youtube,a,out/2026-01-05-my-topic-F5/final-narrator-a.mp4,https://…,published
```

The stats command and the dashboard match stats to videos through this file.

## 6. Stats

```sh
pnpm stats --save      # writes data/stats/<date>.json
```

Run it once a day or once a week. YouTube Analytics (watch time, % watched) lags 1–2 days.

## 7. The dashboard on your data

The dashboard reads the same content directory. Build it without a base path, then serve the `out/` folder with any static server:

```sh
cd dashboard
# bash
DASHBOARD_CONTENT_DIR=/path/to/my-content pnpm build
# PowerShell
$env:DASHBOARD_CONTENT_DIR = "D:\path\to\my-content"; pnpm build

npx serve out          # or: python -m http.server --directory out
```

- A broken file stops the build with its path and the failing field.
- Views fill in as data appears:
  - a script only: the funnel;
  - narration: the costs;
  - `qa-*.json`: the checks;
  - publications and stats: views and watch time.
- This build holds your real links and numbers: keep it local or host it privately. The public build (`DASHBOARD_BASE_PATH` set) refuses a custom content directory on purpose.
- Without `DASHBOARD_CONTENT_DIR` the dashboard shows the mock in `fixtures/content` (`pnpm mock` regenerates it).
