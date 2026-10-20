// Phone screenshots of HookahPOS (390×844 @2x, English UI) → assets/shots/m-*.png.
// node tools/capture-mobile.mjs [http://localhost:5090]
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from './cdp.mjs';

const base = process.argv[2] ?? 'http://localhost:5090';
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await openBrowser({ width: 390, height: 844, port: 9335 });
await b.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
const shot = async (name) => { await b.screenshot(join(outDir, `m-${name}.png`)); console.log('  ✓', name); };
const go = async (path, settle = 1800) => {
  await b.eval(`history.pushState({}, '', '${path}'); dispatchEvent(new PopStateEvent('popstate')); true`);
  await sleep(settle);
};

try {
  await b.goto(`${base}/login`);
  await b.eval(`localStorage.setItem('hp.lang', 'en'); sessionStorage.clear(); true`);
  await b.goto(`${base}/login`, 2000);
  await shot('login');

  const demo = await b.eval(`(async () => {
    const staff = await (await fetch('/api/auth/staff')).json();
    const login = await (await fetch('/api/auth/pin-login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: staff.find(s => s.role === 'Admin').id, pin: '1111' }) })).json();
    sessionStorage.setItem('hp.session', JSON.stringify(login));
    const H = { Authorization: 'Bearer ' + login.token, 'Content-Type': 'application/json', 'Accept-Language': 'en' };
    const zones = await (await fetch('/api/zones', { headers: H })).json();
    const floor = await (await fetch('/api/zones/' + zones[0].id + '/floor', { headers: H })).json();
    const free = floor.tables.filter(t => t.status === 'Free' && !t.reservation);
    const order = await (await fetch('/api/orders', { method: 'POST', headers: H, body: JSON.stringify({ tableId: free[0].id }) })).json();
    const menu = await (await fetch('/api/menu', { headers: H })).json();
    const items = menu.categories.flatMap(c => c.items);
    const add = (name, comment) => fetch('/api/orders/' + order.id + '/items', { method: 'POST', headers: H,
      body: JSON.stringify({ menuItemId: items.find(i => i.name === name).id, comment }) });
    await add('Fajka specjalna', 'mango, mięta'); await add('Mojito'); await add('Espresso Martini');
    return { zone: zones[0].id, order: order.id };
  })()`);
  await b.goto(`${base}/app/floor`, 2000);
  await go(`/app/floor/${demo.zone}`);
  await shot('floor');
  await go(`/app/orders/${demo.order}`);
  await shot('order');
  await go('/app/analytics', 2500);
  await shot('analytics');

  // Cleanup: pay and close the demo order, as the presentation script does.
  await b.eval(`(async () => {
    const H = { Authorization: 'Bearer ' + JSON.parse(sessionStorage.getItem('hp.session')).token, 'Content-Type': 'application/json' };
    await fetch('/api/orders/${demo.order}/send', { method: 'POST', headers: H });
    await fetch('/api/orders/${demo.order}/pay', { method: 'POST', headers: H, body: JSON.stringify({ method: 'Cash' }) });
    await fetch('/api/orders/${demo.order}/close', { method: 'POST', headers: H });
    return true;
  })()`);
} finally {
  await b.close();
}
