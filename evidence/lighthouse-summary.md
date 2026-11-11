# Lighthouse summary

Lighthouse 11.7.1 · 2026-11-11T18:00:48.253Z · URL http://127.0.0.1:PORT/index.html (local static server)
Emulation: mobile 360x740 · throttling: simulated Regular 3G (300 ms RTT, 700 Kbps) + 4x CPU slowdown (old-phone class)
Browser: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36

| Category | Score |
|---|---|
| Performance | 87 |
| Accessibility | 100 |
| Best practices | 100 |
| PWA | 100 |

| Metric | Value |
|---|---|
| First Contentful Paint | 2.1 s |
| Largest Contentful Paint | 3.8 s |
| Total Blocking Time | 10 ms |
| Cumulative Layout Shift | 0 |
| Speed Index | 2.1 s |
| Total byte weight | Total size was 97 KiB |
| Installable manifest | pass |
| Service worker | n/a |

PWA audits failing: none

Notes: run on a cloud sandbox, not a real phone. The local test server gzip-compresses text files the way the Vercel host compresses them (before Nov 11 evening it sent them uncompressed, which is part of the old score of 80). The PWA category was removed in Lighthouse 12, so v11.7.1 is used.
