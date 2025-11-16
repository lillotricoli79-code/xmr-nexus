
// Endpoint preimpostato sul Worker deployato
const ENDPOINTS_DEFAULT = [
  "https://xmrnexusproxy.proxynexus.workers.dev/stats"
];

const savedActive = localStorage.getItem("activeEndpoint");
const savedList = JSON.parse(localStorage.getItem("endpointList") || "[]");
const queryApi = new URLSearchParams(location.search).get("api");

let ENDPOINTS = [];
if (queryApi) ENDPOINTS.push(queryApi);
ENDPOINTS = ENDPOINTS.concat(savedList.length ? savedList : ENDPOINTS_DEFAULT);

let currentEndpointIndex = Math.max(0, ENDPOINTS.findIndex(e => e === savedActive));
if (currentEndpointIndex === -1) currentEndpointIndex = 0;

const CONFIG = {
  refreshMs: 5000,
  chartPoints: Number(localStorage.getItem("chartPoints")) || 40
};

let chartHashrate, chartShares, chartSharesTime;
let startTime = Number(localStorage.getItem("startTime")) || Date.now();
let historyRows = JSON.parse(localStorage.getItem("historyRows") || "[]");
let unitIndex = Number(localStorage.getItem("unitIndex")) || 0;

// UI refs
const ui = {
  hashrate: document.getElementById("hashrate"),
  pool: document.getElementById("pool"),
  workers: document.getElementById("workers"),
  accepted: document.getElementById("accepted"),
  rejected: document.getElementById("rejected"),
  uptime: document.getElementById("uptime"),
  statusMsg: document.getElementById("statusMsg"),
  statusBadge: document.getElementById("statusBadge"),
  workersTableBody: document.querySelector("#workersTable tbody"),
  workerFilter: document.getElementById("workerFilter"),
  themeToggle: document.getElementById("themeToggle"),
  shareLink: document.getElementById("shareLink")
};

// Helpers
function getEndpoint() { return ENDPOINTS[currentEndpointIndex] || ENDPOINTS_DEFAULT[0]; }
function setStatusBadge(kind, text) {
  ui.statusBadge.className = "badge " + (kind === "ok" ? "badge-ok" : kind === "err" ? "badge-err" : "badge-warn");
  ui.statusBadge.textContent = text;
}
function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}
function formatHashrate(hr) {
  const units = ["H/s","kH/s","MH/s"];
  const divisors = [1, 1e3, 1e6];
  const val = (hr / divisors[unitIndex]).toFixed(2);
  return `${val} ${units[unitIndex]}`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Charts init
function initCharts() {
  const ctxH = document.getElementById("hashrateChart").getContext("2d");
  chartHashrate = new Chart(ctxH, { type: "line", data: { labels: [], datasets: [{ label: "Hashrate", data: [], borderColor: "#ff6600" }] } });
  const ctxST = document.getElementById("sharesTimeChart").getContext("2d");
  chartSharesTime = new Chart(ctxST, { type: "line", data: { labels: [], datasets: [{ label: "Accepted", data: [], borderColor: "#00cc66" }, { label: "Rejected", data: [], borderColor: "#cc0000" }] } });
  const ctxS = document.getElementById("sharesChart").getContext("2d");
  chartShares = new Chart(ctxS
