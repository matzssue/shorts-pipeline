import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCaption, createAndUpload, IgClient, RUPLOAD, uploadUri, waitFinished, type FetchFn } from "../src/steps/ig-publish.js";

describe("ig-publish: caption", () => {
  it("joins the caption and hashtags, adds a missing #", () => {
    assert.equal(buildCaption({ caption: " Caption. ", hashtags: ["#tips", "home", " "] }), "Caption.\n\n#tips #home");
  });
  it("no hashtags – the caption alone", () => {
    assert.equal(buildCaption({ caption: "Caption." }), "Caption.");
  });
  it("accepts 5 hashtags (Instagram limit)", () => {
    assert.ok(buildCaption({ caption: "a", hashtags: ["#a", "#b", "#c", "#d", "#e"] }).endsWith("#e"));
  });
  it("rejects an empty caption, a too long caption and too many hashtags", () => {
    assert.throws(() => buildCaption({ caption: "  " }));
    assert.throws(() => buildCaption({ caption: "a".repeat(2201) }));
    assert.throws(() => buildCaption({ caption: "a", hashtags: Array.from({ length: 6 }, (_, i) => `#t${i}`) }));
  });
});

type Call = { url: string; headers?: Record<string, string>; body?: URLSearchParams | Uint8Array };

function fakeFetch(responses: { status?: number; json: unknown }[], calls: Call[]): FetchFn {
  return async (url, init) => {
    calls.push({ url, headers: init?.headers, body: init?.body });
    const r = responses.shift()!;
    return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.json };
  };
}

describe("ig-publish: API client", () => {
  it("Reels container for an upload from disk, always with the AI label", async () => {
    const calls: Call[] = [];
    const c = new IgClient("SECRET", "123", fakeFetch([{ json: { id: "c1", uri: "https://r/c1" } }], calls), "https://x");
    assert.deepEqual(await c.createReel("Caption"), { id: "c1", uri: "https://r/c1" });
    assert.equal(calls[0]!.url, "https://x/123/media");
    const body = calls[0]!.body as URLSearchParams;
    assert.equal(body.get("media_type"), "REELS");
    assert.equal(body.get("upload_type"), "resumable");
    assert.equal(body.get("is_ai_generated"), "true");
    assert.equal(body.get("access_token"), "SECRET");
    assert.equal(body.get("thumb_offset"), null);
  });
  it("cover: --cover-ms as thumb_offset in ms", async () => {
    const calls: Call[] = [];
    const c = new IgClient("SECRET", "123", fakeFetch([{ json: { id: "c1" } }], calls), "https://x");
    await c.createReel("Caption", 4500.4);
    assert.equal((calls[0]!.body as URLSearchParams).get("thumb_offset"), "4500");
  });
  it("uploads the file with OAuth, offset and file_size headers", async () => {
    const calls: Call[] = [];
    const c = new IgClient("SECRET", "123", fakeFetch([{ json: { success: true } }], calls));
    await c.upload("https://r/c1", new Uint8Array([1, 2, 3]));
    assert.deepEqual(calls[0]!.headers, { Authorization: "OAuth SECRET", offset: "0", file_size: "3" });
    assert.equal((calls[0]!.body as Uint8Array).byteLength, 3);
  });
  it("upload error with debug_info", async () => {
    const c = new IgClient("SECRET", "123", fakeFetch([{ status: 400, json: { debug_info: { message: "bad file", retriable: false } } }], []));
    await assert.rejects(c.upload("https://r/c1", new Uint8Array([1])), /bad file/);
  });
  it("upload address from the response or from the ID", () => {
    assert.equal(uploadUri({ id: "c1", uri: "https://r/v1/c1" }), "https://r/v1/c1");
    assert.equal(uploadUri({ id: "c1" }), `${RUPLOAD}/c1`);
  });
  it("API error without the token in the message", async () => {
    const c = new IgClient("SECRET", "123", fakeFetch([{ status: 400, json: { error: { message: "Invalid parameter", code: 100 } } }], []), "https://x");
    await assert.rejects(c.publish("c1"), (e: Error) => e.message.includes("Invalid parameter") && e.message.includes("code 100") && !e.message.includes("SECRET"));
  });
  it("waits for FINISHED, stops on ERROR", async () => {
    const seq = ["IN_PROGRESS", "FINISHED"];
    await waitFinished({ status: async () => ({ status_code: seq.shift() as "FINISHED" }) }, "c", { sleep: async () => {} });
    await assert.rejects(waitFinished({ status: async () => ({ status_code: "ERROR", status: "bad codec" }) }, "c", { sleep: async () => {} }), /bad codec/);
    await assert.rejects(waitFinished({ status: async () => ({ status_code: "IN_PROGRESS" }) }, "c", { sleep: async () => {}, maxTries: 2 }), /still processing/);
  });
});

describe("ig-publish: upload retries", () => {
  function fakeClient(uploadResults: boolean[]) {
    const containers: string[] = [];
    const uploads: string[] = [];
    let n = 0;
    return {
      containers,
      uploads,
      client: {
        createReel: async (_caption: string, _coverMs?: number) => {
          const id = `c${++n}`;
          containers.push(id);
          return { id, uri: `https://r/${id}` };
        },
        upload: async (uri: string) => {
          uploads.push(uri);
          if (!uploadResults.shift()) throw new Error("Instagram API upload: Request processing failed");
        },
      },
    };
  }

  it("after a failed upload it creates a new container and tries again", async () => {
    const f = fakeClient([false, false, true]);
    const sleeps: number[] = [];
    const c = await createAndUpload(f.client, "Caption", new Uint8Array([1]), { sleep: async (ms) => sleeps.push(ms), delayMs: 10 });
    assert.equal(c.id, "c3");
    assert.deepEqual(f.uploads, ["https://r/c1", "https://r/c2", "https://r/c3"]);
    assert.deepEqual(sleeps, [10, 10]);
  });
  it("passes the cover to every container", async () => {
    const covers: (number | undefined)[] = [];
    const f = fakeClient([false, true]);
    const client = { ...f.client, createReel: async (cap: string, cover?: number) => (covers.push(cover), f.client.createReel(cap, cover)) };
    await createAndUpload(client, "Caption", new Uint8Array([1]), { coverMs: 1000, sleep: async () => {} });
    assert.deepEqual(covers, [1000, 1000]);
  });
  it("throws after the last try, without waiting after it", async () => {
    const f = fakeClient([false, false]);
    const sleeps: number[] = [];
    await assert.rejects(
      createAndUpload(f.client, "Caption", new Uint8Array([1]), { tries: 2, sleep: async (ms) => sleeps.push(ms) }),
      /Request processing failed – 2 tries, nothing was published/,
    );
    assert.equal(sleeps.length, 1);
  });
  it("a failure to create the container stops right away", async () => {
    let n = 0;
    const client = { createReel: async () => { n++; throw new Error("code 190"); }, upload: async () => {} };
    await assert.rejects(createAndUpload(client, "Caption", new Uint8Array([1]), { sleep: async () => {} }), /code 190/);
    assert.equal(n, 1);
  });
});
