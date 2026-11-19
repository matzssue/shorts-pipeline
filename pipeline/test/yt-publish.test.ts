import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authUrl, buildDescription, buildVideoResource, refreshAccessToken, setEnvLine, YtClient, type YtFetch } from "../src/steps/yt-publish.js";

const L = { language: "pl" };

describe("yt-publish: metadata", () => {
  it("AI label and 'not made for kids' always on, public without a date", () => {
    const r = buildVideoResource({ title: " Title ", description: "Text.", hashtags: ["tips", "#example"], categoryId: "22", ...L });
    assert.equal(r.snippet.title, "Title");
    assert.equal(r.snippet.description, "Text.\n\n#tips #example");
    assert.equal(r.snippet.defaultLanguage, "pl");
    assert.equal(r.snippet.defaultAudioLanguage, "pl");
    assert.equal(r.status.containsSyntheticMedia, true);
    assert.equal(r.status.selfDeclaredMadeForKids, false);
    assert.equal(r.status.privacyStatus, "public");
    assert.equal(r.snippet.tags, undefined);
  });
  it("scheduled: private with publishAt", () => {
    const at = new Date(Date.now() + 3_600_000).toISOString();
    const r = buildVideoResource({ title: "T", description: "D", categoryId: "26", publishAt: at, ...L });
    assert.equal(r.status.privacyStatus, "private");
    assert.equal(r.status.publishAt, at);
  });
  it("rejects a bad title, description, category, date and too long tags", () => {
    assert.throws(() => buildVideoResource({ title: " ", description: "D", categoryId: "22", ...L }));
    assert.throws(() => buildVideoResource({ title: "a".repeat(101), description: "D", categoryId: "22", ...L }));
    assert.throws(() => buildVideoResource({ title: "a <b>", description: "D", categoryId: "22", ...L }));
    assert.throws(() => buildVideoResource({ title: "T", description: "D", categoryId: "people", ...L }));
    assert.throws(() => buildVideoResource({ title: "T", description: "D", categoryId: "22", publishAt: "2020-01-01T00:00:00Z", ...L }));
    assert.throws(() => buildVideoResource({ title: "T", description: "D", categoryId: "22", tags: ["x".repeat(501)], ...L }));
    assert.throws(() => buildDescription("ż".repeat(2501)));
    assert.throws(() => buildDescription("  "));
  });
});

describe("yt-publish: OAuth and .env", () => {
  it("sign-in URL: offline, account picker, PKCE, upload and stats scopes", () => {
    const u = new URL(authUrl("cid", "http://127.0.0.1:5000", "chal", "st"));
    assert.equal(u.searchParams.get("access_type"), "offline");
    assert.match(u.searchParams.get("prompt")!, /consent/);
    assert.equal(u.searchParams.get("code_challenge_method"), "S256");
    assert.equal(u.searchParams.get("scope"), "https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/yt-analytics.readonly");
    assert.equal(u.searchParams.get("redirect_uri"), "http://127.0.0.1:5000");
  });
  it("setEnvLine replaces or appends, keeps CRLF", () => {
    assert.equal(setEnvLine("A=1\r\nB=2\r\n", "B", "x"), "A=1\r\nB=x\r\n");
    assert.equal(setEnvLine("A=1\n", "C", "z"), "A=1\nC=z\n");
    assert.equal(setEnvLine("", "C", "z"), "C=z\n");
    assert.equal(setEnvLine("YT_X=\n", "YT_X", "v"), "YT_X=v\n");
    assert.throws(() => setEnvLine("", "C", "a\nb"));
  });
});

type Call = { url: string; method?: string; headers?: Record<string, string>; body?: unknown };

function fake(responses: { status?: number; json?: unknown; location?: string }[], calls: Call[]): YtFetch {
  return async (url, init) => {
    calls.push({ url, method: init?.method, headers: init?.headers, body: init?.body });
    const r = responses.shift()!;
    return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, headers: { get: (n) => (n.toLowerCase() === "location" ? (r.location ?? null) : null) }, json: async () => r.json ?? {} };
  };
}

describe("yt-publish: API client", () => {
  it("refreshes the token", async () => {
    const calls: Call[] = [];
    const t = await refreshAccessToken({ clientId: "c", clientSecret: "s" }, "R", fake([{ json: { access_token: "AT" } }], calls));
    assert.equal(t, "AT");
    assert.equal((calls[0]!.body as URLSearchParams).get("grant_type"), "refresh_token");
  });
  it("resumable upload: headers and session URL, then PUT of the file", async () => {
    const calls: Call[] = [];
    const yt = new YtClient("AT", fake([{ location: "https://up/s1" }, { json: { id: "vid1" } }], calls));
    const res = buildVideoResource({ title: "T", description: "D", categoryId: "22", ...L });
    const loc = await yt.startUpload(res, 3);
    assert.equal(loc, "https://up/s1");
    assert.match(calls[0]!.url, /uploadType=resumable/);
    assert.equal(calls[0]!.headers!["X-Upload-Content-Length"], "3");
    assert.equal(calls[0]!.headers!.Authorization, "Bearer AT");
    assert.equal(JSON.parse(calls[0]!.body as string).status.containsSyntheticMedia, true);
    assert.deepEqual(await yt.upload(loc, new Uint8Array([1, 2, 3])), { id: "vid1" });
    assert.equal(calls[1]!.method, "PUT");
  });
  it("API error without the token in the message", async () => {
    const yt = new YtClient("SECRET", fake([{ status: 403, json: { error: { message: "Quota exceeded", errors: [{ reason: "quotaExceeded" }] } } }], []));
    await assert.rejects(yt.channel(), (e: Error) => e.message.includes("quotaExceeded") && !e.message.includes("SECRET"));
  });
  it("an account without a channel – a clear error", async () => {
    const yt = new YtClient("AT", fake([{ json: { items: [] } }], []));
    await assert.rejects(yt.channel(), /brand channel/);
  });
});
