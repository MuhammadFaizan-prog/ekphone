import { launch } from './pw.mjs';
import fs from 'node:fs';
const R=new URL('../', import.meta.url).pathname;
const b64=(f)=>fs.readFileSync(R+f).toString('base64');
const shots=[['en-01-picker','Pick your name'],['en-05-lesson','Read with a highlighter'],['ur-05-lesson','اردو، دائیں سے بائیں'],['en-12-share-qr','Share a lesson by QR']];
const html=`<html><head><style>
@font-face{font-family:Lit;src:url(data:font/woff2;base64,${b64('app/fonts/literata-600.woff2')})}
@font-face{font-family:Atk;src:url(data:font/woff2;base64,${b64('app/fonts/atkinson-400.woff2')})}
@font-face{font-family:AtkB;src:url(data:font/woff2;base64,${b64('app/fonts/atkinson-700.woff2')})}
@font-face{font-family:Nas;src:url(data:font/woff2;base64,${b64('app/fonts/nastaliq-urdu-subset.woff2')})}
body{margin:0;width:1600px;height:880px;background:#F6F1E7;color:#1B1A17;font-family:Atk;box-sizing:border-box;padding:48px 64px}
h1{font-family:Lit;font-size:72px;margin:0;line-height:1}
h1 span{background:linear-gradient(transparent 55%,#F2D27A 55%)}
p{font-size:28px;margin:14px 0 0;line-height:1.4}
.row{display:flex;gap:40px;margin-top:40px;justify-content:space-between}
figure{margin:0;width:330px;position:relative}
.fade{position:absolute;left:3px;right:3px;top:520px;height:63px;border-radius:0 0 19px 19px;background:linear-gradient(rgba(246,241,231,0),#F6F1E7 85%)}
img{width:330px;height:580px;object-fit:cover;object-position:top;border:3px solid #1B1A17;border-radius:22px;display:block;background:#fff}
figcaption{font-family:AtkB;font-size:22px;margin-top:12px;text-align:center}
.ur{font-family:Nas;font-size:22px;direction:rtl;line-height:1.6;margin-top:4px}
.rust{color:#B23A1E}
</style></head><body>
<h1><span>Ek Phone</span></h1>
<p>One shared old phone, many learners, <b class="rust">no data needed</b>. Offline study in English and <span style="font-family:Nas;font-size:26px">اردو</span>.</p>
<div class="row">${shots.map(([f,c])=>`<figure><img src="data:image/png;base64,${b64('screenshots/'+f+'.png')}"><div class="fade"></div><figcaption class="${f.startsWith('ur')?'ur':''}">${c}</figcaption></figure>`).join('')}</div>
</body></html>`;
const br=await launch(); const pg=await br.newPage({viewport:{width:1600,height:880}});
await pg.setContent(html); await pg.evaluate(()=>document.fonts.ready); await pg.waitForTimeout(300);
const ov=await pg.evaluate(()=>({sh:document.body.scrollHeight,sw:document.body.scrollWidth}));
console.log(ov);
await pg.screenshot({path:R+'docs/hero.png'}); await br.close();
