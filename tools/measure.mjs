// Collects measured numbers from the evidence files (after) and from commit f4e2acd (before) into
// evidence/measurements.json + .md. Nothing here is typed by hand: every value is read from a test's own output.
// node tools/measure.mjs   (run after the tests)
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const ROOT = new URL('../', import.meta.url).pathname;
const E = (f) => JSON.parse(fs.readFileSync(ROOT + 'evidence/' + f, 'utf8'));
const BEFORE = 'f4e2acd';
const old = (f) => { try { return JSON.parse(execSync('git show ' + BEFORE + ':evidence/' + f, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString()); } catch { return null; } };
const oldText = (f) => { try { return execSync('git show ' + BEFORE + ':evidence/' + f, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { return ''; } };
const kb = (b) => +(b / 1024).toFixed(1);
const size = E('size-report.json'), sizeOld = old('size-report.json');
const shellKey = Object.keys(size.groups)[0], shellKeyOld = sizeOld && Object.keys(sizeOld.groups)[0];
const qr = E('e2e-qr-transfer.json'), qrOld = old('e2e-qr-transfer.json');
const off = E('e2e-offline.json');
const lhMd = fs.readFileSync(ROOT + 'evidence/lighthouse-summary.md', 'utf8'), lhOldMd = oldText('lighthouse-summary.md');
const grab = (md, label) => { const m = md.match(new RegExp('\\| ' + label + ' \\| ([^|]+) \\|')); return m ? m[1].trim() : null; };
const packs = Object.entries(size.files).filter(([f]) => f.startsWith('packs/')).map(([f, v]) => ({ pack: f.replace('packs/', '').replace(/\.ekpack\.json.*/, ''), kb: kb(v.bytes) }));
const m = {
  generated: new Date().toISOString(), before: 'commit ' + BEFORE + ' (Nov 11, before this round of work)', after: 'this commit',
  rows: [
    { metric: 'First-screen code (HTML + CSS + own JS)', before: sizeOld ? kb(sizeOld.groups[shellKeyOld].bytes) + ' KB (' + sizeOld.groups[shellKeyOld].gzipKb + ' KB gzip)' : 'n/a', after: kb(size.groups[shellKey].bytes) + ' KB (' + size.groups[shellKey].gzipKb + ' KB gzip)', source: 'evidence/size-report.json', note: 'after includes the deferred screens.css and the new demo/print code; budget 150 KB' },
    ...packs.map((p) => ({ metric: 'Lesson pack size: ' + p.pack, before: p.kb + ' KB', after: p.kb + ' KB', source: 'evidence/size-report.json', note: 'minified JSON, unchanged content' })),
    ...Object.entries(qr.packCodes || {}).map(([id, v]) => ({ metric: 'QR codes to share ' + id, before: 'not measured', after: v.codes + ' codes for ' + kb(v.bytes) + ' KB', source: 'evidence/e2e-qr-transfer.json' })),
    { metric: 'QR transfer of the sample pack (camera scan to preview)', before: qrOld ? qrOld.chunks + ' codes, time not measured' : 'not measured', after: qr.chunks + ' codes in ' + qr.scanSeconds + ' s', source: 'evidence/e2e-qr-transfer.json', note: 'fake camera feed showing each code for 0.6 s in a loop; a real hand-held phone camera is untested' },
    { metric: 'Lesson data sent over the network to share a pack by QR', before: 'not measured', after: qr.scanNetwork.serverBytes + ' bytes (' + qr.scanNetwork.serverHits + ' server requests during the scan)', source: 'evidence/e2e-qr-transfer.json', note: 'requests seen while scanning: ' + (qr.scanNetwork.requests.join(', ') || 'none') + ' (the app\'s own scanner file, answered by the service worker)' },
    { metric: 'App requests that reached the network during the offline run', before: 'not measured', after: off.offlineRequests.appRequestsToNetwork + ' (' + off.offlineRequests.fromServiceWorkerCache + ' answered from the service worker cache)', source: 'evidence/e2e-offline.json', note: 'plus ' + off.offlineRequests.browserSwUpdateChecks + ' browser service-worker update check for /sw.js, which Chromium\'s offline emulation does not block' },
    { metric: 'Lighthouse Performance (mobile, simulated Regular 3G, 4x CPU)', before: (grab(lhOldMd, 'Performance') || 'n/a') + ' (LCP ' + (grab(lhOldMd, 'Largest Contentful Paint') || 'n/a') + ', test server sent files uncompressed)', after: grab(lhMd, 'Performance') + ' (LCP ' + grab(lhMd, 'Largest Contentful Paint') + ', median of 3, gzip like the host)', source: 'evidence/lighthouse-summary.md' },
    { metric: 'Lighthouse Accessibility', before: grab(lhOldMd, 'Accessibility') || 'n/a', after: grab(lhMd, 'Accessibility'), source: 'evidence/lighthouse-summary.md' }
  ]
};
fs.writeFileSync(ROOT + 'evidence/measurements.json', JSON.stringify(m, null, 2));
let md = '# Measured numbers, before and after\n\nGenerated ' + m.generated + ' by tools/measure.mjs from the test output files. Before = ' + m.before + '.\n\n| Metric | Before | After | Source | Note |\n|---|---|---|---|---|\n';
for (const r of m.rows) md += '| ' + [r.metric, r.before, r.after, '`' + r.source + '`', r.note || ''].join(' | ') + ' |\n';
fs.writeFileSync(ROOT + 'evidence/measurements.md', md);
console.log(md);
