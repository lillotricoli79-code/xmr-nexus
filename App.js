

// Lista endpoint con priorità locale
const ENDPOINTS_DEFAULT = [
  'http://127.0.0.1:8080/stats?access-token=123456'
];

const savedActive = localStorage.getItem('activeEndpoint');
const savedList = JSON.parse(localStorage.getItem('endpointList') || '[]');
const queryApi = new URLSearchParams(location.search).get('api');

let ENDPOINTS = [];
if (queryApi) ENDPOINTS.push(queryApi);
ENDPOINTS = ENDPOINTS.concat(savedList.length ? savedList : ENDPOINTS_DEFAULT);

let currentEndpointIndex = Math.max(0, ENDPOINTS.findIndex(e => e === savedActive));
if (currentEndpointIndex === -1) currentEndpointIndex = 0;

const CONFIG = {
  refreshMs: 5000,
  chartPoints: Number(localStorage.getItem('chartPoints')) || 40
};

let chartHashrate, chartShares, chartSharesTime;
let startTime = Number(localStorage.getItem('startTime')) || Date.now();
let historyRows = JSON.parse(localStorage.getItem('historyRows') || '[]');
let workersData = [];
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
  walletInput: document.getElementById('walletInput'),
  btnGenWin: document.getElementById('btnGenWin'),
  btnGenLin: document.getElementById('btnGenLin'),
  themeToggle: document.getElementById('themeToggle'),
  shareLink: document.getElementById('shareLink'),
  apiInput: document.getElementById('apiInput'),
  apiUrlLabel: document.getElementById('apiUrlLabel'),
  btnApiApply: document.getElementById('btnApiApply'),
  btnRefresh: document.getElementById('btnRefresh')
};

// Helpers endpoint
function getEndpoint() {
  return ENDPOINTS[currentEndpointIndex] || ENDPOINTS_DEFAULT[0];
}
function setActiveEndpoint(idx) {
  currentEndpointIndex = idx;
  const active = getEndpoint();
  localStorage.setItem('activeEndpoint', active);
  ui.apiUrlLabel.textContent = active;
}
function nextEndpoint() {
  currentEndpointIndex = (currentEndpointIndex + 1) % ENDPOINTS.length;
  setActiveEndpoint(currentEndpointIndex);
}
function pushEndpoint(url) {
  if (!url) return;
  if (!ENDPOINTS.includes(url)) ENDPOINTS.push(url);
  localStorage.setItem('endpointList', JSON.stringify(ENDPOINTS));
}

// Tema
ui.themeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.contains('theme-dark');
  document.body.classList.toggle('theme-dark', !isDark);
  document.body.classList.toggle('theme-light', isDark);
  ui.themeToggle.innerHTML = isDark
    ? '<i class="fas fa-sun"></i><span>Light</span>'
    : '<i class="fas fa-moon"></i><span>Dark</span>';
});

// Share link
ui.shareLink.addEventListener('click', async () => {
  const url = new URL(location.href);
  url.searchParams.set('api', getEndpoint());
  try {
    await navigator.clipboard.writeText(url.toString());
    toast('Link copiato negli appunti.');
  } catch {
    alert('Copia il link: ' + url.toString());
  }
});

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
      fill: true,
      tension: 0.3
    }]},
    options: { responsive: true }
  });

  const ctxST = document.getElementById('sharesTimeChart').getContext('2d');
  chartSharesTime = new Chart(ctxST, {
    type: 'line',
    data: { labels: historyRows.map(r => r.time), datasets: [
      { label: 'Accepted', data: historyRows.map(r => r.accepted ?? 0), borderColor: '#ff6600', tension: 0.3 },
      { label: 'Rejected', data: historyRows.map(r => r.rejected ?? 0), borderColor: '#ff4d6d', tension: 0.3 }
    ]}
  });

  const ctxS = document.getElementById('sharesChart').getContext('2d');
  chartShares = new Chart(ctxS, {
    type: 'pie',
    data: { labels: ['Accepted', 'Rejected'], datasets: [{ data: [0,0], backgroundColor: ['#ff6600','#ff4d6d'] }] }
  });
}

// Badge
function setStatusBadge(kind, text) {
  ui.statusBadge.className = 'badge ' + (kind === 'ok' ? 'badge-ok' : kind === 'err' ? 'badge-err' : 'badge-warn');
  ui.statusBadge.textContent = text;
}

// Helpers
function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}
function formatHashrate(hr) {
  const units = ['H/s','kH/s','MH/s'];
  const divisors = [1, 1e3, 1e6];
  const val = (hr / divisors[unitIndex]).toFixed(2);
  return `${val} ${units[unitIndex]}`;
}
function toast(msg) {
  ui.statusMsg.textContent = msg;
  setTimeout(() => { if (ui.statusMsg.textContent === msg) ui.statusMsg.textContent = ''; }, 4000);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Worker table
function renderWorkersTable(list) {
  const filter = (ui.workerFilter?.value || '').toLowerCase();
  ui.workersTableBody.innerHTML = '';
  list.filter(w => (w.name || '').toLowerCase().includes(filter)).forEach(w => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(w.name || '—')}</td>
      <td>${Number(w.hashrate || 0)} H/s</td>
      <td>${Number(w.accepted || 0)}</td>
      <td>${Number(w.rejected || 0)}</td>
      <td>${w.lastUpdate || '—'}`;
    ui.workersTableBody.appendChild(tr);
  });
}

// Update UI
function updateUI(data) {
  const hr = Number(data.hashrate || data.total_hashrate || 0);
  const workers = Number(data.workers || data.total?.workers || 0);
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
  chartHashrate.data.labels.push(now);
  chartHashrate.data.datasets[0].data.push(hr);
  if (chartHashrate.data.labels.length > CONFIG.chartPoints) {
    chartHashrate.data.labels.shift();
    chartHashrate.data.datasets[0].data.shift();
  }
  chartHashrate.update();

  chartShares.data.datasets[0].
