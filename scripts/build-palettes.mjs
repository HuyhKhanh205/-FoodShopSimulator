// Lấy mẫu bảng màu (texture 8×4 ô chuyển sắc) của từng nhân vật KayKit → src/assets/charPalettes.generated.ts.
// Lúc chạy game, bảng nhỏ này được tô lại màu áo / quần / tóc / da và dùng làm texture mới
// (không cần shader tự viết — chạy được trên mọi máy, kể cả Safari iPhone).
// Chạy: node scripts/build-palettes.mjs
import { NodeIO } from '@gltf-transform/core';
import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const COLS = 8;
const ROWS = 4;
/** Số mẫu theo chiều dọc mỗi ô. */
const SAMPLES = 32;
const io = new NodeIO();
const out = {};
for (const name of ['rogue', 'knight', 'mage', 'barbarian']) {
  const doc = await io.read(`assets/models/char_${name}.glb`);
  const tex = doc.getRoot().listTextures()[0];
  const png = PNG.sync.read(Buffer.from(tex.getImage()));
  const cw = png.width / COLS;
  const ch = png.height / ROWS;
  const bytes = Buffer.alloc(COLS * ROWS * SAMPLES * 3);
  for (let cy = 0; cy < ROWS; cy += 1) {
    for (let r = 0; r < SAMPLES; r += 1) {
      const py = Math.floor(cy * ch + ((r + 0.5) / SAMPLES) * ch);
      for (let cx = 0; cx < COLS; cx += 1) {
        // Cột bên trái của ô (tránh dải viền sáng / tối ở mép phải).
        const px = Math.floor(cx * cw + cw * 0.4);
        const i = (py * png.width + px) * 4;
        const o = ((cy * SAMPLES + r) * COLS + cx) * 3;
        bytes[o] = png.data[i];
        bytes[o + 1] = png.data[i + 1];
        bytes[o + 2] = png.data[i + 2];
      }
    }
  }
  out[name] = bytes.toString('base64');
}
const ts = `// Tự sinh bởi scripts/build-palettes.mjs — không sửa tay.
/** Bảng màu nhân vật KayKit: RGB, rộng ${COLS} (mỗi cột một ô), cao ${ROWS * SAMPLES} (${SAMPLES} dòng mỗi hàng ô). */
export const PALETTE_COLS = ${COLS};
export const PALETTE_ROWS = ${ROWS};
export const PALETTE_SAMPLES = ${SAMPLES};
export const CHAR_PALETTES: Record<string, string> = ${JSON.stringify(out, null, 2)};
`;
writeFileSync('src/assets/charPalettes.generated.ts', ts);
console.log('ok', Object.keys(out), ts.length);
