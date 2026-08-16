// ============================================================
// Faltones Curaçao — lógica de la aplicación
// ============================================================

const state = {
  token: localStorage.getItem('fc_token') || null,
  user: null,
  tab: 'predicciones',
  loginMode: 'login' // 'login' | 'register'
};

const app = document.getElementById('app');

// ---------- API helper ----------
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  const res = await fetch('/api/' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* respuesta sin JSON (ej. CSV) */ }
  if (!res.ok) {
    throw new Error(data.error || 'Ha ocurrido un error');
  }
  return data;
}

function showToast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('fc_token');
  render();
}

let unsavedChanges = false;

window.addEventListener('beforeunload', (e) => {
  if (unsavedChanges) {
    e.preventDefault();
    e.returnValue = '';
  }
});

function setTab(tab) {
  if (unsavedChanges && state.tab === 'predicciones' && tab !== 'predicciones') {
    if (!confirm('Tienes cambios sin guardar en tus pronósticos. ¿Salir de todas formas?')) {
      return;
    }
  }
  unsavedChanges = false;
  state.tab = tab;
  render();
}

function getTheme() {
  return localStorage.getItem('fc_theme') || 'dark';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#F4F6F2' : '#090E0C');
}

applyTheme(getTheme());

// ---------- Boot ----------
async function boot() {
  if (state.token) {
    try {
      const { user } = await api('me');
      state.user = user;
    } catch (e) {
      state.token = null;
      localStorage.removeItem('fc_token');
    }
  }
  render();
}

// ---------- Render root ----------
function render() {
  app.innerHTML = '';
  if (!state.token || !state.user) {
    app.appendChild(renderLogin());
    return;
  }
  if (state.user.needs_profile_setup) {
    app.appendChild(renderProfileSetup());
    return;
  }
  app.appendChild(renderShell());
}

boot();

// ============================================================
// LOGIN / REGISTRO
// ============================================================
function renderLogin() {
  const wrap = document.createElement('div');
  wrap.className = 'login-screen';

  const isRegister = state.loginMode === 'register';

  wrap.innerHTML = `
    <div class="login-ball">⚽</div>
    <div class="login-box">
      <div class="login-title">Faltones<br>Curaçao</div>
      <div class="login-sub">La porra de La Liga 2026/27</div>
      <div class="login-tabs">
        <button data-mode="login" class="${!isRegister ? 'active' : ''}">Entrar</button>
        <button data-mode="register" class="${isRegister ? 'active' : ''}">Registrarme</button>
      </div>
      <form id="authForm">
        ${isRegister ? `<input type="text" name="inviteCode" placeholder="Código de invitación" required>` : ''}
        <input type="text" name="username" placeholder="Usuario" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required>
        <input type="password" name="password" placeholder="Contraseña" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" required>
        <button type="submit" class="btn block">${isRegister ? 'Crear cuenta' : 'Entrar'}</button>
      </form>
      <div id="authMsg"></div>
    </div>
  `;

  wrap.querySelectorAll('.login-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.loginMode = btn.dataset.mode;
      render();
    });
  });

  wrap.querySelector('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const msgEl = wrap.querySelector('#authMsg');
    msgEl.innerHTML = '';
    try {
      if (isRegister) {
        await api('register', { method: 'POST', body: {
          username: fd.get('username'),
          password: fd.get('password'),
          inviteCode: fd.get('inviteCode')
        }});
        msgEl.innerHTML = '<div class="success-msg">¡Registro correcto! Espera a que el admin apruebe tu cuenta y luego entra.</div>';
        state.loginMode = 'login';
      } else {
        const data = await api('login', { method: 'POST', body: {
          username: fd.get('username'),
          password: fd.get('password')
        }});
        state.token = data.token;
        state.user = data.user;
        localStorage.setItem('fc_token', data.token);
        render();
      }
    } catch (err) {
      msgEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });

  return wrap;
}

// ============================================================
// PRIMER ACCESO: NOMBRE Y FOTO DE PERFIL
// ============================================================
function renderProfileSetup() {
  const wrap = document.createElement('div');
  wrap.className = 'login-screen';
  wrap.innerHTML = `
    <div class="login-box">
      <div class="login-title" style="font-size:26px;">¡Bienvenido!</div>
      <div class="login-sub">Elige tu nombre o apodo para la porra</div>
      <form id="profileForm">
        <input type="text" name="displayName" placeholder="Tu nombre o apodo" required>
        <input type="file" name="avatar" accept="image/*">
        <button type="submit" class="btn block">Continuar</button>
      </form>
      <div id="profileMsg"></div>
    </div>
  `;

  wrap.querySelector('#profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const msgEl = wrap.querySelector('#profileMsg');
    const file = fd.get('avatar');
    let avatarBase64 = null;

    try {
      if (file && file.size > 0) {
        avatarBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      const data = await api('setup-profile', { method: 'POST', body: {
        displayName: fd.get('displayName'),
        avatarBase64
      }});
      state.user.display_name = fd.get('displayName');
      state.user.avatar_url = data.avatar_url || state.user.avatar_url;
      state.user.needs_profile_setup = false;
      render();
    } catch (err) {
      msgEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });

  return wrap;
}

// ============================================================
// SHELL PRINCIPAL (topbar + navegación + contenido)
// ============================================================
const TABS = [
  { id: 'predicciones', label: 'Pronósticos', icon: '⚽' },
  { id: 'clasificacion', label: 'Clasificación', icon: '🏆' },
  { id: 'historial', label: 'Historial', icon: '📅' },
  { id: 'reglas', label: 'Reglas', icon: '📋' }
];

function renderShell() {
  const wrap = document.createElement('div');

  const topbar = document.createElement('div');
  topbar.className = 'topbar';
  topbar.innerHTML = `
    <div class="brand">⚽ Faltones Curaçao</div>
    <div class="profile-chip">
      ${state.user.avatar_url ? `<img class="avatar" src="${state.user.avatar_url}">` : ''}
      <span>${escapeHtml(state.user.display_name || state.user.username)}</span>
      <button id="themeBtn" class="btn secondary" style="padding:6px 9px;font-size:13px;" title="Cambiar tema">${getTheme() === 'light' ? '🌙' : '☀️'}</button>
      <button id="logoutBtn" class="btn secondary" style="padding:6px 10px;font-size:11px;">Salir</button>
    </div>
  `;
  topbar.querySelector('#logoutBtn').addEventListener('click', logout);
  topbar.querySelector('#themeBtn').addEventListener('click', () => {
    const next = getTheme() === 'light' ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem('fc_theme', next);
    render();
  });
  wrap.appendChild(topbar);

  const content = document.createElement('div');
  content.id = 'content';
  wrap.appendChild(content);

  const nav = document.createElement('div');
  nav.className = 'bottom-nav';
  const tabs = [...TABS];
  if (state.user.is_admin) tabs.push({ id: 'admin', label: 'Admin', icon: '⚙️' });

  nav.innerHTML = tabs.map(t => `
    <button data-tab="${t.id}" class="${state.tab === t.id ? 'active' : ''}">
      <span class="icon">${t.icon}</span>
      <span class="nav-label">${t.label}</span>
    </button>
  `).join('');
  nav.querySelectorAll('button[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  });
  wrap.appendChild(nav);

  loadTabContent(content);

  return wrap;
}

async function loadTabContent(content) {
  content.innerHTML = '<div class="view">' + skeletonHtml(5) + '</div>';
  try {
    let view;
    if (state.tab === 'predicciones') view = await renderPredicciones();
    else if (state.tab === 'clasificacion') view = await renderClasificacion();
    else if (state.tab === 'historial') view = await renderHistorial();
    else if (state.tab === 'reglas') view = await renderReglas();
    else if (state.tab === 'admin') view = await renderAdmin();
    content.innerHTML = '';
    content.appendChild(view);
  } catch (err) {
    content.innerHTML = `<div class="view"><div class="error-msg">${err.message}</div></div>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function skeletonHtml(bars = 4) {
  let html = '<div class="skeleton-wrap">';
  for (let i = 0; i < bars; i++) {
    html += `<div class="skeleton-bar tall"></div>`;
  }
  html += '</div>';
  return html;
}

// ============================================================
// PESTAÑA: PRONÓSTICOS
// ============================================================
let countdownInterval = null;

async function renderPredicciones() {
  if (countdownInterval) clearInterval(countdownInterval);

  const data = await api('predictions');
  const view = document.createElement('div');
  view.className = 'view';

  if (!data.matchday) {
    view.innerHTML = `<div class="empty-state"><div class="icon">⚽</div>No hay ninguna jornada abierta ahora mismo.<br>Vuelve más tarde.</div>`;
    return view;
  }

  const md = data.matchday;
  view.innerHTML = `
    <h2>Jornada ${md.number}${md.is_midweek ? ' (entre semana)' : ''}</h2>
    <div id="summaryStrip"></div>
    <div class="deadline-strip">
      <div>
        <div class="label">Plazo cierra</div>
        <div style="font-size:13px;color:var(--text-muted);">${formatDateEs(md.deadline_at)}</div>
      </div>
      <div class="clock" id="countdown">--:--:--:--</div>
    </div>
    <div class="progress-strip">
      <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
      <div class="progress-text" id="progressText"></div>
    </div>
    <div class="card" style="margin-top:14px;">
      <div id="matchesList"></div>
      <div id="predsMsg"></div>
    </div>
    <div class="sticky-save">
      <button id="submitPreds" class="btn block">Guardar pronósticos</button>
    </div>
  `;

  fillSummaryStrip(view.querySelector('#summaryStrip'));

  const list = view.querySelector('#matchesList');
  data.matches.forEach(m => {
    const wrap = document.createElement('div');
    wrap.className = 'match-block';
    const hasPred = !!m.my_prediction;
    const prevHome = hasPred ? m.my_prediction.home_score_pred : 0;
    const prevAway = hasPred ? m.my_prediction.away_score_pred : 0;
    wrap.innerHTML = `
      <div class="match-kickoff">${formatMatchKickoff(m.kickoff_at)}</div>
      <div class="match-teams">
        <div class="team home">
          ${crestImgHtml(m.home_team.crest_url)}
          <div><div>${escapeHtml(m.home_team.name)}</div><div class="pos">${m.home_team.liga_position ? '#' + m.home_team.liga_position : ''}</div></div>
        </div>
        <div class="team away">
          ${crestImgHtml(m.away_team.crest_url)}
          <div><div>${escapeHtml(m.away_team.name)}</div><div class="pos">${m.away_team.liga_position ? '#' + m.away_team.liga_position : ''}</div></div>
        </div>
      </div>
      <div class="match-scores">
        ${scoreStepperHtml(m.id, 'home', prevHome, hasPred)}
        <span class="score-sep">-</span>
        ${scoreStepperHtml(m.id, 'away', prevAway, hasPred)}
      </div>
    `;
    list.appendChild(wrap);
  });

  const updateProgress = () => {
    const steppers = view.querySelectorAll('.score-stepper');
    const total = data.matches.length;
    const touchedMatches = new Set();
    steppers.forEach(st => {
      if (st.dataset.touched === '1') touchedMatches.add(st.dataset.match);
    });
    const done = touchedMatches.size;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    view.querySelector('#progressFill').style.width = pct + '%';
    view.querySelector('#progressText').textContent = `${done} de ${total} partidos`;
  };

  bindScoreSteppers(list, () => {
    unsavedChanges = true;
    updateProgress();
  });
  updateProgress();

  const anySubmitted = data.matches.some(m => m.my_prediction);
  const submitBtn = view.querySelector('#submitPreds');
  submitBtn.textContent = anySubmitted ? 'Actualizar pronósticos' : 'Guardar pronósticos';
  view.querySelector('#matchesList').insertAdjacentHTML('afterend',
    '<div class="muted" style="margin-top:12px;font-size:13px;">Puedes cambiar tu pronóstico las veces que quieras hasta que cierre el plazo. Los pronósticos de los demás se revelarán al cerrarse.</div>');

  submitBtn.addEventListener('click', async () => {
    const steppers = view.querySelectorAll('.score-stepper');
    const byMatch = {};
    steppers.forEach(st => {
      const id = parseInt(st.dataset.match, 10);
      if (!byMatch[id]) byMatch[id] = {};
      byMatch[id][st.dataset.side] = st.dataset.value;
    });
    const predictions = Object.entries(byMatch).map(([matchId, v]) => ({
      matchId: parseInt(matchId, 10), home: v.home, away: v.away
    }));
    const msgEl = view.querySelector('#predsMsg');
    try {
      await api('predictions', { method: 'POST', body: { predictions } });
      unsavedChanges = false;
      showToast('Pronósticos guardados');
      loadTabContent(document.getElementById('content'));
    } catch (err) {
      msgEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });

  startCountdown(md.deadline_at, view.querySelector('#countdown'));

  return view;
}

function crestImgHtml(url) {
  if (!url) return '<span class="crest-fallback">⚽</span>';
  return `<img src="${url}" loading="lazy" onerror="this.outerHTML='<span class=\\'crest-fallback\\'>⚽</span>'">`;
}

async function fillSummaryStrip(el) {
  try {
    const { ranking } = await api('standings-porra');
    if (!ranking || ranking.length === 0) { el.innerHTML = ''; return; }
    const meIndex = ranking.findIndex(r => r.username === state.user.username);
    if (meIndex === -1) { el.innerHTML = ''; return; }
    const me = ranking[meIndex];
    const leader = ranking[0];
    const gap = leader.total_points - me.total_points;
    const gapText = meIndex === 0 ? 'Vas líder' : `A ${gap} pto${gap === 1 ? '' : 's'} del líder`;
    el.innerHTML = `
      <div class="summary-strip">
        <div class="summary-stat">
          <div class="summary-value">#${me.position}</div>
          <div class="summary-label">Tu posición</div>
        </div>
        <div class="summary-stat">
          <div class="summary-value">${me.total_points}</div>
          <div class="summary-label">Puntos</div>
        </div>
        <div class="summary-stat">
          <div class="summary-value" style="font-size:15px;">${gapText}</div>
          <div class="summary-label">Clasificación</div>
        </div>
      </div>
    `;
  } catch (e) {
    el.innerHTML = '';
  }
}

function scoreStepperHtml(matchId, side, value, touched) {
  return `
    <div class="score-stepper" data-match="${matchId}" data-side="${side}" data-value="${value}" data-touched="${touched ? '1' : '0'}">
      <button type="button" class="step-btn minus">−</button>
      <span class="step-value">${value}</span>
      <button type="button" class="step-btn plus">+</button>
    </div>
  `;
}

function bindScoreSteppers(container, onChange) {
  container.querySelectorAll('.score-stepper').forEach(st => {
    const valueEl = st.querySelector('.step-value');
    const update = (delta) => {
      let v = parseInt(st.dataset.value, 10) + delta;
      v = Math.max(0, Math.min(20, v));
      st.dataset.value = v;
      st.dataset.touched = '1';
      valueEl.textContent = v;
      if (onChange) onChange();
    };
    st.querySelector('.minus').addEventListener('click', () => update(-1));
    st.querySelector('.plus').addEventListener('click', () => update(1));
  });
}

function startCountdown(deadlineIso, el) {
  function tick() {
    const diff = new Date(deadlineIso).getTime() - Date.now();
    if (diff <= 0) {
      el.textContent = 'CERRADO';
      clearInterval(countdownInterval);
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  tick();
  countdownInterval = setInterval(tick, 1000);
}

function pad(n) { return String(n).padStart(2, '0'); }

function formatMatchKickoff(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid'
  });
}

function formatDateEs(iso) {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid'
  }) + ' (hora peninsular)';
}

// ============================================================
// PESTAÑA: CLASIFICACIÓN
// ============================================================
let clasifSubTab = 'porra';
let porraViewMode = 'general'; // 'general' | 'jornada'
let selectedJornadaNumber = null;
let historyCache = null;

async function renderClasificacion() {
  const view = document.createElement('div');
  view.className = 'view';
  view.innerHTML = `
    <h2>Clasificación</h2>
    <div class="tabs-row">
      <button data-sub="porra" class="${clasifSubTab === 'porra' ? 'active' : ''}">Porra</button>
      <button data-sub="liga" class="${clasifSubTab === 'liga' ? 'active' : ''}">La Liga real</button>
    </div>
    <div id="porraModeRow"></div>
    <div class="card" id="clasifContent"></div>
  `;

  view.querySelectorAll('.tabs-row button').forEach(btn => {
    btn.addEventListener('click', async () => {
      clasifSubTab = btn.dataset.sub;
      view.querySelectorAll('.tabs-row button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      paintPorraModeRow(view);
      await fillClasifContent(view.querySelector('#clasifContent'));
    });
  });

  paintPorraModeRow(view);
  await fillClasifContent(view.querySelector('#clasifContent'));
  return view;
}

function paintPorraModeRow(view) {
  const row = view.querySelector('#porraModeRow');
  if (clasifSubTab !== 'porra') { row.innerHTML = ''; return; }
  row.innerHTML = `
    <div class="tabs-row">
      <button data-mode="general" class="${porraViewMode === 'general' ? 'active' : ''}">General</button>
      <button data-mode="jornada" class="${porraViewMode === 'jornada' ? 'active' : ''}">Por jornada</button>
    </div>
  `;
  row.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      porraViewMode = btn.dataset.mode;
      row.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await fillClasifContent(view.querySelector('#clasifContent'));
    });
  });
}

function nameSizeClass(name) {
  const len = (name || '').length;
  if (len > 20) return 'name-xs';
  if (len > 14) return 'name-sm';
  return '';
}

function breakdownTable(ranking, myUsername) {
  const medals = ['🥇', '🥈', '🥉'];
  return `
    <div class="standings-table-scroll">
    <table class="standings-table standings-table-hi">
      <thead><tr>
        <th>#</th><th>Jugador</th><th>Pts</th>
        <th title="Puntos por resultado exacto">Exac.</th>
        <th title="Puntos por diferencia de goles">Dif.</th>
        <th title="Puntos por acertar solo el ganador">Gan.</th>
      </tr></thead>
      <tbody>
        ${ranking.map((r, i) => `
          <tr class="${r.username === myUsername ? 'row-me' : ''} ${i < 3 ? 'row-rank-' + (i + 1) : ''}">
            <td class="pos-col">${i < 3 ? `<span class="medal">${medals[i]}</span>` : (r.position ?? i + 1)}</td>
            <td class="name-cell"><span class="${nameSizeClass(r.display_name)}">${escapeHtml(r.display_name)}</span></td>
            <td class="pts">${r.total_points}</td>
            <td>${r.exact_points}</td>
            <td>${r.diff_points}</td>
            <td>${r.winner_points}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    </div>
  `;
}

async function fillClasifContent(container) {
  container.innerHTML = skeletonHtml(4);

  if (clasifSubTab === 'porra' && porraViewMode === 'general') {
    const { ranking } = await api('standings-porra');
    if (ranking.length === 0) {
      container.innerHTML = '<div class="empty-state">Todavía no hay puntos calculados</div>';
      return;
    }
    container.innerHTML = breakdownTable(ranking, state.user.username) + `
      <button id="exportCsvBtn" class="btn secondary block" style="margin-top:14px;">⬇️ Exportar a CSV</button>
    `;
    container.querySelector('#exportCsvBtn').addEventListener('click', async () => {
      const res = await fetch('/api/export-csv', {
        headers: { Authorization: 'Bearer ' + state.token }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'clasificacion-faltones-curacao.csv';
      a.click();
      URL.revokeObjectURL(url);
    });

  } else if (clasifSubTab === 'porra' && porraViewMode === 'jornada') {
    if (!historyCache) historyCache = await api('history');
    const matchdays = historyCache.matchdays;
    if (matchdays.length === 0) {
      container.innerHTML = '<div class="empty-state">Todavía no hay jornadas cerradas</div>';
      return;
    }
    if (!selectedJornadaNumber) selectedJornadaNumber = matchdays[0].number;

    container.innerHTML = `
      <label class="muted" style="font-size:12px;">Jornada</label>
      <select id="jornadaSelect" style="margin-bottom:14px;">
        ${matchdays.map(md => `<option value="${md.number}" ${md.number === selectedJornadaNumber ? 'selected' : ''}>Jornada ${md.number}</option>`).join('')}
      </select>
      <div id="jornadaTable"></div>
    `;
    const paintJornadaTable = () => {
      const md = matchdays.find(m => m.number === selectedJornadaNumber);
      const ranking = computeJornadaRanking(md);
      container.querySelector('#jornadaTable').innerHTML = ranking.length
        ? breakdownTable(ranking, state.user.display_name || state.user.username)
        : '<div class="empty-state">Sin pronósticos puntuados en esta jornada</div>';
    };
    container.querySelector('#jornadaSelect').addEventListener('change', (e) => {
      selectedJornadaNumber = parseInt(e.target.value, 10);
      paintJornadaTable();
    });
    paintJornadaTable();

  } else {
    const { teams } = await api('standings-liga');
    container.innerHTML = `
      <div class="standings-table-scroll">
      <table class="standings-table standings-table-liga">
        <thead><tr><th>#</th><th>Equipo</th><th>Pts</th><th>PJ</th></tr></thead>
        <tbody>
          ${teams.map(t => `
            <tr>
              <td class="pos-col">${t.liga_position ?? '-'}</td>
              <td class="name-cell">
                <div class="name-inner">
                  ${t.crest_url ? `<img class="crest-img" src="${t.crest_url}" loading="lazy" onerror="this.style.display='none'">` : ''}
                  <span>${escapeHtml(t.name)}</span>
                </div>
              </td>
              <td class="pts">${t.liga_points ?? '-'}</td>
              <td>${t.liga_played ?? '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      </div>
    `;
  }
}

function computeJornadaRanking(matchday) {
  const stats = {};
  matchday.matches.forEach(m => {
    m.predictions.forEach(p => {
      if (p.points == null) return;
      if (!stats[p.username]) {
        stats[p.username] = {
          username: p.username, display_name: p.username, avatar_url: null,
          total_points: 0, exact_points: 0, diff_points: 0, winner_points: 0,
          exact_results: 0
        };
      }
      const s = stats[p.username];
      s.total_points += p.points;
      if (p.points === 6) { s.exact_points += 6; s.exact_results += 1; }
      else if (p.points === 3) { s.diff_points += 2; s.winner_points += 1; }
      else if (p.points === 1) { s.winner_points += 1; }
    });
  });
  return Object.values(stats).sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    return b.exact_results - a.exact_results;
  }).map((r, i) => ({ ...r, position: i + 1 }));
}

// ============================================================
// PESTAÑA: HISTORIAL
// ============================================================
async function renderHistorial() {
  const { matchdays } = await api('history');
  const view = document.createElement('div');
  view.className = 'view';

  if (matchdays.length === 0) {
    view.innerHTML = `<h2>Historial</h2><div class="empty-state"><div class="icon">📅</div>Todavía no hay jornadas cerradas.</div>`;
    return view;
  }

  view.innerHTML = `<h2>Historial</h2>`;

  matchdays.forEach(md => {
    const section = document.createElement('div');
    section.className = 'card jornada-card';
    section.style.marginTop = '14px';
    const finished = md.matches.every(m => m.status === 'finished');
    section.innerHTML = `
      <div class="jornada-header">
        <h3>Jornada ${md.number}</h3>
        ${!finished ? '<span class="jornada-pending">Pendiente de resultados</span>' : ''}
      </div>
      <div class="matchday-body"></div>
    `;
    const body = section.querySelector('.matchday-body');
    md.matches.forEach((m, idx) => {
      const sortedPreds = [...m.predictions].sort((a, b) => (b.points ?? -1) - (a.points ?? -1));
      const details = document.createElement('details');
      details.className = 'match-accordion';
      if (idx === 0) details.open = true;
      details.innerHTML = `
        <summary>
          <span class="match-kickoff" style="padding-top:0;">${formatMatchKickoff(m.kickoff_at)}</span>
          <div class="match-row" style="border-bottom:none;padding:6px 0;">
            <div class="team home">
              ${crestImgHtml(m.home_team.crest_url)}
              <div>${escapeHtml(m.home_team.name)}</div>
            </div>
            <div class="score-locked">${m.status === 'finished' ? `${m.home_score} - ${m.away_score}` : 'vs'}</div>
            <div class="team away">
              ${crestImgHtml(m.away_team.crest_url)}
              <div>${escapeHtml(m.away_team.name)}</div>
            </div>
          </div>
        </summary>
        <table class="predictions-table">
          <thead><tr><th>Jugador</th><th>Pronóstico</th><th>Pts</th></tr></thead>
          <tbody>
            ${sortedPreds.map(p => `
              <tr class="${p.username === (state.user.display_name || state.user.username) ? 'row-me' : ''}">
                <td>${escapeHtml(p.username)}</td>
                <td class="pred-score">${p.home}-${p.away}</td>
                <td>${p.points != null ? `<span class="pts-pill pts-${p.points}">${p.points}</span>` : '<span class="muted">-</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      body.appendChild(details);
    });
    view.appendChild(section);
  });

  return view;
}

function badgeFor(points) {
  const cls = points === 6 ? 'verde' : points >= 1 ? 'amarillo' : 'rojo';
  return `<span class="badge ${cls}"></span>`;
}

// ============================================================
// PESTAÑA: REGLAS
// ============================================================
async function renderReglas() {
  const view = document.createElement('div');
  view.className = 'view';
  let rulesText = DEFAULT_RULES_TEXT;
  if (state.user.is_admin) {
    try {
      const { config } = await api('admin-config');
      if (config.rules_text) rulesText = config.rules_text;
    } catch (e) { /* usa el texto por defecto */ }
  } else {
    // los usuarios normales no tienen acceso a admin-config; usamos el texto por defecto
    // (si el admin lo ha personalizado, se sirve igual desde aquí en una futura mejora)
  }
  view.innerHTML = `
    <h2>Reglas</h2>
    <div class="card" style="white-space:pre-wrap;line-height:1.6;font-size:14px;">${escapeHtml(rulesText)}</div>
  `;
  return view;
}

const DEFAULT_RULES_TEXT = `Puntuación
- Resultado exacto: 6 puntos
- Diferencia de goles correcta (sin acertar el resultado exacto): 2 puntos por la diferencia + 1 punto por el ganador = 3 puntos
- Solo acertar el ganador (o el empate), sin acertar la diferencia: 1 punto
- Si no se acierta nada: 0 puntos

Desempate en la clasificación general
1. Más puntos totales
2. Más resultados exactos
3. Más aciertos de ganador

Plazos
- Jornadas normales: viernes anterior a las 18:00 (hora peninsular)
- Jornadas 6 y 33 (entre semana): martes anterior a las 17:00 (hora peninsular)
- Puedes cambiar tu pronóstico las veces que quieras hasta que cierre el plazo
- Si no envías tu pronóstico a tiempo, te quedas con 0 puntos esa jornada

Partidos aplazados
- Si un partido se aplaza al principio de temporada, sigue perteneciendo a su jornada
  original y mantiene el mismo plazo, aunque se juegue entre semana.`;

// ============================================================
// PANEL DE ADMINISTRACIÓN
// ============================================================
let adminSubTab = 'usuarios';

async function renderAdmin() {
  const view = document.createElement('div');
  view.className = 'view';
  view.innerHTML = `
    <h2>Admin</h2>
    <div class="tabs-row">
      <button data-sub="usuarios">Usuarios</button>
      <button data-sub="pronosticos">Pronósticos</button>
      <button data-sub="datos">Sincronizar datos</button>
      <button data-sub="partidos">Partidos</button>
      <button data-sub="config">Configuración</button>
      <button data-sub="whatsapp">Avisos WhatsApp</button>
    </div>
    <div id="adminContent"></div>
  `;
  view.querySelectorAll('.tabs-row button').forEach(btn => {
    if (btn.dataset.sub === adminSubTab) btn.classList.add('active');
    btn.addEventListener('click', async () => {
      adminSubTab = btn.dataset.sub;
      view.querySelectorAll('.tabs-row button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await fillAdminContent(view.querySelector('#adminContent'));
    });
  });
  await fillAdminContent(view.querySelector('#adminContent'));
  return view;
}

async function fillAdminContent(container) {
  container.innerHTML = skeletonHtml(4);
  if (adminSubTab === 'usuarios') return renderAdminUsuarios(container);
  if (adminSubTab === 'pronosticos') return renderAdminPronosticos(container);
  if (adminSubTab === 'datos') return renderAdminDatos(container);
  if (adminSubTab === 'partidos') return renderAdminPartidos(container);
  if (adminSubTab === 'config') return renderAdminConfig(container);
  if (adminSubTab === 'whatsapp') return renderAdminWhatsapp(container);
}

async function renderAdminPronosticos(container) {
  const { matchday, matches, users } = await api('admin-current-submissions');
  if (!matchday) {
    container.innerHTML = '<div class="card"><div class="empty-state">No hay ninguna jornada abierta ahora mismo</div></div>';
    return;
  }

  const matchLabel = (id) => {
    const m = matches.find(x => x.id === id);
    return m ? `${m.home_team.name} - ${m.away_team.name}` : '';
  };

  container.innerHTML = `
    <div class="card" style="margin-bottom:14px;">
      <h3 style="font-size:15px;color:var(--amber);margin-bottom:4px;">Jornada ${matchday.number}</h3>
      <p class="muted" style="font-size:12px;">Solo tú puedes ver esto antes de que cierre el plazo (${formatDateEs(matchday.deadline_at)}).</p>
    </div>
    <div class="card">
      ${users.map(u => `
        <div class="admin-row" style="flex-direction:column;align-items:stretch;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>${escapeHtml(u.name)}</strong>
            <span class="badge ${u.submitted ? (u.submitted_count === u.total_matches ? 'verde' : 'amarillo') : 'rojo'}"></span>
            <span class="muted" style="font-size:12px;">${u.submitted_count}/${u.total_matches}</span>
          </div>
          ${u.submitted ? `
            <div class="muted" style="font-size:12px;margin-top:6px;">
              ${u.predictions.map(p => `${matchLabel(p.match_id)}: ${p.home}-${p.away}`).join(' · ')}
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

async function renderAdminUsuarios(container) {
  const [{ pending }, { users }] = await Promise.all([
    api('admin-users-pending'),
    api('admin-users-list')
  ]);

  const pendingHtml = pending.length === 0
    ? '<div class="empty-state">No hay usuarios pendientes de aprobación</div>'
    : pending.map(u => `
      <div class="admin-row">
        <div>${escapeHtml(u.username)}</div>
        <button class="btn" data-approve="${u.id}" style="padding:8px 14px;font-size:12px;">Aprobar</button>
      </div>
    `).join('');

  const usersHtml = users.map(u => `
    <div class="admin-row">
      <div>
        <div>${escapeHtml(u.display_name || u.username)}${u.is_admin ? ' <span class="muted" style="font-size:11px;">(admin)</span>' : ''}</div>
        <div class="muted" style="font-size:11px;">usuario: <strong>${escapeHtml(u.username)}</strong></div>
      </div>
      <button class="btn secondary" data-reset="${u.id}" style="padding:8px 14px;font-size:12px;">Restablecer contraseña</button>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="card admin-section">
      <h3>Pendientes de aprobación</h3>
      ${pendingHtml}
    </div>
    <div class="card admin-section">
      <h3>Restablecer contraseña</h3>
      <p class="muted" style="font-size:12px;margin-bottom:10px;">Si alguien no se acuerda de su contraseña, genera una nueva aquí y pásasela por WhatsApp.</p>
      ${usersHtml}
    </div>
    <div id="resetMsg"></div>
  `;

  container.querySelectorAll('button[data-approve]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await api('admin-users-approve', { method: 'POST', body: { userId: btn.dataset.approve } });
        showToast('Usuario aprobado');
        renderAdminUsuarios(container);
      } catch (err) {
        showToast(err.message);
      }
    });
  });

  container.querySelectorAll('button[data-reset]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('.admin-row');
      const name = row ? row.querySelector('div').textContent.trim() : 'este usuario';
      if (!confirm(`¿Seguro que quieres restablecer la contraseña de ${name}? La actual dejará de funcionar.`)) return;
      const msgEl = container.querySelector('#resetMsg');
      try {
        const res = await api('admin-reset-password', { method: 'POST', body: { userId: btn.dataset.reset } });
        msgEl.innerHTML = `<div class="card" style="margin-top:10px;">
          <div class="muted" style="font-size:12px;">Nueva contraseña temporal:</div>
          <div style="font-family:var(--font-display);font-size:22px;color:var(--lime);letter-spacing:0.05em;">${res.tempPassword}</div>
          <div class="muted" style="font-size:12px;margin-top:6px;">Pásasela a la persona; puede entrar con esta y ya está (no hace falta que la cambie).</div>
        </div>`;
      } catch (err) {
        msgEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
      }
    });
  });
}

async function renderAdminDatos(container) {
  container.innerHTML = `
    <div class="card admin-section">
      <h3>Configuración inicial</h3>
      <p class="muted" style="font-size:13px;">Ejecuta estos dos primero, en este orden, una sola vez al principio de temporada.</p>
      <button class="btn secondary block" id="syncTeams" style="margin-bottom:8px;">1. Sincronizar equipos</button>
      <button class="btn secondary block" id="syncCalendar">2. Sincronizar calendario (38 jornadas)</button>
    </div>
    <div class="card admin-section">
      <h3>Actualizaciones periódicas</h3>
      <p class="muted" style="font-size:13px;">Ejecuta esto cada vez que quieras actualizar resultados y la clasificación real.</p>
      <button class="btn secondary block" id="syncResults" style="margin-bottom:8px;">Actualizar resultados y puntos</button>
      <button class="btn secondary block" id="syncLiga">Actualizar clasificación de La Liga</button>
    </div>
    <div class="card admin-section">
      <h3>Recalcular puntos</h3>
      <p class="muted" style="font-size:13px;">Solo hace falta si has cambiado las reglas de puntuación y quieres que los partidos ya jugados se actualicen también con la fórmula nueva.</p>
      <button class="btn secondary block" id="recalcPoints">Recalcular todos los puntos</button>
    </div>
    <div id="syncMsg"></div>
  `;
  const msgEl = container.querySelector('#syncMsg');
  const bind = (id, endpoint) => {
    container.querySelector(id).addEventListener('click', async () => {
      container.querySelector(id).disabled = true;
      msgEl.innerHTML = '<div class="muted">Consultando football-data.org…</div>';
      try {
        const res = await api(endpoint, { method: 'POST' });
        msgEl.innerHTML = `<div class="success-msg">${res.message}</div>`;
      } catch (err) {
        msgEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
      }
      container.querySelector(id).disabled = false;
    });
  };
  bind('#syncTeams', 'admin-sync-teams');
  bind('#syncCalendar', 'admin-sync-calendar');
  bind('#syncResults', 'admin-sync-results');
  bind('#syncLiga', 'admin-sync-liga');
  bind('#recalcPoints', 'admin-recalculate-points');
}

async function renderAdminPartidos(container) {
  const { matchdays } = await api('admin-matchdays');
  if (matchdays.length === 0) {
    container.innerHTML = '<div class="card"><div class="empty-state">Todavía no hay calendario. Sincroniza los datos primero.</div></div>';
    return;
  }

  container.innerHTML = `
    <div class="card" style="margin-bottom:14px;">
      <label class="muted" style="font-size:12px;">Selecciona jornada</label>
      <select id="mdSelect">
        ${matchdays.map(md => `<option value="${md.id}">Jornada ${md.number}${md.is_midweek ? ' (entre semana)' : ''}</option>`).join('')}
      </select>
    </div>
    <div id="mdDetail"></div>
  `;

  const select = container.querySelector('#mdSelect');
  const detail = container.querySelector('#mdDetail');

  function paintDetail() {
    const md = matchdays.find(m => m.id == select.value);
    detail.innerHTML = `
      <div class="card" style="margin-bottom:14px;">
        <label class="muted" style="font-size:12px;">Plazo de esta jornada (hora peninsular)</label>
        <input type="datetime-local" id="deadlineInput" value="${toLocalInputValue(md.deadline_at)}">
        <button class="btn secondary block" id="saveDeadline" style="margin-top:8px;">Guardar plazo</button>
      </div>
      <div class="card">
        ${md.matches.map(m => `
          <div class="admin-row" style="flex-wrap:wrap;">
            <div style="flex:1;min-width:160px;">
              <div>${escapeHtml(m.home_team.name)} vs ${escapeHtml(m.away_team.name)}</div>
              <div class="muted" style="font-size:11px;">${formatDateEs(m.kickoff_at)} · ${m.status}</div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;">
              <input type="number" min="0" style="width:44px;" data-field="home" data-match="${m.id}" value="${m.home_score ?? ''}">
              <span>-</span>
              <input type="number" min="0" style="width:44px;" data-field="away" data-match="${m.id}" value="${m.away_score ?? ''}">
              <button class="btn secondary" data-action="save-score" data-match="${m.id}" style="padding:8px;font-size:11px;">Guardar</button>
              <button class="btn secondary" data-action="postpone" data-match="${m.id}" style="padding:8px;font-size:11px;">Aplazar</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div id="matchMsg"></div>
    `;

    detail.querySelector('#saveDeadline').addEventListener('click', async () => {
      const val = detail.querySelector('#deadlineInput').value;
      const iso = madridLocalInputToIso(val);
      try {
        await api('admin-edit-matchday', { method: 'POST', body: { matchdayId: md.id, deadlineAt: iso } });
        showToast('Plazo actualizado');
      } catch (err) { showToast(err.message); }
    });

    detail.querySelectorAll('button[data-action="save-score"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const matchId = parseInt(btn.dataset.match, 10);
        const home = detail.querySelector(`input[data-field="home"][data-match="${matchId}"]`).value;
        const away = detail.querySelector(`input[data-field="away"][data-match="${matchId}"]`).value;
        const msgEl = detail.querySelector('#matchMsg');
        try {
          await api('admin-edit-result', { method: 'POST', body: {
            matchId, homeScore: parseInt(home, 10), awayScore: parseInt(away, 10)
          }});
          msgEl.innerHTML = '<div class="success-msg">Resultado guardado y puntos recalculados</div>';
        } catch (err) {
          msgEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
        }
      });
    });

    detail.querySelectorAll('button[data-action="postpone"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const matchId = parseInt(btn.dataset.match, 10);
        try {
          await api('admin-edit-match', { method: 'POST', body: { matchId, status: 'postponed' } });
          showToast('Partido marcado como aplazado');
          renderAdminPartidos(container);
        } catch (err) { showToast(err.message); }
      });
    });
  }

  select.addEventListener('change', paintDetail);
  paintDetail();
}

function toLocalInputValue(iso) {
  // muestra la hora en peninsular dentro del input datetime-local
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(d).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function madridLocalInputToIso(localValue) {
  // localValue tipo "2026-08-14T18:00" interpretado como hora peninsular
  const [datePart, timePart] = localValue.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
  const parts = fmt.formatToParts(guess).reduce((a, p) => { if (p.type !== 'literal') a[p.type] = parseInt(p.value, 10); return a; }, {});
  const hh2 = parts.hour === 24 ? 0 : parts.hour;
  const guessedMadrid = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hh2, parts.minute));
  const diff = guess.getTime() - guessedMadrid.getTime();
  return new Date(guess.getTime() + diff).toISOString();
}

async function renderAdminConfig(container) {
  const { config } = await api('admin-config');
  container.innerHTML = `
    <div class="card admin-section">
      <h3>Código de invitación</h3>
      <input type="text" id="inviteCodeInput" value="${escapeHtml(config.invite_code || '')}">
      <button class="btn secondary block" id="saveInvite" style="margin-top:8px;">Guardar</button>
    </div>
    <div class="card admin-section">
      <h3>Premio / apuesta de la clasificación final</h3>
      <input type="text" id="prizeInput" value="${escapeHtml(config.prize_text || '')}">
      <button class="btn secondary block" id="savePrize" style="margin-top:8px;">Guardar</button>
    </div>
    <div class="card admin-section">
      <h3>Texto de la pantalla de Reglas</h3>
      <textarea id="rulesInput" rows="10" style="width:100%;background:var(--bg-input);color:var(--text-primary);border:1px solid var(--line);border-radius:10px;padding:12px;font-family:var(--font-body);font-size:13px;">${escapeHtml(config.rules_text || DEFAULT_RULES_TEXT)}</textarea>
      <button class="btn secondary block" id="saveRules" style="margin-top:8px;">Guardar</button>
    </div>
    <div id="configMsg"></div>
  `;
  const msgEl = container.querySelector('#configMsg');
  const bindSave = (btnId, key, inputId) => {
    container.querySelector(btnId).addEventListener('click', async () => {
      try {
        await api('admin-config', { method: 'POST', body: { key, value: container.querySelector(inputId).value } });
        msgEl.innerHTML = '<div class="success-msg">Guardado</div>';
      } catch (err) {
        msgEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
      }
    });
  };
  bindSave('#saveInvite', 'invite_code', '#inviteCodeInput');
  bindSave('#savePrize', 'prize_text', '#prizeInput');
  bindSave('#saveRules', 'rules_text', '#rulesInput');
}

async function renderAdminWhatsapp(container) {
  container.innerHTML = `
    <div class="card">
      <p class="muted" style="font-size:13px;margin-bottom:14px;">
        Pulsa un botón para abrir WhatsApp con el mensaje ya escrito. Tú eliges el grupo y le das a enviar.
      </p>
      <button class="btn block" id="waDeadline" style="margin-bottom:10px;">📤 Aviso de cierre de plazo</button>
      <button class="btn block" id="waMissing" style="margin-bottom:10px;">📤 Avisar a quien falta por meter la porra</button>
      <button class="btn block" id="waResults" style="margin-bottom:10px;">📤 Aviso de resultados publicados</button>
      <button class="btn block" id="waLeader">📤 Aviso de cambio de líder</button>
    </div>
  `;

  container.querySelector('#waMissing').addEventListener('click', async () => {
    try {
      const { matchday, users } = await api('admin-current-submissions');
      if (!matchday) return showToast('No hay ninguna jornada abierta');
      const missing = users.filter(u => u.submitted_count < u.total_matches);
      if (missing.length === 0) {
        return showToast('¡Todo el mundo ha metido ya su porra!');
      }
      const names = missing.map(u => u.name).join(', ');
      const text = `⚽ Faltones Curaçao – Jornada ${matchday.number}\nFaltan por meter la porra: ${names}.\nEl plazo cierra el ${formatDateEs(matchday.deadline_at)}. ¡Espabilad!`;
      openWhatsapp(text);
    } catch (err) { showToast(err.message); }
  });

  container.querySelector('#waDeadline').addEventListener('click', async () => {
    try {
      const { matchday } = await api('predictions');
      if (!matchday) return showToast('No hay ninguna jornada abierta');
      const text = `⚽ Faltones Curaçao – Jornada ${matchday.number}\nEl plazo para meter los pronósticos cierra el ${formatDateEs(matchday.deadline_at)}. ¡No se te olvide!`;
      openWhatsapp(text);
    } catch (err) { showToast(err.message); }
  });

  container.querySelector('#waResults').addEventListener('click', async () => {
    try {
      const { matchdays } = await api('history');
      const last = matchdays[0];
      if (!last) return showToast('Todavía no hay jornadas cerradas');
      const text = `⚽ Faltones Curaçao – Jornada ${last.number}\nYa están los resultados y los puntos de la jornada. ¡Entra a verlos!`;
      openWhatsapp(text);
    } catch (err) { showToast(err.message); }
  });

  container.querySelector('#waLeader').addEventListener('click', async () => {
    try {
      const { ranking } = await api('standings-porra');
      if (ranking.length === 0) return showToast('Todavía no hay clasificación');
      const leader = ranking[0];
      const text = `⚽ Faltones Curaçao\n¡Tenemos líder! ${leader.display_name} manda la clasificación con ${leader.total_points} puntos.`;
      openWhatsapp(text);
    } catch (err) { showToast(err.message); }
  });
}

function openWhatsapp(text) {
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}
