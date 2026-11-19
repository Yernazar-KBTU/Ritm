'use strict';
/*
 * Ritm — личный планер: пары, учёба, зал и дорога.
 * Данные хранятся на устройстве (localStorage) и, если подключён GitHub,
 * синхронизируются в data.json приватного репозитория через GitHub API.
 * В этом файле нет личных данных: всё личное живёт только в data.json.
 */
(() => {
  // ---------------------------------------------------------------- константы
  const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const DAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const KINDS = { uni: 'Пара', study: 'Учёба', gym: 'Зал', meal: 'Еда', other: 'Другое' };
  const PLACES = { campus: 'Университет', home: 'Дом', gym: 'Зал', online: 'Онлайн', other: 'Другое место' };
  const DEFAULT_PLACE = { uni: 'campus', study: 'home', gym: 'gym', meal: 'home', other: 'other' };
  const LS = { data: 'ritm.data.v1', sync: 'ritm.sync.v1' };
  const HOUR_PX = 52;
  // Шкала оценок (кредитная система РК): % → GPA-балл и буква.
  const SCALE = [[95, 4.0, 'A'], [90, 3.67, 'A-'], [85, 3.33, 'B+'], [80, 3.0, 'B'], [75, 2.67, 'B-'], [70, 2.33, 'C+'], [65, 2.0, 'C'], [60, 1.67, 'C-'], [55, 1.33, 'D+'], [50, 1.0, 'D'], [0, 0, 'F']];

  // ---------------------------------------------------------------- утилиты
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const toMin = (s) => { const [h, m] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const fmt = (m) => { m = Math.round(m); m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  const dur = (m) => { const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} ч ${r} мин` : `${h} ч`) : `${r} мин`; };
  const hrs = (m) => { const h = Math.floor(m / 60), r = m % 60; return r ? `${h}:${String(r).padStart(2, '0')}` : `${h} ч`; };
  const dayIdx = (d) => (d.getDay() + 6) % 7;
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parseIso = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const weekStart = (d) => addDays(startOfDay(d), -dayIdx(d));
  const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
  const readLS = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватный режим */ } };
  const num = (v, def = 0) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : def; };
  const short = (d) => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;

  const ICON = {
    today: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    week: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
    study: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 8l10-5 10 5-10 5z"/><path d="M6 10.5V16c3 2.5 9 2.5 12 0v-5.5"/></svg>',
    gym: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/></svg>',
    settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></svg>',
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    left: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    right: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    sync: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>'
  };

  const TABS = [
    ['today', 'Сегодня'],
    ['week', 'Неделя'],
    ['study', 'Учёба'],
    ['gym', 'Зал'],
    ['settings', 'Настройки']
  ];

  // ---------------------------------------------------------------- данные
  function blank() {
    return {
      version: 1,
      updatedAt: 0,
      profile: { name: '', campus: '' },
      commute: { minutes: 55, peakExtra: 10 },
      gym: { club: '', travel: 0, workouts: {}, log: [] },
      week: [],
      courses: [],
      tasks: []
    };
  }
  function normalize(d) {
    const b = blank();
    d = d && typeof d === 'object' ? d : {};
    const g = d.gym && typeof d.gym === 'object' ? d.gym : {};
    return {
      ...b,
      ...d,
      profile: { ...b.profile, ...(d.profile || {}) },
      commute: { ...b.commute, ...(d.commute || {}) },
      gym: {
        ...b.gym,
        ...g,
        workouts: g.workouts && typeof g.workouts === 'object' ? g.workouts : {},
        log: Array.isArray(g.log) ? g.log : []
      },
      week: Array.isArray(d.week) ? d.week : [],
      courses: Array.isArray(d.courses) ? d.courses : [],
      tasks: Array.isArray(d.tasks) ? d.tasks : []
    };
  }

  let data = normalize(readLS(LS.data));

  function commit(opts = {}) {
    data.updatedAt = Date.now();
    writeLS(LS.data, data);
    schedulePush();
    if (opts.render !== false) render();
  }

  // ---------------------------------------------------------------- расписание и дорога
  const campusName = () => data.profile.campus || 'универ';

  // Час пик: будни, приезд 07:30–10:00 или отъезд 17:00–19:30.
  function isPeak(day, min, arriving) {
    if (day > 4) return false;
    return arriving ? (min >= 450 && min <= 600) : (min >= 1020 && min <= 1170);
  }

  function roadBlock(day, s, e, title, minutes, peak) {
    return { id: `road-${day}-${s}`, kind: 'road', day, s, e2: e, title, sub: `${minutes} мин${peak ? ' · час пик' : ''}`, generated: true };
  }

  // Все блоки дня, включая автоматически посчитанную дорогу.
  function dayPlan(d) {
    const evs = data.week
      .filter((e) => e.day === d)
      .map((e) => ({ ...e, s: toMin(e.start), e2: toMin(e.end) }))
      .sort((a, b) => a.s - b.s);
    const out = evs.slice();
    const c = num(data.commute.minutes), px = num(data.commute.peakExtra);
    const campus = evs.filter((e) => e.place === 'campus');
    if (campus.length && c > 0) {
      const first = Math.min(...campus.map((e) => e.s));
      const last = Math.max(...campus.map((e) => e.e2));
      const p1 = isPeak(d, first, true), m1 = c + (p1 ? px : 0);
      out.push(roadBlock(d, first - 5 - m1, first - 5, `Дорога → ${campusName()}`, m1, p1));
      const p2 = isPeak(d, last, false), m2 = c + (p2 ? px : 0);
      out.push(roadBlock(d, last + 5, last + 5 + m2, 'Дорога → дом', m2, p2));
    }
    const gt = num(data.gym.travel);
    if (gt > 0) {
      evs.filter((e) => e.kind === 'gym').forEach((g) => {
        out.push(roadBlock(d, g.s - gt, g.s, 'Дорога → зал', gt, false));
        out.push(roadBlock(d, g.e2, g.e2 + gt, 'Дорога ← зал', gt, false));
      });
    }
    return out.sort((a, b) => a.s - b.s || a.e2 - b.e2);
  }

  function weekStats() {
    const st = { uni: 0, study: 0, road: 0, trips: 0, gymN: 0, gym: 0, campusDays: 0 };
    for (let d = 0; d < 7; d++) {
      let campus = false;
      dayPlan(d).forEach((e) => {
        const m = e.e2 - e.s;
        if (e.kind === 'uni') st.uni += m;
        else if (e.kind === 'study') st.study += m;
        else if (e.kind === 'road') { st.road += m; st.trips++; }
        else if (e.kind === 'gym') { st.gym += m; st.gymN++; }
        if (e.place === 'campus') campus = true;
      });
      if (campus) st.campusDays++;
    }
    return st;
  }

  // ---------------------------------------------------------------- учёба
  const gradeOf = (s) => SCALE.find((r) => s >= r[0]);
  const hasScore = (c) => c.score !== '' && c.score != null && Number.isFinite(num(c.score, NaN));
  function gpa() {
    let w = 0, sum = 0;
    data.courses.forEach((c) => {
      if (!hasScore(c)) return;
      const cr = num(c.credits, 1) || 1;
      sum += gradeOf(num(c.score))[1] * cr;
      w += cr;
    });
    return w ? sum / w : null;
  }
  function courseSchedule(c) {
    if (!c.code) return '';
    return data.week
      .filter((e) => e.kind === 'uni' && String(e.title || '').toUpperCase().startsWith(String(c.code).toUpperCase()))
      .sort((a, b) => a.day - b.day || toMin(a.start) - toMin(b.start))
      .map((e) => `${DAYS[e.day]} ${e.start}–${e.end}`)
      .join(', ');
  }
  function dueInfo(t) {
    if (!t.due) return { txt: 'без срока', cls: '' };
    const today = startOfDay(new Date());
    const dd = parseIso(t.due);
    const diff = Math.round((dd - today) / 86400000);
    if (t.done) return { txt: short(dd), cls: '' };
    if (diff < 0) return { txt: 'просрочено', cls: 'dark' };
    if (diff === 0) return { txt: 'сегодня', cls: 'dark' };
    if (diff === 1) return { txt: 'завтра', cls: 'dark' };
    if (diff < 7) return { txt: `${DAYS[dayIdx(dd)]}, ${dd.getDate()}`, cls: '' };
    return { txt: short(dd), cls: '' };
  }
  const sortedTasks = () => data.tasks.slice().sort((a, b) =>
    (a.done - b.done) || String(a.due || '9999').localeCompare(String(b.due || '9999')) || String(a.title).localeCompare(String(b.title)));

  // ---------------------------------------------------------------- зал
  const workoutNames = () => {
    const names = new Set(Object.keys(data.gym.workouts));
    data.week.forEach((e) => { if (e.kind === 'gym' && e.workout) names.add(e.workout); });
    return [...names];
  };
  const gymEventFor = (d) => data.week.find((e) => e.day === d && e.kind === 'gym');
  const isGymDay = (d) => data.week.some((e) => e.day === d && e.kind === 'gym');

  // ---------------------------------------------------------------- синхронизация с GitHub
  let sync = { owner: '', repo: '', token: '', path: 'data.json', ...(readLS(LS.sync) || {}) };
  if (location.hostname.endsWith('.github.io')) {
    if (!sync.owner) sync.owner = location.hostname.split('.')[0];
    const seg = location.pathname.split('/').filter(Boolean)[0];
    if (!sync.repo && seg) sync.repo = `${seg}-data`;
  }
  const syncState = { status: 'off', msg: '', sha: null, busy: false, again: false, last: 0 };
  const syncOn = () => !!(sync.owner && sync.repo && sync.token);
  const apiUrl = () => `https://api.github.com/repos/${encodeURIComponent(sync.owner)}/${encodeURIComponent(sync.repo)}/contents/${String(sync.path || 'data.json').split('/').map(encodeURIComponent).join('/')}`;
  const ghHeaders = () => ({ Accept: 'application/vnd.github+json', Authorization: `Bearer ${sync.token}`, 'X-GitHub-Api-Version': '2022-11-28' });

  function b64enc(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64dec(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function ghError(status) {
    if (status === 401) return 'Токен не подходит или истёк';
    if (status === 403) return 'Нет доступа: проверь права токена';
    if (status === 404) return 'Репозиторий не найден или нет доступа';
    return `Ошибка GitHub (${status})`;
  }
  async function ghGet() {
    const r = await fetch(apiUrl(), { headers: ghHeaders(), cache: 'no-store' });
    if (r.status === 404) {
      // 404 бывает и при отсутствии файла, и при отсутствии доступа к репозиторию.
      const repo = await fetch(`https://api.github.com/repos/${encodeURIComponent(sync.owner)}/${encodeURIComponent(sync.repo)}`, { headers: ghHeaders(), cache: 'no-store' });
      if (!repo.ok) throw new Error(ghError(repo.status));
      return null;
    }
    if (!r.ok) throw new Error(ghError(r.status));
    const j = await r.json();
    return { sha: j.sha, data: JSON.parse(b64dec(j.content)) };
  }
  async function ghPut(sha) {
    const body = { message: `Ritm: ${new Date().toLocaleString('ru-RU')}`, content: b64enc(JSON.stringify(data, null, 2)) };
    if (sha) body.sha = sha;
    const r = await fetch(apiUrl(), { method: 'PUT', headers: { ...ghHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.status === 409 || r.status === 422) return { conflict: true };
    if (!r.ok) throw new Error(ghError(r.status));
    const j = await r.json();
    return { sha: j.content.sha };
  }
  function adoptRemote(remote) {
    data = normalize(remote);
    writeLS(LS.data, data);
    render();
  }
  async function pushLoop() {
    for (let i = 0; i < 3; i++) {
      const r = await ghPut(syncState.sha);
      if (!r.conflict) { syncState.sha = r.sha; return; }
      const remote = await ghGet();
      syncState.sha = remote ? remote.sha : null;
      if (remote && (remote.data.updatedAt || 0) > (data.updatedAt || 0)) { adoptRemote(remote.data); return; }
    }
    throw new Error('Не удалось сохранить: конфликт версий');
  }
  async function syncNow(mode = 'pull') {
    if (!syncOn()) { setSync('off'); return; }
    if (!navigator.onLine) { setSync('offline'); return; }
    if (syncState.busy) { syncState.again = true; return; }
    syncState.busy = true;
    setSync('busy');
    try {
      if (mode === 'pull' || !syncState.sha) {
        const remote = await ghGet();
        if (remote) {
          syncState.sha = remote.sha;
          const rt = remote.data.updatedAt || 0, lt = data.updatedAt || 0;
          if (rt > lt) adoptRemote(remote.data);
          else if (lt > rt) await pushLoop();
        } else {
          syncState.sha = null;
          if (data.updatedAt) await pushLoop();
        }
      } else {
        await pushLoop();
      }
      syncState.last = Date.now();
      setSync('ok');
    } catch (e) {
      setSync('err', e && e.message ? e.message : String(e));
    } finally {
      syncState.busy = false;
      if (syncState.again) { syncState.again = false; syncNow('push'); }
    }
  }
  let pushTimer = null;
  function schedulePush() {
    if (!syncOn()) return;
    clearTimeout(pushTimer);
    setSync('pending');
    pushTimer = setTimeout(() => syncNow('push'), 1500);
  }
  function syncLabel() {
    const s = syncState.status;
    if (s === 'off') return ['', 'Только на этом устройстве'];
    if (s === 'busy') return ['', 'Синхронизация…'];
    if (s === 'pending') return ['', 'Есть несохранённые изменения'];
    if (s === 'offline') return ['err', 'Нет сети: сохранено на устройстве'];
    if (s === 'err') return ['err', syncState.msg || 'Ошибка синхронизации'];
    const t = syncState.last ? new Date(syncState.last).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
    return ['ok', `GitHub: синхронизировано${t ? ' в ' + t : ''}`];
  }
  function setSync(status, msg = '') {
    syncState.status = status;
    syncState.msg = msg;
    renderSync();
  }
  function renderSync() {
    const [cls, txt] = syncLabel();
    const html = `<span class="row"><span class="status-dot ${cls}"></span><span>${esc(txt)}</span></span>`;
    const side = $('#sideSync');
    if (side) side.innerHTML = html;
    const st = $('#syncStatus');
    if (st) st.innerHTML = html;
  }

  // ---------------------------------------------------------------- состояние интерфейса
  const validTab = (t) => TABS.some(([id]) => id === t);
  const ui = {
    tab: validTab(location.hash.slice(1)) ? location.hash.slice(1) : 'today',
    day: dayIdx(new Date()),
    workout: null
  };
  function go(tab) {
    if (!validTab(tab)) return;
    ui.tab = tab;
    if (location.hash.slice(1) !== tab) history.replaceState(null, '', `#${tab}`);
    render();
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------- отрисовка: навигация
  function renderNav() {
    $('#sideLinks').innerHTML = TABS.map(([id, label]) =>
      `<button type="button" class="side-link" data-act="tab" data-tab="${id}" ${ui.tab === id ? 'aria-current="page"' : ''}>${ICON[id]}${label}</button>`).join('');
    const mobile = ['today', 'week', 'study', 'gym'];
    $('#bottomNav').innerHTML = mobile.map((id) =>
      `<button type="button" class="nav-btn" data-act="tab" data-tab="${id}" aria-label="${TABS.find((t) => t[0] === id)[1]}" ${ui.tab === id ? 'aria-current="page"' : ''}>${ICON[id]}</button>`).join('') +
      `<button type="button" class="nav-btn nav-add" data-act="add-event" aria-label="Добавить в график">${ICON.plus}</button>`;
  }

  const gearBtn = () => `<button type="button" class="icon-btn mobile-only" data-act="tab" data-tab="settings" aria-label="Настройки">${ICON.settings}</button>`;

  // ---------------------------------------------------------------- экран: Сегодня
  function tlItem(e, live) {
    const now = live && nowMin() >= e.s && nowMin() < e.e2;
    const tag = now ? 'Сейчас' : (e.kind === 'road' ? 'Дорога' : (KINDS[e.kind] || ''));
    const act = e.generated ? 'data-act="road-info"' : `data-act="edit-event" data-id="${esc(e.id)}"`;
    return `<div class="tl-item">
      <div class="tl-time"><span>${fmt(e.s)}</span><span>${fmt(e.e2)}</span></div>
      <button type="button" class="tl-card ${esc(e.kind)}${now ? ' now' : ''}" ${act}>
        <span class="row between"><span class="tag">${esc(tag)}</span><span class="s">${esc(dur(e.e2 - e.s))}</span></span>
        <span class="t">${esc(e.title)}</span>
        ${e.sub ? `<span class="s">${esc(e.sub)}</span>` : ''}
      </button>
    </div>`;
  }

  function departureCard(d) {
    const next = (d + 1) % 7;
    const label = d === dayIdx(new Date()) ? 'Завтра' : DAYS_FULL[next];
    const plan = dayPlan(next);
    const road = plan.find((e) => e.kind === 'road' && e.title.startsWith('Дорога →') && !e.title.includes('зал'));
    const firstUni = plan.find((e) => e.place === 'campus');
    if (!road || !firstUni) {
      return `<div class="card glass"><div class="card-title">${esc(label)}</div><div class="card-note">В ${esc(campusName())} ехать не нужно.</div></div>`;
    }
    return `<div class="card dark">
      <div class="card-title"><span>${esc(label)} · выезд</span><span class="pill light">${esc(road.sub)}</span></div>
      <div class="big">${fmt(road.s)}</div>
      <div class="card-note">${esc(firstUni.title)} в ${fmt(firstUni.s)}${firstUni.sub ? ' · ' + esc(firstUni.sub) : ''}</div>
    </div>`;
  }

  function taskRows(list) {
    if (!list.length) return '<div class="empty">Задач нет</div>';
    return `<div class="list">${list.map((t) => {
      const di = dueInfo(t);
      return `<div class="list-row${t.done ? ' done' : ''}">
        <input type="checkbox" class="check" data-act="toggle-task" data-id="${esc(t.id)}" ${t.done ? 'checked' : ''} aria-label="Выполнено: ${esc(t.title)}">
        <span class="grow"><span class="t">${esc(t.title)}</span><span class="s">${esc(t.course || 'Без предмета')}</span></span>
        <span class="pill ${di.cls}">${esc(di.txt)}</span>
      </div>`;
    }).join('')}</div>`;
  }

  function onboarding() {
    if (data.week.length || data.updatedAt) return '';
    return `<div class="card glass">
      <div class="card-title">Начнём</div>
      <p class="help">График пока пустой. Подключи GitHub в настройках, и данные подтянутся из приватного репозитория. Или добавь первый блок кнопкой «Добавить».</p>
      <div class="row wrap"><button type="button" class="btn" data-act="tab" data-tab="settings">Открыть настройки</button><button type="button" class="btn btn-light" data-act="add-event">Добавить блок</button></div>
    </div>`;
  }

  function screenToday() {
    const today = dayIdx(new Date());
    const d = ui.day;
    const ws = weekStart(new Date());
    const date = addDays(ws, d);
    const plan = dayPlan(d);
    const busy = plan.filter((e) => e.kind !== 'road' && e.kind !== 'meal');
    const planned = busy.reduce((s, e) => s + (e.e2 - e.s), 0);
    const st = weekStats();
    const name = data.profile.name ? `Привет, ${esc(data.profile.name)}!` : 'Сегодня';
    const open = sortedTasks().filter((t) => !t.done).slice(0, 4);

    const chips = DAYS.map((n, i) => {
      const dt = addDays(ws, i);
      return `<button type="button" class="day-chip${i === today ? ' is-today' : ''}" data-act="day" data-day="${i}" aria-pressed="${i === d}"><b>${dt.getDate()}</b><span>${n}</span></button>`;
    }).join('');

    const minis = busy.slice(0, 3).map((e, i) => `<div style="background:${i === 1 ? 'var(--card)' : 'var(--dark-3)'};color:${i === 1 ? 'var(--ink)' : 'var(--on-dark)'};border-radius:20px;padding:14px;display:flex;flex-direction:column;gap:6px;min-width:0">
        <span style="font-size:12px;font-weight:600;opacity:.75">${fmt(e.s)}–${fmt(e.e2)}</span><span style="font-weight:700;font-size:14px;overflow-wrap:anywhere">${esc(e.title)}</span></div>`).join('');

    return `
      <header class="page-head">
        <div><h1>${name}</h1><div class="page-sub">${DAYS_FULL[d]}, ${date.getDate()} ${MONTHS[date.getMonth()]}</div></div>
        <div class="head-actions">
          <button type="button" class="btn" data-act="add-event">${ICON.plus}Добавить</button>
          ${gearBtn()}
        </div>
      </header>
      ${onboarding()}
      <div class="day-chips" role="group" aria-label="День недели">${chips}</div>
      <section class="grid-tiles" aria-label="Итоги">
        <div class="card dark span2">
          <div class="card-title"><span>${d === today ? 'Сегодня' : DAYS_FULL[d]}</span><span class="card-note">${busy.length ? busy.length + ' ' + plural(busy.length, 'блок', 'блока', 'блоков') : 'свободный день'}</span></div>
          <div class="row" style="gap:28px;align-items:flex-end"><div><div class="big">${planned ? hrs(planned).replace(':', ' ч ') : '0 ч'}</div><div class="card-note" style="margin-top:6px">запланировано</div></div></div>
          ${minis ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px">${minis}</div>` : ''}
        </div>
        <div class="card hide-mobile">
          <div class="card-title">Пары</div>
          <div class="big">${hrs(st.uni)}</div>
          <div class="card-note">${data.courses.length} ${plural(data.courses.length, 'предмет', 'предмета', 'предметов')} · ${st.campusDays} ${plural(st.campusDays, 'день', 'дня', 'дней')} в ${esc(campusName())}</div>
        </div>
        <div class="card glass hide-mobile">
          <div class="card-title">Баланс недели</div>
          ${balance(st)}
          <div class="card-note">${st.trips} ${plural(st.trips, 'поездка', 'поездки', 'поездок')} по ${num(data.commute.minutes)} мин${num(data.commute.peakExtra) ? `, +${num(data.commute.peakExtra)} в час пик` : ''}</div>
        </div>
      </section>
      <div class="cols">
        <section class="col-main" aria-label="План дня">
          <h2 class="section-title">План дня</h2>
          ${plan.length ? `<div class="timeline">${plan.map((e) => tlItem(e, d === today)).join('')}</div>` : '<div class="empty">На этот день ничего нет. Нажми «Добавить».</div>'}
        </section>
        <aside class="col-side">
          ${departureCard(d)}
          <div class="row between"><h2 class="section-title">Задачи</h2><button type="button" class="btn btn-sm btn-light" data-act="tab" data-tab="study">Все</button></div>
          ${taskRows(open)}
        </aside>
      </div>`;
  }

  function balance(st) {
    const max = Math.max(st.study, st.road, st.gym, 1);
    const row = (lbl, m, color) => `<div class="bal-row"><span class="lbl">${lbl}</span><span class="bar"><span style="width:${Math.round((m / max) * 100)}%;background:${color}"></span></span><span class="val">${hrs(m)}</span></div>`;
    return `<div style="display:flex;flex-direction:column;gap:10px">${row('Учёба', st.study, 'var(--ink)')}${row('Дорога', st.road, 'var(--muted-2)')}${row('Зал', st.gym, '#9A9AA0')}</div>`;
  }

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  // ---------------------------------------------------------------- экран: Неделя
  function screenWeek() {
    const today = dayIdx(new Date());
    const ws = weekStart(new Date());
    const plans = DAYS.map((_, d) => dayPlan(d));
    const all = plans.flat();
    const startH = Math.min(7, ...all.map((e) => Math.floor(e.s / 60)));
    const endH = Math.max(22, ...all.map((e) => Math.ceil(e.e2 / 60)));
    const height = (endH - startH) * HOUR_PX;
    const y = (m) => ((m - startH * 60) * HOUR_PX) / 60;
    const st = weekStats();
    const we = addDays(ws, 6);

    const heads = DAYS.map((n, d) => `<button type="button" class="wk-head${d === today ? ' today' : ''}" data-act="open-day" data-day="${d}"><span>${n}</span><b>${addDays(ws, d).getDate()}</b></button>`).join('');
    const hours = [];
    for (let h = startH; h <= endH; h++) hours.push(`<span style="top:${(h - startH) * HOUR_PX}px">${String(h).padStart(2, '0')}:00</span>`);
    const cols = plans.map((plan, d) => {
      const evs = plan.map((e) => {
        const top = y(e.s), h = Math.max(18, y(e.e2) - top - 3);
        const act = e.generated ? 'data-act="road-info"' : `data-act="edit-event" data-id="${esc(e.id)}"`;
        return `<button type="button" class="ev ${esc(e.kind)}" style="top:${top}px;height:${h}px" ${act} title="${esc(e.title)} ${fmt(e.s)}–${fmt(e.e2)}">
          <b>${esc(e.title)}</b><small>${fmt(e.s)}–${fmt(e.e2)}${e.sub ? ' · ' + esc(e.sub) : ''}</small></button>`;
      }).join('');
      const nowLine = d === today && nowMin() >= startH * 60 && nowMin() <= endH * 60 ? `<div class="now-line" style="top:${y(nowMin())}px"></div>` : '';
      return `<div class="wk-col${d === today ? ' today' : ''}" style="height:${height}px" data-act="col" data-day="${d}" data-start="${startH}">${evs}${nowLine}</div>`;
    }).join('');

    return `
      <header class="page-head">
        <div><h1>Неделя</h1><div class="page-sub">${ws.getDate()} ${MONTHS[ws.getMonth()]} — ${we.getDate()} ${MONTHS[we.getMonth()]} · шаблон повторяется каждую неделю</div></div>
        <div class="head-actions"><button type="button" class="btn" data-act="add-event">${ICON.plus}Добавить</button>${gearBtn()}</div>
      </header>
      <section class="grid-tiles" aria-label="Итоги недели">
        <div class="card"><div class="card-title">Пары</div><div class="big">${hrs(st.uni)}</div><div class="card-note">${st.campusDays} ${plural(st.campusDays, 'день', 'дня', 'дней')} в ${esc(campusName())}</div></div>
        <div class="card"><div class="card-title">Самоподготовка</div><div class="big">${hrs(st.study)}</div><div class="card-note">${st.uni ? 'на 1 ч пар: ' + (Math.round((st.study / st.uni) * 10) / 10).toString().replace('.', ',') + ' ч' : ''}</div></div>
        <div class="card"><div class="card-title">Дорога</div><div class="big">${hrs(st.road)}</div><div class="card-note">${st.trips} ${plural(st.trips, 'поездка', 'поездки', 'поездок')}, считается автоматически</div></div>
        <div class="card dark"><div class="card-title">Зал</div><div class="big">${st.gymN} × ${hrs(st.gymN ? Math.round(st.gym / st.gymN) : 0)}</div><div class="card-note">${esc(workoutNames().join(' · ') || 'добавь тренировки')}</div></div>
      </section>
      <section class="card" aria-label="Недельный график">
        <div class="row between wrap">
          <h2 class="section-title">График</h2>
          <div class="legend"><span><i class="sw uni"></i>Пары</span><span><i class="sw study"></i>Учёба</span><span><i class="sw gym"></i>Зал</span><span><i class="sw road"></i>Дорога</span><span><i class="sw meal"></i>Еда</span></div>
        </div>
        <p class="help">Нажми на пустое место в колонке, чтобы добавить блок в это время. Нажми на блок, чтобы изменить его.</p>
        <div class="week-scroll"><div class="week">
          <div></div>${heads}
          <div class="wk-hours" style="height:${height}px">${hours.join('')}</div>${cols}
        </div></div>
      </section>`;
  }

  // ---------------------------------------------------------------- экран: Учёба
  function screenStudy() {
    const g = gpa();
    const st = weekStats();
    const open = data.tasks.filter((t) => !t.done).length;
    const pct = g == null ? 0 : Math.round((g / 4) * 100);
    const courseOpts = data.courses.map((c) => `<option value="${esc(c.code || c.name)}">${esc(c.code || c.name)}</option>`).join('');
    const doneCount = data.tasks.filter((t) => t.done).length;

    const courses = data.courses.map((c) => {
      const sc = hasScore(c) ? num(c.score) : null;
      const gr = sc == null ? null : gradeOf(sc);
      const sched = courseSchedule(c);
      return `<button type="button" class="course" data-act="edit-course" data-id="${esc(c.id)}">
        <span class="row between"><span class="pill dark">${esc(c.code || 'Предмет')}</span><span class="card-note">${esc(c.credits ? c.credits + ' кр.' : '')}</span></span>
        <span class="name">${esc(c.name)}</span>
        <span class="meta">${esc(c.teacher || '')}${c.teacher && sched ? '<br>' : ''}${esc(sched)}</span>
        <span class="row"><span class="bar"><span style="width:${sc == null ? 0 : Math.min(100, sc)}%"></span></span><span class="score">${sc == null ? '—' : `${sc}% · ${gr[2]}`}</span></span>
      </button>`;
    }).join('');

    return `
      <header class="page-head">
        <div><h1>Учёба</h1><div class="page-sub">${esc(campusName())} · ${data.courses.length} ${plural(data.courses.length, 'предмет', 'предмета', 'предметов')}</div></div>
        <div class="head-actions"><button type="button" class="btn btn-light" data-act="add-course">${ICON.plus}Предмет</button>${gearBtn()}</div>
      </header>
      <section class="grid-tiles">
        <div class="card dark span2">
          <div class="card-title"><span>Средний балл (GPA)</span><span class="card-note">по текущим % и кредитам</span></div>
          <div class="row" style="gap:20px">
            <div class="gpa-ring" style="background:conic-gradient(var(--card) 0 ${pct}%, var(--dark-3) ${pct}% 100%)"><div><b>${g == null ? '—' : g.toFixed(2).replace('.', ',')}</b><span>из 4,0</span></div></div>
            <p class="card-note" style="margin:0">${g == null ? 'Введи текущий процент по предметам: нажми на карточку предмета.' : 'Считается по шкале: 95+ = A (4,0), 90 = A- (3,67), 85 = B+ (3,33), 80 = B (3,0) и так далее.'}</p>
          </div>
          <div class="mini-tiles">
            <div class="mini grey"><b>${data.courses.length}</b><span>предметов</span></div>
            <div class="mini"><b>${hrs(st.uni)}</b><span>пар в неделю</span></div>
            <div class="mini"><b>${open}</b><span>${plural(open, 'задача', 'задачи', 'задач')}</span></div>
          </div>
        </div>
      </section>
      <div class="cols">
        <section class="col-main">
          <div class="row between"><h2 class="section-title">Предметы</h2></div>
          ${courses ? `<div class="courses">${courses}</div>` : '<div class="empty">Предметов пока нет. Нажми «Предмет».</div>'}
        </section>
        <section class="col-side">
          <div class="row between"><h2 class="section-title">Задачи</h2>${doneCount ? `<button type="button" class="btn btn-sm btn-ghost" data-act="clear-done">Убрать выполненные (${doneCount})</button>` : ''}</div>
          <form class="inline-form" data-form="task">
            <label class="sr-only" for="tTitle">Задача</label>
            <input id="tTitle" class="input" name="title" placeholder="Новая задача" required autocomplete="off">
            <label class="sr-only" for="tCourse">Предмет</label>
            <select id="tCourse" class="select" name="course"><option value="">Без предмета</option>${courseOpts}</select>
            <label class="sr-only" for="tDue">Срок</label>
            <input id="tDue" class="input" type="date" name="due">
            <button type="submit" class="btn">${ICON.plus}Добавить</button>
          </form>
          ${data.tasks.length ? `<div class="list">${sortedTasks().map((t) => {
            const di = dueInfo(t);
            return `<div class="list-row${t.done ? ' done' : ''}">
              <input type="checkbox" class="check" data-act="toggle-task" data-id="${esc(t.id)}" ${t.done ? 'checked' : ''} aria-label="Выполнено: ${esc(t.title)}">
              <span class="grow"><span class="t">${esc(t.title)}</span><span class="s">${esc(t.course || 'Без предмета')}</span></span>
              <span class="pill ${di.cls}">${esc(di.txt)}</span>
              <button type="button" class="icon-btn plain" data-act="del-task" data-id="${esc(t.id)}" aria-label="Удалить задачу">${ICON.trash}</button>
            </div>`;
          }).join('')}</div>` : '<div class="empty">Задач нет. Добавь первую выше.</div>'}
        </section>
      </div>`;
  }

  // ---------------------------------------------------------------- экран: Зал
  function screenGym() {
    const today = dayIdx(new Date());
    const todayIso = iso(new Date());
    const names = workoutNames();
    // Какую тренировку показать: выбранную, сегодняшнюю или ближайшую.
    let ev = gymEventFor(today);
    let when = ev ? 'Сегодня' : '';
    if (!ev) {
      for (let i = 1; i < 7; i++) {
        const d = (today + i) % 7;
        const e = gymEventFor(d);
        if (e) { ev = e; when = i === 1 ? 'Завтра' : DAYS_FULL[d]; break; }
      }
    }
    if (!ui.workout || !names.includes(ui.workout)) ui.workout = (ev && ev.workout) || names[0] || null;
    const w = ui.workout;
    const list = (w && data.gym.workouts[w]) || [];
    const isPlannedWorkout = ev && ev.workout === w;
    const checked = data.gym.log.includes(todayIso);

    const split = DAYS.map((n, d) => {
      const e = gymEventFor(d);
      const cls = e ? (d === today ? 'today' : '') : 'rest';
      return `<div class="split-day ${cls}"><b>${n}</b><span class="w">${esc(e ? (e.workout || 'Зал') : 'Отдых')}</span><span class="tm">${e ? `${esc(e.start)}–${esc(e.end)}` : ''}</span></div>`;
    }).join('');

    const rows = list.map((x, i) => `<div class="ex-row">
        <span class="n">${String(i + 1).padStart(2, '0')}</span>
        <span class="nm">${esc(x.name)}</span>
        <label class="sr-only" for="sets-${esc(x.id)}">Подходы</label>
        <input id="sets-${esc(x.id)}" class="input sm" data-ex="sets" data-id="${esc(x.id)}" value="${esc(x.sets)}" placeholder="4×8">
        <label class="sr-only" for="wt-${esc(x.id)}">Вес</label>
        <input id="wt-${esc(x.id)}" class="input sm" data-ex="weight" data-id="${esc(x.id)}" value="${esc(x.weight)}" placeholder="кг">
        <button type="button" class="icon-btn del" data-act="del-ex" data-id="${esc(x.id)}" aria-label="Удалить упражнение">${ICON.trash}</button>
      </div>`).join('');

    // Календарь месяца
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysIn = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const cells = DAYS.map((n) => `<span class="dh">${n}</span>`);
    for (let i = 0; i < dayIdx(first); i++) cells.push('<span></span>');
    if (!data.gym.since) { data.gym.since = todayIso; writeLS(LS.data, data); }
    const since = startOfDay(parseIso(data.gym.since));
    let done = 0, planned = 0;
    for (let day = 1; day <= daysIn; day++) {
      const dt = new Date(now.getFullYear(), now.getMonth(), day);
      const di = iso(dt);
      const pl = isGymDay(dayIdx(dt));
      const dn = data.gym.log.includes(di);
      const past = dt < startOfDay(now);
      const isT = di === todayIso;
      if (dn && dt <= now) done++;
      const tracked = dt >= since;
      if (pl && tracked && (past || isT)) planned++;
      let cls = '';
      if (dn) cls = 'done'; else if (pl && past && tracked) cls = 'miss'; else if (pl && !past) cls = 'plan';
      cells.push(`<span class="mday ${cls}${isT ? ' today' : ''}" title="${di}">${day}</span>`);
    }
    const pct = planned ? Math.min(100, Math.round((done / planned) * 100)) : 0;

    return `
      <header class="page-head">
        <div><h1>Зал</h1><div class="page-sub">${esc(data.gym.club || 'Клуб не указан')}${num(data.gym.travel) ? ` · дорога ${num(data.gym.travel)} мин` : ''}</div></div>
        <div class="head-actions">
          <button type="button" class="btn${checked ? ' btn-light' : ''}" data-act="checkin">${checked ? ICON.check + 'Отмечено сегодня' : 'Отметить тренировку'}</button>
          ${gearBtn()}
        </div>
      </header>
      <section class="split" aria-label="Сплит недели">${split}</section>
      <div class="cols">
        <section class="col-main card dark" aria-label="Тренировка">
          <div class="row between wrap">
            <div><div class="card-note">${isPlannedWorkout ? esc(`${when} · ${ev.start}–${ev.end}`) : 'Программа'}</div><h2 class="section-title" style="font-size:28px">${esc(w || 'Нет тренировок')}</h2></div>
            <div class="row wrap">${names.map((n) => `<button type="button" class="btn btn-sm ${n === w ? 'btn-light' : ''}" style="${n === w ? '' : 'background:var(--dark-3)'}" data-act="pick-workout" data-name="${esc(n)}">${esc(n)}</button>`).join('')}
              <button type="button" class="icon-btn" style="background:var(--dark-3);border:0;color:#fff" data-act="add-workout" aria-label="Новая программа">${ICON.plus}</button></div>
          </div>
          ${w ? `<div style="display:flex;flex-direction:column;gap:6px">${rows || '<p class="card-note" style="margin:0">Упражнений пока нет.</p>'}</div>
          <form class="row" data-form="ex" style="gap:8px">
            <label class="sr-only" for="exName">Упражнение</label>
            <input id="exName" class="input" name="name" placeholder="Новое упражнение" required autocomplete="off" style="background:var(--dark-3);color:#fff;border-color:transparent">
            <button type="submit" class="btn btn-light">${ICON.plus}</button>
          </form>
          <p class="card-note" style="margin:0">Подходы и вес сохраняются сразу. Поменяй вес, когда прибавишь.</p>` : '<p class="card-note">Добавь в график блок «Зал» с названием тренировки или создай программу кнопкой +.</p>'}
        </section>
        <aside class="col-side">
          <div class="card">
            <div class="card-title"><span>Посещения · ${MONTHS_NOM[now.getMonth()]}</span><span class="pill dark">${pct}%</span></div>
            <div class="row" style="align-items:baseline;gap:8px"><span class="big">${done}</span><span class="card-note">из ${planned} по плану${data.gym.since > iso(first) ? ` с ${short(since)}` : ''}</span></div>
            <div class="month">${cells.join('')}</div>
            <div class="legend" style="font-size:12px"><span><i class="sw uni"></i>был</span><span><i class="sw" style="background:var(--line-2)"></i>пропуск</span><span><i class="sw road"></i>в плане</span></div>
          </div>
        </aside>
      </div>`;
  }

  // ---------------------------------------------------------------- экран: Настройки
  function screenSettings() {
    const field = (label, path, val, attrs = '') => `<label class="field">${label}<input class="input" data-set="${path}" value="${esc(val)}" ${attrs}></label>`;
    return `
      <header class="page-head"><div><h1>Настройки</h1><div class="page-sub">Ritm · данные на этом устройстве${syncOn() ? ' и в GitHub' : ''}</div></div></header>
      <div class="settings">
        <section class="card">
          <div class="card-title">Профиль</div>
          ${field('Имя для приветствия', 'profile.name', data.profile.name, 'autocomplete="given-name"')}
          ${field('Университет (коротко)', 'profile.campus', data.profile.campus, 'placeholder="КБТУ"')}
        </section>
        <section class="card">
          <div class="card-title">Дорога до университета</div>
          ${field('В одну сторону, минут', 'commute.minutes', data.commute.minutes, 'type="number" inputmode="numeric" min="0" max="240"')}
          ${field('Добавка в час пик, минут', 'commute.peakExtra', data.commute.peakExtra, 'type="number" inputmode="numeric" min="0" max="120"')}
          <p class="help">Дорога ставится в график сама: перед первым и после последнего блока с местом «Университет». Час пик: будни, приезд 07:30–10:00 или отъезд 17:00–19:30. Плюс 5 минут запаса.</p>
        </section>
        <section class="card">
          <div class="card-title">Зал</div>
          ${field('Клуб', 'gym.club', data.gym.club, 'placeholder="Invictus …"')}
          ${field('Дорога до зала, минут (0 — не учитывать)', 'gym.travel', data.gym.travel, 'type="number" inputmode="numeric" min="0" max="180"')}
        </section>
        <section class="card">
          <div class="card-title">Синхронизация с GitHub</div>
          <div id="syncStatus" class="side-sync" style="padding:0"></div>
          <label class="field">Владелец (логин GitHub)<input class="input" data-sync="owner" value="${esc(sync.owner)}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
          <label class="field">Приватный репозиторий с данными<input class="input" data-sync="repo" value="${esc(sync.repo)}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
          <label class="field">Токен доступа<input class="input" type="password" data-sync="token" value="${esc(sync.token)}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_…"></label>
          <div class="row wrap">
            <button type="button" class="btn" data-act="sync-now">${ICON.sync}Синхронизировать</button>
            ${sync.token ? '<button type="button" class="btn btn-ghost" data-act="sync-off">Отключить</button>' : ''}
          </div>
          <p class="help">Токен хранится только на этом устройстве и не попадает в данные. Создать: GitHub → Settings → Developer settings → Fine-grained tokens → Generate. Repository access: только <code>${esc(sync.repo || 'Ritm-data')}</code>. Permissions → Contents: <b>Read and write</b>.</p>
        </section>
        <section class="card">
          <div class="card-title">Резервная копия</div>
          <p class="help">Файл со всеми данными: график, предметы, задачи, тренировки.</p>
          <div class="row wrap">
            <button type="button" class="btn btn-light" data-act="export">Скачать файл</button>
            <label class="btn btn-light" style="cursor:pointer">Загрузить файл<input type="file" accept="application/json,.json" data-act-change="import" class="sr-only"></label>
          </div>
          <button type="button" class="btn btn-ghost" data-act="wipe">Стереть данные на этом устройстве</button>
        </section>
      </div>`;
  }

  // ---------------------------------------------------------------- общий рендер
  const SCREENS = { today: screenToday, week: screenWeek, study: screenStudy, gym: screenGym, settings: screenSettings };
  function render() {
    renderNav();
    const view = $('#view');
    view.innerHTML = SCREENS[ui.tab]();
    renderSync();
    document.title = `Ritm · ${TABS.find((t) => t[0] === ui.tab)[1]}`;
  }

  // ---------------------------------------------------------------- модальные окна
  let lastFocus = null;
  function openModal(html) {
    lastFocus = document.activeElement;
    const m = $('#modal');
    m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">${html}</div>`;
    m.hidden = false;
    const f = m.querySelector('input, select, button');
    if (f) f.focus();
  }
  function closeModal() {
    const m = $('#modal');
    m.hidden = true;
    m.innerHTML = '';
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  function openEvent(ev, preset = {}) {
    const e = ev || { id: '', day: preset.day ?? ui.day, start: preset.start || '09:00', end: preset.end || '10:00', kind: 'study', title: '', sub: '', place: 'home', workout: '' };
    const opt = (obj, val) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${v}</option>`).join('');
    const wlist = workoutNames().map((n) => `<option value="${esc(n)}"></option>`).join('');
    openModal(`
      <h2 id="sheetTitle">${ev ? 'Изменить блок' : 'Новый блок'}</h2>
      <form data-form="event" data-id="${esc(e.id)}" class="form-grid">
        <label class="field full">Название<input class="input" name="title" value="${esc(e.title)}" required placeholder="Например: CSCI2208 Лаба" autocomplete="off"></label>
        <label class="field">Тип<select class="select" name="kind">${opt(KINDS, e.kind)}</select></label>
        <label class="field">День<select class="select" name="day">${DAYS_FULL.map((n, i) => `<option value="${i}" ${i === +e.day ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field">Начало<input class="input" type="time" name="start" value="${esc(e.start)}" required step="300"></label>
        <label class="field">Конец<input class="input" type="time" name="end" value="${esc(e.end)}" required step="300"></label>
        <label class="field">Место<select class="select" name="place">${opt(PLACES, e.place || DEFAULT_PLACE[e.kind])}</select></label>
        <label class="field" data-only="gym" ${e.kind === 'gym' ? '' : 'hidden'}>Тренировка<input class="input" name="workout" value="${esc(e.workout || '')}" list="wlist" placeholder="Push, Pull, Legs…" autocomplete="off"><datalist id="wlist">${wlist}</datalist></label>
        <label class="field full">Подпись<input class="input" name="sub" value="${esc(e.sub || '')}" placeholder="Аудитория, преподаватель, заметка" autocomplete="off"></label>
        <p class="help full">Если место «Университет», дорога туда и обратно добавится сама.</p>
        <div class="sheet-actions full">
          ${ev ? `<button type="button" class="btn btn-ghost" data-act="del-event" data-id="${esc(e.id)}">${ICON.trash}Удалить</button>` : ''}
          <span class="spacer"></span>
          <button type="button" class="btn btn-light" data-act="close">Отмена</button>
          <button type="submit" class="btn">Сохранить</button>
        </div>
      </form>`);
  }

  function openCourse(c) {
    const x = c || { id: '', code: '', name: '', teacher: '', credits: 5, score: '' };
    openModal(`
      <h2 id="sheetTitle">${c ? 'Предмет' : 'Новый предмет'}</h2>
      <form data-form="course" data-id="${esc(x.id)}" class="form-grid">
        <label class="field">Код<input class="input" name="code" value="${esc(x.code)}" placeholder="CSCI2208" autocomplete="off" autocapitalize="characters"></label>
        <label class="field">Кредиты<input class="input" name="credits" type="number" min="0" max="30" step="1" value="${esc(x.credits)}" inputmode="numeric"></label>
        <label class="field full">Название<input class="input" name="name" value="${esc(x.name)}" required autocomplete="off"></label>
        <label class="field full">Преподаватель<input class="input" name="teacher" value="${esc(x.teacher)}" autocomplete="off"></label>
        <label class="field full">Текущий процент (0–100)<input class="input" name="score" type="number" min="0" max="100" step="0.1" value="${esc(x.score)}" inputmode="decimal" placeholder="пусто — не учитывать в GPA"></label>
        <p class="help full">Пары этого предмета в графике находятся по коду в начале названия блока.</p>
        <div class="sheet-actions full">
          ${c ? `<button type="button" class="btn btn-ghost" data-act="del-course" data-id="${esc(x.id)}">${ICON.trash}Удалить</button>` : ''}
          <span class="spacer"></span>
          <button type="button" class="btn btn-light" data-act="close">Отмена</button>
          <button type="submit" class="btn">Сохранить</button>
        </div>
      </form>`);
  }

  // ---------------------------------------------------------------- тост
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------------------------------------------------------------- действия
  function setPath(path, value) {
    const keys = path.split('.');
    let o = data;
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = value;
  }
  const findEx = (id) => {
    for (const [name, list] of Object.entries(data.gym.workouts)) {
      const ex = list.find((x) => x.id === id);
      if (ex) return { name, list, ex };
    }
    return null;
  };

  const ACTIONS = {
    tab: (el) => go(el.dataset.tab),
    day: (el) => { ui.day = +el.dataset.day; render(); },
    'open-day': (el) => { ui.day = +el.dataset.day; go('today'); },
    'add-event': () => openEvent(null),
    'edit-event': (el) => { const e = data.week.find((x) => x.id === el.dataset.id); if (e) openEvent(e); },
    'road-info': () => toast('Дорога считается сама. Время меняется в настройках.'),
    col: (el, ev) => {
      const r = el.getBoundingClientRect();
      const startH = +el.dataset.start;
      let m = startH * 60 + ((ev.clientY - r.top) / HOUR_PX) * 60;
      m = Math.max(0, Math.min(1380, Math.floor(m / 30) * 30));
      openEvent(null, { day: +el.dataset.day, start: fmt(m), end: fmt(m + 60) });
    },
    'del-event': (el) => {
      if (!confirm('Удалить этот блок из графика?')) return;
      data.week = data.week.filter((x) => x.id !== el.dataset.id);
      closeModal();
      commit();
      toast('Блок удалён');
    },
    close: () => closeModal(),
    'add-course': () => openCourse(null),
    'edit-course': (el) => { const c = data.courses.find((x) => x.id === el.dataset.id); if (c) openCourse(c); },
    'del-course': (el) => {
      if (!confirm('Удалить предмет?')) return;
      data.courses = data.courses.filter((x) => x.id !== el.dataset.id);
      closeModal();
      commit();
    },
    'del-task': (el) => { data.tasks = data.tasks.filter((x) => x.id !== el.dataset.id); commit(); },
    'clear-done': () => { data.tasks = data.tasks.filter((x) => !x.done); commit(); toast('Выполненные убраны'); },
    checkin: () => {
      const d = iso(new Date());
      const i = data.gym.log.indexOf(d);
      if (i >= 0) data.gym.log.splice(i, 1); else data.gym.log.push(d);
      commit();
      toast(i >= 0 ? 'Отметка снята' : 'Тренировка отмечена');
    },
    'pick-workout': (el) => { ui.workout = el.dataset.name; render(); },
    'add-workout': () => {
      const n = (prompt('Название программы (например, Full body)') || '').trim();
      if (!n) return;
      if (!data.gym.workouts[n]) data.gym.workouts[n] = [];
      ui.workout = n;
      commit();
    },
    'del-ex': (el) => {
      const f = findEx(el.dataset.id);
      if (!f) return;
      data.gym.workouts[f.name] = f.list.filter((x) => x.id !== el.dataset.id);
      commit();
    },
    'sync-now': () => {
      if (!syncOn()) { toast('Заполни логин, репозиторий и токен'); return; }
      syncState.sha = null;
      syncNow('pull');
    },
    'sync-off': () => {
      if (!confirm('Убрать токен с этого устройства? Данные останутся.')) return;
      sync.token = '';
      writeLS(LS.sync, sync);
      setSync('off');
      render();
    },
    export: () => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ritm-${iso(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    },
    wipe: () => {
      if (!confirm('Стереть все данные на этом устройстве? Копия в GitHub (если подключён) останется.')) return;
      data = blank();
      writeLS(LS.data, data);
      syncState.sha = null;
      render();
      toast('Данные на устройстве стёрты');
    }
  };

  document.addEventListener('click', (e) => {
    if (e.target.id === 'modal') { closeModal(); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT') return;
    const fn = ACTIONS[el.dataset.act];
    if (fn) fn(el, e);
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.act === 'toggle-task') {
      const t = data.tasks.find((x) => x.id === el.dataset.id);
      if (t) { t.done = el.checked; commit(); }
      return;
    }
    if (el.dataset.set) {
      const numeric = el.type === 'number';
      setPath(el.dataset.set, numeric ? num(el.value) : el.value.trim());
      commit({ render: false });
      toast('Сохранено');
      return;
    }
    if (el.dataset.sync) {
      sync[el.dataset.sync] = el.value.trim();
      writeLS(LS.sync, sync);
      syncState.sha = null;
      if (syncOn()) syncNow('pull'); else setSync('off');
      return;
    }
    if (el.dataset.ex) {
      const f = findEx(el.dataset.id);
      if (f) { f.ex[el.dataset.ex] = el.value.trim(); commit({ render: false }); }
      return;
    }
    if (el.name === 'kind' && el.form && el.form.dataset.form === 'event') {
      const only = el.form.querySelector('[data-only="gym"]');
      if (only) only.hidden = el.value !== 'gym';
      el.form.place.value = DEFAULT_PLACE[el.value] || 'other';
      return;
    }
    if (el.dataset.actChange === 'import' && el.files && el.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (!confirm('Заменить данные на этом устройстве содержимым файла?')) return;
          data = normalize(parsed);
          commit();
          toast('Данные загружены');
        } catch (err) {
          toast('Не получилось прочитать файл');
        }
      };
      reader.readAsText(el.files[0]);
    }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target;
    const kind = form.dataset.form;
    if (!kind) return;
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form).entries());

    if (kind === 'event') {
      const s = toMin(f.start), en = toMin(f.end);
      if (en <= s) { toast('Конец должен быть позже начала'); return; }
      const item = {
        id: form.dataset.id || uid(),
        day: +f.day,
        start: fmt(s),
        end: fmt(en),
        kind: f.kind,
        title: String(f.title).trim(),
        sub: String(f.sub || '').trim(),
        place: f.place
      };
      if (f.kind === 'gym') {
        item.workout = String(f.workout || '').trim();
        if (item.workout && !data.gym.workouts[item.workout]) data.gym.workouts[item.workout] = [];
      }
      const i = data.week.findIndex((x) => x.id === item.id);
      if (i >= 0) data.week[i] = item; else data.week.push(item);
      closeModal();
      commit();
      toast('Сохранено');
    }

    if (kind === 'course') {
      const item = {
        id: form.dataset.id || uid(),
        code: String(f.code || '').trim().toUpperCase(),
        name: String(f.name).trim(),
        teacher: String(f.teacher || '').trim(),
        credits: num(f.credits, 0),
        score: f.score === '' ? '' : Math.max(0, Math.min(100, num(f.score)))
      };
      const i = data.courses.findIndex((x) => x.id === item.id);
      if (i >= 0) data.courses[i] = item; else data.courses.push(item);
      closeModal();
      commit();
    }

    if (kind === 'task') {
      const title = String(f.title || '').trim();
      if (!title) return;
      data.tasks.push({ id: uid(), title, course: f.course || '', due: f.due || '', done: false });
      commit();
      const inp = $('#tTitle');
      if (inp) inp.focus();
    }

    if (kind === 'ex') {
      const name = String(f.name || '').trim();
      if (!name || !ui.workout) return;
      if (!data.gym.workouts[ui.workout]) data.gym.workouts[ui.workout] = [];
      data.gym.workouts[ui.workout].push({ id: uid(), name, sets: '3×10', weight: '' });
      commit();
      const inp = $('#exName');
      if (inp) inp.focus();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
  });

  window.addEventListener('hashchange', () => {
    const t = location.hash.slice(1);
    if (validTab(t) && t !== ui.tab) { ui.tab = t; render(); }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (ui.day !== dayIdx(new Date()) && ui.tab === 'today') ui.day = dayIdx(new Date());
      safeRerender();
      syncNow('pull');
    }
  });
  window.addEventListener('online', () => syncNow('pull'));
  window.addEventListener('offline', () => { if (syncOn()) setSync('offline'); });

  // Раз в минуту обновляем «сейчас», если пользователь ничего не вводит.
  function safeRerender() {
    const a = document.activeElement;
    const typing = a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA');
    if ($('#modal').hidden && !typing) render();
  }
  setInterval(() => { if (ui.tab === 'today' || ui.tab === 'week') safeRerender(); }, 60000);

  // ---------------------------------------------------------------- запуск
  render();
  setSync(syncOn() ? 'pending' : 'off');
  syncNow('pull');

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
