import { z } from "zod";

/** Calendar date, YYYY-MM-DD. */
export const isoDate = z.iso.date();

/** Channel ID from the config. */
export const channelId = z.string().regex(/^[a-z0-9]+$/, "lowercase letters and digits");
