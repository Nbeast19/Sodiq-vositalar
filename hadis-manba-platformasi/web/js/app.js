// Hadis Manba PWA — interfeys (en / ar / uz). Manba matni faqat textContent orqali chiqariladi.
// Oddiy yo'l: Kutubxona -> kitob -> (faqat kitob | kitob + tanlangan sharhlar) -> o'qish/qidirish -> sharh -> manbali iqtibos.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var t = I18N.t, en = I18N.e;
  var main = $('asosiy');
  var worker = null, searchSeq = 0;
  var catalog = { packages: [] };

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
  function arSpan(text) { return el('bdi', { lang: 'ar', dir: 'rtl', cls: 'ar-i' }, [text]); }
  function iso(text) { return el('bdi', { cls: 'iso' }, [String(text)]); }
  function badge(key, val) {
    return el('span', { cls: 'belgi h-' + val, title: key + '=' + val }, [en('statusKey', key) + ': ' + en('status', val)]);
  }
  function statusRow(st) {
    var keys = Object.keys(st || {}).filter(function (k) { return k !== 'rights_status' && k !== 'transport_integrity'; });
    return el('div', { cls: 'belgilar' }, keys.map(function (k) { return badge(k, st[k]); }));
  }
  function limits(list) {
    if (!list || !list.length) return null;
    return el('details', { cls: 'cheklov-d' }, [el('summary', { text: t('cite.notes') + ' (' + list.length + ')' }),
      el('ul', { cls: 'cheklov', lang: 'uz', dir: 'ltr' }, list.map(function (l) { return el('li', { text: l }); }))]);
  }
  function clear() { main.textContent = ''; window.scrollTo(0, 0); }
  function toast(msg, bad) {
    var x = el('div', { cls: 'xabar' + (bad ? ' yomon' : ''), role: 'status', text: msg });
    document.body.appendChild(x);
    setTimeout(function () { x.remove(); }, 4500);
  }
  function download(name, blob) {
    var a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast(t('copied')); }
    catch (e) { var ta = el('textarea', { cls: 'nusxa-maydon', 'data-act': 'copy-fallback' }); ta.value = text; main.appendChild(ta); ta.select(); toast(t('copyManual')); }
    var last = el('textarea', { cls: 'yashirin', id: 'oxirgi-nusxa' }); last.value = text;
    var old = $('oxirgi-nusxa'); if (old) old.remove(); document.body.appendChild(last);
  }
  function btn(label, act, onclick, cls) { return el('button', { cls: cls || '', 'data-act': act, text: label, on: { click: onclick } }); }

  // ---------------------------------------------------------------- nomlar
  function titleOf(c) {
    var tt = c.title || {};
    return { ar: tt.ar || null, other: (I18N.lang() === 'uz' ? tt.uz : null) || tt.en || tt.uz || c.package_id };
  }
  async function workTitle(workId) {
    var w = await Lib.ent('works', workId);
    if (w) return w.title_ar || w.title_en || w.title_uz || workId;
    var c = catalog.packages.find(function (p) { return p.work_id === workId; });
    return c ? (c.title.ar || c.title.en || c.title.uz) : workId;
  }
  async function personName(id) {
    if (!id) return null;
    var p = await Lib.ent('persons', id);
    return p ? (p.name_ar || p.name_en || p.name_uz) : id;
  }
  async function schemeLabel(id) { var s = await Lib.ent('numbering_schemes', id); return s ? s.label : id; }
  async function numbersText(numbers) {
    var out = [];
    for (var n of (numbers || [])) {
      var lbl = await schemeLabel(n.scheme_id);
      if (n.number_text == null) out.push(lbl + ': ' + t('unit.noNumber') + (n.original_value ? ' (' + n.original_value + ')' : ''));
      else out.push(lbl + ': ' + (n.volume ? t('num.vol', { v: n.volume }) + ', ' : '') + n.number_text + (n.variant ? ' (' + n.variant + ')' : ''));
    }
    return out;
  }
  function fold(s) {  // kitob/muallif nomlarini qidirish uchun: arabcha normalizatsiya + lotin harflarini soddalashtirish
    return Arabic.normalize(String(s || '')).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[ʿʾ'`’‘ʻ\-_.]/g, '').replace(/\s+/g, ' ').trim();
  }
  function channelLabel(c) {
    if (c.channel === 'conditional') return t('rights.conditional');
    if (c.channel === 'public') return t('rights.public');
    return t('rights.local');
  }

  // ---------------------------------------------------------------- katalog guruhlari
  async function loadCatalog() {
    try { var r = await fetch('./catalog.json', { cache: 'no-cache' }); if (r.ok) catalog = await r.json(); }
    catch (e) { /* oflayn: o'rnatilganlar baribir ko'rinadi */ }
    try { var r2 = await fetch('./catalog-shartli.json', { cache: 'no-cache' }); if (r2.ok) catalog.packages = catalog.packages.concat((await r2.json()).packages || []); }
    catch (e) { /* ixtiyoriy */ }
  }
  async function groups() {
    var pk = await Lib.packages();
    var items = catalog.packages.slice();
    pk.forEach(function (p) {
      if (!items.find(function (c) { return c.package_id === p.package_id; })) {
        var m = p.manifest;
        items.push({ package_id: p.package_id, kind: p.kind, package_version: p.version, title: m.title, work_id: m.work_id,
          edition_id: m.edition_id, requires_for_linked_reading: m.requires_for_linked_reading || [], rights: m.rights,
          channel: 'local', local_only: true, provides_units: m.provides_units, compressed_bytes: p.bytes });
      }
    });
    var g = {};
    items.forEach(function (c) {
      var w = c.kind === 'base_book' ? c.work_id : ((c.requires_for_linked_reading || [])[0] || {}).target_work_id || c.work_id;
      (g[w] = g[w] || { work_id: w, bases: [], comms: [] })[c.kind === 'base_book' ? 'bases' : 'comms'].push(c);
    });
    var inst = {};
    pk.forEach(function (p) { inst[p.package_id] = p; });
    return { groups: g, installed: inst };
  }
  function searchText(g) {
    var parts = [g.work_id];
    g.bases.concat(g.comms).forEach(function (c) {
      var tt = c.title || {};
      parts.push(tt.ar, tt.en, tt.uz);
      (c.names || []).forEach(function (n) { parts.push(n); });
      (c.authors || []).forEach(function (a) { parts.push(a.name_ar, a.name_en, a.name_uz); });
    });
    return fold(parts.filter(Boolean).join(' | '));
  }

  // ---------------------------------------------------------------- Kutubxona (bosh sahifa)
  async function viewLibrary(params) {
    clear();
    main.appendChild(el('h1', { text: t('lib.title') }));
    main.appendChild(el('p', { cls: 'kirish', text: t('lib.intro') }));
    if (catalog.packages.some(function (c) { return c.is_test_fixture; })) main.appendChild(el('p', { cls: 'ogoh', text: t('lib.fixture') }));
    var est = await Lib.estimateFree();
    if (est) main.appendChild(el('p', { cls: 'kichik xira', text: t('lib.storage', { used: Lib.fmtBytes(est.usage), free: Lib.fmtBytes(est.free) }) }));
    var box = el('input', { type: 'search', id: 'kitob-izla', 'data-act': 'find-book', placeholder: t('lib.find'), 'aria-label': t('lib.find'), dir: 'auto', value: params.q || '' });
    main.appendChild(box);
    var list = el('div', { id: 'kitoblar', cls: 'kitob-royxat' });
    main.appendChild(list);
    var data = await groups();
    var gs = Object.keys(data.groups).map(function (k) { return data.groups[k]; });
    var cards = [];
    for (var g of gs) {
      var base = g.bases[0] || {};
      var tt = titleOf(base.package_id ? base : (g.comms[0] || {}));
      var instAny = g.bases.concat(g.comms).filter(function (c) { return data.installed[c.package_id]; });
      var ready = instAny.length && instAny.every(function (c) { return data.installed[c.package_id].offline_ready; });
      var card = el('a', { cls: 'karta kitob', href: '#/w/' + encodeURIComponent(g.work_id), 'data-act': 'open-book', 'data-work': g.work_id }, [
        tt.ar ? el('div', { cls: 'kitob-ar', lang: 'ar', dir: 'rtl', text: tt.ar }) : null,
        el('div', { cls: 'kitob-nom', text: tt.other }),
        (base.authors || []).length ? el('div', { cls: 'kichik xira' }, [arSpan(base.authors[0].name_ar || ''), base.authors[0].name_en ? ' · ' + base.authors[0].name_en : '']) : null,
        el('div', { cls: 'belgilar' }, [
          el('span', { cls: 'belgi ' + (instAny.length ? 'h-verified' : ''), text: instAny.length ? (ready ? t('badge.ready') : t('badge.installed', { v: '' })) : t('badge.notInstalled') }),
          base.provides_units ? el('span', { cls: 'belgi', text: t('book.records', { n: base.provides_units }) }) : null,
          g.comms.length ? el('span', { cls: 'belgi', text: t('book.comms') + ': ' + g.comms.length }) : null,
          base.is_test_fixture ? el('span', { cls: 'belgi h-limited', text: t('badge.fixture') }) : null])]);
      cards.push({ el: card, text: searchText(g) });
      list.appendChild(card);
    }
    var none = el('p', { cls: 'xira yashirin', text: t('lib.none') });
    main.appendChild(none);
    function filter() {
      var q = fold(box.value);
      var shown = 0;
      cards.forEach(function (c) { var ok = !q || c.text.indexOf(q) >= 0; c.el.classList.toggle('yashirin', !ok); if (ok) shown++; });
      none.classList.toggle('yashirin', shown > 0);
    }
    box.addEventListener('input', filter);
    filter();
    main.appendChild(el('section', { cls: 'karta' }, [el('h2', { text: t('import.title') }), el('p', { cls: 'kichik', text: t('import.text') }),
      el('label', { cls: 'tugma keng' }, ['📂 ' + t('import.button'), el('input', { type: 'file', accept: '.hmz,.zip,application/zip', cls: 'yashirin', id: 'import-fayl', 'data-act': 'import-file',
        on: { change: async function (e) { var f = e.target.files[0]; if (!f) return; await doInstall(await f.arrayBuffer(), f.name); route(); } } })])]));
  }

  // ---------------------------------------------------------------- Kitob sahifasi
  async function viewWork(workId) {
    clear();
    var data = await groups();
    var g = data.groups[workId];
    if (!g) { main.appendChild(el('p', { text: t('lib.none') })); return; }
    var base = g.bases[0];
    var tt = titleOf(base || g.comms[0]);
    main.appendChild(el('p', {}, [el('a', { href: '#/', 'data-act': 'back-library', text: '← ' + t('lib.title') })]));
    if (tt.ar) main.appendChild(el('h1', { lang: 'ar', dir: 'rtl', cls: 'ar-h', text: tt.ar }));
    main.appendChild(el('p', { cls: 'kitob-nom', text: tt.other }));
    var sec = el('section', { cls: 'karta' }, [el('h2', { text: t('book.main') })]);
    if (!g.bases.length) sec.appendChild(el('p', { cls: 'xira', text: t('book.noMain') }));
    g.bases.forEach(function (c) { sec.appendChild(pkgRow(c, data.installed[c.package_id], true)); });
    main.appendChild(sec);
    var cs = el('section', { cls: 'karta' }, [el('h2', { text: t('book.comms') })]);
    if (!g.comms.length) cs.appendChild(el('p', { cls: 'xira', text: t('book.noComms') }));
    var checks = [];
    g.comms.forEach(function (c) {
      var cb = el('input', { type: 'checkbox', 'data-id': c.package_id, 'data-act': 'pick-commentary', 'aria-label': (c.title || {}).ar || c.package_id });
      if (data.installed[c.package_id]) { cb.checked = true; cb.disabled = true; }
      checks.push(cb);
      var row = pkgRow(c, data.installed[c.package_id], false);
      row.insertBefore(el('label', { cls: 'tanlash' }, [cb]), row.firstChild);
      cs.appendChild(row);
    });
    main.appendChild(cs);
    if (base && g.comms.length) {
      main.appendChild(el('div', { cls: 'qator' }, [btn(t('book.installWith'), 'install-with', async function () {
        var ids = [base.package_id].concat(checks.filter(function (x) { return x.checked && !x.disabled; }).map(function (x) { return x.getAttribute('data-id'); }));
        for (var id of ids) { var c = catalog.packages.find(function (p) { return p.package_id === id; }); if (c) { try { await installFromCatalog(c); } catch (e) { break; } } }
        route();
      }, 'asosiy keng katta')]));
      main.appendChild(el('p', { cls: 'kichik xira', text: t('book.notAgain') }));
    }
  }

  function pkgRow(c, inst, isBase) {
    var size = c.compressed_bytes ? t('book.size', { c: Lib.fmtBytes(c.compressed_bytes), i: Lib.fmtBytes(c.installed_bytes) }) : '';
    var status = inst ? (inst.version === c.package_version || c.local_only
      ? t('badge.installed', { v: inst.version }) + ' · ' + (inst.offline_ready ? t('badge.ready') : t('badge.notReady'))
      : t('badge.installed', { v: inst.version }) + ' · ' + t('badge.newer', { v: c.package_version })) : t('badge.notInstalled');
    var tt = titleOf(c);
    var row = el('div', { cls: 'paket', 'data-pkg': c.package_id }, [
      el('div', { cls: 'paket-matn' }, [
        tt.ar ? el('div', { cls: 'kitob-ar', lang: 'ar', dir: 'rtl', text: tt.ar }) : null,
        el('div', { cls: 'kichik' }, [iso(c.package_id), ' · v', iso(c.package_version), c.edition_id ? ' · ' : '', c.edition_id ? iso(c.edition_id) : '']),
        size ? el('div', { cls: 'kichik', text: size }) : null,
        c.provides_units ? el('div', { cls: 'kichik', text: isBase ? t('book.records', { n: c.provides_units }) : t('book.occ', { n: c.provides_units }) }) : null,
        (c.requires_for_linked_reading || []).length ? el('div', { cls: 'kichik' }, [t('book.linksTo', { target: '' }), iso(c.requires_for_linked_reading.map(function (r) { return r.target_edition_id; }).join(', '))]) : null,
        el('div', { cls: 'kichik', text: t('rights.label') + ': ' + channelLabel(c) }),
        el('div', { cls: 'holat', 'data-status': inst ? (inst.offline_ready ? 'ready' : 'installed') : 'none', text: status })])]);
    var b = el('div', { cls: 'paket-tugmalar' });
    if (!c.local_only && (!inst || inst.version !== c.package_version))
      b.appendChild(btn(inst ? t('book.update') : (isBase ? t('book.installBook') : t('book.install')), 'install', async function () { try { await installFromCatalog(c); } catch (e) { /* xabar ko'rsatildi */ } route(); }, 'asosiy katta'));
    if (inst) {
      b.appendChild(el('a', { cls: 'tugma', 'data-act': 'read', href: '#/read/' + encodeURIComponent(c.package_id), text: t('book.open') }));
      if (isBase) b.appendChild(el('a', { cls: 'tugma', 'data-act': 'search-in', href: '#/search?book=' + encodeURIComponent(c.work_id), text: t('book.searchIn') }));
      b.appendChild(btn(t('book.remove'), 'remove', async function () {
        if (!confirm(t('confirm.remove', { id: c.package_id }))) return;
        await Lib.uninstall(c.package_id); toast(t('removed')); route();
      }));
    }
    row.appendChild(b);
    return row;
  }

  // ---------------------------------------------------------------- o'rnatish
  async function installFromCatalog(c) {
    var inst = await Lib.getPackage(c.package_id);
    if (inst && inst.sha256 === c.package_sha256) return;
    var st = progressBox(c.package_id);
    try {
      st.set('download', '…');
      var r = await fetch(c.file, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var buf = await readWithProgress(r, c.compressed_bytes, function (p) { st.set('download', Math.round(p * 100) + '%'); });
      if (c.package_sha256 && (await Pkg.sha256Hex(buf)) !== c.package_sha256) throw new Error('SHA-256');
      await Lib.install(buf, st.set);
      st.ok();
    } catch (e) { st.fail(e.message); throw e; }
  }
  async function doInstall(buf, name) {
    var st = progressBox(name);
    try { var res = await Lib.install(buf, st.set); st.ok(res.map(function (r) { return r.package_id + ': ' + r.action; }).join(', ')); }
    catch (e) { st.fail(e.message); }
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
  var STATE_KEY = { yuklash: 'st.download', download: 'st.download', tekshirish: 'st.verify', joy: 'st.space', staging: 'st.staging',
    faollashtirish: 'st.activate', tayyorlik: 'st.ready', tayyor: 'st.done' };
  function progressBox(name) {
    var box = el('div', { cls: 'xabar doimiy', role: 'status', 'data-act': 'progress' }, [el('b', {}, [iso(name)]), el('div', { cls: 'kichik', text: '…' })]);
    document.body.appendChild(box);
    return {
      set: function (s, msg) { box.lastChild.textContent = t(STATE_KEY[s] || s) + (msg ? ': ' + msg : ''); },
      ok: function (msg) { box.setAttribute('data-done', 'ok'); box.lastChild.textContent = t('st.ok') + (msg ? ' — ' + msg : ''); setTimeout(function () { box.remove(); }, 3500); },
      fail: function (msg) { box.setAttribute('data-done', 'fail'); box.classList.add('yomon'); box.lastChild.textContent = t('st.fail', { msg: msg }); box.appendChild(btn(t('close'), 'close', function () { box.remove(); })); }
    };
  }

  // ---------------------------------------------------------------- qidiruv
  function getWorker() { if (!worker) worker = new Worker('./js/search-worker.js'); return worker; }
  async function viewSearch(params) {
    clear();
    var pk = await Lib.packages();
    main.appendChild(el('h1', { text: t('search.title') }));
    if (!pk.length) main.appendChild(el('div', { cls: 'karta' }, [el('p', { text: t('search.empty') }), el('a', { cls: 'tugma asosiy', href: '#/', text: t('search.toLib') })]));
    var q = el('input', { id: 'q', type: 'search', lang: 'ar', dir: 'rtl', placeholder: t('search.placeholder'), 'aria-label': t('search.placeholder'), value: params.q || '' });
    var mode = el('select', { id: 'rejim', 'aria-label': t('search.modeNorm') }, [el('option', { value: 'normalized', text: t('search.modeNorm') }), el('option', { value: 'exact', text: t('search.modeExact') })]);
    var scope = el('select', { id: 'doira', 'aria-label': t('search.all') }, [el('option', { value: 'all', text: t('search.all') }), el('option', { value: 'base', text: t('search.base') }), el('option', { value: 'commentary', text: t('search.comm') })]);
    var authors = el('select', { id: 'muallif', 'aria-label': t('search.anyAuthor') }, [el('option', { value: '', text: t('search.anyAuthor') })]);
    for (var c of pk.filter(function (p) { return p.kind === 'commentary'; }))
      for (var a of (c.manifest.author_ids || [])) authors.appendChild(el('option', { value: a, text: t('search.ownWords', { name: await personName(a) }) }));
    var vonly = el('input', { type: 'checkbox', id: 'faqat-tasdiq' });
    mode.value = params.mode || 'normalized'; scope.value = params.scope || 'all';
    var res = el('div', { id: 'natijalar', 'aria-live': 'polite' });
    var onlyWork = params.book || null;
    main.appendChild(el('form', { cls: 'karta', role: 'search', on: { submit: function (e) { e.preventDefault(); run(); } } }, [
      onlyWork ? el('p', { cls: 'kichik' }, [t('book.searchIn') + ': ', arSpan(await workTitle(onlyWork))]) : null,
      q, el('div', { cls: 'qator' }, [mode, scope, authors]),
      el('label', { cls: 'kichik' }, [vonly, ' ' + t('search.verifiedOnly')]),
      el('button', { cls: 'asosiy keng katta', type: 'submit', 'data-act': 'search', text: t('search.go') })]));
    main.appendChild(await numberForm(pk));
    main.appendChild(res);
    async function run() {
      var text = q.value.trim();
      if (!text) return;
      var act = await Lib.packages();
      if (onlyWork) act = act.filter(function (p) { return p.manifest.work_id === onlyWork || (p.manifest.requires_for_linked_reading || []).some(function (r) { return r.target_work_id === onlyWork; }); });
      var id = ++searchSeq;
      res.textContent = ''; res.removeAttribute('data-tayyor');
      res.appendChild(el('p', { cls: 'xira', text: t('search.busy') }));
      var w = getWorker();
      w.onmessage = async function (e) {
        var d = e.data;
        if (d.id !== searchSeq) return;
        if (d.error) { res.textContent = ''; res.appendChild(el('p', { cls: 'yomon', text: t('search.error', { msg: d.error }) })); res.setAttribute('data-tayyor', '1'); return; }
        if (d.done) await renderHits(res, d, text);
      };
      w.postMessage({ id: id, query: text, mode: mode.value, scope: authors.value ? 'commentary' : scope.value, authorId: authors.value || null,
        verifiedOnly: vonly.checked, pkgvs: act.map(function (p) { return p.active_pkgv; }) });
    }
    if (params.q) run();
  }
  async function renderHits(res, d, query) {
    res.textContent = '';
    res.appendChild(el('p', { cls: 'kichik xira', text: t('search.count', { n: d.total, ms: d.ms }) + (d.capped ? t('search.capped') : '') }));
    res.appendChild(el('p', { cls: 'kichik ogoh', text: t('search.notId') }));
    if (d.total > 25 && Arabic.normalize(query).length < 8) res.appendChild(el('p', { cls: 'kichik ogoh', text: t('search.short') }));
    var shown = 0;
    for (var h of d.hits) {
      if (shown++ >= 200) { res.appendChild(el('p', { cls: 'xira', text: t('search.more') })); break; }
      var sn = h.snippet, chars = Array.from(sn.text);
      var p = el('p', { lang: 'ar', dir: 'rtl', cls: 'ar parcha' }, [
        (sn.truncated && sn.original_offset > 0 ? '… ' : '') + chars.slice(0, sn.match_start).join(''),
        el('mark', { text: chars.slice(sn.match_start, sn.match_end).join('') }),
        chars.slice(sn.match_end).join('') + (sn.truncated ? ' …' : '')]);
      var nums = h.kind === 'unit' ? (await numbersText(h.numbers)).join(' · ') : '';
      var layer = h.kind === 'unit' ? t('search.mainText') : t('role.' + h.layer) + (h.layer_person ? ' — ' + (await personName(h.layer_person)) : '');
      res.appendChild(el('a', { cls: 'karta natija', 'data-act': 'hit', href: (h.kind === 'unit' ? '#/h/' : '#/s/') + encodeURIComponent(h.id) }, [
        el('div', { cls: 'natija-bosh' }, [arSpan(await workTitle(h.work_id)), el('span', { cls: 'xira kichik' }, [' · ' + layer + (nums ? ' · ' : ''), nums ? iso(nums) : null])]),
        p, statusRow(h.statuses)]));
    }
    res.setAttribute('data-tayyor', '1');
  }
  async function numberForm(pk) {
    var works = [];
    pk.filter(function (p) { return p.kind === 'base_book'; }).forEach(function (b) { if (works.indexOf(b.manifest.work_id) < 0) works.push(b.manifest.work_id); });
    var wsel = el('select', { 'aria-label': t('nav.library'), 'data-act': 'num-book' });
    for (var w of works) wsel.appendChild(el('option', { value: w, text: await workTitle(w) }));
    var num = el('input', { type: 'text', inputmode: 'numeric', placeholder: t('num.number'), 'aria-label': t('num.number'), 'data-act': 'num-number', dir: 'ltr' });
    var vol = el('input', { type: 'text', inputmode: 'numeric', placeholder: t('num.volume'), 'aria-label': t('num.volume'), 'data-act': 'num-volume', dir: 'ltr' });
    var out = el('div', { id: 'raqam-natija' });
    return el('form', { cls: 'karta', on: { submit: async function (e) {
      e.preventDefault(); out.textContent = '';
      if (!num.value.trim()) return;
      var r = await Lib.resolve(wsel.value, num.value, null, vol.value.trim() || null);
      if (!r.length) { out.appendChild(el('p', { text: t('num.none') })); return; }
      if (r.length > 1) out.appendChild(el('p', { cls: 'ogoh kichik', 'data-act': 'num-many', text: t('num.many', { n: r.length }) }));
      for (var c of r) {
        out.appendChild(el('a', { cls: 'karta natija', 'data-act': 'num-hit', href: '#/h/' + encodeURIComponent(c.unit.unit_id) }, [
          el('div', { cls: 'kichik' }, [(await schemeLabel(c.number.scheme_id)) + ': ', iso((c.number.volume ? t('num.vol', { v: c.number.volume }) + ', ' : '') + c.number.number_text), c.grouped ? ' (' + t('num.grouped') + ')' : '', ' · ', iso(c.unit.edition_id)]),
          ar(Array.from(c.unit.text_ar).slice(0, 160).join(''))]));
      }
    } } }, [el('h2', { text: t('num.title') }), works.length ? null : el('p', { cls: 'xira kichik', text: t('num.noBook') }),
      el('div', { cls: 'qator' }, [wsel, num, vol]), el('button', { type: 'submit', 'data-act': 'num-go', text: t('num.go') }), out]);
  }

  // ---------------------------------------------------------------- hadis
  async function viewUnit(id) {
    clear();
    var u = await Lib.unit(id);
    if (!u) {
      main.appendChild(el('div', { cls: 'karta' }, [el('h1', { text: t('unit.notFound') }), el('p', {}, [t('unit.notInstalled', { id: '' }), iso(id)]),
        el('a', { cls: 'tugma asosiy katta', 'data-act': 'install-base', href: '#/', text: t('unit.installBase') })]));
      return;
    }
    var grid = el('div', { cls: 'ikki-panel' });
    var left = el('section', { cls: 'panel', 'aria-label': t('book.main') });
    var right = el('section', { cls: 'panel sharh-panel', id: 'sharh-panel', 'aria-label': t('unit.comms') });
    grid.appendChild(left); grid.appendChild(right); main.appendChild(grid);
    left.appendChild(el('p', { cls: 'kichik xira' }, [el('a', { href: '#/w/' + encodeURIComponent(u.work_id), 'data-act': 'to-book' }, [arSpan(await workTitle(u.work_id))]),
      ' · ', iso(u.edition_id), ' · ' + en('unitType', u.unit_type) + ' · ' + en('attribution', u.attribution_kind)]));
    if (u.chapter_ar) left.appendChild(el('p', { lang: 'ar', dir: 'rtl', cls: 'ar bob', text: u.chapter_ar }));
    left.appendChild(ar(u.text_ar, { cls: 'ar matn' }));
    left.appendChild(el('ul', { cls: 'raqamlar' }, (await numbersText(u.numbers)).map(function (x) { return el('li', {}, [iso(x)]); })));
    left.appendChild(statusRow(u.statuses));
    left.appendChild(limits(u.limitations));
    var bm = await Notes.get('bookmark:' + id);
    left.appendChild(el('div', { cls: 'qator' }, [
      btn(t('unit.copy'), 'copy-citation', async function () { copy(await unitCitation(u)); }, 'asosiy katta'),
      btn(bm ? t('unit.unbookmark') : t('unit.bookmark'), 'bookmark', async function () {
        if (bm) await Notes.del('bookmark:' + id); else await Notes.put({ key: 'bookmark:' + id, type: 'bookmark', target: id, label: Array.from(u.text_ar).slice(0, 60).join('') });
        viewUnit(id);
      })]));
    left.appendChild(await noteBox(id));
    var det = el('details', {}, [el('summary', { text: t('unit.evidence') })]);
    var inner = el('div', { cls: 'ichki kichik' });
    for (var n of (u.narrators || [])) {
      inner.appendChild(el('p', { text: t('unit.narrator', { name: (await personName(n.terminal_person_id)) || n.interpretation || t('unit.unknownNarrator') }) +
        (n.fallback_person_id ? ' · ' + t('unit.fallback', { name: await personName(n.fallback_person_id) }) : '') + ' · ' + en('status', n.narrator_identity_status) + (n.original_value ? ' (' + n.original_value + ')' : '') }));
    }
    for (var g of (u.gradings || [])) inner.appendChild(el('p', { text: t('unit.grading', { g: g.grade, who: await personName(g.scholar_person_id), src: g.source_ref }) }));
    for (var tp of (u.topics || [])) inner.appendChild(el('p', { text: t('unit.topic', { t: tp.topic, o: tp.origin }) }));
    for (var i of (u.identifiers || [])) inner.appendChild(el('p', {}, [iso(i.namespace + ':' + i.value), i.namespace === 'row' ? ' — ' + t('unit.idRow') : '']));
    inner.appendChild(el('p', { cls: 'xesh' }, [iso('raw_sha256: ' + (u.raw_sha256 || '—'))]));
    inner.appendChild(el('p', { cls: 'xesh' }, [iso('current_text_sha256: ' + u.current_text_sha256)]));
    inner.appendChild(el('p', { cls: 'xesh' }, [iso(u.unit_id + ' · ' + u.pkgv)]));
    det.appendChild(inner); left.appendChild(det);

    right.appendChild(el('h2', { text: t('unit.comms') }));
    var cs = await Lib.commentariesFor(id);
    if (!cs.length) right.appendChild(el('p', { cls: 'xira', 'data-act': 'no-comms', text: t('unit.noComms') }));
    for (var c of cs) {
      right.appendChild(el('a', { cls: 'karta natija', 'data-act': 'open-commentary', href: '#/s/' + encodeURIComponent(c.occ.occurrence_id) + '?from=' + encodeURIComponent(id) }, [
        el('div', {}, [arSpan(await workTitle(c.occ.work_id)), el('span', { cls: 'kichik xira' }, [' · ' + t('scope.' + c.occ.scope) + (c.occ.page ? ' · ' : ''), c.occ.page ? iso((c.occ.volume ? c.occ.volume + ':' : '') + c.occ.page) : null])]),
        el('div', { cls: 'belgilar' }, [badge('commentary_link_status', c.link.commentary_link_status), c.link.legacy_confidence ? el('span', { cls: 'belgi', text: t('unit.legacy', { c: c.link.legacy_confidence }) }) : null])]));
    }
    await Notes.put({ key: 'position:last', type: 'position', target: id });
  }
  async function noteBox(id) {
    var n = await Notes.get('note:' + id);
    var ta = el('textarea', { rows: 3, 'aria-label': t('note.placeholder'), placeholder: t('note.placeholder'), dir: 'auto', 'data-act': 'note' });
    ta.value = n ? n.text : '';
    return el('div', { cls: 'qayd' }, [ta, btn(t('note.save'), 'note-save', async function () {
      if (ta.value.trim()) await Notes.put({ key: 'note:' + id, type: 'note', target: id, text: ta.value }); else await Notes.del('note:' + id);
      toast(t('saved'));
    })]);
  }
  function statusLine(st, lims) {
    return Object.keys(st || {}).map(function (k) { return k + '=' + st[k]; }).join(', ') + (lims && lims.length ? '; ' + t('cite.notes') + ': ' + lims.join(' | ') : '');
  }
  async function unitCitation(u) {
    var ed = await Lib.ent('editions', u.edition_id);
    return [(await workTitle(u.work_id)) + ', ' + ((await numbersText(u.numbers)).join('; ') || t('unit.noNumber')) + '.',
      t('cite.edition') + ': ' + (ed && ed.label || u.edition_id) + '.',
      t('cite.quote') + ': ' + u.text_ar,
      t('cite.scope') + ': ' + (u.text_kind === 'full' ? t('cite.fullUnit') : u.text_kind) + '.',
      t('cite.status') + ': ' + statusLine(u.statuses, u.limitations) + '.',
      t('cite.source') + ': ' + u.unit_id + ' @ ' + u.pkgv].join('\n');
  }

  // ---------------------------------------------------------------- sharh
  async function viewOcc(id, from) {
    clear();
    var o = await Lib.occurrence(id);
    if (!o) { main.appendChild(el('div', { cls: 'karta' }, [el('h1', { text: t('unit.notFound') }), el('p', {}, [t('occ.notInstalled', { id: '' }), iso(id)])])); return; }
    var st = o.statuses || {};
    var endOk = o.scope === 'full_section' && st.commentary_end_status === 'verified';
    var work = (await Lib.ent('works', o.work_id)) || {};
    var author = await personName((work.author_ids || [])[0]);
    if (from) main.appendChild(el('p', {}, [el('a', { href: '#/h/' + encodeURIComponent(from), 'data-act': 'back-hadith', text: t('occ.back', { num: '' }).replace(/[:：]\s*$/, '') })]));
    main.appendChild(el('h1', { lang: 'ar', dir: 'rtl', cls: 'ar-h', text: await workTitle(o.work_id) }));
    main.appendChild(el('p', { cls: 'kichik xira' }, [author ? arSpan(author) : null, author ? ' · ' : '', iso(o.edition_id), ' · ', o.page ? iso((o.volume ? o.volume + ':' : '') + o.page) : t('occ.pageUnknown')]));
    if (o.lemma_kind === 'iqtibos_yoq') main.appendChild(el('p', { cls: 'ogoh kichik', text: t('occ.noLemma') }));
    else if (o.lemma_text) main.appendChild(el('p', { cls: 'kichik' }, [t('occ.lemma', { k: o.lemma_kind }) + ' ', arSpan(o.lemma_text)]));
    if (!endOk) main.appendChild(el('p', { cls: 'ogoh', text: o.scope === 'fragment' ? t('occ.fragment') : t('occ.preview') }));
    var text = Array.from(o.text_ar);
    var shown = endOk ? text : text.slice(0, 3000);
    var box = el('div', { cls: 'segmentlar' });
    for (var s of (o.segments || [])) {
      if (s.start >= shown.length) continue;
      var who = await personName(s.person_id);
      box.appendChild(el('div', { cls: 'segment r-' + s.role }, [el('div', { cls: 'kichik rol' }, [t('role.' + s.role), who ? ' — ' : '', who ? arSpan(who) : null]),
        ar(shown.slice(s.start, Math.min(s.end, shown.length)).join(''))]));
    }
    if (!(o.segments || []).length) box.appendChild(ar(shown.join('')));
    if (shown.length < text.length) box.appendChild(el('p', { cls: 'xira kichik', text: t('occ.cut', { n: shown.length }) }));
    main.appendChild(box);
    main.appendChild(statusRow(st));
    main.appendChild(limits(o.limitations));
    var links = await Lib.linksOfOccurrence(id);
    var back = el('div', { cls: 'karta' }, [el('h2', { text: t('occ.base') })]);
    if (o.link_kind === 'umumiy') back.appendChild(el('p', { cls: 'kichik ogoh', text: t('occ.general') }));
    for (var l of links) {
      if (l.activation.state === 'active') {
        var u = await Lib.unit(l.link.target_unit_id);
        back.appendChild(el('a', { cls: 'tugma katta' + (from === l.link.target_unit_id ? ' asosiy' : ''), 'data-act': 'to-hadith', href: '#/h/' + encodeURIComponent(l.link.target_unit_id) },
          [t('occ.back', { num: '' }), iso((await numbersText(u.numbers))[0] || l.link.target_unit_id)]));
      } else {
        back.appendChild(el('p', { cls: 'kichik' }, [iso(l.link.target_edition_id + ' / ' + l.link.target_unit_id), ' — ' + t('link.' + l.activation.state)]));
        if (l.activation.state === 'base_not_installed') back.appendChild(el('a', { cls: 'tugma', 'data-act': 'install-base', href: '#/w/' + encodeURIComponent(l.link.target_work_id), text: t('unit.installBase') }));
      }
    }
    main.appendChild(back);
    main.appendChild(btn(t('unit.copy'), 'copy-citation', async function () {
      var lines = [];
      for (var s2 of (o.segments || [])) {
        if (s2.start >= shown.length) continue;
        var w2 = await personName(s2.person_id);
        lines.push(t('cite.quote') + ' [' + t('role.' + s2.role) + (w2 ? ' — ' + w2 : '') + ']: ' + shown.slice(s2.start, Math.min(s2.end, shown.length)).join('').trim());
      }
      var ed = await Lib.ent('editions', o.edition_id);
      copy([(await workTitle(o.work_id)) + (author ? ', ' + author : '') + ', ' + (ed && ed.label || o.edition_id) + ', ' + (o.page ? (o.volume ? o.volume + ':' : '') + o.page : t('occ.pageUnknown')) + '.']
        .concat(lines, [t('cite.scope') + ': ' + (endOk ? t('scope.full_section') : t('scope.' + o.scope)) + '.', t('cite.status') + ': ' + statusLine(st) + '.', t('cite.source') + ': ' + o.occurrence_id + ' @ ' + o.pkgv]).join('\n'));
    }, 'asosiy katta'));
    main.appendChild(await noteBox(id));
  }

  // ---------------------------------------------------------------- boshqa sahifalar
  async function viewRead(pid) {
    clear();
    var p = await Lib.getPackage(pid);
    if (!p) { main.appendChild(el('p', { text: t('pk.none') })); return; }
    main.appendChild(el('p', {}, [el('a', { href: '#/w/' + encodeURIComponent(p.kind === 'base_book' ? p.manifest.work_id : ((p.manifest.requires_for_linked_reading || [])[0] || {}).target_work_id || p.manifest.work_id), text: '← ' + t('book.details') })]));
    main.appendChild(el('h1', { lang: 'ar', dir: 'rtl', cls: 'ar-h', text: await workTitle(p.manifest.work_id) }));
    var list = el('ol', { cls: 'mundarija' }), lastChapter = null, count = 0;
    if (p.kind === 'base_book') {
      for (var u of await Lib.unitsOf(p.active_pkgv)) {
        if (count++ > 600) break;
        if (u.chapter_ar && u.chapter_ar !== lastChapter) { list.appendChild(el('li', { cls: 'bob-li', lang: 'ar', dir: 'rtl', text: u.chapter_ar })); lastChapter = u.chapter_ar; }
        var nums = await numbersText(u.numbers);
        list.appendChild(el('li', {}, [el('a', { href: '#/h/' + encodeURIComponent(u.unit_id), 'data-act': 'toc-item' }, [el('span', { cls: 'kichik xira' }, [iso(nums[0] || en('unitType', u.unit_type)), ' · ']), arSpan(Array.from(u.text_ar).slice(0, 70).join('') + '…')])]));
      }
    } else {
      for (var o of await Lib.occOf(p.active_pkgv)) {
        if (count++ > 600) break;
        list.appendChild(el('li', {}, [el('a', { href: '#/s/' + encodeURIComponent(o.occurrence_id), 'data-act': 'toc-item' }, [el('span', { cls: 'kichik xira' }, [iso(o.occurrence_id), ' · ']), arSpan(Array.from(o.text_ar).slice(0, 70).join('') + '…')])]));
      }
    }
    main.appendChild(list);
    if (count > 600) main.appendChild(el('p', { cls: 'xira', text: t('search.more') }));
  }
  async function viewInstalled() {
    clear();
    main.appendChild(el('h1', { text: t('pk.title') }));
    var pk = await Lib.packages();
    if (!pk.length) main.appendChild(el('p', { text: t('pk.none') }));
    pk.forEach(function (p) {
      main.appendChild(el('div', { cls: 'karta paket', 'data-pkg': p.package_id }, [el('div', { cls: 'paket-matn' }, [
        el('div', { lang: 'ar', dir: 'rtl', cls: 'kitob-ar', text: (p.manifest.title && (p.manifest.title.ar || p.manifest.title.en)) || p.package_id }),
        el('div', { cls: 'kichik' }, [iso(p.package_id), ' · ', iso(p.kind), ' · v', iso(p.version), ' · ' + Lib.fmtBytes(p.bytes) + ' · ' + (p.offline_ready ? t('badge.ready') : t('badge.notReady'))]),
        el('details', {}, [el('summary', { text: t('pk.license') }), el('pre', { cls: 'kichik', dir: 'auto', text: p.license + '\n' + p.attribution }), el('p', { cls: 'xesh' }, [iso('sha256: ' + p.sha256)])])]),
        el('div', { cls: 'paket-tugmalar' }, [
          el('a', { cls: 'tugma', 'data-act': 'read', href: '#/read/' + encodeURIComponent(p.package_id), text: t('book.open') }),
          btn(t('pk.export'), 'export', async function () { download(p.package_id + '-' + p.version + '.hmz', await Lib.exportPackage(p.package_id)); }),
          p.previous ? btn(t('pk.rollback', { v: p.previous.version }), 'rollback', async function () { var s = progressBox(p.package_id); try { await Lib.rollback(p.package_id, s.set); s.ok(); } catch (e) { s.fail(e.message); } route(); }) : null,
          btn(t('book.remove'), 'remove', async function () { if (confirm(t('confirm.remove', { id: p.package_id }))) { await Lib.uninstall(p.package_id); route(); } })])]));
    });
    var persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
    main.appendChild(el('section', { cls: 'karta' }, [el('h2', { text: t('pk.storage') }), el('p', { cls: 'kichik', text: persisted ? t('pk.persisted') : t('pk.notPersisted') }),
      persisted ? null : btn(t('pk.persist'), 'persist', async function () { var ok = navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; toast(ok ? t('pk.granted') : t('pk.denied')); route(); })]));
  }
  async function viewCoverage() {
    clear();
    main.appendChild(el('h1', { text: t('cov.title') }));
    main.appendChild(el('p', { cls: 'kichik', text: t('cov.text') }));
    for (var p of await Lib.packages()) {
      var c = p.manifest.coverage || {}, den = (p.coverage || {}).denominator;
      var rows = Object.keys(c).filter(function (k) { return k !== 'kind'; }).map(function (k) {
        return el('tr', {}, [el('th', { text: k }), el('td', { dir: 'ltr', text: typeof c[k] === 'object' ? JSON.stringify(c[k]) : String(c[k]) })]);
      });
      var pct = den && den.verified && den.value && c.source_records != null ? t('cov.pct', { p: (100 * c.source_records / den.value).toFixed(1), d: den.value }) : t('cov.noPct');
      main.appendChild(el('section', { cls: 'karta' }, [el('h2', {}, [iso(p.package_id)]), el('p', { cls: 'kichik', text: pct }), el('div', { cls: 'jadval-o' }, [el('table', { cls: 'kichik' }, rows)])]));
    }
  }
  async function viewNotes() {
    clear();
    main.appendChild(el('h1', { text: t('notes.title') }));
    main.appendChild(el('p', { cls: 'kichik', text: t('notes.text') }));
    var items = (await Notes.all()).filter(function (i) { return i.type !== 'position'; });
    if (!items.length) main.appendChild(el('p', { cls: 'xira', text: t('notes.none') }));
    items.forEach(function (i) {
      var href = (/:o\d/.test(i.target) ? '#/s/' : '#/h/') + encodeURIComponent(i.target);
      main.appendChild(el('a', { cls: 'karta natija', href: href }, [el('b', { text: i.type === 'bookmark' ? t('notes.bookmark') : t('notes.note') }),
        el('div', { cls: 'kichik' }, [iso(i.target)]), i.label ? ar(i.label) : null, i.text ? el('p', { dir: 'auto', text: i.text }) : null]));
    });
    main.appendChild(el('div', { cls: 'qator' }, [
      btn('⬇️ ' + t('notes.export'), 'notes-export', async function () { download('hadis-manba-notes-' + new Date().toISOString().slice(0, 10) + '.json', new Blob([await Notes.exportJson()], { type: 'application/json' })); }),
      el('label', { cls: 'tugma' }, ['⬆️ ' + t('notes.import'), el('input', { type: 'file', accept: '.json,application/json', cls: 'yashirin', 'data-act': 'notes-import', on: { change: async function (e) {
        try { var n = await Notes.importJson(await e.target.files[0].text()); toast(t('notes.restored', { n: n })); route(); } catch (err) { toast(err.message, true); }
      } } })])]));
  }
  function viewHelp() {
    clear();
    main.appendChild(el('h1', { text: t('help.title') }));
    main.appendChild(el('ol', { cls: 'qadamlar' }, t('help.steps').split('|').map(function (s) { return el('li', { text: s }); })));
    [t('help.offline'), t('help.install'), t('help.status')].forEach(function (s) { main.appendChild(el('p', { cls: 'karta', text: s })); });
    main.appendChild(el('p', {}, [el('a', { href: '#/coverage', text: t('nav.coverage') }), ' · ', el('a', { href: '#/ai', text: t('nav.ai') }),
      ' · ', el('a', { href: './' + I18N.lang().replace('uz', 'en') + '/', text: 'Catalog / الفهرس' })]));
  }
  function viewAi() {
    clear();
    main.appendChild(el('h1', { text: t('ai.title') }));
    main.appendChild(el('p', { text: t('ai.text') }));
    var cfg = JSON.stringify({ mcpServers: { 'hadis-manba': { command: 'hadis-manba', args: ['mcp'] } } }, null, 2);
    main.appendChild(el('section', { cls: 'karta' }, [el('h2', { text: t('ai.config') }), el('pre', { cls: 'kod', dir: 'ltr', text: cfg }), btn(t('ai.copy'), 'copy-mcp', function () { copy(cfg); })]));
    main.appendChild(el('section', { cls: 'karta' }, [el('h2', { text: t('ai.noMcp') }), el('p', { text: t('ai.noMcpText') })]));
  }

  // ---------------------------------------------------------------- qobiq: nav, til, marshrut
  function renderShell() {
    document.title = t('app.name') + ' — ' + t('app.tagline');
    $('otish').textContent = t('skip');
    $('tagline').textContent = t('app.tagline');
    $('yangilash').textContent = t('update.available');
    $('futer').textContent = t('footer');
    var nav = $('nav'); nav.textContent = '';
    [['#/', 'nav.library', 'nav-library'], ['#/search', 'nav.search', 'nav-search'], ['#/installed', 'nav.installed', 'nav-installed'],
      ['#/notes', 'nav.notes', 'nav-notes'], ['#/help', 'nav.help', 'nav-help']].forEach(function (x) {
      nav.appendChild(el('a', { href: x[0], 'data-act': x[2], text: t(x[1]) }));
    });
    var sel = $('til'); sel.textContent = '';
    I18N.langs.forEach(function (l) { sel.appendChild(el('option', { value: l, lang: l, text: I18N.names[l] })); });
    sel.value = I18N.lang();
    sel.setAttribute('aria-label', t('nav.lang'));
    if (!navigator.onLine) $('tarmoq').textContent = t('offline.banner');
  }
  async function route() {
    var h = location.hash || '#/';
    var qi = h.indexOf('?'), params = {};
    if (qi >= 0) { new URLSearchParams(h.slice(qi + 1)).forEach(function (v, k) { params[k] = v; }); h = h.slice(0, qi); }
    var parts = h.slice(2).split('/');
    document.querySelectorAll('#nav a').forEach(function (a) { a.removeAttribute('aria-current'); if (a.getAttribute('href') === '#/' + parts[0]) a.setAttribute('aria-current', 'page'); });
    try {
      if (parts[0] === 'h') await viewUnit(decodeURIComponent(parts.slice(1).join('/')));
      else if (parts[0] === 's') await viewOcc(decodeURIComponent(parts.slice(1).join('/')), params.from);
      else if (parts[0] === 'w') await viewWork(decodeURIComponent(parts.slice(1).join('/')));
      else if (parts[0] === 'read' || parts[0] === 'kitob') await viewRead(decodeURIComponent(parts[1]));
      else if (parts[0] === 'search') await viewSearch(params);
      else if (parts[0] === 'installed' || parts[0] === 'paketlar') await viewInstalled();
      else if (parts[0] === 'coverage' || parts[0] === 'qamrov') await viewCoverage();
      else if (parts[0] === 'notes' || parts[0] === 'qaydlar') await viewNotes();
      else if (parts[0] === 'help') viewHelp();
      else if (parts[0] === 'ai') viewAi();
      else await viewLibrary(params);
    } catch (e) {
      clear();
      main.appendChild(el('div', { cls: 'karta yomon' }, [el('h1', { text: t('error') }), el('p', { text: String(e && e.message || e) })]));
    }
    main.setAttribute('data-route', parts[0] || 'library');
    main.focus({ preventScroll: true });
  }
  async function start() {
    try { await Lib.cleanup(); } catch (e) { /* birinchi ochilish */ }
    await loadCatalog();
    renderShell();
    $('til').addEventListener('change', function (e) { I18N.set(e.target.value); renderShell(); route(); });
    window.addEventListener('hashchange', route);
    window.addEventListener('online', function () { $('tarmoq').textContent = ''; });
    window.addEventListener('offline', function () { $('tarmoq').textContent = t('offline.banner'); });
    await route();
    document.documentElement.setAttribute('data-tayyor', '1');
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            var b = $('yangilash'); b.classList.remove('yashirin'); b.onclick = function () { nw.postMessage('yangila'); };
          }
        });
      });
    });
    var hadController = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  }
  window.HadisApp = { route: route };
  start();
})();
