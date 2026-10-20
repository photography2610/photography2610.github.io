// Records the HookahPOS demo video for the portfolio: real taps in headless Edge, a visible touch cursor,
// captions per step → assets/hookahpos-demo.mp4. Needs the Polish demo running (HookahPOS Demo, :5090).
// node tools/record.mjs [http://localhost:5090]
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { openBrowser } from './cdp.mjs';

const base = process.argv[2] ?? 'http://localhost:5090';
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'assets', 'hookahpos-demo.mp4');
const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
const framesDir = join(tmpdir(), `hp-frames-${Date.now()}`);
mkdirSync(framesDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Overlays: touch cursor, caption pill, full-screen title cards. Installed on every document.
const overlay = `(() => {
  if (window.__ov) return;
  const css = document.createElement('style');
  css.textContent = \`
    #__cur { position: fixed; z-index: 2147483647; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
      background: rgba(255,255,255,.28); border: 3px solid rgba(255,255,255,.9); box-shadow: 0 4px 18px rgba(0,0,0,.45);
      pointer-events: none; left: 960px; top: 1180px; transition: left .55s cubic-bezier(.4,0,.2,1), top .55s cubic-bezier(.4,0,.2,1), transform .12s; }
    #__cur.down { transform: scale(.78); background: rgba(201,162,39,.55); }
    .__rip { position: fixed; z-index: 2147483646; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
      border: 3px solid rgba(201,162,39,.9); pointer-events: none; animation: __rip .6s ease-out forwards; }
    @keyframes __rip { to { transform: scale(2.6); opacity: 0; } }
    #__cap { position: fixed; z-index: 2147483645; left: 50%; bottom: 46px; transform: translate(-50%, 20px); opacity: 0;
      padding: 18px 34px; border-radius: 999px; background: rgba(8,12,28,.92); border: 1px solid rgba(201,162,39,.55);
      color: #eef1f8; font: 600 30px Manrope, sans-serif; letter-spacing: .01em; pointer-events: none; white-space: nowrap;
      box-shadow: 0 10px 40px rgba(0,0,0,.5); transition: opacity .35s, transform .35s; }
    #__cap.on { opacity: 1; transform: translate(-50%, 0); }
    #__cap b { color: #c9a227; font-weight: 800; margin-right: 14px; }
    #__card { position: fixed; inset: 0; z-index: 2147483644; display: flex; flex-direction: column; align-items: center;
      justify-content: center; text-align: center; gap: 26px; color: #eef1f8; pointer-events: none; opacity: 0; transition: opacity .6s;
      background: radial-gradient(120% 90% at 20% 0%, #1b2a55 0%, #0f1730 50%, #0a1122 100%); font-family: Manrope, sans-serif; }
    #__card.on { opacity: 1; }
    #__card h1 { font: 700 104px Unbounded, sans-serif; letter-spacing: -.01em; margin: 0; }
    #__card p { font-size: 36px; color: #b9c0dc; margin: 0; }
    #__card .k { color: #c9a227; font-weight: 800; font-size: 24px; letter-spacing: .2em; text-transform: uppercase; }
    #__card .chips { display: flex; gap: 14px; margin-top: 12px; }
    #__card .chips span { padding: 10px 22px; border-radius: 999px; border: 1px solid rgba(255,255,255,.16);
      background: rgba(255,255,255,.05); font-size: 24px; font-weight: 600; color: #b9c0dc; }\`;
  const add = () => {
    document.head.appendChild(css);
    for (const id of ['__cur', '__cap', '__card']) { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); }
  };
  document.body ? add() : addEventListener('DOMContentLoaded', add);
  window.__ov = {
    move(x, y) { const c = document.getElementById('__cur'); c.style.left = x + 'px'; c.style.top = y + 'px'; },
    down(on) { document.getElementById('__cur').classList.toggle('down', on); },
    ripple(x, y) { const r = document.createElement('div'); r.className = '__rip'; r.style.left = x + 'px'; r.style.top = y + 'px';
      document.body.appendChild(r); setTimeout(() => r.remove(), 700); },
    cap(n, text) { const c = document.getElementById('__cap'); if (!text) { c.classList.remove('on'); return; }
      c.innerHTML = '<b>' + n + '</b>' + text; c.classList.add('on'); },
    card(html) { const c = document.getElementById('__card'); if (html) c.innerHTML = html; c.classList.toggle('on', !!html); },
  };
})()`;

const b = await openBrowser({ port: 9334 });
const frames = [];
let t0 = 0;
b.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
  const file = join(framesDir, `f${String(frames.length).padStart(5, '0')}.jpg`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  frames.push({ file, ts: metadata.timestamp });
  b.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});

// Element center by a JS expression evaluated in the page (must return an Element).
const center = (expr) => b.eval(`(() => { const e = (${expr}); if (!e) return null; e.scrollIntoView({ block: 'nearest' });
  const r = e.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
const nav = (text) => `[...document.querySelectorAll('nav a, aside a, a')].find(a => a.textContent.trim() === ${JSON.stringify(text)})`;
const btn = (text, starts = false) => `[...document.querySelectorAll('button')].find(b => ${starts
  ? `b.textContent.trim().startsWith(${JSON.stringify(text)})` : `b.textContent.trim() === ${JSON.stringify(text)}`})`;

async function tapAt(p, pause = 450) {
  await b.eval(`__ov.move(${p.x}, ${p.y})`);
  await sleep(600);
  const ev = (type) => b.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await ev('mouseMoved');
  await b.eval('__ov.down(true)');
  await ev('mousePressed');
  await sleep(90);
  await ev('mouseReleased');
  await b.eval(`__ov.down(false); __ov.ripple(${p.x}, ${p.y})`);
  await sleep(pause);
}
async function tap(expr, pause) {
  const p = await center(expr);
  if (!p) throw new Error('Not found: ' + expr);
  await tapAt(p, pause);
}
const cap = (n, text) => b.eval(`__ov.cap(${JSON.stringify(n)}, ${JSON.stringify(text ?? '')})`);
const card = (html) => b.eval(`__ov.card(${JSON.stringify(html ?? '')})`);
const fastCursor = (on) => b.eval(`document.getElementById('__cur').style.transitionDuration = '${on ? '.22s' : ''}'`);

try {
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: overlay });
  await b.goto(`${base}/login`);
  await b.eval(`localStorage.setItem('hp.lang', 'en'); sessionStorage.clear(); true`);
  await b.goto(`${base}/login`, 2500);
  await card(`<div class="k">Portfolio project</div><h1>HookahPOS</h1><p>Point-of-sale system for hookah lounges</p>
    <div class="chips"><span>React 19</span><span>TypeScript</span><span>ASP.NET Core 10</span><span>EF Core</span><span>PostgreSQL 17</span></div>`);
  await sleep(300);

  await b.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  t0 = Date.now();
  await sleep(3800);
  await card(null);
  await sleep(900);

  // 1. Login by PIN
  await cap('01', 'Staff sign in with a personal 4-digit PIN');
  await tap(btn('Admin'));
  await tap(btn('M.N'));
  await fastCursor(true);
  for (const d of '1111') await tap(btn(d), 200);
  await fastCursor(false);
  await sleep(900);
  if (await b.eval(`location.pathname === '/login'`)) await tap(btn('Log in'), 1500);
  await sleep(1200);

  // 2. Floor plan
  await cap('02', 'Live floor plan — every table’s status at a glance');
  await tap(`[...document.querySelectorAll('a')].find(a => a.textContent.trim().startsWith('Hall'))`, 1800);
  await sleep(1200);
  await cap('03', 'Tap a free table to open an order');
  await tap(`[...document.querySelectorAll('div')].filter(d => /tileWrap/.test(d.className) && d.textContent.includes('Free'))
    .map(d => d.querySelector('button')).find(Boolean)`, 1600);

  // 3. Order
  await cap('04', 'Build the order — the menu is in Polish, as entered by the owner');
  await tap(btn('Na owocowej czaszy', true), 700);
  await tap(btn('Hookah master', true), 700);
  await tap(btn('Tomasz', true), 700);
  await cap('05', 'Notes for the hookah master on a touch keyboard');
  await tap(btn('+ add comment'), 700);
  await tap(btn('PL'), 300);
  await fastCursor(true);
  for (const ch of 'mango, mięta') await tap(ch === ' ' ? btn('space') : btn(ch), 120);
  await fastCursor(false);
  await sleep(500);
  await tap(btn('done'), 700);
  await cap('06', 'Drinks and snacks — categories and subcategories');
  await tap(btn('Alkohol'), 600);
  await tap(btn('Mojito', true), 400);
  await tap(btn('Mojito', true), 500);
  await tap(btn('Przekąski'), 600);
  await tap(btn('Nachos', true), 900);
  await cap('07', 'Send to the hookah master and the bar');
  await tap(btn('Send to hookah/bar'), 1600);

  // 4. Payment
  await cap('08', 'Payment — the server calculates every total');
  await tap(btn('To payment →'), 1800);
  await tap(btn('Card'), 700);
  await tap(btn('Confirm payment'), 1800);
  await tap(btn('Release table'), 2000);

  // 5. Back office
  await cap('09', 'Revenue analytics by business day, week and month');
  await tap(nav('Analytics'), 1500);
  await tap(btn('Month'), 2800);
  await cap('10', 'Inventory — recipes write off stock automatically');
  await tap(nav('Stock'), 3200);
  await cap('11', 'Menu with recipes, prices and categories');
  await tap(nav('Menu'), 3000);
  await cap('12', 'Staff, roles and permissions — enforced on the server');
  await tap(nav('Staff'), 3000);
  await cap(null);
  await b.eval(`__ov.move(960, 1180)`);

  await card(`<div class="k">Built by</div><h1 style="font-size:88px">Artem Sydorenko</h1><p>Full Stack Developer · Gdańsk, Poland</p>
    <div class="chips"><span>github.com/photography2610</span><span>sidorenkoartem555@gmail.com</span></div>`);
  await sleep(4200);
  await b.send('Page.stopScreencast');
  await sleep(300);
} finally {
  await b.close();
}

// Variable-rate frames → constant 30 fps H.264 (concat demuxer with per-frame durations).
const list = frames.map((f, i) => {
  const next = frames[i + 1]?.ts ?? f.ts + 1;
  return `file '${f.file.replace(/\\/g, '/')}'\nduration ${Math.max(0.001, next - f.ts).toFixed(4)}`;
}).join('\n') + `\nfile '${frames.at(-1).file.replace(/\\/g, '/')}'\n`;
const listFile = join(framesDir, 'list.txt');
writeFileSync(listFile, list);
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
  '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-movflags', '+faststart', out], { stdio: 'inherit' });
rmSync(framesDir, { recursive: true, force: true });
console.log(`${frames.length} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s → ${out}`);
