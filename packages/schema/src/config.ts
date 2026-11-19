import { z } from "zod";
import { channelId } from "./common.ts";

/** `shorts.config.json` in the content directory: everything channel-specific. */

export const narratorConfigSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z0-9-]+$/, "kebab-case"),
    name: z.string().min(1),
    /** ElevenLabs voice ID. Not a secret, but account-specific – prefer `voiceIdEnv`. */
    voiceId: z.string().min(1).optional(),
    /** Name of the env variable that holds the voice ID. */
    voiceIdEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/).optional(),
    model: z.string().min(1),
    /** Forced pronunciation language; without it the voice keeps more of its own accent. */
    languageCode: z.string().min(2).optional(),
    /** 0–1: lower = more expressive. */
    stability: z.number().min(0).max(1).optional(),
  })
  .refine((n) => n.voiceId || n.voiceIdEnv, "set voiceId or voiceIdEnv");

export const channelConfigSchema = z.strictObject({
  /** Short ID used in `--channel` and in env names, e.g. `a` → `YT_REFRESH_TOKEN_A`. */
  id: channelId,
  name: z.string().min(1),
  /** Default YouTube category for uploads (22 = People & Blogs). */
  youtubeCategoryId: z.string().regex(/^\d+$/).default("22"),
});

export const configSchema = z.strictObject({
  channels: z.array(channelConfigSchema).min(1),
  narrators: z.array(narratorConfigSchema).min(1),
  /** Series titles shown on the intro card, by series number. */
  series: z.record(z.string().regex(/^\d+$/), z.string().min(1)).default({}),
  /** Label above the source overlay in the video (in the video's language). */
  sourceLabel: z.string().min(1).default("Source"),
  /** Language of the videos (BCP-47), e.g. "pl" – sent to YouTube as the video and audio language. */
  language: z.string().min(2).default("en"),
  /** Sentence every description must contain to disclose AI use; empty = no check. */
  disclosure: z.string().default(""),
  /** Characters per month in the voice service plan – the dashboard shows usage against it. */
  voiceCharsPerMonth: z.number().int().positive().optional(),
});

export type Config = z.infer<typeof configSchema>;
export type ChannelConfig = Config["channels"][number];
export type NarratorConfig = Config["narrators"][number];
