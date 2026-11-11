#!/usr/bin/env python3
"""Builds docs/demo.mp4 (1280x720, burned-in captions), docs/demo.srt, docs/demo.vtt,
docs/demo-transcript.md and docs/thumb.png from the stills made by tools/demo-capture.mjs.
Run from the repo root:  python3 tools/demo-video.py /tmp/ekfin/frames /tmp/ekfin/vid
Every phone image is a real screenshot of the app. There is no voice-over; the captions are the narration."""
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

FR = sys.argv[1] if len(sys.argv) > 1 else '/tmp/ekfin/frames'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/ekfin/vid'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FS = os.path.join(ROOT, 'tools/node_modules/@fontsource')
os.makedirs(OUT + '/stills', exist_ok=True)
W, H = 1280, 720
PAPER, INK, RUST, HI, CARD = (0xF6, 0xF1, 0xE7), (0x1B, 0x1A, 0x17), (0xB2, 0x3A, 0x1E), (0xF2, 0xD2, 0x7A), (0xFB, 0xF8, 0xF1)
def font(fam, w, size):
    p = {'lit': 'literata/files/literata-latin-%s-normal.woff', 'atk': 'atkinson-hyperlegible/files/atkinson-hyperlegible-latin-%s-normal.woff'}[fam] % w
    return ImageFont.truetype(os.path.join(FS, p), size)

# (still, seconds, step label, caption). Consecutive equal captions merge into one cue.
T = 'title'; C = 'close'
TL = [
  (T, 4.5, None, 'Ek Phone: an offline study app for several kids who share one phone.'),
  (T, 4.5, None, 'The barrier: most study apps assume one child, one phone, an account and mobile data.'),
  ('empty', 4, '1  Try the demo', 'An empty phone. One tap on "Try the demo" loads 4 made-up learners.'),
  ('demo-learners', 4.5, '1  Try the demo', 'Each child has a name tag. No email, no account. Zara\'s demo PIN is 1234.'),
  ('pin', 3, '2  Pick a learner', 'Zara taps her name and types her 4-digit PIN.'),
  ('pin-filled', 2.5, '2  Pick a learner', 'Zara taps her name and types her 4-digit PIN.'),
  ('home-zara', 4.5, '2  Pick a learner', 'Her own shelf opens. Today\'s lesson shows its size first: 4.2 KB.'),
  ('read-0', 3.5, '3  Read', 'The yellow highlighter marks one sentence at a time.'),
  ('read-1', 2.5, '3  Read', 'The arrow keys (or the arrow buttons) move it sentence by sentence.'),
  ('read-2', 2.5, '3  Read', 'The arrow keys (or the arrow buttons) move it sentence by sentence.'),
  ('read-3', 2.5, '3  Read', 'The arrow keys (or the arrow buttons) move it sentence by sentence.'),
  ('quiz-pick', 3.5, '4  Quiz', 'Then a 5-question quiz on the same lesson.'),
  ('quiz-feedback-0', 4, '4  Quiz', 'Every answer gets feedback. Right...'),
  ('quiz-feedback-1', 4.5, '4  Quiz', '...or wrong, with the right answer and the reason.'),
  ('quiz-result', 4.5, '4  Quiz', 'Zara got 4 of 5. The score is saved on this phone, for Zara only.'),
  ('home-zara-after', 3.5, '5  Progress per child', 'Her shelf moves on to the next lesson.'),
  ('picker-ticks', 4, '5  Progress per child', 'On the name screen, a tick shows who has studied today.'),
  ('home-hamza', 4.5, '5  Progress per child', 'Hamza\'s shelf is his own. His lesson is still "Not started".'),
  ('urdu-home', 4.5, '6  Urdu, right to left', 'One tap switches the whole app to Urdu: right to left, Nastaliq script.'),
  ('urdu-read', 4.5, '6  Urdu, right to left', 'In Urdu the arrow keys follow the reading direction.'),
  ('teacher', 3.5, '7  Teacher: import a lesson', 'A teacher or older sibling opens "Lesson packs" and "Write a lesson".'),
  ('write-top', 3.5, '7  Teacher: import a lesson', 'Open a .txt, .md or .pdf file, or paste the text.'),
  ('import-msg', 4.5, '7  Teacher: import a lesson', 'A .txt file comes in: 6 sentences and 5 suggested questions.'),
  ('import-filled', 3.5, '7  Teacher: import a lesson', 'The first line becomes the title. The rest is split into sentences.'),
  ('import-q0', 4, '7  Teacher: import a lesson', 'Suggested questions are fill-in-the-blank, with the right answer marked.'),
  ('import-q4-before', 3, '7  Teacher: import a lesson', 'The teacher checks each one and edits it before saving.'),
  ('import-q4-edited', 3, '7  Teacher: import a lesson', 'The teacher checks each one and edits it before saving.'),
  ('write-preview', 4, '7  Teacher: import a lesson', 'The preview shows the size: 1.2 KB, 6 sentences, 5 questions.'),
  ('write-saved', 3.5, '7  Teacher: import a lesson', 'Saved. Every learner on this phone now sees it.'),
  ('teacher-written', 3.5, '8  Share by QR', 'The new lesson is in the pack list, marked "Written here".'),
  ('qr-1', 4, '8  Share by QR', '"Show QR codes": this lesson needs 3 codes.'),
  ('qr-caption', 4.5, '8  Share by QR', 'Each code is a link into the app, so any phone camera can open it.'),
  ('qr-next', 3, '8  Share by QR', 'The codes cycle by themselves. Sharing uses 0 MB of mobile data.'),
  ('rx-first', 4.5, '9  A second phone receives', 'A second browser, standing in for phone B, opens the links: "Got 1 of 3".'),
  ('rx-preview', 4.5, '9  A second phone receives', 'After all 3, it shows the size before loading: 1.2 KB.'),
  ('rx-done', 3.5, '9  A second phone receives', 'Loaded. The lesson is now on every learner\'s shelf on phone B.'),
  ('offline-picker', 4.5, '10  Offline', 'Back on phone A: network off (browser offline mode), page reloaded.'),
  ('offline-read', 4.5, '10  Offline', 'It still opens from the service worker, and the lesson still reads.'),
  (C, 4.5, None, 'Built during AccessED Hacks (Oct 17 to Nov 20, 2026) by Muhammad Faizan.'),
  (C, 4.5, None, 'Not yet tested: real read-aloud voices, TalkBack, and two physical cameras.'),
  (C, 4.5, None, 'Try it at ekphone-app.vercel.app. Code: github.com/MuhammadFaizan-prog/ekphone'),
]
SIDE = {'demo-learners': None, 'rx-first': 'PHONE B', 'rx-preview': 'PHONE B', 'rx-done': 'PHONE B', 'offline-picker': 'OFFLINE', 'offline-read': 'OFFLINE'}

shots = {s['name']: s['file'] for s in json.load(open(FR + '/shots.json'))['shots']}

def wrap(d, text, f, maxw):
    lines, cur = [], ''
    for w in text.split():
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=f) <= maxw: cur = t
        else: lines.append(cur); cur = w
    lines.append(cur); return lines

def underline(d, x, y, w):
    d.line([(x, y), (x + w * 0.55, y + 3), (x + w, y)], fill=INK, width=3, joint='curve')

def phone_still(name, label):
    im = Image.new('RGB', (W, H), PAPER); d = ImageDraw.Draw(im)
    scr = Image.open(os.path.join(FR, shots[name])).convert('RGB').resize((315, 560), Image.LANCZOS)
    bw = 12; pw, ph = 315 + 2 * bw, 560 + 2 * bw; x0 = (W - pw) // 2; y0 = 14
    d.rounded_rectangle([x0 + 6, y0 + 8, x0 + pw + 6, y0 + ph + 8], radius=38, fill=(0xE4, 0xDC, 0xCB))
    d.rounded_rectangle([x0, y0, x0 + pw, y0 + ph], radius=38, fill=INK)
    mask = Image.new('L', (315, 560), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, 314, 559], radius=26, fill=255)
    im.paste(scr, (x0 + bw, y0 + bw), mask)
    # left column: step label
    if label:
        num, title = label.split('  ', 1)
        fN, fT = font('lit', 700, 64), font('lit', 600, 34)
        d.text((70, 150), num, font=fN, fill=RUST)
        yy = 240
        for ln in wrap(d, title, fT, 330):
            d.text((70, yy), ln, font=fT, fill=INK); yy += 46
        underline(d, 70, yy + 6, 200)
    d.text((W - 70, 560), 'Real screenshots of the app', font=font('atk', 400, 20), fill=(0x5A, 0x55, 0x4C), anchor='rs')
    d.text((W - 70, 586), '360 x 640 phone, Chromium', font=font('atk', 400, 20), fill=(0x5A, 0x55, 0x4C), anchor='rs')
    tag = SIDE.get(name)
    if tag:
        f = font('atk', 700, 26); tw = d.textlength(tag, font=f)
        bx = W - 70 - tw - 36
        d.rounded_rectangle([bx, 150, W - 70, 200], radius=25, fill=RUST if tag == 'OFFLINE' else INK)
        d.text((bx + 18, 175), tag, font=f, fill=CARD, anchor='lm')
    return im

def title_card():
    im = Image.new('RGB', (W, H), PAPER); d = ImageDraw.Draw(im)
    d.text((100, 70), 'Ek Phone', font=font('lit', 700, 92), fill=RUST)
    d.text((104, 190), 'One old phone. Several kids. No data bundle.', font=font('lit', 600, 40), fill=INK)
    underline(d, 104, 262, 520)
    f = font('atk', 400, 28); fb = font('atk', 700, 28)
    d.text((104, 300), 'The barrier', font=fb, fill=RUST)
    rows = [('Most study apps assume', 'A shared phone at home has'), ('one child, one device', 'three to five learners'), ('an account and a login', 'kids with no email'), ('a steady connection', 'little or no mobile data'), ('English only', 'learners who read Urdu')]
    y = 345
    for i, (a, b) in enumerate(rows):
        ff = fb if i == 0 else f
        d.text((104, y), a, font=ff, fill=INK); d.text((560, y), b, font=ff, fill=INK)
        if i == 0: d.line([(104, y + 40), (1000, y + 40)], fill=INK, width=2)
        y += 46 if i == 0 else 40
    return im

def close_card():
    im = Image.new('RGB', (W, H), PAPER); d = ImageDraw.Draw(im)
    d.text((100, 50), 'Ek Phone', font=font('lit', 700, 64), fill=RUST)
    d.text((100, 135), 'Built during AccessED Hacks 2026 (Oct 17 to Nov 20, 2026)', font=font('lit', 600, 30), fill=INK)
    underline(d, 100, 188, 420)
    f = font('atk', 400, 24); fb = font('atk', 700, 24)
    blocks = [
      ('Credits', ['pdf.js 3.11.174 (Mozilla, Apache-2.0) · jsQR 1.4.0 (Apache-2.0) · qrcode-generator 2.0.4 (MIT)', 'Atkinson Hyperlegible, Literata, Noto Nastaliq Urdu (SIL OFL 1.1)', 'Hark AI assistant helped design, code, test and document it; reviewed by the entrant.']),
      ('Limitations', ['Not yet tested: real read-aloud voices (especially Urdu), TalkBack, QR between two physical cameras.', 'The PIN is a light privacy screen between siblings, not security.']),
      ('Links', ['Live: https://ekphone-app.vercel.app', 'Code (MIT): https://github.com/MuhammadFaizan-prog/ekphone']),
    ]
    y = 205
    for h, lines in blocks:
        d.text((100, y), h, font=fb, fill=RUST); y += 34
        for ln in lines: d.text((100, y), ln, font=f, fill=INK); y += 31
        y += 12
    return im

stills = []
for i, (name, sec, label, cap) in enumerate(TL):
    path = f'{OUT}/stills/{i:03d}.png'
    if name == T: im = title_card()
    elif name == C: im = close_card()
    else: im = phone_still(name, label)
    im.save(path); stills.append((path, sec))
title_card().save(OUT + '/thumb.png')

# cues
cues, t = [], 0.0
for (name, sec, label, cap) in TL:
    if cues and cues[-1][2] == cap: cues[-1][1] = t + sec
    else: cues.append([t, t + sec, cap])
    t += sec
TOTAL = t
def ts(x, sep): h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60; return f'{h:02d}:{m:02d}:{int(s):02d}{sep}{int(round((s - int(s)) * 1000)):03d}'
with open(OUT + '/demo.srt', 'w') as f:
    for i, (a, b, c) in enumerate(cues, 1): f.write(f'{i}\n{ts(a, ",")} --> {ts(b - 0.05, ",")}\n{c}\n\n')
with open(OUT + '/demo.vtt', 'w') as f:
    f.write('WEBVTT\n\n')
    for i, (a, b, c) in enumerate(cues, 1): f.write(f'{i}\n{ts(a, ".")} --> {ts(b - 0.05, ".")}\n{c}\n\n')
def ass_t(x): return f'{int(x // 3600)}:{int(x % 3600 // 60):02d}:{x % 60:05.2f}'
with open(OUT + '/demo.ass', 'w') as f:
    f.write('[Script Info]\nScriptType: v4.00+\nPlayResX: 1280\nPlayResY: 720\nWrapStyle: 0\n\n[V4+ Styles]\n'
            'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n'
            'Style: Cap,Atkinson Hyperlegible,30,&H00E7F1F6,&H00E7F1F6,&H00171A1B,&H00171A1B,-1,0,0,0,100,100,0,0,3,10,0,2,120,120,26,1\n\n'
            '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n')
    for a, b, c in cues: f.write(f'Dialogue: 0,{ass_t(a)},{ass_t(b - 0.05)},Cap,,0,0,0,,{c}\n')
with open(OUT + '/list.txt', 'w') as f:
    for p, s in stills: f.write(f"file '{p}'\nduration {s}\n")
    f.write(f"file '{stills[-1][0]}'\n")
# transcript
with open(OUT + '/demo-transcript.md', 'w') as f:
    f.write('# Ek Phone demo video: transcript\n\n')
    f.write(f'Video: `docs/demo.mp4`, 1280x720, {int(TOTAL // 60)} min {int(TOTAL % 60):02d} s, no voice-over (the captions below are burned into the video and also in `docs/demo.srt` / `docs/demo.vtt`).\n\n')
    f.write('Every phone image is a real screenshot of the app, taken by `tools/demo-capture.mjs` in a 360x640 Chromium phone viewport with synthetic demo learners. "Phone B" is a second, separate browser context. "Offline" is the browser\'s offline mode, not a physical airplane-mode switch. Built by `tools/demo-video.py`.\n\n')
    f.write('| Time | Step | Caption |\n|---|---|---|\n')
    t = 0.0; seen = set()
    for (name, sec, label, cap) in TL:
        step = label.replace('  ', '. ') if label else ('Title card' if name == T else 'Closing card')
        if cap not in seen: f.write(f'| {int(t // 60)}:{int(t % 60):02d} | {step} | {cap} |\n'); seen.add(cap)
        t += sec
json.dump({'total_seconds': TOTAL, 'cues': len(cues)}, open(OUT + '/meta.json', 'w'))
print('stills', len(stills), 'total', TOTAL, 'cues', len(cues))
