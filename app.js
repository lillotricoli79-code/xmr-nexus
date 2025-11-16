



// XMR Nexus Dashboard – versione completa (quella di ieri)
// Endpoint di default: puoi sovrascriverlo dalla UI o via ?api=...
const CONFIG = {
  refreshMs: 5000,
  chartPoints: Number(localStorage.getItem('chartPoints')) || 40,
  endpoint:
    new URLSearchParams(location.search).get('api') ||
    localStorage.getItem('activeEndpoint') ||
    'http://0.0.0.0:8081/stats?access-token=123456'
};

let chartHashrate, chartShares, chartSharesTime;
let startTime = Number(localStorage.getItem('startTime')) || Date.now();
let historyRows = JSON.parse(localStorage.getItem('historyRows') || '[]');
let unitIndex = Number(localStorage.getItem('unitIndex')) || 0;

// UI refs
const ui = {
  hashrate: document.getElementById('hashrate'),
  pool: document.getElementById('pool'),
  workers: document.getElementById('workers'),
  accepted: document.getElementById('accepted'),
  rejected: document.getElementById('rejected'),
  uptime: document.getElementById('uptime'),
  statusMsg: document.getElementById('statusMsg'),
  statusBadge: document.getElementById('statusBadge'),
  rangeSelect: document.getElementById('rangeSelect'),
  btnClearChart: document.getElementById('btnClearChart'),
  btnUnit: document.getElementById('btnUnit'),
  workersTableBody: document.querySelector('#workersTable tbody'),
  workerFilter: document.getElementById('workerFilter'),
  themeToggle: document.getElementById('themeToggle'),
  shareLink: document.getElementById('shareLink'),
  apiInput: document.getElementById('apiInput'),
  apiUrlLabel: document.getElementById('apiUrlLabel'),
  btnApiApply: document.getElementById('btnApiApply'),
  btnRefresh: document.getElementById('btnRefresh'),
  btnExportCsv: document.getElementById('btnExportCsv')
};

// Helpers
function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}
function formatHashrate(hr) {
  const units = ['H/s','kH/s','MH/s']; const divs = [1, 1e3, 1e6];
  const val = (Number(hr || 0) / divs[unitIndex]).toFixed(2);
  return `${val} ${units[unitIndex]}`;
}
function toast(msg) {
  ui.statusMsg.textContent = msg;
  setTimeout(() => { if (ui.statusMsg.textContent === msg) ui.statusMsg.textContent = ''; }, 4000);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function setStatusBadge(kind, text) {
  ui.statusBadge.className = 'badge ' + (kind === 'ok' ? 'badge-ok' : kind === 'err' ? 'badge-err' : 'badge-warn');
  ui.statusBadge.textContent = text;
}

// Charts
function initCharts() {
  const ctxH = document.getElementById('hashrateChart').getContext('2d');
  chartHashrate = new Chart(ctxH, {
    type: 'line',
    data: { labels: historyRows.map(r => r.time), datasets: [{
      label: 'Hashrate (H/s)',
      data: historyRows.map(r => r.hashrate),
      borderColor: '#ff6600',
      backgroundColor: 'rgba(255, 102, 0, 0.18)',
      fill: true, tension: 0.3
    }]},
    options: { responsive: true, plugins: { legend: { display: false } } }
  });

  const ctxST = document.getElementById('sharesTimeChart').getContext('2d');
  chartSharesTime = new Chart(ctxST, {
    type: 'line',
    data: { labels: historyRows.map(r => r.time), datasets: [
      { label: 'Accepted', data: historyRows.map(r => r.accepted ?? 0), borderColor: '#ff6600', tension: 0.3 },
      { label: 'Rejected', data: historyRows.map(r => r.rejected ?? 0), borderColor: '#ff4d6d', tension: 0.3 }
    ]},
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });

  const ctxS = document.getElementById('sharesChart').getContext('2d');
  chartShares = new Chart(ctxS, {
    type: 'pie',
    data: { labels: ['Accepted', 'Rejected'], datasets: [{ data: [0,0], backgroundColor: ['#ff6600','#ff4d6d'] }] },
    options: { responsive: true }
  });
}

// Workers table
function renderWorkersTable(list) {
  const filter = (ui.workerFilter?.value || '').toLowerCase();
  ui.workersTableBody.innerHTML = '';
  (list || []).filter(w => (w.name || '').toLowerCase().includes(filter)).forEach(w => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(w.name || '—')}</td>
      <td>${Number(w.hashrate || 0)} H/s</td>
      <td>${Number(w.accepted || 0)}</td>
      <td>${Number(w.rejected || 0)}</td>
      <td>${escapeHtml(w.lastUpdate || '—')}`;
    ui.workersTableBody.appendChild(tr);
  });
}

// Update UI from API
function updateUI(data) {
  const hr = Number(data.hashrate || data.total_hashrate || 0);
  const workers = Number(data.workers || data.total?.workers || (Array.isArray(data.workers_list) ? data.workers_list.length : 0));
  const accepted = Number(data.accepted || data.total?.accepted || data.shares?.accepted || 0);
  const rejected = Number(data.rejected || data.total?.rejected || data.shares?.rejected || 0);
  const pool = data.pool || data.route || data.current_pool || 'N/A';

  ui.hashrate.textContent = formatHashrate(hr);
  ui.workers.textContent = workers;
  ui.accepted.textContent = accepted;
  ui.rejected.textContent = rejected;
  ui.pool.textContent = pool;
  ui.uptime.textContent = formatUptime(Date.now() - startTime);

  const now = new Date().toLocaleTimeString();
  const limit = CONFIG.chartPoints;

  chartHashrate.data.labels.push(now);
  chartHashrate.data.datasets[0].data.push(hr);
  if (chartHashrate.data.labels.length > limit) {
    chartHashrate.data.labels.shift();
    chartHashrate.data.datasets[0].data.shift();
  }
  chartHashrate.update();

  chartShares.data.datasets[0].data = [accepted, rejected];
  chartShares.update();

  chartSharesTime.data.labels.push(now);
  chartSharesTime.data.datasets[0].data.push(accepted);
  chartSharesTime.data.datasets[1].data.push(rejected);
  if (chartSharesTime.data.labels.length > limit) {
    chartSharesTime.data.labels.shift();
    chartSharesTime.data.datasets.forEach(ds => ds.data.shift());
  }
  chartSharesTime.update();

  const wl = data.workers_list || data.workersList || [];
  renderWorkersTable(wl);

  historyRows.push({ time: now, hashrate: hr, workers, accepted, rejected, pool, workers_list: wl });
  localStorage.setItem('historyRows', JSON.stringify(historyRows));
  if (ui.btnExportCsv) ui.btnExportCsv.disabled = historyRows.length === 0;
}

// Fetch
async function fetchStats() {
  const url = CONFIG.endpoint;
  if (ui.apiUrlLabel) ui.apiUrlLabel.textContent = url;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setStatusBadge('ok', 'Online');
    ui.statusMsg.textContent = '';
    updateUI(data);
  } catch (err) {
    setStatusBadge('warn', 'Demo');
    ui.statusMsg.textContent = 'Endpoint non raggiungibile (usa locale o HTTPS+CORS).';
  }
}

// Controls
ui.btnRefresh?.addEventListener('click', fetchStats);
ui.rangeSelect?.addEventListener('change', () => {
  const v = Number(ui.rangeSelect.value);
  localStorage.setItem('chartPoints', String(v));
  toast('Punti grafico: ' + v);
});
ui.btnClearChart?.addEventListener('click', () => {
  chartHashrate.data.labels = [];
  chartHashrate.data.datasets[0].data = [];
  chartSharesTime.data.labels = [];
  chartSharesTime.data.datasets.forEach(ds => ds.data = []);
  chartHashrate.update(); chartSharesTime.update();
  historyRows = [];
  localStorage.setItem('historyRows', JSON.stringify(historyRows));
  toast('Grafici e storico puliti.');
});
ui.btnUnit?.addEventListener('click', () => {
  unitIndex = (unitIndex + 1) % 3;
  localStorage.setItem('unitIndex', String(unitIndex));
  toast('Unità hashrate: ' + (['H/s','kH/s','MH/s'][unitIndex]));
});
ui.workerFilter?.addEventListener('input', () => {
  const last = historyRows[historyRows.length - 1];
  renderWorkersTable(last?.workers_list || []);
});

// Tema
ui.themeToggle?.addEventListener('click', () => {
  const isDark = document.body.classList.contains('theme-dark');
  document.body.classList.toggle('theme-dark', !isDark);
  document.body.classList.toggle('theme-light', isDark);
  ui.themeToggle.innerHTML = isDark
    ? '<i class="fas fa-sun"></i><span>Light</span>'
    : '<i class="fas fa-moon"></i><span>Dark</span>';
});

// Share
ui.shareLink?.addEventListener('click', async () => {
  const url = new URL(location.href);
  url.searchParams.set('api', CONFIG.endpoint);
  try {
    await navigator.clipboard.writeText(url.toString());
    toast('Link copiato.');
  } catch {
    alert('Copia questo link: ' + url.toString());
  }
});

// API override da UI
ui.btnApiApply?.addEventListener('click', () => {
  const val = (ui.apiInput?.value || '').trim();
  if (!val) return toast('Inserisci un endpoint.');
  CONFIG.endpoint = val;
  localStorage.setItem('activeEndpoint', val);
  toast('Endpoint aggiornato.');
  fetchStats();
});

// Export CSV
ui.btnExportCsv?.addEventListener('click', () => {
  if (!historyRows.length) return toast('Niente da esportare.');
  const headers = ['time','hashrate','workers','accepted','rejected','pool'];
  const csv = [
    headers.join(','),
    ...historyRows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'xmr-nexus-history.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});

// Init
function init() {
  if (!localStorage.getItem('startTime')) localStorage.setItem('startTime', String(startTime));
  initCharts();
  setStatusBadge('warn', 'Demo');
  fetchStats();
  setInterval(() => { ui.uptime.textContent = formatUptime(Date.now() - startTime); }, 1000);
  setInterval(fetchStats, CONFIG.refreshMs);
}
document.addEventListener('DOMContentLoaded', init);
