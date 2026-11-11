# Measured numbers, before and after

Generated 2026-11-11T18:13:23.834Z by tools/measure.mjs from the test output files. Before = commit f4e2acd (Nov 11, before this round of work).

| Metric | Before | After | Source | Note |
|---|---|---|---|---|
| First-screen code (HTML + CSS + own JS) | 102.7 KB (31.1 KB gzip) | 115.8 KB (34.3 KB gzip) | `evidence/size-report.json` | after includes the deferred screens.css and the new demo/print code; budget 150 KB |
| Lesson pack size: g5-fractions | 4.1 KB | 4.1 KB | `evidence/size-report.json` | minified JSON, unchanged content |
| Lesson pack size: g5-water-cycle | 4.2 KB | 4.2 KB | `evidence/size-report.json` | minified JSON, unchanged content |
| Lesson pack size: g4-english-sentence | 3.8 KB | 3.8 KB | `evidence/size-report.json` | minified JSON, unchanged content |
| QR codes to share g5-fractions | not measured | 6 codes for 4.1 KB | `evidence/e2e-qr-transfer.json` |  |
| QR codes to share g5-water-cycle | not measured | 7 codes for 4.2 KB | `evidence/e2e-qr-transfer.json` |  |
| QR codes to share g4-english-sentence | not measured | 6 codes for 3.8 KB | `evidence/e2e-qr-transfer.json` |  |
| QR transfer of the sample pack (camera scan to preview) | 4 codes, time not measured | 4 codes in 2.4 s | `evidence/e2e-qr-transfer.json` | fake camera feed showing each code for 0.6 s in a loop; a real hand-held phone camera is untested |
| Lesson data sent over the network to share a pack by QR | not measured | 0 bytes (0 server requests during the scan) | `evidence/e2e-qr-transfer.json` | requests seen while scanning: /vendor/jsQR.min.js (the app's own scanner file, answered by the service worker) |
| App requests that reached the network during the offline run | not measured | 0 (26 answered from the service worker cache) | `evidence/e2e-offline.json` | plus 1 browser service-worker update check for /sw.js, which Chromium's offline emulation does not block |
| Lighthouse Performance (mobile, simulated Regular 3G, 4x CPU) | 80 (LCP 4.6 s, test server sent files uncompressed) | 90 (LCP 3.4 s, median of 3, gzip like the host) | `evidence/lighthouse-summary.md` |  |
| Lighthouse Accessibility | 100 | 100 | `evidence/lighthouse-summary.md` |  |
