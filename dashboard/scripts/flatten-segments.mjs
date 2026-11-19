// Next 16 exports prefetch segments as folders (`checks/__next.checks/__PAGE__.txt`), but the client
// asks for one dotted name (`checks/__next.checks.__PAGE__.txt`). A static host cannot rewrite, so
// after the build each nested file is copied to the name the client asks for.
import { copyFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../out");

const filesIn = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesIn(path.join(dir, e.name)) : [path.join(dir, e.name)]));

let copied = 0;
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const full = path.join(dir, e.name);
    if (!e.name.startsWith("__next.")) {
      walk(full);
      continue;
    }
    for (const f of filesIn(full)) {
      const flat = path.join(dir, `${e.name}.${path.relative(full, f).split(path.sep).join(".")}`);
      if (!existsSync(flat)) {
        copyFileSync(f, flat);
        copied++;
      }
    }
  }
}

if (!existsSync(OUT)) throw new Error(`no build in ${OUT}`);
walk(OUT);
console.log(`prefetch segments: ${copied} copied to dotted names`);
