// Vendors third-party libs (minified, with license banners) and self-hosted fonts into app/.
// Run: node vendor.mjs   (from tools/)
import { buildSync } from 'esbuild';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const app = new URL('../app/', import.meta.url).pathname;
for (const d of ['vendor', 'fonts', 'icons']) fs.mkdirSync(app + d, { recursive: true });

function vendor(entry, globalName, banner, outName, expose) {
  const r = buildSync({ entryPoints: [entry], minify: true, write: false, format: 'iife', globalName, legalComments: 'none' });
  fs.writeFileSync(app + 'vendor/' + outName, banner + r.outputFiles[0].text + expose + '\n');
}
vendor('node_modules/qrcode-generator/dist/qrcode.js', '__qrmod',
  '/*! qrcode-generator 2.0.4 | (c) 2009 Kazuhiko Arase | MIT License | https://github.com/kazuhikoarase/qrcode-generator */\n',
  'qrcode-generator.min.js', 'self.qrcode=__qrmod.default||__qrmod;');
vendor('node_modules/jsqr/dist/jsQR.js', '__jsqr',
  '/*! jsQR 1.4.0 | (c) Cosmo Wolfe | Apache License 2.0 | https://github.com/cozmo/jsQR */\n',
  'jsQR.min.js', 'self.jsQR=__jsqr.default||__jsqr;');
fs.copyFileSync('node_modules/jsqr/LICENSE', app + 'vendor/LICENSE-jsQR.txt');
fs.writeFileSync(app + 'vendor/LICENSE-qrcode-generator.txt', `MIT License

Copyright (c) 2009 Kazuhiko Arase

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`);

const F = 'node_modules/@fontsource/';
fs.copyFileSync(F + 'atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2', app + 'fonts/atkinson-400.woff2');
fs.copyFileSync(F + 'atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2', app + 'fonts/atkinson-700.woff2');
fs.copyFileSync(F + 'literata/files/literata-latin-600-normal.woff2', app + 'fonts/literata-600.woff2');
for (const [pkg, name] of [['atkinson-hyperlegible', 'Atkinson-Hyperlegible'], ['literata', 'Literata'], ['noto-nastaliq-urdu', 'Noto-Nastaliq-Urdu']]) {
  if (fs.existsSync(F + pkg + '/LICENSE')) fs.copyFileSync(F + pkg + '/LICENSE', app + 'fonts/OFL-' + name + '.txt');
}

// Urdu: subset Noto Nastaliq Urdu to the Urdu alphabet + every character our UI and packs use.
let chars = new Set();
const add = (s) => { for (const c of s) chars.add(c); };
add('ابپتٹثجچحخدڈذرڑزژسشصضطظعغفقکگلمنںوہھءیےۓئؤآأۂۃۀإةيكى۰۱۲۳۴۵۶۷۸۹0123456789،۔؟؛:()/=.-+%٪ ' + '\u200c\u200d\u064b\u064c\u064d\u064e\u064f\u0650\u0651\u0652\u0654\u0670');
for (const f of fs.readdirSync(app + 'packs')) add(fs.readFileSync(app + 'packs/' + f, 'utf8'));
if (fs.existsSync(app + 'js/i18n.js')) add(fs.readFileSync(app + 'js/i18n.js', 'utf8'));
const urdu = [...chars].filter((c) => c.codePointAt(0) >= 0x0600 || /[0-9 ،()\/=.:+%-]/.test(c)).join('');
fs.writeFileSync('/tmp/urdu-chars.txt', urdu);
execFileSync('python3', ['-m', 'fontTools.subset', F + 'noto-nastaliq-urdu/files/noto-nastaliq-urdu-arabic-400-normal.woff2',
  '--text-file=/tmp/urdu-chars.txt', '--layout-features=*', '--flavor=woff2', '--output-file=' + app + 'fonts/nastaliq-urdu-subset.woff2'],
  { env: { ...process.env, PYTHONPATH: new URL('./pylib', import.meta.url).pathname }, stdio: 'inherit' });

for (const d of ['vendor', 'fonts']) for (const f of fs.readdirSync(app + d)) console.log(d + '/' + f, fs.statSync(app + d + '/' + f).size);
console.log('nastaliq original', fs.statSync(F + 'noto-nastaliq-urdu/files/noto-nastaliq-urdu-arabic-400-normal.woff2').size);
