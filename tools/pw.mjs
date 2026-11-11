import { chromium } from 'playwright-core';
export const EXE = '/workspace/.pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const LIB = new URL('./sysroot/usr/lib/aarch64-linux-gnu', import.meta.url).pathname;
export const ENV = { ...process.env, LD_LIBRARY_PATH: LIB + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : '') };
export function launch(opts = {}) { return chromium.launch({ executablePath: EXE, headless: true, env: ENV, ...opts }); }
