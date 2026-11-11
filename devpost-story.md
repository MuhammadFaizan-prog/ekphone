# Ek Phone: Devpost story

**Tagline (≤60 chars):** One shared phone, many learners, zero data needed.

---

## Inspiration

[FAIZI: your own line. Why shared phones and data costs matter to you. Only things you saw or lived yourself.]

Plenty of households have one smartphone for the whole family, often an older Android with a small or empty data bundle. Most study apps assume each child has their own device, an account and a steady connection. Ek Phone ("one phone" in Urdu) starts from the opposite assumption.

## What it does

Ek Phone is an offline-first study app (a PWA) for three to five siblings or classmates sharing one phone.

- **Pick your name, no account.** Up to 8 local learner profiles, each with an optional 4-digit PIN (salted SHA-256, 30-second lockout after 5 wrong tries).
- **Read with a highlighter.** Lessons are split into sentences. A yellow band moves sentence by sentence with arrow keys or taps, and read-aloud highlights the sentence being spoken.
- **Check what you learned.** A 5-question quiz with feedback on every answer. Each child's best score is kept separately.
- **English or اردو.** One tap switches the whole UI and lesson to Urdu, with right-to-left layout and Nastaliq script (the font loads only when needed).
- **Share lessons with 0 MB.** One phone shows a lesson as a sequence of QR codes, and another phone scans it in. A file or pasted text works too. The pack size is always shown before loading.
- **Works offline.** After one visit, a service worker keeps everything on the phone.

**Before → After:** four siblings, one phone, no data bundle. *Before:* every child needs an account and data to log in, the app won't open offline, and a new lesson costs data. *After:* each child taps their name, reads, takes the quiz and keeps their own score, and a new lesson arrives from a classmate's phone by QR, using 0 MB.

## How I built it

- Plain HTML, CSS and JavaScript with no framework. The first-screen code is **102.7 KB** (31.1 KB gzip), within a 150 KB budget. Everything, including fonts, icons and lazy parts, is 443.2 KB.
- `localStorage` for profiles and progress. Web Crypto for PIN hashing. A service worker with a content-hashed precache for offline use.
- A small chunking layer (`qrchunk.js`): `deflate-raw` compression where available, numbered chunks, a checksum, and reassembly in any order. qrcode-generator draws the codes. The native `BarcodeDetector` reads them, with jsQR as a fallback.
- Lesson packs are small bilingual JSON files I wrote myself (Grade 5 fractions, Grade 5 water cycle, Grade 4 English sentences, plus a Grade 3 plant-parts sample). They are licensed CC BY 4.0.
- "Kaghaz" (paper) design: paper `#F6F1E7`, ink `#1B1A17`, rust `#B23A1E`, highlighter `#F2D27A`. Atkinson Hyperlegible for body text, Literata for headings, Noto Nastaliq Urdu for Urdu.
- Testing with Playwright, axe-core and Lighthouse. Every test writes its own result file to `evidence/`.
- AI assistance: Hark AI assistant helped design, code, test and document this project; reviewed by the entrant, Muhammad Faizan.

[FAIZI: your own line. Anything you personally decided or changed.]

## Challenges I ran into

- **QR codes hold very little.** A lesson does not fit in one code, so I built chunking that survives codes arriving out of order, duplicates, and codes from a different pack.
- **Urdu is heavy.** Even a subset of the Nastaliq font is about 98 KB, larger than the whole first screen. It loads only when someone turns Urdu on, and is then cached for offline use.
- **Testing read-aloud and the camera without real hardware.** Automated tests used a fake speech engine and a fake camera feed, so real voices and two real cameras are still untested.
- **Performance on slow phones.** Lighthouse scores 80 for performance under simulated 3G and a 4× slower CPU. The single render-blocking stylesheet holds it back.

## Accomplishments that I'm proud of

- Automated evidence: unit 11/11, end-to-end flow 33/33, offline 11/11, QR transfer between two browser contexts 11/11 (byte-identical pack), keyboard-only 37/37.
- **0 axe violations** on all 14 English and 14 Urdu screens. **Lighthouse: Accessibility 100, Best practices 100, PWA 100**, Performance 80.
- No server, no accounts, no analytics. Nothing leaves the phone.

[FAIZI: your own line.]

## What I learned

- Designing for a shared device changes the basics: "who is using this?" has to be the first screen, not a login.
- Offline-first means budgeting every kilobyte and lazy-loading anything that isn't needed on the first screen.
- RTL is more than mirroring text. Layout, icons and focus order all need checking in both directions.

[FAIZI: your own line.]

## What's next

- Test on a real low-end Android phone, with real speech voices and QR transfer between two physical phones. [FAIZI: add only if you plan it.]
- A simple pack-authoring screen, so teachers can write lessons without editing JSON.
- More lessons and subjects, and more regional languages.
- Inline the critical CSS to lift the performance score.
- An optional export/backup of progress to a file, still with no server.

---

**Try it:** [DEMO_URL] · **Code:** https://github.com/MuhammadFaizan-prog/ekphone (private until submission) · **Built during:** AccessED Hacks 2026 (all work on Nov 11, 2026)
