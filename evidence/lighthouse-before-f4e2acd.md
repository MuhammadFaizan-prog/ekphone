# Lighthouse summary — BEFORE (commit f4e2acd), re-measured with the same gzip test server and settings

Lighthouse 11.7.1 · 2026-11-11T18:13:36.643Z · URL http://127.0.0.1:PORT/index.html (local static server)
Emulation: mobile 360x740 · throttling: simulated Regular 3G (300 ms RTT, 700 Kbps) + 4x CPU slowdown (old-phone class)
Browser: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36

| Category | Score |
|---|---|
| Performance | 85 |
| Accessibility | 100 |
| Best practices | 100 |
| PWA | 100 |

| Metric | Value |
|---|---|
| First Contentful Paint | 2.4 s |
| Largest Contentful Paint | 3.8 s |
| Total Blocking Time | 0 ms |
| Cumulative Layout Shift | 0 |
| Speed Index | 2.4 s |
| Total byte weight | Total size was 92 KiB |
| Installable manifest | pass |
| Service worker | n/a |

PWA audits failing: none

Performance in each of 3 runs: 85 (LCP 3.8 s), 86 (LCP 3.8 s), 84 (LCP 3.8 s). The table shows the median run.

Notes: run on a cloud sandbox, not a real phone. The local test server gzip-compresses text files the way the Vercel host compresses them (before Nov 11 evening it sent them uncompressed, which is part of the old score of 80). The PWA category was removed in Lighthouse 12, so v11.7.1 is used.
