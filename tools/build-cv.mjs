// CV: cv/cv.html → cv/Artem-Sydorenko-CV.pdf (A4, one page) via headless Edge.
// node tools/build-cv.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openBrowser } from './cdp.mjs';

const cv = join(dirname(fileURLToPath(import.meta.url)), '..', 'cv');
const b = await openBrowser({ width: 794, height: 1123, port: 9336 });
try {
  await b.goto(pathToFileURL(join(cv, 'cv.html')).href, 800);
  await b.eval('document.fonts.ready.then(() => true)');
  const fit = await b.eval(`(() => { const p = document.querySelector(".page").getBoundingClientRect().bottom;
    const over = (s) => Math.max(...[...document.querySelectorAll(s + " > *")].map((e) => e.getBoundingClientRect().bottom)) - p;
    return { main: over("main"), aside: over("aside") }; })()`);
  if (fit.main > -20 || fit.aside > -20) console.warn('⚠ Content overflows the page:', fit);
  await b.pdf(join(cv, 'Artem-Sydorenko-CV.pdf'));
} finally {
  await b.close();
}
console.log('✓ cv/Artem-Sydorenko-CV.pdf');
