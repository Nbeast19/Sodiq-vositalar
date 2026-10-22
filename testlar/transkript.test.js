// Transkript mantiqi sinovlari: node testlar/transkript.test.js
const assert = require('assert');
const fs = require('fs');
const T = require('../transkript/transkript.js');
const opt = T.standart();

// SRT: raqamlar va vaqtlar olib tashlanadi
const srt = fs.readFileSync(__dirname + '/../transkript/namuna/namuna.srt', 'utf8');
let n = T.ishla(srt, opt);
let hammasi = n.paragraflar.join('\n');
assert(!/-->/.test(hammasi) && !/\d\d:\d\d/.test(hammasi) && !/^\d+$/m.test(hammasi), hammasi);
assert(!/Speaker/.test(hammasi));
assert(hammasi.includes("o'rganishni"), 'apostrof bir xil');
assert(hammasi.includes("g'orda"));
assert(hammasi.includes('Abu Bakrning, martabasini'), 'ikki vergul tozalandi');
assert.strictEqual(n.paragraflar.length, 2, 'pauza (5 s) bo\'yicha 2 paragraf');
assert.strictEqual(n.takror, 1, '"biz biz"');
// VTT
n = T.ishla('WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nSalom dunyo.\n\n00:00:04.500 --> 00:00:06.000\nYana matn.', opt);
assert.deepStrictEqual(n.paragraflar, ['Salom dunyo. Yana matn.']);
// MacWhisper
n = T.ishla('[00:00:12.340 --> 00:00:15.000] Birinchi gap.\n[00:00:15.100 --> 00:00:16.000] Ikkinchi gap.', opt);
assert.deepStrictEqual(n.paragraflar, ['Birinchi gap. Ikkinchi gap.']);
n = T.ishla('00:12:34 Birinchi.\n00:12:40 Ikkinchi.', opt);
assert.deepStrictEqual(n.paragraflar, ['Birinchi. Ikkinchi.']);
// Arabcha ajratish
const misol = 'Bismillah. قال رسول الله صلى الله عليه وسلم: ... deb aytdilar';
assert.strictEqual(T.arabcha(misol, 'teg'), 'Bismillah. [AR]قال رسول الله صلى الله عليه وسلم[/AR]: ... deb aytdilar');
assert.strictEqual(T.arabcha(misol, 'belgi'), 'Bismillah. «قال رسول الله صلى الله عليه وسلم»: ... deb aytdilar');
assert.strictEqual(T.arabcha(misol, 'qator'), 'Bismillah.\nقال رسول الله صلى الله عليه وسلم\n: ... deb aytdilar');
assert(T.arabcha(misol, 'qator', true).includes('\n\n> قال رسول الله صلى الله عليه وسلم\n\n'));
const st = T.statistika([misol]);
assert.deepStrictEqual([st.jami, st.arab, st.bolak], [10, 7, 1]);
assert.strictEqual(T.statMatn({ jami: 9840, arab: 1950, bolak: 214, foiz: 19.817 }), 'Jami so\'z: 9 840 · Arabcha: 1 950 (19,8%) · Arabcha bo\'laklar: 214');
// Vaqtsiz matn: har 5 gapda paragraf
n = T.ishla('Bir. Ikki. Uch. To\'rt. Besh. Olti. Yetti.', opt);
assert.strictEqual(n.paragraflar.length, 2);
// Uzun matn: 15 000 so'z 2 soniyadan tez
let uzun = '';
for (let i = 0; i < 1500; i++) uzun += '[00:' + String(Math.floor(i / 60) % 60).padStart(2, '0') + ':' + String(i % 60).padStart(2, '0') + '] Bu yerda o‘zbekcha gap bor va va قال الله تعالى بسم الله.\n';
const t0 = Date.now();
n = T.ishla(uzun, opt);
const html = T.html(n.paragraflar, 'qator');
T.chiqar(n.paragraflar, 'qator', true);
const vaqt = Date.now() - t0;
console.log('15 000 so\'z:', n.stat.jami, 'so\'z,', vaqt, 'ms');
assert(n.stat.jami >= 15000 && vaqt < 2000);
assert(html.includes('<mark>va</mark>'));
console.log('Transkript: hamma sinovlar o\'tdi ✓');
