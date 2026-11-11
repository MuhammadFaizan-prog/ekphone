// Lighthouse 11 (has the PWA category) on the home screen, mobile emulation + Regular-3G simulated throttling.
// node lighthouse.mjs  -> ../evidence/lighthouse.json + lighthouse-summary.md
import fs from 'node:fs';
import lighthouse from 'lighthouse';
import { launch } from './pw.mjs';
import { serve } from './serve.mjs';
const evid = new URL('../evidence/', import.meta.url).pathname;
const { server, url } = await serve(0);
const port = 9333;
const b = await launch({ args: ['--remote-debugging-port=' + port] });
const THROTTLE = { rttMs: 300, throughputKbps: 700, requestLatencyMs: 300 * 3.75, downloadThroughputKbps: 700 * 0.9, uploadThroughputKbps: 700 * 0.9, cpuSlowdownMultiplier: 4 };
const config = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'mobile', throttlingMethod: 'simulate', throttling: THROTTLE,
    screenEmulation: { mobile: true, width: 360, height: 740, deviceScaleFactor: 2.625, disabled: false },
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'pwa'],
  },
};
try {
  const target = url + 'index.html';
  const r = await lighthouse(target, { port, output: 'json', logLevel: 'error' }, config);
  const lhr = r.lhr;
  fs.writeFileSync(evid + 'lighthouse.json', r.report);
  const cats = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, v.score == null ? null : Math.round(v.score * 100)]));
  const a = lhr.audits;
  const pick = (id) => a[id] ? (a[id].displayValue || (a[id].score === 1 ? 'pass' : a[id].score === 0 ? 'fail' : String(a[id].score))) : 'n/a';
  const failedPwa = lhr.categories.pwa ? lhr.categories.pwa.auditRefs.map((x) => a[x.id]).filter((x) => x && x.score === 0).map((x) => x.id) : [];
  const md = `# Lighthouse summary

Lighthouse ${lhr.lighthouseVersion} · ${lhr.fetchTime} · URL ${target.replace(/:\d+/, ':PORT')} (local static server)
Emulation: mobile 360x740 · throttling: simulated Regular 3G (300 ms RTT, 700 Kbps) + 4x CPU slowdown (old-phone class)
Browser: ${lhr.environment.hostUserAgent}

| Category | Score |
|---|---|
| Performance | ${cats.performance} |
| Accessibility | ${cats.accessibility} |
| Best practices | ${cats['best-practices']} |
| PWA | ${cats.pwa ?? 'n/a'} |

| Metric | Value |
|---|---|
| First Contentful Paint | ${pick('first-contentful-paint')} |
| Largest Contentful Paint | ${pick('largest-contentful-paint')} |
| Total Blocking Time | ${pick('total-blocking-time')} |
| Cumulative Layout Shift | ${pick('cumulative-layout-shift')} |
| Speed Index | ${pick('speed-index')} |
| Total byte weight | ${pick('total-byte-weight')} |
| Installable manifest | ${pick('installable-manifest')} |
| Service worker | ${pick('service-worker')} |

PWA audits failing: ${failedPwa.length ? failedPwa.join(', ') : 'none'}

Notes: run on a cloud sandbox, not a real phone. The PWA category was removed in Lighthouse 12, so v11.7.1 is used.
`;
  fs.writeFileSync(evid + 'lighthouse-summary.md', md);
  console.log(md);
} finally { await b.close(); server.close(); }
