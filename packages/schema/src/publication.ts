import { z } from "zod";
import { channelId, isoDate } from "./common.js";

/** One row of `data/publications.csv`: a video published (or planned) on one platform. */

export const PUBLICATION_COLUMNS = ["date", "platform", "channel", "file", "link", "status"] as const;

export const publicationSchema = z.strictObject({
  date: isoDate,
  /** Lowercase, e.g. "youtube", "instagram", "tiktok". */
  platform: z.string().regex(/^[a-z]+$/),
  channel: channelId,
  /** Rendered file the post was made from. */
  file: z.string(),
  /** Public URL; empty until the post is live. */
  link: z.union([z.literal(""), z.url()]),
  status: z.string(),
});

export type Publication = z.infer<typeof publicationSchema>;
