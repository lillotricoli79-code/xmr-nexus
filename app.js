



// Config base
const CONFIG = {
  // Endpoint API del proxy (modificabile via URL: ?api=https://host:port/stats)
  statsUrl: new URLSearchParams(location.search).get('api') || 'http://localhost:8080/stats',
  // Intervallo di aggiornamento (ms)
  refreshMs: 5000,
  // Limite punti nel grafico
  chartPoints: 40
};

let chartHashrate, chartShares;
let demoMode = true;

// UI refs
const ui = {
  hashrate: document.getElementById('hashrate'),
  pool: document.getElementById('pool'),
  workers: document.getElementById('workers'),
  accepted: document.getElementById('accepted'),
  rejected: document.getElementById('rejected'),
  apiUrlLabel: document.getElementById('apiUrlLabel'),
  statusMsg: document.getElementById('statusMsg'),
  statusBadge: document.getElementById('statusBadge'),
  poolSelect: document.getElementById('poolSelect'),
  btnPool: document.getElementById('btnPool'),
  btnRefresh: document.getElementById('btnRefresh'),
  themeToggle: document.getElementById('themeToggle')
};

// Tema light/dark
ui.themeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.contains('theme-dark');
  document.body.classList.toggle('theme-dark', !isDark);
  document.body.classList.toggle('theme-light', isDark);
  ui.themeToggle.innerHTML = isDark
    ? '<i class="fas fa-sun"></i><span>Light</span>'
    : '<i class="fas fa-moon"></i><span>Dark</span>';
});

// Inizializza grafici
function initCharts() {
  const ctxH = document.getElementById('hashrateChart').getContext('2d');
  chartHashrate = new Chart(ctxH, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Hashrate (H/s)',
        data: [],
        borderColor: '#10d1b8',
        backgroundColor: 'rgba(16, 209, 184, 0.18)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: { title: { display: true, text: 'Tempo' } },
        y: { title: { display: true, text: 'H/s' }, beginAtZero: true }
      }
    }
  });

  const ctxS = document.getElementById('sharesChart').getContext('2d');
  chartShares = new Chart(ctxS, {
    type: 'pie',
    data: {
      labels: ['Accepted', 'Rejected'],
      datasets: [{
        data: [0, 0],
        backgroundColor: ['#10d1b8', '#ff4d6d']
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

// Aggiorna badge stato
function setStatusBadge(kind, text) {
  ui.statusBadge.className = 'badge ' + (kind === 'ok' ? 'badge-ok' : kind === 'err' ? 'badge-err' : 'badge-warn');
  ui.statusBadge.textContent = text;
}

// Aggiorna UI e grafici con dati
function updateUI(data) {
  const hr = Number(data.hashrate || 0);
  const workers = Number(data.workers || 0);
  const accepted = Number(data.accepted || 0);
  const rejected = Number(data.rejected || 0);
  const pool = data.pool || data.selectedPool || 'N/A';

  ui.hashrate.textContent = `${hr} H/s`;
  ui.workers.textContent = workers;
  ui.accepted.textContent = accepted;
  ui.rejected.textContent = rejected;
  ui.pool.textContent = pool;

  const now = new Date().toLocaleTimeString();
  chartHashrate.data.labels.push(now);
  chartHashrate.data.datasets[0].data.push(hr);
  if (chartHashrate.data.labels.length > CONFIG.chartPoints) {
    chartHashrate.data.labels.shift();
    chartHashrate.data.datasets[0].data.shift();
  }
  chartHashrate.update();

  chartShares.data.datasets[0].data = [accepted, rejected];
  chartShares.update();
}

// Fetch stats dal proxy (o fallback demo)
async function fetchStats() {
  ui.apiUrlLabel.textContent = CONFIG.statsUrl;

  try {
    const res = await fetch(CONFIG.statsUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    demoMode = false;
    ui.statusMsg.textContent = '';
    setStatusBadge('ok', 'Online');

    updateUI({
      hashrate: data.hashrate || data.totalHashrate || 0,
      workers: data.workers || (data.total?.workers ?? 0),
      accepted: data.accepted || data.total?.accepted || 0,
      rejected: data.rejected || data.total?.rejected || 0,
      pool: data.pool || data.route || 'Monero'
    });
  } catch (err) {
    if (!demoMode) {
      ui.statusMsg.textContent = 'Proxy non raggiungibile. Modalità demo attiva.';
      setStatusBadge('warn', 'Demo');
    }
    demoMode = true;

    // Simulazione dati in demo
    const sim = {
      hashrate: Number((Math.random() * 1500 + 300).toFixed(0)),
      workers: Math.floor(Math.random() * 5),
      accepted: Math.floor(Math.random() * 200),
      rejected: Math.floor(Math.random() * 12),
      pool: ui.pool.textContent === 'N/A' ? 'MoneroOcean' : ui.pool.textContent
    };
    updateUI(sim);
  }
}

// Cambio pool locale (UI). Per cambio reale serve backend/proxy.
function setPool() {
  const pool = ui.poolSelect.value;
  ui.pool.textContent = pool;
  ui.statusMsg.textContent = `Pool selezionato: ${pool}. Per applicarlo al proxy, usa il tuo backend o aggiorna la route del proxy.`;
}

function init() {
  initCharts();
  setStatusBadge('warn', 'Demo');
  ui.btnRefresh.addEventListener('click', fetchStats);
  ui.btnPool.addEventListener('click', setPool);
  // Primo fetch e poi interval
  fetchStats();
  setInterval(fetchStats, CONFIG.refreshMs);
}

document.addEventListener('DOMContentLoaded', init);
