// Shaxsiy xatcho'p, qayd va o'qilgan joy — paketlardan ALOHIDA bazada. Paket yangilanishi/o'chirilishi ularga tegmaydi.
(function (root) {
  'use strict';
  var NAME = 'hadis-manba-shaxsiy';
  var p = null;
  function db() {
    if (p) return p;
    p = new Promise(function (res, rej) {
      var r = indexedDB.open(NAME, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('items', { keyPath: 'key' }); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return p;
  }
  function wrap(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  async function put(item) { var d = await db(); item.updated_at = new Date().toISOString(); return wrap(d.transaction('items', 'readwrite').objectStore('items').put(item)); }
  async function get(key) { var d = await db(); return wrap(d.transaction('items').objectStore('items').get(key)); }
  async function del(key) { var d = await db(); return wrap(d.transaction('items', 'readwrite').objectStore('items').delete(key)); }
  async function all() { var d = await db(); return wrap(d.transaction('items').objectStore('items').getAll()); }

  async function exportJson() {
    return JSON.stringify({ format: 'hadis-manba-shaxsiy', version: 1, exported_at: new Date().toISOString(), items: await all() }, null, 1);
  }
  async function importJson(text) {
    var data = JSON.parse(text);
    if (data.format !== 'hadis-manba-shaxsiy' || !Array.isArray(data.items)) throw new Error("Bu Hadis Manba qaydlar fayli emas");
    var n = 0;
    for (var it of data.items) {
      if (!it || typeof it.key !== 'string' || ['bookmark', 'note', 'position'].indexOf(it.type) < 0) continue;
      await put(it); n++;
    }
    return n;
  }
  root.Notes = { put: put, get: get, del: del, all: all, exportJson: exportJson, importJson: importJson };
})(self);
