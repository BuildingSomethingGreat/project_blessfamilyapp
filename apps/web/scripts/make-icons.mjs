import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const svg = (pad = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#e4572e"/>
  <g transform="translate(${pad},${pad}) scale(${(512 - 2 * pad) / 512})">
    <path d="M256 416c-6 0-12-2-16-6l-96-88c-38-35-56-62-56-100 0-44 34-78 78-78 26 0 50 12 66 32 16-20 40-32 66-32 44 0 78 34 78 78 0 38-18 65-56 100l-96 88c-4 4-10 6-16 6z" fill="#f6f1e9"/>
    <circle cx="256" cy="150" r="22" fill="#e8b04b"/>
  </g>
</svg>`;
await mkdir('public/icons', { recursive: true });
await writeFile('public/icons/favicon.svg', svg());
for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-maskable-512.png', 512, 64], ['apple-touch-icon.png', 180, 0]]) {
  await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(`public/icons/${name}`);
}
console.log('icons written');
