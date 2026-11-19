import { readFileSync } from "node:fs";

export interface Mp4Info {
  /** Seconds (`mvhd` atom). */
  duration: number | null;
  /** Size of the first video track (`tkhd` atom). */
  width: number | null;
  height: number | null;
}

/** Length of an MP4 file in seconds (`mvhd` atom); null when it cannot be read. */
export function mp4Duration(file: string): number | null {
  return mp4Info(file).duration;
}

/** Reads duration and video size straight from the MP4 atoms – no ffprobe needed. */
export function mp4Info(file: string): Mp4Info {
  const buf = readFileSync(file);
  const info: Mp4Info = { duration: null, width: null, height: null };
  walk(buf, 0, buf.length, info);
  return info;
}

function walk(buf: Buffer, start: number, end: number, info: Mp4Info): void {
  let p = start;
  while (p + 8 <= end) {
    let size = buf.readUInt32BE(p);
    const type = buf.toString("latin1", p + 4, p + 8);
    let hdr = 8;
    if (size === 1) {
      size = Number(buf.readBigUInt64BE(p + 8));
      hdr = 16;
    }
    if (size === 0) size = end - p;
    if (size < hdr) return;
    if (type === "moov" || type === "trak") walk(buf, p + hdr, p + size, info);
    if (type === "mvhd") {
      const v = buf[p + hdr];
      const scale = v === 1 ? buf.readUInt32BE(p + hdr + 20) : buf.readUInt32BE(p + hdr + 12);
      const dur = v === 1 ? Number(buf.readBigUInt64BE(p + hdr + 24)) : buf.readUInt32BE(p + hdr + 16);
      info.duration = scale > 0 ? dur / scale : null;
    }
    if (type === "tkhd" && info.width === null) {
      // Width and height (16.16 fixed point) are the last 8 bytes of the atom; an audio track has 0.
      const w = buf.readUInt32BE(p + size - 8) / 65536;
      const h = buf.readUInt32BE(p + size - 4) / 65536;
      if (w > 0 && h > 0) {
        info.width = w;
        info.height = h;
      }
    }
    p += size;
  }
}
