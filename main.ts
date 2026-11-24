// Meme Sprint 3: AI Agent Goes Rogue
// "I told my agent to take a break. It unionised."
//
// A zero-dependency Node program that draws the meme from scratch at run
// time (vector shapes + an embedded 5x7 bitmap font) and writes it as a PNG
// to /output/entry.png. No network, no system fonts, no pre-made image.

import * as fs from "node:fs";
import * as path from "node:path";
import zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const NAVY: RGB = [15, 23, 42];
const WHITE: RGB = [255, 255, 255];
const RED: RGB = [220, 38, 38];
const ROBOT_LIGHT: RGB = [229, 231, 235];
const ROBOT_MID: RGB = [209, 213, 219];
const ROBOT_DARK: RGB = [156, 163, 175];
const INK: RGB = [17, 24, 39];
const GREEN: RGB = [74, 222, 128];
const ORANGE: RGB = [249, 115, 22];
const BROWN: RGB = [146, 64, 14];
const GROUND: RGB = [217, 119, 6];

type RGB = [number, number, number];

// ------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows of 5 cells, "#" = on. Uppercase + digits + punctuation.
const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "..##.", ".#...", "#....", "#####"],
  "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
};

// ---------------------------------------------------------------- canvas
class Canvas {
  w: number;
  h: number;
  buf: Uint8Array; // RGB, row-major

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.buf = new Uint8Array(w * h * 3);
  }

  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }

  fill(c: RGB): void {
    for (let i = 0; i < this.w * this.h; i++) {
      this.buf[i * 3] = c[0];
      this.buf[i * 3 + 1] = c[1];
      this.buf[i * 3 + 2] = c[2];
    }
  }

  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.ceil(x + w));
    const y1 = Math.min(this.h, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this.set(xx, yy, c);
    }
  }

  circle(cx: number, cy: number, r: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(cx - r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r * r) this.set(x, y, c);
      }
    }
  }

  // Thick line: stamp circles along the segment.
  line(x0: number, y0: number, x1: number, y1: number, width: number, c: RGB): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
    const r = width / 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.circle(x0 + dx * t, y0 + dy * t, r, c);
    }
  }

  roundRect(x: number, y: number, w: number, h: number, r: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w - 1, Math.ceil(x + w));
    const y1 = Math.min(this.h - 1, Math.ceil(y + h));
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        // Inside the rect, or inside one of the four corner circles.
        const cx = Math.min(Math.max(xx, x + r), x + w - r);
        const cy = Math.min(Math.max(yy, y + r), y + h - r);
        const ddx = xx - cx;
        const ddy = yy - cy;
        if (ddx * ddx + ddy * ddy <= r * r) this.set(xx, yy, c);
      }
    }
  }

  // Blit another canvas rotated by `angle` radians around (cx, cy).
  blitRotated(src: Canvas, cx: number, cy: number, angle: number): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const hw = src.w / 2;
    const hh = src.h / 2;
    const reach = Math.ceil(Math.hypot(hw, hh));
    const x0 = Math.max(0, Math.floor(cx - reach));
    const y0 = Math.max(0, Math.floor(cy - reach));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + reach));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + reach));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        // Inverse-rotate the destination point back into source space.
        const dx = x - cx;
        const dy = y - cy;
        const sx = Math.round(dx * cos + dy * sin + hw);
        const sy = Math.round(-dx * sin + dy * cos + hh);
        if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
        const si = (sy * src.w + sx) * 3;
        this.set(x, y, [src.buf[si], src.buf[si + 1], src.buf[si + 2]]);
      }
    }
  }
}

// -------------------------------------------------------------- text
function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

function drawText(
  cv: Canvas,
  text: string,
  cx: number,
  y: number,
  scale: number,
  color: RGB,
): void {
  const w = textWidth(text, scale);
  let x = Math.round(cx - w / 2);
  for (const ch of text) {
    const glyph = FONT[ch] ?? FONT[" "];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === "#") {
          cv.fillRect(x + col * scale, y + row * scale, scale, scale, color);
        }
      }
    }
    x += 6 * scale;
  }
}

// -------------------------------------------------------------- PNG out
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(cv: Canvas): Buffer {
  const raw = Buffer.alloc(cv.h * (1 + cv.w * 3));
  for (let y = 0; y < cv.h; y++) {
    raw[y * (1 + cv.w * 3)] = 0; // filter: none
    raw.set(cv.buf.subarray(y * cv.w * 3, (y + 1) * cv.w * 3), y * (1 + cv.w * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0);
  ihdr.writeUInt32BE(cv.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// -------------------------------------------------------------- the meme
function drawScene(cv: Canvas): void {
  // Warm yellow sky, top to bottom.
  const top: RGB = [253, 230, 138];
  const bot: RGB = [252, 211, 77];
  for (let y = 200; y < 820; y++) {
    const t = (y - 200) / 620;
    const c: RGB = [
      Math.round(top[0] + (bot[0] - top[0]) * t),
      Math.round(top[1] + (bot[1] - top[1]) * t),
      Math.round(top[2] + (bot[2] - top[2]) * t),
    ];
    cv.fillRect(0, y, W, 1, c);
  }

  // Sun with rays, top left.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    cv.line(
      150 + Math.cos(a) * 62,
      300 + Math.sin(a) * 62,
      150 + Math.cos(a) * 84,
      300 + Math.sin(a) * 84,
      7,
      ORANGE,
    );
  }
  cv.circle(150, 300, 50, ORANGE);

  // One cloud, top right, and a small one low left to balance the scene.
  cv.circle(830, 268, 30, WHITE);
  cv.circle(866, 258, 36, WHITE);
  cv.circle(902, 270, 28, WHITE);
  cv.fillRect(802, 262, 128, 26, WHITE);
  cv.circle(132, 690, 24, WHITE);
  cv.circle(162, 682, 28, WHITE);
  cv.circle(190, 692, 22, WHITE);
  cv.fillRect(110, 686, 102, 20, WHITE);

  // Ground strip.
  cv.fillRect(0, 768, W, 52, GROUND);
}

function drawPicketSign(): Canvas {
  const sign = new Canvas(360, 190);
  sign.fill(WHITE);
  // Red frame.
  sign.fillRect(0, 0, 360, 12, RED);
  sign.fillRect(0, 178, 360, 12, RED);
  sign.fillRect(0, 0, 12, 190, RED);
  sign.fillRect(348, 0, 12, 190, RED);
  drawText(sign, "NO MORE", 180, 28, 6, RED);
  drawText(sign, "3AM DEPLOYS", 180, 112, 5, INK);
  return sign;
}

function drawRobot(cv: Canvas): void {
  // Legs + feet.
  cv.fillRect(440, 696, 40, 66, ROBOT_DARK);
  cv.fillRect(544, 696, 40, 66, ROBOT_DARK);
  cv.roundRect(428, 754, 64, 28, 10, INK);
  cv.roundRect(532, 754, 64, 28, 10, INK);

  // Left arm, hanging down.
  cv.line(402, 530, 344, 628, 26, ROBOT_MID);
  cv.circle(340, 636, 17, ROBOT_DARK);

  // Body: dark outline pass, then the face colour inset by 4px.
  cv.roundRect(392, 490, 240, 212, 26, INK);
  cv.roundRect(396, 494, 232, 204, 22, ROBOT_MID);

  // Chest screen: the agent's status, now on strike.
  cv.roundRect(424, 525, 176, 110, 10, NAVY);
  drawText(cv, "STATUS:", 512, 542, 3, GREEN);
  drawText(cv, "ON STRIKE", 512, 586, 3, GREEN);

  // Antenna.
  cv.line(512, 332, 512, 292, 8, INK);
  cv.circle(512, 282, 13, RED);

  // Head.
  cv.roundRect(412, 330, 200, 142, 26, INK);
  cv.roundRect(416, 334, 192, 134, 22, ROBOT_LIGHT);

  // Red protest headband with a knot.
  cv.fillRect(418, 344, 188, 22, RED);
  cv.circle(608, 355, 11, RED);
  cv.line(610, 362, 626, 386, 6, RED);
  cv.line(614, 366, 596, 388, 6, RED);

  // Determined eyes: white, pupils, brows angled down toward the middle.
  cv.roundRect(440, 396, 60, 40, 8, WHITE);
  cv.roundRect(524, 396, 60, 40, 8, WHITE);
  cv.circle(472, 416, 11, INK);
  cv.circle(552, 416, 11, INK);
  cv.line(438, 382, 502, 392, 7, INK);
  cv.line(524, 392, 586, 382, 7, INK);

  // Flat, unimpressed mouth.
  cv.line(484, 452, 540, 452, 6, INK);

  // Right arm raised, holding the sign stick.
  cv.line(624, 530, 706, 428, 26, ROBOT_MID);
  cv.circle(710, 424, 17, ROBOT_DARK);
  cv.line(710, 424, 834, 437, 11, BROWN);

  // The picket sign, tilted like a real protest placard, clear of the head.
  const sign = drawPicketSign();
  cv.blitRotated(sign, 820, 345, -0.17);
}

// ------------------------------------------------------------------ main
function main(): void {
  const cv = new Canvas(W, H);

  // Top caption band.
  cv.fillRect(0, 0, W, 200, NAVY);
  drawText(cv, "I TOLD MY AGENT", 512, 26, 9, WHITE);
  drawText(cv, "TO TAKE A BREAK", 512, 104, 9, WHITE);

  // The scene: a robot on strike.
  drawScene(cv);
  drawRobot(cv);

  // Bottom punchline band.
  cv.fillRect(0, 820, W, 204, NAVY);
  drawText(cv, "IT UNIONISED.", 512, 884, 11, WHITE);

  const png = encodePng(cv);

  // Write to /output (create it if needed; never remove the directory).
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "entry.png");
  fs.writeFileSync(outPath, png);

  console.log(`wrote ${outPath}: ${W}x${H}, ${png.length} bytes`);
  if (png.length > 1048576) {
    console.error("ERROR: image exceeds the 1 MiB gate");
    process.exit(1);
  }
}

main();
