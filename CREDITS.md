# Credits & licenses

Ek Phone discloses every library, dataset, asset, AI tool and piece of pre-existing work it uses.

## Shipped in the app

| Item | Version | Author | License | Where | Used for |
|---|---|---|---|---|---|
| qrcode-generator | 2.0.4 | Kazuhiko Arase (© 2009) | MIT | `app/vendor/qrcode-generator.min.js` · [license](app/vendor/LICENSE-qrcode-generator.txt) | Drawing the QR code sequence on the share screen (lazy-loaded) |
| jsQR | 1.4.0 | Cosmo Wolfe | Apache-2.0 | `app/vendor/jsQR.min.js` · [license](app/vendor/LICENSE-jsQR.txt) | Reading QR codes from the camera when the phone has no native `BarcodeDetector` (lazy-loaded) |
| Atkinson Hyperlegible (400, 700) | via @fontsource 5.x | Braille Institute of America | SIL OFL 1.1 | `app/fonts/atkinson-*.woff2` · [license](app/fonts/OFL-Atkinson-Hyperlegible.txt) | Body text |
| Literata (600) | via @fontsource 5.x | TypeTogether for Google | SIL OFL 1.1 | `app/fonts/literata-600.woff2` · [license](app/fonts/OFL-Literata.txt) | Headings |
| Noto Nastaliq Urdu (subset) | via @fontsource 5.x | Google | SIL OFL 1.1 | `app/fonts/nastaliq-urdu-subset.woff2` · [license](app/fonts/OFL-Noto-Nastaliq-Urdu.txt) | Urdu text (loaded only when Urdu is on) |

Both libraries are vendored as minified files with their license headers kept (`tools/vendor.mjs` builds them from the npm packages).

## Development tools only (not shipped)

Playwright / playwright-core 1.56.x (Apache-2.0), @axe-core/playwright 4.x (MPL-2.0), Lighthouse 11.7.1 (Apache-2.0), esbuild 0.28.x (MIT), @fontsource packages (fonts OFL, package code MIT). Listed in `tools/package.json`.

## Original work for this project

- All app code: `app/index.html`, `app/js/*`, `app/css/*`, `app/sw.js`, `app/manifest.webmanifest` (MIT, see [LICENSE](LICENSE)).
- Illustrations drawn in code (`app/js/art.js`) and the app icon (`app/icons/icon.svg`, PNGs rendered from it).
- The "Kaghaz" visual design: paper `#F6F1E7`, ink `#1B1A17`, rust `#B23A1E`, highlighter `#F2D27A`.
- Lesson packs `g5-fractions`, `g5-water-cycle`, `g4-english-sentence` and the sample `g3-plant-parts`: self-written, synthetic content, **CC BY 4.0** (as stated in each pack's `license` field).
- Tests, tooling, evidence, screenshots and docs.

## Datasets

None. No external dataset was used. Learner names in tests and screenshots (Ayesha, Bilal, Zara, Hamza, Sana) are synthetic. No real student data was collected or used.

## AI assistance

Hark AI assistant helped design, code, test and document this project; reviewed by the entrant, Muhammad Faizan.

## Pre-existing work

Nothing besides the open-source libraries and fonts above. All project code and content was created during the AccessED Hacks build window (first commit Nov 11, 2026).
