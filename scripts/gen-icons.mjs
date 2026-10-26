// 生成站点图标:src/app/icon.svg、src/app/favicon.ico、src/app/apple-icon.png
// 纯 Node 实现(无第三方依赖):几何光栅化 + zlib PNG/BMP + ICO 封装
// 改动设计常量后重新运行:node scripts/gen-icons.mjs
// 注意:src/components/Dashboard.tsx 页头有同一图案的内联副本,需手动同步
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "app");

// ---- 设计常量(64×64 画布,仿纳斯达克:蓝底 + 上行折线箭头)----
const R = 14; // 圆角半径
const STROKE = 6.5; // 折线线宽
const PTS = [
  [13, 46],
  [27, 34], // 上行
  [36, 40], // 回踩
  [46, 30], // 冲高
];
const TRI = [
  [52.7, 23.3], // 箭头尖(沿 45° 指向右上)
  [50.6, 34.6],
  [41.4, 25.4],
];
const C0 = [0x00, 0xa3, 0xe0]; // 亮纳斯达克蓝
const C1 = [0x00, 0x55, 0x8c]; // 深纳斯达克蓝
const hex = (c) => c.map((v) => v.toString(16).padStart(2, "0")).join("");

// ---- 几何 ----
const sdRoundRect = (x, y) => {
  const qx = Math.abs(x - 32) - (32 - R);
  const qy = Math.abs(y - 32) - (32 - R);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - R;
};

const d2seg = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax;
  const dy = by - ay;
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

const inTri = (px, py) => {
  const [[ax, ay], [bx, by], [cx, cy]] = TRI;
  const s1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const s2 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
  const s3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
};

const white = (x, y) => {
  if (inTri(x, y)) return true;
  for (let i = 0; i < PTS.length - 1; i++)
    if (d2seg(x, y, PTS[i], PTS[i + 1]) <= STROKE / 2) return true;
  return false;
};

const grad = (x, y) => {
  const t = Math.max(0, Math.min(1, (x + y) / 128)); // 沿 45° 对角线渐变
  return C0.map((v, i) => v + (C1[i] - v) * t);
};

// ---- 光栅化(4× 超采样后盒式降采样)----
const S = 4;
function render(size) {
  const W = size * S;
  const rgb = new Float64Array(size * size * 3);
  const cnt = new Uint16Array(size * size);
  for (let j = 0; j < W; j++)
    for (let i = 0; i < W; i++) {
      const x = ((i + 0.5) / W) * 64;
      const y = ((j + 0.5) / W) * 64;
      if (sdRoundRect(x, y) > 0) continue;
      const k = (Math.floor(j / S) * size + Math.floor(i / S)) * 3;
      const c = white(x, y) ? [255, 255, 255] : grad(x, y);
      rgb[k] += c[0];
      rgb[k + 1] += c[1];
      rgb[k + 2] += c[2];
      cnt[Math.floor(j / S) * size + Math.floor(i / S)]++;
    }
  const out = Buffer.alloc(size * size * 4);
  for (let p = 0; p < size * size; p++) {
    const n = cnt[p] || 1;
    out[p * 4] = Math.round(rgb[p * 3] / n);
    out[p * 4 + 1] = Math.round(rgb[p * 3 + 1] / n);
    out[p * 4 + 2] = Math.round(rgb[p * 3 + 2] / n);
    out[p * 4 + 3] = Math.round((cnt[p] / (S * S)) * 255);
  }
  return out;
}

// ---- PNG 编码 ----
const CRC_T = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 位深
  ihdr[9] = 6; // RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++)
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- ICO 封装(小尺寸用 BMP 条目,兼容性最好)----
function dib(size, rgba) {
  const hdr = Buffer.alloc(40);
  hdr.writeUInt32LE(40, 0);
  hdr.writeInt32LE(size, 4);
  hdr.writeInt32LE(size * 2, 8); // XOR + AND 两倍高
  hdr.writeUInt16LE(1, 12);
  hdr.writeUInt16LE(32, 14);
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const s = ((size - 1 - y) * size + x) * 4; // 自底向上
      const d = (y * size + x) * 4;
      px[d] = rgba[s + 2]; // BGRA
      px[d + 1] = rgba[s + 1];
      px[d + 2] = rgba[s];
      px[d + 3] = rgba[s + 3];
    }
  return Buffer.concat([hdr, px, Buffer.alloc(Math.ceil(size / 32) * 4 * size)]); // AND 掩码
}

function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let off = 6 + 16 * images.length;
  const entries = images.map(([size, buf]) => {
    const e = Buffer.alloc(16);
    e[0] = size === 256 ? 0 : size;
    e[1] = size === 256 ? 0 : size;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(off, 12);
    off += buf.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map(([, b]) => b)]);
}

// ---- 输出 ----
mkdirSync(appDir, { recursive: true });
const line = "M" + PTS.map((p) => p.join(" ")).join(" L ");
const tri = TRI.map((p) => p.join(" ")).join(" L ");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#${hex(C0)}"/><stop offset="1" stop-color="#${hex(C1)}"/></linearGradient></defs><rect width="64" height="64" rx="${R}" fill="url(#g)"/><path d="${line}" fill="none" stroke="#fff" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/><path d="M${tri} Z" fill="#fff"/></svg>\n`;

writeFileSync(join(appDir, "icon.svg"), svg);
writeFileSync(
  join(appDir, "favicon.ico"),
  ico([16, 32, 48].map((s) => [s, dib(s, render(s))])),
);
writeFileSync(join(appDir, "apple-icon.png"), png(180, render(180)));
console.log("已生成:src/app/{icon.svg, favicon.ico, apple-icon.png}");
