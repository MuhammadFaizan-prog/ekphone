# Ek Phone demo video: transcript

Video: `docs/demo.mp4`, 1280x720, 2 min 38 s, no voice-over (the captions below are burned into the video and also in `docs/demo.srt` / `docs/demo.vtt`).

Every phone image is a real screenshot of the app, taken by `tools/demo-capture.mjs` in a 360x640 Chromium phone viewport with synthetic demo learners. "Phone B" is a second, separate browser context. "Offline" is the browser's offline mode, not a physical airplane-mode switch. Built by `tools/demo-video.py`.

| Time | Step | Caption |
|---|---|---|
| 0:00 | Title card | Ek Phone: an offline study app for several kids who share one phone. |
| 0:04 | Title card | The barrier: most study apps assume one child, one phone, an account and mobile data. |
| 0:09 | 1. Try the demo | An empty phone. One tap on "Try the demo" loads 4 made-up learners. |
| 0:13 | 1. Try the demo | Each child has a name tag. No email, no account. Zara's demo PIN is 1234. |
| 0:17 | 2. Pick a learner | Zara taps her name and types her 4-digit PIN. |
| 0:23 | 2. Pick a learner | Her own shelf opens. Today's lesson shows its size first: 4.2 KB. |
| 0:27 | 3. Read | The yellow highlighter marks one sentence at a time. |
| 0:31 | 3. Read | The arrow keys (or the arrow buttons) move it sentence by sentence. |
| 0:38 | 4. Quiz | Then a 5-question quiz on the same lesson. |
| 0:42 | 4. Quiz | Every answer gets feedback. Right... |
| 0:46 | 4. Quiz | ...or wrong, with the right answer and the reason. |
| 0:50 | 4. Quiz | Zara got 4 of 5. The score is saved on this phone, for Zara only. |
| 0:55 | 5. Progress per child | Her shelf moves on to the next lesson. |
| 0:58 | 5. Progress per child | On the name screen, a tick shows who has studied today. |
| 1:02 | 5. Progress per child | Hamza's shelf is his own. His lesson is still "Not started". |
| 1:07 | 6. Urdu, right to left | One tap switches the whole app to Urdu: right to left, Nastaliq script. |
| 1:11 | 6. Urdu, right to left | In Urdu the arrow keys follow the reading direction. |
| 1:16 | 7. Teacher: import a lesson | A teacher or older sibling opens "Lesson packs" and "Write a lesson". |
| 1:19 | 7. Teacher: import a lesson | Open a .txt, .md or .pdf file, or paste the text. |
| 1:23 | 7. Teacher: import a lesson | A .txt file comes in: 6 sentences and 5 suggested questions. |
| 1:27 | 7. Teacher: import a lesson | The first line becomes the title. The rest is split into sentences. |
| 1:31 | 7. Teacher: import a lesson | Suggested questions are fill-in-the-blank, with the right answer marked. |
| 1:35 | 7. Teacher: import a lesson | The teacher checks each one and edits it before saving. |
| 1:41 | 7. Teacher: import a lesson | The preview shows the size: 1.2 KB, 6 sentences, 5 questions. |
| 1:45 | 7. Teacher: import a lesson | Saved. Every learner on this phone now sees it. |
| 1:48 | 8. Share by QR | The new lesson is in the pack list, marked "Written here". |
| 1:52 | 8. Share by QR | "Show QR codes": this lesson needs 3 codes. |
| 1:56 | 8. Share by QR | Each code is a link into the app, so any phone camera can open it. |
| 2:00 | 8. Share by QR | The codes cycle by themselves. Sharing uses 0 MB of mobile data. |
| 2:03 | 9. A second phone receives | A second browser, standing in for phone B, opens the links: "Got 1 of 3". |
| 2:08 | 9. A second phone receives | After all 3, it shows the size before loading: 1.2 KB. |
| 2:12 | 9. A second phone receives | Loaded. The lesson is now on every learner's shelf on phone B. |
| 2:16 | 10. Offline | Back on phone A: network off (browser offline mode), page reloaded. |
| 2:20 | 10. Offline | It still opens from the service worker, and the lesson still reads. |
| 2:25 | Closing card | Built during AccessED Hacks (Oct 17 to Nov 20, 2026) by Muhammad Faizan. |
| 2:29 | Closing card | Not yet tested: real read-aloud voices, TalkBack, and two physical cameras. |
| 2:34 | Closing card | Try it at ekphone-app.vercel.app. Code: github.com/MuhammadFaizan-prog/ekphone |
