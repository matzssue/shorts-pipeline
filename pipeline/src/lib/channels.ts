import { loadConfig, type ChannelConfig } from "./config.js";

export function channelIds(): string[] {
  return loadConfig().channels.map((c) => c.id);
}

/** Help text for the `--channel` option, e.g. `a|b`. */
export function channelChoices(): string {
  return channelIds().join("|");
}

/** Finds a channel by `--channel` value (case-insensitive) or throws with the allowed IDs. */
export function getChannel(id: string | undefined): ChannelConfig {
  const v = id?.trim().toLowerCase();
  const ch = loadConfig().channels.find((c) => c.id === v);
  if (!ch) throw new Error(`--channel: ${channelChoices()}`);
  return ch;
}

/** Env variable name for a per-channel value, e.g. `envName("YT_REFRESH_TOKEN", "a")` → `YT_REFRESH_TOKEN_A`. */
export function envName(prefix: string, channelId: string): string {
  return `${prefix}_${channelId.toUpperCase()}`;
}
