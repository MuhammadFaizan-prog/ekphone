// Shared bits for the browser tests. Each test writes its own evidence JSON so results are never claimed without a run.
import fs from 'node:fs';
export * from '../../tools/helpers.mjs';
export const ROOT = new URL('../../', import.meta.url).pathname;
export const EVID = ROOT + 'evidence/';
fs.mkdirSync(EVID, { recursive: true });

export function recorder(name) {
  const steps = [];
  const started = new Date();
  return {
    steps,
    ok(step, detail) { steps.push({ step, pass: true, detail }); console.log('  ✓', step, detail ? '— ' + JSON.stringify(detail) : ''); },
    check(cond, step, detail) { steps.push({ step, pass: !!cond, detail }); console.log(cond ? '  ✓' : '  ✗', step, detail ? '— ' + JSON.stringify(detail) : ''); if (!cond) throw new Error('FAILED: ' + step + ' ' + JSON.stringify(detail || '')); },
    save(extra = {}) {
      const pass = steps.every((s) => s.pass);
      const out = { test: name, pass, started: started.toISOString(), finished: new Date().toISOString(), browser: 'Chromium headless shell 141 (Playwright 1.56.1)', steps, ...extra };
      fs.writeFileSync(EVID + name + '.json', JSON.stringify(out, null, 2));
      console.log(pass ? 'PASS' : 'FAIL', name, steps.filter((s) => s.pass).length + '/' + steps.length);
      return out;
    }
  };
}

/** Fake speech engine: speaks each sentence "instantly" so highlight sync can be verified. Real voices vary by phone. */
export const FAKE_SPEECH = `(() => {
  window.__spoken = [];
  const voices = [{ lang: 'en-IN', name: 'Test English', default: true, localService: true, voiceURI: 'test-en' }];
  const fake = { speaking: false, pending: false, paused: false,
    getVoices() { return voices; },
    speak(u) { window.__spoken.push(u.text); const t1 = setTimeout(() => { u.onstart && u.onstart(); const t2 = setTimeout(() => { if (!u.__cancel) u.onend && u.onend(); }, 400); u.__t2 = t2; }, 20); fake.__last = u; },
    cancel() { if (fake.__last) { fake.__last.__cancel = true; } },
    addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
})();`;
