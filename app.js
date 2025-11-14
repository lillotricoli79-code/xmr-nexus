
// Config base e stato
const CONFIG = {
  statsUrl: new URLSearchParams(location.search).get('api') || 'http://localhost:8080/stats',
  refreshMs: 5000,
  chartPoints: Number(localStorage.getItem('chartPoints')) || 40
};

let chartHashrate, chartShares, chartSharesTime;
let demoMode = true;
let startTime = Number(localStorage.getItem('startTime')) || Date.now();
let historyRows = JSON.parse(localStorage.getItem('historyRows') || '[]');
let workersData = [];
let unitIndex = Number(localStorage.getItem('unitIndex')) || 0; // 0:H/s,1:kH/s,2:MH/s
let notifyOn = localStorage.getItem('notifyOn') === 'true';
let notifyThresholdVal = Number(localStorage.getItem('notifyThreshold')) || 0;

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

  themeToggle: document.getElementById('themeToggle'),
  shareLink: document.getElementById('shareLink'),

  poolSelect: document.getElementById('poolSelect'),
  btnPool: document.getElementById('btnPool'),

  apiInput: document.getElementById('apiInput'),
  apiUrlLabel: document.getElementById('apiUrlLabel'),
  btnApiApply: document.getElementById('btnApiApply'),
  btnRefresh: document.getElementById('btnRefresh'),

  rangeSelect: document.getElementById('rangeSelect'),
  btnClearChart: document.getElementById('btnClearChart'),
  btnUnit: document.getElementById('btnUnit'),

  workersTableBody: document.querySelector('#workersTable tbody'),
  workerFilter: document.getElementById('workerFilter'),

  walletInput: document.getElementById('walletInput'),
  btnGenWin: document.getElementById('btnGenWin'),
  btnGenLin: document.getElementById('btnGenLin'),

  notifyThreshold: document.getElementById('notifyThreshold'),
  btnNotifyOn: document.getElementById('btnNotifyOn'),
  btnNotifyOff: document.getElementById('btnNotifyOff'),

  // Totali wallet
  totalPaid: document.getElementById('totalPaid'),
  pending: document.getElementById('pending'),
  lastPayout: document.getElementById('lastPayout'),
  payoutThreshold: document.getElementById('payoutThreshold'),
  estDay: document.getElementById('estDay'),
  estMonth: document.getElementById('estMonth'),

  // Stato pool
  poolHashrate: document.getElementById('poolHashrate'),
  blocks24h: document.getElementById('blocks24h'),
  poolFee: document.getElementById('poolFee'),
  minPayout: document.getElementById('minPayout'),
  payoutPolicy: document.getElementById('payoutPolicy'),
  latency: document.getElementById('latency'),
  recentBlocksBody: document.querySelector('#recentBlocksTable tbody')
};

// Persistenza iniziale
if (localStorage.getItem('wallet')) ui.walletInput.value = localStorage.getItem('wallet');
if (localStorage.getItem('pool')) ui.pool.textContent = localStorage.getItem('pool');
if (localStorage.getItem('api')) {
  CONFIG.statsUrl = localStorage.getItem('api');
  ui.apiInput.value = CONFIG.statsUrl;
}
ui.apiUrlLabel.textContent = CONFIG.statsUrl;
ui.notifyThreshold.value = notifyThresholdVal || '';

// Tema (Monero palette)
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
  url.searchParams.set('api', CONFIG.statsUrl);
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
      scales: { x: { title: { display: true, text: 'Tempo' } }, y: { beginAtZero: true, title: { display: true, text: 'H/s' } } }
    }
  });

  const ctxST = document.getElementById('sharesTimeChart').getContext('2d');
  chartSharesTime = new Chart(ctxST, {
    type: 'line',
    data: { labels: historyRows.map(r => r.time), datasets: [
      { label: 'Accepted', data: historyRows.map(r => r.accepted), borderColor: '#ff6600', tension: 0.3 },
      { label: 'Rejected', data: historyRows.map(r => r.rejected), borderColor: '#ff4d6d', tension: 0.3 }
    ]},
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });

  const ctxS = document.getElementById('sharesChart').getContext('2d');
  chartShares = new Chart(ctxS, {
    type: 'pie',
    data: { labels: ['Accepted', 'Rejected'], datasets: [{ data: [0,0], backgroundColor: ['#ff6600','#ff4d6d'] }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

// Badge
function setStatusBadge(kind, text) {
  ui.statusBadge.className = 'badge ' + (kind === 'ok' ? 'badge-ok' : kind === 'err' ? 'badge-err' : 'badge-warn');
  ui.statusBadge.textContent = text;
}

// Uptime
function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

// Unità dinamiche
function formatHashrate(hr) {
  const units = ['H/s','kH/s','MH/s'];
  const divisors = [1, 1e3, 1e6];
  const val = (hr / divisors[unitIndex]).toFixed(2);
  return `${val} ${units[unitIndex]}`;
}

// Tabella worker
function renderWorkersTable(list) {
  const filter = (ui.workerFilter.value || '').toLowerCase();
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

// Wallet totals + estimates
function updateWalletTotals(walletData, currentHr, networkHashrate, rewardXMR) {
  if (!walletData) return;
  ui.totalPaid.textContent = `${Number(walletData.total_paid || 0).toFixed(6)} XMR`;
  ui.pending.textContent = `${Number(walletData.pending || 0).toFixed(6)} XMR`;
  ui.lastPayout.textContent = walletData.last_payout || '—';
  ui.payoutThreshold.textContent = `${walletData.payout_threshold || '—'} XMR`;

  const estDay = estimateXMRDay(currentHr, networkHashrate, rewardXMR);
  ui.estDay.textContent = `${estDay.toFixed(6)} XMR`;
  ui.estMonth.textContent = `${(estDay * 30).toFixed(6)} XMR`;
}

// Pool status
function updatePoolStatus(poolData) {
  if (!poolData) return;
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

// Ping
async function pingPool(host) {
  const t0 = performance.now();
  try { await fetch(`https://${host}`, { method: 'HEAD', mode: 'no-cors' }); } catch {}
  return Math.round(performance.now() - t0);
}

// Stima XMR/day (indicativa ~720 blocchi/giorno)
function estimateXMRDay(hr, networkHashrate, reward) {
  if (!hr || !networkHashrate || !reward) return 0;
  const share = hr / networkHashrate;
  return share * reward * 720;
}

// UI update principale
function updateUI(data) {
  const hr = Number(data.hashrate || 0);
  const workers = Number(data.workers || 0);
  const accepted = Number(data.accepted || 0);
  const rejected = Number(data.rejected || 0);
  const pool = data.pool || data.selectedPool || 'N/A';

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

  // CSV history + persist
  historyRows.push({ time: now, hashrate: hr, workers, accepted, rejected, pool });
  localStorage.setItem('historyRows', JSON.stringify(historyRows));

  // Workers
  workersData = data.workersList || workersData;
  renderWorkersTable(workersData);

  // Notifiche
  if (notifyOn && notifyThresholdVal > 0 && hr < notifyThresholdVal) {
    try { new Notification('XMR Nexus', { body: `Hashrate sotto soglia: ${formatHashrate(hr)}`, icon: 'src/logo.svg' }); } catch {}
  }
}

// Fetch stats
async function fetchStats() {
  ui.apiUrlLabel.textContent = CONFIG.statsUrl;

  try {
    const res = await fetch(CONFIG.statsUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    demoMode = false;
    ui.statusMsg.textContent = '';
    setStatusBadge('ok', 'Online');

    // Adattamento chiavi comuni
    updateUI({
      hashrate: data.hashrate || data.totalHashrate || data.total_hashrate || 0,
      workers: data.workers || data.total?.workers || (Array.isArray(data.workers_list) ? data.workers_list.length : 0),
      accepted: data.accepted || data.total?.accepted || data.shares?.accepted || 0,
      rejected: data.rejected || data.total?.rejected || data.shares?.rejected || 0,
      pool: data.pool || data.route || data.current_pool || 'Monero',
      workersList: data.workers_list || data.workersList || []
    });

    // Dati aggiuntivi opzionali se il tuo backend li espone
    updateWalletTotals(
      data.wallet || data.user || null,
      Number(data.hashrate || 0),
      Number(data.network_hashrate || data.networkHashrate || 0),
      Number(data.block_reward || data.blockReward || 0.6) // fallback indicativo
    );

    // Stato pool se disponibile
    const latencyHost = (poolUrlMap[ui.pool.textContent] || {}).latencyHost;
    updatePoolStatus({
      hashrate: data.pool_hashrate || data.poolHashrate,
      blocks24h: data.blocks24h,
      fee: data.fee,
      min_payout: data.min_payout,
      policy: data.policy,
      recent_blocks: data.recent_blocks,
      latency: latencyHost ? await pingPool(latencyHost) : undefined
    });

  } catch (err) {
    if (!demoMode) {
      ui.statusMsg.textContent = 'API non raggiungibile. Modalità demo attiva.';
      setStatusBadge('warn', 'Demo');
    }
    demoMode = true;

    const simWorkers = Math.floor(Math.random() * 5);
    const simList = Array.from({ length: simWorkers }).map((_, i) => ({
      name: `worker-${i + 1}`,
      hashrate: Number((Math.random() * 800 + 200).toFixed(0)),
      accepted: Math.floor(Math.random() * 120),
      rejected: Math.floor(Math.random() * 10),
      lastUpdate: new Date().toLocaleTimeString()
    }));

    const simHr = Number((Math.random() * 1500 + 300).toFixed(0));
    updateUI({
      hashrate: simHr,
      workers: simWorkers,
      accepted: simList.reduce((a, b) => a + b.accepted, 0),
      rejected: simList.reduce((a, b) => a + b.rejected, 0),
      pool: ui.pool.textContent === 'N/A' ? (localStorage.getItem('pool') || 'MoneroOcean') : ui.pool.textContent,
      workersList: simList
    });

    // Demo wallet totals
    updateWalletTotals(
      { total_paid: 0.002656, pending: 0.000105, last_payout: '—', payout_threshold: 0.1 },
      simHr, 2.52e8, 0.6
    );

    // Demo pool status
    updatePoolStatus({
      hashrate: 2.52e8,
      blocks24h: Math.floor(Math.random() * 120),
      fee: 1.0,
      min_payout: 0.1,
      policy: 'PPLNS',
      recent_blocks: [
        { date: new Date().toLocaleString(), number: 450086, reward: 0.6 },
        { date: new Date(Date.now() - 3600e3).toLocaleString(), number: 450000, reward: 0.58 }
      ],
      latency: Math.floor(Math.random() * 80 + 40)
    });
  }
}

// Controlli UI
ui.btnRefresh.addEventListener('click', fetchStats);

ui.rangeSelect.addEventListener('change', () => {
  CONFIG.chartPoints = Number(ui.rangeSelect.value);
  localStorage.setItem('chartPoints', String(CONFIG.chartPoints));
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

ui.workerFilter.addEventListener('input', () => renderWorkersTable(workersData));

ui.btnApiApply.addEventListener('click', () => {
  const url = ui.apiInput.value.trim();
  if (!url) return toast('Inserisci un endpoint API valido.');
  CONFIG.statsUrl = url;
  ui.apiUrlLabel.textContent = url;
  localStorage.setItem('api', url);
  toast('Endpoint API aggiornato.');
  fetchStats();
});

ui.btnPool.addEventListener('click', () => {
  const pool = ui.poolSelect.value;
  ui.pool.textContent = pool;
  localStorage.setItem('pool', pool);
  ui.statusMsg.textContent = `Pool selezionato: ${pool}. Per applicarlo realmente, usa il tuo backend o configura xmrig.`;
  toast('Pool aggiornato nella UI.');
});

// Notifiche
ui.btnNotifyOn.addEventListener('click', async () => {
  notifyThresholdVal = Number(ui.notifyThreshold.value || 0);
  localStorage.setItem('notifyThreshold', String(notifyThresholdVal));
  if (!('Notification' in window)) return toast('Notifiche non supportate.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return toast('Notifiche non abilitate.');
  notifyOn = true;
  localStorage.setItem('notifyOn', 'true');
  toast('Notifiche abilitate.');
});
ui.btnNotifyOff.addEventListener('click', () => {
  notifyOn = false;
  localStorage.setItem('notifyOn', 'false');
  toast('Notifiche disabilitate.');
});

// Profili pool -> url/tls/host per ping
const poolUrlMap = {
  MoneroOcean: { url: 'pool.moneroocean.stream:443', tls: true, latencyHost: 'moneroocean.stream' },
  HashVault:   { url: 'pool.hashvault.pro:443', tls: true, latencyHost: 'monero.hashvault.pro' },
  SupportXMR:  { url: 'pool.supportxmr.com:443', tls: true, latencyHost: 'supportxmr.com' },
  Herominers:  { url: 'xmr.herominers.com:4444', tls: false, latencyHost: 'herominers.com' },
  Nanopool:    { url: 'xmr-eu1.nanopool.org:14444', tls: true, latencyHost: 'xmr.nanopool.org' },
  '2Miners':   { url: 'xmr.2miners.com:2222', tls: false, latencyHost: '2miners.com' },
  MineXMR:     { url: 'pool.minexmr.com:443', tls: true, latencyHost: 'minexmr.com' },
  P2Pool:      { url: '127.0.0.1:3333', tls: false, latencyHost: 'localhost' },
  Unimining:   { url: 'xmr-eu.unimining.net:3333', tls: false, latencyHost: 'unimining.net' },
  WoolyPooly:  { url: 'xmr.woolypooly.com:3100', tls: false, latencyHost: 'woolypooly.com' }
};

// Generazione ZIP locale (Windows/Linux)
ui.btnGenWin.addEventListener('click', () => generateZip('windows'));
ui.btnGenLin.addEventListener('click', () => generateZip('linux'));

async function generateZip(target) {
  const wallet = (ui.walletInput.value || '').trim();
  if (!wallet) return alert('Inserisci un indirizzo Monero valido.');
  localStorage.setItem('wallet', wallet);

  const poolName = ui.pool.textContent === 'N/A' ? (localStorage.getItem('pool') || ui.poolSelect.value) : ui.pool.textContent;
  const poolConf = poolUrlMap[poolName] || poolUrlMap.MoneroOcean;

  const minerConfig = {
    autosave: true,
    cpu: { enabled: true },
    pools: [{
      coin: "monero",
      url: poolConf.url,
      user: wallet,
      pass: "x",
      tls: poolConf.tls,
      keepalive: true
    }]
  };

  const winBat = `@echo off
echo Avvio xmrig con config per ${poolName}
xmrig.exe -c config.json
pause
`;
  const linSh = `#!/usr/bin/env bash
echo "Avvio xmrig con config per ${poolName}"
chmod +x ./xmrig
./xmrig -c config.json
`;

  const readme = `XMR Nexus - Pacchetto Config
Pool: ${poolName} (${poolConf.url}, tls=${poolConf.tls})
Wallet: ${wallet}

1) Scarica xmrig e metti l'eseguibile accanto a questi file.
2) Avvia lo script (${target === 'windows' ? 'start-xmrig.bat' : 'start-xmrig.sh'}).
3) Su GitHub Pages usa endpoint API HTTPS o proxy con CORS.`;

  const zip = new JSZip();
  zip.file('config.json', JSON.stringify(minerConfig, null, 2));
  zip.file('README.txt', readme);
  if (target === 'windows') zip.file('start-xmrig.bat', winBat);
  else zip.file('start-xmrig.sh', linSh);

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `xmr-nexus-${poolName}-${target}.zip`);
  toast('ZIP generato. Aggiungi xmrig e avvia lo script.');
}

// CSV export (Ctrl+E)
document.addEventListener('keydown', e => {
  if (e.key === 'E' && e.ctrlKey) exportCSV();
});
function exportCSV() {
  if (!historyRows.length) return toast('Nessun dato da esportare.');
  const header = 'time,hashrate,workers,accepted,rejected,pool\n';
  const body = historyRows.map(r =>
    `${r.time},${r.hashrate},${r.workers},${r.accepted},${r.rejected},${r.pool}`
  ).join('\n');
  const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'xmr-nexus-stats.csv';
  a.click();
}

// Toast semplice
function toast(msg) {
  ui.statusMsg.textContent = msg;
  setTimeout(() => { if (ui.statusMsg.textContent === msg) ui.statusMsg.textContent = ''; }, 4000);
}

// Sicurezza HTML
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Init
function init() {
  initCharts();
  setStatusBadge('warn', 'Demo');
  ui.apiInput.value = CONFIG.statsUrl;
  ui.apiUrlLabel.textContent = CONFIG.statsUrl;

  if (!localStorage.getItem('startTime')) localStorage.setItem('startTime', String(startTime));
  setInterval(() => { ui.uptime.textContent = formatUptime(Date.now() - startTime); }, 1000);

  fetchStats();
  setInterval(fetchStats, CONFIG.refreshMs);
}

document.addEventListener('DOMContentLoaded', init);
