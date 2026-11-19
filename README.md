# shorts-pipeline

A TypeScript CLI that turns fact-checked content cards into vertical short videos (9:16) and publishes them.

```
topic / product card (JSON, validated with Zod)
  → script checks (scene lengths, banned phrases, facts only from the card)
  → narration with ElevenLabs + word-level timings
  → Remotion render (captions synced to words, overlays, series theme)
  → automated QA (duration, loudness, caption, disclosure, sources)
  → publishing to YouTube Shorts and Instagram Reels via official APIs
  → stats snapshot (YouTube Analytics, Instagram Insights)
```

The engine is generic. Everything specific to a channel – channel list, narrators and voices, series names, language, disclosure text, content cards – lives in a separate **content directory** that is not part of this repo.

## Requirements

- Node.js ≥ 20.12, pnpm 9
- ffmpeg on `PATH` (audio checks, flow clips)
- Optional, per step: ElevenLabs API key, a Google OAuth client (YouTube), an Instagram system-user token

## Repository layout

A pnpm workspace:

```
pipeline/            the CLI (this README)
packages/schema/     Zod schemas, types and video constants shared by every package
packages/            more shared packages (coming: timeline, mock data)
dashboard/           Next.js dashboard on mock data (coming)
```

## Quick start

```sh
pnpm install           # from the repo root
pnpm typecheck         # all packages
pnpm test              # all packages
cd pipeline
pnpm validate          # checks every card in the content directory
```

Without a content directory the pipeline runs on `examples/` (example config with two channels, two narrators and two series).

## Content directory

Set `CONTENT_DIR` to a folder with your own content (default: the `pipeline/` folder itself):

```
my-content/
  shorts.config.json   # channels, narrators, series, language, disclosure
  .env                 # secrets – see pipeline/.env.example
  topics/<id>.json     # topic cards
  products/<id>.json   # product cards
  flows/<name>.json    # step-by-step plans for generated clips
  assets/              # images, character cutouts
  out/                 # renders, audio, QA reports (generated)
  data/                # publications.csv, stats/<date>.json (generated)
```

`shorts.config.json` – see [`examples/shorts.config.example.json`](pipeline/examples/shorts.config.example.json):

| Key | Meaning |
| --- | --- |
| `channels[]` | `id` (lowercase, used in env names, e.g. `YT_REFRESH_TOKEN_A`), `name`, `youtubeCategoryId` |
| `narrators[]` | `id`, `name`, ElevenLabs `voiceId` or `voiceIdEnv`, `model`, optional `languageCode`, `stability` |
| `series` | number → series title shown on the opening card |
| `language` | BCP-47 language of the videos (YouTube metadata) |
| `sourceLabel` | label of the source card at the end of a video |
| `disclosure` | sentence every caption must contain (AI disclosure); QA fails without it |

## Commands

All commands run from `pipeline/`; each one prints its own help with `--help`.

| Command | What it does |
| --- | --- |
| `pnpm validate` | validates topic and product cards |
| `pnpm make --topic <id> --format F5 [--narrator <id>]` | script checks, narration, render |
| `pnpm compose …` | re-renders a video from existing narration (`--still` for a single frame) |
| `pnpm voice-fix … --scene <n> --takes <k>` | records alternative takes of one scene, `--apply <take>` swaps it in |
| `pnpm qa …` | QA report for a rendered video |
| `pnpm flow <plan>` | walks through a plan of generated clips, tracks status, converts and stitches clips |
| `pnpm yt-auth` / `pnpm yt-publish` | OAuth (PKCE) for a channel / upload a Short with metadata |
| `pnpm ig-publish` | publishes a Reel through the Instagram Graph API |
| `pnpm stats` | snapshot of account and video stats into `data/stats/` |
| `pnpm voice-samples` | browse and save ElevenLabs voice samples, check character usage |

Publishing is always one video at a time, started by a person – there is no bulk upload.

## Tech

TypeScript (strict), Zod 4 schemas, Remotion 4 + React 19, ElevenLabs SDK, YouTube Data & Analytics API, Instagram Graph API, `node:test`.

## Licence

Code: [MIT](LICENSE).

**Remotion is not MIT.** It uses its own [Remotion License](https://www.remotion.dev/license): free for individuals and companies with up to 3 employees; larger companies need a company licence. Check it before using this pipeline commercially.
