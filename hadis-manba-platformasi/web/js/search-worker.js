// Qidiruv Web Worker'da: UI qotmaydi. Paketlar bo'lak-bo'lak (IndexedDB kursor) o'qiladi, butun korpus RAMga yuklanmaydi.
importScripts('arabic.js');

var MAX_HITS = 2000;
var current = 0;

function openDb() {
  return new Promise(function (res, rej) {
    var r = indexedDB.open('hadis-manba');
    r.onsuccess = function () { res(r.result); };
    r.onerror = function () { rej(r.error); };
  });
}

function segmentAt(segments, pos) {
  for (var i = 0; i < (segments || []).length; i++) if (segments[i].start <= pos && pos < segments[i].end) return segments[i];
  return null;
}

function scanStore(db, store, pkgv, fn) {
  return new Promise(function (res, rej) {
    var tx = db.transaction(store);
    var r = tx.objectStore(store).index('pkgv').openCursor(IDBKeyRange.only(pkgv));
    r.onsuccess = function () {
      var c = r.result;
      if (!c) return res();
      if (fn(c.value) === false) return res();
      c.continue();
    };
    r.onerror = function () { rej(r.error); };
  });
}

self.onmessage = async function (e) {
  var q = e.data, id = q.id;
  current = id;
  try {
    var db = await openDb();
    var mode = q.mode || 'normalized', scope = q.scope || 'all';
    var needle = mode === 'normalized' ? Arabic.normalize(q.query) : q.query;
    if (!needle) { postMessage({ id: id, done: true, hits: [], total: 0 }); return; }
    var needleChars = Array.from(needle);
    var hits = [], total = 0, t0 = performance.now();
    var stores = scope === 'base' ? ['units'] : scope === 'commentary' ? ['occ'] : ['units', 'occ'];
    for (var p = 0; p < q.pkgvs.length; p++) {
      for (var s of stores) {
        await scanStore(db, s, q.pkgvs[p], function (rec) {
          if (current !== id) return false;
          var hay = mode === 'normalized' ? rec.n : rec.text_ar;
          if (hay.indexOf(needle) < 0) return true;
          var hayChars = Array.from(hay);
          var positions = Arabic.allPositions(hayChars, needleChars, 50);
          if (!positions.length) return true;
          var map = mode === 'normalized' ? Arabic.normalizeWithMap(rec.text_ar).map : hayChars.map(function (_, i) { return i; });
          var chosen = null;
          for (var k = 0; k < positions.length; k++) {
            var sn = Arabic.snippet(rec.text_ar, positions[k], needleChars.length, map, 80);
            var seg = s === 'occ' ? segmentAt(rec.segments, sn.original_offset + sn.match_start) : null;
            if (q.authorId && (!seg || seg.role !== 'commentator' || seg.person_id !== q.authorId)) continue;
            chosen = { sn: sn, seg: seg };
            break;
          }
          if (!chosen) return true;
          if (q.verifiedOnly) {
            var st = rec.statuses || {};
            if (s === 'units' && (st.text_preservation_status !== 'verified' || st.number_status !== 'verified')) return true;
            if (s === 'occ' && st.commentary_link_status !== 'verified') return true;
          }
          total++;
          if (hits.length < MAX_HITS) {
            hits.push({ kind: s === 'units' ? 'unit' : 'occurrence', id: rec.unit_id || rec.occurrence_id,
              package_id: rec.package_id, work_id: rec.work_id, edition_id: rec.edition_id, unit_type: rec.unit_type,
              numbers: (rec.numbers || []).map(function (n) { return { scheme_id: n.scheme_id, volume: n.volume, number_text: n.number_text }; }),
              snippet: chosen.sn, layer: s === 'units' ? 'hadith_body' : (chosen.seg ? chosen.seg.role : 'unsegmented'),
              layer_person: chosen.seg ? chosen.seg.person_id : null, statuses: rec.statuses, limitations: rec.limitations,
              scope: rec.scope || null });
          }
          return true;
        });
        if (current !== id) return;
      }
      postMessage({ id: id, progress: (p + 1) / q.pkgvs.length, partialTotal: total });
    }
    postMessage({ id: id, done: true, hits: hits, total: total, capped: total > MAX_HITS, ms: Math.round(performance.now() - t0) });
  } catch (err) {
    postMessage({ id: id, error: String(err && err.message || err) });
  }
};
