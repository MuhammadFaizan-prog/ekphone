import { chromium } from 'playwright-core';
import fs from 'node:fs';
const CANDIDATES = [process.env.PW_EXE, '/workspace/.pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', '/tmp/pwb/chromium_headless_shell-1194/chrome-linux/headless_shell'].filter(Boolean);
export const EXE = CANDIDATES.find((p) => fs.existsSync(p));
const LIB = new URL('./sysroot/usr/lib/aarch64-linux-gnu', import.meta.url).pathname;
export const ENV = { ...process.env, LD_LIBRARY_PATH: LIB + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : '') };
export function launch(opts = {}) { return chromium.launch({ executablePath: EXE, headless: true, env: ENV, ...opts }); }
