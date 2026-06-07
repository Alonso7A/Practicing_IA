/* =========================================================
   Mi Reproductor
   - Buscar en Audius (catálogo abierto)
   - Descargar a PC o guardar dentro de la página (IndexedDB)
   - Biblioteca + playlists, orden / aleatorio
   ========================================================= */

const APP = 'Practicing_IA_Player';

/* ===================== Audius API ===================== */
let AUDIUS_HOST = null;

async function getHost() {
  if (AUDIUS_HOST) return AUDIUS_HOST;
  try {
    const res = await fetch('https://api.audius.co');
    const json = await res.json();
    const hosts = (json && json.data) || [];
    AUDIUS_HOST = hosts[Math.floor(Math.random() * hosts.length)] || hosts[0];
  } catch {
    AUDIUS_HOST = null;
  }
  if (!AUDIUS_HOST) AUDIUS_HOST = 'https://discoveryprovider.audius.co';
  return AUDIUS_HOST;
}

async function searchTracks(query) {
  const host = await getHost();
  const url = `${host}/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=${APP}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  return (json.data || []).filter(t => t && t.id);
}

function streamUrl(audiusId) {
  return `${AUDIUS_HOST || 'https://discoveryprovider.audius.co'}/v1/tracks/${audiusId}/stream?app_name=${APP}`;
}

function metaFromAudius(t) {
  return {
    id: 'audius:' + t.id,
    source: 'audius',
    audiusId: t.id,
    title: t.title || 'Sin título',
    artist: (t.user && t.user.name) || 'Desconocido',
    artwork: (t.artwork && (t.artwork['150x150'] || t.artwork['480x480'])) || null,
    duration: t.duration || 0,
    stored: false
  };
}

/* ===================== IndexedDB (audio offline) ===================== */
const DB_NAME = 'reproductor-db';
const STORE = 'audio';

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(key, blob) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function idbGet(key) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => res(r.result || null);
    r.onerror = () => rej(r.error);
  });
}
async function idbDelete(key) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

/* ===================== Estado / persistencia ===================== */
const LS_LIB = 'reproductor-lib-v1';
const LS_PL  = 'reproductor-playlists-v1';

let library   = load(LS_LIB, []);
let playlists = load(LS_PL, []);
let searchResults = [];        // metas del último resultado de búsqueda

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}
function saveLib() { localStorage.setItem(LS_LIB, JSON.stringify(library)); }
function savePlaylists() { localStorage.setItem(LS_PL, JSON.stringify(playlists)); }

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) ||
    (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
}
function findInLib(id) { return library.find(t => t.id === id); }

/* ===================== Utilidades ===================== */
function $(sel) { return document.querySelector(sel); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmt(sec) {
  sec = Math.floor(sec || 0);
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return m + ':' + s;
}
function artStyle(url) {
  return url ? ` style="background-image:url('${esc(url)}')"` : '';
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ===================== Reproductor ===================== */
const audio = new Audio();
let queue = [];          // array de metas
let qIndex = -1;
let current = null;      // meta en reproducción
let shuffle = false;
let repeat = 'none';     // none | all | one
let curObjectUrl = null;
let seeking = false;

async function playMeta(meta, newQueue) {
  if (!meta) return;
  if (Array.isArray(newQueue)) {
    queue = newQueue;
    qIndex = queue.findIndex(t => t.id === meta.id);
  }
  current = meta;

  // liberar URL anterior si era un blob
  if (curObjectUrl) { URL.revokeObjectURL(curObjectUrl); curObjectUrl = null; }

  let src = null;
  if (meta.source === 'local' || meta.stored) {
    const blob = await idbGet(meta.id);
    if (blob) { curObjectUrl = URL.createObjectURL(blob); src = curObjectUrl; }
  }
  if (!src) {
    if (meta.source === 'audius') src = streamUrl(meta.audiusId);
    else { toast('No se encontró el audio de esta canción.'); return; }
  }

  audio.src = src;
  try { await audio.play(); } catch { /* el usuario puede pulsar play */ }
  $('#player').classList.remove('hidden');
  renderPlayer();
  highlightPlaying();
}

function togglePlay() {
  if (!current) return;
  if (audio.paused) audio.play(); else audio.pause();
}

function next(auto) {
  if (!queue.length) return;
  if (auto && repeat === 'one') { audio.currentTime = 0; audio.play(); return; }
  if (shuffle) {
    if (queue.length === 1) { audio.currentTime = 0; audio.play(); return; }
    let n; do { n = Math.floor(Math.random() * queue.length); } while (n === qIndex);
    qIndex = n;
  } else {
    qIndex++;
    if (qIndex >= queue.length) {
      if (repeat === 'all') qIndex = 0;
      else { qIndex = queue.length - 1; return; }  // fin de la cola
    }
  }
  playMeta(queue[qIndex]);
}

function prev() {
  if (!queue.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  qIndex = shuffle ? Math.floor(Math.random() * queue.length) : qIndex - 1;
  if (qIndex < 0) qIndex = 0;
  playMeta(queue[qIndex]);
}

// Eventos del elemento de audio
audio.addEventListener('ended', () => next(true));
audio.addEventListener('play', renderPlayer);
audio.addEventListener('pause', renderPlayer);
audio.addEventListener('loadedmetadata', () => {
  $('#dur-time').textContent = fmt(audio.duration);
});
audio.addEventListener('timeupdate', () => {
  if (seeking) return;
  $('#cur-time').textContent = fmt(audio.currentTime);
  const pct = audio.duration ? (audio.currentTime / audio.duration) * 1000 : 0;
  $('#seek').value = pct;
});
audio.addEventListener('error', () => {
  if (current) toast('No se pudo reproducir "' + current.title + '".');
});

function renderPlayer() {
  $('#btn-play').textContent = audio.paused ? '▶️' : '⏸';
  $('#btn-shuffle').classList.toggle('active', shuffle);
  $('#btn-repeat').classList.toggle('active', repeat !== 'none');
  $('#btn-repeat').textContent = repeat === 'one' ? '🔂' : '🔁';
  if (current) {
    $('#np-title').textContent = current.title;
    $('#np-artist').textContent = current.artist;
    const art = $('#np-art');
    art.style.backgroundImage = current.artwork ? `url('${current.artwork}')` : '';
    art.textContent = current.artwork ? '' : '🎵';
  }
}

function highlightPlaying() {
  document.querySelectorAll('.track-row').forEach(row => {
    row.classList.toggle('playing', current && row.dataset.id === current.id);
  });
}

/* ===================== Descargas ===================== */
async function fetchBlob(meta) {
  if (meta.source !== 'audius') throw new Error('sin origen');
  const res = await fetch(streamUrl(meta.audiusId));
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.blob();
}

async function downloadToPC(meta) {
  toast('Descargando "' + meta.title + '"...');
  try {
    const blob = await fetchBlob(meta);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = meta.title.replace(/[^a-z0-9áéíóúñ ]/gi, '_').slice(0, 60) + '.mp3';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    toast('Descargada en tu PC ✓');
  } catch {
    toast('No se pudo descargar (el servidor bloqueó la descarga). El streaming sí funciona.');
  }
}

async function saveOffline(meta) {
  addToLibrary(meta, true);   // primero la metemos en biblioteca
  toast('Guardando "' + meta.title + '" en la página...');
  try {
    const blob = await fetchBlob(meta);
    await idbPut(meta.id, blob);
    const t = findInLib(meta.id);
    if (t) { t.stored = true; saveLib(); }
    renderLibrary();
    toast('Guardada en la página 💾 (disponible sin internet)');
  } catch {
    toast('No se pudo guardar el audio. Quedó en tu biblioteca como streaming ☁️');
  }
}

/* ===================== Biblioteca ===================== */
function addToLibrary(meta, silent) {
  if (!findInLib(meta.id)) {
    library.unshift({ ...meta });
    saveLib();
    renderLibrary();
    if (!silent) toast('Agregada a tu biblioteca ➕');
  } else if (!silent) {
    toast('Ya estaba en tu biblioteca.');
  }
}

async function removeFromLibrary(id) {
  const t = findInLib(id);
  if (!t) return;
  if (!confirm(`¿Quitar "${t.title}" de tu biblioteca?`)) return;
  if (t.stored || t.source === 'local') { try { await idbDelete(id); } catch {} }
  library = library.filter(x => x.id !== id);
  playlists.forEach(p => p.tracks = p.tracks.filter(tid => tid !== id));
  saveLib(); savePlaylists();
  renderLibrary(); renderPlaylists();
  toast('Quitada de la biblioteca.');
}

async function handleFiles(fileList) {
  const files = [...fileList].filter(f => f.type.startsWith('audio/'));
  for (const file of files) {
    const id = 'local:' + uid();
    try { await idbPut(id, file); } catch { toast('No se pudo guardar ' + file.name); continue; }
    library.unshift({
      id, source: 'local', audiusId: null,
      title: file.name.replace(/\.[^.]+$/, ''),
      artist: 'Mis archivos',
      artwork: null, duration: 0, stored: true
    });
  }
  saveLib();
  renderLibrary();
  if (files.length) toast(files.length + ' archivo(s) agregados a tu biblioteca ✓');
}

/* ===================== Render: Buscar ===================== */
function renderSearch(metas) {
  const box = $('#search-results');
  box.innerHTML = metas.map(m => `
    <div class="track-card" data-id="${esc(m.id)}">
      <div class="art"${artStyle(m.artwork)}>${m.artwork ? '' : '🎵'}</div>
      <div class="t-title">${esc(m.title)}</div>
      <div class="t-artist">${esc(m.artist)}</div>
      <div class="t-actions">
        <button class="icon-btn play" data-act="play" title="Reproducir">▶️</button>
        <button class="icon-btn add"  data-act="add"  title="Agregar a biblioteca">➕</button>
        <button class="icon-btn dl"   data-act="dl"   title="Descargar a mi PC">⬇️</button>
        <button class="icon-btn save" data-act="save" title="Guardar en la página">💾</button>
      </div>
    </div>`).join('');
}

/* ===================== Render: Biblioteca ===================== */
function libRow(m) {
  const badge = m.source === 'local'
    ? '<span class="badge local">Mi archivo</span>'
    : (m.stored ? '<span class="badge offline">💾 Guardada</span>'
                : '<span class="badge stream">☁️ Streaming</span>');
  const dlBtns = m.source === 'audius' ? `
        <button class="icon-btn dl"   data-act="dl"   title="Descargar a mi PC">⬇️</button>
        ${m.stored ? '' : '<button class="icon-btn save" data-act="save" title="Guardar en la página">💾</button>'}`
    : '';
  return `
    <div class="track-row" data-id="${esc(m.id)}">
      <div class="art-sm"${artStyle(m.artwork)}>${m.artwork ? '' : '🎵'}</div>
      <div class="t-main">
        <div class="t-title">${esc(m.title)}</div>
        <div class="t-artist">${esc(m.artist)}</div>
      </div>
      ${badge}
      <div class="row-actions">
        <button class="icon-btn play" data-act="play"   title="Reproducir">▶️</button>
        <button class="icon-btn add"  data-act="toplay" title="Agregar a playlist">🎶</button>
        ${dlBtns}
        <button class="icon-btn del"  data-act="remove" title="Quitar">🗑</button>
      </div>
    </div>`;
}

function renderLibrary() {
  $('#library-list').innerHTML = library.map(libRow).join('');
  $('#lib-count').textContent = library.length;
  $('#library-empty').style.display = library.length ? 'none' : 'block';
  highlightPlaying();
}

/* ===================== Render: Playlists ===================== */
let openPlaylists = new Set();

function renderPlaylists() {
  const box = $('#playlists-list');
  box.innerHTML = playlists.map(p => {
    const tracks = p.tracks.map(findInLib).filter(Boolean);
    const open = openPlaylists.has(p.id);
    const body = tracks.length
      ? tracks.map(libRow).join('')
      : '<p class="playlist-empty-msg">Vacía. Agrega canciones desde tu biblioteca con 🎶</p>';
    return `
      <div class="playlist-card ${open ? 'open' : ''}" data-pl="${esc(p.id)}">
        <div class="playlist-head" data-act="toggle">
          <span>🎶</span>
          <h3>${esc(p.name)}</h3>
          <span class="pl-count">${tracks.length} ${tracks.length === 1 ? 'canción' : 'canciones'}</span>
          <button class="icon-btn play" data-act="play-pl" title="Reproducir">▶️</button>
          <button class="icon-btn add"  data-act="shuffle-pl" title="Aleatorio">🔀</button>
          <button class="icon-btn del"  data-act="del-pl" title="Borrar playlist">🗑</button>
        </div>
        <div class="playlist-body">${body}</div>
      </div>`;
  }).join('');
  $('#playlists-empty').style.display = playlists.length ? 'none' : 'block';
  highlightPlaying();
}

function playlistMetas(p) {
  return p.tracks.map(findInLib).filter(Boolean);
}

/* ===================== Modal: agregar a playlist ===================== */
let pendingTrackId = null;

function openPlaylistModal(trackId) {
  const t = findInLib(trackId);
  if (!t) return;
  pendingTrackId = trackId;
  $('#modal-track').textContent = `"${t.title}" — ${t.artist}`;
  renderModalPlaylists();
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); pendingTrackId = null; }

function renderModalPlaylists() {
  const box = $('#modal-playlists');
  if (!playlists.length) {
    box.innerHTML = '<p class="playlist-empty-msg">No tienes playlists. Crea una abajo 👇</p>';
    return;
  }
  box.innerHTML = playlists.map(p => {
    const inIt = p.tracks.includes(pendingTrackId);
    return `
      <div class="modal-pl-item ${inIt ? 'in' : ''}" data-pl="${esc(p.id)}">
        <span>${esc(p.name)}</span>
        <span>${inIt ? '✓ Añadida' : '+ Añadir'}</span>
      </div>`;
  }).join('');
}

function togglePlaylistMembership(plId) {
  const p = playlists.find(x => x.id === plId);
  if (!p || !pendingTrackId) return;
  if (p.tracks.includes(pendingTrackId)) p.tracks = p.tracks.filter(t => t !== pendingTrackId);
  else p.tracks.push(pendingTrackId);
  savePlaylists();
  renderModalPlaylists();
  renderPlaylists();
}

/* ===================== Eventos: pestañas ===================== */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    tab.classList.add('active');
    $('#view-' + tab.dataset.view).classList.add('active');
  });
});

/* ===================== Eventos: buscar ===================== */
$('#search-form').addEventListener('submit', async e => {
  e.preventDefault();
  const q = $('#search-input').value.trim();
  if (!q) return;
  $('#search-status').textContent = 'Buscando...';
  $('#search-results').innerHTML = '';
  try {
    const raw = await searchTracks(q);
    searchResults = raw.map(metaFromAudius);
    if (!searchResults.length) { $('#search-status').textContent = 'Sin resultados para "' + q + '".'; return; }
    $('#search-status').textContent = `${searchResults.length} resultados para "${q}"`;
    renderSearch(searchResults);
  } catch {
    $('#search-status').textContent = 'No se pudo conectar al catálogo. Revisa tu internet e intenta de nuevo.';
  }
});

$('#search-results').addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const card = e.target.closest('[data-id]');
  const meta = searchResults.find(m => m.id === card.dataset.id);
  if (!meta) return;
  switch (btn.dataset.act) {
    case 'play': playMeta(meta, searchResults); break;
    case 'add':  addToLibrary(meta); break;
    case 'dl':   downloadToPC(meta); break;
    case 'save': saveOffline(meta); break;
  }
});

/* ===================== Eventos: biblioteca ===================== */
$('#file-input').addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });
$('#play-all-lib').addEventListener('click', () => {
  if (!library.length) return toast('Tu biblioteca está vacía.');
  shuffle = false; playMeta(library[0], [...library]);
});
$('#shuffle-all-lib').addEventListener('click', () => {
  if (!library.length) return toast('Tu biblioteca está vacía.');
  shuffle = true;
  const start = library[Math.floor(Math.random() * library.length)];
  playMeta(start, [...library]);
});

$('#library-list').addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = e.target.closest('[data-id]').dataset.id;
  const meta = findInLib(id);
  if (!meta) return;
  switch (btn.dataset.act) {
    case 'play':   playMeta(meta, [...library]); break;
    case 'toplay': openPlaylistModal(id); break;
    case 'dl':     downloadToPC(meta); break;
    case 'save':   saveOffline(meta); break;
    case 'remove': removeFromLibrary(id); break;
  }
});

/* ===================== Eventos: playlists ===================== */
$('#playlist-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#playlist-name').value.trim();
  if (!name) return;
  playlists.push({ id: 'pl:' + uid(), name, tracks: [] });
  savePlaylists();
  $('#playlist-name').value = '';
  renderPlaylists();
  toast('Playlist "' + name + '" creada 🎶');
});

$('#playlists-list').addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const card = e.target.closest('[data-pl]');
  const plId = card.dataset.pl;
  const p = playlists.find(x => x.id === plId);
  if (!p) return;

  switch (btn.dataset.act) {
    case 'toggle':
      if (openPlaylists.has(plId)) openPlaylists.delete(plId); else openPlaylists.add(plId);
      renderPlaylists();
      return;
    case 'play-pl': {
      const metas = playlistMetas(p);
      if (!metas.length) return toast('Esta playlist está vacía.');
      shuffle = false; playMeta(metas[0], metas);
      return;
    }
    case 'shuffle-pl': {
      const metas = playlistMetas(p);
      if (!metas.length) return toast('Esta playlist está vacía.');
      shuffle = true; playMeta(metas[Math.floor(Math.random() * metas.length)], metas);
      return;
    }
    case 'del-pl':
      if (!confirm(`¿Borrar la playlist "${p.name}"? (no borra las canciones de tu biblioteca)`)) return;
      playlists = playlists.filter(x => x.id !== plId);
      savePlaylists(); renderPlaylists();
      return;
  }

  // botones dentro de las filas de canciones de la playlist
  const row = e.target.closest('.track-row');
  if (!row) return;
  const id = row.dataset.id;
  const meta = findInLib(id);
  if (!meta) return;
  switch (btn.dataset.act) {
    case 'play':   playMeta(meta, playlistMetas(p)); break;
    case 'toplay': openPlaylistModal(id); break;
    case 'dl':     downloadToPC(meta); break;
    case 'save':   saveOffline(meta); break;
    case 'remove': // dentro de una playlist, quitar = sacar de la playlist
      p.tracks = p.tracks.filter(t => t !== id);
      savePlaylists(); renderPlaylists();
      toast('Quitada de la playlist.');
      break;
  }
});

/* ===================== Eventos: modal ===================== */
$('#modal-playlists').addEventListener('click', e => {
  const item = e.target.closest('[data-pl]');
  if (item) togglePlaylistMembership(item.dataset.pl);
});
$('#modal-newpl').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#modal-newpl-name').value.trim();
  if (!name) return;
  const p = { id: 'pl:' + uid(), name, tracks: pendingTrackId ? [pendingTrackId] : [] };
  playlists.push(p);
  savePlaylists();
  $('#modal-newpl-name').value = '';
  renderModalPlaylists(); renderPlaylists();
  toast('Playlist "' + name + '" creada con la canción 🎶');
});
$('#modal-close').addEventListener('click', closeModal);
$('#modal').addEventListener('click', e => { if (e.target === $('#modal')) closeModal(); });

/* ===================== Eventos: barra del reproductor ===================== */
$('#btn-play').addEventListener('click', togglePlay);
$('#btn-next').addEventListener('click', () => next(false));
$('#btn-prev').addEventListener('click', prev);
$('#btn-shuffle').addEventListener('click', () => { shuffle = !shuffle; renderPlayer(); });
$('#btn-repeat').addEventListener('click', () => {
  repeat = repeat === 'none' ? 'all' : repeat === 'all' ? 'one' : 'none';
  renderPlayer();
});

const seek = $('#seek');
seek.addEventListener('input', () => { seeking = true; });
seek.addEventListener('change', () => {
  if (audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration;
  seeking = false;
});
$('#volume').addEventListener('input', e => { audio.volume = e.target.value / 100; });

/* ===================== Inicio ===================== */
getHost();          // resuelve un nodo de Audius en segundo plano
renderLibrary();
renderPlaylists();
