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

- Node.js 24 (see `.nvmrc`), pnpm 9
- ffmpeg on `PATH` (audio checks, flow clips)
- Optional, per step: ElevenLabs API key, a Google OAuth client (YouTube), an Instagram system-user token

## Repository layout

A pnpm workspace:

```
pipeline/            the CLI (this README)
packages/schema/     Zod schemas, types and video constants shared by every package
packages/timeline/   pure timeline functions: caption lines, timecode, scene lookup
packages/mock/       deterministic mock content generator (seeded, no real data)
fixtures/content/    its output: a complete example content directory, committed
dashboard/           Stykówka: static Next.js dashboard on the mock data (in progress)
```

**Stykówka** (Polish for *contact sheet*: one sheet with every frame of a film roll) is the dashboard. Next.js 16 static export, Tailwind 4 with its default theme switched off in favour of its own tokens, self-hosted fonts, light and dark themes. At build time it reads a content directory (the committed mock fixtures; real data is refused in the public build), validates every file with `@shorts/schema` and joins videos with their publications, stats and narration costs. A broken file stops the build with its path and field. Charts render on the server to SVG and HTML, so they read the same without JavaScript (it only adds the hover and keyboard readout), and every chart has its numbers in a table; `/patterns/` shows each chart form on the mock data. The Overview takes its date range from the address (`?from=…&to=…`), so a link reproduces the view; the static HTML holds the whole season and the browser recomputes every section for the range. Films works the same way: filters, sort, table or contact sheet and the chosen columns all live in the address. Vitest covers the data layer, scales and ticks; Playwright with axe checks every view in both themes and at phone width, and compares the pattern page with reference screenshots (kept per platform).

```sh
pnpm --filter @shorts/dashboard dev     # http://localhost:3000
pnpm --filter @shorts/dashboard build   # static site in dashboard/out
pnpm --filter @shorts/dashboard e2e     # end-to-end tests on the built site
```

`pnpm mock` regenerates `fixtures/content/`: 17 topic videos and a product video over a six-week season, with scripts, narration timings, timelines, QA results, publications, daily stats snapshots and the voice ledger. The scripts, timelines and QA results are produced by the pipeline's own functions; only the TTS and the platform numbers are simulated. The same seed always gives byte-identical files, and a test fails when the committed fixtures are out of date.

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
  data/                # publications.csv, stats/<date>.json, voice-ledger.csv (generated)
```

### Generated data files

Besides videos and Markdown reports, the pipeline writes machine-readable files (validated against `@shorts/schema` before writing):

| File | Written by | Contents |
| --- | --- | --- |
| `out/<date>-<id>-<format>/compose-<narrator>.json` | `pnpm compose` | the timeline the video is rendered from: scenes and caption words in frames |
| `out/<date>-<id>-<format>/qa-<narrator>.json` | `pnpm qa` | QA checks (`ok` / `warning` / `error`), manual checklist, pass flag |
| `data/voice-ledger.csv` | `pnpm make --narrator`, `pnpm voice-fix --takes` | characters per narration request: `date, film, narrator, model, kind (full/take/cache), scene, chars` |
| `data/stats/<date>.json` | `pnpm stats --save` | account and per-video stats snapshot |

`shorts.config.json` – see [`examples/shorts.config.example.json`](pipeline/examples/shorts.config.example.json):

| Key | Meaning |
| --- | --- |
| `channels[]` | `id` (lowercase, used in env names, e.g. `YT_REFRESH_TOKEN_A`), `name`, `youtubeCategoryId` |
| `narrators[]` | `id`, `name`, ElevenLabs `voiceId` or `voiceIdEnv`, `model`, optional `languageCode`, `stability` |
| `series` | number → series title shown on the opening card |
| `language` | BCP-47 language of the videos (YouTube metadata) |
| `sourceLabel` | label of the source card at the end of a video |
| `disclosure` | sentence every caption must contain (AI disclosure); QA fails without it |
| `voiceCharsPerMonth` | optional: characters per month in the voice plan, shown against usage in the dashboard |

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
