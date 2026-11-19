import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { parseArgs } from "node:util";
import { channelChoices, envName, getChannel } from "./lib/channels.js";
import { loadEnv, requireEnv } from "./lib/env.js";
import { ENV_FILE } from "./lib/paths.js";
import { authUrl, exchangeCode, pkce, setEnvLine, YtClient } from "./steps/yt-publish.js";

const help = () => `Usage:
  pnpm yt-auth --channel <${channelChoices()}>

One-time YouTube sign-in for a channel. Opens the browser – sign in and PICK THE CHANNEL from shorts.config.json.
The refresh token and the channel ID go straight into .env (YT_REFRESH_TOKEN_<ID>, YT_CHANNEL_ID_<ID>) – they are never printed.
Needs YT_CLIENT_ID and YT_CLIENT_SECRET in .env (an OAuth client of type "Desktop app").`;

function fail(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function openBrowser(url: string): void {
  try {
    const p = process.platform === "win32" ? spawn("rundll32", ["url.dll,FileProtocolHandler", url], { detached: true, stdio: "ignore" }) : spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], { detached: true, stdio: "ignore" });
    p.on("error", () => {});
    p.unref();
  } catch {
    /* the URL is printed anyway */
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { help: { type: "boolean", short: "h" }, channel: { type: "string" } }, strict: true });
  if (values.help) return void console.log(help());
  loadEnv();
  let ch;
  try {
    ch = getChannel(values.channel);
  } catch (e) {
    fail(`${(e as Error).message}\n\n${help()}`);
  }
  const client = { clientId: requireEnv("YT_CLIENT_ID"), clientSecret: requireEnv("YT_CLIENT_SECRET") };
  const { verifier, challenge } = pkce();
  const state = randomBytes(16).toString("hex");

  const code = await new Promise<{ code: string; redirect: string }>((resolve, reject) => {
    const server = createServer((req, res) => {
      const u = new URL(req.url ?? "/", "http://127.0.0.1");
      if (u.pathname !== "/") return void res.writeHead(404).end();
      const err = u.searchParams.get("error");
      const ok = !err && u.searchParams.get("state") === state && u.searchParams.get("code");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(ok ? "<h2>Done – you can close this tab and go back to the terminal.</h2>" : `<h2>Sign-in failed: ${err ?? "invalid state"}</h2>`);
      server.close();
      if (ok) resolve({ code: u.searchParams.get("code")!, redirect });
      else reject(new Error(`sign-in aborted (${err ?? "invalid state"})`));
    });
    let redirect = "";
    server.listen(0, "127.0.0.1", () => {
      redirect = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const url = authUrl(client.clientId, redirect, challenge, state);
      console.log(`Channel ${ch.id}: opening the browser. Pick the account, then the channel "${ch.name}".`);
      console.log('Warning "Google hasn\'t verified this app" → Advanced → Go to… (it is your own app).');
      console.log(`If the browser does not open, go to:\n${url}\n`);
      openBrowser(url);
    });
    setTimeout(() => {
      server.close();
      reject(new Error("5 minutes passed without signing in"));
    }, 5 * 60_000).unref();
  });

  const tokens = await exchangeCode(client, code.code, verifier, code.redirect);
  if (!tokens.refresh_token) fail("Google returned no refresh token – remove the app's access at myaccount.google.com/permissions and try again.");
  const channel = await new YtClient(tokens.access_token).channel();
  const tokenVar = envName("YT_REFRESH_TOKEN", ch.id);
  const idVar = envName("YT_CHANNEL_ID", ch.id);
  let env = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  env = setEnvLine(env, tokenVar, tokens.refresh_token);
  env = setEnvLine(env, idVar, channel.id);
  writeFileSync(ENV_FILE, env, "utf8");
  console.log(`Signed in: ${channel.title} ${channel.customUrl ?? ""} · id ${channel.id}`);
  console.log(`Saved in .env: ${tokenVar}, ${idVar}. Check: pnpm yt-publish --channel ${ch.id} --check`);
}

main().catch((e: Error) => fail(e.message));
