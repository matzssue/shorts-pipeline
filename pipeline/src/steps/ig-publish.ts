import { readFileSync } from "node:fs";

/** Instagram caption limits. */
export const CAPTION_MAX = 2200;
/** Instagram: max 5 hashtags per post and Reel. */
export const HASHTAGS_MAX = 5;

/**
 * Instagram API with Instagram Login via a Meta business portfolio:
 * Facebook Graph host, a non-expiring "system user" token,
 * the video uploaded from disk through rupload.facebook.com.
 */
export const GRAPH = "https://graph.facebook.com";
export const RUPLOAD = "https://rupload.facebook.com/ig-api-upload";

export interface CaptionInput {
  caption: string;
  hashtags?: string[];
}

/** Caption + empty line + hashtags. Throws when Instagram limits are exceeded. */
export function buildCaption({ caption, hashtags = [] }: CaptionInput): string {
  const tags = hashtags.map((t) => t.trim()).filter(Boolean).map((t) => (t.startsWith("#") ? t : `#${t}`));
  if (tags.length > HASHTAGS_MAX) throw new Error(`Too many hashtags: ${tags.length} (max ${HASHTAGS_MAX}).`);
  const text = tags.length ? `${caption.trim()}\n\n${tags.join(" ")}` : caption.trim();
  if (!text) throw new Error("Empty caption.");
  if ([...text].length > CAPTION_MAX) throw new Error(`The caption has ${[...text].length} characters (max ${CAPTION_MAX}).`);
  return text;
}

// ---------- API ----------

export type FetchFn = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: URLSearchParams | Uint8Array },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export type ContainerStatus = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";

interface ApiError {
  error?: { message?: string; code?: number; error_subcode?: number; error_user_msg?: string };
  debug_info?: { message?: string; type?: string; retriable?: boolean };
}

function apiError(where: string, status: number, data: ApiError): Error {
  const e = data.error;
  const msg = e?.error_user_msg || e?.message || data.debug_info?.message || `HTTP ${status}`;
  return new Error(`Instagram API ${where}: ${msg}${e?.code ? ` (code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ""})` : ""}`);
}

/** Instagram API client. The token never appears in error messages. */
export class IgClient {
  constructor(
    private readonly token: string,
    readonly userId: string,
    private readonly fetchFn: FetchFn = fetch as unknown as FetchFn,
    private readonly base = GRAPH,
  ) {}

  private async call<T>(method: "GET" | "POST", path: string, params: Record<string, string> = {}): Promise<T> {
    const all = new URLSearchParams({ ...params, access_token: this.token });
    const url = method === "GET" ? `${this.base}${path}?${all}` : `${this.base}${path}`;
    const res = await this.fetchFn(url, method === "GET" ? { method } : { method, body: all });
    const data = (await res.json().catch(() => ({}))) as T & ApiError;
    if (!res.ok || data.error) throw apiError(`${method} ${path}`, res.status, data);
    return data;
  }

  /** Account data (checks that the token matches the IG user id). */
  account() {
    return this.call<{ id: string; username?: string; name?: string }>("GET", `/${this.userId}`, { fields: "id,username,name" });
  }

  /**
   * Reels container for an upload from disk. The AI label is always on – there is no parameter to turn it off.
   * `coverMs` – cover frame in ms from the start (`thumb_offset`; by default Instagram takes the first frame).
   */
  createReel(caption: string, coverMs?: number) {
    return this.call<{ id: string; uri?: string }>("POST", `/${this.userId}/media`, {
      media_type: "REELS",
      upload_type: "resumable",
      caption,
      share_to_feed: "true",
      is_ai_generated: "true",
      ...(coverMs !== undefined ? { thumb_offset: String(Math.round(coverMs)) } : {}),
    });
  }

  /** Uploads the whole file (offset 0) to the container's address. */
  async upload(uri: string, bytes: Uint8Array): Promise<void> {
    const res = await this.fetchFn(uri, {
      method: "POST",
      headers: { Authorization: `OAuth ${this.token}`, offset: "0", file_size: String(bytes.byteLength) },
      body: bytes,
    });
    const data = (await res.json().catch(() => ({}))) as ApiError & { success?: boolean };
    if (!res.ok || data.error || data.success === false) throw apiError("upload", res.status, data);
  }

  status(containerId: string) {
    return this.call<{ status_code?: ContainerStatus; status?: string }>("GET", `/${containerId}`, { fields: "status_code,status" });
  }

  publish(containerId: string) {
    return this.call<{ id: string }>("POST", `/${this.userId}/media_publish`, { creation_id: containerId });
  }

  media(mediaId: string) {
    return this.call<{ id: string; permalink?: string }>("GET", `/${mediaId}`, { fields: "id,permalink" });
  }

  publishingLimit() {
    return this.call<{ data?: { quota_usage?: number; config?: { quota_total?: number } }[] }>("GET", `/${this.userId}/content_publishing_limit`, { fields: "quota_usage,config" });
  }
}

/** Upload address: from the container response, or built from the ID when missing. */
export function uploadUri(container: { id: string; uri?: string }): string {
  return container.uri ?? `${RUPLOAD}/${container.id}`;
}

export function readVideo(file: string): Uint8Array {
  return new Uint8Array(readFileSync(file));
}

/**
 * Creates a container and uploads the video; when the upload fails – a new container and another try.
 * rupload sometimes answers "Request processing failed" for a few minutes before it lets uploads through.
 * A failed container stays empty (never published, expires after 24 h), so retrying cannot create a duplicate.
 * Only the upload is retried – a failure to create the container stops right away. Does not publish.
 */
export async function createAndUpload(
  client: Pick<IgClient, "createReel" | "upload">,
  caption: string,
  bytes: Uint8Array,
  {
    coverMs,
    tries = 5,
    delayMs = 60_000,
    sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)),
    onAttempt,
  }: { coverMs?: number; tries?: number; delayMs?: number; sleep?: (ms: number) => Promise<unknown>; onAttempt?: (containerId: string, i: number, error?: Error) => void } = {},
): Promise<{ id: string; uri?: string }> {
  let last: Error | undefined;
  for (let i = 1; i <= tries; i++) {
    const container = await client.createReel(caption, coverMs);
    try {
      await client.upload(uploadUri(container), bytes);
      onAttempt?.(container.id, i);
      return container;
    } catch (e) {
      last = e as Error;
      onAttempt?.(container.id, i, last);
      if (i < tries) await sleep(delayMs);
    }
  }
  throw new Error(`${last?.message ?? "Upload failed"} – ${tries} tries, nothing was published.`);
}

/** Waits until Instagram has processed the video (Meta suggests checking once a minute, up to about 5 min). */
export async function waitFinished(
  client: Pick<IgClient, "status">,
  containerId: string,
  { intervalMs = 30_000, maxTries = 12, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)), onTick }: { intervalMs?: number; maxTries?: number; sleep?: (ms: number) => Promise<unknown>; onTick?: (s: string, i: number) => void } = {},
): Promise<void> {
  for (let i = 1; i <= maxTries; i++) {
    await sleep(intervalMs);
    const s = await client.status(containerId);
    const code = s.status_code ?? "IN_PROGRESS";
    onTick?.(code, i);
    if (code === "FINISHED") return;
    if (code === "ERROR" || code === "EXPIRED") throw new Error(`Instagram did not accept the video: ${code}${s.status ? ` – ${s.status}` : ""}`);
  }
  throw new Error(`The video is still processing after ${Math.round((intervalMs * maxTries) / 1000)} s – check container ${containerId} later.`);
}
