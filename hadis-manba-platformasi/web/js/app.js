// Hadis Manba PWA — interfeys. Barcha manba matni textContent orqali chiqariladi (HTML sifatida bajarilmaydi).
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var main = $('asosiy');
  var worker = null, searchSeq = 0;
  var catalog = { packages: [] };

  var STATUS_UZ = { verified: 'tasdiqlangan', limited: 'cheklangan', conflict: 'ixtilofli', not_found: 'topilmagan',
    unreviewed: "ko'rilmagan", not_applicable: 'tegishli emas' };
  var STATUS_LABEL = { text_preservation_status: 'matn', number_status: 'raqam', narrator_identity_status: 'roviy',
    commentary_link_status: "bog'lama", commentary_start_status: 'boshlanish', commentary_end_status: 'tugash',
    printed_page_status: 'bosma sahifa', semantic_review_status: 'mazmuniy tekshiruv', source_identity_status: 'manba',
    edition_identity_status: 'nashr', transport_integrity: 'yaxlitlik', rights_status: 'huquq' };
  var ROLE_UZ = { hadith_text: 'Hadis lafzi', commentator: 'Shorih', quoted_scholar: 'Naql (boshqa olim)',
    editor_note: 'Muhaqqiq hoshiyasi', attribution_unresolved: 'Mualliflik aniqlanmagan' };
  var TYPE_UZ = { hadith: 'hadis', athar_sahabi: 'sahoba asari', athar_tabii: "tobi'iy asari", author_statement: 'muallif bayoni',
    chapter_heading: 'bob sarlavhasi', editor_note: 'muharrir izohi', introduction: 'muqaddima', text_block: 'matn bloki', test_fixture: 'sinov' };
  var ATTR_UZ = { marfu: "marfu' (nisbat turi, hukm emas)", mawquf: 'mavquf', maqtu: "maqtu'", mursal: 'mursal (nisbat turi)',
    balagh: "balog'", not_applicable: 'tegishli emas', unknown: "noma'lum" };
  var LINK_STATE_UZ = { active: 'faol', base_not_installed: "asosiy kitob o'rnatilmagan", incompatible_base_version: 'asosiy kitob versiyasi mos emas',
    target_unit_missing: "asos birligi topilmadi", not_declared: "e'lon qilinmagan" };

  // ---------------------------------------------------------------- DOM yordamchi
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in (attrs || {})) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k === 'on') for (var ev in v) e.addEventListener(ev, v[ev]);
      else if (k === 'cls') e.className = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function ar(text, extra) { return el('p', Object.assign({ lang: 'ar', dir: 'rtl', cls: 'ar' }, extra || {}), [text]); }
  function arSpan(text) { return el('span', { lang: 'ar', dir: 'rtl', cls: 'ar-i' }, [text]); }
  function badge(key, val) {
    return el('span', { cls: 'belgi h-' + val, title: key + '=' + val }, [(STATUS_LABEL[key] || key) + ': ' + (STATUS_UZ[val] || val)]);
  }
  function statusRow(st) {
    var keys = Object.keys(st || {}).filter(function (k) { return k !== 'rights_status' && k !== 'transport_integrity'; });
    return el('div', { cls: 'belgilar' }, keys.map(function (k) { return badge(k, st[k]); }));
  }
  function limits(list) {
    if (!list || !list.length) return null;
    return el('ul', { cls: 'cheklov' }, list.map(function (l) { return el('li', { text: l }); }));
  }
  function clear() { main.textContent = ''; window.scrollTo(0, 0); }
  function toast(msg, bad) {
    var t = el('div', { cls: 'xabar' + (bad ? ' yomon' : ''), role: 'status', text: msg });
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 4500);
  }
  function download(name, blob) {
    var a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Nusxalandi'); }
    catch (e) { var ta = el('textarea', { cls: 'nusxa-maydon' }); ta.value = text; main.appendChild(ta); ta.select(); toast("Belgilangan matnni qo'lda nusxalang"); }
  }

  async function workTitle(workId) {
    var w = await Lib.ent('works', workId);
    if (!w) { var c = catalog.packages.find(function (p) { return p.work_id === workId; }); return c ? (c.title.ar || c.title.uz) : workId; }
    return w.title_ar || w.title_uz || workId;
  }
  async function personName(id) {
    if (!id) return null;
    var p = await Lib.ent('persons', id);
    return p ? (p.name_ar || p.name_uz) : id;
  }
  async function schemeLabel(id) { var s = await Lib.ent('numbering_schemes', id); return s ? s.label : id; }
  async function numbersText(numbers) {
    var out = [];
    for (var n of (numbers || [])) {
      var lbl = await schemeLabel(n.scheme_id);
      if (n.number_text == null) out.push(lbl + ': raqamsiz' + (n.original_value ? ' (' + n.original_value + ')' : ''));
      else out.push(lbl + ': ' + (n.volume ? n.volume + '-jild, ' : '') + n.number_text + (n.variant ? ' (' + n.variant + ')' : ''));
    }
    return out;
  }

  // ---------------------------------------------------------------- qidiruv
  function getWorker() {
    if (!worker) worker = new Worker('./js/search-worker.js');
    return worker;
  }
  async function viewSearch(params) {
    clear();
    var pk = await Lib.packages();
    main.appendChild(el('h1', { text: 'Qidiruv' }));
    if (!pk.length) {
      main.appendChild(el('div', { cls: 'karta' }, [el('p', { text: "Hali hech qaysi kitob o'rnatilmagan. Avval \"Kitoblar\" bo'limidan kitob yoki sharh o'rnating." }),
        el('a', { cls: 'tugma asosiy', href: '#/kitoblar', text: 'Kitoblarga o\'tish' })]));
    }
    var q = el('input', { id: 'q', type: 'search', lang: 'ar', dir: 'auto', placeholder: 'Arabcha ibora…', 'aria-label': 'Qidiruv iborasi', value: params.q || '' });
    var mode = el('select', { id: 'rejim', 'aria-label': 'Qidiruv turi' }, [el('option', { value: 'normalized', text: 'Harakatsiz (tavsiya)' }), el('option', { value: 'exact', text: 'Aniq ibora (harakat bilan)' })]);
    var scope = el('select', { id: 'doira', 'aria-label': 'Qayerda' }, [el('option', { value: 'all', text: "Hammasida" }), el('option', { value: 'base', text: 'Faqat asos matnda' }), el('option', { value: 'commentary', text: 'Faqat sharhda' })]);
    var authors = el('select', { id: 'muallif', 'aria-label': 'Shorih' }, [el('option', { value: '', text: 'Har qanday shorih' })]);
    var cpk = pk.filter(function (p) { return p.kind === 'commentary'; });
    for (var c of cpk) for (var a of (c.manifest.author_ids || [])) authors.appendChild(el('option', { value: a, text: (await personName(a)) + ' — o\'z nasri' }));
    var vonly = el('input', { type: 'checkbox', id: 'faqat-tasdiq' });
    mode.value = params.mode || 'normalized'; scope.value = params.scope || 'all';
    var res = el('div', { id: 'natijalar', 'aria-live': 'polite' });
    var form = el('form', { cls: 'karta', role: 'search', on: { submit: function (e) { e.preventDefault(); run(); } } }, [
      q, el('div', { cls: 'qator' }, [mode, scope, authors]),
      el('label', { cls: 'kichik' }, [vonly, ' Faqat matni va raqami tasdiqlanganlar']),
      el('button', { cls: 'asosiy keng', type: 'submit', text: 'Qidirish' })]);
    main.appendChild(form);
    main.appendChild(await numberForm(pk));
    main.appendChild(res);
    async function run() {
      var text = q.value.trim();
      if (!text) return;
      var act = await Lib.packages();
      var id = ++searchSeq;
      res.textContent = '';
      res.removeAttribute('data-tayyor');
      res.appendChild(el('p', { cls: 'xira', text: 'Qidirilmoqda…' }));
      var w = getWorker();
      w.onmessage = async function (e) {
        var d = e.data;
        if (d.id !== searchSeq) return;
        if (d.error) { res.textContent = ''; res.appendChild(el('p', { cls: 'yomon', text: 'Xato: ' + d.error })); return; }
        if (!d.done) return;
        await renderHits(res, d, text);
      };
      w.postMessage({ id: id, query: text, mode: mode.value, scope: authors.value ? 'commentary' : scope.value, authorId: authors.value || null,
        verifiedOnly: vonly.checked, pkgvs: act.map(function (p) { return p.active_pkgv; }) });
    }
    if (params.q) run();
  }

  async function renderHits(res, d, query) {
    res.textContent = '';
    res.appendChild(el('p', { cls: 'kichik xira', text: d.total + ' ta natija' + (d.capped ? ' (birinchi 2000 tasi ko\'rsatildi)' : '') + ' · ' + d.ms + ' ms · faqat shu qurilmadagi paketlarda' }));
    res.appendChild(el('p', { cls: 'kichik ogoh', text: "Moslik — matn ichida uchrashish. Bu tasdiqlangan hadis identifikatsiyasi emas." }));
    if (d.total > 25 && Arabic.normalize(query).length < 8) res.appendChild(el('p', { cls: 'kichik ogoh', text: "Qisqa umumiy ibora: ko'p nomzod chiqdi, aniqroq yozing." }));
    var shown = 0;
    for (var h of d.hits) {
      if (shown++ >= 200) { res.appendChild(el('p', { cls: 'xira', text: "Yana natijalar bor — so'rovni aniqlashtiring." })); break; }
      var sn = h.snippet, chars = Array.from(sn.text);
      var p = el('p', { lang: 'ar', dir: 'rtl', cls: 'ar parcha' }, [
        (sn.truncated && sn.original_offset > 0 ? '… ' : '') + chars.slice(0, sn.match_start).join(''),
        el('mark', { text: chars.slice(sn.match_start, sn.match_end).join('') }),
        chars.slice(sn.match_end).join('') + (sn.truncated ? ' …' : '')]);
      var title = await workTitle(h.work_id);
      var nums = h.kind === 'unit' ? (await numbersText(h.numbers)).join(' · ') : '';
      var layer = h.kind === 'unit' ? 'Asos matn' : (ROLE_UZ[h.layer] || h.layer) + (h.layer_person ? ' — ' + (await personName(h.layer_person)) : '');
      res.appendChild(el('a', { cls: 'karta natija', href: (h.kind === 'unit' ? '#/h/' : '#/s/') + encodeURIComponent(h.id) }, [
        el('div', { cls: 'natija-bosh' }, [arSpan(title), el('span', { cls: 'xira kichik', text: ' · ' + layer + (nums ? ' · ' + nums : '') })]),
        p, statusRow(h.statuses)]));
    }
    res.setAttribute('data-tayyor', '1');
  }

  async function numberForm(pk) {
    var bases = pk.filter(function (p) { return p.kind === 'base_book'; });
    var works = [];
    bases.forEach(function (b) { if (works.indexOf(b.manifest.work_id) < 0) works.push(b.manifest.work_id); });
    var wsel = el('select', { 'aria-label': 'Kitob' });
    for (var w of works) wsel.appendChild(el('option', { value: w, text: await workTitle(w) }));
    var num = el('input', { type: 'text', inputmode: 'numeric', placeholder: 'Raqam', 'aria-label': 'Raqam' });
    var vol = el('input', { type: 'text', inputmode: 'numeric', placeholder: 'Jild (ixtiyoriy)', 'aria-label': 'Jild' });
    var out = el('div');
    var f = el('form', { cls: 'karta', on: { submit: async function (e) {
      e.preventDefault();
      out.textContent = '';
      if (!num.value.trim()) return;
      var r = await Lib.resolve(wsel.value, num.value, null, vol.value.trim() || null);
      if (!r.length) { out.appendChild(el('p', { text: 'Bu raqam o\'rnatilgan nashrlarda topilmadi (not_found). Boshqa nashr o\'rnatilmagan bo\'lishi mumkin.' })); return; }
      if (r.length > 1) out.appendChild(el('p', { cls: 'ogoh kichik', text: r.length + " ta nomzod (jild/tizim/nashr). Birinchisi avtomatik tanlanmadi — o'zingiz tanlang." }));
      for (var c of r) {
        out.appendChild(el('a', { cls: 'karta natija', href: '#/h/' + encodeURIComponent(c.unit.unit_id) }, [
          el('div', { cls: 'kichik', text: (await schemeLabel(c.number.scheme_id)) + ': ' + (c.number.volume ? c.number.volume + '-jild, ' : '') + c.number.number_text + (c.grouped ? ' (guruhli raqam)' : '') + ' · ' + c.unit.edition_id }),
          ar(Array.from(c.unit.text_ar).slice(0, 160).join(''))]));
      }
    } } }, [el('h2', { text: 'Raqam bilan topish' }), works.length ? null : el('p', { cls: 'xira kichik', text: "Asosiy kitob o'rnatilmagan." }),
      el('div', { cls: 'qator' }, [wsel, num, vol]), el('button', { type: 'submit', text: 'Topish' }), out]);
    return f;
  }

  // ---------------------------------------------------------------- hadis
  async function viewUnit(id) {
    clear();
    var u = await Lib.unit(id);
    if (!u) {
      main.appendChild(el('div', { cls: 'karta' }, [el('h1', { text: 'Topilmadi' }),
        el('p', { text: id + " — bu birlik shu qurilmada o'rnatilmagan (not_installed) yoki mavjud emas." }),
        el('a', { cls: 'tugma asosiy', href: '#/kitoblar', text: "Asosiy kitobni o'rnatish" })]));
      return;
    }
    var grid = el('div', { cls: 'ikki-panel' });
    var left = el('section', { cls: 'panel', 'aria-label': 'Asos matn' });
    var right = el('section', { cls: 'panel sharh-panel', id: 'sharh-panel', 'aria-label': 'Sharhlar' });
    grid.appendChild(left); grid.appendChild(right);
    main.appendChild(grid);
    left.appendChild(el('p', { cls: 'kichik xira' }, [arSpan(await workTitle(u.work_id)), ' · ' + u.edition_id + ' · ' + (TYPE_UZ[u.unit_type] || u.unit_type) + ' · ' + (ATTR_UZ[u.attribution_kind] || '')]));
    if (u.chapter_ar) left.appendChild(el('p', { lang: 'ar', dir: 'rtl', cls: 'ar bob', text: u.chapter_ar }));
    left.appendChild(ar(u.text_ar, { cls: 'ar matn' }));
    left.appendChild(statusRow(u.statuses));
    left.appendChild(limits(u.limitations));
    var nums = await numbersText(u.numbers);
    left.appendChild(el('ul', { cls: 'raqamlar' }, nums.map(function (t) { return el('li', { text: t }); })));
    var actions = el('div', { cls: 'qator' });
    var bm = await Notes.get('bookmark:' + id);
    actions.appendChild(el('button', { text: bm ? "★ Xatcho'pdan olish" : "☆ Xatcho'p", on: { click: async function () {
      if (bm) await Notes.del('bookmark:' + id); else await Notes.put({ key: 'bookmark:' + id, type: 'bookmark', target: id, label: Array.from(u.text_ar).slice(0, 60).join('') });
      viewUnit(id);
    } } }));
    actions.appendChild(el('button', { text: 'Iqtibosni nusxalash', on: { click: async function () { copy(await unitCitation(u)); } } }));
    left.appendChild(actions);
    left.appendChild(await noteBox(id));
    var det = el('details', {}, [el('summary', { text: 'Dalil tafsiloti' })]);
    var inner = el('div', { cls: 'ichki kichik' });
    for (var n of (u.narrators || [])) {
      inner.appendChild(el('p', { text: 'Terminal roviy: ' + ((await personName(n.terminal_person_id)) || "noma'lum (unknown_terminal_person)") +
        (n.fallback_person_id ? ' · zaxira (topilgan ism emas): ' + (await personName(n.fallback_person_id)) : '') +
        ' · holat: ' + (STATUS_UZ[n.narrator_identity_status] || n.narrator_identity_status) + (n.original_value ? ' · original: ' + n.original_value : '') + (n.reason ? ' · ' + n.reason : '') }));
    }
    for (var g of (u.gradings || [])) inner.appendChild(el('p', { text: 'Hukm: ' + g.grade + ' — ' + (await personName(g.scholar_person_id)) + ', ' + g.source_ref + (g.scope ? ' (' + g.scope + ')' : '') }));
    for (var t of (u.topics || [])) inner.appendChild(el('p', { text: 'Mavzu: ' + t.topic + ' [' + ({ source_heading: 'manba sarlavhasi', editorial_tag: 'tahririy teg/tarjima', ai_suggestion: 'AI taklifi — muallif sarlavhasi emas' }[t.origin] || t.origin) + ']' }));
    for (var i of (u.identifiers || [])) inner.appendChild(el('p', { text: 'ID ' + i.namespace + ':' + i.value + (i.namespace === 'row' ? ' — kirish jadvali qatori, bosma raqam emas' : '') }));
    inner.appendChild(el('p', { cls: 'xesh', text: 'raw_sha256: ' + (u.raw_sha256 || '—') }));
    inner.appendChild(el('p', { cls: 'xesh', text: 'current_text_sha256: ' + u.current_text_sha256 }));
    inner.appendChild(el('p', { cls: 'xesh', text: 'unit_id: ' + u.unit_id + ' · paket: ' + u.pkgv }));
    det.appendChild(inner);
    left.appendChild(det);

    right.appendChild(el('h2', { text: "O'rnatilgan sharhlar" }));
    var cs = await Lib.commentariesFor(id);
    if (!cs.length) right.appendChild(el('p', { cls: 'xira', text: "Bu hadisga o'rnatilgan sharhlarda faol bog'lama yo'q. Bu sharh yozilmagan degani emas." }));
    for (var c of cs) {
      right.appendChild(el('a', { cls: 'karta natija', href: '#/s/' + encodeURIComponent(c.occ.occurrence_id) + '?from=' + encodeURIComponent(id) }, [
        el('div', {}, [arSpan(await workTitle(c.occ.work_id)), el('span', { cls: 'kichik xira', text: ' · ' + c.occ.link_kind + ' · ' + (c.occ.scope === 'full_section' ? "to'liq bo'lim" : c.occ.scope === 'preview_window' ? "ko'rish oynasi" : 'parcha') + (c.occ.page ? ' · ' + (c.occ.volume ? c.occ.volume + ':' : '') + c.occ.page : '') })]),
        el('div', { cls: 'belgilar' }, [badge('commentary_link_status', c.link.commentary_link_status), c.link.legacy_confidence ? el('span', { cls: 'belgi', text: 'eski baho: ' + c.link.legacy_confidence + ' (qayta tekshirilmagan)' }) : null])]));
    }
    var pos = await Notes.get('position:last');
    await Notes.put({ key: 'position:last', type: 'position', target: id });
    return pos;
  }

  async function noteBox(id) {
    var n = await Notes.get('note:' + id);
    var ta = el('textarea', { rows: 3, 'aria-label': 'Shaxsiy qayd', placeholder: 'Shaxsiy qayd (faqat shu qurilmada)…' });
    ta.value = n ? n.text : '';
    return el('div', { cls: 'qayd' }, [ta, el('button', { text: 'Qaydni saqlash', on: { click: async function () {
      if (ta.value.trim()) await Notes.put({ key: 'note:' + id, type: 'note', target: id, text: ta.value });
      else await Notes.del('note:' + id);
      toast('Saqlandi');
    } } })]);
  }

  async function unitCitation(u) {
    var nums = await numbersText(u.numbers);
    var ed = await Lib.ent('editions', u.edition_id);
    return [(await workTitle(u.work_id)) + ', ' + (nums.join('; ') || "raqam noma'lum") + '.',
      'Nashr: ' + (ed && ed.label || u.edition_id) + '.',
      'Iqtibos: ' + u.text_ar,
      'Qamrov: ' + (u.text_kind === 'full' ? "to'liq mahalliy birlik" : u.text_kind) + '.',
      'Holat: ' + Object.keys(u.statuses || {}).map(function (k) { return k + '=' + u.statuses[k]; }).join(', ') + (u.limitations && u.limitations.length ? '; cheklov: ' + u.limitations.join(' | ') : '') + '.',
      'Manba: ' + u.unit_id + ' @ ' + u.pkgv].join('\n');
  }

  // ---------------------------------------------------------------- sharh
  async function viewOcc(id, from) {
    clear();
    var o = await Lib.occurrence(id);
    if (!o) { main.appendChild(el('div', { cls: 'karta' }, [el('h1', { text: 'Topilmadi' }), el('p', { text: id + " o'rnatilmagan." })])); return; }
    var st = o.statuses || {};
    var endOk = o.scope === 'full_section' && st.commentary_end_status === 'verified';
    var work = (await Lib.ent('works', o.work_id)) || {};
    var author = await personName((work.author_ids || [])[0]);
    main.appendChild(el('p', { cls: 'kichik xira' }, [arSpan(await workTitle(o.work_id)), author ? ' · ' : '', author ? arSpan(author) : null,
      ' · ' + o.edition_id + (o.page ? ' · ' + (o.volume ? o.volume + ':' : '') + o.page : " · sahifa noma'lum")]));
    if (o.lemma_kind === 'iqtibos_yoq') main.appendChild(el('p', { cls: 'ogoh kichik', text: "Manbada alohida hadis iqtibosi yo'q (iqtibos_yoq) — sun'iy boshlanish qo'shilmadi." }));
    else if (o.lemma_text) main.appendChild(el('p', { cls: 'kichik' }, ['Lemma (' + o.lemma_kind + '): ', arSpan(o.lemma_text)]));
    if (!endOk) main.appendChild(el('p', { cls: 'ogoh', text: o.scope === 'fragment' ? 'Parcha (fragment).' : "Ko'rish oynasi: sharh tugash chegarasi tasdiqlanmagan — keyingi matn shu sharhga tegishli deb hisoblanmaydi." }));
    var text = Array.from(o.text_ar);
    var shown = endOk ? text : text.slice(0, 1500);
    var box = el('div', { cls: 'segmentlar' });
    for (var s of (o.segments || [])) {
      if (s.start >= shown.length) continue;
      var who = await personName(s.person_id);
      box.appendChild(el('div', { cls: 'segment r-' + s.role }, [el('div', { cls: 'kichik rol', text: (ROLE_UZ[s.role] || s.role) + (who ? ' — ' : '') }, who ? [arSpan(who)] : []),
        ar(shown.slice(s.start, Math.min(s.end, shown.length)).join(''))]));
    }
    if (!(o.segments || []).length) box.appendChild(ar(shown.join('')));
    if (shown.length < text.length) box.appendChild(el('p', { cls: 'xira kichik', text: '[…] ko\'rish oynasi ' + shown.length + ' belgida tugadi' }));
    main.appendChild(box);
    main.appendChild(statusRow(st));
    main.appendChild(limits(o.limitations));
    var links = await Lib.linksOfOccurrence(id);
    var back = el('div', { cls: 'karta' }, [el('h2', { text: 'Asos hadis' })]);
    if (o.link_kind === 'umumiy') back.appendChild(el('p', { cls: 'kichik ogoh', text: "Umumiy sharh: bitta uchrashuv bir nechta hadisga tegishli." }));
    for (var l of links) {
      if (l.activation.state === 'active') {
        var u = await Lib.unit(l.link.target_unit_id);
        back.appendChild(el('a', { cls: 'tugma' + (from === l.link.target_unit_id ? ' asosiy' : ''), href: '#/h/' + encodeURIComponent(l.link.target_unit_id), text: '← Asos hadisga qaytish: ' + (await numbersText(u.numbers))[0] }));
      } else {
        back.appendChild(el('p', { cls: 'kichik', text: l.link.target_work_id + ' / ' + l.link.target_edition_id + ' / ' + l.link.target_unit_id + ' — ' + (LINK_STATE_UZ[l.activation.state] || l.activation.state) }));
        if (l.activation.state === 'base_not_installed') back.appendChild(el('a', { cls: 'tugma', href: '#/kitoblar', text: "Asosiy kitobni o'rnatish" }));
      }
    }
    main.appendChild(back);
    main.appendChild(el('button', { text: 'Iqtibosni nusxalash', on: { click: async function () {
      var lines = [];
      for (var s2 of (o.segments || [])) {
        if (s2.start >= shown.length) continue;
        lines.push('Iqtibos [' + (ROLE_UZ[s2.role] || s2.role) + ((await personName(s2.person_id)) ? ' — ' + (await personName(s2.person_id)) : '') + ']: ' + shown.slice(s2.start, Math.min(s2.end, shown.length)).join('').trim());
      }
      var ed = await Lib.ent('editions', o.edition_id);
      copy([(await workTitle(o.work_id)) + ', ' + (ed && ed.label || o.edition_id) + ', ' + (o.page ? (o.volume ? o.volume + ':' : '') + o.page : "jild:sahifa noma'lum") + '.']
        .concat(lines, ['Qamrov: ' + (endOk ? "to'liq mahalliy bo'lim" : o.scope === 'fragment' ? 'parcha' : "ko'rish oynasi (tugash tasdiqlanmagan)") + '.',
          'Holat: ' + Object.keys(st).map(function (k) { return k + '=' + st[k]; }).join(', ') + '.', 'Manba: ' + o.occurrence_id + ' @ ' + o.pkgv]).join('\n'));
    } } }));
    main.appendChild(await noteBox(id));
  }

  // ---------------------------------------------------------------- kitoblar va paketlar
  async function loadCatalog() {
    try {
      var r = await fetch('./catalog.json', { cache: 'no-cache' });
      if (r.ok) catalog = await r.json();
    } catch (e) { /* oflayn: o'rnatilganlar baribir ko'rinadi */ }
  }

  async function viewBooks() {
    clear();
    main.appendChild(el('h1', { text: 'Kitoblar' }));
    var pk = await Lib.packages();
    var installed = {};
    pk.forEach(function (p) { installed[p.package_id] = p; });
    var items = catalog.packages.slice();
    pk.forEach(function (p) { if (!items.find(function (c) { return c.package_id === p.package_id; })) items.push({ package_id: p.package_id, kind: p.kind, package_version: p.version, title: p.manifest.title, work_id: p.manifest.work_id, edition_id: p.manifest.edition_id, requires_for_linked_reading: p.manifest.requires_for_linked_reading || [], rights: p.manifest.rights, local_only: true }); });
    if (catalog.packages.some(function (c) { return c.is_test_fixture; })) {
      main.appendChild(el('p', { cls: 'ogoh', text: "Bu ommaviy demo faqat SINOV NAMUNASI paketlarini o'z ichiga oladi (sun'iy matn, haqiqiy manba emas). Haqiqiy kitoblar huquqi tasdiqlangach alohida qo'shiladi yoki faylni o'zingiz import qilasiz." }));
    }
    var est = await Lib.estimateFree();
    if (est) main.appendChild(el('p', { cls: 'kichik xira', text: "Qurilmada band: " + Lib.fmtBytes(est.usage) + ' · taxminiy bo\'sh: ' + Lib.fmtBytes(est.free) }));
    var groups = {};
    items.forEach(function (c) {
      var w = c.kind === 'base_book' ? c.work_id : ((c.requires_for_linked_reading || [])[0] || {}).target_work_id || c.work_id;
      (groups[w] = groups[w] || { bases: [], comms: [] })[c.kind === 'base_book' ? 'bases' : 'comms'].push(c);
    });
    for (var w in groups) {
      var g = groups[w];
      var card = el('section', { cls: 'karta' }, [el('h2', {}, [arSpan(await workTitle(w))])]);
      card.appendChild(el('h3', { text: 'Asosiy matn' }));
      if (!g.bases.length) card.appendChild(el('p', { cls: 'xira kichik', text: "Bu asarning asosiy matn paketi katalogda yo'q." }));
      g.bases.forEach(function (c) { card.appendChild(pkgRow(c, installed[c.package_id])); });
      card.appendChild(el('h3', { text: 'Sharhlar' }));
      if (!g.comms.length) card.appendChild(el('p', { cls: 'xira kichik', text: "Katalogda sharh yo'q." }));
      var checks = [];
      g.comms.forEach(function (c) {
        var cb = el('input', { type: 'checkbox', 'data-id': c.package_id, 'aria-label': 'Tanlash' });
        checks.push(cb);
        var row = pkgRow(c, installed[c.package_id]);
        row.insertBefore(cb, row.firstChild);
        card.appendChild(row);
      });
      if (g.bases.length && g.comms.length) {
        (function (g, checks) {
          card.appendChild(el('button', { cls: 'asosiy', text: "Kitob + tanlangan sharhlarni o'rnatish", on: { click: async function () {
            var ids = [g.bases[0].package_id].concat(checks.filter(function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-id'); }));
            for (var id of ids) { var c = catalog.packages.find(function (p) { return p.package_id === id; }); if (c) await installFromCatalog(c); }
            route();
          } } }));
          card.appendChild(el('p', { cls: 'kichik xira', text: "Oldin o'rnatilgan paket qayta yuklanmaydi." }));
        })(g, checks);
      }
      main.appendChild(card);
    }
    main.appendChild(el('section', { cls: 'karta' }, [el('h2', { text: 'Fayldan import' }),
      el('p', { cls: 'kichik', text: ".hmz paket faylini (yoki “kitob + sharhlar” yig'masini) tanlang. Fayl tekshiriladi va faqat shu qurilmaga o'rnatiladi." }),
      el('label', { cls: 'tugma keng' }, ['📂 Paket faylini tanlash', el('input', { type: 'file', accept: '.hmz,.zip,application/zip', cls: 'yashirin', id: 'import-fayl', on: { change: async function (e) {
        var f = e.target.files[0];
        if (!f) return;
        await doInstall(await f.arrayBuffer(), f.name);
        route();
      } } })])]));
  }

  function pkgRow(c, inst) {
    var rights = (c.rights || []).map(function (r) { return r.applies_to + ': ' + r.rights_status + (r.license_id ? ' (' + r.license_id + ')' : ''); }).join('; ');
    var status = inst ? (inst.version === c.package_version || c.local_only ? "o'rnatilgan " + inst.version + (inst.offline_ready ? ' · oflayn tayyor' : ' · tayyorlik tekshirilmagan') : "o'rnatilgan " + inst.version + ' · yangi versiya: ' + c.package_version) : "o'rnatilmagan";
    var row = el('div', { cls: 'paket' }, [
      el('div', { cls: 'paket-matn' }, [el('b', { text: (c.title && (c.title.uz || c.title.ar)) || c.package_id }),
        el('div', { cls: 'kichik xira', text: c.package_id + ' · v' + c.package_version + (c.compressed_bytes ? ' · ' + Lib.fmtBytes(c.compressed_bytes) + ' (o\'rnatilgach ~' + Lib.fmtBytes(c.installed_bytes) + ')' : '') + (c.edition_id ? ' · nashr: ' + c.edition_id : '') }),
        (c.requires_for_linked_reading || []).length ? el('div', { cls: 'kichik', text: "Bog'lanadi: " + c.requires_for_linked_reading.map(function (r) { return r.target_edition_id + ' (' + r.compatible_package_versions.join(', ') + ')'; }).join('; ') }) : null,
        el('div', { cls: 'kichik', text: 'Huquq: ' + (rights || "noma'lum") }),
        el('div', { cls: 'kichik holat', text: status })])]);
    var btns = el('div', { cls: 'paket-tugmalar' });
    if (!c.local_only && (!inst || inst.version !== c.package_version)) btns.appendChild(el('button', { cls: 'asosiy', text: inst ? 'Yangilash' : "O'rnatish", on: { click: async function () { await installFromCatalog(c); route(); } } }));
    if (inst) btns.appendChild(el('button', { text: "O'chirish", on: { click: async function () {
      if (!confirm(c.package_id + " o'chirilsinmi? Shaxsiy qaydlar saqlanadi.")) return;
      await Lib.uninstall(c.package_id); toast("O'chirildi"); route();
    } } }));
    row.appendChild(btns);
    return row;
  }

  async function installFromCatalog(c) {
    var inst = await Lib.getPackage(c.package_id);
    if (inst && inst.sha256 === c.package_sha256) return;
    var st = progressBox(c.package_id);
    try {
      st.set('yuklash', 'Yuklanmoqda…');
      var r = await fetch(c.file, { cache: 'no-store' });
      if (!r.ok) throw new Error('Yuklab bo\'lmadi: HTTP ' + r.status);
      var buf = await readWithProgress(r, c.compressed_bytes, function (p) { st.set('yuklash', 'Yuklanmoqda ' + Math.round(p * 100) + '%'); });
      var sha = await Pkg.sha256Hex(buf);
      if (c.package_sha256 && sha !== c.package_sha256) throw new Error('Yuklangan fayl katalogdagi xeshga mos emas');
      await Lib.install(buf, st.set);
      st.ok();
    } catch (e) {
      st.fail(e.message + ' — eski kutubxona o\'zgarmadi. Qayta urinib ko\'ring.');
      throw e;
    }
  }

  async function doInstall(buf, name) {
    var st = progressBox(name);
    try {
      var res = await Lib.install(buf, st.set);
      st.ok(res.map(function (r) { return r.package_id + ': ' + r.action; }).join(', '));
    } catch (e) { st.fail(e.message); }
  }

  async function readWithProgress(resp, expected, cb) {
    if (!resp.body || !resp.body.getReader) return resp.arrayBuffer();
    var reader = resp.body.getReader(), chunks = [], got = 0;
    for (;;) {
      var x = await reader.read();
      if (x.done) break;
      chunks.push(x.value); got += x.value.length;
      if (expected) cb(Math.min(1, got / expected));
    }
    var out = new Uint8Array(got), o = 0;
    chunks.forEach(function (c) { out.set(c, o); o += c.length; });
    return out.buffer;
  }

  var STATE_UZ = { yuklash: '1/6 Yuklash', tekshirish: '2/6 Xesh tekshiruvi', joy: '3/6 Joy', staging: '4/6 Staging', faollashtirish: "5/6 O'rnatish", tayyorlik: '6/6 Qidiruv tayyorligi', tayyor: 'Tayyor' };
  function progressBox(name) {
    var box = el('div', { cls: 'xabar doimiy', role: 'status' }, [el('b', { text: name }), el('div', { cls: 'kichik', text: '…' })]);
    document.body.appendChild(box);
    return {
      set: function (s, msg) { box.lastChild.textContent = (STATE_UZ[s] || s) + ': ' + (msg || ''); },
      ok: function (msg) { box.lastChild.textContent = 'Oflayn tayyor' + (msg ? ' — ' + msg : ''); setTimeout(function () { box.remove(); }, 3500); },
      fail: function (msg) { box.classList.add('yomon'); box.lastChild.textContent = 'Xato: ' + msg; box.appendChild(el('button', { text: 'Yopish', on: { click: function () { box.remove(); } } })); }
    };
  }

  async function viewPackages() {
    clear();
    main.appendChild(el('h1', { text: "O'rnatilgan paketlar" }));
    var pk = await Lib.packages();
    if (!pk.length) main.appendChild(el('p', { text: "Hech narsa o'rnatilmagan." }));
    for (var p of pk) {
      (function (p) {
        main.appendChild(el('div', { cls: 'karta paket' }, [el('div', { cls: 'paket-matn' }, [
          el('b', { text: (p.manifest.title && (p.manifest.title.uz || p.manifest.title.ar)) || p.package_id }),
          el('div', { cls: 'kichik', text: p.package_id + ' · ' + p.kind + ' · v' + p.version + ' · ' + Lib.fmtBytes(p.bytes) + ' · ' + (p.offline_ready ? 'oflayn tayyor' : 'tayyorlik tekshirilmagan') }),
          el('div', { cls: 'kichik xesh', text: 'sha256: ' + p.sha256 }),
          el('details', {}, [el('summary', { text: 'Litsenziya va nisbat' }), el('pre', { cls: 'kichik', text: p.license + '\n' + p.attribution })])]),
          el('div', { cls: 'paket-tugmalar' }, [
            el('a', { cls: 'tugma', href: '#/kitob/' + encodeURIComponent(p.package_id), text: 'Ochish' }),
            el('button', { text: 'Faylga eksport', on: { click: async function () { download(p.package_id + '-' + p.version + '.hmz', await Lib.exportPackage(p.package_id)); } } }),
            p.previous ? el('button', { text: 'Oldingi versiyaga qaytish (' + p.previous.version + ')', on: { click: async function () { var st = progressBox(p.package_id); try { await Lib.rollback(p.package_id, st.set); st.ok(); } catch (e) { st.fail(e.message); } route(); } } }) : null,
            el('button', { text: "O'chirish", on: { click: async function () { if (confirm("O'chirilsinmi? Shaxsiy qaydlar saqlanadi.")) { await Lib.uninstall(p.package_id); route(); } } } })])]));
      })(p);
    }
    var persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
    main.appendChild(el('section', { cls: 'karta' }, [el('h2', { text: 'Saqlash' }),
      el('p', { cls: 'kichik', text: persisted ? "Brauzer ma'lumotni doimiy saqlashga rozi bo'lgan." : "Brauzer joy tanqisligida ma'lumotni o'chirishi mumkin. Doimiy saqlashni so'rang va paket fayllarini zaxiralang." }),
      persisted ? null : el('button', { text: "Doimiy saqlashni so'rash", on: { click: async function () { var ok = navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; toast(ok ? 'Ruxsat berildi' : 'Brauzer rad etdi yoki qo\'llamaydi'); route(); } } })]));
  }

  async function viewBook(pid) {
    clear();
    var p = await Lib.getPackage(pid);
    if (!p) { main.appendChild(el('p', { text: "O'rnatilmagan." })); return; }
    main.appendChild(el('h1', {}, [arSpan(await workTitle(p.manifest.work_id))]));
    main.appendChild(el('p', { cls: 'kichik xira', text: p.package_id + ' · ' + (p.manifest.edition_id || '') }));
    var list = el('ol', { cls: 'mundarija' });
    var lastChapter = null;
    if (p.kind === 'base_book') {
      for (var u of await Lib.unitsOf(p.active_pkgv)) {
        if (u.chapter_ar && u.chapter_ar !== lastChapter) { list.appendChild(el('li', { cls: 'bob-li' }, [arSpan(u.chapter_ar)])); lastChapter = u.chapter_ar; }
        var nums = await numbersText(u.numbers);
        list.appendChild(el('li', {}, [el('a', { href: '#/h/' + encodeURIComponent(u.unit_id) }, [el('span', { cls: 'kichik xira', text: (nums[0] || TYPE_UZ[u.unit_type]) + ' · ' }), arSpan(Array.from(u.text_ar).slice(0, 70).join('') + '…')])]));
      }
    } else {
      for (var o of await Lib.occOf(p.active_pkgv)) {
        list.appendChild(el('li', {}, [el('a', { href: '#/s/' + encodeURIComponent(o.occurrence_id) }, [el('span', { cls: 'kichik xira', text: o.occurrence_id + ' · ' + o.link_kind + ' · ' }), arSpan(Array.from(o.text_ar).slice(0, 70).join('') + '…')])]));
      }
    }
    main.appendChild(list);
  }

  async function viewCoverage() {
    clear();
    main.appendChild(el('h1', { text: 'Qamrov va cheklovlar' }));
    main.appendChild(el('p', { cls: 'kichik', text: "Faqat shu qurilmadagi paketlar. Foiz faqat maxraj tasdiqlangan bo'lsa ko'rsatiladi. 'Oxirgi raqam bor'dan matn to'liq degan xulosa chiqmaydi." }));
    for (var p of await Lib.packages()) {
      var c = p.manifest.coverage || {};
      var den = (p.coverage || {}).denominator;
      var rows = [];
      Object.keys(c).forEach(function (k) { if (k !== 'kind') rows.push(el('tr', {}, [el('th', { text: k }), el('td', { text: typeof c[k] === 'object' ? JSON.stringify(c[k]) : String(c[k]) })])); });
      var pct = den && den.verified && den.value && c.source_records != null ? (100 * c.source_records / den.value).toFixed(1) + '% (maxraj: ' + den.value + ', ' + (den.basis || '') + ')' : "foiz hisoblanmadi — maxraj tasdiqlanmagan";
      main.appendChild(el('section', { cls: 'karta' }, [el('h2', { text: p.package_id }), el('p', { cls: 'kichik', text: pct }), el('div', { cls: 'jadval-o' }, [el('table', { cls: 'kichik' }, rows)])]));
    }
  }

  async function viewNotes() {
    clear();
    main.appendChild(el('h1', { text: "Xatcho'p va qaydlar" }));
    main.appendChild(el('p', { cls: 'kichik', text: "Qaydlar paketlardan alohida saqlanadi: paket yangilansa yoki o'chirilsa ham qoladi." }));
    var items = (await Notes.all()).filter(function (i) { return i.type !== 'position'; });
    if (!items.length) main.appendChild(el('p', { cls: 'xira', text: "Hali yo'q." }));
    items.forEach(function (i) {
      var href = (i.target.indexOf(':o') > 0 ? '#/s/' : '#/h/') + encodeURIComponent(i.target);
      main.appendChild(el('a', { cls: 'karta natija', href: href }, [el('b', { text: i.type === 'bookmark' ? "★ Xatcho'p" : '✎ Qayd' }), el('div', { cls: 'kichik', text: i.target }), i.label ? ar(i.label) : null, i.text ? el('p', { text: i.text }) : null]));
    });
    main.appendChild(el('div', { cls: 'qator' }, [
      el('button', { text: '⬇️ Qaydlarni eksport (JSON)', on: { click: async function () { download('hadis-manba-qaydlar-' + new Date().toISOString().slice(0, 10) + '.json', new Blob([await Notes.exportJson()], { type: 'application/json' })); } } }),
      el('label', { cls: 'tugma' }, ['⬆️ Qaydlarni tiklash', el('input', { type: 'file', accept: '.json,application/json', cls: 'yashirin', on: { change: async function (e) {
        try { var n = await Notes.importJson(await e.target.files[0].text()); toast(n + ' ta yozuv tiklandi'); route(); } catch (err) { toast(err.message, true); }
      } } })])]));
  }

  function viewAi() {
    clear();
    main.appendChild(el('h1', { text: 'AIga ulash (ixtiyoriy)' }));
    main.appendChild(el('p', { text: "Dastur AIsiz to'liq ishlaydi. AI ulash faqat kompyuterda, Python bilan o'rnatilgan hadis-manba MCP server orqali bo'ladi. Telefon ilovasi AIga ulanmaydi." }));
    var cfg = JSON.stringify({ mcpServers: { 'hadis-manba': { command: 'hadis-manba', args: ['mcp'] } } }, null, 2);
    main.appendChild(el('section', { cls: 'karta' }, [el('h2', { text: 'MCP qo\'llovchi mijoz uchun sozlama' }), el('pre', { cls: 'kod', dir: 'ltr', text: cfg }),
      el('button', { text: 'Nusxalash', on: { click: function () { copy(cfg); } } }),
      el('p', { cls: 'kichik', text: "Batafsil: docs/AI-ULASH.md. Qaysi mijozlarda sinalgani shu hujjatda alohida yozilgan — boshqa mijozlar ishlashi va'da qilinmaydi." })]));
    main.appendChild(el('section', { cls: 'karta' }, [el('h2', { text: "MCP'siz AI uchun" }),
      el('p', { text: "Hadis yoki sharh sahifasidagi “Iqtibosni nusxalash” tugmasi manba kartasini beradi — uni AI suhbatiga joylang. Kompyuterda `hadis-manba export ID --format json` ham bor." })]));
  }

  // ---------------------------------------------------------------- marshrut
  async function route() {
    var h = location.hash || '#/';
    var qi = h.indexOf('?');
    var params = {};
    if (qi >= 0) { new URLSearchParams(h.slice(qi + 1)).forEach(function (v, k) { params[k] = v; }); h = h.slice(0, qi); }
    var parts = h.slice(2).split('/');
    document.querySelectorAll('nav a').forEach(function (a) { a.removeAttribute('aria-current'); if (a.getAttribute('href') === '#/' + parts[0]) a.setAttribute('aria-current', 'page'); });
    try {
      if (parts[0] === 'h') await viewUnit(decodeURIComponent(parts.slice(1).join('/')));
      else if (parts[0] === 's') await viewOcc(decodeURIComponent(parts.slice(1).join('/')), params.from);
      else if (parts[0] === 'kitoblar') await viewBooks();
      else if (parts[0] === 'kitob') await viewBook(decodeURIComponent(parts[1]));
      else if (parts[0] === 'paketlar') await viewPackages();
      else if (parts[0] === 'qamrov') await viewCoverage();
      else if (parts[0] === 'qaydlar') await viewNotes();
      else if (parts[0] === 'ai') viewAi();
      else await viewSearch(params);
    } catch (e) {
      clear();
      main.appendChild(el('div', { cls: 'karta yomon' }, [el('h1', { text: 'Xato' }), el('p', { text: String(e && e.message || e) })]));
    }
    main.focus({ preventScroll: true });
  }

  async function start() {
    try { await Lib.cleanup(); } catch (e) { /* birinchi ochilish */ }
    await loadCatalog();
    window.addEventListener('hashchange', route);
    window.addEventListener('online', function () { $('tarmoq').textContent = ''; });
    window.addEventListener('offline', function () { $('tarmoq').textContent = "Internet yo'q — o'rnatilgan paketlar ishlayveradi."; });
    if (!navigator.onLine) $('tarmoq').textContent = "Internet yo'q — o'rnatilgan paketlar ishlayveradi.";
    await route();
    document.documentElement.setAttribute('data-tayyor', '1');
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            var b = $('yangilash'); b.classList.remove('yashirin');
            b.onclick = function () { nw.postMessage('yangila'); };
          }
        });
      });
    });
    // Faqat foydalanuvchi "Yangilash"ni bosgandan keyin qayta yuklanadi (birinchi o'rnatishda emas).
    var hadController = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  }
  window.HadisApp = { route: route };
  start();
})();
