// ===== Persistencia =====
const STORAGE_KEY = 'mis-tareas-v1';

function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

let tasks = loadTasks();
let editingId = null;

// ===== Reloj en vivo =====
function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = now.toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  document.getElementById('time').textContent = time;
  document.getElementById('date').textContent = date;
}
setInterval(updateClock, 1000);
updateClock();

// ===== Cálculo de estado por tiempo =====
function getTimeStatus(task) {
  if (task.completed) return 'done';
  const now = Date.now();
  const start = new Date(task.start).getTime();
  const end = new Date(task.deadline).getTime();
  if (now > end) return 'overdue';
  const total = end - start;
  const elapsed = now - start;
  const ratio = total > 0 ? elapsed / total : 0;
  if (ratio < 0.5) return 'ok';        // verde
  if (ratio < 0.8) return 'warning';   // amarillo
  return 'urgent';                     // naranja
}

function getTimeRatio(task) {
  const now = Date.now();
  const start = new Date(task.start).getTime();
  const end = new Date(task.deadline).getTime();
  const total = end - start;
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, (now - start) / total));
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

function timeLeft(task) {
  const now = Date.now();
  const end = new Date(task.deadline).getTime();
  const diff = end - now;
  if (diff < 0) {
    const abs = Math.abs(diff);
    const days = Math.floor(abs / 86400000);
    const hours = Math.floor((abs % 86400000) / 3600000);
    return `Vencida hace ${days > 0 ? days + 'd ' : ''}${hours}h`;
  }
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `Faltan ${days}d ${hours}h`;
  if (hours > 0) return `Faltan ${hours}h ${mins}m`;
  return `Faltan ${mins}m`;
}

// ===== Render =====
function render() {
  const filter = document.getElementById('filter-type').value;
  const listActive = document.getElementById('list-active');
  const listDone = document.getElementById('list-done');
  listActive.innerHTML = '';
  listDone.innerHTML = '';

  const filtered = tasks.filter(t => filter === 'all' || t.type === filter);
  const active = filtered.filter(t => !t.completed)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  const done = filtered.filter(t => t.completed)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  active.forEach(t => listActive.appendChild(makeCard(t)));
  done.forEach(t => listDone.appendChild(makeCard(t)));

  document.getElementById('count-active').textContent = active.length;
  document.getElementById('count-done').textContent = done.length;
  document.getElementById('empty-active').style.display = active.length ? 'none' : 'block';
  document.getElementById('empty-done').style.display = done.length ? 'none' : 'block';
}

function makeCard(task) {
  const card = document.createElement('div');
  const status = getTimeStatus(task);
  card.className = `task-card status-${status === 'ok' ? '' : status}`;
  if (status === 'ok') card.className = 'task-card';

  const ratio = getTimeRatio(task) * 100;
  const fillColor =
    status === 'overdue' ? 'var(--red)' :
    status === 'urgent'  ? 'var(--orange)' :
    status === 'warning' ? 'var(--yellow)' :
    'var(--green)';

  card.innerHTML = `
    <div class="task-header">
      <div class="task-title">${escapeHtml(task.title)}</div>
      <span class="badge badge-${task.type}">${task.type === 'corto' ? 'Corto' : 'Largo'}</span>
    </div>
    <div class="task-meta">
      <span>📅 ${formatDate(task.deadline)}</span>
      ${task.estimated ? `<span>⏱ ${task.estimated}h estimadas</span>` : ''}
      <span>${task.completed ? '✅ Completada' : timeLeft(task)}</span>
    </div>
    ${task.description ? `<div class="task-desc">${escapeHtml(task.description)}</div>` : ''}

    ${!task.completed ? `
      <div class="progress-wrap">
        <div class="progress-row">
          <label>Avance</label>
          <input type="range" min="0" max="100" value="${task.progress || 0}" data-id="${task.id}" class="progress-input">
          <span class="progress-value">${task.progress || 0}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${task.progress || 0}%"></div></div>
        <div class="time-bar"><div class="time-fill" style="width:${ratio}%; background:${fillColor}"></div></div>
      </div>
    ` : `
      <div class="completed-date">Completada el ${formatDate(task.completedAt)}</div>
    `}

    <div class="task-actions">
      ${!task.completed ? `
        <button class="btn-action complete" data-action="complete" data-id="${task.id}">✓ Completar</button>
        <button class="btn-action edit" data-action="edit" data-id="${task.id}">✎ Editar</button>
      ` : `
        <button class="btn-action edit" data-action="reopen" data-id="${task.id}">↺ Reabrir</button>
      `}
      <button class="btn-action calendar" data-action="calendar" data-id="${task.id}">📆 Calendar</button>
      <button class="btn-action delete" data-action="delete" data-id="${task.id}">🗑 Borrar</button>
    </div>
  `;
  return card;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

// ===== Modal =====
const modal = document.getElementById('modal');
const form = document.getElementById('task-form');

function openModal(task = null) {
  editingId = task ? task.id : null;
  document.getElementById('modal-title').textContent = task ? 'Editar tarea' : 'Nueva tarea';
  if (task) {
    document.getElementById('f-title').value = task.title;
    document.getElementById('f-type').value = task.type;
    document.getElementById('f-start').value = task.start;
    document.getElementById('f-deadline').value = task.deadline;
    document.getElementById('f-estimated').value = task.estimated || '';
    document.getElementById('f-desc').value = task.description || '';
  } else {
    form.reset();
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,16);
    document.getElementById('f-start').value = local;
    const tomorrow = new Date(now.getTime() + 86400000 - now.getTimezoneOffset() * 60000)
      .toISOString().slice(0,16);
    document.getElementById('f-deadline').value = tomorrow;
  }
  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
  editingId = null;
}

document.getElementById('btn-add').addEventListener('click', () => openModal());
document.getElementById('btn-cancel').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

form.addEventListener('submit', e => {
  e.preventDefault();
  const data = {
    title: document.getElementById('f-title').value.trim(),
    type: document.getElementById('f-type').value,
    start: document.getElementById('f-start').value,
    deadline: document.getElementById('f-deadline').value,
    estimated: parseFloat(document.getElementById('f-estimated').value) || null,
    description: document.getElementById('f-desc').value.trim()
  };
  if (new Date(data.deadline) <= new Date(data.start)) {
    alert('La fecha límite debe ser posterior al inicio.');
    return;
  }
  if (editingId) {
    const t = tasks.find(t => t.id === editingId);
    Object.assign(t, data);
  } else {
    tasks.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      ...data,
      progress: 0,
      completed: false,
      createdAt: new Date().toISOString()
    });
  }
  saveTasks();
  render();
  closeModal();
});

// ===== Acciones sobre tarjetas =====
document.body.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  switch (btn.dataset.action) {
    case 'complete':
      task.completed = true;
      task.completedAt = new Date().toISOString();
      task.progress = 100;
      break;
    case 'reopen':
      task.completed = false;
      task.completedAt = null;
      break;
    case 'edit':
      openModal(task);
      return;
    case 'delete':
      if (!confirm(`¿Borrar "${task.title}"?`)) return;
      tasks = tasks.filter(t => t.id !== id);
      break;
    case 'calendar':
      exportToCalendar(task);
      return;
  }
  saveTasks();
  render();
});

// Slider de avance
document.body.addEventListener('input', e => {
  if (!e.target.classList.contains('progress-input')) return;
  const id = e.target.dataset.id;
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.progress = parseInt(e.target.value, 10);
  saveTasks();
  // Actualiza visualmente sin re-render completo
  const card = e.target.closest('.task-card');
  card.querySelector('.progress-value').textContent = task.progress + '%';
  card.querySelector('.progress-fill').style.width = task.progress + '%';
});

document.getElementById('filter-type').addEventListener('change', render);

// ===== Export a Google Calendar =====
function exportToCalendar(task) {
  // Genera un archivo .ics que se puede importar en Google Calendar / Outlook / Apple Calendar
  const dtStart = toICSDate(task.start);
  const dtEnd = toICSDate(task.deadline);
  const uid = task.id + '@mis-tareas';
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mis Tareas//ES',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(new Date().toISOString())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICS(task.title)}`,
    `DESCRIPTION:${escapeICS((task.description || '') + (task.estimated ? `\\nEstimado: ${task.estimated}h` : ''))}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${task.title.replace(/[^a-z0-9]/gi, '_')}.ics`;
  a.click();
  URL.revokeObjectURL(url);

  // Alternativa: abrir Google Calendar directamente
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(task.title)}&dates=${dtStart}/${dtEnd}&details=${encodeURIComponent(task.description || '')}`;
  if (confirm('Archivo .ics descargado.\n\n¿Quieres abrir también Google Calendar en el navegador para agregar el evento directamente?')) {
    window.open(gcalUrl, '_blank');
  }
}

function toICSDate(iso) {
  const d = new Date(iso);
  return d.getUTCFullYear()
    + String(d.getUTCMonth() + 1).padStart(2, '0')
    + String(d.getUTCDate()).padStart(2, '0') + 'T'
    + String(d.getUTCHours()).padStart(2, '0')
    + String(d.getUTCMinutes()).padStart(2, '0')
    + String(d.getUTCSeconds()).padStart(2, '0') + 'Z';
}

function escapeICS(s) {
  return s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
}

// ===== Informe Diario =====
const REPORT_KEY = 'mis-informes-v1';

function loadReports() {
  try {
    return JSON.parse(localStorage.getItem(REPORT_KEY)) || {};
  } catch {
    return {};
  }
}

function saveReports() {
  localStorage.setItem(REPORT_KEY, JSON.stringify(reports));
}

let reports = loadReports();

function dateKey(d = new Date()) {
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

const reportDate = document.getElementById('report-date');
const reportText = document.getElementById('report-text');
const reportIndicator = document.getElementById('report-indicator');
const reportStatus = document.getElementById('report-status');

let reportStatusTimer = null;

function updateReportIndicator() {
  const filled = reportText.value.trim().length > 0;
  reportIndicator.classList.toggle('filled', filled);
  reportIndicator.textContent = filled ? '✓' : '!';
  reportIndicator.title = filled
    ? 'Informe escrito para este día'
    : 'Aún no has escrito el informe de este día';
}

function loadReportForDate() {
  const key = reportDate.value || dateKey();
  reportText.value = reports[key] || '';
  reportStatus.classList.remove('show');
  updateReportIndicator();
}

function flashSaved() {
  reportStatus.textContent = 'Guardado ✓';
  reportStatus.classList.add('show');
  clearTimeout(reportStatusTimer);
  reportStatusTimer = setTimeout(() => reportStatus.classList.remove('show'), 1500);
}

function shiftReportDate(delta) {
  const d = new Date(reportDate.value + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  const next = dateKey(d);
  if (next > dateKey()) return; // no permitir días futuros
  reportDate.value = next;
  loadReportForDate();
}

// No permitir seleccionar fechas futuras y arrancar en hoy
reportDate.max = dateKey();
reportDate.value = dateKey();
loadReportForDate();

reportDate.addEventListener('change', () => {
  if (reportDate.value > dateKey()) reportDate.value = dateKey();
  loadReportForDate();
});

reportText.addEventListener('input', () => {
  const key = reportDate.value || dateKey();
  const val = reportText.value;
  if (val.trim()) {
    reports[key] = val;
  } else {
    delete reports[key];
  }
  saveReports();
  updateReportIndicator();
  flashSaved();
});

document.getElementById('report-prev').addEventListener('click', () => shiftReportDate(-1));
document.getElementById('report-next').addEventListener('click', () => shiftReportDate(1));

// ===== Auto-refresh para que cambien los colores con el tiempo =====
setInterval(render, 60000); // cada minuto

// Render inicial
render();

// ===== Análisis emocional del informe (100% local) =====
// Normaliza: minúsculas y quita acentos para comparar contra el léxico.
function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Léxico por categorías con peso (1 = leve, 3 = fuerte). Se escribe natural;
// luego se normaliza (sin acentos) al construir el mapa de búsqueda.
const LEX = {
  pos: { // ánimo positivo
    feliz:2, felices:2, contento:2, contenta:2, contentos:2, alegre:2, alegria:2, alegría:2, genial:2,
    bien:1, bueno:1, buena:1, buenisimo:2, excelente:2, maravilloso:2, increible:2, increíble:2,
    tranquilo:1, tranquila:1, tranquilidad:1, calma:1, calmado:1, relajado:1, relajada:1,
    orgulloso:2, orgullosa:2, orgullo:2, satisfecho:2, satisfecha:2, pleno:1,
    motivado:2, motivada:2, motivacion:2, motivación:2, inspirado:2, ilusion:2, ilusión:2, ilusionado:2,
    logre:2, logré:2, logro:2, logrado:2, consegui:2, conseguí:2, termine:1, terminé:1, avance:1, avancé:1, cumpli:2, cumplí:2,
    agradecido:2, agradecida:2, gracias:1, agradezco:2, amor:2, amado:2, querido:1, cariño:1,
    esperanza:1, optimista:2, positivo:1, positiva:1, disfrute:2, disfruté:2, disfruto:1, diversion:1, diversión:1, divertido:1,
    exito:2, éxito:2, progreso:1, mejor:1, mejore:1, mejoré:1, sonreir:1, sonreír:1, rei:1, reí:1, paz:1, sano:1, salud:1, descansado:1,
  },
  neg: { // ánimo negativo
    triste:2, tristeza:2, mal:1, malo:1, mala:1, fatal:2, terrible:2, horrible:2, peor:2, pesimo:2, pésimo:2,
    deprimido:3, deprimida:3, depresion:3, depresión:3, depre:2, vacio:2, vacío:2, vacia:2, vacía:2,
    solo:1, sola:1, soledad:2, abandonado:2, aislado:2,
    frustrado:2, frustrada:2, frustracion:2, frustración:2, decepcionado:2, decepcion:2, decepción:2,
    enojado:2, enojada:2, enojo:2, molesto:1, molesta:1, enfadado:2, rabia:2, ira:2, furioso:2,
    llorar:2, llore:2, lloré:2, llanto:2, lagrimas:2, lágrimas:2, dolor:2, duele:2, herido:2, sufrir:2, sufro:2, sufrimiento:2,
    culpa:2, culpable:2, arrepentido:1, verguenza:2, vergüenza:2, fracaso:2, fracase:2, fracasé:2, falle:2, fallé:2, perdi:1, perdí:1,
    odio:2, desesperado:3, desesperacion:3, desesperación:3, inutil:3, inútil:3, rendirme:3, rindo:2,
    desanimado:2, desanimo:2, desánimo:2, miedo:2, asustado:2, temor:2, panico:3, pánico:3,
  },
  stress: { // estrés / ansiedad
    ansioso:2, ansiosa:2, ansiedad:2, estresado:2, estresada:2, estres:2, estrés:2, estresante:2,
    nervioso:2, nerviosa:2, nervios:2, preocupado:2, preocupada:2, preocupacion:2, preocupación:2, preocupa:1,
    agobiado:2, agobiada:2, agobio:2, abrumado:2, abrumada:2, saturado:2, colapsado:2, colapso:2,
    presion:2, presión:2, tension:2, tensión:2, tenso:2, tensa:2, angustia:2, angustiado:2, inquieto:1, agitado:2, sobrecargado:2,
  },
  lowEnergy: { // fatiga / poca energía
    cansado:2, cansada:2, cansancio:2, agotado:2, agotada:2, agotamiento:3, exhausto:3, exhausta:3,
    fatigado:2, fatiga:2, somnoliento:1, flojo:1, flojera:1, pereza:1, perezoso:1,
    desgastado:2, apatico:2, apático:2, apatia:2, apatía:2,
  },
  highEnergy: { // energía / productividad
    energia:2, energía:2, energico:2, enérgico:2, activo:1, activa:1, productivo:2, productiva:2, productividad:2,
    descanse:1, descansé:1, fresco:1, ejercicio:1, entrene:1, entrené:1, deporte:1, camine:1, caminé:1, corri:1, corrí:1,
    gym:1, enfocado:1, concentrado:1, concentracion:1, concentración:1,
  },
};

// Frases (cuentan como una sola señal y se eliminan antes de tokenizar
// para no contar dos veces). Normalizadas, sin acentos.
const PHRASES = [
  ['no puedo mas', { cat: 'stress', w: 3 }],
  ['no doy mas', { cat: 'stress', w: 3 }],
  ['sin energia', { cat: 'lowEnergy', w: 2 }],
  ['sin ganas', { cat: 'lowEnergy', w: 2 }],
  ['no dormi bien', { cat: 'lowEnergy', w: 2 }],
  ['no dormi', { cat: 'lowEnergy', w: 1 }],
  ['dormi bien', { cat: 'highEnergy', w: 2 }],
  ['me siento bien', { cat: 'pos', w: 2 }],
  ['me siento mal', { cat: 'neg', w: 2 }],
  ['todo bien', { cat: 'pos', w: 2 }],
  ['todo mal', { cat: 'neg', w: 2 }],
].sort((a, b) => b[0].length - a[0].length); // las más largas primero

const NEGATORS = new Set(['no', 'nunca', 'jamas', 'tampoco', 'ni', 'sin', 'nada']);
const INTENS = { muy: 1.5, mucho: 1.4, mucha: 1.4, demasiado: 1.6, super: 1.5, bastante: 1.3, tan: 1.3, extremadamente: 1.7, totalmente: 1.4, completamente: 1.4, realmente: 1.3, poco: 0.6, algo: 0.7 };

// Mapa token-normalizado -> {cat, w}
const LEXMAP = new Map();
for (const cat of Object.keys(LEX)) {
  for (const [word, w] of Object.entries(LEX[cat])) LEXMAP.set(norm(word), { cat, w });
}

function analyzeReport(text) {
  const raw = (text || '').trim();
  const words = raw ? raw.split(/\s+/).length : 0;
  let nText = ' ' + norm(raw) + ' ';
  const acc = { pos: 0, neg: 0, stress: 0, lowEnergy: 0, highEnergy: 0 };

  // 1) Frases
  for (const [ph, info] of PHRASES) {
    const needle = ' ' + ph + ' ';
    let count = 0, idx;
    while ((idx = nText.indexOf(needle)) !== -1) { count++; nText = nText.slice(0, idx) + ' ' + nText.slice(idx + needle.length - 1); }
    if (count) acc[info.cat] += info.w * count;
  }

  // 2) Tokens
  const toks = nText.split(/[^a-zñ]+/).filter(Boolean);
  for (let i = 0; i < toks.length; i++) {
    const hit = LEXMAP.get(toks[i]);
    if (!hit) continue;
    let negated = false, mult = 1;
    for (let j = Math.max(0, i - 3); j < i; j++) {
      if (NEGATORS.has(toks[j])) negated = true;
      if (j >= i - 2 && INTENS[toks[j]]) mult *= INTENS[toks[j]];
    }
    let { cat, w } = hit;
    w *= mult;
    if (negated) { // "no estoy bien" invierte el sentido
      if (cat === 'pos') cat = 'neg';
      else if (cat === 'neg') cat = 'pos';
      else if (cat === 'stress') { cat = 'pos'; w *= 0.6; }
      else if (cat === 'lowEnergy') cat = 'highEnergy';
      else if (cat === 'highEnergy') cat = 'lowEnergy';
    }
    acc[cat] += w;
  }

  const positive = acc.pos + acc.highEnergy * 0.6;
  const negative = acc.neg + acc.stress * 0.9 + acc.lowEnergy * 0.6;
  const signal = positive + negative;
  const insufficient = words < 3 || signal === 0;

  let score = null;
  if (!insufficient) {
    const conf = Math.min(1, signal / 5);          // señal débil tira hacia neutro
    const r = positive / (positive + negative);
    score = Math.round((r * conf + 0.5 * (1 - conf)) * 100);
  }

  const ratio = (a, b) => {
    const s = a + b;
    if (s === 0) return 0.5;
    const conf = Math.min(1, s / 4);
    return (a / s) * conf + 0.5 * (1 - conf);
  };

  return {
    score, insufficient, words, acc,
    mood: ratio(acc.pos, acc.neg),
    energy: ratio(acc.highEnergy, acc.lowEnergy),
    stress: Math.min(1, acc.stress / 5),
  };
}

function bandFor(s) {
  if (s >= 80) return { label: 'Excelente', emoji: '😄', color: 'var(--green)' };
  if (s >= 65) return { label: 'Bien', emoji: '🙂', color: 'var(--green)' };
  if (s >= 50) return { label: 'Aceptable', emoji: '😌', color: 'var(--yellow)' };
  if (s >= 35) return { label: 'Bajo', emoji: '😟', color: 'var(--orange)' };
  return { label: 'Difícil', emoji: '😢', color: 'var(--red)' };
}

function buildTips(a) {
  const tips = [];
  if (a.stress >= 0.4) tips.push('Detecté señales de estrés. Prueba la respiración 4-4-4 (inhala 4s, sostén 4s, exhala 4s) o sal a caminar 10 minutos.');
  if (a.energy <= 0.4) tips.push('Tu energía se ve baja. Cuida el sueño (7-8h), hidrátate y aléjate de las pantallas un rato antes de dormir.');
  if (a.mood <= 0.4) tips.push('Tu ánimo fue bajo hoy. Anota 3 cosas (aunque sean pequeñas) que salieron bien, y si puedes, habla con alguien de confianza.');
  if (a.mood >= 0.65 && a.stress < 0.35) tips.push('¡Vas muy bien! Apunta qué hiciste hoy que te hizo sentir así para repetirlo en los días difíciles.');
  if (a.energy >= 0.6 && a.stress < 0.35 && a.mood >= 0.5) tips.push('Buen equilibrio de energía y calma: aprovecha para avanzar en una tarea importante.');
  if (a.acc.pos === 0 && a.words >= 15) tips.push('No mencionaste nada positivo. Reta a tu mente: ¿hubo algún momento pequeño agradable hoy?');
  if (!tips.length) tips.push('Sigue escribiendo tu informe cada día: la constancia es lo que más ayuda a notar patrones y mejorar.');
  return tips.slice(0, 4);
}

// Analiza todos los días guardados y los ordena por fecha.
function analyzedHistory() {
  return Object.entries(reports)
    .map(([date, text]) => ({ date, a: analyzeReport(text) }))
    .filter(e => !e.a.insufficient && e.a.score !== null)
    .sort((x, y) => x.date.localeCompare(y.date));
}

const analysisBox = document.getElementById('report-analysis');
const raMain = document.getElementById('ra-main');
const raEmpty = document.getElementById('ra-empty');

function setDim(fillId, valId, value, invert) {
  const pct = Math.round(value * 100);
  const fill = document.getElementById(fillId);
  document.getElementById(valId).textContent = pct + '%';
  fill.style.width = pct + '%';
  // invert=true (estrés): mucho = malo (rojo)
  const good = invert ? 100 - pct : pct;
  fill.style.background = good >= 60 ? 'var(--green)' : good >= 35 ? 'var(--yellow)' : 'var(--orange)';
}

function updateAnalysis() {
  const text = reportText.value;
  const a = analyzeReport(text);

  if (!text.trim()) { analysisBox.classList.add('hidden'); return; }
  analysisBox.classList.remove('hidden');

  if (a.insufficient) {
    raMain.classList.add('hidden');
    raEmpty.classList.remove('hidden');
    return;
  }
  raEmpty.classList.add('hidden');
  raMain.classList.remove('hidden');

  // Puntaje + medidor
  const band = bandFor(a.score);
  document.getElementById('ra-score').textContent = a.score;
  document.getElementById('ra-emoji').textContent = band.emoji;
  const lbl = document.getElementById('ra-label');
  lbl.textContent = band.label;
  lbl.style.color = band.color;
  document.getElementById('ra-gauge').style.background =
    `conic-gradient(${band.color} ${a.score * 3.6}deg, rgba(148, 163, 184, 0.15) 0)`;

  // Tinte rápido del indicador del encabezado
  reportIndicator.style.background = band.color;

  // Dimensiones
  setDim('ra-mood-fill', 'ra-mood-val', a.mood, false);
  setDim('ra-energy-fill', 'ra-energy-val', a.energy, false);
  setDim('ra-stress-fill', 'ra-stress-val', a.stress, true);

  // Comparación con otros días
  const curKey = reportDate.value || dateKey();
  const hist = analyzedHistory();
  const others = hist.filter(e => e.date !== curKey);
  const trend = document.getElementById('ra-trend');
  if (others.length) {
    const avg = Math.round(others.reduce((s, e) => s + e.a.score, 0) / others.length);
    const diff = a.score - avg;
    trend.classList.remove('empty');
    if (diff >= 5) trend.textContent = `⬆️ Hoy estás MEJOR que tu promedio (${avg}/100). ¡Buen día! (+${diff})`;
    else if (diff <= -5) trend.textContent = `⬇️ Hoy estás por debajo de tu promedio habitual (${avg}/100). Es normal tener altibajos. (${diff})`;
    else trend.textContent = `➡️ Hoy estás en tu promedio habitual (${avg}/100), sobre ${others.length} día(s) registrados.`;
  } else {
    trend.classList.add('empty');
    trend.textContent = 'Aún no hay otros días para comparar. Escribe tu informe varios días y aquí verás tu evolución.';
  }

  // Consejos
  const ul = document.getElementById('ra-tips-list');
  ul.innerHTML = '';
  for (const tip of buildTips(a)) {
    const li = document.createElement('li');
    li.textContent = tip;
    ul.appendChild(li);
  }

  // Mini-gráfica de los últimos 7 días registrados
  const bars = document.getElementById('ra-history-bars');
  bars.innerHTML = '';
  const recent = hist.slice(-7);
  if (!recent.length) {
    bars.innerHTML = '<span class="ra-hbar-day">Sin datos todavía</span>';
  } else {
    for (const e of recent) {
      const b = bandFor(e.a.score);
      const day = e.date.slice(8) + '/' + e.date.slice(5, 7); // dd/mm
      const wrap = document.createElement('div');
      wrap.className = 'ra-hbar' + (e.date === curKey ? ' current' : '');
      wrap.title = `${e.date}: ${e.a.score}/100`;
      wrap.innerHTML =
        `<div class="ra-hbar-track"><div class="ra-hbar-fill" style="height:${e.a.score}%; background:${b.color}"></div></div>` +
        `<div class="ra-hbar-day">${day}</div>`;
      bars.appendChild(wrap);
    }
  }
}

// Disparadores (se suman a los listeners existentes, sin reemplazarlos)
let analyzeTimer = null;
reportText.addEventListener('input', () => {
  clearTimeout(analyzeTimer);
  analyzeTimer = setTimeout(updateAnalysis, 450);
});
reportDate.addEventListener('change', updateAnalysis);
document.getElementById('report-prev').addEventListener('click', updateAnalysis);
document.getElementById('report-next').addEventListener('click', updateAnalysis);

updateAnalysis(); // estado inicial
