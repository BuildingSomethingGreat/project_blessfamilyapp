import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
// Brand mark: Konnection purple tile with a lavender "K" chevron + heart dot.
const svg = (pad = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#6c22dd"/>
  <g transform="translate(${pad},${pad}) scale(${(512 - 2 * pad) / 512})">
    <path d="M150 120h58v110l118-110h78L270 250l140 142h-80L208 282v110h-58z" fill="#f6f3fb"/>
    <circle cx="392" cy="130" r="30" fill="#c9b8ff"/>
  </g>
</svg>`;
await mkdir('public/icons', { recursive: true });
await writeFile('public/icons/favicon.svg', svg());
for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-maskable-512.png', 512, 64], ['apple-touch-icon.png', 180, 0]]) {
  await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(`public/icons/${name}`);
}
console.log('icons written');
