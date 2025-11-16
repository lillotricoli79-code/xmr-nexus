
// Multi-endpoint con fallback automatico e priorità locale
const ENDPOINTS_DEFAULT = [
  'http://127.0.0.1:8080/stats?access-token=123456', // Locale (prioritario)
  // Aggiungi qui eventuali endpoint remoti HTTPS, es.: 'https://nexus.tuo-dominio/stats'
];

const savedActive = localStorage.getItem('activeEndpoint');
const savedList = JSON.parse(localStorage.getItem('endpointList') || '[]');

// Lista endpoint attiva: query param ?api=..., poi lista salvata, altrimenti default
const queryApi = new URLSearchParams(location.search).get('api');
let ENDPOINTS = [];
if (queryApi) ENDPOINTS.push(queryApi);
ENDPOINTS = ENDPOINTS.concat(savedList.length ? savedList : ENDPOINTS_DEFAULT);

// Stato endpoint corrente
let currentEndpointIndex =
  Math.max(0, ENDPOINTS.findIndex(e => e === savedActive));
if (currentEndpointIndex === -1) currentEndpointIndex = 0;

const CONFIG = {
  refreshMs: 5000,
  chartPoints: Number(localStorage.getItem('chartPoints')) || 40
};

let chartHashrate, chartShares, chartSharesTime;
let demoMode = true;
let startTime = Number(localStorage.getItem('startTime')) || Date.now();
let historyRows = JSON.parse(localStorage.getItem('historyRows') || '[]');
let workersData = [];
let unitIndex = Number(localStorage.getItem('unitIndex')) || 0; // 0:H/s,1:kH/s,2:MH/s

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
  // Evita duplicati
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

// Condivisione link (API inclusa)
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

// Grafici
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
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        x: { title: { display: true, text: 'Tempo' }, ticks: { color: '#e9edf1' } },
        y: { beginAtZero: true, title: { display: true, text: 'H/s' }, ticks: { color: '#e9edf1' } }
      }
    }
  });

  const ctxST = document.getElementById('sharesTimeChart').getContext('2d');
  chartSharesTime = new Chart(ctxST, {
    type: 'line',
    data: { labels: historyRows.map(r => r.time), datasets: [
      { label: 'Accepted', data: historyRows.map(r => r.accepted ?? 0), borderColor: '#ff6600', tension: 0.3 },
      { label: 'Rejected', data: historyRows.map(r => r.rejected ?? 0), borderColor: '#ff4d6d', tension: 0.3 }
    ]},
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#e9edf1' } } } }
  });

  const ctxS = document.getElementById('sharesChart').getContext('2d');
  chartShares = new Chart(ctxS, {
    type: 'pie',
    data: { labels: ['Accepted', 'Rejected'], datasets: [{ data: [0,0], backgroundColor: ['#ff6600','#ff4d6d'] }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#e9edf1' } } } }
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
  list
    .filter(w => (w.name || '').toLowerCase().includes(filter))
    .forEach(w => {
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

// Wallet totals + estimates (opzionale)
function updateWalletTotals(walletData, currentHr, networkHashrate, rewardXMR) {
  if (!walletData || !ui.totalPaid) return;
  ui.totalPaid.textContent = `${Number(walletData.total_paid || 0).toFixed(6)} XMR`;
  ui.pending.textContent = `${Number(walletData.pending || 0).toFixed(6)} XMR`;
  ui.lastPayout.textContent = walletData.last_payout || '—';
  ui.payoutThreshold.textContent = `${walletData.payout_threshold || '—'} XMR`;

  const estDay = estimateXMRDay(currentHr, networkHashrate, rewardXMR);
  ui.estDay.textContent = `${estDay.toFixed(6)} XMR`;
  ui.estMonth.textContent = `${(estDay * 30).toFixed(6)} XMR`;
}

// Pool status (opzionale)
function updatePoolStatus(poolData) {
  if (!poolData || !ui.poolHashrate) return;
  ui.poolHashrate.textContent = `${Number(poolData.hashrate || 0)} H/s`;
  ui.blocks24h.textContent = poolData.blocks24h ?? '—';
  ui.poolFee.textContent = poolData.fee != null ? `${poolData.fee}%` : '—';
  ui.minPayout.textContent = `${poolData.min_payout ?? '—'} XMR`;
  ui.payoutPolicy.textContent = poolData.policy || '—';
  ui.latency.textContent = poolData.latency != null ? `${poolData.latency} ms` : '—';

  ui.recentBlocksBody.innerHTML = '';
  (poolData.recent_blocks || []).forEach(b => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${b.date}</td><td>${b.number}</td><td>${b.reward} XMR</td>`;
    ui.recentBlocksBody.appendChild(tr);
  });
}

// Estimation
function estimateXMRDay(hr, networkHashrate, reward) {
  if (!hr || !networkHashrate || !reward) return 0;
  const share = hr / networkHashrate;
  return share * reward * 720; // ~720 blocchi/giorno
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
  const limit = CONFIG.chartPoints;
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

  historyRows.push({ time: now, hashrate: hr, workers, accepted, rejected, pool });
  localStorage.setItem('historyRows', JSON.stringify(historyRows));

  workersData = data.workers_list || data.workersList || workersData;
  renderWorkersTable(workersData);
}

// Fetch con fallback e priorità locale
let switching = false;
async function fetchStats() {
  const url = getEndpoint();
  ui.apiUrlLabel.textContent = url;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    demoMode = false;
    setStatusBadge('ok', 'Online');
    ui.statusMsg.textContent = '';

    updateUI(data);
    updateWalletTotals(
      data.wallet || data.user || null,
      Number(data.hashrate || data.total_hashrate || 0),
      Number(data.network_hashrate || data.networkHashrate || 0),
      Number(data.block_reward || data.blockReward || 0.6)
    );
    updatePoolStatus({
      hashrate: data.pool_hashrate || data.poolHashrate,
      blocks24h: data.blocks24h,
      fee: data.fee,
      min_payout: data.min_payout,
      policy: data.policy,
      recent_blocks: data.recent_blocks
    });

    // Memorizza endpoint funzionante
    localStorage.setItem('activeEndpoint', url);
  } catch (err) {
    // Fallback automatico
    setStatusBadge('warn', 'Fallback');
    ui.statusMsg.textContent = 'Endpoint non raggiungibile, cambio al successivo…';
    if (switching) return;
    switching = true;
    nextEndpoint();
    // Riprova subito con il prossimo
    setTimeout(() => { switching = false; fetchStats(); }, 250);
  }
}

// Controlli
ui.btnRefresh.addEventListener('click', fetchStats);

ui.rangeSelect.addEventListener('change', () => {
  const v = Number(ui.rangeSelect.value);
  localStorage.setItem('chartPoints', String(v));
});

ui.btnClearChart.addEventListener('click', () => {
  chartHashrate.data.labels = [];
  chartHashrate.data.datasets[0].data = [];
  chartSharesTime.data.labels = [];
  chartSharesTime.data.datasets.forEach(ds => ds.data = []);
  chartHashrate.update();
  chartSharesTime.update();
  historyRows = [];
  localStorage.setItem('historyRows', JSON.stringify(historyRows));
  toast('Grafici e storico puliti.');
});

ui.btnUnit.addEventListener('click', () => {
  unitIndex = (unitIndex + 1) % 3;
  localStorage.setItem('unitIndex', String(unitIndex));
  toast('Unità hashrate aggiornate.');
});

ui.workerFilter?.addEventListener('input', () => renderWorkersTable(workersData));

// ZIP generator (config + script)
ui.btnGenWin.addEventListener('click', () => generateZip('windows'));
ui.btnGenLin.addEventListener('click', () => generateZip('linux'));

async function generateZip(target) {
  const wallet = (ui.walletInput.value || '').trim();
  if (!wallet) {
    alert('⚠️ Inserisci un indirizzo Monero valido prima di scaricare il ZIP.');
    return;
  }
  localStorage.setItem('wallet', wallet);

  const minerConfig = {
    autosave: true,
    cpu: { enabled: true },
    pools: [{
      coin: "monero",
      url: "pool.moneroocean.stream:443",
      user: wallet,
      pass: "x",
      tls: true,
      keepalive: true
    }]
  };

  const winBat = `@echo off
xmrig.exe -c config.json
pause
`;
  const linSh = `#!/usr/bin/env bash
chmod +x ./xmrig
./xmrig -c config.json
`;

  const zip = new JSZip();
  zip.file('config.json', JSON.stringify(minerConfig, null, 2));
  if (target === 'windows') zip.file('start-xmrig.bat', winBat);
  else zip.file('start-xmrig.sh', linSh);

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `xmr-nexus-${target}.zip`);
  toast('ZIP generato.');
}

// Applica API e aggiunge alla lista
ui.btnApiApply.addEventListener('click', () => {
  const url = ui.apiInput.value.trim();
  if (!url) return toast('Inserisci un endpoint API valido.');
  pushEndpoint(url);
  // Imposta subito come attivo
  setActiveEndpoint(ENDPOINTS.indexOf(url));
  toast('Endpoint API aggiornato.');
  fetchStats();
});

// Init
function init() {
  if (!localStorage.getItem('startTime')) localStorage.setItem('startTime', String(startTime));
  setActiveEndpoint(currentEndpointIndex);
  initCharts();
  setStatusBadge('warn', 'Demo');
  fetchStats();
  setInterval(() => { ui.uptime.textContent = formatUptime(Date.now() - startTime); }, 1000);
  setInterval(fetchStats, CONFIG.refreshMs);
}
document.addEventListener('DOMContentLoaded', init);
