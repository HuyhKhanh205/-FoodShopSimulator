import { DataTexture, RGBAFormat, RepeatWrapping, SRGBColorSpace, Color, LinearMipmapLinearFilter, LinearFilter } from 'three';

/**
 * Texture sinh bằng mã (DataTexture) — chạy được cả trên web lẫn app, không cần file ảnh.
 * Được lưu đệm theo tham số để nhiều vật dùng chung một texture.
 */
const cache = new Map<string, DataTexture>();

function make(key: string, size: number, paint: (x: number, y: number) => [number, number, number]) {
  const hit = cache.get(key);
  if (hit) return hit;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = paint(x, y);
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
};

/** Nhiễu giả ngẫu nhiên ổn định theo toạ độ. */
function noise(x: number, y: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

const shade = (c: [number, number, number], k: number): [number, number, number] => [
  Math.max(0, Math.min(255, c[0] * k)),
  Math.max(0, Math.min(255, c[1] * k)),
  Math.max(0, Math.min(255, c[2] * k)),
];

/** Gạch men caro 2×2 ô trong một texture, có ron và bóng nhẹ. Lặp 1 lần mỗi 2 ô lưới. */
export function checkerTileTexture(a: string, b: string, grout = '#9EA7AA') {
  const size = 128;
  const A = rgb(a);
  const B = rgb(b);
  const G = rgb(grout);
  return make(`checker:${a}:${b}:${grout}`, size, (x, y) => {
    const cell = size / 2;
    const gx = x % cell;
    const gy = y % cell;
    if (gx < 2 || gy < 2) return G;
    const base = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0 ? A : B;
    // Ánh sáng loang nhẹ trên mặt gạch
    const k = 0.96 + 0.06 * (1 - (gx + gy) / (cell * 2)) + (noise(x, y) - 0.5) * 0.03;
    return shade(base, k);
  });
}

/** Sàn gỗ ván dài có vân. Một texture = 4 ván theo chiều ngang. */
export function woodTexture(base = '#C8914F') {
  const size = 128;
  const C = rgb(base);
  return make(`wood:${base}`, size, (x, y) => {
    const plank = Math.floor(y / (size / 4));
    const py = y % (size / 4);
    if (py < 1) return shade(C, 0.62);
    // Mối nối ván lệch nhau theo từng hàng
    const joint = (x + plank * 37) % size;
    if (joint < 1) return shade(C, 0.7);
    const grain = Math.sin((x + plank * 17) * 0.09 + Math.sin(py * 0.6 + plank) * 2.2) * 0.07;
    const tone = 0.9 + (plank % 2) * 0.06 + grain + (noise(x, y) - 0.5) * 0.05;
    return shade(C, tone);
  });
}

/** Tường ốp gạch thẻ (subway tile). */
export function wallTileTexture(base = '#E0F2F1', grout = '#B0BEC5') {
  const size = 128;
  const C = rgb(base);
  const G = rgb(grout);
  return make(`wall:${base}:${grout}`, size, (x, y) => {
    const rowH = size / 4;
    const row = Math.floor(y / rowH);
    const ox = (x + (row % 2) * (size / 4)) % (size / 2);
    if (y % rowH < 2 || ox < 2) return G;
    return shade(C, 0.97 + (noise(x, y) - 0.5) * 0.04 + (1 - (y % rowH) / rowH) * 0.05);
  });
}
