/*
 * Looks at the first bytes of an uploaded file and decides what it really is. The file name and the type the browser claims are
 * never trusted. Only formats that cannot carry script are accepted (no SVG). Dimensions are read from the file's own header, so
 * nothing is decoded. Pure functions: no framework, no storage; shared by the upload route and the verification script.
 */

export const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_SIDE = 12000; // pixels, either side
export const MAX_PIXELS = 100_000_000; // 100 megapixels: a guard against "decompression bombs"

export const ALLOWED = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" } as const;
export type AllowedMime = keyof typeof ALLOWED;

export type Sniffed = { mime: AllowedMime; ext: (typeof ALLOWED)[AllowedMime]; width: number; height: number };
export type SniffResult = { ok: true; image: Sniffed } | { ok: false; error: string };

const u16be = (b: Uint8Array, o: number) => (b[o]! << 8) | b[o + 1]!;
const u16le = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32be = (b: Uint8Array, o: number) => ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
const u32le = (b: Uint8Array, o: number) => (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;
const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));

function png(b: Uint8Array): [number, number] | null {
  if (b.length < 24 || ascii(b, 12, 4) !== "IHDR") return null;
  return [u32be(b, 16), u32be(b, 20)];
}

function gif(b: Uint8Array): [number, number] | null {
  return b.length < 10 ? null : [u16le(b, 6), u16le(b, 8)];
}

/** EXIF orientation 5–8 means the picture is shown turned by 90°, so width and height swap. */
function exifOrientation(b: Uint8Array, start: number, end: number): number {
  if (end - start < 14 || ascii(b, start, 4) !== "Exif") return 1;
  const t = start + 6; // TIFF header
  const le = ascii(b, t, 2) === "II";
  const r16 = (o: number) => (le ? u16le(b, o) : u16be(b, o));
  const r32 = (o: number) => (le ? u32le(b, o) : u32be(b, o));
  const ifd = t + r32(t + 4);
  if (ifd + 2 > end) return 1;
  const n = r16(ifd);
  for (let i = 0; i < n && ifd + 2 + i * 12 + 12 <= end; i++) {
    const e = ifd + 2 + i * 12;
    if (r16(e) === 0x0112) return r16(e + 8);
  }
  return 1;
}

function jpeg(b: Uint8Array): [number, number] | null {
  let o = 2;
  let orientation = 1;
  while (o + 4 < b.length) {
    if (b[o] !== 0xff) return null;
    const marker = b[o + 1]!;
    if (marker === 0xff) { o += 1; continue; } // padding
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { o += 2; continue; }
    const len = u16be(b, o + 2);
    if (len < 2) return null;
    if (marker === 0xe1) orientation = exifOrientation(b, o + 4, Math.min(o + 2 + len, b.length));
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (o + 9 > b.length) return null;
      const h = u16be(b, o + 5), w = u16be(b, o + 7);
      return orientation >= 5 && orientation <= 8 ? [h, w] : [w, h];
    }
    o += 2 + len;
  }
  return null;
}

function webp(b: Uint8Array): [number, number] | null {
  if (b.length < 25) return null;
  const kind = ascii(b, 12, 4);
  if (kind === "VP8 ") return b.length >= 30 && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a ? [u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff] : null;
  if (kind === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const v = u32le(b, 21);
    return [(v & 0x3fff) + 1, ((v >>> 14) & 0x3fff) + 1];
  }
  if (kind === "VP8X") return b.length < 30 ? null : [1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)), 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16))];
  return null;
}

/** AVIF is an ISO box file: the "ispe" box holds the picture size. Only the first 64 KB are searched. */
function avif(b: Uint8Array): [number, number] | null {
  const end = Math.min(b.length, 65536 + 16) - 16; // the box is 16 bytes: tag, version/flags, width, height
  for (let i = 8; i <= end; i++) {
    if (b[i] === 0x69 && b[i + 1] === 0x73 && b[i + 2] === 0x70 && b[i + 3] === 0x65) return [u32be(b, i + 8), u32be(b, i + 12)]; // "ispe", then version/flags, width, height
  }
  return null;
}

export function sniffImage(bytes: Uint8Array): SniffResult {
  if (bytes.length === 0) return { ok: false, error: "The file is empty." };
  const b = bytes;
  let mime: AllowedMime | null = null;
  let size: [number, number] | null = null;
  if (b.length > 8 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG" && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) { mime = "image/png"; size = png(b); }
  else if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) { mime = "image/jpeg"; size = jpeg(b); }
  else if (b.length > 6 && (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a")) { mime = "image/gif"; size = gif(b); }
  else if (b.length > 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") { mime = "image/webp"; size = webp(b); }
  else if (b.length > 12 && ascii(b, 4, 4) === "ftyp" && (ascii(b, 8, 4) === "avif" || ascii(b, 8, 4) === "avis")) { mime = "image/avif"; size = avif(b); }
  else {
    const head = ascii(b, 0, Math.min(b.length, 256)).trimStart().toLowerCase();
    if (head.startsWith("<svg") || head.startsWith("<?xml") || head.includes("<svg")) return { ok: false, error: "SVG files are not accepted (they can contain scripts). Export the picture as PNG, JPEG, WebP or AVIF." };
    return { ok: false, error: "This is not a supported picture. Use JPEG, PNG, WebP, GIF or AVIF." };
  }
  if (!size) return { ok: false, error: "The picture could not be read: the file looks damaged or incomplete." };
  const [width, height] = size;
  if (!width || !height) return { ok: false, error: "The picture has no size: the file looks damaged." };
  if (width > MAX_SIDE || height > MAX_SIDE) return { ok: false, error: `The picture is too large (${width}×${height}px). The longest side may be ${MAX_SIDE}px.` };
  if (width * height > MAX_PIXELS) return { ok: false, error: `The picture has too many pixels (${Math.round((width * height) / 1e6)} megapixels; the limit is ${MAX_PIXELS / 1e6}).` };
  return { ok: true, image: { mime, ext: ALLOWED[mime], width, height } };
}
