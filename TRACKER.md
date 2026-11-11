# Tracker

Build window: Oct 17 to Nov 20, 2026 (Devpost). All work below was done on Nov 11, 2026.

| Item | Status | Proof |
|---|---|---|
| Profiles, optional PIN (salted SHA-256, 30 s lockout after 5 wrong) | Done | `evidence/unit-tests.txt` |
| Reader: arrow-key highlighter, live region, read-aloud sync | Done (read-aloud with a fake speech engine only) | `evidence/e2e-flow.json` |
| 5-question quiz, feedback, per-child scores | Done | `evidence/e2e-flow.json` |
| EN / UR toggle, RTL, lazy Nastaliq | Done | `evidence/axe-ur-*.json` |
| Chunked QR / file / paste sharing, size before loading | Done | `evidence/e2e-qr-transfer.json` |
| Offline service worker | Done | `evidence/e2e-offline.json` |
| Keyboard-only walkthrough | Done | `evidence/keyboard-walkthrough.md` |
| axe on 14 EN + 14 UR screens | Done, 0 violations | `evidence/axe-en.json` |
| Lighthouse (simulated 3G, 4× CPU) | Done: 80 / 100 / 100 / 100 | `evidence/lighthouse-summary.md` |
| "Save Urdu font" shows the real file size | Done (98.2 KB, from build) | `evidence/e2e-offline.json` |
| README, CREDITS, DATA-HANDLING, LICENSE, Devpost story, hero image | Done | repo root, `docs/hero.png` |
| Deploy demo + fill [DEMO_URL] | **Open** (Faizi) | |
| Demo video | **Open** (Faizi) | |
| Real-phone test (low-end Android, real voices, two cameras) | **Open** (Faizi) | |
| Fill [FAIZI: …] slots in README and devpost-story.md | **Open** (Faizi) | |
| Perf: inline critical CSS to lift Lighthouse Perf above 80 | Optional | |
