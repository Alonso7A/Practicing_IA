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
