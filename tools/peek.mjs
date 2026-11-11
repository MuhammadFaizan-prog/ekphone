// Dev aid: quick screenshots to /tmp/peek-*.png. node peek.mjs [en|ur] [routes...]
import { launch, serve, newPhone, seed, asLearner, fontsReady } from './helpers.mjs';
const lang = process.argv[2] || 'en';
const routes = process.argv.slice(3).length ? process.argv.slice(3) : ['/', '/home', '/read/g5-fractions', '/share/g5-fractions'];
const { server, url } = await serve();
const b = await launch();
const { page, errors } = await newPhone(b);
await seed(page, url, { lang });
await asLearner(page, 'Ayesha');
for (const r of routes) {
  await asLearner(page, 'Ayesha');
  await page.goto(url + 'index.html#' + r);
  await page.waitForTimeout(500);
  await fontsReady(page);
  const f = '/workspace/work/peek-' + lang + '-' + r.replace(/\W+/g, '_') + '.png';
  await page.screenshot({ path: f, fullPage: process.env.FULL === '1' });
  console.log(f);
}
console.log('errors:', errors);
await b.close(); server.close();
