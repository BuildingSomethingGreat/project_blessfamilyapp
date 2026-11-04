#!/usr/bin/env node
/**
 * Renders the social preview image (public/og-image.jpg, 1200×630) from the site's own assets:
 * logo, the landing headline, last season's campaign photos and the festive branch.
 *
 *   pnpm dev                                   # the web app must be running on :5173
 *   pnpm --filter @bless/web og:make           # or: node scripts/make-og.mjs --season 2027
 *
 * Needs Playwright with Chromium (`npx playwright install chromium` on a fresh machine).
 * After regenerating, social sites cache old previews: re-scrape with the Facebook Sharing Debugger.
 */
import { chromium } from 'playwright';
import path from 'node:path';

const arg = (name, d) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : d; };
const season = arg('season', String(new Date().getFullYear()));
const base = arg('url', 'http://localhost:5173');
const out = path.resolve(arg('out', 'public/og-image.jpg'));

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
  ${[['gel-blaster', -175, -10, -14], ['magnetic-tiles', -60, -60, -4], ['basketball', 55, -20, 7], ['x-shot', 150, 30, 15]].map(([f, x, y, r], i) => `<div class="card" style="left:${x - 110}px;top:${y - 140}px;transform:rotate(${r}deg);z-index:${i}"><img src="/photos/campaign/${f}.webp" alt=""></div>`).join('')}
</div>
<img class="branch" src="/festive/branch.png" alt="">
${Array.from({ length: 34 }, (_, i) => { const x = (i * 137) % 1200, y = (i * 211) % 630, s = 2 + (i % 4); return `<span class="snow" style="left:${x}px;top:${y}px;width:${s}px;height:${s}px;opacity:${0.35 + (i % 5) * 0.12}"></span>`; }).join('')}
`;
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
await p.addInitScript(() => { try { sessionStorage.setItem('baf-loaded', '1'); } catch { /* ignore */ } });
// Load a light page on the same origin so the site's Poppins font and /public assets resolve, then swap in the card.
await p.goto(`${base}/legal`);
await p.evaluate((h) => { document.head.querySelectorAll('style,link[rel=stylesheet]:not([href*="fonts.googleapis"])').forEach((n) => n.remove()); document.body.innerHTML = h; document.body.removeAttribute('class'); }, html);
await p.evaluate(() => document.fonts.ready);
await p.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
await p.screenshot({ path: out, type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await b.close();
console.log(`Wrote ${out}`);
