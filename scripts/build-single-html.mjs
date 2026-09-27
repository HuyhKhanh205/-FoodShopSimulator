/**
 * Gộp bản web đã export (`dist/`) thành một file HTML tự chứa: `dist/foodshop.html`.
 * Mở file này bằng bất kỳ trình duyệt nào (kể cả điện thoại) là chơi được, không cần máy chủ.
 *
 *   npm run build:html
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
let html = readFileSync(join(dist, 'index.html'), 'utf8');

// Nhúng các bundle JS vào thẳng trang.
html = html.replace(/<script src="\/([^"]+\.js)"[^>]*><\/script>/g, (_m, src) => {
  const code = readFileSync(join(dist, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script>${code}</script>`;
});
if (/<script src=/.test(html)) throw new Error('Vẫn còn script chưa nhúng được');

// Favicon dạng data URI.
const favicon = join(dist, 'favicon.ico');
html = html.replace(/<link rel="icon" href="\/favicon.ico"\s*\/?>/, () =>
  existsSync(favicon) ? `<link rel="icon" href="data:image/x-icon;base64,${readFileSync(favicon).toString('base64')}"/>` : ''
);

// Chuẩn cho điện thoại: không phóng to khi chạm đúp, nền cam trùng thanh trên của game.
html = html
  .replace(/<html lang="en">/, '<html lang="vi">')
  .replace(
    /<meta name="viewport"[^>]*>/,
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />'
  )
  .replace('</style>', '      body { background: #E65100; margin: 0; }\n    </style>');

const out = join(dist, 'foodshop.html');
writeFileSync(out, html);
console.log(`Đã tạo ${out} (${Math.round(html.length / 1024)} KB)`);
