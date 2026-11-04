#!/usr/bin/env node
/**
 * Renders the social preview image (public/og-image.jpg, 1200×630) from the site's own assets:
 * logo, the landing headline, last season's campaign photos and the festive branch.
 * `--square` renders the same card stacked for a square slot (public/og-square.jpg, 1080×1080),
 * e.g. a pop-up on a partner site or an Instagram post.
 *
 *   pnpm dev                                   # the web app must be running on :5173
 *   pnpm --filter @bless/web og:make           # or: node scripts/make-og.mjs --season 2027
 *   pnpm --filter @bless/web og:make -- --square
 *   … --square --scale 2 --out og-square@2x.jpg   # 2160×2160 for high-resolution screens
 *
 * Needs Playwright with Chromium (`npx playwright install chromium` on a fresh machine).
 * After regenerating, social sites cache old previews: re-scrape with the Facebook Sharing Debugger.
 */
import { chromium } from 'playwright';
import path from 'node:path';

const arg = (name, d) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : d; };
const season = arg('season', String(new Date().getFullYear()));
const base = arg('url', 'http://localhost:5173');
const square = process.argv.includes('--square');
const out = path.resolve(arg('out', square ? 'public/og-square.jpg' : 'public/og-image.jpg'));
const scale = Number(arg('scale', '1')) || 1;
const W = square ? 1080 : 1200;
const H = square ? 1080 : 630;

/** Wide: copy on the left, photos fanned on the right. Square: copy on top, photos fanned along the bottom. */
const layout = square
  ? {
      css: `
  body { width: 1080px; height: 1080px; background: radial-gradient(560px 460px at 20% 24%, rgba(201,184,255,.55), transparent 70%), radial-gradient(620px 520px at 78% 84%, rgba(155,107,255,.35), transparent 70%), #f6f3fb; }
  .brand { left: 72px; top: 64px; } .brand img { height: 66px; } .brand span { font-size: 22px; }
  .copy { left: 72px; top: 160px; width: 920px; }
  .pill { font-size: 18px; } .pill b { font-size: 16px; padding: 5px 14px; }
  h1 { font-size: 78px; margin-top: 24px; }
  p { font-size: 26px; max-width: 800px; margin-top: 20px; }
  .cta { margin-top: 26px; gap: 22px; } .btn { font-size: 22px; padding: 14px 14px 14px 30px; } .btn i { width: 42px; height: 42px; font-size: 21px; } .url { font-size: 21px; }
  .stage { left: 540px; top: 856px; } .card { width: 228px; }
  .branch { right: -90px; top: -90px; width: 450px; } .branch2 { display: none; }`,
      cards: [['gel-blaster', -324, 30, -11], ['magnetic-tiles', -108, 4, -4], ['basketball', 108, 14, 5], ['x-shot', 324, 34, 11]],
      half: [114, 162],
    }
  : { css: '', cards: [['gel-blaster', -175, -10, -14], ['magnetic-tiles', -60, -60, -4], ['basketball', 55, -20, 7], ['x-shot', 150, 30, 15]], half: [110, 140] };

const html = `
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; font-family: Poppins, sans-serif; color: #1d1133;
    background: radial-gradient(520px 420px at 18% 30%, rgba(201,184,255,.55), transparent 70%), radial-gradient(560px 460px at 82% 70%, rgba(155,107,255,.35), transparent 70%), #f6f3fb; position: relative; }
  .brand { position: absolute; left: 64px; top: 48px; display: flex; align-items: center; gap: 16px; }
  .brand img { height: 58px; }
  .brand .bar { width: 1.5px; height: 30px; background: #e6e0f2; }
  .brand span { font-weight: 700; font-size: 20px; letter-spacing: .04em; }
  .copy { position: absolute; left: 64px; top: 150px; width: 590px; }
  .pill { display: inline-flex; align-items: center; gap: 10px; border-radius: 999px; background: #fff; padding: 6px 16px 6px 6px; border: 1px solid #ece6f6; font-size: 15px; font-weight: 600; color: #4a3f66; }
  .pill b { background: #6c22dd; color: #fff; border-radius: 999px; padding: 4px 12px; font-size: 14px; letter-spacing: .04em; }
  h1 { margin-top: 22px; font-size: 58px; line-height: 1.0; font-weight: 800; letter-spacing: -.02em; text-transform: uppercase; }
  h1 em { font-style: normal; color: #6c22dd; }
  p { margin-top: 20px; font-size: 20px; line-height: 1.45; color: #4a3f66; max-width: 520px; }
  .cta { margin-top: 26px; display: flex; align-items: center; gap: 18px; }
  .btn { display: inline-flex; align-items: center; gap: 12px; background: #1d1133; color: #fff; border-radius: 999px; padding: 12px 12px 12px 26px; font-weight: 700; font-size: 18px; letter-spacing: .04em; }
  .btn i { width: 36px; height: 36px; border-radius: 50%; background: #fff; color: #1d1133; display: grid; place-items: center; font-style: normal; font-size: 18px; }
  .url { font-size: 16px; font-weight: 600; color: #6c22dd; }
  .stage { position: absolute; left: 905px; top: 330px; }
  .card { position: absolute; width: 220px; padding: 10px 10px 38px; background: #fff; border-radius: 18px; box-shadow: 0 30px 60px -26px rgba(29,17,51,.55); }
  .card img { display: block; width: 100%; aspect-ratio: 4/5; object-fit: cover; border-radius: 11px; }
  .branch { position: absolute; right: -70px; top: -60px; width: 400px; transform: scaleX(-1); opacity: .95; }
  .branch2 { position: absolute; left: -120px; bottom: -150px; width: 330px; transform: rotate(180deg) scaleX(-1); opacity: .5; filter: blur(2px); }
  .snow { position: absolute; border-radius: 50%; background: #fff; box-shadow: 0 0 6px rgba(255,255,255,.9); }
  ${layout.css}
</style>
<img class="branch2" src="/festive/branch.png" alt="">
<div class="brand"><img src="/brand/konnection-logo.png" alt=""><div class="bar"></div><span>BLESS-A-FAMILY</span></div>
<div class="copy">
  <div class="pill"><b>HOLIDAY ${season}</b>Detroit · The Konnection</div>
  <h1>Give a family the holiday <em>they've been hoping for.</em></h1>
  <p>Choose a Konnection family, shop the kids' wish lists, and we'll deliver your gifts.</p>
  <div class="cta"><span class="btn">FIND A FAMILY <i>→</i></span><span class="url">bless-a-family.thekonnection.org</span></div>
</div>
<div class="stage">
  ${layout.cards.map(([f, x, y, r], i) => `<div class="card" style="left:${x - layout.half[0]}px;top:${y - layout.half[1]}px;transform:rotate(${r}deg);z-index:${i}"><img src="/photos/campaign/${f}.webp" alt=""></div>`).join('')}
</div>
<img class="branch" src="/festive/branch.png" alt="">
${Array.from({ length: square ? 48 : 34 }, (_, i) => { const x = (i * 137) % W, y = (i * 211) % H, s = 2 + (i % 4); return `<span class="snow" style="left:${x}px;top:${y}px;width:${s}px;height:${s}px;opacity:${0.35 + (i % 5) * 0.12}"></span>`; }).join('')}
`;
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: scale })).newPage();
await p.addInitScript(() => { try { sessionStorage.setItem('baf-loaded', '1'); } catch { /* ignore */ } });
// Load a light page on the same origin so the site's Poppins font and /public assets resolve, then swap in the card.
await p.goto(`${base}/legal`);
await p.evaluate((h) => { document.head.querySelectorAll('style,link[rel=stylesheet]:not([href*="fonts.googleapis"])').forEach((n) => n.remove()); document.body.innerHTML = h; document.body.removeAttribute('class'); }, html);
await p.evaluate(() => document.fonts.ready);
await p.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
await p.screenshot({ path: out, type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: W, height: H } });
await b.close();
console.log(`Wrote ${out}`);
