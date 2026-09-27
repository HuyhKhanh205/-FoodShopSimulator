/**
 * Nhúng các file assets/models/*.glb vào mã nguồn (base64) để bản web một file và app
 * không cần tải thêm gì. Chạy lại sau `node scripts/build-models.mjs`.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';

// Bỏ ảnh texture khỏi GLB (giữ UV): game dùng bảng màu trong src/assets/palettes.generated.ts
// (chạy `node scripts/build-palettes.mjs` trước). Ảnh trong GLB được nạp qua blob: URL — Safari iPhone
// trong khung Artifact không nạp được nên đồ vật bị mất màu.
const io = new NodeIO();

const dir = join(process.cwd(), 'assets/models');
const out = join(process.cwd(), 'src/assets/models.generated.ts');
mkdirSync(join(process.cwd(), 'src/assets'), { recursive: true });
const files = readdirSync(dir).filter((f) => f.endsWith('.glb')).sort();
let src = '/* eslint-disable */\n// Tự sinh bởi scripts/embed-models.mjs — không sửa tay. Mô hình KayKit (CC0) — xem assets/models/LICENSE.md\n\n';
src += `export const PROP_BOUNDS: Record<string, { min: number[]; max: number[] }> = ${readFileSync(join(dir, 'props.json'), 'utf8')};\n\n`;
src += 'export const MODEL_DATA: Record<string, string> = {\n';
let total = 0;
for (const f of files) {
  const doc = await io.read(join(dir, f));
  for (const t of doc.getRoot().listTextures()) t.dispose();
  const b64 = Buffer.from(await io.writeBinary(doc)).toString('base64');
  total += b64.length;
  src += `  ${JSON.stringify(f.replace('.glb', ''))}: ${JSON.stringify(b64)},\n`;
}
src += '};\n';
writeFileSync(out, src);
console.log(`Đã nhúng ${files.length} mô hình (${Math.round(total / 1024)} KB base64) vào ${out}`);
