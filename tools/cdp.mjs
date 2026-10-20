// Mini Chrome DevTools Protocol client for headless Edge: screenshots, screencast, PDF printing.
// No dependencies: Node 22+ (global fetch and WebSocket) and Edge, present on any Windows 10/11.
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function edgePath() {
  const out = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe" /ve').toString();
  return out.match(/REG_SZ\s+(.+)/)[1].trim();
}

export async function openBrowser({ width = 1920, height = 1080, port = 9333, args = [] } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'hp-edge-'));
  const proc = spawn(edgePath(), [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--hide-scrollbars', `--window-size=${width},${height}`, ...args, 'about:blank',
  ], { stdio: 'ignore' });

  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); }
    catch { await sleep(200); }
  }
  if (!target) throw new Error('Edge не запустился');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let seq = 0;
  const pending = new Map();
  const waiters = [];
  const listeners = [];
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      for (const l of listeners) if (l.method === msg.method) l.fn(msg.params);
      for (const w of [...waiters]) if (w.method === msg.method) { waiters.splice(waiters.indexOf(w), 1); w.resolve(msg.params); }
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const once = (method) => new Promise((resolve) => waiters.push({ method, resolve }));

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

  const api = {
    send,
    on(method, fn) { listeners.push({ method, fn }); },
    async goto(url, settle = 1500) {
      const loaded = once('Page.loadEventFired');
      await send('Page.navigate', { url });
      await loaded;
      await sleep(settle);
    },
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    },
    async screenshot(file) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(file, Buffer.from(data, 'base64'));
    },
    async pdf(file, options = {}) {
      const { data } = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, ...options });
      writeFileSync(file, Buffer.from(data, 'base64'));
    },
    async close() {
      try { await send('Browser.close'); } catch { /* уже закрыт */ }
      ws.close();
      await sleep(500);
      proc.kill();
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* Edge ещё держит файлы */ }
    },
  };
  return api;
}
