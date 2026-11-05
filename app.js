(() => {
'use strict';

const $ = s => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';

const SETS = {
  spain: {
    title: 'España', unit: 'provincia', data: GEO.spain,
    qLocate: n => `Sitúa en el mapa la provincia de <em>${n}</em>`,
    qCapital: n => `¿Cuál es la capital de la provincia de <em>${n}</em>?`,
    qLocateCap: c => `¿De qué provincia es capital <em>${c}</em>? Haz clic en el mapa`,
    qName: 'Escribe el nombre de la provincia señalada',
  },
  europe: {
    title: 'Europa', unit: 'país', data: GEO.europe,
    qLocate: n => `Sitúa en el mapa: <em>${n}</em>`,
    qCapital: n => `¿Cuál es la capital de <em>${n}</em>?`,
    qLocateCap: c => `¿De qué país es capital <em>${c}</em>? Haz clic en el mapa`,
    qName: 'Escribe el nombre del país señalado',
  },
};
const TYPE_LABEL = { locate: 'Situar', name: 'Nombre', capital: 'Capital', locateCap: 'Por capital', mix: 'Mezclado' };

// ---------- almacenamiento ----------
const KEY = 'geo-examen-v1';
const store = (() => {
  let d = { fails: { spain: [], europe: [] }, best: {} };
  try { d = Object.assign(d, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* sin almacenamiento */ }
  return {
    d,
    save() { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignorar */ } },
  };
})();

// ---------- utilidades ----------
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const norm = (s, strict) => {
  s = String(s).trim().toLowerCase().replace(/[.,;:'"()¿?¡!_]/g, ' ').replace(/[-–/]/g, ' ').replace(/\s+/g, ' ').trim();
  return strict ? s.normalize('NFC') : s.normalize('NFD').replace(/[̀-ͯ]/g, '');
};
const fmtTime = ms => { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const fmtGrade = g => (Math.round(g * 10) / 10).toString().replace('.', ',');
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};
const show = id => { for (const s of ['screenHome', 'screenGame', 'screenResult']) $('#' + s).classList.toggle('hidden', s !== id); window.scrollTo(0, 0); };

// ---------- MAPA (SVG con zoom y arrastre) ----------
const svg = $('#map');
const map = { vb: null, base: null, items: new Map(), overlay: null, dotR: 7, moved: false, setKey: null };

function buildMap(setKey) {
  const g = SETS[setKey].data;
  map.setKey = setKey;
  map.base = g.viewBox.slice();
  map.vb = g.viewBox.slice();
  map.dotR = g.viewBox[2] / 150;
  map.items.clear();
  svg.innerHTML = '';
  const zones = [...new Set(g.items.map(i => i.zone))].sort((a, b) => a.localeCompare(b, 'es'));
  el('path', { class: 'bg', d: g.bg }, svg);
  if (g.inset) {
    const [x, y, w, h] = g.inset;
    el('rect', { class: 'frame', x, y, width: w, height: h, rx: 6 }, svg);
    const t = el('text', { x: x + 6, y: y + 14, 'font-size': 12, fill: '#5d6b82', 'pointer-events': 'none' }, svg);
    t.textContent = 'Canarias';
  }
  const layer = el('g', {}, svg);
  const ordered = g.items.slice().sort((a, b) => (a.dot ? 1 : 0) - (b.dot ? 1 : 0));
  for (const it of ordered) {
    const grp = el('g', { class: 'region', 'data-id': it.id, 'data-z': zones.indexOf(it.zone) }, layer);
    el('path', { d: it.path }, grp);
    if (it.dot) el('circle', { class: 'dot', cx: it.dot[0], cy: it.dot[1], r: map.dotR }, grp);
    map.items.set(it.id, grp);
  }
  map.overlay = el('g', { class: 'overlay' }, svg);
  applyVB();
}
function applyVB() { svg.setAttribute('viewBox', map.vb.map(v => Math.round(v * 100) / 100).join(' ')); }
function resetView() { map.vb = map.base.slice(); applyVB(); }
function clampVB() {
  const b = map.base, v = map.vb;
  v[2] = Math.min(v[2], b[2]); v[3] = Math.min(v[3], b[3]);
  const mx = b[2] * 0.08, my = b[3] * 0.08;
  v[0] = Math.max(b[0] - mx, Math.min(b[0] + b[2] + mx - v[2], v[0]));
  v[1] = Math.max(b[1] - my, Math.min(b[1] + b[3] + my - v[3], v[1]));
}
function zoomAt(factor, cx, cy) { // cx, cy: fracción 0..1 dentro del mapa visible
  const v = map.vb, b = map.base;
  const nw = Math.max(b[2] / 14, Math.min(b[2], v[2] / factor));
  const k = nw / v[2];
  const nh = v[3] * k;
  v[0] += (v[2] - nw) * cx; v[1] += (v[3] - nh) * cy; v[2] = nw; v[3] = nh;
  clampVB(); applyVB();
}
// rueda
svg.addEventListener('wheel', e => {
  e.preventDefault();
  const r = svg.getBoundingClientRect();
  zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
}, { passive: false });
// arrastre y pellizco
const ptrs = new Map();
let pinch0 = 0, downPos = null;
svg.addEventListener('pointerdown', e => {
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) { map.moved = false; downPos = { x: e.clientX, y: e.clientY }; }
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); map.moved = true; }
});
window.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const r = svg.getBoundingClientRect();
  if (ptrs.size === 1) {
    if (!map.moved && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) { map.moved = true; svg.classList.add('dragging'); }
    if (map.moved) {
      map.vb[0] -= (e.clientX - p.x) * map.vb[2] / r.width;
      map.vb[1] -= (e.clientY - p.y) * map.vb[3] / r.height;
      clampVB(); applyVB();
    }
  } else if (ptrs.size === 2) {
    const other = [...ptrs.entries()].find(([id]) => id !== e.pointerId)[1];
    const d0 = Math.hypot(p.x - other.x, p.y - other.y);
    const d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y);
    if (d0 > 0 && d1 > 0) zoomAt(d1 / d0, ((e.clientX + other.x) / 2 - r.left) / r.width, ((e.clientY + other.y) / 2 - r.top) / r.height);
  }
  p.x = e.clientX; p.y = e.clientY;
});
const endPtr = e => { ptrs.delete(e.pointerId); if (!ptrs.size) svg.classList.remove('dragging'); };
window.addEventListener('pointerup', endPtr);
window.addEventListener('pointercancel', endPtr);
$('#zIn').onclick = () => zoomAt(1.5, .5, .5);
$('#zOut').onclick = () => zoomAt(1 / 1.5, .5, .5);
$('#zReset').onclick = resetView;

// clic en regiones
let onRegion = null, onHover = null;
svg.addEventListener('click', e => {
  if (map.moved) { map.moved = false; return; }
  const g = e.target.closest('.region');
  if (g && onRegion) onRegion(g.dataset.id);
});
svg.addEventListener('mouseover', e => { const g = e.target.closest('.region'); if (g && onHover) onHover(g.dataset.id); });

// ayudas visuales
function clearMarks() {
  for (const g of map.items.values()) g.classList.remove('target', 'correct', 'wrong', 'hint');
  map.overlay.innerHTML = '';
}
function mark(id, cls) { map.items.get(id)?.classList.add(cls); }
function ringAround(id) {
  const it = SETS[map.setKey].data.items.find(i => i.id === id);
  const bb = map.items.get(id).querySelector('path').getBBox();
  const size = Math.max(bb.width, bb.height);
  if (size > map.base[2] / 14 && !it.dot) return;
  const cx = it.dot ? it.dot[0] : bb.x + bb.width / 2, cy = it.dot ? it.dot[1] : bb.y + bb.height / 2;
  el('circle', { class: 'ring', cx, cy, r: Math.max(size / 2, map.dotR) + map.dotR * 1.6 }, map.overlay);
}
function capDot(id, label) {
  const it = SETS[map.setKey].data.items.find(i => i.id === id);
  el('circle', { class: 'capdot', cx: it.cap[0], cy: it.cap[1], r: map.dotR * .75 }, map.overlay);
  if (label) {
    const t = el('text', { class: 'caplabel', x: it.cap[0] + map.dotR, y: it.cap[1] - map.dotR * .6, 'font-size': map.dotR * 1.9 }, map.overlay);
    t.textContent = it.capital;
  }
}

// ---------- CONFIGURACIÓN ----------
const cfg = { set: 'spain', type: 'locate', zone: '', count: '20', accents: false };
const radio = name => document.querySelector(`input[name=${name}]:checked`).value;

function fillZones() {
  const items = SETS[radio('set')].data.items;
  const zones = [...new Set(items.map(i => i.zone))].sort((a, b) => a.localeCompare(b, 'es'));
  const sel = $('#optZone');
  sel.innerHTML = '<option value="">Todo el mapa</option>' +
    zones.map(z => `<option value="${z}">${z} (${items.filter(i => i.zone === z).length})</option>`).join('');
}
function refreshHome() {
  const set = radio('set');
  const n = store.d.fails[set].length;
  $('#failsBox').classList.toggle('hidden', !n);
  $('#failsText').textContent = `Tienes ${n} ${n === 1 ? 'pregunta fallada' : 'preguntas falladas'} en ${SETS[set].title}.`;
  const best = Object.entries(store.d.best);
  $('#bestList').innerHTML = best.length
    ? best.map(([k, v]) => `<div><span>${k}</span><b>${fmtGrade(v.grade)} / 10</b></div>`).join('')
    : '<div class="empty">Todavía no has hecho ningún examen. ¡Anímate!</div>';
}
document.querySelectorAll('input[name=set]').forEach(r => r.addEventListener('change', () => { fillZones(); refreshHome(); }));

function readCfg() {
  cfg.set = radio('set'); cfg.type = radio('type');
  cfg.zone = $('#optZone').value; cfg.count = $('#optCount').value; cfg.accents = $('#optAccents').checked;
}

// ---------- SESIÓN ----------
let S = null; // sesión actual

function makeQuestions(pool, type, count) {
  let items = shuffle(pool);
  if (count !== 'all') items = items.slice(0, +count);
  const types = ['locate', 'name', 'capital', 'locateCap'];
  return items.map(item => ({ item, type: type === 'mix' ? types[Math.floor(Math.random() * types.length)] : type }));
}

function startSession(mode, opts = {}) {
  readCfg();
  const set = SETS[cfg.set];
  let pool = set.data.items;
  if (opts.fails) pool = pool.filter(i => store.d.fails[cfg.set].includes(i.id));
  else if (cfg.zone) pool = pool.filter(i => i.zone === cfg.zone);
  if (!pool.length) { alert('No hay elementos para practicar con esas opciones.'); return; }
  S = {
    mode, setKey: cfg.set, type: opts.fails && cfg.type === 'locate' ? 'mix' : cfg.type, zone: opts.fails ? 'Mis fallos' : cfg.zone,
    questions: makeQuestions(pool, opts.fails && cfg.type === 'locate' ? 'mix' : cfg.type, opts.fails ? 'all' : cfg.count),
    idx: 0, answers: [], t0: Date.now(), locked: false, hinted: false, timer: null,
  };
  buildMap(S.setKey);
  svg.classList.remove('colored');
  $('#studyPanel').classList.add('hidden');
  $('.qbar').classList.remove('hidden');
  $('#hud').classList.remove('hidden');
  show('screenGame');
  if (mode === 'exam') {
    S.timer = setInterval(() => { $('#hudTime').textContent = '⏱ ' + fmtTime(Date.now() - S.t0); }, 500);
  }
  nextQuestion();
}

function stopTimer() { if (S && S.timer) { clearInterval(S.timer); S.timer = null; } }

function updateHud() {
  $('#hudProgress').textContent = `Pregunta ${Math.min(S.idx + 1, S.questions.length)} / ${S.questions.length}`;
  if (S.mode === 'practice') {
    const ok = S.answers.filter(a => a.ok).length;
    $('#hudScore').textContent = `✔ ${ok}`;
    $('#hudTime').textContent = '';
  } else {
    $('#hudScore').textContent = '';
    $('#hudTime').textContent = '⏱ ' + fmtTime(Date.now() - S.t0);
  }
}

function questionText(q) {
  const st = SETS[S.setKey], it = q.item;
  switch (q.type) {
    case 'locate': return st.qLocate(it.name);
    case 'capital': return st.qCapital(it.name);
    case 'locateCap': return st.qLocateCap(it.capital);
    case 'name': return st.qName;
  }
}
const isClick = q => q.type === 'locate' || q.type === 'locateCap';
const expectedText = q => q.type === 'capital' ? q.item.capital : q.item.name;

function nextQuestion() {
  if (S.idx >= S.questions.length) return finish();
  const q = S.questions[S.idx];
  S.locked = false; S.hinted = false;
  updateHud();
  clearMarks(); resetView();
  $('#qFeedback').textContent = ''; $('#qFeedback').className = 'qfeedback';
  $('#qText').innerHTML = questionText(q);
  svg.classList.toggle('noclick', !isClick(q));
  const ans = $('#qAnswer'); ans.innerHTML = '';

  if (!isClick(q)) {
    mark(q.item.id, 'target'); ringAround(q.item.id);
    if (q.type === 'capital') capDot(q.item.id);
    const inp = document.createElement('input');
    inp.type = 'text'; inp.autocomplete = 'off'; inp.autocapitalize = 'off'; inp.spellcheck = false;
    inp.placeholder = q.type === 'capital' ? 'Escribe la capital…' : 'Escribe el nombre…';
    inp.id = 'ansInput';
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitText(); } });
    ans.appendChild(inp);
    addBtn(ans, 'Comprobar', 'btn primary small', submitText);
    setTimeout(() => inp.focus(), 30);
  } else {
    const h = document.createElement('span'); h.className = 'hint'; h.textContent = 'Haz clic en el mapa (puedes acercarlo con ＋ o la rueda del ratón).';
    ans.appendChild(h);
  }
  if (S.mode === 'practice') addBtn(ans, '💡 Pista', 'btn small', giveHint);
  addBtn(ans, 'No lo sé', 'btn small ghost', () => answer(null, ''));
}
function addBtn(parent, text, cls, fn) {
  const b = document.createElement('button'); b.className = cls; b.textContent = text; b.onclick = fn; parent.appendChild(b); return b;
}

function giveHint() {
  if (S.locked) return;
  const q = S.questions[S.idx], it = q.item;
  S.hinted = true;
  const fb = $('#qFeedback'); fb.className = 'qfeedback';
  if (isClick(q)) {
    SETS[S.setKey].data.items.filter(i => i.zone === it.zone).forEach(i => mark(i.id, 'hint'));
    fb.textContent = `💡 Está en: ${it.zone}`;
  } else {
    const word = expectedText(q);
    const pat = word.split('').map((c, i) => (i === 0 || !/[\p{L}\p{N}]/u.test(c)) ? c : '·').join(' ');
    fb.textContent = `💡 ${pat}  (${word.replace(/[^\p{L}\p{N}]/gu, '').length} letras)`;
  }
}

onRegion = id => {
  if (study.on) { studySelect(id); return; }
  if (S && !S.locked && S.idx < S.questions.length) {
    const q = S.questions[S.idx];
    if (isClick(q)) answer(id === q.item.id, id);
  }
};

function submitText() {
  if (S.locked) return;
  const q = S.questions[S.idx];
  const val = $('#ansInput').value;
  if (!val.trim()) { $('#ansInput').focus(); return; }
  const strict = cfg.accents;
  const cands = q.type === 'capital' ? [q.item.capital, ...q.item.capAliases] : [q.item.name, ...q.item.aliases];
  const ok = cands.some(c => norm(c, strict) === norm(val, strict));
  // si falla solo por las tildes, avisar
  const accentOnly = !ok && strict && cands.some(c => norm(c, false) === norm(val, false));
  answer(ok, val.trim(), accentOnly);
}

function answer(ok, given, accentOnly) {
  if (S.locked) return;
  S.locked = true;
  const q = S.questions[S.idx];
  let givenText = given;
  if (isClick(q) && given) givenText = SETS[S.setKey].data.items.find(i => i.id === given).name;
  if (ok === null) ok = false;
  S.answers.push({ q, ok: !!ok, given: givenText || '', hinted: S.hinted, accentOnly: !!accentOnly });

  if (S.mode === 'exam') {
    S.idx++;
    setTimeout(nextQuestion, 120);
    return;
  }
  // práctica: corrección inmediata
  const fb = $('#qFeedback');
  mark(q.item.id, ok ? 'correct' : 'target');
  if (!ok && isClick(q) && given) mark(given, 'wrong');
  if (isClick(q) || q.type === 'capital') { if (q.type !== 'capital') ringAround(q.item.id); }
  if (q.type === 'locateCap') capDot(q.item.id);
  if (ok) {
    fb.className = 'qfeedback ok'; fb.textContent = '✅ ¡Correcto!' + (q.type === 'locateCap' ? ` ${q.item.name}` : '');
  } else {
    fb.className = 'qfeedback ko';
    fb.textContent = accentOnly
      ? `❌ Casi: falta alguna tilde. Se escribe «${expectedText(q)}».`
      : isClick(q) ? `❌ Era ${q.item.name}${given ? ` (has marcado ${givenText})` : ''}.` : `❌ La respuesta correcta es «${expectedText(q)}».`;
  }
  if (!isClick(q)) { const i = $('#ansInput'); if (i) i.disabled = true; }
  const ans = $('#qAnswer');
  ans.querySelectorAll('button').forEach(b => { if (b.textContent !== 'Siguiente ▶') b.disabled = true; });
  const nb = addBtn(ans, 'Siguiente ▶', 'btn primary small', () => { S.idx++; nextQuestion(); });
  nb.focus();
  updateHud();
}

function finish() {
  stopTimer();
  svg.classList.remove('noclick');
  const total = S.answers.length;
  const okN = S.answers.filter(a => a.ok).length;
  const grade = total ? okN / total * 10 : 0;
  const exam = S.mode === 'exam';

  // fallos guardados
  const f = new Set(store.d.fails[S.setKey]);
  for (const a of S.answers) {
    if (!a.ok) f.add(a.q.item.id);
    else if (!a.hinted) f.delete(a.q.item.id);
  }
  store.d.fails[S.setKey] = [...f];
  if (exam) {
    const key = `${SETS[S.setKey].title} · ${TYPE_LABEL[S.type]}${S.zone ? ' · ' + S.zone : ''}`;
    if (!store.d.best[key] || store.d.best[key].grade < grade) store.d.best[key] = { grade, date: Date.now() };
  }
  store.save();

  $('#hud').classList.add('hidden');
  $('#resultGrade').innerHTML = `${fmtGrade(grade)}<small>${okN} aciertos de ${total}${exam ? ' · ' + fmtTime(Date.now() - S.t0) : ''}</small>`;
  const msg = grade >= 9 ? '¡Sobresaliente! Estás más que preparada 🌟'
    : grade >= 7 ? '¡Muy bien! Repasa los fallos y lo bordas 💪'
    : grade >= 5 ? 'Aprobado. Un poco más de práctica y mejoras seguro 📚'
    : 'No pasa nada: practica en modo «Practicar» y vuelve a intentarlo 🌱';
  $('#resultMsg').textContent = msg;
  $('#resultList').innerHTML = S.answers.map(a => {
    const q = a.q, exp = isClick(q) ? q.item.name : expectedText(q);
    const plain = (q.type === 'name' ? `${SETS[S.setKey].unit === 'país' ? 'País' : 'Provincia'} señalad${SETS[S.setKey].unit === 'país' ? 'o' : 'a'}: ¿cómo se llama?` : questionText(q)).replace(/<[^>]+>/g, '').replace(' Haz clic en el mapa', '');
    return `<div class="ritem ${a.ok ? 'ok' : 'ko'}"><span class="mark">${a.ok ? '✔' : '✘'}</span><div>
      <div class="q">${plain}</div>
      <div class="a">Tu respuesta: <b>${a.given ? escapeHtml(a.given) : '(en blanco)'}</b>${a.ok ? '' : ` · Correcta: <b>${escapeHtml(exp)}</b>`}${a.accentOnly ? ' · (te faltaron tildes)' : ''}</div></div></div>`;
  }).join('');
  $('#btnReviewFails').classList.toggle('hidden', !store.d.fails[S.setKey].length);
  show('screenResult');
}
const escapeHtml = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- ESTUDIO ----------
const study = { on: false };
function startStudy() {
  readCfg();
  S = null;
  study.on = true;
  buildMap(cfg.set);
  $('.qbar').classList.add('hidden');
  $('#studyPanel').classList.remove('hidden');
  $('#hud').classList.add('hidden');
  svg.classList.remove('noclick');
  svg.classList.toggle('colored', $('#stColors').checked);
  $('#studyInfo').textContent = 'Pasa el ratón (o toca) una zona para ver su nombre y su capital.';
  if (cfg.zone) { // atenuar lo que no es de la zona elegida no hace falta: se resalta
    SETS[cfg.set].data.items.filter(i => i.zone === cfg.zone).forEach(i => mark(i.id, 'hint'));
  }
  show('screenGame');
  drawStudyCaps();
}
function drawStudyCaps() {
  map.overlay.innerHTML = '';
  if ($('#stCaps').checked) for (const it of SETS[map.setKey].data.items) capDot(it.id);
  if (study.sel) studySelect(study.sel, true);
}
function studySelect(id, keep) {
  if (!study.on) return;
  const it = SETS[map.setKey].data.items.find(i => i.id === id);
  study.sel = id;
  $('#studyInfo').innerHTML = `<b>${it.name}</b> — capital: <b>${it.capital}</b> <span style="color:var(--muted)">· ${it.zone}</span>`;
  map.overlay.querySelectorAll('.caplabel, .ring, .selcap').forEach(n => n.remove());
  const d = el('circle', { class: 'capdot selcap', cx: it.cap[0], cy: it.cap[1], r: map.dotR * .85 }, map.overlay);
  const t = el('text', { class: 'caplabel', x: it.cap[0] + map.dotR, y: it.cap[1] - map.dotR * .6, 'font-size': map.dotR * 2 }, map.overlay);
  t.textContent = it.capital;
}
onHover = id => { if (study.on) studySelect(id); };
$('#stCaps').addEventListener('change', drawStudyCaps);
$('#stColors').addEventListener('change', () => svg.classList.toggle('colored', $('#stColors').checked));

// ---------- navegación ----------
function goHome(confirmExit) {
  if (confirmExit && S && !document.querySelector('#screenGame').classList.contains('hidden') && S.answers.length < S.questions.length) {
    if (!confirm('¿Salir? Perderás el progreso de este ejercicio.')) return;
  }
  stopTimer(); S = null; study.on = false; study.sel = null;
  $('#hud').classList.add('hidden');
  refreshHome(); show('screenHome');
}
$('#btnPractice').onclick = () => { study.on = false; startSession('practice'); };
$('#btnExam').onclick = () => { study.on = false; startSession('exam'); };
$('#btnStudy').onclick = startStudy;
$('#btnFails').onclick = () => { study.on = false; startSession('practice', { fails: true }); };
$('#btnReviewFails').onclick = () => { study.on = false; const prev = S; cfg.set = prev.setKey; document.querySelector(`input[name=set][value=${prev.setKey}]`).checked = true; startSession('practice', { fails: true }); };
$('#btnAgain').onclick = () => { study.on = false; const m = S.mode; startSession(m); };
$('#btnHome').onclick = () => goHome(false);
$('#btnExit').onclick = () => goHome(true);
$('#homeLink').onclick = () => goHome(true);
$('#homeLink').addEventListener('keydown', e => { if (e.key === 'Enter') goHome(true); });

fillZones();
refreshHome();
})();
