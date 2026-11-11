# Data handling

**Short version:** everything stays on the phone. Ek Phone has no server, no accounts, no analytics, no ads, no trackers and no third-party requests. After the first visit it works with the network off.

## What is stored, and where

All data is in the browser's `localStorage` on that one device, under the prefix `ekphone:v1:`.

| Key | What it holds |
|---|---|
| `ekphone:v1:profiles` | Learner list: random id, display name, colour, created time, and, if a PIN was set, a salt and a PIN hash. At most 8 learners. |
| `ekphone:v1:progress:<id>` | One learner's progress per pack: sentence reached, whether the lesson was read, best and last quiz score, attempts, last update. |
| `ekphone:v1:lock:<id>` | PIN lockout counter for one learner (wrong tries, locked-until time). |
| `ekphone:v1:packs` | Lesson packs received from another phone (QR, file or paste). |
| `ekphone:v1:settings` | Language (English/Urdu), read-aloud speed, text size. |

`sessionStorage` (`ekphone:who`) remembers who is signed in only until the tab or app is closed.

The service worker keeps a copy of the app's own files (code, fonts, icons, built-in packs) in Cache Storage so it runs offline. No personal data goes in that cache.

## PINs (as implemented in `app/js/storage.js`)

- A PIN is optional and must be exactly 4 digits.
- It is **never stored in plain text.** When a learner is created, a random 12-character salt is generated with `crypto.getRandomValues`. The stored value is `sha256:` + hex SHA-256 of `salt + ":" + pin` (Web Crypto `crypto.subtle.digest`).
- Fallback, only if Web Crypto is not available (for example, a plain-`http` page on some old browsers): a 64-bit value made from two FNV-1a 32-bit hashes, stored with the prefix `fnv:`. This is weaker. Serving over HTTPS or `localhost` uses SHA-256.
- Checking a PIN hashes the attempt the same way and compares it.
- **Lockout:** after 5 wrong tries in a row, that learner is locked for 30 seconds. A correct PIN clears the counter.
- The unit tests check that the PIN is hashed, never stored in plain text, and that lockout happens after 5 wrong tries (`evidence/unit-tests.txt`). The e2e flow checks the stored profile does not contain the PIN (`evidence/e2e-flow.json`).
- **Threat model, honestly:** the PIN keeps siblings out of each other's progress. It is not strong security. A 4-digit PIN can be brute-forced offline by anyone with the device and developer tools.

## Camera

The camera opens only on the *Receive a lesson pack* screen, after the user taps **Scan QR codes with camera**. Frames are decoded on the device (native `BarcodeDetector`, or the bundled jsQR) and are never saved or sent anywhere. The stream stops when you leave the screen.

## Sharing packs

A shared pack contains only lesson content: title, sentences, questions. App-only fields are stripped before sharing, and **no learner names, PINs or progress are ever included**. Received packs are size-checked (max 200 KB) and validated before they are saved, and their size is shown before loading.

## Read-aloud

Read-aloud uses the browser's built-in `speechSynthesis`. Whether voices are processed on the device or by an online service depends on the phone's speech engine, not on Ek Phone.

## Deleting data

- Removing a learner (*Teacher or older sibling* screen → **Remove**) deletes their profile, progress and lockout record.
- Clearing the browser's site data for Ek Phone deletes everything.

## Children's data

Ek Phone collects nothing, so nothing leaves the device. Test and screenshot learners are synthetic names. No real student data was used in building or testing.
