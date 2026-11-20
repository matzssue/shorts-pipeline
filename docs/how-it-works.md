# How it works, in plain words

Who does what so that one short video gets made and published. For commands and setup, see [getting-started.md](getting-started.md).

## In short

This is not a "make me a video" button. It is an assembly line with quality control.

- **You** decide: the topic, what is good enough, what goes out and when. You also make the clips in any video generator.
- **Claude** (in Claude Code) writes the scripts, runs the commands, follows the rules and fixes what the checks flag.
- **The pipeline** does the repetitive part: records the narration, edits the video, checks it, uploads it to Instagram and YouTube.

Every step leaves a file. Any step can be run again on its own, without paying twice.

## One video, step by step

| Step | Who | What happens |
| --- | --- | --- |
| 1. Topic | you + Claude | A topic card: facts, each with a source and a date. The video may only say what is on the card. |
| 2. Script | Claude | Scenes, narration, captions, overlays. The pipeline checks scene lengths, banned phrases and that every claim has a source. |
| 3. Clips | you | One clip or image per scene, from any generator, dropped into the video's folder. |
| 4. Narration | pipeline | A voice from ElevenLabs, with the timing of every word. Paid, so the same text is never recorded twice; one bad scene can be redone alone. |
| 5. Edit | pipeline | Remotion puts clips, voice and word-by-word captions together into a 9:16 video. |
| 6. Checks | pipeline + you | Automatic QA: length, loudness, captions, sources, the AI disclosure. An error means it does not go out. Then you watch it. |
| 7. Publishing | you decide | One video at a time, only after your yes. YouTube and Instagram through their official APIs, with the AI label on. TikTok by hand. |
| 8. Numbers | pipeline | Views and watch time from YouTube and Instagram, saved as a dated file. |
| 9. Report | dashboard | Reads all those files and shows what was made, what failed QA, what it cost and how the videos do. It changes nothing. |

## What it does not do

- It does not invent facts – only what is on the card.
- It does not generate the clips – you bring them.
- It does not post on its own or in bulk – every post needs a person's yes.
- It does not use a TikTok API.

## Why it is built like this

- **Files, not a database.** Each step reads the files of the step before. You can stop anywhere, fix one thing and carry on.
- **Facts only from a card.** A short video spreads fast; a made-up claim cannot slip in through the script.
- **A person publishes.** Platforms punish bulk automated uploads, and the label "made with AI" has to be right every time.
