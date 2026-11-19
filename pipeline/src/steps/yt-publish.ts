import { createHash, randomBytes } from "node:crypto";

/**
 * YouTube Data API v3:
 * - `status.containsSyntheticMedia` marks altered or synthetic content,
 * - `videos.insert` has a separate quota, 100 calls a day per project by default.
 */
export const OAUTH_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
export const OAUTH_TOKEN = "https://oauth2.googleapis.com/token";
export const API = "https://www.googleapis.com/youtube/v3";
export const UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos";
/** Scopes: upload, playlists and channel read + video stats (YouTube Analytics, read-only – `pnpm stats`). */
export const SCOPE = "https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/yt-analytics.readonly";

export const TITLE_MAX = 100;
export const DESCRIPTION_MAX_BYTES = 5000;
export const TAGS_MAX_CHARS = 500;

// ---------- video metadata ----------

export interface VideoInput {
  title: string;
  description: string;
  hashtags?: string[];
  tags?: string[];
  categoryId: string;
  /** ISO 8601 – the video is private until YouTube makes it public at this time. */
  publishAt?: string;
  /** Video and audio language (BCP-47), e.g. "pl". */
  language: string;
}

export interface VideoResource {
  snippet: { title: string; description: string; tags?: string[]; categoryId: string; defaultLanguage: string; defaultAudioLanguage: string };
  status: { privacyStatus: "public" | "private"; publishAt?: string; selfDeclaredMadeForKids: false; containsSyntheticMedia: true; embeddable: true };
}

/** Description + empty line + hashtags (YouTube shows the first 3 above the title). */
export function buildDescription(description: string, hashtags: string[] = []): string {
  const tags = hashtags.map((t) => t.trim()).filter(Boolean).map((t) => (t.startsWith("#") ? t : `#${t}`));
  const text = tags.length ? `${description.trim()}\n\n${tags.join(" ")}` : description.trim();
  if (!text) throw new Error("Empty description.");
  if (/[<>]/.test(text)) throw new Error("The description must not contain < or >.");
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > DESCRIPTION_MAX_BYTES) throw new Error(`The description has ${bytes} bytes (max ${DESCRIPTION_MAX_BYTES}).`);
  return text;
}

/**
 * Video resource for `videos.insert`. The synthetic content label and "not made for kids"
 * are hard-coded – there is no option to turn them off.
 */
export function buildVideoResource(v: VideoInput): VideoResource {
  const title = v.title.trim();
  if (!title) throw new Error("Empty title.");
  if ([...title].length > TITLE_MAX) throw new Error(`The title has ${[...title].length} characters (max ${TITLE_MAX}).`);
  if (/[<>]/.test(title)) throw new Error("The title must not contain < or >.");
  const tags = (v.tags ?? []).map((t) => t.trim().replace(/^#/, "")).filter(Boolean);
  const tagChars = tags.reduce((n, t) => n + [...t].length + (t.includes(" ") ? 2 : 0), 0) + Math.max(0, tags.length - 1);
  if (tagChars > TAGS_MAX_CHARS) throw new Error(`Tags have ${tagChars} characters (max ${TAGS_MAX_CHARS}).`);
  if (!/^\d+$/.test(v.categoryId)) throw new Error(`Invalid category: ${v.categoryId}`);
  let publishAt: string | undefined;
  if (v.publishAt) {
    const d = new Date(v.publishAt);
    if (Number.isNaN(d.getTime())) throw new Error(`Invalid publish date: ${v.publishAt}`);
    if (d.getTime() < Date.now() + 60_000) throw new Error("The publish date must be in the future.");
    publishAt = d.toISOString();
  }
  return {
    snippet: {
      title,
      description: buildDescription(v.description, v.hashtags),
      ...(tags.length ? { tags } : {}),
      categoryId: v.categoryId,
      defaultLanguage: v.language,
      defaultAudioLanguage: v.language,
    },
    status: {
      privacyStatus: publishAt ? "private" : "public",
      ...(publishAt ? { publishAt } : {}),
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: true,
      embeddable: true,
    },
  };
}

// ---------- OAuth (desktop app, PKCE, loopback redirect 127.0.0.1) ----------

export function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function authUrl(clientId: string, redirectUri: string, challenge: string, state: string): string {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent select_account",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });
  return `${OAUTH_AUTH}?${p}`;
}

/** Sets KEY=value in the contents of a .env file (replaces or appends). Never logs the value. */
export function setEnvLine(content: string, key: string, value: string): string {
  if (!/^[A-Z0-9_]+$/.test(key)) throw new Error(`Invalid variable name: ${key}`);
  if (/[\r\n]/.test(value)) throw new Error("Value contains a newline.");
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.length ? content.split(/\r?\n/) : [];
  const i = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (i >= 0) lines[i] = `${key}=${value}`;
  else {
    if (lines.length && lines.at(-1) === "") lines.pop();
    lines.push(`${key}=${value}`, "");
  }
  return lines.join(eol);
}

// ---------- API ----------

export type YtFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string | URLSearchParams | Uint8Array },
) => Promise<{ ok: boolean; status: number; headers: { get(name: string): string | null }; json(): Promise<unknown> }>;

interface GoogleError {
  error?: string | { message?: string; code?: number; errors?: { reason?: string; message?: string }[] };
  error_description?: string;
}

function apiError(where: string, status: number, data: GoogleError): Error {
  const e = data.error;
  const msg = typeof e === "string" ? `${e}${data.error_description ? `: ${data.error_description}` : ""}` : e?.message || `HTTP ${status}`;
  const reason = typeof e === "object" ? e?.errors?.[0]?.reason : undefined;
  return new Error(`YouTube API ${where}: ${msg}${reason ? ` (${reason})` : ""}`);
}

async function json<T>(where: string, res: Awaited<ReturnType<YtFetch>>): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & GoogleError;
  if (!res.ok) throw apiError(where, res.status, data);
  return data;
}

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
}

export async function exchangeCode(c: OAuthClient, code: string, verifier: string, redirectUri: string, f: YtFetch = fetch as unknown as YtFetch) {
  const body = new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, code, code_verifier: verifier, redirect_uri: redirectUri, grant_type: "authorization_code" });
  return json<{ access_token: string; refresh_token?: string }>("sign-in", await f(OAUTH_TOKEN, { method: "POST", body }));
}

export async function refreshAccessToken(c: OAuthClient, refreshToken: string, f: YtFetch = fetch as unknown as YtFetch): Promise<string> {
  const body = new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" });
  const r = await json<{ access_token: string }>("token refresh", await f(OAUTH_TOKEN, { method: "POST", body }));
  return r.access_token;
}

export interface Channel {
  id: string;
  title: string;
  customUrl?: string;
}

export interface Playlist {
  id: string;
  title: string;
}

/** YouTube Data API client. The token never appears in error messages. */
export class YtClient {
  constructor(
    private readonly accessToken: string,
    private readonly f: YtFetch = fetch as unknown as YtFetch,
  ) {}

  private auth(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.accessToken}`, ...extra };
  }

  async channel(): Promise<Channel> {
    const r = await json<{ items?: { id: string; snippet: { title: string; customUrl?: string } }[] }>(
      "channel",
      await this.f(`${API}/channels?part=snippet&mine=true`, { headers: this.auth() }),
    );
    const it = r.items?.[0];
    if (!it) throw new Error("YouTube API channel: the account has no channel (pick the brand channel when signing in).");
    return { id: it.id, title: it.snippet.title, customUrl: it.snippet.customUrl };
  }

  async playlists(): Promise<Playlist[]> {
    const r = await json<{ items?: { id: string; snippet: { title: string } }[] }>(
      "playlists",
      await this.f(`${API}/playlists?part=snippet&mine=true&maxResults=50`, { headers: this.auth() }),
    );
    return (r.items ?? []).map((p) => ({ id: p.id, title: p.snippet.title }));
  }

  /** Starts a resumable upload; returns the upload session URL. */
  async startUpload(resource: VideoResource, size: number): Promise<string> {
    const res = await this.f(`${UPLOAD}?uploadType=resumable&part=snippet,status`, {
      method: "POST",
      headers: this.auth({ "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": String(size) }),
      body: JSON.stringify(resource),
    });
    if (!res.ok) await json("upload start", res);
    const loc = res.headers.get("location");
    if (!loc) throw new Error("YouTube API upload start: no session URL (Location).");
    return loc;
  }

  async upload(location: string, bytes: Uint8Array): Promise<{ id: string }> {
    return json<{ id: string }>("upload", await this.f(location, { method: "PUT", headers: this.auth({ "Content-Type": "video/mp4", "Content-Length": String(bytes.byteLength) }), body: bytes }));
  }

  async addToPlaylist(playlistId: string, videoId: string): Promise<void> {
    await json("playlist", await this.f(`${API}/playlistItems?part=snippet`, {
      method: "POST",
      headers: this.auth({ "Content-Type": "application/json; charset=UTF-8" }),
      body: JSON.stringify({ snippet: { playlistId, resourceId: { kind: "youtube#video", videoId } } }),
    }));
  }
}
