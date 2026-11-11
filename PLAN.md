# Plan

**Goal:** remove the "one child, one device, always online" barrier for 3 to 5 siblings or classmates sharing one old Android phone with little or no data. AccessED Hacks 2026, Connect door.

**Judging criteria (equal weight), and how we answer each:**

| Criterion | Our answer |
|---|---|
| Barrier removed | No accounts, no data needed, per-child progress on one phone, lessons passed phone to phone by QR at 0 MB |
| Learning value | Short bilingual lessons with a moving highlighter, read-aloud, a 5-question quiz with feedback, best score per child |
| Inclusive experience + honest testing | Atkinson Hyperlegible, EN/UR with RTL, keyboard-only path, axe 0 violations on 28 screens, Lighthouse A11y 100. Limits stated plainly |
| Working prototype + explanation | Static PWA (`npx serve app`), automated evidence files, README, Devpost story |

**Constraints:** shell ≤150 KB, works on a slow 3G emulation, no backend, only open-licensed libraries/fonts, all content self-written.

**Scope (done):** profiles + optional hashed PIN, reader, read-aloud sync, quiz, progress, EN/UR, QR/file/paste sharing, offline service worker, tests and evidence, docs.

**Out of scope:** pack authoring UI, sync or backup, teacher dashboards, real-device field testing (not done yet).
