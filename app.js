/* yogAO – Yoga-Übungen nachschlagen und üben */
'use strict';
const VERSION = '1.0.0';
const BOOKS = {UB:'Yoga für Unbewegliche',DX:'Detox mit Yin und Yang Yoga',YB:'Das große Yin Yoga-Buch',SA:'Yin Yoga (Sander)',YD:'Yoga für dich',MA:'Yoga mal anders',FY:'Faszientraining mit Yin-Yoga'};
const GROUPS = ['Stehen','Sitzen','Knien / Vierfüßler','Rücken- und Seitlage','Bauchlage','Umkehrhaltungen und Armbalancen','Kräftigung','Faszienrolle','Mobilisation','Atemübungen','Entspannung · Meditation'];
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const main = $('#main');
let DATA = [], BY = {};

/* ---------- Speicher ---------- */
const KEY = 'yogao.v1';
let S = {favs: [], progs: [], set: {dur: 60, gap: 5, vol: 0.8, bookdur: false, shuffle: true, music: true, wake: true}};
try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j) { S = {...S, ...j, set: {...S.set, ...(j.set || {})}}; } } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- Hilfen ---------- */
function toast(t, ms = 2600) { const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, ms); }
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const parts = p => (p || []).map(([t, s]) => esc(t) + (s ? `<span class="src">(${esc(s)})</span>` : '')).join(' ');
const noGegen = t => !t || (t.length < 70 && /nicht genannt|^keine\b/i.test(t));
const sides = e => e && e.seiten === 2 ? 2 : 1;
function defDur(e) {
  if (S.set.bookdur && e.sek && e.sek >= 15 && e.sek <= 600 && e.nr !== 79) return e.sek;
  return S.set.dur || 60;
}
const imgUrl = f => 'img/' + f;

/* ---------- Beispielprogramme ---------- */
const mk = (nr, sec, sd) => ({nr, sec, sides: sd ?? sides(BY[nr])});
function examples() {
  return [
    {id: 'ex1', ex: true, name: 'Beispiel: Kurze Morgenrunde', mode: 'timer', items: [mk(3, 60), mk(1, 90), mk(147, 60), mk(146, 60), mk(70, 90), mk(75, 60), mk(154, 90)]},
    {id: 'ex2', ex: true, name: 'Beispiel: Yin am Abend', mode: 'timer', items: [mk(41, 180), mk(55, 180), mk(75, 120), mk(93, 90), mk(95, 120), mk(104, 300)]},
    {id: 'ex3', ex: true, name: 'Beispiel: Stehen und Kraft', mode: 'timer', items: [mk(3, 60), mk(11, 60), mk(12, 60), mk(5, 60), mk(116, 30), mk(68, 60), mk(75, 60)]},
    {id: 'ex4', ex: true, name: 'Beispiel: Atem (manuell weiter)', mode: 'manual', items: [mk(154, 0), mk(167, 0), mk(168, 0), mk(172, 0)]},
    {id: 'ex5', ex: true, name: 'Beispiel: Faszienrolle Beine', mode: 'timer', items: [mk(133, 60), mk(134, 60), mk(135, 60), mk(136, 60), mk(140, 60)]}
  ].map(p => ({...p, items: p.items.filter(i => BY[i.nr])}));
}
const allProgs = () => [...examples(), ...S.progs];
const getProg = id => allProgs().find(p => p.id === id);
const progTime = p => p.items.reduce((a, i) => a + (i.sec || 0) * (i.sides || 1), 0);

/* ---------- Router ---------- */
const view = {q: '', group: '', fav: false, scroll: 0};
function route() {
  closeOverlay();
  const h = location.hash || '#/';
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', h.startsWith(b.dataset.go.slice(0, 4)) && (b.dataset.go !== '#/' || h === '#/' || h.startsWith('#/e/'))));
  const [, a, b] = h.split('/');
  if (a === 'e') return showEx(+b);
  if (a === 'prog') return showProgs();
  if (a === 'p') return showProg(b);
  if (a === 'set') return showSet();
  showList();
}
window.addEventListener('hashchange', route);
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => { location.hash = b.dataset.go; });

/* ---------- Liste ---------- */
function exMatches(e, qs) {
  if (!qs.length) return true;
  const hay = e._h || (e._h = norm([e.nr, e.name, ...e.alt, e.gruppe, e.stil, e.kurz.lead, ...e.kurz.steps, e.kurz.extra, e.kurz.tip].join(' ')));
  return qs.every(q => hay.includes(q));
}
function showList() {
  main.innerHTML = `
  <input type="search" id="q" placeholder="Übung suchen (Name, Nummer, Stichwort)" value="${esc(view.q)}" autocomplete="off">
  <div class="chips" id="chips"></div><div class="list" id="list"></div>`;
  const chips = $('#chips');
  const mkChip = (t, on, fn) => { const b = document.createElement('button'); b.className = 'chip' + (on ? ' on' : ''); b.textContent = t; b.onclick = fn; chips.append(b); };
  mkChip('Alle', !view.group && !view.fav, () => { view.group = ''; view.fav = false; showList(); });
  mkChip('★ Favoriten', view.fav, () => { view.fav = !view.fav; view.group = ''; showList(); });
  GROUPS.forEach(g => mkChip(g, view.group === g, () => { view.group = view.group === g ? '' : g; view.fav = false; showList(); }));
  const fill = () => {
    const qs = norm(view.q).split(/\s+/).filter(Boolean);
    const L = DATA.filter(e => (!view.group || e.gruppe === view.group) && (!view.fav || S.favs.includes(e.nr)) && exMatches(e, qs));
    $('#topcount').textContent = L.length + ' von ' + DATA.length;
    let h = '', last = null;
    L.forEach(e => {
      if (!view.group && !qs.length && !view.fav && e.gruppe !== last) { last = e.gruppe; h += `<div class="gh">${esc(e.gruppe)}</div>`; }
      const im = e.imgs[0];
      h += `<div class="item" data-nr="${e.nr}">${im ? `<img class="thumb" loading="lazy" src="${imgUrl(im.f)}" alt="">` : '<div class="thumb none">kein Foto</div>'}
      <div class="t"><div class="n"><span class="nr">${e.nr}</span>${esc(e.name)}</div><div class="m">${esc(e.gruppe)}${e.stil ? ' · ' + esc(e.stil) : ''}${sides(e) === 2 ? ' · 2 Seiten' : ''}</div></div>
      <button class="star${S.favs.includes(e.nr) ? ' on' : ''}" data-fav="${e.nr}" aria-label="Favorit">${S.favs.includes(e.nr) ? '★' : '☆'}</button></div>`;
    });
    $('#list').innerHTML = h || '<p class="mut">Keine Treffer.</p>';
  };
  fill();
  $('#q').oninput = ev => { view.q = ev.target.value; fill(); };
  $('#list').onclick = ev => {
    const f = ev.target.closest('[data-fav]');
    if (f) { toggleFav(+f.dataset.fav); f.classList.toggle('on'); f.textContent = f.classList.contains('on') ? '★' : '☆'; return; }
    const it = ev.target.closest('.item'); if (it) { view.scroll = scrollY; location.hash = '#/e/' + it.dataset.nr; }
  };
  scrollTo(0, view.scroll); 
}
function toggleFav(nr) { const i = S.favs.indexOf(nr); i < 0 ? S.favs.push(nr) : S.favs.splice(i, 1); save(); }

/* ---------- Detail ---------- */
let detTab = 'kurz';
function showEx(nr) {
  const e = BY[nr]; if (!e) { location.hash = '#/'; return; }
  $('#topcount').textContent = '';
  const gal = e.imgs.length ? `<div class="gal">${e.imgs.map(i => `<figure><img src="${imgUrl(i.f)}" alt="${esc(i.l || e.name)}">${i.l ? `<figcaption>${esc(i.l)}</figcaption>` : ''}</figure>`).join('')}</div>` : '';
  const k = e.kurz;
  const kurz = `${k.lead ? `<div class="lead">${esc(k.lead)}</div>` : ''}
    <ol class="st">${k.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    ${k.extra ? `<div class="fact"><b>Variante / Zusatz</b>${esc(k.extra)}</div>` : ''}
    ${k.tip ? `<div class="tip"><b>Hinweis</b><br>${esc(k.tip)}</div>` : ''}
    ${!noGegen(k.gegen) ? `<div class="tip gegen"><b>Vorsicht / Gegenanzeigen</b><br>${esc(k.gegen)}</div>` : (k.gegen ? `<div class="fact"><b>Vorsicht / Gegenanzeigen</b>${esc(k.gegen)}</div>` : '')}`;
  const sect = (t, h) => h ? `<h2>${t}</h2>${h}` : '';
  const det = `
    ${e.info.map(f => `<div class="fact"><b>${esc(f.l)}</b>${parts(f.p)}</div>`).join('')}
    ${sect('Ausführung', `<ol class="st">${e.steps.map(s => `<li>${parts(s)}</li>`).join('')}</ol>`)}
    ${sect('Varianten', e.var.map(v => `<div class="var">${v.i != null && e.imgs[v.i] ? `<img src="${imgUrl(e.imgs[v.i].f)}" alt="">` : ''}<div>${v.l ? `<b>${esc(v.l)}</b>` : ''}${parts(v.p)}</div></div>`).join(''))}
    ${sect('Wirkung', e.eff.length ? `<ul class="pl">${e.eff.map(x => `<li>${parts(x)}</li>`).join('')}</ul>` : '')}
    ${sect('Hinweise und Gegenanzeigen', e.hint.length ? `<ul class="pl">${e.hint.map(x => `<li>${parts(x)}</li>`).join('')}</ul>` : '')}
    ${e.see.length ? sect('Siehe auch', e.see.map(s => `<a href="#/e/${s.nr}">${s.nr} · ${esc(s.t)}</a>`).join('<br>')) : ''}
    <p class="small mut">Quellen: ${e.src.map(s => esc(s) + ' = ' + esc(BOOKS[s] || s)).join('; ')}</p>`;
  main.innerHTML = `
    <button class="back" id="bk">‹ Zurück</button>
    <h1><span class="nr">${e.nr}</span>${esc(e.name)}</h1>
    <div class="mut small">${esc(e.gruppe)}${e.stil ? ' · ' + esc(e.stil) : ''}${e.alt.length ? '<br>Auch: ' + esc(e.alt.join(' · ')) : ''}</div>
    <div class="row" style="margin:12px 0"><button class="btn pri grow" id="go">▶ Üben</button><button class="btn" id="add">+ Programm</button><button class="star${S.favs.includes(nr) ? ' on' : ''}" id="fv">${S.favs.includes(nr) ? '★' : '☆'}</button></div>
    ${gal}
    <div class="tabs"><button data-t="kurz" class="${detTab === 'kurz' ? 'on' : ''}">Kurz</button><button data-t="det" class="${detTab === 'det' ? 'on' : ''}">Detail</button></div>
    <div id="body">${detTab === 'kurz' ? kurz : det}</div>
    <div class="row" style="justify-content:space-between;margin-top:16px"><button class="btn sm" id="pv">‹ ${nr > 1 ? nr - 1 : ''}</button><button class="btn sm" id="nx">${nr < DATA.length ? nr + 1 : ''} ›</button></div>`;
  $('#bk').onclick = () => history.length > 1 ? history.back() : (location.hash = '#/');
  $('#fv').onclick = ev => { toggleFav(nr); ev.target.classList.toggle('on'); ev.target.textContent = S.favs.includes(nr) ? '★' : '☆'; };
  $('#go').onclick = () => startPractice({id: 'single', name: e.name, mode: 'timer', items: [{nr, sec: defDur(e), sides: sides(e)}]});
  $('#add').onclick = () => pickProgram(nr);
  $('#pv').onclick = () => { if (nr > 1) location.replace('#/e/' + (nr - 1)); };
  $('#nx').onclick = () => { if (nr < DATA.length) location.replace('#/e/' + (nr + 1)); };
  main.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { detTab = b.dataset.t; showEx(nr); });
  scrollTo(0, 0);
}
function pickProgram(nr) {
  const ov = overlay(`<button class="back" id="x">‹ Abbrechen</button><h1>Zu Programm hinzufügen</h1><div id="pl"></div>
  <button class="btn pri" id="new" style="width:100%;margin-top:10px">+ Neues Programm</button>`);
  $('#pl', ov).innerHTML = S.progs.map(p => `<div class="pi" data-id="${p.id}"><div class="t"><b>${esc(p.name)}</b><div class="mut small">${p.items.length} Übungen</div></div></div>`).join('') || '<p class="mut">Noch keine eigenen Programme.</p>';
  $('#x', ov).onclick = closeOverlay;
  $('#pl', ov).onclick = ev => { const r = ev.target.closest('.pi'); if (!r) return; const p = S.progs.find(q => q.id === r.dataset.id); p.items.push(mk(nr, defDur(BY[nr]))); p.ts = Date.now(); save(); closeOverlay(); toast('Zu „' + p.name + '“ hinzugefügt'); };
  $('#new', ov).onclick = () => { const p = {id: uid(), name: 'Mein Programm', mode: 'timer', items: [mk(nr, defDur(BY[nr]))], ts: Date.now()}; S.progs.push(p); save(); closeOverlay(); location.hash = '#/p/' + p.id; };
}

/* ---------- Overlay ---------- */
let ovEl = null;
function overlay(html) { closeOverlay(); ovEl = document.createElement('div'); ovEl.className = 'ov'; ovEl.innerHTML = html; document.body.append(ovEl); return ovEl; }
function closeOverlay() { if (ovEl) { ovEl.remove(); ovEl = null; } }

/* ---------- Programme ---------- */
function showProgs() {
  $('#topcount').textContent = '';
  const row = p => `<div class="pi" data-id="${p.id}" style="cursor:pointer"><div class="t"><b>${esc(p.name)}</b><span class="badge">${p.mode === 'timer' ? 'Timer' : 'Manuell'}</span><div class="mut small">${p.items.length} Übungen${p.mode === 'timer' ? ' · ca. ' + Math.round(progTime(p) / 60) + ' Min.' : ''}</div></div><button class="btn sm pri" data-run="${p.id}">▶</button></div>`;
  main.innerHTML = `<h1>Programme</h1>
    <div class="row"><button class="btn pri grow" id="new">+ Neues Programm</button></div>
    <h2>Eigene</h2>${S.progs.map(row).join('') || '<p class="mut">Noch keine eigenen Programme. Lege eines an oder kopiere ein Beispiel.</p>'}
    <h2>Beispiele</h2>${examples().map(row).join('')}
    <h2>Übertragen</h2>
    <div class="row"><button class="btn grow" id="snd">Senden (QR)</button><button class="btn grow" id="rcv">Empfangen (QR)</button></div>
    <p class="mut small">Überträgt deine eigenen Programme und Favoriten per QR-Code von einem Gerät auf ein anderes, ohne Internet.</p>`;
  $('#new').onclick = () => { const p = {id: uid(), name: 'Mein Programm', mode: 'timer', items: [], ts: Date.now()}; S.progs.push(p); save(); location.hash = '#/p/' + p.id; };
  main.onclick = ev => {
    const r = ev.target.closest('[data-run]');
    if (r) { ev.stopPropagation(); const p = getProg(r.dataset.run); if (p.items.length) startPractice(p); else toast('Programm ist leer'); return; }
    const c = ev.target.closest('.pi'); if (c) location.hash = '#/p/' + c.dataset.id;
  };
  $('#snd').onclick = () => {
    if (!window.AOSync) return toast('Übertragung nicht geladen');
    if (!S.progs.length && !S.favs.length) return toast('Nichts zu senden');
    AOSync.send({app: 'yogao', data: {progs: S.progs, favs: S.favs}, summary: S.progs.length + ' Programme, ' + S.favs.length + ' Favoriten'});
  };
  $('#rcv').onclick = () => {
    if (!window.AOSync) return toast('Übertragung nicht geladen');
    AOSync.receive({app: 'yogao', apply: d => {
      if (!d || !Array.isArray(d.progs)) throw new Error('Keine yogAO-Daten');
      let n = 0;
      d.progs.forEach(p => {
        if (!p || !p.id || !Array.isArray(p.items)) return;
        p.items = p.items.filter(i => BY[i.nr]);
        const i = S.progs.findIndex(q => q.id === p.id);
        if (i < 0) { S.progs.push(p); n++; } else if ((p.ts || 0) > (S.progs[i].ts || 0)) { S.progs[i] = p; n++; }
      });
      (d.favs || []).forEach(f => { if (BY[f] && !S.favs.includes(f)) S.favs.push(f); });
      save(); route();
      return n + ' Programme übernommen, Favoriten zusammengeführt.';
    }});
  };
}
function showProg(id) {
  const p = getProg(id); if (!p) { location.hash = '#/prog'; return; }
  const ro = !!p.ex;
  $('#topcount').textContent = '';
  const touch = () => { p.ts = Date.now(); save(); };
  const draw = () => {
    main.innerHTML = `<button class="back" id="bk">‹ Programme</button>
    ${ro ? `<h1>${esc(p.name)}</h1><p class="mut small">Beispielprogramm – zum Ändern erst kopieren.</p>` : `<input type="text" id="nm" value="${esc(p.name)}" maxlength="60">`}
    <div class="row" style="margin:10px 0"><span class="mut small">Ablauf:</span>
      <span class="sw" id="md"><button data-m="timer" class="${p.mode === 'timer' ? 'on' : ''}" ${ro ? 'disabled' : ''}>Timer</button><button data-m="manual" class="${p.mode === 'manual' ? 'on' : ''}" ${ro ? 'disabled' : ''}>Manuell</button></span>
      <span class="mut small grow" style="text-align:right">${p.items.length} Übungen${p.mode === 'timer' ? ' · ca. ' + Math.round(progTime(p) / 60) + ' Min.' : ''}</span></div>
    <div class="row"><button class="btn pri grow" id="run">▶ Starten</button>${ro ? '<button class="btn" id="cp">Kopieren</button>' : '<button class="btn" id="add">+ Übung</button>'}</div>
    <div style="margin-top:12px" id="its"></div>
    ${ro ? '' : '<button class="btn red" id="del" style="margin-top:16px">Programm löschen</button>'}`;
    $('#its').innerHTML = p.items.map((it, i) => {
      const e = BY[it.nr];
      return `<div class="pi" data-i="${i}"><span class="nr">${it.nr}</span><div class="t"><b>${esc(e.name)}</b>
        ${p.mode === 'timer' ? `<div class="row small" style="margin-top:4px"><input type="number" min="5" max="3600" step="5" value="${it.sec}" data-sec="${i}" ${ro ? 'disabled' : ''}><span class="mut">Sek.</span>
        ${sides(e) === 2 ? `<span class="sw"><button data-sd="${i}:1" class="${it.sides === 1 ? 'on' : ''}" ${ro ? 'disabled' : ''}>1×</button><button data-sd="${i}:2" class="${it.sides === 2 ? 'on' : ''}" ${ro ? 'disabled' : ''}>2 Seiten</button></span>` : ''}</div>` : (sides(e) === 2 ? `<div class="mut small">2 Seiten</div>` : '')}</div>
        ${ro ? '' : `<div class="row" style="flex-wrap:nowrap"><button class="btn sm" data-up="${i}">↑</button><button class="btn sm" data-dn="${i}">↓</button><button class="btn sm red" data-rm="${i}">✕</button></div>`}</div>`;
    }).join('') || '<p class="mut">Noch keine Übungen.</p>';
    $('#bk').onclick = () => location.hash = '#/prog';
    $('#run').onclick = () => p.items.length ? startPractice(p) : toast('Programm ist leer');
    if (ro) $('#cp').onclick = () => { const c = {id: uid(), name: p.name.replace(/^Beispiel: /, ''), mode: p.mode, items: p.items.map(i => ({...i})), ts: Date.now()}; S.progs.push(c); save(); location.hash = '#/p/' + c.id; };
    else {
      $('#nm').oninput = ev => { p.name = ev.target.value; touch(); };
      $('#md').onclick = ev => { const b = ev.target.closest('[data-m]'); if (!b) return; p.mode = b.dataset.m; p.items.forEach(i => { if (p.mode === 'timer' && !i.sec) i.sec = defDur(BY[i.nr]); }); touch(); draw(); };
      $('#add').onclick = () => pickExercise(nr => { p.items.push(mk(nr, defDur(BY[nr]))); touch(); draw(); });
      $('#del').onclick = () => { if (confirm('Programm „' + p.name + '“ löschen?')) { S.progs = S.progs.filter(q => q.id !== p.id); save(); location.hash = '#/prog'; } };
    }
    $('#its').onchange = ev => { const s = ev.target.dataset.sec; if (s != null) { p.items[+s].sec = Math.max(5, +ev.target.value || 60); touch(); } };
    $('#its').onclick = ev => {
      const t = ev.target.closest('button'); if (!t || ro) return;
      const d = t.dataset;
      if (d.up != null && +d.up > 0) { const i = +d.up; [p.items[i - 1], p.items[i]] = [p.items[i], p.items[i - 1]]; }
      else if (d.dn != null && +d.dn < p.items.length - 1) { const i = +d.dn; [p.items[i + 1], p.items[i]] = [p.items[i], p.items[i + 1]]; }
      else if (d.rm != null) p.items.splice(+d.rm, 1);
      else if (d.sd != null) { const [i, v] = d.sd.split(':'); p.items[+i].sides = +v; }
      else return;
      touch(); draw();
    };
  };
  draw(); scrollTo(0, 0);
}
function pickExercise(cb) {
  const ov = overlay(`<button class="back" id="x">‹ Abbrechen</button><h1>Übung wählen</h1><input type="search" id="q" placeholder="Suchen"><div class="list" id="l" style="margin-top:10px"></div>`);
  const fill = () => {
    const qs = norm($('#q', ov).value).split(/\s+/).filter(Boolean);
    $('#l', ov).innerHTML = DATA.filter(e => exMatches(e, qs)).map(e => `<div class="item" data-nr="${e.nr}"><div class="t"><div class="n"><span class="nr">${e.nr}</span>${esc(e.name)}</div><div class="m">${esc(e.gruppe)}</div></div></div>`).join('');
  };
  fill(); $('#q', ov).oninput = fill;
  $('#x', ov).onclick = closeOverlay;
  $('#l', ov).onclick = ev => { const it = ev.target.closest('.item'); if (it) { closeOverlay(); cb(+it.dataset.nr); } };
}

/* ---------- Musik (IndexedDB) ---------- */
const DB = {
  db: null,
  open() { return this.db ? Promise.resolve(this.db) : new Promise((res, rej) => { const r = indexedDB.open('yogao', 1); r.onupgradeneeded = () => r.result.createObjectStore('tracks', {keyPath: 'id', autoIncrement: true}); r.onsuccess = () => res(this.db = r.result); r.onerror = () => rej(r.error); }); },
  async tx(mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('tracks', mode); const r = fn(t.objectStore('tracks')); t.oncomplete = () => res(r.result); t.onerror = () => rej(t.error); }); },
  all() { return this.tx('readonly', s => s.getAll()); },
  add(name, blob) { return this.tx('readwrite', s => s.add({name, blob})); },
  del(id) { return this.tx('readwrite', s => s.delete(id)); }
};
const Music = {
  tracks: [], idx: -1, el: null, url: null, order: [],
  async load() { try { this.tracks = await DB.all(); } catch (e) { this.tracks = []; } },
  start() {
    if (!S.set.music || !this.tracks.length) return;
    if (!this.el) { this.el = new Audio(); this.el.onended = () => this.next(true); this.el.volume = 0.6; }
    if (this.idx < 0) { this.order = this.tracks.map((_, i) => i); if (S.set.shuffle) this.order.sort(() => Math.random() - .5); this.pos = 0; this.setTrack(this.order[0]); }
    this.el.play().catch(() => {});
  },
  setTrack(i) { const t = this.tracks[i]; if (!t) return; this.idx = i; if (this.url) URL.revokeObjectURL(this.url); this.url = URL.createObjectURL(t.blob); this.el.src = this.url; },
  next(play) { if (!this.tracks.length) return; this.pos = ((this.pos || 0) + 1) % this.order.length; this.setTrack(this.order[this.pos]); if (play) this.el.play().catch(() => {}); },
  pause() { if (this.el) this.el.pause(); },
  stop() { if (this.el) { this.el.pause(); this.el.removeAttribute('src'); } if (this.url) { URL.revokeObjectURL(this.url); this.url = null; } this.idx = -1; },
  get name() { const t = this.tracks[this.idx]; return t ? t.name.replace(/\.[^.]+$/, '') : ''; }
};

/* ---------- Gong ---------- */
let AC = null;
function audioCtx() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function gong(times = 1) {
  const ctx = audioCtx(); if (!ctx) return;
  for (let k = 0; k < times; k++) {
    const t0 = ctx.currentTime + 0.02 + k * 1.6, base = 196;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.9 * S.set.vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 5); g.connect(ctx.destination);
    [[1, 1], [2.01, .5], [2.76, .35], [4.07, .22], [5.43, .12]].forEach(([m, a], i) => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.value = base * m;
      og.gain.setValueAtTime(a, t0); og.gain.exponentialRampToValueAtTime(0.0001, t0 + 5 / (1 + i * .6)); o.connect(og); og.connect(g); o.start(t0); o.stop(t0 + 5.2);
    });
  }
}

/* ---------- Praxis-Modus ---------- */
let P = null, wl = null;
function buildSteps(p) {
  const st = [];
  p.items.forEach((it, idx) => { const e = BY[it.nr]; if (!e) return; const n = it.sides || 1; for (let s = 1; s <= n; s++) st.push({idx, nr: it.nr, side: s, sides: n, dur: p.mode === 'timer' ? (it.sec || defDur(e)) : 0}); });
  return st;
}
async function startPractice(p) {
  const steps = buildSteps(p); if (!steps.length) return;
  audioCtx();
  P = {p, steps, i: 0, phase: 'hold', paused: false, t0: 0, left: 0, timer: null, manual: p.mode !== 'timer'};
  const el = document.createElement('div'); el.id = 'prax'; document.body.append(el); P.el = el;
  if (S.set.wake && navigator.wakeLock) { try { wl = await navigator.wakeLock.request('screen'); } catch (e) {} }
  await Music.load();
  gotoStep(0, true);
  P.timer = setInterval(tick, 200);
  document.addEventListener('keydown', praxKey);
}
function stepHtml(st) {
  const e = BY[st.nr], k = e.kurz;
  const imgs = e.imgs.length ? e.imgs.map(i => `<figure><img src="${imgUrl(i.f)}" alt="">${i.l ? `<figcaption>${esc(i.l)}</figcaption>` : ''}</figure>`).join('') : '';
  return {imgs, txt: `${k.lead ? `<div class="lead">${esc(k.lead)}</div>` : ''}<ol class="st">${k.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>${k.tip ? `<div class="tip"><b>Hinweis</b><br>${esc(k.tip)}</div>` : ''}${!noGegen(k.gegen) ? `<div class="tip gegen"><b>Vorsicht</b><br>${esc(k.gegen)}</div>` : ''}`};
}
function gotoStep(i, first) {
  P.i = i; const st = P.steps[i]; const e = BY[st.nr];
  const needGap = !first && !P.manual && S.set.gap > 0;
  P.phase = needGap ? 'gap' : 'hold';
  P.left = needGap ? S.set.gap : st.dur; P.t0 = performance.now(); P.total = P.left; P.paused = false;
  render();
  if (P.phase === 'hold') beginHold(); else Music.pause();
}
function beginHold() { P.phase = 'hold'; P.total = P.steps[P.i].dur; P.left = P.total; P.t0 = performance.now(); if (!P.paused) Music.start(); }
function render() {
  const st = P.steps[P.i], e = BY[st.nr], nx = P.steps[P.i + 1], h = stepHtml(st);
  const gap = P.phase === 'gap';
  P.el.className = P.manual ? 'manual' : '';
  P.el.innerHTML = `<div class="ph"><div><div class="pn"><span class="nr">${e.nr}</span>${esc(e.name)}</div><div class="ps">Übung ${st.idx + 1}/${P.p.items.length}${st.sides > 1 ? ` · Seite ${st.side}/${st.sides}` : ''}${nx ? ` · danach: ${esc(BY[nx.nr].name)}${nx.sides > 1 && nx.idx === st.idx ? ' (andere Seite)' : ''}` : ' · letzte Übung'}</div></div><button class="btn sm red" id="pend">Ende</button></div>
  <div class="pb"><div class="pimg">${h.imgs}</div><div class="right"><div class="pt"><div class="phase" id="pph"></div><div class="clock" id="pclk"></div><div class="bar"><i id="pbar"></i></div><div class="musicline" id="pmus"></div></div><div class="ptxt">${h.txt}</div></div></div>
  <div class="ctl"><button class="btn" id="pprev">‹ Zurück</button>${P.manual ? '' : '<button class="btn pri" id="ppause">Pause</button>'}<button class="btn ${P.manual ? 'pri' : ''}" id="pnext">${P.manual ? (nx ? (nx.idx === st.idx ? 'Seitenwechsel ›' : 'Weiter ›') : 'Fertig ✓') : 'Weiter ›'}</button></div>`;
  $('#pend').onclick = endPractice;
  $('#pprev').onclick = () => prevStep();
  $('#pnext').onclick = () => nextStep(true);
  if (!P.manual) $('#ppause').onclick = togglePause;
  paint();
}
function paint() {
  if (!P || !P.el) return;
  const st = P.steps[P.i];
  const ph = $('#pph'); if (!ph) return;
  const gap = P.phase === 'gap';
  ph.textContent = P.manual ? (st.sides > 1 ? `Seite ${st.side} von ${st.sides}` : '') : gap ? (st.sides > 1 && st.side > 1 ? 'Seitenwechsel – mach dich bereit' : 'Mach dich bereit') : (P.paused ? 'Pausiert' : (st.sides > 1 ? `Halten · Seite ${st.side}` : 'Halten'));
  const c = $('#pclk'); if (c) c.textContent = fmt(P.left);
  const b = $('#pbar'); if (b) { b.style.width = (P.total ? 100 * (1 - P.left / P.total) : 0) + '%'; b.style.background = gap ? 'var(--ao)' : 'var(--acc)'; }
  const m = $('#pmus'); if (m) m.textContent = Music.idx >= 0 && !gap && !P.paused ? '♪ ' + Music.name : '';
}
function tick() {
  if (!P || P.manual || P.paused) return;
  const now = performance.now(); P.left = Math.max(0, P.total - (now - P.t0) / 1000);
  if (P.left <= 0.05) {
    if (P.phase === 'gap') { beginHold(); render(); return; }
    Music.pause(); gong(P.i === P.steps.length - 1 ? 2 : 1); nextStep(false);
  } else paint();
}
function nextStep(manualTap) {
  if (P.i >= P.steps.length - 1) {
    if (P.manual) gong(2);
    return finishPractice();
  }
  gotoStep(P.i + 1);
  if (manualTap && P.manual) gong(1);
}
function prevStep() { if (P.i > 0) { const j = P.i - 1; gotoStepNoGap(j); } else { P.t0 = performance.now(); P.left = P.total; paint(); } }
function gotoStepNoGap(j) { P.i = j; const st = P.steps[j]; P.phase = 'hold'; P.total = st.dur; P.left = st.dur; P.t0 = performance.now(); P.paused = false; render(); Music.start(); }
function togglePause() {
  if (P.paused) { P.paused = false; P.t0 = performance.now() - (P.total - P.left) * 1000; if (P.phase === 'hold') Music.start(); audioCtx(); }
  else { P.paused = true; Music.pause(); }
  const b = $('#ppause'); if (b) b.textContent = P.paused ? 'Weiter' : 'Pause'; paint();
}
function praxKey(ev) {
  if (!P) return;
  if (ev.key === ' ' && !P.manual) { ev.preventDefault(); togglePause(); }
  else if (ev.key === 'ArrowRight' || ev.key === 'Enter') { ev.preventDefault(); nextStep(true); }
  else if (ev.key === 'ArrowLeft') { ev.preventDefault(); prevStep(); }
  else if (ev.key === 'Escape') endPractice();
}
function cleanup() {
  clearInterval(P.timer); Music.stop(); document.removeEventListener('keydown', praxKey);
  if (wl) { wl.release().catch(() => {}); wl = null; }
  P.el.remove(); P = null;
}
function endPractice() { if (confirm('Übung beenden?')) cleanup(); }
function finishPractice() {
  const n = P.p.items.length; Music.stop(); clearInterval(P.timer);
  P.el.className = ''; P.el.innerHTML = `<div class="ph"><div class="pn">Geschafft</div></div><div class="pb" style="display:flex;align-items:center;justify-content:center;text-align:center"><div><div style="font-size:3rem">🙏</div><p style="font-size:1.2rem">${n} ${n === 1 ? 'Übung' : 'Übungen'} abgeschlossen.</p></div></div><div class="ctl"><button class="btn pri" id="pclose">Schließen</button></div>`;
  $('#pclose').onclick = cleanup;
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && P && !P.paused && S.set.wake && navigator.wakeLock && !wl) navigator.wakeLock.request('screen').then(w => wl = w).catch(() => {}); });

/* ---------- Einstellungen ---------- */
async function showSet() {
  $('#topcount').textContent = '';
  await Music.load();
  const sw = (k, a, b) => `<span class="sw" data-k="${k}"><button data-v="1" class="${S.set[k] ? 'on' : ''}">${a}</button><button data-v="0" class="${!S.set[k] ? 'on' : ''}">${b}</button></span>`;
  main.innerHTML = `<h1>Mehr</h1>
  <div class="card"><h2 style="margin-top:0">Praxis</h2>
    <div class="row" style="margin-bottom:10px"><span class="grow">Standard-Haltedauer (Sek.)</span><input type="number" id="dur" min="5" max="3600" step="5" value="${S.set.dur}" style="width:100px"></div>
    <div class="row" style="margin-bottom:10px"><span class="grow">Pause zwischen Übungen/Seiten (Sek.)</span><input type="number" id="gap" min="0" max="60" step="1" value="${S.set.gap}" style="width:100px"></div>
    <div class="row" style="margin-bottom:10px"><span class="grow">Dauer aus den Büchern vorschlagen</span>${sw('bookdur', 'Ja', 'Nein')}</div>
    <div class="row" style="margin-bottom:10px"><span class="grow">Bildschirm anlassen</span>${sw('wake', 'Ja', 'Nein')}</div>
    <div class="row"><span class="grow">Gong-Lautstärke</span><input type="range" id="vol" min="0.1" max="1" step="0.05" value="${S.set.vol}"><button class="btn sm" id="tg">Test</button></div></div>
  <div class="card"><h2 style="margin-top:0">Musik (eigene Dateien)</h2>
    <p class="mut small">Die Musik läuft nur während der Haltezeit und pausiert beim Gong. Die Dateien bleiben auf diesem Gerät.</p>
    <div class="row" style="margin-bottom:10px"><span class="grow">Musik beim Üben</span>${sw('music', 'An', 'Aus')}</div>
    <div class="row" style="margin-bottom:10px"><span class="grow">Reihenfolge</span>${sw('shuffle', 'Zufällig', 'Der Reihe nach')}</div>
    <input type="file" id="mf" accept="audio/*" multiple hidden><button class="btn" id="madd">+ Audiodateien hinzufügen</button>
    <div id="ml" style="margin-top:10px"></div></div>
  <div class="card"><h2 style="margin-top:0">Über yog<b style="color:var(--ao)">AO</b></h2>
    <p>Version ${VERSION}</p><button class="btn" id="upd">Aktualisieren</button>
    <p class="small mut" style="margin-top:12px">Alle Inhalte stammen aus diesen Büchern: ${Object.entries(BOOKS).map(([k, v]) => esc(k) + ' = ' + esc(v)).join('; ')}. Gesundheits- und Gegenanzeigenhinweise sind nur die aus den Büchern, keine eigenen Empfehlungen. Bei Beschwerden frage Arzt oder Ärztin.</p></div>`;
  const num = (id, k, lo, hi) => $(id).onchange = ev => { S.set[k] = Math.min(hi, Math.max(lo, +ev.target.value || lo)); save(); };
  num('#dur', 'dur', 5, 3600); num('#gap', 'gap', 0, 60);
  $('#vol').oninput = ev => { S.set.vol = +ev.target.value; save(); };
  $('#tg').onclick = () => gong(1);
  main.querySelectorAll('.sw[data-k]').forEach(w => w.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; S.set[w.dataset.k] = b.dataset.v === '1'; save(); w.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
  const ml = () => { $('#ml').innerHTML = Music.tracks.map(t => `<div class="pi"><div class="t">♪ ${esc(t.name)}</div><button class="btn sm red" data-d="${t.id}">✕</button></div>`).join('') || '<p class="mut small">Noch keine Dateien.</p>'; };
  ml();
  $('#madd').onclick = () => $('#mf').click();
  $('#mf').onchange = async ev => { for (const f of ev.target.files) { try { await DB.add(f.name, f); } catch (e) { toast('Speichern fehlgeschlagen'); } } await Music.load(); ml(); };
  $('#ml').onclick = async ev => { const d = ev.target.closest('[data-d]'); if (d) { await DB.del(+d.dataset.d); await Music.load(); ml(); } };
  $('#upd').onclick = async () => {
    if (!('serviceWorker' in navigator)) return toast('Nicht unterstützt');
    const reg = await navigator.serviceWorker.getRegistration(); if (!reg) return toast('Kein Service Worker');
    toast('Suche nach Update …'); try { await reg.update(); } catch (e) { return toast('Offline – kein Update möglich'); }
    setTimeout(() => toast(reg.installing || reg.waiting ? 'Update wird geladen …' : 'Du hast die neueste Version (' + VERSION + ')'), 1500);
  };
  scrollTo(0, 0);
}

/* ---------- Start ---------- */
(async () => {
  try { DATA = await (await fetch('data/exercises.json')).json(); } catch (e) { main.innerHTML = '<p>Daten konnten nicht geladen werden.</p>'; return; }
  DATA.forEach(e => BY[e.nr] = e);
  route();
  if ('serviceWorker' in navigator) {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !P) location.reload(); else if (had) toast('Update bereit – nach dem Üben neu laden'); });
  }
})();
