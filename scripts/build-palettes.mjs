// Lấy mẫu bảng màu (texture ô chuyển sắc) của nhân vật và đồ vật KayKit → src/assets/palettes.generated.ts.
// Lúc chạy game, các bảng nhỏ này thành DataTexture thay cho ảnh PNG trong file GLB (ảnh được bỏ đi khi nhúng):
// Safari iPhone trong khung Artifact không nạp được ảnh qua blob: URL nên đồ vật / nhân vật bị mất màu.
// Nhân vật còn được tô lại màu áo / quần / tóc / da trên chính bảng này.
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
// Đồ vật: lấy mẫu 64×128 điểm (giữa mỗi khối), khoá theo tên vật liệu.
const PW = 64;
const PH = 128;
const props = {};
const pdoc = await io.read('assets/models/props.glb');
for (const mat of pdoc.getRoot().listMaterials()) {
  const tex = mat.getBaseColorTexture();
  if (!tex) continue;
  const png = PNG.sync.read(Buffer.from(tex.getImage()));
  const bytes = Buffer.alloc(PW * PH * 3);
  for (let y = 0; y < PH; y += 1) {
    for (let x = 0; x < PW; x += 1) {
      const px = Math.floor(((x + 0.5) / PW) * png.width);
      const py = Math.floor(((y + 0.5) / PH) * png.height);
      const i = (py * png.width + px) * 4;
      const o = (y * PW + x) * 3;
      bytes[o] = png.data[i];
      bytes[o + 1] = png.data[i + 1];
      bytes[o + 2] = png.data[i + 2];
    }
  }
  props[mat.getName()] = bytes.toString('base64');
}

const ts = `// Tự sinh bởi scripts/build-palettes.mjs — không sửa tay.
/** Bảng màu nhân vật KayKit: RGB, rộng ${COLS} (mỗi cột một ô), cao ${ROWS * SAMPLES} (${SAMPLES} dòng mỗi hàng ô). */
export const PALETTE_COLS = ${COLS};
export const PALETTE_ROWS = ${ROWS};
export const PALETTE_SAMPLES = ${SAMPLES};
export const CHAR_PALETTES: Record<string, string> = ${JSON.stringify(out, null, 2)};

/** Bảng màu đồ vật (RGB ${PW}×${PH}) theo tên vật liệu trong props.glb. */
export const PROP_PALETTE_W = ${PW};
export const PROP_PALETTE_H = ${PH};
export const PROP_PALETTES: Record<string, string> = ${JSON.stringify(props, null, 2)};
`;
writeFileSync('src/assets/palettes.generated.ts', ts);
console.log('ok', Object.keys(out), Object.keys(props), ts.length);
