/* yogAO – Service Worker: App, Daten und Bilder offline. Seitenaufrufe: erst Netzwerk, sonst Cache. */
'use strict';
const CACHE_VERSION = 'yogao-v1.0.0';
const SHELL = ['./', './index.html', './app.js', './app.css', './manifest.json', './aosync.js', './lib/qrcode.js', './lib/jsqr.js',
  './icon-192.png', './icon-512.png', './icon-maskable.png', './apple-touch-icon.png', './data/exercises.json'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await Promise.allSettled(SHELL.map(u => cache.add(new Request(u, {cache: 'reload'}))));
    try {
      const list = await (await fetch('data/exercises.json', {cache: 'reload'})).json();
      const files = [...new Set(list.flatMap(e => e.imgs.map(i => 'img/' + i.f)))];
      for (let i = 0; i < files.length; i += 12)
        await Promise.allSettled(files.slice(i, i + 12).map(u => cache.add(new Request(u, {cache: 'reload'}))));
    } catch (e) {}
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 3000);
        const r = await fetch(req, {signal: ctl.signal}); clearTimeout(t);
        if (r.ok) (await caches.open(CACHE_VERSION)).put('./index.html', r.clone());
        return r;
      } catch (e) { return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error(); }
    })());
    return;
  }
  event.respondWith(caches.match(req, {ignoreSearch: true}).then(c => c || fetch(req).then(r => {
    if (r.ok) { const cp = r.clone(); caches.open(CACHE_VERSION).then(ch => ch.put(req, cp)); }
    return r;
  })));
});
